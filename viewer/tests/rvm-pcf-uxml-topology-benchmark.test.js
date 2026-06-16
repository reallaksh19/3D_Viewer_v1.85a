import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  runUxmlTopologyForRvmRows,
} from '../rvm-pcf-extract/RvmUxmlTopologyBridge.js';

const BENCHMARK_DIR = path.resolve(
  process.cwd(),
  'Benchmarks/RVM JSON to PCF UXML Topology'
);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(BENCHMARK_DIR, name), 'utf8'));
}

function point(text) {
  const [x, y, z] = String(text)
    .split(',')
    .map(v => Number(v.trim()));

  return { x, y, z };
}

function distance(a, b) {
  const pa = typeof a === 'string' ? point(a) : a;
  const pb = typeof b === 'string' ? point(b) : b;

  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  const dz = pa.z - pb.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function rowType(row) {
  return String(row.type || '').toUpperCase();
}

function hasRequiredType(rows, requiredType) {
  return rows.some(row => rowType(row).includes(requiredType));
}

function findGap(rows, leftId, rightId) {
  const left = rows.find(row => row.id === leftId);
  const right = rows.find(row => row.id === rightId);

  if (!left || !right) return null;

  return distance(left.ep2, right.ep1);
}

function cloneRows(rows) {
  return JSON.parse(JSON.stringify(rows));
}

describe('RVM JSON to PCF UXML topology benchmark Agent 13', () => {
  it('benchmark fixture exists and contains 50 realistic rows', () => {
    const rows = readJson('broken-topology-50-rows.json');
    const expected = readJson('expected-uxml-topology-outcome.json');

    expect(rows).toHaveLength(expected.rowCount);

    for (const field of expected.requiredIdentityFields) {
      expect(rows.every(row => row[field] !== undefined && String(row[field]).trim() !== '')).toBe(true);
    }

    for (const requiredType of expected.requiredTypes) {
      expect(hasRequiredType(rows, requiredType)).toBe(true);
    }

    expect(findGap(rows, 'P-010', 'FLG-020')).toBe(3);
    expect(findGap(rows, 'VAL-030', 'FLG-040')).toBe(4);
    expect(findGap(rows, 'TEE-060', 'P-070')).toBe(6);
    expect(Math.round(findGap(rows, 'ELB-080', 'P-090'))).toBe(21);
    expect(Math.round(findGap(rows, 'RED-100', 'P-110'))).toBe(28);

    expect(rows.some(row => row.id === 'OLET-160' && row.cp && row.bp)).toBe(true);
    expect(rows.some(row => row.id === 'TEE-260' && row.bp)).toBe(true);
    expect(rows.some(row => row.id === 'TEE-460' && row.bp)).toBe(true);
  });

  it('runs benchmark through UXML topology mode and preserves legacy route handoff', () => {
    const rows = readJson('broken-topology-50-rows.json');
    const expected = readJson('expected-uxml-topology-outcome.json');

    const before = JSON.stringify(rows);

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'benchmark-broken-topology-50-rows',
    });

    expect(JSON.stringify(rows)).toBe(before);

    expect(result.schema).toBe('rvm-pcf-uxml-topology-bridge/v1');
    expect(result.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(result.readinessGate.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);

    expect(result.rows).toHaveLength(expected.rowCount);
    expect(result.legacyRows).toHaveLength(expected.rowCount);

    expect(result.adapter.stats.rowCount).toBe(expected.rowCount);
    expect(result.adapter.stats.componentCount).toBeGreaterThanOrEqual(expected.minimums.componentCount);
    expect(result.adapter.stats.anchorCount).toBeGreaterThanOrEqual(expected.minimums.anchorCount);
    expect(result.adapter.stats.portCount).toBeGreaterThanOrEqual(expected.minimums.portCount);
    expect(result.adapter.stats.segmentCount).toBeGreaterThanOrEqual(expected.minimums.segmentCount);

    expect(result.faceModel.schema).toBe('uxml-face-model/v1');
    expect(result.universalGraph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(result.rayGraph.schema).toBe('uxml-ray-topo-graph/v2');
    expect(result.comparison.schema).toBe('uxml-topo-graph-comparator/v1');
    expect(result.topologyDecision.schema).toBe('uxml-topology-decision-gate/v1');

    expect(result.universalGraph.summary.nodeCount).toBeGreaterThanOrEqual(expected.minimums.universalNodeCount);
    expect(result.universalGraph.summary.edgeCount).toBeGreaterThanOrEqual(expected.minimums.universalEdgeCount);
    expect(result.universalGraph.summary.disconnectedCount).toBeGreaterThanOrEqual(expected.minimums.universalDisconnectedCount);

    expect(result.rayGraph.summary.rayCandidateCount).toBeGreaterThanOrEqual(expected.minimums.rayCandidateCount);
    expect(result.rayGraph.summary.rayConnectionCount).toBeGreaterThanOrEqual(expected.minimums.rayConnectionCount);

    expect(result.topologyDecision.summary.acceptedConnectionCount).toBeGreaterThanOrEqual(expected.minimums.acceptedConnectionCount);

    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);

    expect(result.readinessGate.summary.outputBridgeReady).toBe(true);
    expect(result.readinessGate.report.allowPcfExport).toBe(true);
  });

  it('pushes topology annotations back without changing source geometry fields', () => {
    const rows = readJson('broken-topology-50-rows.json');
    const original = cloneRows(rows);

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
    });

    for (let i = 0; i < rows.length; i += 1) {
      expect(rows[i]).toEqual(original[i]);
    }

    for (let i = 0; i < result.legacyRows.length; i += 1) {
      const before = original[i];
      const after = result.legacyRows[i];

      expect(after.id).toBe(before.id);
      expect(after.type).toBe(before.type);
      expect(after.ep1).toBe(before.ep1);
      expect(after.ep2).toBe(before.ep2);
      expect(after.cp).toBe(before.cp);
      expect(after.bp).toBe(before.bp);

      expect(after._topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
      expect(after._uxmlComponentId).toBeTruthy();
      expect(typeof after._uxmlTopologyReady).toBe('boolean');
    }
  });

  it('diagnostics preserve row identity context for benchmark rows', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
    });

    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

    const identityDiagnostic = result.diagnostics.find(d =>
      d.rowNo ||
      d.refNo ||
      d.seqNo ||
      d.lineNo ||
      d.pipelineRef
    );

    expect(identityDiagnostic).toBeTruthy();
    expect(identityDiagnostic.rowNo || identityDiagnostic.details?.rowNo).toBeTruthy();
    expect(identityDiagnostic.refNo || identityDiagnostic.details?.refNo).toBeTruthy();
    expect(identityDiagnostic.seqNo || identityDiagnostic.details?.seqNo).toBeTruthy();
    expect(identityDiagnostic.pipelineRef || identityDiagnostic.details?.pipelineRef).toBeTruthy();
  });

  it('benchmark expected outcome file remains aligned with generated result shape', () => {
    const expected = readJson('expected-uxml-topology-outcome.json');

    expect(expected.schema).toBe('rvm-pcf-uxml-topology-benchmark-expected/v1');
    expect(expected.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(expected.flags.legacyRoutingContinues).toBe(true);
    expect(expected.flags.mastersDeferredToLegacyRoute).toBe(true);
    expect(expected.flags.pcfEmitterDeferredToLegacyRoute).toBe(true);
    expect(expected.flags.coordinatesMutated).toBe(false);
  });
});