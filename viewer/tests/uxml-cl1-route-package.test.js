import { describe, expect, it } from 'vitest';

import { UXML_ROUTE_TARGETS } from '../uxml/UxmlRouteHandoffPolicy.js';
import {
  UXML_CL1_ROUTE_PACKAGE_BLOCK_CODES,
  assertUxmlCl1RoutePackageAllowed,
  buildUxmlCl1RoutePackage,
  createUxmlCl1RoutePackage,
  summarizeUxmlCl1RoutePackage,
} from '../uxml/UxmlCl1RoutePackage.js';

function uxmlDoc() {
  return {
    schema: 'uxml/v1',
    sources: [{ id: 'SRC-1', name: 'sample.xml' }],
    pipelines: [{ id: 'PL-1', pipelineRef: '/P1' }],
    components: [
      { id: 'PIPE-1', type: 'PIPE', normalizedType: 'PIPE', pipelineRef: '/P1' },
      { id: 'VALVE-1', type: 'VALVE', normalizedType: 'VALVE', pipelineRef: '/P1' },
    ],
    anchors: [
      { id: 'A1', componentId: 'PIPE-1' },
      { id: 'A2', componentId: 'PIPE-1' },
      { id: 'A3', componentId: 'VALVE-1' },
      { id: 'A4', componentId: 'VALVE-1' },
    ],
    ports: [
      { id: 'P1', componentId: 'PIPE-1' },
      { id: 'P2', componentId: 'PIPE-1' },
      { id: 'P3', componentId: 'VALVE-1' },
      { id: 'P4', componentId: 'VALVE-1' },
    ],
    segments: [
      { id: 'S1', componentId: 'PIPE-1' },
      { id: 'S2', componentId: 'VALVE-1' },
    ],
    supports: [],
    mappings: [],
    diagnostics: [{ code: 'D-1' }],
    lossContract: [{ code: 'L-1' }],
  };
}

function topologyDecision(overrides = {}) {
  return {
    schema: 'uxml-topology-decision-gate/v1',
    outputBridgeReady: true,
    exportAllowed: true,
    summary: {
      acceptedConnectionCount: 1,
      agreementAcceptedCount: 1,
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
        id: 'TD-1',
        sourceComponentId: 'PIPE-1',
        targetComponentId: 'VALVE-1',
        decision: 'ACCEPT',
      },
    ],
    ...overrides,
  };
}

function acceptedTopologyHandoff(overrides = {}) {
  return {
    schema: 'rvm-pcf-accepted-topology-handoff/v1',
    handoffConnections: [
      {
        id: 'H-1',
        sourceComponentId: 'PIPE-1',
        targetComponentId: 'VALVE-1',
      },
    ],
    summary: {
      handoffConnectionCount: 1,
      annotatedRowCount: 2,
      totalRowCount: 2,
      pipelineCount: 1,
      coordinatesMutated: false,
      legacyRoutingContinues: true,
      mastersDeferredToLegacyRoute: true,
      pcfEmitterDeferredToLegacyRoute: true,
    },
    ...overrides,
  };
}

