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
  buildUxmlFaceModel,
  createUxmlFaceModel,
} from '../uxml/UxmlFaceModelBuilder.js';

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

function pipeDoc() {
  const doc = createUxmlDocument();
  addSource(doc);

  const component = createUxmlComponent({
    id: 'C-PIPE-1',
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.PIPE,
    normalizedType: COMPONENT_TYPES.PIPE,
    pipelineRef: '/P1',
    bore: 250,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, p(0, 0, 0), PORT_ROLES.PIPE_END_1, {
    fixed: false,
    futureMovable: true,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, p(1000, 0, 0), PORT_ROLES.PIPE_END_2, {
    fixed: false,
    futureMovable: true,
  });

  component.segmentIds.push('S-PIPE-1');
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: 'S-PIPE-1',
    componentId: component.id,
    type: SEGMENT_TYPES.PIPE_RUN,
    startAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP2}`,
    bore: 250,
  }));

  return doc;
}

function teeDoc({ withCp = true } = {}) {
  const doc = createUxmlDocument();
  addSource(doc);

  const component = createUxmlComponent({
    id: withCp ? 'C-TEE-CP' : 'C-TEE-MID',
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.TEE,
    normalizedType: COMPONENT_TYPES.TEE,
    pipelineRef: '/P1',
    bore: 250,
    branchBore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, p(0, 0, 0), PORT_ROLES.TEE_MAIN_1);
  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, p(1000, 0, 0), PORT_ROLES.TEE_MAIN_2);

  if (withCp) {
    addAnchorPort(doc, component, ANCHOR_ROLES.CP, p(500, 0, 0), 'TEE_CENTER');
  }

  addAnchorPort(doc, component, ANCHOR_ROLES.BP, p(500, 200, 0), PORT_ROLES.TEE_BRANCH);

  component.segmentIds.push('S-TEE-1');
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: 'S-TEE-1',
    componentId: component.id,
    type: SEGMENT_TYPES.TEE_MAIN_RUN,
    startAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP2}`,
    bore: 250,
  }));

  return doc;
}

function oletDoc({ missingCp = false } = {}) {
  const doc = createUxmlDocument();
  addSource(doc);

  const component = createUxmlComponent({
    id: missingCp ? 'C-OLET-NO-CP' : 'C-OLET-1',
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.OLET,
    normalizedType: COMPONENT_TYPES.OLET,
    pipelineRef: '/P1',
    bore: 250,
    branchBore: 100,
  });

  if (!missingCp) {
    addAnchorPort(doc, component, ANCHOR_ROLES.CP, p(500, 0, 0), PORT_ROLES.OLET_HEADER_TAP, {
      connectsTo: 'SEGMENT',
    });
  }

  addAnchorPort(doc, component, ANCHOR_ROLES.BP, p(500, 250, 0), PORT_ROLES.OLET_BRANCH, {
    connectsTo: 'ENDPOINT',
  });

  doc.components.push(component);
  return doc;
}

