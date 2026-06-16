import { describe, expect, it } from 'vitest';

import {
  buildUxmlAcceptedTopology,
  decideUxmlTopologyAcceptance,
  runUxmlTopologyDecisionGate,
  UXML_TOPOLOGY_DECISIONS,
  UXML_TOPOLOGY_DECISION_SOURCES,
} from '../uxml/UxmlTopologyDecisionGate.js';

function comparison(overrides = {}) {
  return {
    schema: 'uxml-topo-graph-comparator/v1',
    ok: true,
    blocked: false,
    agreements: [],
    universalOnly: [],
    rayOnly: [],
    promotionCandidates: [],
    faceProximityCandidates: [],
    rejectedRay: [],
    manualReview: [],
    unresolvedUniversalDisconnected: [],
    diagnostics: [],
    summary: {},
    ...overrides,
  };
}

function universalEdge(id = 'E-1', source = 'C-PIPE-1', target = 'C-VALVE-1') {
  return {
    id,
    nodeId: `N-${id}`,
    sourcePortId: `P-${source}`,
    targetPortId: `P-${target}`,
    sourceComponentId: source,
    targetComponentId: target,
    edgeClass: 'EXACT_CONNECTION',
    distanceMm: 0,
    pipelineRef: '/P1',
  };
}

function rayCandidate(id = 'R-1', source = 'C-OLET-1', target = 'C-BRANCH', extra = {}) {
  return {
    id,
    pass: 'P2-BRANCH-SOURCE',
    sourceComponentId: source,
    sourceFaceId: `F-${source}-BRANCH`,
    sourceRole: 'OLET_BRANCH',
    targetComponentId: target,
    targetFaceId: `F-${target}-PIPE_END_1`,
    targetRole: 'PIPE_END_1',
    pipelineRef: '/P1',
    distanceAlongRayMm: 150,
    perpendicularMissMm: 0,
    safe: true,
    blockers: [],
    recommendedAction: 'MOVE_PIPE_ENDPOINT_TO_SOURCE_FACE',
    decision: 'PROMOTE_RAY_CANDIDATE',
    ...extra,
  };
}

function disconnected(componentId = 'C-OLET-1') {
  return {
    id: 'D-1',
    code: 'UXML-TOPO-OLET_BRANCH-DISCONNECTED',
    componentId,
    portId: `UTG-P-F-${componentId}-BRANCH`,
    faceId: `F-${componentId}-BRANCH`,
    role: 'OLET_BRANCH',
    faceKind: 'OLET_BRANCH',
    pipelineRef: '/P1',
    point: { x: 0, y: 0, z: 0 },
  };
}

