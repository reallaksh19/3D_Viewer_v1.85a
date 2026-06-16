import { test, expect } from 'vitest';
import assert from 'node:assert/strict';

import { buildPcfTopoGraph } from '../../../rvm-pcf-topology/RvmPcfTopoGraphBuilder.js';
import { runPcfReadinessGate } from '../../../rvm-pcf-extract/RvmPcfReadinessGate.js';
import {
  createGapOverlapFixPlan,
  applySafeGapOverlapFixTransaction,
} from '../../../rvm-pcf-topology/RvmPcfGapOverlapResolver.js';

function p(x, y, z) {
  return { x, y, z };
}

test('exact match', () => {
  const rows = [
    { rowNo: 10, type: 'PIPE', pipelineRef: 'P1', convertedBore: 200, ep1: p(0, 0, 0), ep2: p(1000, 0, 0) },
    { rowNo: 20, type: 'VALVE', pipelineRef: 'P1', convertedBore: 200, ep1: p(1000, 0, 0), ep2: p(1200, 0, 0) },
  ];

  const graph = buildPcfTopoGraph(rows, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(graph.stats.pipeSegmentCount, 1);
  assert.equal(graph.stats.exactEndpointConnectionCount, 1);
  assert.equal(graph.stats.gapCandidateCount, 0);
});

test('gap candidate', () => {
  const rows = [
    { rowNo: 10, type: 'PIPE', pipelineRef: 'P1', convertedBore: 200, ep1: p(0, 0, 0), ep2: p(990, 0, 0) },
    { rowNo: 20, type: 'VALVE', pipelineRef: 'P1', convertedBore: 200, ep1: p(1000, 0, 0), ep2: p(1200, 0, 0) },
  ];

  const graph = buildPcfTopoGraph(rows, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(graph.stats.gapCandidateCount, 1);

  const plan = createGapOverlapFixPlan(rows, graph, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(plan.summary.safeFixPlanCount, 1);

  const tx = applySafeGapOverlapFixTransaction(rows, graph, plan, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(tx.transactionReport.committed, true);
  assert.equal(tx.rows[0].ep2.x, 1000);
  assert.equal(rows[0].ep2.x, 990); // original not mutated
});

test('overlap candidate', () => {
  const rows = [
    { rowNo: 10, type: 'PIPE', pipelineRef: 'P1', convertedBore: 200, ep1: p(0, 0, 0), ep2: p(1020, 0, 0) },
    { rowNo: 20, type: 'VALVE', pipelineRef: 'P1', convertedBore: 200, ep1: p(1000, 0, 0), ep2: p(1200, 0, 0) },
  ];

  const graph = buildPcfTopoGraph(rows, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(graph.stats.overlapCandidateCount, 1);

  const plan = createGapOverlapFixPlan(rows, graph, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(plan.summary.safeFixPlanCount, 1);
});

test('olet tap', () => {
  const rows = [
    { rowNo: 10, type: 'PIPE', pipelineRef: 'P1', convertedBore: 200, ep1: p(0, 0, 0), ep2: p(1000, 0, 0) },
    { rowNo: 20, type: 'OLET', pipelineRef: 'P1', convertedBore: 200, cp: p(500, 0, 0), bp: p(500, 100, 0) },
    { rowNo: 30, type: 'PIPE', pipelineRef: 'P1', convertedBore: 100, ep1: p(500, 100, 0), ep2: p(500, 300, 0) },
  ];

  const graph = buildPcfTopoGraph(rows, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(graph.stats.oletSegmentTapCount, 1);
  assert.equal(graph.stats.oletIssueCount, 0);
});

test('readiness gate', () => {
  const rows = [
    {
      rowNo: 10,
      type: 'VALVE',
      pipelineRef: 'P1',
      convertedBore: 200,
      ep1: p(0, 0, 0),
      ep2: p(100, 0, 0),
      ca: {
        '1': '3500 kPa',
        '2': '80 C',
        '5': '50 mm',
        '8': '125 kg',
        '10': '5250 kPa',
      },
    },
  ];

  const result = runPcfReadinessGate(rows, { connectToleranceMm: 6, fixToleranceMm: 25 });

  assert.equal(result.summary.rowMutationCount, 0);
  assert.equal(result.summary.fittingMovedCount, 0);
  assert.equal(result.summary.fittingTrimmedCount, 0);
});