describe('UxmlCl1RoutePackage', () => {
  it('creates deterministic CL1 package for legacy PCF route', () => {
    const a = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
      diagnostics: [{ code: 'D-1' }],
      lossContract: [{ code: 'L-1' }],
      sourceInfo: { sourceFile: 'sample.xml' },
    });

    const b = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
      diagnostics: [{ code: 'D-1' }],
      lossContract: [{ code: 'L-1' }],
      sourceInfo: { sourceFile: 'sample.xml' },
    });

    expect(a.schema).toBe('uxml-cl1-route-package/v1');
    expect(a.ok).toBe(true);
    expect(a.allowed).toBe(true);
    expect(a.packageId).toBe(b.packageId);
    expect(a.targetRoute).toBe(UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY);
    expect(a.entityCounts.componentCount).toBe(2);
    expect(a.entityCounts.anchorCount).toBe(4);
    expect(a.entityCounts.portCount).toBe(4);
    expect(a.entityCounts.segmentCount).toBe(2);
    expect(a.topologyCounts.acceptedConnectionCount).toBe(1);
    expect(a.handoffSummary.handoffConnectionCount).toBe(1);
    expect(a.routeContract.uxmlEmitsPcfDirectly).toBe(false);
    expect(a.routeContract.uxmlMutatesCoordinates).toBe(false);
    expect(a.routeContract.uxmlAppliesFixes).toBe(false);
    expect(a.payload.requiredPayload).toContain('legacyMasterRoute');
    expect(a.payload.requiredPayload).toContain('legacyPcfEmitter');
  });

  it('blocks when UXML is missing', () => {
    const pkg = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: null,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    });

    expect(pkg.allowed).toBe(false);
    expect(pkg.blockCode).toBe(UXML_CL1_ROUTE_PACKAGE_BLOCK_CODES.NO_UXML);
    expect(pkg.payload).toBeNull();
  });

  it('blocks when route handoff policy blocks', () => {
    const pkg = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision({
        outputBridgeReady: false,
        exportAllowed: false,
      }),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    });

    expect(pkg.allowed).toBe(false);
    expect(pkg.blockCode).toBe(UXML_CL1_ROUTE_PACKAGE_BLOCK_CODES.ROUTE_HANDOFF_BLOCKED);
    expect(pkg.blockedReason).toContain('output bridge');
  });

  it('supports diagnostics-only route package', () => {
    const pkg = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.DIAGNOSTICS_ONLY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
      diagnostics: [{ code: 'D-1' }],
      lossContract: [{ code: 'L-1' }],
      allowPartialExport: true,
    });

    expect(pkg.allowed).toBe(true);
    expect(pkg.targetRoute).toBe(UXML_ROUTE_TARGETS.DIAGNOSTICS_ONLY);
    expect(pkg.payload.masterOwner).toBe('NONE');
    expect(pkg.diagnostics).toHaveLength(1);
    expect(pkg.lossContract).toHaveLength(1);
  });

  it('preserves source objects by cloning payload instead of mutating inputs', () => {
    const uxml = uxmlDoc();
    const decision = topologyDecision();
    const handoff = acceptedTopologyHandoff();

    const beforeUxml = JSON.stringify(uxml);
    const beforeDecision = JSON.stringify(decision);
    const beforeHandoff = JSON.stringify(handoff);

    const pkg = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml,
      topologyDecision: decision,
      acceptedTopologyHandoff: handoff,
    });

    expect(JSON.stringify(uxml)).toBe(beforeUxml);
    expect(JSON.stringify(decision)).toBe(beforeDecision);
    expect(JSON.stringify(handoff)).toBe(beforeHandoff);
    expect(pkg.payload.uxml).not.toBe(uxml);
    expect(pkg.payload.topologyDecision).not.toBe(decision);
    expect(pkg.payload.acceptedTopologyHandoff).not.toBe(handoff);
  });

  it('assert helper throws with CL1 package payload when blocked', () => {
    expect(() => assertUxmlCl1RoutePackageAllowed({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: null,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    })).toThrow('Cannot create CL1 route package');

    try {
      assertUxmlCl1RoutePackageAllowed({
        targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
        uxml: null,
        topologyDecision: topologyDecision(),
        acceptedTopologyHandoff: acceptedTopologyHandoff(),
      });
    } catch (err) {
      expect(err.code).toBe(UXML_CL1_ROUTE_PACKAGE_BLOCK_CODES.NO_UXML);
      expect(err.cl1RoutePackage.allowed).toBe(false);
    }
  });

  it('summarizes allowed and blocked packages', () => {
    const allowed = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    });

    expect(summarizeUxmlCl1RoutePackage(allowed)).toContain('CL1 package=');
    expect(summarizeUxmlCl1RoutePackage(allowed)).toContain('components=2');

    const blocked = createUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: null,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    });

    expect(summarizeUxmlCl1RoutePackage(blocked)).toContain('blocked');
  });

  it('provides alias export', () => {
    const pkg = buildUxmlCl1RoutePackage({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: uxmlDoc(),
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: acceptedTopologyHandoff(),
    });

    expect(pkg.schema).toBe('uxml-cl1-route-package/v1');
    expect(pkg.allowed).toBe(true);
  });
});