describe('UxmlTopologyDecisionGate Agent 11', () => {
  it('blocks when no UXML or comparison is provided', () => {
    const result = decideUxmlTopologyAcceptance(null);

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.exportAllowed).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'UXML-TOPO-DECISION-NO-INPUT')).toBe(true);
  });

  it('accepts Universal/Ray agreement as high-confidence accepted connection', () => {
    const c = comparison({
      agreements: [
        {
          id: 'A-1',
          universalEdge: universalEdge('E-1', 'C-PIPE-1', 'C-VALVE-1'),
          rayCandidate: rayCandidate('R-1', 'C-PIPE-1', 'C-VALVE-1'),
          reason: 'Agreement',
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(result.outputBridgeReady).toBe(true);
    expect(result.exportAllowed).toBe(true);
    expect(result.summary.acceptedConnectionCount).toBe(1);

    const accepted = result.acceptedConnections[0];

    expect(accepted.source).toBe(UXML_TOPOLOGY_DECISION_SOURCES.UNIVERSAL_RAY_AGREEMENT);
    expect(accepted.decision).toBe(UXML_TOPOLOGY_DECISIONS.ACCEPT);
    expect(accepted.confidence).toBe('HIGH');
    expect(accepted.action).toBe('USE_UNIVERSAL_EDGE');
  });

  it('accepts Universal-only edge by default with medium confidence', () => {
    const c = comparison({
      universalOnly: [
        {
          id: 'UO-1',
          universalEdge: universalEdge('E-2', 'C-PIPE-1', 'C-FLANGE-1'),
          reason: 'Universal only',
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(result.exportAllowed).toBe(true);
    expect(result.summary.universalOnlyAcceptedCount).toBe(1);

    const accepted = result.acceptedConnections[0];

    expect(accepted.source).toBe(UXML_TOPOLOGY_DECISION_SOURCES.UNIVERSAL_ONLY);
    expect(accepted.decision).toBe(UXML_TOPOLOGY_DECISIONS.ACCEPT_WITH_REVIEW_NOTE);
    expect(accepted.confidence).toBe('MEDIUM');
  });

  it('moves Universal-only edge to manual review when acceptUniversalOnly is false', () => {
    const c = comparison({
      universalOnly: [
        {
          id: 'UO-1',
          universalEdge: universalEdge('E-2', 'C-PIPE-1', 'C-FLANGE-1'),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      acceptUniversalOnly: false,
    });

    expect(result.outputBridgeReady).toBe(false);
    expect(result.exportAllowed).toBe(false);
    expect(result.summary.manualReviewCount).toBe(1);
    expect(result.manualReview[0].source).toBe(UXML_TOPOLOGY_DECISION_SOURCES.UNIVERSAL_ONLY);
  });

  it('accepts safe Ray promotion within configured limits', () => {
    const c = comparison({
      promotionCandidates: [
        {
          id: 'P-1',
          rayCandidate: rayCandidate('R-1', 'C-OLET-1', 'C-BRANCH', {
            distanceAlongRayMm: 200,
            perpendicularMissMm: 0,
          }),
          reason: 'Safe ray',
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      allowSafeRayPromotions: true,
      maxPromotionDistanceAlongRayMm: 500,
      maxPromotionPerpendicularMissMm: 12,
    });

    expect(result.exportAllowed).toBe(true);
    expect(result.summary.rayPromotionAcceptedCount).toBe(1);

    const accepted = result.acceptedConnections[0];

    expect(accepted.source).toBe(UXML_TOPOLOGY_DECISION_SOURCES.SAFE_RAY_PROMOTION);
    expect(accepted.decision).toBe(UXML_TOPOLOGY_DECISIONS.PROMOTE_SAFE_RAY);
    expect(accepted.action).toBe('PROMOTE_RAY_CONNECTION_NO_MUTATION');
  });

  it('moves safe Ray promotion to manual review when promotion is disabled', () => {
    const c = comparison({
      promotionCandidates: [
        {
          id: 'P-1',
          rayCandidate: rayCandidate('R-1'),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      allowSafeRayPromotions: false,
    });

    expect(result.summary.rayPromotionAcceptedCount).toBe(0);
    expect(result.summary.manualReviewCount).toBe(1);
    expect(result.exportAllowed).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'UXML-TOPO-DECISION-RAY-PROMOTION-REVIEW')).toBe(true);
  });

  it('moves safe Ray promotion to manual review when promotion exceeds distance limits', () => {
    const c = comparison({
      promotionCandidates: [
        {
          id: 'P-1',
          rayCandidate: rayCandidate('R-1', 'C-OLET-1', 'C-BRANCH', {
            distanceAlongRayMm: 750,
            perpendicularMissMm: 0,
          }),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      maxPromotionDistanceAlongRayMm: 500,
    });

    expect(result.summary.rayPromotionAcceptedCount).toBe(0);
    expect(result.summary.manualReviewCount).toBe(1);
    expect(result.exportAllowed).toBe(false);
  });

  it('keeps P0 face proximity candidate as manual review by default', () => {
    const c = comparison({
      faceProximityCandidates: [
        {
          id: 'P0-1',
          rayCandidate: rayCandidate('SNAP-1', 'C-PIPE-1', 'C-FLG-1', {
            pass: 'P0-FACE-PROXIMITY',
            sourceRole: 'PIPE_END_2',
            targetRole: 'FLANGE_END_1',
            distanceAlongRayMm: 4,
            perpendicularMissMm: 0,
            recommendedAction: 'SNAP_FACE_PROXIMITY_CANDIDATE_NO_MUTATION',
          }),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(result.summary.faceProximityAcceptedCount).toBe(0);
    expect(result.summary.manualReviewCount).toBe(1);
    expect(result.manualReview[0].source).toBe(UXML_TOPOLOGY_DECISION_SOURCES.FACE_PROXIMITY);
    expect(result.diagnostics.some(d => d.code === 'UXML-TOPO-DECISION-P0-REVIEW')).toBe(true);
  });

  it('can explicitly accept P0 face proximity candidate by configuration', () => {
    const c = comparison({
      faceProximityCandidates: [
        {
          id: 'P0-1',
          rayCandidate: rayCandidate('SNAP-1', 'C-PIPE-1', 'C-FLG-1', {
            pass: 'P0-FACE-PROXIMITY',
            distanceAlongRayMm: 4,
            perpendicularMissMm: 0,
          }),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      allowFaceProximityPromotions: true,
    });

    expect(result.summary.faceProximityAcceptedCount).toBe(1);
    expect(result.exportAllowed).toBe(true);
  });

  it('keeps rejected Ray candidates in rejected list and blocks export', () => {
    const c = comparison({
      rejectedRay: [
        {
          id: 'RJ-1',
          rayCandidate: rayCandidate('R-BAD', 'C-OLET-1', 'C-FLG-1', {
            safe: false,
            blockers: ['TARGET_NOT_PIPE_ENDPOINT'],
            targetRole: 'FLANGE_END_1',
          }),
          reason: 'Target is fitting endpoint',
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(result.summary.rejectedCount).toBe(1);
    expect(result.exportAllowed).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'UXML-TOPO-DECISION-RAY-REJECTED')).toBe(true);
  });

  it('blocks export when unresolved disconnected faces remain', () => {
    const c = comparison({
      agreements: [
        {
          id: 'A-1',
          universalEdge: universalEdge('E-1'),
          rayCandidate: rayCandidate('R-1'),
        },
      ],
      unresolvedUniversalDisconnected: [
        {
          id: 'UD-1',
          universalDisconnected: disconnected('C-OLET-2'),
          reason: 'Still disconnected',
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(result.outputBridgeReady).toBe(true);
    expect(result.exportAllowed).toBe(false);
    expect(result.summary.unresolvedCount).toBe(1);
    expect(result.diagnostics.some(d => d.code === 'UXML-TOPO-DECISION-UNRESOLVED-DISCONNECTED')).toBe(true);
  });

  it('allows partial export when configured and accepted connections exist', () => {
    const c = comparison({
      agreements: [
        {
          id: 'A-1',
          universalEdge: universalEdge('E-1'),
          rayCandidate: rayCandidate('R-1'),
        },
      ],
      unresolvedUniversalDisconnected: [
        {
          id: 'UD-1',
          universalDisconnected: disconnected('C-OLET-2'),
        },
      ],
    });

    const result = decideUxmlTopologyAcceptance(null, {
      comparison: c,
      allowPartialExport: true,
    });

    expect(result.outputBridgeReady).toBe(true);
    expect(result.exportAllowed).toBe(true);
    expect(result.summary.unresolvedCount).toBe(1);
  });

  it('does not mutate comparison input', () => {
    const c = comparison({
      agreements: [
        {
          id: 'A-1',
          universalEdge: universalEdge('E-1'),
          rayCandidate: rayCandidate('R-1'),
        },
      ],
    });

    const before = JSON.stringify(c);

    decideUxmlTopologyAcceptance(null, { comparison: c });

    expect(JSON.stringify(c)).toBe(before);
  });

  it('provides alias exports for integration', () => {
    const c = comparison({
      agreements: [
        {
          id: 'A-1',
          universalEdge: universalEdge('E-1'),
          rayCandidate: rayCandidate('R-1'),
        },
      ],
    });

    const a = runUxmlTopologyDecisionGate(null, { comparison: c });
    const b = buildUxmlAcceptedTopology(null, { comparison: c });

    expect(a.schema).toBe('uxml-topology-decision-gate/v1');
    expect(b.schema).toBe('uxml-topology-decision-gate/v1');
  });
});
