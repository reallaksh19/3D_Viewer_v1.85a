import { describe, expect, it } from 'vitest';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  runUxmlTopologyForRvmRows,
} from '../rvm-pcf-extract/RvmUxmlTopologyBridge.js';

import {
  evaluateRvmPcfExportGuard,
} from '../rvm-pcf-extract/RvmPcfExportGuard.js';

function rowsFixture() {
  return [
    {
      rowNo: 10,
      id: 'PIPE-1',
      type: 'PIPE',
      pipelineRef: '/RJP-2001',
      lineNo: 'L-RJP-2001',
      refNo: 'REF-P1',
      seqNo: '10',
      convertedBore: 250,
      ep1: '0,0,0',
      ep2: '1000,0,0',
      include: true,
    },
    {
      rowNo: 20,
      id: 'VALVE-1',
      type: 'VALVE',
      pipelineRef: '/RJP-2001',
      lineNo: 'L-RJP-2001',
      refNo: 'REF-V1',
      seqNo: '20',
      convertedBore: 250,
      ep1: '1000,0,0',
      ep2: '1200,0,0',
      include: true,
    },
    {
      rowNo: 30,
      id: 'PIPE-2',
      type: 'PIPE',
      pipelineRef: '/RJP-2002',
      lineNo: 'L-RJP-2002',
      refNo: 'REF-P2',
      seqNo: '30',
      convertedBore: 250,
      ep1: '1200,0,0',
      ep2: '2200,0,0',
      include: true,
    },
  ];
}

function generateButtonContract({ rows, readinessGate }) {
  const guard = evaluateRvmPcfExportGuard({
    topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
    rows,
    readinessGate,
    allowPartialExport: true,
  });

  if (!guard.allowed) {
    return {
      clicked: true,
      allowed: false,
      blocked: true,
      guard,
      message: guard.reason,
      legacyPcfRouteInvoked: false,
      uxmlGeneratedPcf: false,
      mastersResolvedByUxml: false,
    };
  }

  return {
    clicked: true,
    allowed: true,
    blocked: false,
    guard,
    message: 'Generate PCF would continue through the legacy route.',
    legacyPcfRouteInvoked: true,
    uxmlGeneratedPcf: false,
    mastersResolvedByUxml: false,
  };
}

describe('Generate PCF button UXML topology contract', () => {
  it('blocks Generate PCF when readiness has not been run', () => {
    const result = generateButtonContract({
      rows: rowsFixture(),
      readinessGate: null,
    });

    expect(result.clicked).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.legacyPcfRouteInvoked).toBe(false);
    expect(result.guard.allowed).toBe(false);
    expect(String(result.message)).toContain('Run readiness check');
    expect(result.uxmlGeneratedPcf).toBe(false);
    expect(result.mastersResolvedByUxml).toBe(false);
  });

  it('allows Generate PCF only after UXML readiness/export guard passes', () => {
    const uxmlResult = runUxmlTopologyForRvmRows(rowsFixture(), {
      allowPartialExport: true,
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      name: 'generate-button-contract',
    });

    const result = generateButtonContract({
      rows: uxmlResult.legacyRows,
      readinessGate: uxmlResult.readinessGate,
    });

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.legacyPcfRouteInvoked).toBe(true);
    expect(result.guard.allowed).toBe(true);
    expect(result.guard.outputBridgeReady).toBe(true);
    expect(result.guard.acceptedConnectionCount).toBeGreaterThan(0);
    expect(result.guard.legacyRoutingContinues).toBe(true);
    expect(result.guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.guard.pcfEmitterDeferredToLegacyRoute).toBe(true);
    expect(result.uxmlGeneratedPcf).toBe(false);
    expect(result.mastersResolvedByUxml).toBe(false);
    expect(uxmlResult.generatedPcf).toBeUndefined();
    expect(uxmlResult.pcfTextByPipelineRef).toBeUndefined();
    expect(uxmlResult.masterResolution).toBeUndefined();
    expect(uxmlResult.masterResolutionRequests).toBeUndefined();
  });

  it('keeps legacy PCF route ownership after topology evidence is returned', () => {
    const uxmlResult = runUxmlTopologyForRvmRows(rowsFixture(), {
      allowPartialExport: true,
    });

    const result = generateButtonContract({
      rows: uxmlResult.legacyRows,
      readinessGate: uxmlResult.readinessGate,
    });

    expect(result.guard.legacyRoutingContinues).toBe(true);
    expect(result.guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.guard.pcfEmitterDeferredToLegacyRoute).toBe(true);
    expect(result.uxmlGeneratedPcf).toBe(false);
    expect(result.mastersResolvedByUxml).toBe(false);
  });
});
