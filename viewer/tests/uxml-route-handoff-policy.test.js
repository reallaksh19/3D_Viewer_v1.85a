import { describe, expect, it } from 'vitest';

import {
  UXML_ROUTE_BLOCK_CODES,
  UXML_ROUTE_MASTER_OWNERS,
  UXML_ROUTE_TARGETS,
  assertUxmlRouteHandoffAllowed,
  createUxmlRouteHandoffPayload,
  evaluateUxmlRouteHandoffPolicy,
  summarizeUxmlRouteHandoff,
} from '../uxml/UxmlRouteHandoffPolicy.js';

function topologyDecision(overrides = {}) {
  return {
    schema: 'uxml-topology-decision-gate/v1',
    outputBridgeReady: true,
    exportAllowed: true,
    summary: {
      acceptedConnectionCount: 3,
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

function handoff(overrides = {}) {
  return {
    schema: 'rvm-pcf-accepted-topology-handoff/v1',
    summary: {
      handoffConnectionCount: 3,
      annotatedRowCount: 4,
      pipelineCount: 1,
      coordinatesMutated: false,
      legacyRoutingContinues: true,
      mastersDeferredToLegacyRoute: true,
      pcfEmitterDeferredToLegacyRoute: true,
    },
    ...overrides,
  };
}

describe('UxmlRouteHandoffPolicy Existing Agent', () => {
  it('blocks when target route is invalid', () => {
    const result = evaluateUxmlRouteHandoffPolicy({
      targetRoute: 'BAD_ROUTE',
      topologyDecision: topologyDecision(),
    });

    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe(UXML_ROUTE_BLOCK_CODES.NO_TARGET_ROUTE);
  });

  it('blocks when topology decision is missing', () => {
    const result = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe(UXML_ROUTE_BLOCK_CODES.NO_TOPOLOGY_DECISION);
    expect(result.blockedReason).toContain('TopologyDecisionGate');
  });

  it('blocks when output bridge is not ready', () => {
    const result = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision({
        outputBridgeReady: false,
        exportAllowed: false,
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe(UXML_ROUTE_BLOCK_CODES.OUTPUT_BRIDGE_NOT_READY);
  });

  it('allows handoff to legacy Extract PCF when decision is green', () => {
    const result = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: handoff(),
    });

    expect(result.allowed).toBe(true);
    expect(result.targetRoute).toBe(UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY);
    expect(result.masterOwner).toBe(UXML_ROUTE_MASTER_OWNERS.LEGACY_PCF_ROUTE);
    expect(result.requiredPayload).toContain('legacyMasterRoute');
    expect(result.requiredPayload).toContain('legacyPcfEmitter');
    expect(result.routeContract.uxmlEmitsPcfDirectly).toBe(false);
    expect(result.routeContract.uxmlMutatesCoordinates).toBe(false);
  });

  it('keeps non-PCF routes separate from PCF legacy master ownership', () => {
    const glb = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.GLB_EXPORT,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: handoff(),
    });

    expect(glb.allowed).toBe(true);
    expect(glb.masterOwner).toBe(UXML_ROUTE_MASTER_OWNERS.GLB_ROUTE);
    expect(glb.requiredPayload).toContain('visualMetadata');
    expect(glb.requiredPayload).not.toContain('legacyPcfEmitter');

    const twoD = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.TWO_D_EXPORT,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: handoff(),
    });

    expect(twoD.allowed).toBe(true);
    expect(twoD.masterOwner).toBe(UXML_ROUTE_MASTER_OWNERS.TWO_D_ROUTE);
    expect(twoD.requiredPayload).toContain('draftingMetadata');
    expect(twoD.requiredPayload).not.toContain('legacyPcfEmitter');
  });

  it('blocks manual review / rejected / unresolved when partial export is false', () => {
    const manual = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision({
        exportAllowed: false,
        summary: {
          acceptedConnectionCount: 3,
          manualReviewCount: 1,
          rejectedCount: 0,
          unresolvedCount: 0,
        },
      }),
      allowPartialExport: false,
    });

    expect(manual.allowed).toBe(false);
    expect(manual.blockCode).toBe(UXML_ROUTE_BLOCK_CODES.EXPORT_NOT_ALLOWED);

    const unresolved = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision({
        exportAllowed: true,
        summary: {
          acceptedConnectionCount: 3,
          manualReviewCount: 0,
          rejectedCount: 0,
          unresolvedCount: 2,
        },
      }),
      allowPartialExport: false,
    });

    expect(unresolved.allowed).toBe(false);
    expect(unresolved.blockCode).toBe(UXML_ROUTE_BLOCK_CODES.UNRESOLVED_TOPOLOGY);
  });

  it('allows partial export override when output bridge is ready', () => {
    const result = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision({
        outputBridgeReady: true,
        exportAllowed: false,
        summary: {
          acceptedConnectionCount: 3,
          manualReviewCount: 1,
          rejectedCount: 1,
          unresolvedCount: 1,
        },
      }),
      acceptedTopologyHandoff: handoff(),
      allowPartialExport: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.allowPartialExport).toBe(true);
    expect(result.decisionSummary.manualReviewCount).toBe(1);
    expect(result.decisionSummary.rejectedCount).toBe(1);
    expect(result.decisionSummary.unresolvedCount).toBe(1);
  });

  it('assert throws with route policy payload when blocked', () => {
    expect(() => assertUxmlRouteHandoffAllowed({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision({
        outputBridgeReady: false,
        exportAllowed: false,
      }),
    })).toThrow('UXML output bridge is not ready');

    try {
      assertUxmlRouteHandoffAllowed({
        targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
        topologyDecision: topologyDecision({
          outputBridgeReady: false,
          exportAllowed: false,
        }),
      });
    } catch (err) {
      expect(err.code).toBe(UXML_ROUTE_BLOCK_CODES.OUTPUT_BRIDGE_NOT_READY);
      expect(err.routeHandoffPolicy.allowed).toBe(false);
    }
  });

  it('creates route handoff payload without generating PCF or resolving masters', () => {
    const payload = createUxmlRouteHandoffPayload({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      uxml: { schema: 'uxml/v1' },
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: handoff(),
      diagnostics: [{ code: 'D1' }],
      lossContract: [{ code: 'L1' }],
    });

    expect(payload.schema).toBe('uxml-route-handoff-payload/v1');
    expect(payload.allowed).toBe(true);
    expect(payload.uxml.schema).toBe('uxml/v1');
    expect(payload.diagnostics).toHaveLength(1);
    expect(payload.lossContract).toHaveLength(1);
    expect(payload.routeContract.uxmlEmitsPcfDirectly).toBe(false);
    expect(payload.routeContract.uxmlMutatesCoordinates).toBe(false);
  });

  it('summarizes allowed and blocked route handoff states', () => {
    const allowed = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: topologyDecision(),
      acceptedTopologyHandoff: handoff(),
    });

    expect(summarizeUxmlRouteHandoff(allowed)).toContain('legacy Extract PCF');
    expect(summarizeUxmlRouteHandoff(allowed)).toContain('masters and PCF emitter remain owned by legacy route');

    const blocked = evaluateUxmlRouteHandoffPolicy({
      targetRoute: UXML_ROUTE_TARGETS.EXTRACT_PCF_LEGACY,
      topologyDecision: null,
    });

    expect(summarizeUxmlRouteHandoff(blocked)).toContain('blocked');
  });
});