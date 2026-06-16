import { describe, expect, it } from 'vitest';

import {
  UXML_CL1_WORKBENCH_STATUS,
  buildUxmlCl1WorkbenchSummary,
  createUxmlCl1WorkbenchSummary,
  summarizeUxmlCl1WorkbenchSummary,
} from '../uxml/UxmlCl1WorkbenchSummary.js';

function topologyDecision(overrides = {}) {
  return {
    schema: 'uxml-topology-decision-gate/v1',
    outputBridgeReady: true,
    exportAllowed: true,
    summary: {
      acceptedConnectionCount: 5,
      agreementAcceptedCount: 5,
      universalOnlyAcceptedCount: 0,
      rayPromotionAcceptedCount: 0,
      faceProximityAcceptedCount: 0,
      manualReviewCount: 0,
      rejectedCount: 0,
      unresolvedCount: 0,
      diagnosticCount: 0,
    },
    ...overrides,
  };
}

function routeHandoff(overrides = {}) {
  return {
    policy: {
      allowed: true,
      targetRoute: 'DIAGNOSTICS_ONLY',
      targetRouteLabel: 'Diagnostics-only route',
      masterOwner: 'NONE',
      ...overrides,
    },
  };
}

function cl1Package(overrides = {}) {
  return {
    allowed: true,
    packageId: 'cl1-12345678',
    targetRoute: 'DIAGNOSTICS_ONLY',
    entityCounts: {
      componentCount: 10,
      anchorCount: 20,
      portCount: 20,
      segmentCount: 9,
    },
    topologyCounts: {
      acceptedConnectionCount: 5,
      manualReviewCount: 0,
      rejectedCount: 0,
      unresolvedCount: 0,
    },
    routeContract: {
      uxmlEmitsPcfDirectly: false,
      uxmlMutatesCoordinates: false,
      uxmlAppliesFixes: false,
    },
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    debugOnly: true,
    snapshotId: 'cl1snap-12345678',
    packageId: 'cl1-12345678',
    pcfGenerated: false,
    mastersResolved: false,
    coordinatesMutated: false,
    fixesApplied: false,
    ...overrides,
  };
}

function replay(overrides = {}) {
  return {
    replayReady: true,
    summary: {
      blockingIssueCount: 0,
      warningCount: 0,
    },
    countSummary: {
      componentCount: 10,
      acceptedConnectionCount: 5,
    },
    pcfGenerated: false,
    mastersResolved: false,
    coordinatesMutated: false,
    fixesApplied: false,
    ...overrides,
  };
}

describe('UxmlCl1WorkbenchSummary CL1-E', () => {
  it('returns PASS when all CL1 stages are green', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    expect(summary.schema).toBe('uxml-cl1-workbench-summary/v1');
    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.PASS);
    expect(summary.readyForRouteConsumption).toBe(true);
    expect(summary.blockedCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.notRunCount).toBe(0);
    expect(summary.counts.componentCount).toBe(10);
    expect(summary.counts.acceptedConnectionCount).toBe(5);
  });

  it('returns WARN when some stages have not run', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: null,
      cl1RoutePackage: null,
      cl1Snapshot: null,
      cl1ReplayValidation: null,
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.WARN);
    expect(summary.readyForRouteConsumption).toBe(false);
    expect(summary.notRunCount).toBeGreaterThan(0);
    expect(summary.stages.routeHandoff.status).toBe(UXML_CL1_WORKBENCH_STATUS.NOT_RUN);
  });

  it('returns WARN when manual review exists but bridge is ready', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision({
        exportAllowed: false,
        summary: {
          acceptedConnectionCount: 5,
          manualReviewCount: 1,
          rejectedCount: 0,
          unresolvedCount: 0,
        },
      }),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package({
        topologyCounts: {
          acceptedConnectionCount: 5,
          manualReviewCount: 1,
          rejectedCount: 0,
          unresolvedCount: 0,
        },
      }),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.WARN);
    expect(summary.stages.decisionGate.status).toBe(UXML_CL1_WORKBENCH_STATUS.WARN);
    expect(summary.counts.manualReviewCount).toBe(1);
  });

  it('returns BLOCKED when decision output bridge is not ready', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision({
        outputBridgeReady: false,
        exportAllowed: false,
      }),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
    expect(summary.readyForRouteConsumption).toBe(false);
    expect(summary.stages.decisionGate.status).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
  });

  it('returns BLOCKED when route handoff is blocked', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: {
        policy: {
          allowed: false,
          targetRoute: 'DIAGNOSTICS_ONLY',
          targetRouteLabel: 'Diagnostics-only route',
          blockedReason: 'Blocked by test.',
        },
      },
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
    expect(summary.stages.routeHandoff.status).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
  });

  it('returns BLOCKED when replay validator blocks', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay({
        replayReady: false,
        summary: {
          blockingIssueCount: 1,
          warningCount: 0,
        },
      }),
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
    expect(summary.stages.cl1Replay.status).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
  });

  it('returns BLOCKED when any safety flag is unsafe', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot({
        pcfGenerated: true,
      }),
      cl1ReplayValidation: replay(),
    });

    expect(summary.overallStatus).toBe(UXML_CL1_WORKBENCH_STATUS.BLOCKED);
    expect(summary.safety.pcfGenerated).toBe(true);
  });

  it('summarizes compact QA status', () => {
    const summary = buildUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    const text = summarizeUxmlCl1WorkbenchSummary(summary);
    expect(text).toContain('CL1 workbench PASS');
    expect(text).toContain('Components=10');
    expect(text).toContain('Accepted=5');
  });

  it('provides alias export', () => {
    const summary = createUxmlCl1WorkbenchSummary({
      topologyDecision: topologyDecision(),
      routeHandoff: routeHandoff(),
      cl1RoutePackage: cl1Package(),
      cl1Snapshot: snapshot(),
      cl1ReplayValidation: replay(),
    });

    expect(summary.schema).toBe('uxml-cl1-workbench-summary/v1');
  });
});
