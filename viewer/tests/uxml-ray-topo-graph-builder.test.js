import { describe, expect, it } from 'vitest';

import {
  ANCHOR_ROLES,
  COMPONENT_TYPES,
  PORT_ROLES,
  SEGMENT_TYPES,
} from '../uxml/UxmlConstants.js';

import {
  createUxmlAnchor,
  createUxmlComponent,
  createUxmlDocument,
  createUxmlPort,
  createUxmlSegment,
  createUxmlSource,
  createUxmlSupport,
} from '../uxml/UxmlTypes.js';

import {
  buildUxmlUniversalTopoGraph,
} from '../uxml/UxmlUniversalTopoGraphBuilder.js';

import {
  buildUxmlRayTopoGraph,
  createUxmlRayTopoGraph,
} from '../uxml/UxmlRayTopoGraphBuilder.js';

function p(x, y, z) {
  return { x, y, z };
}

function addSource(doc) {
  doc.sources.push(createUxmlSource({
    id: 'SRC-1',
    format: 'STANDARD_XML',
    name: 'standard.xml',
  }));
}

function addAnchorPort(doc, component, role, point, portRole, extraPort = {}) {
  const anchorId = `A-${component.id}-${role}`;
  const portId = `P-${component.id}-${portRole}`;

  doc.anchors.push(createUxmlAnchor({
    id: anchorId,
    componentId: component.id,
    role,
    point,
    confidence: 'EXACT_SOURCE',
  }));

  doc.ports.push(createUxmlPort({
    id: portId,
    componentId: component.id,
    anchorId,
    role: portRole,
    point,
    bore: component.bore,
    branchBore: component.branchBore,
    ...extraPort,
  }));

  component.anchorIds.push(anchorId);
  component.portIds.push(portId);

  return { anchorId, portId };
}

function addPipe(doc, id, ep1, ep2, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.PIPE,
    normalizedType: COMPONENT_TYPES.PIPE,
    pipelineRef,
    bore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, ep1, PORT_ROLES.PIPE_END_1, {
    fixed: false,
    futureMovable: true,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, ep2, PORT_ROLES.PIPE_END_2, {
    fixed: false,
    futureMovable: true,
  });

  component.segmentIds.push(`S-${id}`);
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: `S-${id}`,
    componentId: id,
    type: SEGMENT_TYPES.PIPE_RUN,
    startAnchorId: `A-${id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${id}-${ANCHOR_ROLES.EP2}`,
    bore: 100,
  }));

  return component;
}

function addFlange(doc, id, ep1, ep2, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.FLANGE,
    normalizedType: COMPONENT_TYPES.FLANGE,
    pipelineRef,
    bore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, ep1, PORT_ROLES.FLANGE_END_1);
  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, ep2, PORT_ROLES.FLANGE_END_2);

  component.segmentIds.push(`S-${id}`);
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: `S-${id}`,
    componentId: id,
    type: SEGMENT_TYPES.FLANGE_AXIS,
    startAnchorId: `A-${id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${id}-${ANCHOR_ROLES.EP2}`,
    bore: 100,
  }));

  return component;
}

function addOlet(doc, id, cp, bp, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.OLET,
    normalizedType: COMPONENT_TYPES.OLET,
    pipelineRef,
    bore: 250,
    branchBore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.CP, cp, PORT_ROLES.OLET_HEADER_TAP, {
    connectsTo: 'SEGMENT',
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.BP, bp, PORT_ROLES.OLET_BRANCH, {
    connectsTo: 'ENDPOINT',
  });

  doc.components.push(component);
  return component;
}

function addTee(doc, id, ep1, ep2, cp, bp, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.TEE,
    normalizedType: COMPONENT_TYPES.TEE,
    pipelineRef,
    bore: 250,
    branchBore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, ep1, PORT_ROLES.TEE_MAIN_1);
  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, ep2, PORT_ROLES.TEE_MAIN_2);

  if (cp) {
    addAnchorPort(doc, component, ANCHOR_ROLES.CP, cp, 'TEE_CENTER');
  }

  addAnchorPort(doc, component, ANCHOR_ROLES.BP, bp, PORT_ROLES.TEE_BRANCH);

  component.segmentIds.push(`S-${id}`);
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: `S-${id}`,
    componentId: id,
    type: SEGMENT_TYPES.TEE_MAIN_RUN,
    startAnchorId: `A-${id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${id}-${ANCHOR_ROLES.EP2}`,
    bore: 250,
  }));

  return component;
}

function addSupport(doc, id, point, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.SUPPORT,
    normalizedType: COMPONENT_TYPES.SUPPORT,
    pipelineRef,
    supportId: `SUP-${id}`,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.SUPPORT_POINT, point, PORT_ROLES.SUPPORT_POINT, {
    connectsTo: 'SEGMENT',
  });

  doc.components.push(component);
  doc.supports.push(createUxmlSupport({
    id: `SUP-${id}`,
    componentId: id,
    type: 'GUIDE',
    supportAnchorId: `A-${id}-${ANCHOR_ROLES.SUPPORT_POINT}`,
  }));

  return component;
}

