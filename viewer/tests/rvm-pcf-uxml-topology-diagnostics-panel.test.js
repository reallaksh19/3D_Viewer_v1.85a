import { describe, expect, it } from 'vitest';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  buildRvmUxmlTopologyDiagnosticsViewModel,
  createRvmUxmlTopologyDiagnosticsViewModel,
  renderRvmUxmlTopologyDiagnosticsHtml,
} from '../rvm-pcf-extract/RvmUxmlTopologyDiagnosticsPanel.js';

function sampleTopology() {
  return {
    schema: 'rvm-pcf-uxml-topology-bridge/v1',
    topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
    adapter: {
      stats: {
        componentCount: 5,
        anchorCount: 12,
        portCount: 12,
      },
    },
    universalGraph: {
      schema: 'uxml-universal-topo-graph/v1',
      summary: {
        nodeCount: 8,
        edgeCount: 4,
        disconnectedCount: 2,
      },
    },
    rayGraph: {
      schema: 'uxml-ray-topo-graph/v2',
      summary: {
        faceSnapCandidateCount: 1,
        rayCandidateCount: 3,
        rayConnectionCount: 2,
        branchConnectionCount: 1,
        safeCandidateCount: 2,
        blockedCandidateCount: 1,
        orphanCount: 1,
        ambiguousHitCount: 0,
        fallbackRayCandidateCount: 0,
      },
    },
    comparison: {
      schema: 'uxml-topo-graph-comparator/v1',
      summary: {
        agreementCount: 2,
        universalOnlyCount: 1,
        rayOnlyCount: 1,
        promotionCandidateCount: 1,
        faceProximityCandidateCount: 1,
        rejectedRayCount: 1,
        manualReviewCount: 1,
        unresolvedUniversalDisconnectedCount: 1,
      },
    },
    topologyDecision: {
      schema: 'uxml-topology-decision-gate/v1',
      exportAllowed: false,
      outputBridgeReady: true,
      summary: {
        acceptedConnectionCount: 3,
        agreementAcceptedCount: 2,
        universalOnlyAcceptedCount: 1,
        rayPromotionAcceptedCount: 0,
        faceProximityAcceptedCount: 0,
        manualReviewCount: 1,
        rejectedCount: 1,
        unresolvedCount: 1,
      },
      acceptedConnections: [
        {
          id: 'TD-ACCEPT-AGREE-00001',
          source: 'UNIVERSAL_RAY_AGREEMENT',
          decision: 'ACCEPT',
          confidence: 'HIGH',
          sourceComponentId: 'PIPE-1',
          targetComponentId: 'VALVE-1',
          action: 'USE_UNIVERSAL_EDGE',
        },
        {
          id: 'TD-ACCEPT-UNIVERSAL-00002',
          source: 'UNIVERSAL_ONLY',
          decision: 'ACCEPT_WITH_REVIEW_NOTE',
          confidence: 'MEDIUM',
          sourceComponentId: 'VALVE-1',
          targetComponentId: 'PIPE-2',
          action: 'USE_UNIVERSAL_EDGE',
        },
      ],
      manualReview: [
        {
          id: 'TD-MANUAL-P0-00001',
          source: 'FACE_PROXIMITY',
          decision: 'MANUAL_REVIEW',
          reason: 'P0 face proximity evidence is review-only by default.',
          rayCandidate: {
            sourceComponentId: 'PIPE-2',
            targetComponentId: 'FLANGE-1',
            recommendedAction: 'SNAP_FACE_PROXIMITY_CANDIDATE_NO_MUTATION',
          },
        },
      ],
      rejected: [
        {
          id: 'TD-REJECT-RAY-00001',
          source: 'REJECTED_RAY',
          decision: 'REJECT',
          reason: 'TARGET_NOT_PIPE_ENDPOINT',
          rayCandidate: {
            sourceComponentId: 'OLET-1',
            targetComponentId: 'FLANGE-1',
          },
        },
      ],
      unresolved: [
        {
          id: 'TD-UNRESOLVED-00001',
          source: 'UNRESOLVED_DISCONNECTED',
          decision: 'BLOCK_EXPORT',
          reason: 'Disconnected face remains unresolved.',
          universalDisconnected: {
            componentId: 'OLET-2',
            role: 'OLET_BRANCH',
            pipelineRef: '/P1',
          },
        },
      ],
    },
    readinessGate: {
      summary: {
        legacyRoutingContinues: true,
        mastersDeferredToLegacyRoute: true,
        pcfEmitterDeferredToLegacyRoute: true,
      },
    },
  };
}

