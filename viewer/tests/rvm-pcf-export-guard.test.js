import { describe, expect, it } from 'vitest';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  RVM_PCF_EXPORT_BLOCK_CODES,
  assertRvmPcfExportAllowed,
  evaluateRvmPcfExportGuard,
  formatRvmPcfExportGuardMessage,
} from '../rvm-pcf-extract/RvmPcfExportGuard.js';

const rows = [
  { id: 'P-1', type: 'PIPE', ep1: '0,0,0', ep2: '1000,0,0' },
];

function legacyReadiness(pass = true) {
  return {
    pass,
    report: {
      allowPcfExport: pass,
      exportBlockReason: pass ? '' : 'Legacy blocked by test.',
    },
    summary: {
      blockedRows: pass ? 0 : 1,
    },
  };
}

function uxmlReadiness({
  outputBridgeReady = true,
  exportAllowed = true,
  allowPcfExport = true,
  acceptedConnectionCount = 2,
  manualReviewCount = 0,
  rejectedCount = 0,
  unresolvedCount = 0,
} = {}) {
  return {
    topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
    topologyDecision: {
      schema: 'uxml-topology-decision-gate/v1',
      outputBridgeReady,
      exportAllowed,
      summary: {
        acceptedConnectionCount,
        manualReviewCount,
        rejectedCount,
        unresolvedCount,
      },
    },
    report: {
      allowPcfExport,
      exportBlockReason: exportAllowed ? '' : 'Decision blocked by test.',
      summary: {
        acceptedConnectionCount,
        manualReviewCount,
        rejectedCount,
        unresolvedCount,
      },
    },
    summary: {
      outputBridgeReady,
      acceptedConnectionCount,
      manualReviewCount,
      rejectedCount,
      unresolvedCount,
      legacyRoutingContinues: true,
      mastersDeferredToLegacyRoute: true,
      pcfEmitterDeferredToLegacyRoute: true,
    },
  };
}

describe('RvmPcfExportGuard Agent 14', () => {
  it('blocks export when there are no rows', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      rows: [],
      readinessGate: legacyReadiness(true),
    });

    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.NO_ROWS);
  });

  it('blocks export when readiness was not run', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      rows,
      readinessGate: null,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.READINESS_NOT_RUN);
    expect(guard.reason).toContain('Run readiness check');
  });

  it('allows legacy export when legacy readiness allows PCF export', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      rows,
      readinessGate: legacyReadiness(true),
    });

    expect(guard.allowed).toBe(true);
    expect(guard.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.LEGACY);
    expect(formatRvmPcfExportGuardMessage(guard)).toContain('legacy readiness');
  });

  it('blocks legacy export when readiness blocks PCF export', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      rows,
      readinessGate: legacyReadiness(false),
    });

    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.LEGACY_READINESS_BLOCKED);
    expect(guard.reason).toBe('Legacy blocked by test.');
  });

  it('allows UXML export when decision, output bridge and readiness are green', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness(),
    });

    expect(guard.allowed).toBe(true);
    expect(guard.outputBridgeReady).toBe(true);
    expect(guard.exportAllowedByDecision).toBe(true);
    expect(guard.exportAllowedByReadiness).toBe(true);
    expect(guard.acceptedConnectionCount).toBe(2);
    expect(guard.legacyRoutingContinues).toBe(true);
    expect(guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(guard.pcfEmitterDeferredToLegacyRoute).toBe(true);
  });

  it('blocks UXML export when output bridge is not ready', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness({
        outputBridgeReady: false,
        exportAllowed: false,
        allowPcfExport: false,
      }),
    });

    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.UXML_OUTPUT_BRIDGE_NOT_READY);
  });

  it('blocks UXML export when decision gate blocks export', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness({
        outputBridgeReady: true,
        exportAllowed: false,
        allowPcfExport: false,
        manualReviewCount: 1,
      }),
    });

    expect(guard.allowed).toBe(false);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.UXML_DECISION_BLOCKED);
    expect(guard.manualReviewCount).toBe(1);
  });

  it('allows UXML export with partial export override when bridge is ready', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness({
        outputBridgeReady: true,
        exportAllowed: false,
        allowPcfExport: false,
        manualReviewCount: 1,
        unresolvedCount: 1,
      }),
      allowPartialExport: true,
    });

    expect(guard.allowed).toBe(true);
    expect(guard.allowPartialExport).toBe(true);
    expect(guard.manualReviewCount).toBe(1);
    expect(guard.unresolvedCount).toBe(1);
  });

  it('throws with guard payload from assertRvmPcfExportAllowed when blocked', () => {
    expect(() => assertRvmPcfExportAllowed({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness({
        outputBridgeReady: false,
        exportAllowed: false,
        allowPcfExport: false,
      }),
    })).toThrow('UXML topology output bridge is not ready');

    try {
      assertRvmPcfExportAllowed({
        topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
        rows,
        readinessGate: uxmlReadiness({
          outputBridgeReady: false,
          exportAllowed: false,
          allowPcfExport: false,
        }),
      });
    } catch (err) {
      expect(err.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.UXML_OUTPUT_BRIDGE_NOT_READY);
      expect(err.guard.allowed).toBe(false);
    }
  });

  it('formats clear user-facing messages', () => {
    const allowed = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: uxmlReadiness(),
    });

    expect(formatRvmPcfExportGuardMessage(allowed)).toContain('PCF export allowed by UXML topology gate');
    expect(formatRvmPcfExportGuardMessage(allowed)).toContain('legacy masters/PCF route continues');

    const blocked = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: null,
    });

    expect(formatRvmPcfExportGuardMessage(blocked)).toContain('UXML topology export blocked');
  });
});