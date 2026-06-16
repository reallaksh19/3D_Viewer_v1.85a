import { describe, expect, it } from 'vitest';

import {
  buildUxmlCl1PackageSnapshot,
  buildUxmlCl1Snapshot,
  createUxmlCl1SnapshotDownload,
  createUxmlCl1SnapshotFileName,
  serializeUxmlCl1PackageSnapshot,
} from '../uxml/UxmlCl1PackageSnapshot.js';

function packageFixture() {
  return {
    schema: 'uxml-cl1-route-package/v1',
    ok: true,
    allowed: true,
    blocked: false,
    blockCode: '',
    blockedReason: '',
    packageId: 'cl1-abc12345',
    targetRoute: 'EXTRACT_PCF_LEGACY',
    targetRouteLabel: 'Extract PCF legacy route',
    sourceInfo: {
      sourceFile: '1001-P - COPY_INPUT.XML',
      selectedSourceType: 'INPUT_XML',
      detectedSourceType: 'INPUT_XML',
      profile: 'INPUT_XML',
    },
    policy: {
      schema: 'uxml-route-handoff-policy/v1',
      allowed: true,
      targetRoute: 'EXTRACT_PCF_LEGACY',
      masterOwner: 'LEGACY_PCF_ROUTE',
      routeContract: {
        uxmlMutatesCoordinates: false,
        uxmlAppliesFixes: false,
        uxmlEmitsPcfDirectly: false,
      },
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
      FLANGE: 2,
      TEE: 1,
      SUPPORT: 1,
    },
    pipelineRefs: ['/P1'],
    diagnostics: [{ code: 'D1', message: 'diagnostic' }],
    lossContract: [{ code: 'L1', message: 'loss' }],
    routeContract: {
      uxmlMutatesCoordinates: false,
      uxmlAppliesFixes: false,
      uxmlEmitsPcfDirectly: false,
    },
    payload: {
      uxml: { schema: 'uxml/v1', components: [{ id: 'PIPE-1' }] },
      topologyDecision: { schema: 'uxml-topology-decision-gate/v1' },
      acceptedTopologyHandoff: { schema: 'rvm-pcf-accepted-topology-handoff/v1' },
    },
  };
}

describe('UxmlCl1PackageSnapshot CL1-C', () => {
  it('creates deterministic debug-only snapshot without payload by default', () => {
    const pkg = packageFixture();
    const a = buildUxmlCl1PackageSnapshot(pkg);
    const b = buildUxmlCl1PackageSnapshot(pkg);

    expect(a.schema).toBe('uxml-cl1-package-snapshot/v1');
    expect(a.snapshotId).toBe(b.snapshotId);
    expect(a.deterministic).toBe(true);
    expect(a.debugOnly).toBe(true);
    expect(a.pcfGenerated).toBe(false);
    expect(a.mastersResolved).toBe(false);
    expect(a.coordinatesMutated).toBe(false);
    expect(a.fixesApplied).toBe(false);
    expect(a.packageId).toBe('cl1-abc12345');
    expect(a.targetRoute).toBe('EXTRACT_PCF_LEGACY');
    expect(a.entityCounts.componentCount).toBe(10);
    expect(a.topologyCounts.acceptedConnectionCount).toBe(8);
    expect(a.handoffSummary.handoffConnectionCount).toBe(8);
    expect(a.payloadIncluded).toBe(false);
    expect(a.payload).toBeNull();
  });

  it('can include payload explicitly for replay/debug use', () => {
    const snapshot = buildUxmlCl1PackageSnapshot(packageFixture(), { includePayload: true });
    expect(snapshot.payloadIncluded).toBe(true);
    expect(snapshot.payload.uxml.schema).toBe('uxml/v1');
    expect(snapshot.payload.topologyDecision.schema).toBe('uxml-topology-decision-gate/v1');
  });

  it('can suppress diagnostics and loss contract', () => {
    const snapshot = buildUxmlCl1PackageSnapshot(packageFixture(), {
      includeDiagnostics: false,
      includeLossContract: false,
    });
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.lossContract).toEqual([]);
  });

  it('serializes snapshot to readable JSON', () => {
    const snapshot = buildUxmlCl1PackageSnapshot(packageFixture());
    const text = serializeUxmlCl1PackageSnapshot(snapshot);
    expect(text).toContain('"schema": "uxml-cl1-package-snapshot/v1"');
    expect(text).toContain('"debugOnly": true');
    const parsed = JSON.parse(text);
    expect(parsed.snapshotId).toBe(snapshot.snapshotId);
  });

  it('creates safe deterministic file name', () => {
    const snapshot = buildUxmlCl1PackageSnapshot(packageFixture());
    const fileName = createUxmlCl1SnapshotFileName(snapshot);
    expect(fileName).toContain('uxml-cl1-');
    expect(fileName).toContain('EXTRACT_PCF_LEGACY');
    expect(fileName.endsWith('.json')).toBe(true);
    expect(fileName).not.toContain(' ');
  });

  it('creates download object without writing files or creating PCF', () => {
    const download = createUxmlCl1SnapshotDownload({
      cl1RoutePackage: packageFixture(),
      includePayload: false,
    });

    expect(download.schema).toBe('uxml-cl1-snapshot-download/v1');
    expect(download.fileName.endsWith('.json')).toBe(true);
    expect(download.mimeType).toBe('application/json');
    expect(download.byteLength).toBeGreaterThan(0);
    expect(download.debugOnly).toBe(true);
    expect(download.pcfGenerated).toBe(false);
    expect(download.mastersResolved).toBe(false);
    expect(download.coordinatesMutated).toBe(false);
    expect(download.fixesApplied).toBe(false);
    const parsed = JSON.parse(download.text);
    expect(parsed.schema).toBe('uxml-cl1-package-snapshot/v1');
  });

  it('does not mutate source CL1 package', () => {
    const pkg = packageFixture();
    const before = JSON.stringify(pkg);
    const snapshot = buildUxmlCl1PackageSnapshot(pkg, { includePayload: true });
    expect(JSON.stringify(pkg)).toBe(before);
    expect(snapshot.payload).not.toBe(pkg.payload);
  });

  it('provides alias export', () => {
    const snapshot = buildUxmlCl1Snapshot(packageFixture());
    expect(snapshot.schema).toBe('uxml-cl1-package-snapshot/v1');
  });
});
