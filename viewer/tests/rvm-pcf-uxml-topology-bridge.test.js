import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RVM_PCF_TOPOLOGY_MODE,
  RVM_PCF_TOPOLOGY_MODES,
  isUxmlTopologyMode,
  normalizeRvmPcfTopologyMode,
  topologyModeLabel,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  adaptRvmRowsToUxml,
} from '../rvm-pcf-extract/RvmRowsToUxmlAdapter.js';

import {
  pushUxmlTopologyBackToLegacyRows,
  runUxmlTopologyForRvmRows,
} from '../rvm-pcf-extract/RvmUxmlTopologyBridge.js';

function pipeRow(rowNo, id, ep1, ep2) {
  return {
    rowNo,
    id,
    type: 'PIPE',
    pipelineRef: '/P1',
    convertedBore: 100,
    ep1,
    ep2,
    refNo: `REF-${id}`,
    seqNo: String(rowNo),
  };
}

function valveRow(rowNo, id, ep1, ep2) {
  return {
    rowNo,
    id,
    type: 'VALVE',
    pipelineRef: '/P1',
    convertedBore: 100,
    ep1,
    ep2,
    refNo: `REF-${id}`,
    seqNo: String(rowNo),
  };
}

function oletRow(rowNo, id, cp, bp) {
  return {
    rowNo,
    id,
    type: 'OLET',
    pipelineRef: '/P1',
    convertedBore: 250,
    branchConvertedBore: 100,
    cp,
    bp,
    refNo: `REF-${id}`,
    seqNo: String(rowNo),
  };
}

