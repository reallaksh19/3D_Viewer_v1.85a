import { describe, expect, it } from 'vitest';

import {
  buildUxmlCl1PackageSnapshot,
  serializeUxmlCl1PackageSnapshot,
} from '../uxml/UxmlCl1PackageSnapshot.js';

import {
  UXML_CL1_REPLAY_BLOCK_CODES,
  assertUxmlCl1SnapshotReplayReady,
  summarizeUxmlCl1SnapshotReplay,
  validateUxmlCl1ReplaySnapshot,
  validateUxmlCl1SnapshotReplay,
} from '../uxml/UxmlCl1SnapshotReplayValidator.js';

function packageFixture() {
  return {
    schema: 'uxml-cl1-route-package/v1',
    ok: true,
    allowed: true,
    packageId: 'cl1-abc12345',
    targetRoute: 'EXTRACT_PCF_LEGACY',
    targetRouteLabel: 'Extract PCF legacy route',
    sourceInfo: {
      sourceFile: 'sample.xml',
      selectedSourceType: 'INPUT_XML',
      detectedSourceType: 'INPUT_XML',
      profile: 'INPUT_XML',
    },
    entityCounts: {
      componentCount: 10,
      anchorCount: 20,
      portCount: 20,
      segmentCount: 9,
      supportCount: 1,
    },
    topologyCounts: {
      outputBridgeReady: true,
      exportAllowed: true,
      acceptedConnectionCount: 8,
      manualReviewCount: 0,
      rejectedCount: 0,
      unresolvedCount: 0,
    },
    handoffSummary: {
      handoffConnectionCount: 8,
      annotatedRowCount: 10,
      pipelineCount: 1,
      coordinatesMutated: false,
    },
    componentTypes: {
      PIPE: 5,
      VALVE: 1,
    },
    pipelineRefs: ['/P1'],
    diagnostics: [],
    lossContract: [],
    routeContract: {
      uxmlMutatesCoordinates: false,
      uxmlAppliesFixes: false,
      uxmlEmitsPcfDirectly: false,
    },
    policy: {
      routeContract: {
        uxmlMutatesCoordinates: false,
        uxmlAppliesFixes: false,
        uxmlEmitsPcfDirectly: false,
      },
    },
    payload: {
      uxml: { schema: 'uxml/v1' },
    },
  };
}

function validSnapshot(options = {}) {
  return buildUxmlCl1PackageSnapshot(packageFixture(), options);
}

describe('UxmlCl1SnapshotReplayValidator CL1-D', () => {
  it('validates a replay-ready CL1 snapshot object', () => {
    const report = validateUxmlCl1SnapshotReplay(validSnapshot());
    expect(report.schema).toBe('uxml-cl1-snapshot-replay-validator/v1');
    expect(report.ok).toBe(true);
    expect(report.replayReady).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.countSummary.componentCount).toBe(10);
    expect(report.countSummary.acceptedConnectionCount).toBe(8);
    expect(report.debugOnly).toBe(true);
    expect(report.pcfGenerated).toBe(false);
    expect(report.mastersResolved).toBe(false);
    expect(report.coordinatesMutated).toBe(false);
    expect(report.fixesApplied).toBe(false);
  });

  it('validates a replay-ready CL1 snapshot JSON string', () => {
    const text = serializeUxmlCl1PackageSnapshot(validSnapshot());
    const report = validateUxmlCl1SnapshotReplay(text);
    expect(report.replayReady).toBe(true);
    expect(report.countSummary.componentCount).toBe(10);
  });

  it('blocks invalid JSON string', () => {
    const report = validateUxmlCl1SnapshotReplay('{bad json');
    expect(report.replayReady).toBe(false);
    expect(report.issues[0].code).toBe(UXML_CL1_REPLAY_BLOCK_CODES.INVALID_JSON);
  });

  it('blocks invalid snapshot schema', () => {
    const snapshot = validSnapshot();
    snapshot.schema = 'wrong-schema';
    const report = validateUxmlCl1SnapshotReplay(snapshot);
    expect(report.replayReady).toBe(false);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.INVALID_SNAPSHOT_SCHEMA)).toBe(true);
  });

  it('blocks unsafe safety flags', () => {
    const snapshot = validSnapshot();
    snapshot.debugOnly = false;
    snapshot.pcfGenerated = true;
    snapshot.mastersResolved = true;
    snapshot.coordinatesMutated = true;
    snapshot.fixesApplied = true;
    const report = validateUxmlCl1SnapshotReplay(snapshot);
    expect(report.replayReady).toBe(false);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.NOT_DEBUG_ONLY)).toBe(true);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.PCF_GENERATED_FLAG_TRUE)).toBe(true);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.MASTERS_RESOLVED_FLAG_TRUE)).toBe(true);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.COORDINATES_MUTATED_FLAG_TRUE)).toBe(true);
    expect(report.issues.some((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.FIXES_APPLIED_FLAG_TRUE)).toBe(true);
  });

  it('blocks unsafe route contract', () => {
    const snapshot = validSnapshot();
    snapshot.routeContract.uxmlEmitsPcfDirectly = true;
    snapshot.routeContract.uxmlMutatesCoordinates = true;
    snapshot.routeContract.uxmlAppliesFixes = true;
    const report = validateUxmlCl1SnapshotReplay(snapshot);
    expect(report.replayReady).toBe(false);
    expect(report.issues.filter((issue) => issue.code === UXML_CL1_REPLAY_BLOCK_CODES.ROUTE_CONTRACT_UNSAFE)).toHaveLength(3);
  });

  it('warns when payload is required but not included', () => {
    const snapshot = validSnapshot({ includePayload: false });
    const report = validateUxmlCl1SnapshotReplay(snapshot, { requirePayloadForReplay: true });
    expect(report.replayReady).toBe(true);
    expect(report.summary.warningCount).toBe(1);
    expect(report.issues[0].code).toBe('UXML-CL1-REPLAY-PAYLOAD-NOT-INCLUDED');
  });

  it('assert helper throws with replay report when blocked', () => {
    const snapshot = validSnapshot();
    snapshot.pcfGenerated = true;
    expect(() => assertUxmlCl1SnapshotReplayReady(snapshot)).toThrow('Snapshot claims PCF was generated');
    try {
      assertUxmlCl1SnapshotReplayReady(snapshot);
    } catch (err) {
      expect(err.code).toBe(UXML_CL1_REPLAY_BLOCK_CODES.PCF_GENERATED_FLAG_TRUE);
      expect(err.replayReport.replayReady).toBe(false);
    }
  });

  it('summarizes replay-ready and blocked reports', () => {
    const ready = validateUxmlCl1SnapshotReplay(validSnapshot());
    expect(summarizeUxmlCl1SnapshotReplay(ready)).toContain('replay-ready');
    expect(summarizeUxmlCl1SnapshotReplay(ready)).toContain('Components=10');
    const blocked = validateUxmlCl1SnapshotReplay('{bad json');
    expect(summarizeUxmlCl1SnapshotReplay(blocked)).toContain('blocked');
  });

  it('provides alias export', () => {
    const report = validateUxmlCl1ReplaySnapshot(validSnapshot());
    expect(report.schema).toBe('uxml-cl1-snapshot-replay-validator/v1');
    expect(report.replayReady).toBe(true);
  });
});