describe('RvmUxmlTopologyDiagnosticsPanel Agent 12', () => {
  it('returns inactive view model for legacy mode with no UXML topology', () => {
    const vm = buildRvmUxmlTopologyDiagnosticsViewModel({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      uxmlTopology: null,
      readinessGate: null,
      diagnostics: [],
    });

    expect(vm.schema).toBe('rvm-pcf-uxml-topology-diagnostics-panel/v1');
    expect(vm.active).toBe(false);
    expect(vm.modeLabel).toBe('Legacy topology');
  });

  it('builds audit-ready view model for UXML topology result', () => {
    const vm = buildRvmUxmlTopologyDiagnosticsViewModel({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: sampleTopology(),
      readinessGate: sampleTopology().readinessGate,
      diagnostics: [
        {
          severity: 'ERROR',
          code: 'UXML-TOPO-DECISION-UNRESOLVED-DISCONNECTED',
          rowNo: 360,
          refNo: 'REF-360',
          seqNo: '360',
          lineNo: 'L-100',
          pipelineRef: '/P1',
          message: 'OLET branch disconnected.',
          _source: 'uxml-topology',
        },
      ],
    });

    expect(vm.active).toBe(true);
    expect(vm.modeLabel).toBe('UXML topology');

    expect(vm.outputBridgeReady).toBe(true);
    expect(vm.exportAllowed).toBe(false);
    expect(vm.legacyRoutingContinues).toBe(true);
    expect(vm.mastersDeferredToLegacyRoute).toBe(true);
    expect(vm.pcfEmitterDeferredToLegacyRoute).toBe(true);

    expect(vm.universal.componentCount).toBe(5);
    expect(vm.universal.edgeCount).toBe(4);
    expect(vm.universal.disconnectedCount).toBe(2);

    expect(vm.ray.rayCandidateCount).toBe(3);
    expect(vm.ray.safeCandidateCount).toBe(2);
    expect(vm.ray.blockedCandidateCount).toBe(1);

    expect(vm.comparison.promotionCandidateCount).toBe(1);
    expect(vm.comparison.manualReviewCount).toBe(1);
    expect(vm.comparison.unresolvedUniversalDisconnectedCount).toBe(1);

    expect(vm.decision.acceptedConnectionCount).toBe(3);
    expect(vm.decision.manualReviewCount).toBe(1);
    expect(vm.decision.rejectedCount).toBe(1);
    expect(vm.decision.unresolvedCount).toBe(1);

    expect(vm.acceptedConnections).toHaveLength(2);
    expect(vm.manualReview).toHaveLength(1);
    expect(vm.rejected).toHaveLength(1);
    expect(vm.unresolved).toHaveLength(1);
    expect(vm.diagnostics).toHaveLength(1);
  });

  it('renders empty string when not in UXML mode and no topology exists', () => {
    const html = renderRvmUxmlTopologyDiagnosticsHtml({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.LEGACY,
      uxmlTopology: null,
    });

    expect(html).toBe('');
  });

  it('renders key UXML diagnostic sections and legacy-route message', () => {
    const html = renderRvmUxmlTopologyDiagnosticsHtml({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: sampleTopology(),
      readinessGate: sampleTopology().readinessGate,
      diagnostics: [
        {
          severity: 'ERROR',
          code: 'UXML-TOPO-DECISION-UNRESOLVED-DISCONNECTED',
          rowNo: 360,
          refNo: 'REF-360',
          seqNo: '360',
          lineNo: 'L-100',
          pipelineRef: '/P1',
          message: 'OLET branch disconnected.',
          _source: 'uxml-topology',
        },
      ],
    });

    expect(html).toContain('UXML Topology Mode Diagnostics');
    expect(html).toContain('Output bridge ready: YES');
    expect(html).toContain('Export allowed: NO');
    expect(html).toContain('Legacy route continues: YES');
    expect(html).toContain('Legacy master resolution and the existing PCF emitter continue after this gate');

    expect(html).toContain('UniversalTopoGraph');
    expect(html).toContain('RayTopoGraph');
    expect(html).toContain('Comparator');
    expect(html).toContain('Decision Gate');

    expect(html).toContain('Accepted topology connections');
    expect(html).toContain('Manual review topology items');
    expect(html).toContain('Unresolved disconnected items');
    expect(html).toContain('UXML diagnostics with row identity');

    expect(html).toContain('REF-360');
    expect(html).toContain('L-100');
    expect(html).toContain('/P1');
  });

  it('escapes HTML in diagnostic content', () => {
    const html = renderRvmUxmlTopologyDiagnosticsHtml({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: sampleTopology(),
      diagnostics: [
        {
          severity: 'WARNING',
          code: '<BAD>',
          rowNo: '<script>',
          message: '<img src=x onerror=alert(1)>',
          _source: 'uxml-topology',
        },
      ],
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('provides alias export for view-model generation', () => {
    const vm = createRvmUxmlTopologyDiagnosticsViewModel({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: sampleTopology(),
    });

    expect(vm.schema).toBe('rvm-pcf-uxml-topology-diagnostics-panel/v1');
    expect(vm.active).toBe(true);
  });
});