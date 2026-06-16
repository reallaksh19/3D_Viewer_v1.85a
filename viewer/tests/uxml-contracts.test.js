import { describe, expect, it } from 'vitest';

import {
  ANCHOR_ROLES,
  COMPONENT_TYPES,
  CONFIDENCE_LEVELS,
  DEFAULT_UNITS,
  GRAPH_EDGE_CLASSES,
  PORT_ROLES,
  RAY_DECISIONS,
  SEGMENT_TYPES,
  SOURCE_FORMATS,
  TOPOLOGY_HARD_RULES,
  UXML_PROFILES,
  UXML_REQUIRED_SECTIONS,
  UXML_SCHEMA_VERSION,
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  assertUxmlDocumentShape,
  createRayFaceModel,
  createRayGraph,
  createTopologyComparisonReport,
  createUniversalTopoGraph,
  createUxmlAnchor,
  createUxmlComponent,
  createUxmlDiagnostic,
  createUxmlDocument,
  createUxmlLoss,
  createUxmlPort,
  createUxmlReadinessReport,
  createUxmlSegment,
  createUxmlSupport,
} from '../uxml/UxmlTypes.js';

describe('UXML Agent 00 contracts', () => {
  it('exports the frozen UXML schema version', () => {
    expect(UXML_SCHEMA_VERSION).toBe('uxml-topology-v1');
  });

  it('defines required source and XML profiles', () => {
    expect(SOURCE_FORMATS.PCF).toBe('PCF');
    expect(SOURCE_FORMATS.INPUT_XML).toBe('INPUT_XML');
    expect(SOURCE_FORMATS.STANDARD_XML).toBe('STANDARD_XML');
    expect(SOURCE_FORMATS.UXML).toBe('UXML');

    expect(XML_PROFILES.INPUT_XML).toBe('INPUT_XML');
    expect(XML_PROFILES.STANDARD_XML).toBe('STANDARD_XML');
    expect(XML_PROFILES.UXML).toBe('UXML');
    expect(XML_PROFILES.UNKNOWN_XML).toBe('UNKNOWN_XML');
  });

  it('defines core topology role constants', () => {
    expect(COMPONENT_TYPES.PIPE).toBe('PIPE');
    expect(COMPONENT_TYPES.TEE).toBe('TEE');
    expect(COMPONENT_TYPES.OLET).toBe('OLET');
    expect(COMPONENT_TYPES.SUPPORT).toBe('SUPPORT');

    expect(ANCHOR_ROLES.EP1).toBe('EP1');
    expect(ANCHOR_ROLES.EP2).toBe('EP2');
    expect(ANCHOR_ROLES.CP).toBe('CP');
    expect(ANCHOR_ROLES.BP).toBe('BP');

    expect(PORT_ROLES.TEE_BRANCH).toBe('TEE_BRANCH');
    expect(PORT_ROLES.OLET_HEADER_TAP).toBe('OLET_HEADER_TAP');
    expect(PORT_ROLES.OLET_BRANCH).toBe('OLET_BRANCH');
  });

  it('defines segment, confidence, graph, and ray decision constants', () => {
    expect(SEGMENT_TYPES.PIPE_RUN).toBe('PIPE_RUN');
    expect(SEGMENT_TYPES.SUPPORT_ASSOCIATION).toBe('SUPPORT_ASSOCIATION');

    expect(CONFIDENCE_LEVELS.EXACT_SOURCE).toBe('EXACT_SOURCE');
    expect(CONFIDENCE_LEVELS.BBOX_DERIVED).toBe('BBOX_DERIVED');

    expect(GRAPH_EDGE_CLASSES.OLET_SEGMENT_TAP).toBe('OLET_SEGMENT_TAP');
    expect(GRAPH_EDGE_CLASSES.AMBIGUOUS).toBe('AMBIGUOUS');

    expect(RAY_DECISIONS.PROMOTE_RAY_SAFE).toBe('PROMOTE_RAY_SAFE');
    expect(RAY_DECISIONS.REJECT_RAY).toBe('REJECT_RAY');
  });

  it('defines default units and topology hard rules', () => {
    expect(DEFAULT_UNITS.coordinates).toBe('MM');
    expect(DEFAULT_UNITS.bore).toBe('MM');
    expect(DEFAULT_UNITS.weight).toBe('KG');

    expect(TOPOLOGY_HARD_RULES.SUPPORT_EXCLUDED_FROM_PIPE_CONTINUITY)
      .toBe('SUPPORT_EXCLUDED_FROM_PIPE_CONTINUITY');
    expect(TOPOLOGY_HARD_RULES.OLET_HEADER_TAP_CONNECTS_TO_SEGMENT)
      .toBe('OLET_HEADER_TAP_CONNECTS_TO_SEGMENT');
  });

  it('creates a full UXML document with all required sections', () => {
    const doc = createUxmlDocument();

    expect(doc.schemaVersion).toBe(UXML_SCHEMA_VERSION);
    expect(doc.profile).toBe(UXML_PROFILES.TOPOLOGY_FULL);

    for (const section of UXML_REQUIRED_SECTIONS) {
      expect(doc).toHaveProperty(section);
    }

    expect(assertUxmlDocumentShape(doc)).toEqual({
      ok: true,
      missing: [],
    });
  });

  it('detects missing UXML document sections', () => {
    const doc = createUxmlDocument();
    delete doc.anchors;
    delete doc.ports;

    const result = assertUxmlDocumentShape(doc);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['anchors', 'ports']);
  });

  it('creates stable component, anchor, port, segment and support shapes', () => {
    const component = createUxmlComponent({
      id: 'C-1',
      type: COMPONENT_TYPES.TEE,
      normalizedType: COMPONENT_TYPES.TEE,
      pipelineRef: '/P1',
      bore: 250,
      branchBore: 100,
    });

    const anchor = createUxmlAnchor({
      id: 'A-1',
      componentId: 'C-1',
      role: ANCHOR_ROLES.BP,
      point: { x: 1, y: 2, z: 3 },
      confidence: CONFIDENCE_LEVELS.EXACT_SOURCE,
    });

    const port = createUxmlPort({
      id: 'P-1',
      componentId: 'C-1',
      anchorId: 'A-1',
      role: PORT_ROLES.TEE_BRANCH,
    });

    const segment = createUxmlSegment({
      id: 'S-1',
      componentId: 'C-1',
      type: SEGMENT_TYPES.TEE_BRANCH_LEG,
    });

    const support = createUxmlSupport({
      id: 'SUP-1',
      componentId: 'C-2',
      type: 'GUIDE',
    });

    expect(component.anchorIds).toEqual([]);
    expect(component.diagnostics).toEqual([]);
    expect(anchor.point).toEqual({ x: 1, y: 2, z: 3 });
    expect(port.maxDegree).toBe(1);
    expect(segment.lengthUnit).toBe('MM');
    expect(support.hostCandidates).toEqual([]);
  });

  it('creates stable graph, ray, comparison and readiness report shapes', () => {
    const graph = createUniversalTopoGraph();
    const faceModel = createRayFaceModel();
    const rayGraph = createRayGraph();
    const comparison = createTopologyComparisonReport();
    const readiness = createUxmlReadinessReport();

    expect(graph.schema).toBe('universal-topo-graph/v1');
    expect(faceModel.schema).toBe('ray-face-model/v1');
    expect(rayGraph.schema).toBe('ray-graph/v1');
    expect(comparison.schema).toBe('topology-comparison-report/v1');
    expect(readiness.schema).toBe('uxml-readiness-report/v1');

    expect(graph.components).toEqual([]);
    expect(rayGraph.orphans).toEqual([]);
    expect(comparison.manualReviewItems).toEqual([]);
    expect(readiness.sections.masters).toBe(null);
  });

  it('creates diagnostic and loss shapes for downstream reporting', () => {
    const diagnostic = createUxmlDiagnostic({
      severity: 'ERROR',
      code: 'UXML-TEST-DIAG',
      message: 'Test diagnostic',
      componentId: 'C-1',
    });

    const loss = createUxmlLoss({
      severity: 'WARNING',
      code: 'UXML-TEST-LOSS',
      message: 'Test loss',
      componentId: 'C-1',
    });

    expect(diagnostic.severity).toBe('ERROR');
    expect(diagnostic.code).toBe('UXML-TEST-DIAG');
    expect(diagnostic.details).toEqual({});

    expect(loss.severity).toBe('WARNING');
    expect(loss.code).toBe('UXML-TEST-LOSS');
    expect(loss.details).toEqual({});
  });
});