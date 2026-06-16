import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  RVM_PCF_TOPOLOGY_MODES,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';

import {
  runUxmlTopologyForRvmRows,
} from '../rvm-pcf-extract/RvmUxmlTopologyBridge.js';

import {
  evaluateRvmPcfExportGuard,
  RVM_PCF_EXPORT_BLOCK_CODES,
} from '../rvm-pcf-extract/RvmPcfExportGuard.js';

import {
  renderRvmUxmlTopologyDiagnosticsHtml,
} from '../rvm-pcf-extract/RvmUxmlTopologyDiagnosticsPanel.js';

const BENCHMARK_DIR = path.resolve(
  process.cwd(),
  'Benchmarks/RVM JSON to PCF UXML Topology'
);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(BENCHMARK_DIR, name), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function geometryFingerprint(rows) {
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    ep1: row.ep1 ?? null,
    ep2: row.ep2 ?? null,
    cp: row.cp ?? null,
    bp: row.bp ?? null,
    supportCoord: row.supportCoord ?? null,
  }));
}

describe('RVM JSON → PCF UXML mode E2E smoke Agent 16', () => {
  it('runs the benchmark rows through the full UXML topology workflow', () => {
    const rows = readJson('broken-topology-50-rows.json');
    const expected = readJson('expected-uxml-topology-outcome.json');

    const beforeRows = JSON.stringify(rows);
    const beforeGeometry = geometryFingerprint(rows);

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'agent-16-e2e-smoke',
    });

    expect(JSON.stringify(rows)).toBe(beforeRows);
    expect(geometryFingerprint(rows)).toEqual(beforeGeometry);

    expect(result.schema).toBe('rvm-pcf-uxml-topology-bridge/v1');
    expect(result.topologyMode).toBe(RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY);

    expect(result.rows).toHaveLength(expected.rowCount);
    expect(result.legacyRows).toHaveLength(expected.rowCount);

    expect(result.uxml.components.length).toBeGreaterThanOrEqual(expected.minimums.componentCount);
    expect(result.faceModel.schema).toBe('uxml-face-model/v1');
    expect(result.universalGraph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(result.rayGraph.schema).toBe('uxml-ray-topo-graph/v2');
    expect(result.comparison.schema).toBe('uxml-topo-graph-comparator/v1');
    expect(result.topologyDecision.schema).toBe('uxml-topology-decision-gate/v1');
    expect(result.acceptedTopologyHandoff.schema).toBe('rvm-pcf-accepted-topology-handoff/v1');

    expect(result.topologyDecision.summary.acceptedConnectionCount).toBeGreaterThan(0);
    expect(result.acceptedTopologyHandoff.summary.handoffConnectionCount).toBeGreaterThan(0);
    expect(result.acceptedTopologyHandoff.summary.annotatedRowCount).toBeGreaterThan(0);

    expect(result.readinessGate.topologyDecision).toBeTruthy();
    expect(result.readinessGate.acceptedTopologyHandoff).toBeTruthy();

    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);

    const annotatedRows = result.legacyRows.filter(row =>
      row._topologyMode === RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY ||
      row._uxmlAcceptedTopologyCount > 0
    );

    expect(annotatedRows.length).toBeGreaterThan(0);

    for (let i = 0; i < rows.length; i += 1) {
      expect(result.legacyRows[i].id).toBe(rows[i].id);
      expect(result.legacyRows[i].type).toBe(rows[i].type);
      expect(result.legacyRows[i].ep1).toBe(rows[i].ep1);
      expect(result.legacyRows[i].ep2).toBe(rows[i].ep2);
      expect(result.legacyRows[i].cp).toBe(rows[i].cp);
      expect(result.legacyRows[i].bp).toBe(rows[i].bp);
      expect(result.legacyRows[i].supportCoord).toBe(rows[i].supportCoord);
    }
  });

  it('allows Generate PCF only after UXML readiness and decision gate allow export', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'agent-16-export-allowed-smoke',
    });

    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: result.legacyRows,
      readinessGate: result.readinessGate,
      allowPartialExport: true,
    });

    expect(guard.allowed).toBe(true);
    expect(guard.blocked).toBe(false);
    expect(guard.outputBridgeReady).toBe(true);
    expect(guard.acceptedConnectionCount).toBeGreaterThan(0);
    expect(guard.legacyRoutingContinues).toBe(true);
    expect(guard.mastersDeferredToLegacyRoute).toBe(true);
    expect(guard.pcfEmitterDeferredToLegacyRoute).toBe(true);
  });

  it('blocks Generate PCF when readiness has not been run', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows,
      readinessGate: null,
      allowPartialExport: false,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.blocked).toBe(true);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.READINESS_NOT_RUN);
    expect(guard.reason).toContain('Run readiness check');
  });

  it('blocks Generate PCF when UXML decision gate blocks export and partial export is not enabled', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'agent-16-export-block-smoke',
    });

    const blockedReadiness = clone(result.readinessGate);

    blockedReadiness.topologyDecision.exportAllowed = false;
    blockedReadiness.topologyDecision.outputBridgeReady = true;
    blockedReadiness.report.allowPcfExport = false;
    blockedReadiness.report.exportBlockReason = 'Synthetic Agent 16 blocked export.';

    const guard = evaluateRvmPcfExportGuard({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      rows: result.legacyRows,
      readinessGate: blockedReadiness,
      allowPartialExport: false,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.blocked).toBe(true);
    expect(guard.code).toBe(RVM_PCF_EXPORT_BLOCK_CODES.UXML_DECISION_BLOCKED);
    expect(guard.reason).toBe('Synthetic Agent 16 blocked export.');
  });

  it('renders UXML diagnostics HTML with topology, decision, handoff and row identity evidence', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'agent-16-diagnostics-smoke',
    });

    const html = renderRvmUxmlTopologyDiagnosticsHtml({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: result,
      readinessGate: result.readinessGate,
      diagnostics: result.diagnostics,
    });

    expect(html).toContain('UXML Topology Mode Diagnostics');
    expect(html).toContain('UniversalTopoGraph');
    expect(html).toContain('RayTopoGraph');
    expect(html).toContain('Comparator');
    expect(html).toContain('Decision Gate');
    expect(html).toContain('Accepted topology connections');
    expect(html).toContain('Manual review topology items');
    expect(html).toContain('Unresolved disconnected items');
    expect(html).toContain('UXML diagnostics with row identity');

    expect(html).toContain('Legacy master resolution and the existing PCF emitter continue after this gate');

    const hasKnownIdentity =
      html.includes('REF-') ||
      html.includes('L-100') ||
      html.includes('/B-1001') ||
      html.includes('/B-1002') ||
      html.includes('/B-1003');

    expect(hasKnownIdentity).toBe(true);
  });

  it('keeps the workflow scoped to topology and legacy handoff only', () => {
    const rows = readJson('broken-topology-50-rows.json');

    const result = runUxmlTopologyForRvmRows(rows, {
      allowPartialExport: true,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
    });

    expect(result.readinessGate.summary.legacyRoutingContinues).toBe(true);
    expect(result.readinessGate.summary.mastersDeferredToLegacyRoute).toBe(true);
    expect(result.readinessGate.summary.pcfEmitterDeferredToLegacyRoute).toBe(true);

    expect(result.acceptedTopologyHandoff.summary.coordinatesMutated).toBe(false);

    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.generatedPcf).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
  });
});