import { describe, expect, it } from 'vitest';

import {
  RAY_DECISIONS,
} from '../uxml/UxmlConstants.js';

import {
  compareUxmlTopoGraphs,
  compareUxmlTopologyGraphs,
  buildUxmlTopoGraphComparison,
} from '../uxml/UxmlTopoGraphComparator.js';

function universalGraph(overrides = {}) {
  return {
    schema: 'uxml-universal-topo-graph/v1',
    ok: true,
    blocked: false,
    components: [],
    nodes: [],
    ports: [],
    edges: [],
    candidateEdges: [],
    disconnected: [],
    diagnostics: [],
    summary: {},
    ...overrides,
  };
}

function rayGraph(overrides = {}) {
  return {
    schema: 'uxml-ray-topo-graph/v2',
    ok: true,
    blocked: false,
    faceSnapCandidates: [],
    branchRaySources: [],
    rayCandidates: [],
    rayConnections: [],
    rayOnlyConnections: [],
    bridgePipeCandidates: [],
    branchConnections: [],
    oletPassthroughCandidates: [],
    orphans: [],
    ambiguousHits: [],
    rejectedHits: [],
    diagnostics: [],
    summary: {},
    ...overrides,
  };
}

function edge(id, sourceComponentId, targetComponentId, sourcePortId = '', targetPortId = '') {
  return {
    id,
    nodeId: `N-${id}`,
    sourcePortId: sourcePortId || `UTG-P-F-${sourceComponentId}-A`,
    targetPortId: targetPortId || `UTG-P-F-${targetComponentId}-B`,
    sourceComponentId,
    targetComponentId,
    edgeClass: 'EXACT_CONNECTION',
    distanceMm: 0,
    pipelineRef: '/P1',
  };
}

function rayCandidate(id, sourceComponentId, targetComponentId, extra = {}) {
  return {
    id,
    pass: 'P2-BRANCH-SOURCE',
    sourceComponentId,
    sourceFaceId: extra.sourceFaceId || `F-${sourceComponentId}-BRANCH`,
    sourceRole: extra.sourceRole || 'OLET_BRANCH',
    targetComponentId,
    targetFaceId: extra.targetFaceId || `F-${targetComponentId}-PIPE_END_1`,
    targetRole: extra.targetRole || 'PIPE_END_1',
    pipelineRef: '/P1',
    distanceAlongRayMm: 150,
    perpendicularMissMm: 0,
    safe: true,
    blockers: [],
    recommendedAction: 'MOVE_PIPE_ENDPOINT_TO_SOURCE_FACE',
    decision: RAY_DECISIONS.PROMOTE_RAY_CANDIDATE,
    ...extra,
  };
}

function disconnected(id, componentId, faceId, role = 'OLET_BRANCH') {
  return {
    id,
    code: `UXML-TOPO-${role}-DISCONNECTED`,
    componentId,
    portId: `UTG-P-${faceId}`,
    role,
    faceKind: role,
    point: { x: 0, y: 0, z: 0 },
    pipelineRef: '/P1',
  };
}

