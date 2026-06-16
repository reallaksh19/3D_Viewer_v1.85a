import { describe, it, expect } from 'vitest';

import { buildPcfTopoGraph } from '../../../rvm-pcf-topology/RvmPcfTopoGraphBuilder.js';
import { runPcfReadinessGate } from '../../../rvm-pcf-extract/RvmPcfReadinessGate.js';

const PIPELINE = '/BTRM-1000-10"-P1710011-66620M0-01/B1';

function p(x, y, z, bore = undefined) {
  const point = { x, y, z };
  if (bore != null) point.bore = bore;
  return point;
}

function rowsWithDisconnectedOletBranch() {
  return [
    {
      rowNo: 100,
      type: 'PIPE',
      pipelineRef: PIPELINE,
      lineNo: 'BTRM-1000-10-P1710011',
      convertedBore: 250,
      ep1: p(0, 0, 0, 250),
      ep2: p(1000, 0, 0, 250),
      ca: {
        97: 'PIPE-100',
        98: '100',
      },
    },
    {
      rowNo: 360,
      type: 'OLET',
      pipelineRef: PIPELINE,
      lineNo: 'BTRM-1000-10-P1710011',
      convertedBore: 250,
      branchConvertedBore: 100,
      cp: p(500, 0, 0, 250),
      bp: p(500, 100, 0, 100),
      ca: {
        97: 'OLET-360',
        98: '360',
      },
    },
  ];
}

describe('PCF readiness diagnostic identity and skip policy', () => {
  it('enriches topology diagnostics with refNo, seqNo, lineNo, pipelineRef, port role and point', () => {
    const rows = rowsWithDisconnectedOletBranch();
    const graph = buildPcfTopoGraph(rows, {
      connectToleranceMm: 6,
      fixToleranceMm: 25,
    });

    const diagnostic = graph.diagnostics.find(
      d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED'
    );

    expect(diagnostic).toBeTruthy();
    expect(diagnostic.rowNo).toBe(360);
    expect(diagnostic.type).toBe('OLET');
    expect(diagnostic.refNo).toBe('OLET-360');
    expect(diagnostic.seqNo).toBe('360');
    expect(diagnostic.lineNo).toBe('BTRM-1000-10-P1710011');
    expect(diagnostic.pipelineRef).toBe(PIPELINE);
    expect(diagnostic.portRole).toBe('OLET_BRANCH');
    expect(diagnostic.pointKey).toBe('bp');
    expect(diagnostic.point).toEqual({ x: 500, y: 100, z: 0, bore: 100 });

    expect(diagnostic.message).toContain('OLET');
    expect(diagnostic.message).toContain('OLET_BRANCH');
    expect(diagnostic.message).toContain('Ref OLET-360');
    expect(diagnostic.message).toContain('Seq 360');
    expect(diagnostic.message).toContain('Line BTRM-1000-10-P1710011');
    expect(diagnostic.message).toContain('Pipeline');
    expect(diagnostic.message).toContain('Row 360');
  });

  it('blocks readiness when skip selected readiness errors is not enabled', () => {
    const result = runPcfReadinessGate(rowsWithDisconnectedOletBranch(), {
      connectToleranceMm: 6,
      fixToleranceMm: 25,
    });

    expect(result.pass).toBe(false);
    expect(result.summary.pcfReady).toBe(false);
    expect(result.summary.skippedReadinessErrorCount).toBe(0);

    const blocker = result.diagnostics.find(
      d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED'
    );

    expect(blocker).toBeTruthy();
    expect(blocker.severity).toBe('ERROR');
    expect(blocker.skipApplied).not.toBe(true);
  });

  it('demotes selected readiness errors to warnings when skip option is enabled', () => {
    const result = runPcfReadinessGate(rowsWithDisconnectedOletBranch(), {
      connectToleranceMm: 6,
      fixToleranceMm: 25,
      skipReadinessErrors: true,
      skipReadinessErrorCodes: 'TOPO-OLET-BRANCH-DISCONNECTED',
    });

    const skipped = result.diagnostics.find(
      d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED' && d.skipApplied === true
    );

    expect(skipped).toBeTruthy();
    expect(skipped.severity).toBe('WARNING');
    expect(skipped.originalSeverity).toBe('ERROR');
    expect(skipped.message).toContain('[SKIPPED ERROR]');

    expect(result.summary.skippedReadinessErrorCount).toBe(1);
    expect(result.summary.skippedReadinessErrorCodes).toContain('TOPO-OLET-BRANCH-DISCONNECTED');
    expect(result.summary.readinessSkipEnabled).toBe(true);

    const rowState = result.rowStates.find(r => r.rowNo === 360);
    expect(rowState.pcfBlockers).not.toContain('TOPO-OLET-BRANCH-DISCONNECTED');
    expect(rowState.pcfWarnings).toContain('SKIPPED-TOPO-OLET-BRANCH-DISCONNECTED');
  });

  it('skips all readiness errors when skip option is enabled without explicit codes', () => {
    const result = runPcfReadinessGate(rowsWithDisconnectedOletBranch(), {
      connectToleranceMm: 6,
      fixToleranceMm: 25,
      skipReadinessErrors: true,
    });

    const skipped = result.diagnostics.find(
      d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED'
    );

    expect(skipped).toBeTruthy();
    expect(skipped.severity).toBe('WARNING');
    expect(skipped.skipApplied).toBe(true);
    expect(result.summary.readinessSkipEnabled).toBe(true);
    expect(result.summary.skippedReadinessErrorCount).toBe(1);
  });

  it('does not skip non-selected readiness errors', () => {
    const result = runPcfReadinessGate(rowsWithDisconnectedOletBranch(), {
      connectToleranceMm: 6,
      fixToleranceMm: 25,
      skipReadinessErrors: true,
      skipReadinessErrorCodes: 'TOPO-TEE-BRANCH-DISCONNECTED',
    });

    const diagnostic = result.diagnostics.find(
      d => d.code === 'TOPO-OLET-BRANCH-DISCONNECTED'
    );

    expect(diagnostic).toBeTruthy();
    expect(diagnostic.severity).toBe('ERROR');
    expect(diagnostic.skipApplied).not.toBe(true);
  });
});
