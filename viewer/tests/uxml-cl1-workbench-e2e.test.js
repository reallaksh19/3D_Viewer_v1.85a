import { describe, expect, it } from 'vitest';

import {
  UXML_ROUTE_TARGETS,
  evaluateUxmlRouteHandoffPolicy,
} from '../uxml/UxmlRouteHandoffPolicy.js';
import { createUxmlCl1RoutePackage } from '../uxml/UxmlCl1RoutePackage.js';
import {
  buildUxmlCl1PackageSnapshot,
  serializeUxmlCl1PackageSnapshot,
} from '../uxml/UxmlCl1PackageSnapshot.js';
import { validateUxmlCl1SnapshotReplay } from '../uxml/UxmlCl1SnapshotReplayValidator.js';
import {
  UXML_CL1_WORKBENCH_STATUS,
  buildUxmlCl1WorkbenchSummary,
} from '../uxml/UxmlCl1WorkbenchSummary.js';

function uxmlFixture() {
  return {
    schema: 'uxml/v1',
    sources: [
      {
        id: 'SRC-1',
        format: 'UXML',
        name: 'cl1-e2e-fixture.xml',
      },
    ],
    pipelines: [
      {
        id: 'PL-1',
        pipelineRef: '/CL1-E2E',
        lineNo: 'L-CL1-E2E',
      },
    ],
    components: [
      {
        id: 'PIPE-1',
        type: 'PIPE',
        normalizedType: 'PIPE',
        pipelineRef: '/CL1-E2E',
        refNo: 'REF-P1',
        seqNo: '10',
      },
      {
        id: 'VALVE-1',
        type: 'VALVE',
        normalizedType: 'VALVE',
        pipelineRef: '/CL1-E2E',
        refNo: 'REF-V1',
        seqNo: '20',
      },
      {
        id: 'PIPE-2',
        type: 'PIPE',
        normalizedType: 'PIPE',
        pipelineRef: '/CL1-E2E',
        refNo: 'REF-P2',
        seqNo: '30',
      },
    ],
    anchors: [
      { id: 'A-PIPE-1-EP1', componentId: 'PIPE-1', role: 'EP1', point: { x: 0, y: 0, z: 0 } },
      { id: 'A-PIPE-1-EP2', componentId: 'PIPE-1', role: 'EP2', point: { x: 1000, y: 0, z: 0 } },
      { id: 'A-VALVE-1-EP1', componentId: 'VALVE-1', role: 'EP1', point: { x: 1000, y: 0, z: 0 } },
      { id: 'A-VALVE-1-EP2', componentId: 'VALVE-1', role: 'EP2', point: { x: 1200, y: 0, z: 0 } },
      { id: 'A-PIPE-2-EP1', componentId: 'PIPE-2', role: 'EP1', point: { x: 1200, y: 0, z: 0 } },
      { id: 'A-PIPE-2-EP2', componentId: 'PIPE-2', role: 'EP2', point: { x: 2200, y: 0, z: 0 } },
    ],
    ports: [
      { id: 'P-PIPE-1-1', componentId: 'PIPE-1', anchorId: 'A-PIPE-1-EP1', role: 'PIPE_END_1' },
      { id: 'P-PIPE-1-2', componentId: 'PIPE-1', anchorId: 'A-PIPE-1-EP2', role: 'PIPE_END_2' },
      { id: 'P-VALVE-1-1', componentId: 'VALVE-1', anchorId: 'A-VALVE-1-EP1', role: 'VALVE_END_1' },
      { id: 'P-VALVE-1-2', componentId: 'VALVE-1', anchorId: 'A-VALVE-1-EP2', role: 'VALVE_END_2' },
      { id: 'P-PIPE-2-1', componentId: 'PIPE-2', anchorId: 'A-PIPE-2-EP1', role: 'PIPE_END_1' },
      { id: 'P-PIPE-2-2', componentId: 'PIPE-2', anchorId: 'A-PIPE-2-EP2', role: 'PIPE_END_2' },
    ],
    segments: [
      { id: 'S-PIPE-1', componentId: 'PIPE-1', startAnchorId: 'A-PIPE-1-EP1', endAnchorId: 'A-PIPE-1-EP2' },
      { id: 'S-VALVE-1', componentId: 'VALVE-1', startAnchorId: 'A-VALVE-1-EP1', endAnchorId: 'A-VALVE-1-EP2' },
      { id: 'S-PIPE-2', componentId: 'PIPE-2', startAnchorId: 'A-PIPE-2-EP1', endAnchorId: 'A-PIPE-2-EP2' },
    ],
    supports: [],
    mappings: [],
    diagnostics: [],
    lossContract: [],
  };
}

function topologyDecisionFixture() {
  return {
    schema: 'uxml-topology-decision-gate/v1',
    outputBridgeReady: true,
    exportAllowed: true,
    summary: {
      acceptedConnectionCount: 2,
      agreementAcceptedCount: 2,
      universalOnlyAcceptedCount: 0,
      rayPromotionAcceptedCount: 0,
      faceProximityAcceptedCount: 0,
      manualReviewCount: 0,
      rejectedCount: 0,
      unresolvedCount: 0,
      diagnosticCount: 0,
    },
    acceptedConnections: [
      {
        id: 'TD-ACCEPT-001',
        source: 'UNIVERSAL_RAY_AGREEMENT',
        decision: 'ACCEPT',
        confidence: 'HIGH',
        sourceComponentId: 'PIPE-1',
        targetComponentId: 'VALVE-1',
        exportReady: true,
      },
      {
        id: 'TD-ACCEPT-002',
        source: 'UNIVERSAL_RAY_AGREEMENT',
        decision: 'ACCEPT',
        confidence: 'HIGH',
        sourceComponentId: 'VALVE-1',
        targetComponentId: 'PIPE-2',
        exportReady: true,
      },
    ],
  };
}