describe('UxmlTopoGraphComparator Agent 07', () => {
  it('blocks when no input is provided', () => {
    const result = compareUxmlTopoGraphs(null);

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics.some(d => d.code === 'UXML-COMPARE-NO-INPUT')).toBe(true);
    expect(result.summary.diagnosticCount).toBe(1);
  });

  it('classifies agreement when Ray connection matches UniversalTopoGraph edge by component pair', () => {
    const ug = universalGraph({
      edges: [
        edge('E-1', 'C-OLET-1', 'C-BRANCH'),
      ],
    });

    const rg = rayGraph({
      rayConnections: [
        rayCandidate('RC-1', 'C-OLET-1', 'C-BRANCH'),
      ],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.ok).toBe(true);
    expect(result.summary.agreementCount).toBe(1);
    expect(result.summary.rayOnlyCount).toBe(0);
    expect(result.agreements[0].decision).toBe(RAY_DECISIONS.AGREE);
    expect(result.agreements[0].universalEdge.id).toBe('E-1');
  });

  it('classifies safe Ray-only candidate as promotion candidate', () => {
    const ug = universalGraph({
      edges: [],
      disconnected: [
        disconnected('D-1', 'C-OLET-1', 'F-C-OLET-1-BRANCH', 'OLET_BRANCH'),
      ],
    });

    const rg = rayGraph({
      rayConnections: [
        rayCandidate('RC-1', 'C-OLET-1', 'C-BRANCH', {
          sourceFaceId: 'F-C-OLET-1-BRANCH',
          targetFaceId: 'F-C-BRANCH-PIPE_END_1',
        }),
      ],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.summary.rayOnlyCount).toBe(1);
    expect(result.summary.promotionCandidateCount).toBe(1);
    expect(result.summary.unresolvedUniversalDisconnectedCount).toBe(0);

    expect(result.promotionCandidates[0].decision).toBe(RAY_DECISIONS.PROMOTE_RAY_SAFE);
    expect(result.promotionCandidates[0].action).toBe('PROMOTE_RAY_CONNECTION_CANDIDATE_NO_MUTATION');
  });

  it('classifies unsafe Ray candidate as rejected and manual review', () => {
    const ug = universalGraph({
      edges: [],
    });

    const unsafe = rayCandidate('CAND-1', 'C-OLET-1', 'C-FLANGE-1', {
      safe: false,
      blockers: ['TARGET_NOT_PIPE_ENDPOINT'],
      recommendedAction: 'MANUAL_REVIEW_OR_BRIDGE_PIPE_CANDIDATE',
      targetRole: 'FLANGE_END_1',
    });

    const rg = rayGraph({
      rayCandidates: [unsafe],
      rayConnections: [],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.summary.rejectedRayCount).toBe(1);
    expect(result.summary.manualReviewCount).toBe(1);
    expect(result.rejectedRay[0].decision).toBe(RAY_DECISIONS.REJECT_RAY);
    expect(result.manualReview[0].decision).toBe(RAY_DECISIONS.MANUAL_REVIEW);
    expect(result.diagnostics.some(d => d.code === 'UXML-COMPARE-RAY-MANUAL-REVIEW')).toBe(true);
  });

  it('collects P0 face proximity candidates without mutation', () => {
    const ug = universalGraph({
      edges: [],
    });

    const snap = rayCandidate('SNAP-1', 'C-PIPE-1', 'C-FLG-1', {
      pass: 'P0-FACE-PROXIMITY',
      sourceRole: 'PIPE_END_2',
      targetRole: 'FLANGE_END_1',
      sourceFaceId: 'F-C-PIPE-1-PIPE_END_2',
      targetFaceId: 'F-C-FLG-1-FLANGE_END_1',
      distanceAlongRayMm: 4,
      recommendedAction: 'SNAP_FACE_PROXIMITY_CANDIDATE_NO_MUTATION',
    });

    const rg = rayGraph({
      faceSnapCandidates: [snap],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.summary.faceProximityCandidateCount).toBe(1);
    expect(result.faceProximityCandidates[0].decision).toBe(RAY_DECISIONS.PROMOTE_RAY_CANDIDATE);
    expect(result.faceProximityCandidates[0].rayCandidate.recommendedAction).toBe(
      'SNAP_FACE_PROXIMITY_CANDIDATE_NO_MUTATION'
    );
  });

  it('classifies UniversalTopoGraph edge as universal-only when no Ray evidence matches', () => {
    const ug = universalGraph({
      edges: [
        edge('E-1', 'C-PIPE-1', 'C-VALVE-1'),
      ],
    });

    const rg = rayGraph({
      rayConnections: [],
      rayCandidates: [],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.summary.universalOnlyCount).toBe(1);
    expect(result.universalOnly[0].decision).toBe(RAY_DECISIONS.UNIVERSAL_ONLY);
    expect(result.universalOnly[0].universalEdge.id).toBe('E-1');
  });

  it('reports unresolved UniversalTopoGraph disconnected face when Ray does not resolve it', () => {
    const ug = universalGraph({
      disconnected: [
        disconnected('D-1', 'C-OLET-1', 'F-C-OLET-1-BRANCH', 'OLET_BRANCH'),
      ],
    });

    const rg = rayGraph({
      rayConnections: [],
      rayCandidates: [],
    });

    const result = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(result.summary.unresolvedUniversalDisconnectedCount).toBe(1);
    expect(result.unresolvedUniversalDisconnected[0].universalDisconnected.faceId).toBe(
      'F-C-OLET-1-BRANCH'
    );
    expect(result.diagnostics.some(d => d.code === 'UXML-COMPARE-UNRESOLVED-DISCONNECTED-FACE')).toBe(true);
  });

  it('blocks comparison when source graph is blocked unless allowBlockedGraphs is true', () => {
    const ug = universalGraph({
      blocked: true,
    });

    const rg = rayGraph();

    const blocked = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.blocked).toBe(true);
    expect(blocked.diagnostics.some(d => d.code === 'UXML-COMPARE-BLOCKED-GRAPH')).toBe(true);

    const allowed = compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
      allowBlockedGraphs: true,
    });

    expect(allowed.blocked).toBe(false);
  });

  it('does not mutate input graph objects', () => {
    const ug = universalGraph({
      edges: [
        edge('E-1', 'C-OLET-1', 'C-BRANCH'),
      ],
    });

    const rg = rayGraph({
      rayConnections: [
        rayCandidate('RC-1', 'C-OLET-1', 'C-BRANCH'),
      ],
    });

    const beforeUniversal = JSON.stringify(ug);
    const beforeRay = JSON.stringify(rg);

    compareUxmlTopoGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(JSON.stringify(ug)).toBe(beforeUniversal);
    expect(JSON.stringify(rg)).toBe(beforeRay);
  });

  it('provides alias exports for integration', () => {
    const ug = universalGraph();
    const rg = rayGraph();

    const a = compareUxmlTopologyGraphs(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    const b = buildUxmlTopoGraphComparison(null, {
      universalGraph: ug,
      rayGraph: rg,
    });

    expect(a.schema).toBe('uxml-topo-graph-comparator/v1');
    expect(b.schema).toBe('uxml-topo-graph-comparator/v1');
  });
});