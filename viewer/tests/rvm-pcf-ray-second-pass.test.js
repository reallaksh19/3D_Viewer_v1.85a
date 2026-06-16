import { describe, it, expect } from 'vitest';

import { buildPcfTopoGraph } from '../rvm-pcf-topology/RvmPcfTopoGraphBuilder.js';

import {
  buildRaySecondPassCandidates,
  createRaySecondPassFixPlan,
  applyRaySecondPassTransaction,
} from '../rvm-pcf-topology/RvmPcfRaySecondPass.js';

const PIPELINE = '/BTRM-1000-10"-P1710011-66620M0-01/B1';
const OTHER_PIPELINE = '/OTHER-1000-10"-P1710011-66620M0-01/B1';

function p(x, y, z, bore = undefined) {
  const point = { x, y, z };
  if (bore != null) point.bore = bore;
  return point;
}

function baseOptions(extra = {}) {
  return {
    connectToleranceMm: 6,
    fixToleranceMm: 25,
    maxRayLengthMm: 500,
    perpendicularToleranceMm: 12,
    allowMediumConfidenceAutoFix: true,
    ...extra,
  };
}

function pipe(rowNo, ep1, ep2, pipelineRef = PIPELINE, bore = 100) {
  return {
    rowNo,
    type: 'PIPE',
    pipelineRef,
    convertedBore: bore,
    ep1,
    ep2,
    ca: {
      97: `P-${rowNo}`,
      98: String(rowNo),
    },
  };
}

function olet(rowNo, cp, bp, pipelineRef = PIPELINE) {
  return {
    rowNo,
    type: 'OLET',
    pipelineRef,
    convertedBore: 250,
    branchConvertedBore: 100,
    cp,
    bp,
    ca: {
      97: `OLET-${rowNo}`,
      98: String(rowNo),
    },
  };
}

function tee(rowNo, ep1, ep2, bp, cp = null, pipelineRef = PIPELINE) {
  return {
    rowNo,
    type: 'TEE',
    pipelineRef,
    convertedBore: 250,
    branchConvertedBore: 100,
    ep1,
    ep2,
    ...(cp ? { cp } : {}),
    bp,
    ca: {
      97: `TEE-${rowNo}`,
      98: String(rowNo),
    },
  };
}

function flange(rowNo, ep1, ep2, pipelineRef = PIPELINE) {
  return {
    rowNo,
    type: 'FLANGE',
    pipelineRef,
    convertedBore: 100,
    ep1,
    ep2,
    ca: {
      97: `F-${rowNo}`,
      98: String(rowNo),
    },
  };
}

function runRay(rows, options = baseOptions()) {
  const graph = buildPcfTopoGraph(rows, options);
  const ray = buildRaySecondPassCandidates(rows, graph, options);
  const plan = createRaySecondPassFixPlan(rows, graph, ray, options);
  const tx = applyRaySecondPassTransaction(rows, graph, plan, options);

  return { graph, ray, plan, tx };
}

