import { describe, expect, it } from 'vitest';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  annotateRowsWithAcceptedTopologyHandoff,
  buildRvmPcfAcceptedTopologyHandoff,
  createRvmPcfAcceptedTopologyHandoff,
} from '../rvm-pcf-extract/RvmPcfAcceptedTopologyHandoff.js';

function rows() {
  return [
    {
      rowNo: 10,
      id: 'PIPE-1',
      type: 'PIPE',
      pipelineRef: '/P1',
      lineNo: 'L-100',
      refNo: 'REF-PIPE-1',
      seqNo: '10',
      ep1: '0,0,0',
      ep2: '1000,0,0',
    },
    {
      rowNo: 20,
      id: 'VALVE-1',
      type: 'VALVE',
      pipelineRef: '/P1',
      lineNo: 'L-100',
      refNo: 'REF-VALVE-1',
      seqNo: '20',
      ep1: '1000,0,0',
      ep2: '1200,0,0',
    },
    {
      rowNo: 30,
      id: 'PIPE-2',
      type: 'PIPE',
      pipelineRef: '/P1',
      lineNo: 'L-100',
      refNo: 'REF-PIPE-2',
      seqNo: '30',
      ep1: '1200,0,0',
      ep2: '2000,0,0',
    },
  ];
}

function topologyDecision() {
  return {
    schema: 'uxml-topology-decision-gate/v1',
    exportAllowed: true,
    outputBridgeReady: true,
    acceptedConnections: [
      {
        id: 'TD-ACCEPT-AGREE-00001',
        source: 'UNIVERSAL_RAY_AGREEMENT',
        decision: 'ACCEPT',
        confidence: 'HIGH',
        sourceComponentId: 'PIPE-1',
        targetComponentId: 'VALVE-1',
        action: 'USE_UNIVERSAL_EDGE',
        exportReady: true,
        universalEdge: {
          id: 'UE-1',
          sourceComponentId: 'PIPE-1',
          targetComponentId: 'VALVE-1',
          pipelineRef: '/P1',
        },
        rayCandidate: {
          id: 'RC-1',
          pass: 'P1-GENERAL-ENDPOINT',
          sourceComponentId: 'PIPE-1',
          targetComponentId: 'VALVE-1',
          distanceAlongRayMm: 0,
          perpendicularMissMm: 0,
        },
        reason: 'Agreement',
      },
      {
        id: 'TD-ACCEPT-UNIVERSAL-00002',
        source: 'UNIVERSAL_ONLY',
        decision: 'ACCEPT_WITH_REVIEW_NOTE',
        confidence: 'MEDIUM',
        sourceComponentId: 'VALVE-1',
        targetComponentId: 'PIPE-2',
        action: 'USE_UNIVERSAL_EDGE',
        exportReady: true,
        universalEdge: {
          id: 'UE-2',
          sourceComponentId: 'VALVE-1',
          targetComponentId: 'PIPE-2',
          pipelineRef: '/P1',
        },
        reason: 'Universal only',
      },
    ],
    summary: {
      acceptedConnectionCount: 2,
    },
  };
}

