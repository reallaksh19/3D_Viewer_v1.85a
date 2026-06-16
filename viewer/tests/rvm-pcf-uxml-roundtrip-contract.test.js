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
      pipelineRef: '/RJP-1001',
      lineNo: 'L-RJP-1001',
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
      pipelineRef: '/RJP-1001',
      lineNo: 'L-RJP-1001',
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
      pipelineRef: '/RJP-1001',
      lineNo: 'L-RJP-1001',
      refNo: 'REF-P2',
      seqNo: '30',
      convertedBore: 250,
      ep1: '1200,0,0',
      ep2: '2200,0,0',
      include: true,
    },
    {
      rowNo: 40,
      id: 'TEE-1',
      type: 'TEE',
      pipelineRef: '/RJP-1001',
      lineNo: 'L-RJP-1001',
      refNo: 'REF-T1',
      seqNo: '40',
      convertedBore: 250,
      branchConvertedBore: 100,
      ep1: '2200,0,0',
      ep2: '2400,0,0',
      cp: '2300,0,0',
      bp: '2300,250,0',
      include: true,
    },
  ];
}

function geometryFingerprint(rows) {
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    ep1: row.ep1 ?? null,
    ep2: row.ep2 ?? null,
    cp: row.cp ?? null,
    bp: row.bp ?? null,
    supportCoord: row.supportCoord ?? null,
    pipelineRef: row.pipelineRef ?? null,
    lineNo: row.lineNo ?? null,
    refNo: row.refNo ?? null,
    seqNo: row.seqNo ?? null,
  }));
}

describe('RVM JSON to PCF UXML topology roundtrip contract', () => {
  it('uses UXML only for topology and returns evidence to the legacy PCF route', () => {
    const rows = rowsFixture();
    const beforeRows = JSON.stringify(rows);
    const beforeGeometry = geometryFingerprint(rows);

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'roundtrip-contract',
    });

    expect(JSON.stringify(rows)).toBe(beforeRows);
    expect(geometryFingerprint(rows)).toEqual(beforeGeometry);

    expect(result.schema).toBe('rvm-pcf-uxml-topology-bridge/v1');
    expect(result.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(result.uxml).toBeTruthy();
    expect(result.faceModel).toBeTruthy();
    expect(result.universalGraph).toBeTruthy();
    expect(result.rayGraph).toBeTruthy();
    expect(result.comparison).toBeTruthy();
    expect(result.topologyDecision).toBeTruthy();
    expect(result.acceptedTopologyHandoff).toBeTruthy();

    expect(result.legacyRows).toHaveLength(rows.length);
    expect(result.readinessGate).toBeTruthy();
    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);

    expect(result.acceptedTopologyHandoff.summary.coordinatesMutated).toBe(false);
    expect(result.acceptedTopologyHandoff.summary.annotatedRowCount).toBeGreaterThan(0);

    const annotatedRows = result.legacyRows.filter((row) =>
      row._topologyMode === RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY ||
      row._uxmlAcceptedTopologyCount > 0
    );

    expect(annotatedRows.length).toBeGreaterThan(0);

    for (let i = 0; i < rows.length; i += 1) {
      expect(result.legacyRows[i].id).toBe(rows[i].id);
      expect(result.legacyRows[i].type).toBe(rows[i].type);
      expect(result.legacyRows[i].pipelineRef).toBe(rows[i].pipelineRef);
      expect(result.legacyRows[i].lineNo).toBe(rows[i].lineNo);
      expect(result.legacyRows[i].refNo).toBe(rows[i].refNo);
      expect(result.legacyRows[i].seqNo).toBe(rows[i].seqNo);
      expect(result.legacyRows[i].ep1).toBe(rows[i].ep1);
      expect(result.legacyRows[i].ep2).toBe(rows[i].ep2);
      expect(result.legacyRows[i].cp).toBe(rows[i].cp);
      expect(result.legacyRows[i].bp).toBe(rows[i].bp);
      expect(result.legacyRows[i].supportCoord).toBe(rows[i].supportCoord);
    }

    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: result.legacyRows,
      readinessGate: result.readinessGate,
      allowPartialExport: true,
    });

    expect(guard.allowed).toBe(true);
    expect(guard.outputBridgeReady).toBe(true);
    expect(guard.legacyRoutingContinues).toBe(true);
    expect(guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(guard.pcfEmitterDeferredToLegacyRoute).toBe(true);

    expect(result.generatedPcf).toBeUndefined();
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
    expect(result.masterResolutionRequests).toBeUndefined();
  });

  it('blocks export when readiness was not run', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: rowsFixture(),
      readinessGate: null,
      allowPartialExport: false,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.blocked).toBe(true);
    expect(String(guard.reason)).toContain('Run readiness check');
  });
});