function baseDoc() {
  const doc = createUxmlDocument();
  addSource(doc);
  return doc;
}

describe('UxmlRayTopoGraphBuilder Agent 06 — legacy-inspired', () => {
  it('blocks when no UXML or faceModel is provided', () => {
    const graph = buildUxmlRayTopoGraph(null);

    expect(graph.ok).toBe(false);
    expect(graph.blocked).toBe(true);
    expect(graph.diagnostics.some(d => d.code === 'UXML-RTG-NO-INPUT')).toBe(true);
  });

  it('creates P0 face proximity candidate within 6mm without mutation', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));
    addFlange(doc, 'C-FLG-1', p(1004, 0, 0), p(1100, 0, 0));

    const graph = buildUxmlRayTopoGraph(doc, {
      pass0MaxGapMm: 6,
    });

    expect(graph.summary.faceSnapCandidateCount).toBeGreaterThan(0);

    const snap = graph.faceSnapCandidates.find(c =>
      c.sourceComponentId === 'C-PIPE-1' &&
      c.targetComponentId === 'C-FLG-1'
    );

    expect(snap).toBeTruthy();
    expect(snap.pass).toBe('P0-FACE-PROXIMITY');
    expect(snap.distanceAlongRayMm).toBe(4);
    expect(snap.recommendedAction).toBe('SNAP_FACE_PROXIMITY_CANDIDATE_NO_MUTATION');
  });

  it('does not create P0 face proximity candidate beyond 6mm', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));
    addFlange(doc, 'C-FLG-1', p(1008, 0, 0), p(1100, 0, 0));

    const graph = buildUxmlRayTopoGraph(doc, {
      pass0MaxGapMm: 6,
    });

    expect(graph.faceSnapCandidates.some(c =>
      c.sourceComponentId === 'C-PIPE-1' &&
      c.targetComponentId === 'C-FLG-1'
    )).toBe(false);
  });

  it('creates OLET branch-source ray candidate to pipe endpoint', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-HEADER', p(0, 0, 0), p(1000, 0, 0));
    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0));

    const universalGraph = buildUxmlUniversalTopoGraph(doc);

    const graph = buildUxmlRayTopoGraph(doc, {
      universalGraph,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
    });

    const candidate = graph.rayCandidates.find(c =>
      c.pass === 'P2-BRANCH-SOURCE' &&
      c.sourceComponentId === 'C-OLET-1' &&
      c.targetComponentId === 'C-BRANCH'
    );

    expect(candidate).toBeTruthy();
    expect(candidate.method).toBe('OLET_BP_MINUS_CP');
    expect(candidate.confidence).toBe('HIGH');
    expect(candidate.distanceAlongRayMm).toBe(150);
    expect(candidate.perpendicularMissMm).toBe(0);
    expect(candidate.safe).toBe(true);
  });

  it('creates TEE high-confidence branch-source ray candidate', () => {
    const doc = baseDoc();

    addTee(doc, 'C-TEE-1', p(0, 0, 0), p(1000, 0, 0), p(500, 0, 0), p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0));

    const universalGraph = buildUxmlUniversalTopoGraph(doc);
    const graph = buildUxmlRayTopoGraph(doc, { universalGraph });

    const candidate = graph.rayCandidates.find(c =>
      c.pass === 'P2-BRANCH-SOURCE' &&
      c.sourceComponentId === 'C-TEE-1' &&
      c.targetComponentId === 'C-BRANCH'
    );

    expect(candidate).toBeTruthy();
    expect(candidate.method).toBe('TEE_BP_MINUS_CP');
    expect(candidate.confidence).toBe('HIGH');
  });

  it('creates TEE medium-confidence midpoint fallback ray candidate', () => {
    const doc = baseDoc();

    addTee(doc, 'C-TEE-1', p(0, 0, 0), p(1000, 0, 0), null, p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0));

    const universalGraph = buildUxmlUniversalTopoGraph(doc);
    const graph = buildUxmlRayTopoGraph(doc, { universalGraph });

    const candidate = graph.rayCandidates.find(c =>
      c.pass === 'P2-BRANCH-SOURCE' &&
      c.sourceComponentId === 'C-TEE-1' &&
      c.targetComponentId === 'C-BRANCH'
    );

    expect(candidate).toBeTruthy();
    expect(candidate.method).toBe('TEE_BP_MINUS_MAIN_MIDPOINT');
    expect(candidate.confidence).toBe('MEDIUM');
    expect(candidate.safe).toBe(true);
  });

  it('blocks medium-confidence branch-source ray when allowMediumConfidenceRay is false', () => {
    const doc = baseDoc();

    addTee(doc, 'C-TEE-1', p(0, 0, 0), p(1000, 0, 0), null, p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0));

    const universalGraph = buildUxmlUniversalTopoGraph(doc);
    const graph = buildUxmlRayTopoGraph(doc, {
      universalGraph,
      allowMediumConfidenceRay: false,
    });

    const candidate = graph.rayCandidates.find(c =>
      c.sourceComponentId === 'C-TEE-1' &&
      c.targetComponentId === 'C-BRANCH'
    );

    expect(candidate).toBeTruthy();
    expect(candidate.safe).toBe(false);
    expect(candidate.blockers).toContain('RAY_CONFIDENCE_NOT_ALLOWED');
  });

  it('creates branch-target candidate from orphan fitting endpoint to OLET_BRANCH', () => {
    const doc = baseDoc();

    addFlange(doc, 'C-FLG-1', p(500, 600, 0), p(500, 250, 0));
    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0));

    const universalGraph = buildUxmlUniversalTopoGraph(doc);
    const graph = buildUxmlRayTopoGraph(doc, {
      universalGraph,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialFaceModel: true,
    });

    const candidate = graph.rayCandidates.find(c =>
      c.pass === 'P2-BRANCH-TARGET' &&
      c.sourceComponentId === 'C-FLG-1' &&
      c.targetComponentId === 'C-OLET-1'
    );

    expect(candidate).toBeTruthy();
    expect(candidate.targetRole).toBe('OLET_BRANCH');
    expect(candidate.safe).toBe(false);
    expect(candidate.blockers).toContain('TARGET_NOT_PIPE_ENDPOINT');
    expect(candidate.recommendedAction).toBe('MANUAL_REVIEW_OR_BRIDGE_PIPE_CANDIDATE');
  });

  it('rejects cross-pipeline targets', () => {
    const doc = baseDoc();

    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0), '/P1');
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0), '/P2');

    const graph = buildUxmlRayTopoGraph(doc, {
      allowPartialFaceModel: true,
    });

    expect(graph.rayCandidates.some(c => c.targetComponentId === 'C-BRANCH')).toBe(false);
  });

  it('does not accept targets beyond max ray length', () => {
    const doc = baseDoc();

    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 800, 0), p(500, 900, 0));

    const graph = buildUxmlRayTopoGraph(doc, {
      maxRayLengthMm: 500,
      allowPartialFaceModel: true,
    });

    expect(graph.rayCandidates.some(c => c.targetComponentId === 'C-BRANCH')).toBe(false);
  });

  it('does not use support face as ray target', () => {
    const doc = baseDoc();

    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0));
    addSupport(doc, 'C-SUP-1', p(500, 250, 0));

    const graph = buildUxmlRayTopoGraph(doc, {
      allowPartialFaceModel: true,
    });

    expect(graph.rayCandidates.some(c => c.targetComponentId === 'C-SUP-1')).toBe(false);
  });

  it('uses global axis fallback only as manual-review evidence', () => {
    const doc = baseDoc();

    const component = createUxmlComponent({
      id: 'C-FLG-ZERO',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.FLANGE,
      normalizedType: COMPONENT_TYPES.FLANGE,
      pipelineRef: '/P1',
      bore: 100,
    });

    addAnchorPort(doc, component, ANCHOR_ROLES.EP1, p(0, 0, 0), PORT_ROLES.FLANGE_END_1);
    addAnchorPort(doc, component, ANCHOR_ROLES.EP2, p(0, 0, 0), PORT_ROLES.FLANGE_END_2);
    component.segmentIds.push('S-FLG-ZERO');
    doc.components.push(component);

    doc.segments.push(createUxmlSegment({
      id: 'S-FLG-ZERO',
      componentId: component.id,
      type: SEGMENT_TYPES.FLANGE_AXIS,
      startAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP1}`,
      endAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP2}`,
      bore: 100,
    }));

    addPipe(doc, 'C-PIPE-1', p(200, 0, 0), p(1000, 0, 0));

    const graph = buildUxmlRayTopoGraph(doc, {
      allowPartialFaceModel: true,
      allowGlobalAxisFallback: true,
    });

    const fallbackCandidate = graph.rayCandidates.find(c => c.method === 'GLOBAL_AXIS_FALLBACK');

    expect(fallbackCandidate).toBeTruthy();
    expect(fallbackCandidate.safe).toBe(false);
    expect(fallbackCandidate.blockers).toContain('GLOBAL_AXIS_FALLBACK_REQUIRES_REVIEW');
  });

  it('provides createUxmlRayTopoGraph alias', () => {
    const doc = baseDoc();

    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 100, 0));
    addPipe(doc, 'C-BRANCH', p(500, 250, 0), p(500, 900, 0));

    const graph = createUxmlRayTopoGraph(doc, {
      allowPartialFaceModel: true,
    });

    expect(graph.schema).toBe('uxml-ray-topo-graph/v2');
  });
});