describe('RvmPcfRaySecondPass', () => {
  it('derives HIGH confidence OLET ray from BP minus CP and moves only pipe endpoint', () => {
    const rows = [
      pipe(10, p(0, 0, 0, 250), p(1000, 0, 0, 250), PIPELINE, 250),
      olet(20, p(500, 0, 0, 250), p(500, 100, 0, 100), PIPELINE),
      pipe(30, p(500, 250, 0, 100), p(500, 1000, 0, 100), PIPELINE, 100),
    ];

    const { graph, ray, plan, tx } = runRay(rows);

    expect(graph.diagnostics.some(d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED')).toBe(true);

    expect(ray.summary.disconnectedBranchPortCount).toBe(1);
    expect(ray.summary.safeCandidateCount).toBe(1);
    expect(ray.summary.highConfidenceCandidateCount).toBe(1);

    const candidate = ray.candidates[0];
    expect(candidate.rayMethod).toBe('OLET_BP_MINUS_CP');
    expect(candidate.rayConfidence).toBe('HIGH');
    expect(candidate.distanceAlongRayMm).toBe(150);
    expect(candidate.perpendicularMissMm).toBe(0);
    expect(candidate.targetRowNo).toBe(30);
    expect(candidate.targetPointKey).toBe('ep1');

    expect(plan.summary.safePlanCount).toBe(1);

    expect(tx.transactionReport.committed).toBe(true);
    expect(tx.transactionReport.appliedFixCount).toBe(1);
    expect(tx.transactionReport.fittingMovedCount).toBe(0);
    expect(tx.transactionReport.fittingTrimmedCount).toBe(0);
    expect(tx.transactionReport.bridgePipeInjectedCount).toBe(0);

    const fixedPipe = tx.rows.find(r => r.rowNo === 30);
    expect(fixedPipe.ep1).toEqual(expect.objectContaining({ x: 500, y: 100, z: 0 }));
  });

  it('derives HIGH confidence TEE ray from BP minus CP', () => {
    const rows = [
      tee(
        100,
        p(0, 0, 0, 250),
        p(1000, 0, 0, 250),
        p(500, 100, 0, 100),
        p(500, 0, 0, 250),
        PIPELINE
      ),
      pipe(110, p(500, 300, 0, 100), p(500, 900, 0, 100), PIPELINE, 100),
    ];

    const { ray, plan, tx } = runRay(rows);

    expect(ray.summary.safeCandidateCount).toBe(1);
    expect(ray.summary.highConfidenceCandidateCount).toBe(1);

    const candidate = ray.candidates[0];
    expect(candidate.rayMethod).toBe('TEE_BP_MINUS_CP');
    expect(candidate.rayConfidence).toBe('HIGH');
    expect(candidate.distanceAlongRayMm).toBe(200);
    expect(candidate.perpendicularMissMm).toBe(0);

    expect(plan.summary.safePlanCount).toBe(1);
    expect(tx.transactionReport.committed).toBe(true);

    const fixedPipe = tx.rows.find(r => r.rowNo === 110);
    expect(fixedPipe.ep1).toEqual(expect.objectContaining({ x: 500, y: 100, z: 0 }));
  });

  it('derives MEDIUM confidence TEE ray from BP minus midpoint when CP is missing', () => {
    const rows = [
      tee(
        200,
        p(0, 0, 0, 250),
        p(1000, 0, 0, 250),
        p(500, 100, 0, 100),
        null,
        PIPELINE
      ),
      pipe(210, p(500, 300, 0, 100), p(500, 900, 0, 100), PIPELINE, 100),
    ];

    const { ray, plan, tx } = runRay(rows);

    expect(ray.summary.mediumConfidenceCandidateCount).toBe(1);

    const candidate = ray.candidates[0];
    expect(candidate.rayMethod).toBe('TEE_BP_MINUS_MAIN_MIDPOINT');
    expect(candidate.rayConfidence).toBe('MEDIUM');
    expect(candidate.safeForAutoApply).toBe(true);

    expect(plan.summary.safePlanCount).toBe(1);
    expect(tx.transactionReport.committed).toBe(true);

    const fixedPipe = tx.rows.find(r => r.rowNo === 210);
    expect(fixedPipe.ep1).toEqual(expect.objectContaining({ x: 500, y: 100, z: 0 }));
  });

  it('blocks MEDIUM confidence TEE fallback when allowMediumConfidenceAutoFix is false', () => {
    const rows = [
      tee(
        300,
        p(0, 0, 0, 250),
        p(1000, 0, 0, 250),
        p(500, 100, 0, 100),
        null,
        PIPELINE
      ),
      pipe(310, p(500, 300, 0, 100), p(500, 900, 0, 100), PIPELINE, 100),
    ];

    const { ray, plan, tx } = runRay(
      rows,
      baseOptions({
        allowMediumConfidenceAutoFix: false,
      })
    );

    expect(ray.summary.mediumConfidenceCandidateCount).toBe(1);
    expect(ray.candidates[0].safeForAutoApply).toBe(false);
    expect(ray.candidates[0].blockers).toContain('RAY_CONFIDENCE_NOT_AUTO_FIXABLE');

    expect(plan.summary.safePlanCount).toBe(0);
    expect(tx.transactionReport.committed).toBe(false);
    expect(tx.transactionReport.rejectReasons).toContain('NO_SAFE_RAY2_PLANS');
  });

  it('does not create ray candidate when OLET CP is missing', () => {
    const rows = [
      {
        rowNo: 400,
        type: 'OLET',
        pipelineRef: PIPELINE,
        convertedBore: 250,
        branchConvertedBore: 100,
        bp: p(500, 100, 0, 100),
        ca: {
          97: 'OLET-400',
          98: '400',
        },
      },
      pipe(410, p(500, 250, 0, 100), p(500, 1000, 0, 100), PIPELINE, 100),
    ];

    const graph = buildPcfTopoGraph(rows, baseOptions());
    const ray = buildRaySecondPassCandidates(rows, graph, baseOptions());
    const plan = createRaySecondPassFixPlan(rows, graph, ray, baseOptions());

    expect(ray.summary.rayCandidateCount).toBe(0);
    expect(ray.diagnostics.some(d => d.code === 'RAY2-OLET-CP-MISSING')).toBe(true);
    expect(plan.summary.safePlanCount).toBe(0);
  });

  it('rejects cross-pipeline branch target', () => {
    const rows = [
      pipe(500, p(0, 0, 0, 250), p(1000, 0, 0, 250), PIPELINE, 250),
      olet(510, p(500, 0, 0, 250), p(500, 100, 0, 100), PIPELINE),
      pipe(520, p(500, 250, 0, 100), p(500, 1000, 0, 100), OTHER_PIPELINE, 100),
    ];

    const { ray, plan, tx } = runRay(rows);

    expect(ray.summary.rayCandidateCount).toBe(0);
    expect(plan.summary.safePlanCount).toBe(0);
    expect(tx.transactionReport.committed).toBe(false);
    expect(tx.transactionReport.rejectReasons).toContain('NO_SAFE_RAY2_PLANS');
  });

  it('creates blocked candidate when ray target is a fitting endpoint, not pipe endpoint', () => {
    const rows = [
      pipe(600, p(0, 0, 0, 250), p(1000, 0, 0, 250), PIPELINE, 250),
      olet(610, p(500, 0, 0, 250), p(500, 100, 0, 100), PIPELINE),
      flange(620, p(500, 250, 0, 100), p(600, 250, 0, 100), PIPELINE),
    ];

    const { ray, plan, tx } = runRay(rows);

    expect(ray.summary.rayCandidateCount).toBe(1);
    expect(ray.summary.safeCandidateCount).toBe(0);
    expect(ray.summary.blockedCandidateCount).toBe(1);
    expect(ray.candidates[0].blockers).toContain('TARGET_NOT_PIPE_ENDPOINT');

    expect(plan.summary.safePlanCount).toBe(0);
    expect(tx.transactionReport.committed).toBe(false);
    expect(tx.transactionReport.rejectReasons).toContain('NO_SAFE_RAY2_PLANS');
  });

  it('does not accept candidates beyond max ray length', () => {
    const rows = [
      pipe(700, p(0, 0, 0, 250), p(1000, 0, 0, 250), PIPELINE, 250),
      olet(710, p(500, 0, 0, 250), p(500, 100, 0, 100), PIPELINE),
      pipe(720, p(500, 800, 0, 100), p(500, 1000, 0, 100), PIPELINE, 100),
    ];

    const { ray, plan, tx } = runRay(rows, baseOptions({ maxRayLengthMm: 500 }));

    expect(ray.summary.rayCandidateCount).toBe(0);
    expect(plan.summary.safePlanCount).toBe(0);
    expect(tx.transactionReport.committed).toBe(false);
  });
});