function acceptedTopologyHandoffFixture() {
  return {
    schema: 'rvm-pcf-accepted-topology-handoff/v1',
    handoffConnections: [
      { id: 'H-001', sourceComponentId: 'PIPE-1', targetComponentId: 'VALVE-1' },
      { id: 'H-002', sourceComponentId: 'VALVE-1', targetComponentId: 'PIPE-2' },
    ],
    byComponentId: {
      'PIPE-1': [{ id: 'H-001' }],
      'VALVE-1': [{ id: 'H-001' }, { id: 'H-002' }],
      'PIPE-2': [{ id: 'H-002' }],
    },
    summary: {
      handoffConnectionCount: 2,
      annotatedRowCount: 3,
      totalRowCount: 3,
      pipelineCount: 1,
      coordinatesMutated: false,
      legacyRoutingContinues: true,
      mastersDeferredToLegacyRoute: true,
      pcfEmitterDeferredToLegacyRoute: true,
    },
  };
}

describe('CL1 workbench E2E smoke', () => {
  it('runs RouteHandoff -> CL1 Package -> Snapshot -> Replay -> QA Summary', () => {
    const uxml = uxmlFixture();
    const topologyDecision = topologyDecisionFixture();
    const acceptedTopologyHandoff = acceptedTopologyHandoffFixture();

    const beforeUxml = JSON.stringify(uxml);
    const beforeDecision = JSON.stringify(topologyDecision);
    const beforeHandoff = JSON.stringify(acceptedTopologyHandoff);

    const routeHandoff = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml,
      topologyDecision,
      acceptedTopologyHandoff,
      diagnostics: uxml.diagnostics,
      lossContract: uxml.lossContract,
      allowPartialExport: false,
    });

    expect(routeHandoff.allowed).toBe(true);
    expect(routeHandoff.targetRoute).toBe(UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY);
    expect(routeHandoff.masterOwner).toBe('LEGACY_PCF_ROUTE');
    expect(routeHandoff.routeContract.uxmlEmitsPcfDirectly).toBe(false);
    expect(routeHandoff.routeContract.uxmlMutatesCoordinates).toBe(false);
    expect(routeHandoff.routeContract.uxmlAppliesFixes).toBe(false);

    const cl1Package = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml,
      topologyDecision,
      acceptedTopologyHandoff,
      diagnostics: uxml.diagnostics,
      lossContract: uxml.lossContract,
      allowPartialExport: false,
      sourceInfo: {
        sourceFile: 'cl1-e2e-fixture.xml',
        selectedSourceType: 'UXML',
        detectedSourceType: 'UXML',
        profile: 'UXML',
      },
    });

    expect(JSON.stringify(uxml)).toBe(beforeUxml);
    expect(JSON.stringify(topologyDecision)).toBe(beforeDecision);
    expect(JSON.stringify(acceptedTopologyHandoff)).toBe(beforeHandoff);
    expect(cl1Package.allowed).toBe(true);
    expect(cl1Package.payload.masterOwner).toBe('LEGACY_PCF_ROUTE');

    const snapshot = buildUxmlCl1PackageSnapshot(cl1Package, { includePayload: true });
    expect(snapshot.schema).toBe('uxml-cl1-package-snapshot/v1');

    const snapshotText = serializeUxmlCl1PackageSnapshot(snapshot);
    const replay = validateUxmlCl1SnapshotReplay(snapshotText);
    expect(replay.schema).toBe('uxml-cl1-snapshot-replay-validator/v1');
    expect(replay.replayReady).toBe(true);

    const qaSummary = buildUxmlCl1WorkbenchSummary({
      topologyDecision,
      routeHandoff,
      cl1RoutePackage: cl1Package,
      cl1Snapshot: snapshot,
      cl1ReplayValidation: replay,
    });

    expect(qaSummary.schema).toBe('uxml-cl1-workbench-summary/v1');
    expect(qaSummary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.PASS);
    expect(qaSummary.readyForRouteConsumption).toBe(true);
  });

  it('keeps snapshot/replay path debug-only and non-PCF', () => {
    const uxml = uxmlFixture();
    const topologyDecision = topologyDecisionFixture();
    const acceptedTopologyHandoff = acceptedTopologyHandoffFixture();

    const cl1Package = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml,
      topologyDecision,
      acceptedTopologyHandoff,
    });

    const snapshot = buildUxmlCl1PackageSnapshot(cl1Package);
    const replay = validateUxmlCl1SnapshotReplay(snapshot);
    const qaSummary = buildUxmlCl1WorkbenchSummary({
      topologyDecision,
      routeHandoff: evaluateUxmlRouteHandoffPolicy({
        targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
        uxml,
        topologyDecision,
        acceptedTopologyHandoff,
      }),
      cl1RoutePackage: cl1Package,
      cl1Snapshot: snapshot,
      cl1ReplayValidation: replay,
    });

    expect(snapshot.debugOnly).toBe(true);
    expect(snapshot.pcfGenerated).toBe(false);
    expect(replay.replayReady).toBe(true);
    expect(qaSummary.stages.cl1Replay.status).toBe(UXML_CL1_WORKBENCH_STATUS.PASS);
  });
});