describe('RvmPcfAcceptedTopologyHandoff Agent 15', () => {
  it('builds handoff map from accepted topology decisions', () => {
    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: topologyDecision(),
    });

    expect(handoff.schema).toBe('rvm-pcf-accepted-topology-handoff/v1');
    expect(handoff.ok).toBe(true);
    expect(handoff.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);

    expect(handoff.handoffConnections).toHaveLength(2);
    expect(handoff.summary.handoffConnectionCount).toBe(2);
    expect(handoff.summary.annotatedRowCount).toBe(3);
    expect(handoff.summary.legacyRoutingContinues).toBe(true);
    expect(handoff.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(handoff.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);
    expect(handoff.summary.coordinatesMutated).toBe(false);
  });

  it('preserves row identity on each handoff connection', () => {
    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: topologyDecision(),
    });

    const first = handoff.handoffConnections[0];

    expect(first.sourceComponentId).toBe('PIPE-1');
    expect(first.targetComponentId).toBe('VALVE-1');
    expect(first.sourceIdentity.rowNo).toBe('10');
    expect(first.sourceIdentity.refNo).toBe('REF-PIPE-1');
    expect(first.sourceIdentity.seqNo).toBe('10');
    expect(first.sourceIdentity.lineNo).toBe('L-100');
    expect(first.sourceIdentity.pipelineRef).toBe('/P1');

    expect(first.targetIdentity.rowNo).toBe('20');
    expect(first.targetIdentity.refNo).toBe('REF-VALVE-1');
    expect(first.targetIdentity.seqNo).toBe('20');
  });

  it('builds component and row lookup indexes', () => {
    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: topologyDecision(),
    });

    expect(handoff.byComponentId['PIPE-1']).toHaveLength(1);
    expect(handoff.byComponentId['VALVE-1']).toHaveLength(2);
    expect(handoff.byComponentId['PIPE-2']).toHaveLength(1);

    expect(handoff.byRowNo['10']).toHaveLength(1);
    expect(handoff.byRowNo['20']).toHaveLength(2);
    expect(handoff.byRowNo['30']).toHaveLength(1);

    expect(handoff.acceptedComponentPairs).toContain('PIPE-1|VALVE-1');
    expect(handoff.acceptedComponentPairs).toContain('PIPE-2|VALVE-1');
  });

  it('creates row annotations without changing coordinate fields', () => {
    const inputRows = rows();
    const before = JSON.stringify(inputRows);

    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: inputRows,
      topologyDecision: topologyDecision(),
    });

    const annotated = annotateRowsWithAcceptedTopologyHandoff(inputRows, handoff);

    expect(JSON.stringify(inputRows)).toBe(before);
    expect(annotated).toHaveLength(3);

    expect(annotated[0]).not.toBe(inputRows[0]);
    expect(annotated[0].ep1).toBe(inputRows[0].ep1);
    expect(annotated[0].ep2).toBe(inputRows[0].ep2);

    expect(annotated[0]._uxmlAcceptedTopologyCount).toBe(1);
    expect(annotated[0]._uxmlAcceptedTopologyTargets).toEqual(['VALVE-1']);
    expect(annotated[0]._uxmlAcceptedTopologySources).toEqual([]);

    expect(annotated[1]._uxmlAcceptedTopologyCount).toBe(2);
    expect(annotated[1]._uxmlAcceptedTopologySources).toEqual(['PIPE-1']);
    expect(annotated[1]._uxmlAcceptedTopologyTargets).toEqual(['PIPE-2']);

    expect(annotated[2]._uxmlAcceptedTopologyCount).toBe(1);
    expect(annotated[2]._uxmlAcceptedTopologySources).toEqual(['VALVE-1']);
  });

  it('uses rowIdentityByComponentId override when provided', () => {
    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: topologyDecision(),
      rowIdentityByComponentId: {
        'PIPE-1': {
          rowNo: '100',
          refNo: 'OVERRIDE-PIPE',
          seqNo: '100',
          lineNo: 'L-OVERRIDE',
          pipelineRef: '/OVERRIDE',
          type: 'PIPE',
          name: 'override name',
        },
      },
    });

    const first = handoff.handoffConnections[0];

    expect(first.sourceIdentity.rowNo).toBe('100');
    expect(first.sourceIdentity.refNo).toBe('OVERRIDE-PIPE');
    expect(first.sourceIdentity.lineNo).toBe('L-OVERRIDE');
    expect(first.pipelineRef).toBe('/P1');
  });

  it('ignores non-export-ready accepted connections', () => {
    const decision = topologyDecision();

    decision.acceptedConnections.push({
      id: 'TD-NOT-EXPORT-READY',
      source: 'TEST',
      decision: 'ACCEPT',
      confidence: 'LOW',
      sourceComponentId: 'PIPE-1',
      targetComponentId: 'PIPE-2',
      exportReady: false,
    });

    const handoff = buildRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: decision,
    });

    expect(handoff.handoffConnections).toHaveLength(2);
    expect(handoff.handoffConnections.some(c => c.acceptedConnectionId === 'TD-NOT-EXPORT-READY')).toBe(false);
  });

  it('provides alias export', () => {
    const handoff = createRvmPcfAcceptedTopologyHandoff({
      rows: rows(),
      topologyDecision: topologyDecision(),
    });

    expect(handoff.schema).toBe('rvm-pcf-accepted-topology-handoff/v1');
  });
});