describe('RVM PCF UXML topology bridge Agent 10', () => {
  it('normalizes topology mode values', () => {
    expect(DEFAULT_RVM_PCF_TOPOLOGY_MODE).toBe(RVM_PCF_TOPOLOGY_MODES.LEGACY);
    expect(normalizeRvmPcfTopologyMode('UXML_TOPOLOGY')).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(normalizeRvmPcfTopologyMode('legacy')).toBe(RVM_PCF_TOPOLOGY_MODES.LEGACY);
    expect(normalizeRvmPcfTopologyMode('bad')).toBe(RVM_PCF_TOPOLOGY_MODES.LEGACY);
    expect(isUxmlTopologyMode('UXML_TOPOLOGY')).toBe(true);
    expect(topologyModeLabel('UXML_TOPOLOGY')).toBe('UXML topology');
  });

  it('adapts existing extract rows to UXML without mutating rows', () => {
    const rows = [
      pipeRow(10, 'PIPE-1', '0,0,0', '1000,0,0'),
      valveRow(20, 'VALVE-1', '1000,0,0', '1200,0,0'),
      pipeRow(30, 'PIPE-2', '1200,0,0', '2000,0,0'),
    ];

    const before = JSON.stringify(rows);
    const result = adaptRvmRowsToUxml(rows);

    expect(JSON.stringify(rows)).toBe(before);
    expect(result.ok).toBe(true);
    expect(result.stats.rowCount).toBe(3);
    expect(result.stats.componentCount).toBe(3);
    expect(result.stats.anchorCount).toBe(6);
    expect(result.stats.portCount).toBe(6);
    expect(result.stats.segmentCount).toBe(3);
    expect(result.uxml.components.map(c => c.id)).toEqual(['PIPE-1', 'VALVE-1', 'PIPE-2']);
  });

  it('runs UXML topology for rows and creates legacy-compatible readiness payload', () => {
    const rows = [
      pipeRow(10, 'PIPE-1', '0,0,0', '1000,0,0'),
      valveRow(20, 'VALVE-1', '1000,0,0', '1200,0,0'),
      pipeRow(30, 'PIPE-2', '1200,0,0', '2000,0,0'),
    ];

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      allowPartialExport: false,
    });

    expect(result.schema).toBe('rvm-pcf-uxml-topology-bridge/v1');
    expect(result.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);

    expect(result.uxml.components.length).toBe(3);
    expect(result.faceModel.schema).toBe('uxml-face-model/v1');
    expect(result.universalGraph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(result.rayGraph.schema).toBe('uxml-ray-topo-graph/v2');
    expect(result.comparison.schema).toBe('uxml-topo-graph-comparator/v1');

    expect(result.readinessGate.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);
  });

  it('pushes UXML topology evidence back to legacy rows using annotations only', () => {
    const rows = [
      pipeRow(10, 'PIPE-1', '0,0,0', '1000,0,0'),
      valveRow(20, 'VALVE-1', '1000,0,0', '1200,0,0'),
    ];

    const bridge = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
    });

    const pushed = pushUxmlTopologyBackToLegacyRows(rows, bridge);

    expect(pushed).toHaveLength(2);
    expect(pushed[0]).not.toBe(rows[0]);
    expect(pushed[0].ep1).toBe(rows[0].ep1);
    expect(pushed[0].ep2).toBe(rows[0].ep2);
    expect(pushed[0]._topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);
    expect(pushed[0]._uxmlComponentId).toBe('PIPE-1');
    expect(typeof pushed[0]._uxmlTopologyReady).toBe('boolean');
  });

  it('uses UXML ray/comparator evidence for orphan OLET branch topology without PCF emission', () => {
    const rows = [
      pipeRow(10, 'HEADER-1', '0,0,0', '1000,0,0'),
      oletRow(20, 'OLET-1', '500,0,0', '500,100,0'),
      pipeRow(30, 'BRANCH-1', '500,250,0', '500,900,0'),
    ];

    const result = runUxmlTopologyForRvmRows(rows, {
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
    });

    expect(result.rayGraph.summary.rayCandidateCount).toBeGreaterThanOrEqual(1);
    expect(result.comparison.summary.rayCandidateCount).toBeGreaterThanOrEqual(1);

    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);
  });

  it('enriches diagnostics with row identity context', () => {
    const rows = [
      {
        rowNo: 20,
        id: 'OLET-BAD',
        type: 'OLET',
        pipelineRef: '/P1',
        convertedBore: 250,
        branchConvertedBore: 100,
        bp: '500,100,0',
        refNo: 'REF-OLET-BAD',
        seqNo: '20',
      },
    ];

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
    });

    const diagnostic = result.diagnostics.find(d => d.componentId === 'OLET-BAD');

    expect(diagnostic).toBeTruthy();
    expect(String(diagnostic.rowNo)).toBe('20');
    expect(diagnostic.refNo).toBe('REF-OLET-BAD');
    expect(diagnostic.seqNo).toBe('20');
    expect(diagnostic.pipelineRef).toBe('/P1');
    expect(diagnostic._source).toBe('uxml-topology');
  });

  it('runs topology decision gate before allowing legacy PCF route to continue', () => {
    const rows = [
      pipeRow(10, 'PIPE-1', '0,0,0', '1000,0,0'),
      valveRow(20, 'VALVE-1', '1000,0,0', '1200,0,0'),
      pipeRow(30, 'PIPE-2', '1200,0,0', '2000,0,0'),
    ];

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: false,
    });

    expect(result.topologyDecision).toBeTruthy();
    expect(result.topologyDecision.schema).toBe('uxml-topology-decision-gate/v1');

    expect(result.readinessGate.topologyDecision).toBeTruthy();
    expect(result.readinessGate.summary.outputBridgeReady).toBe(true);
    expect(result.readinessGate.summary.acceptedConnectionCount).toBeGreaterThan(0);

    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);
  });

  it('creates accepted topology handoff and annotates legacy rows', () => {
    const rows = [
      pipeRow(10, 'PIPE-1', '0,0,0', '1000,0,0'),
      valveRow(20, 'VALVE-1', '1000,0,0', '1200,0,0'),
      pipeRow(30, 'PIPE-2', '1200,0,0', '2000,0,0'),
    ];

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
    });

    expect(result.acceptedTopologyHandoff).toBeTruthy();
    expect(result.acceptedTopologyHandoff.schema).toBe('rvm-pcf-accepted-topology-handoff/v1');
    expect(result.acceptedTopologyHandoff.summary.handoffConnectionCount).toBeGreaterThan(0);

    expect(result.readinessGate.acceptedTopologyHandoff).toBeTruthy();
    expect(result.readinessGate.summary.acceptedTopologyHandoffCount).toBeGreaterThan(0);

    const annotated = result.legacyRows.find(row => row._uxmlAcceptedTopologyCount > 0);

    expect(annotated).toBeTruthy();
    expect(Array.isArray(annotated._uxmlAcceptedTopologyTargets)).toBe(true);
    expect(Array.isArray(annotated._uxmlAcceptedTopologySources)).toBe(true);
    expect(Array.isArray(annotated._uxmlAcceptedTopologyConnectionIds)).toBe(true);

    expect(annotated.ep1 || annotated.supportCoord).toBeTruthy();
  });
});