function inlineComponentDoc(type, port1, port2, segmentType = SEGMENT_TYPES.VALVE_AXIS) {
  const doc = createUxmlDocument();
  addSource(doc);

  const component = createUxmlComponent({
    id: `C-${type}`,
    sourceRefs: ['SRC-1'],
    type,
    normalizedType: type,
    pipelineRef: '/P1',
    bore: 100,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, p(0, 0, 0), port1);
  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, p(100, 0, 0), port2);

  component.segmentIds.push('S-INLINE-1');
  doc.components.push(component);

  doc.segments.push(createUxmlSegment({
    id: 'S-INLINE-1',
    componentId: component.id,
    type: segmentType,
    startAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${component.id}-${ANCHOR_ROLES.EP2}`,
    bore: 100,
  }));

  return doc;
}

function supportDoc() {
  const doc = createUxmlDocument();
  addSource(doc);

  const component = createUxmlComponent({
    id: 'C-SUP-1',
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.SUPPORT,
    normalizedType: COMPONENT_TYPES.SUPPORT,
    pipelineRef: '/P1',
    anchorIds: [],
    portIds: [],
    supportId: 'SUP-1',
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.SUPPORT_POINT, p(500, -100, 0), PORT_ROLES.SUPPORT_POINT, {
    connectsTo: 'SEGMENT',
  });

  doc.components.push(component);

  doc.supports.push(createUxmlSupport({
    id: 'SUP-1',
    componentId: component.id,
    type: 'GUIDE',
    supportAnchorId: `A-${component.id}-${ANCHOR_ROLES.SUPPORT_POINT}`,
  }));

  return doc;
}

describe('UxmlFaceModelBuilder Agent 04', () => {
  it('blocks non-object UXML input', () => {
    const model = buildUxmlFaceModel(null);

    expect(model.ok).toBe(false);
    expect(model.blocked).toBe(true);
    expect(model.diagnostics.some(d => d.code === 'UXML-FACE-DOCUMENT-NOT-OBJECT')).toBe(true);
  });

  it('builds PIPE endpoint faces and axis vector', () => {
    const model = buildUxmlFaceModel(pipeDoc());

    expect(model.ok).toBe(true);
    expect(model.blocked).toBe(false);
    expect(model.summary.componentCount).toBe(1);
    expect(model.summary.faceCount).toBe(2);
    expect(model.summary.pipeFaceCount).toBe(2);

    const component = model.components[0];

    expect(component.type).toBe(COMPONENT_TYPES.PIPE);
    expect(component.axisVector).toEqual({ x: 1, y: 0, z: 0 });
    expect(component.axisVectorConfidence).toBe('HIGH');
    expect(component.axisVectorMethod).toBe('EP2_MINUS_EP1');
    expect(component.faces.map(face => face.role)).toEqual(['PIPE_END_1', 'PIPE_END_2']);
    expect(component.faces.every(face => face.futureMovable === true)).toBe(true);
  });

  it('builds TEE faces and HIGH confidence branch vector from BP minus CP', () => {
    const model = buildUxmlFaceModel(teeDoc({ withCp: true }));

    expect(model.ok).toBe(true);
    expect(model.summary.teeBranchFaceCount).toBe(1);

    const component = model.components[0];

    expect(component.faces.map(face => face.role)).toContain('TEE_MAIN_1');
    expect(component.faces.map(face => face.role)).toContain('TEE_MAIN_2');
    expect(component.faces.map(face => face.role)).toContain('TEE_BRANCH');
    expect(component.branchVector).toEqual({ x: 0, y: 1, z: 0 });
    expect(component.branchVectorConfidence).toBe('HIGH');
    expect(component.branchVectorMethod).toBe('TEE_BP_MINUS_CP');
    expect(model.summary.highConfidenceBranchVectorCount).toBe(1);
  });

  it('builds TEE MEDIUM confidence branch vector from BP minus main midpoint fallback', () => {
    const model = buildUxmlFaceModel(teeDoc({ withCp: false }));

    expect(model.ok).toBe(true);

    const component = model.components[0];

    expect(component.branchVector).toEqual({ x: 0, y: 1, z: 0 });
    expect(component.branchVectorConfidence).toBe('MEDIUM');
    expect(component.branchVectorMethod).toBe('TEE_BP_MINUS_MAIN_MIDPOINT');
    expect(model.summary.mediumConfidenceBranchVectorCount).toBe(1);
  });

  it('builds OLET header/branch faces and HIGH confidence branch vector', () => {
    const model = buildUxmlFaceModel(oletDoc());

    expect(model.ok).toBe(true);
    expect(model.summary.oletHeaderFaceCount).toBe(1);
    expect(model.summary.oletBranchFaceCount).toBe(1);

    const component = model.components[0];

    expect(component.faces.map(face => face.role)).toContain('OLET_HEADER_TAP');
    expect(component.faces.map(face => face.role)).toContain('OLET_BRANCH');
    expect(component.faces.find(face => face.role === 'OLET_HEADER_TAP').connectsTo).toBe('SEGMENT');
    expect(component.faces.find(face => face.role === 'OLET_BRANCH').connectsTo).toBe('ENDPOINT');
    expect(component.branchVector).toEqual({ x: 0, y: 1, z: 0 });
    expect(component.branchVectorConfidence).toBe('HIGH');
    expect(component.branchVectorMethod).toBe('OLET_BP_MINUS_CP');
  });

  it('blocks invalid OLET by validation unless allowPartial is true', () => {
    const model = buildUxmlFaceModel(oletDoc({ missingCp: true }));

    expect(model.ok).toBe(false);
    expect(model.blocked).toBe(true);
    expect(model.diagnostics.some(d => d.code === 'UXML-FACE-VALIDATION-BLOCKED')).toBe(true);
  });

  it('builds partial OLET face model with diagnostic when allowPartial is true', () => {
    const model = buildUxmlFaceModel(oletDoc({ missingCp: true }), {
      allowPartial: true,
    });

    expect(model.ok).toBe(true);
    expect(model.blocked).toBe(false);
    expect(model.summary.oletBranchFaceCount).toBe(1);

    const component = model.components[0];

    expect(component.branchVector).toBe(null);
    expect(component.branchVectorMethod).toBe('OLET_CP_MISSING');
    expect(model.diagnostics.some(d => d.code === 'UXML-FACE-VALIDATION-PARTIAL')).toBe(true);
    expect(model.diagnostics.some(d => d.code === 'UXML-FACE-OLET-FACE-INCOMPLETE')).toBe(true);
  });

  it('builds inline VALVE endpoint faces and axis vector', () => {
    const model = buildUxmlFaceModel(
      inlineComponentDoc(COMPONENT_TYPES.VALVE, PORT_ROLES.VALVE_END_1, PORT_ROLES.VALVE_END_2)
    );

    expect(model.ok).toBe(true);

    const component = model.components[0];

    expect(component.type).toBe(COMPONENT_TYPES.VALVE);
    expect(component.faces.length).toBe(2);
    expect(component.faces.map(face => face.role)).toEqual(['VALVE_END_1', 'VALVE_END_2']);
    expect(component.axisVector).toEqual({ x: 1, y: 0, z: 0 });
    expect(component.faces.every(face => face.fixed === true)).toBe(true);
  });

  it('builds inline REDUCER endpoint faces', () => {
    const model = buildUxmlFaceModel(
      inlineComponentDoc(
        COMPONENT_TYPES.REDUCER_CONCENTRIC,
        PORT_ROLES.REDUCER_END_1,
        PORT_ROLES.REDUCER_END_2,
        SEGMENT_TYPES.REDUCER_AXIS
      )
    );

    expect(model.ok).toBe(true);

    const component = model.components[0];

    expect(component.type).toBe(COMPONENT_TYPES.REDUCER_CONCENTRIC);
    expect(component.faces.length).toBe(2);
    expect(component.axisVector).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('builds SUPPORT association face only and no inline continuity face', () => {
    const model = buildUxmlFaceModel(supportDoc());

    expect(model.ok).toBe(true);
    expect(model.summary.supportAssociationFaceCount).toBe(1);
    expect(model.summary.supportInlineFaceCount).toBe(0);

    const component = model.components[0];

    expect(component.type).toBe(COMPONENT_TYPES.SUPPORT);
    expect(component.supportAssociationOnly).toBe(true);
    expect(component.faces.length).toBe(1);
    expect(component.faces[0].faceKind).toBe('SUPPORT_ASSOCIATION');
    expect(component.faces[0].connectsTo).toBe('SEGMENT');
  });

  it('supports skipValidation option for already trusted UXML', () => {
    const model = buildUxmlFaceModel(pipeDoc(), {
      skipValidation: true,
    });

    expect(model.ok).toBe(true);
    expect(model.source.validationGateRun).toBe(false);
    expect(model.source.validation).toBeUndefined();
    expect(model.summary.faceCount).toBe(2);
  });

  it('provides createUxmlFaceModel alias', () => {
    const model = createUxmlFaceModel(pipeDoc());

    expect(model.ok).toBe(true);
    expect(model.schema).toBe('uxml-face-model/v1');
  });
});