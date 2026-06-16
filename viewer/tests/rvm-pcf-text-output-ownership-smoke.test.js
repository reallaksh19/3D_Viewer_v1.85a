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

import {
  RvmPcfEmitter,
} from '../rvm-pcf-extract/RvmPcfEmitter.js';

function rowsFixture() {
  return [
    {
      rowNo: 10,
      id: 'PIPE-1',
      type: 'PIPE',
      pipelineRef: '/RJP-3001',
      lineNo: 'L-RJP-3001',
      refNo: 'REF-P1',
      seqNo: '10',
      convertedBore: 250,
      ep1: { x: 100, y: 0, z: 0 },
      ep2: { x: 1100, y: 0, z: 0 },
      include: true,
    },
    {
      rowNo: 20,
      id: 'VALVE-1',
      type: 'VALVE',
      pipelineRef: '/RJP-3001',
      lineNo: 'L-RJP-3001',
      refNo: 'REF-V1',
      seqNo: '20',
      convertedBore: 250,
      ep1: { x: 1000, y: 0, z: 0 },
      ep2: { x: 1200, y: 0, z: 0 },
      include: true,
    },
    {
      rowNo: 30,
      id: 'PIPE-2',
      type: 'PIPE',
      pipelineRef: '/RJP-3001',
      lineNo: 'L-RJP-3001',
      refNo: 'REF-P2',
      seqNo: '30',
      convertedBore: 250,
      ep1: { x: 1200, y: 0, z: 0 },
      ep2: { x: 2200, y: 0, z: 0 },
      include: true,
    },
    {
      rowNo: 40,
      id: 'TEE-1',
      type: 'TEE',
      pipelineRef: '/RJP-3001',
      lineNo: 'L-RJP-3001',
      refNo: 'REF-T1',
      seqNo: '40',
      convertedBore: 250,
      branchConvertedBore: 100,
      ep1: { x: 2200, y: 0, z: 0 },
      ep2: { x: 2400, y: 0, z: 0 },
      cp: { x: 2300, y: 0, z: 0 },
      bp: { x: 2300, y: 250, z: 0 },
      include: true,
    },
  ];
}

function emitLegacyPcfText(rows) {
  const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
  const result = emitter.emit(rows);

  expect(Object.keys(result.pcfTextByPipelineRef)).toEqual(['/RJP-3001']);
  return result;
}

describe('PCF text output ownership smoke', () => {
  it('keeps UXML topology bridge topology-only and lets legacy route own PCF text', () => {
    const rows = rowsFixture();
    const beforeRows = JSON.stringify(rows);

    const uxmlResult = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'pcf-text-ownership',
    });

    expect(JSON.stringify(rows)).toBe(beforeRows);
    expect(uxmlResult.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(uxmlResult.generatedPcf).toBeUndefined();
    expect(uxmlResult.pcfTextByPipelineRef).toBeUndefined();
    expect(uxmlResult.masterResolution).toBeUndefined();
    expect(uxmlResult.masterResolutionRequests).toBeUndefined();

    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: uxmlResult.legacyRows,
      readinessGate: uxmlResult.readinessGate,
      allowPartialExport: true,
    });

    expect(guard.allowed).toBe(true);
    expect(guard.outputBridgeReady).toBe(true);
    expect(guard.legacyRoutingContinues).toBe(true);
    expect(guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(guard.pcfEmitterDeferredToLegacyRoute).toBe(true);

    const legacyWriterResult = emitLegacyPcfText(uxmlResult.legacyRows);

    expect(legacyWriterResult.errors.length).toBe(0);
    expect(legacyWriterResult.pcfTextByPipelineRef['/RJP-3001']).toContain('ISOGEN-FILES');
    expect(legacyWriterResult.pcfTextByPipelineRef['/RJP-3001']).toContain('PIPELINE-REFERENCE /RJP-3001');
    expect(legacyWriterResult.pcfTextByPipelineRef['/RJP-3001']).toContain('PIPE');
  });

  it('blocks legacy PCF text ownership before readiness export guard passes', () => {
    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: rowsFixture(),
      readinessGate: null,
      allowPartialExport: false,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.blocked).toBe(true);
  });
});
