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
  createUxmlUniversalTopoGraph,
} from '../uxml/UxmlUniversalTopoGraphBuilder.js';

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
    bore: 250,
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
    bore: 250,
  }));

  return component;
}

function addValve(doc, id, ep1, ep2, pipelineRef = '/P1') {
  const component = createUxmlComponent({
    id,
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.VALVE,
    normalizedType: COMPONENT_TYPES.VALVE,
    pipelineRef,
    bore: 250,
  });

  addAnchorPort(doc, component, ANCHOR_ROLES.EP1, ep1, PORT_ROLES.VALVE_END_1);
  addAnchorPort(doc, component, ANCHOR_ROLES.EP2, ep2, PORT_ROLES.VALVE_END_2);

  component.segmentIds.push(`S-${id}`);

  doc.components.push(component);
  doc.segments.push(createUxmlSegment({
    id: `S-${id}`,
    componentId: id,
    type: SEGMENT_TYPES.VALVE_AXIS,
    startAnchorId: `A-${id}-${ANCHOR_ROLES.EP1}`,
    endAnchorId: `A-${id}-${ANCHOR_ROLES.EP2}`,
    bore: 250,
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
  addAnchorPort(doc, component, ANCHOR_ROLES.CP, cp, 'TEE_CENTER');
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

function baseDoc() {
  const doc = createUxmlDocument();
  addSource(doc);
  return doc;
}

describe('UxmlUniversalTopoGraphBuilder Agent 05', () => {
  it('blocks non-object input', () => {
    const graph = buildUxmlUniversalTopoGraph(null);

    expect(graph.ok).toBe(false);
    expect(graph.blocked).toBe(true);
    expect(graph.diagnostics.some(d => d.code === 'UXML-UTG-DOCUMENT-NOT-OBJECT')).toBe(true);
  });

  it('builds nodes, ports and edge for exact pipe-valve connection', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));
    addValve(doc, 'C-VALVE-1', p(1000, 0, 0), p(1200, 0, 0));
    addPipe(doc, 'C-PIPE-2', p(1200, 0, 0), p(2000, 0, 0));

    const graph = buildUxmlUniversalTopoGraph(doc);

    expect(graph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(graph.summary.componentCount).toBe(3);
    expect(graph.summary.portCount).toBe(6);
    expect(graph.summary.edgeCount).toBe(2);
    expect(graph.edges.every(e => e.edgeClass === 'EXACT_CONNECTION')).toBe(true);
  });

  it('groups endpoint faces within tolerance into one node and creates tolerance edge', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));
    addValve(doc, 'C-VALVE-1', p(1004, 0, 0), p(1200, 0, 0));

    const graph = buildUxmlUniversalTopoGraph(doc, {
      connectToleranceMm: 6,
    });

    expect(graph.summary.edgeCount).toBe(1);
    expect(graph.edges[0].edgeClass).toBe('WITHIN_CONNECT_TOLERANCE');
    expect(graph.edges[0].distanceMm).toBe(4);
  });

  it('does not connect different pipelineRef faces', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0), '/P1');
    addValve(doc, 'C-VALVE-1', p(1000, 0, 0), p(1200, 0, 0), '/P2');

    const graph = buildUxmlUniversalTopoGraph(doc);

    expect(graph.summary.edgeCount).toBe(0);
    expect(graph.disconnected.length).toBeGreaterThan(0);
  });

  it('reports disconnected required pipe endpoint', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));

    const graph = buildUxmlUniversalTopoGraph(doc);

    expect(graph.ok).toBe(false);
    expect(graph.summary.disconnectedRequiredPortCount).toBe(2);
    expect(graph.diagnostics.some(d => d.code.includes('DISCONNECTED'))).toBe(true);
  });

  it('does not require OLET_HEADER_TAP endpoint match but requires OLET_BRANCH', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-HEADER', p(0, 0, 0), p(1000, 0, 0));
    addOlet(doc, 'C-OLET-1', p(500, 0, 0), p(500, 200, 0));
    addPipe(doc, 'C-BRANCH', p(500, 200, 0), p(500, 800, 0));

    const graph = buildUxmlUniversalTopoGraph(doc);

    const oletHeaderPort = graph.ports.find(port => port.role === 'OLET_HEADER_TAP');
    const oletBranchPort = graph.ports.find(port => port.role === 'OLET_BRANCH');

    expect(oletHeaderPort).toBeUndefined();
    expect(oletBranchPort).toBeTruthy();
    expect(graph.edges.some(edge =>
      [edge.sourcePortId, edge.targetPortId].includes(oletBranchPort.id)
    )).toBe(true);
  });

  it('connects TEE_BRANCH to branch pipe endpoint', () => {
    const doc = baseDoc();

    addTee(doc, 'C-TEE-1', p(0, 0, 0), p(1000, 0, 0), p(500, 0, 0), p(500, 200, 0));
    addPipe(doc, 'C-BRANCH', p(500, 200, 0), p(500, 800, 0));

    const graph = buildUxmlUniversalTopoGraph(doc);

    const teeBranchPort = graph.ports.find(port => port.role === 'TEE_BRANCH');

    expect(teeBranchPort).toBeTruthy();
    expect(graph.edges.some(edge =>
      [edge.sourcePortId, edge.targetPortId].includes(teeBranchPort.id)
    )).toBe(true);
  });

  it('does not create support continuity edges', () => {
    const doc = baseDoc();

    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));

    const component = createUxmlComponent({
      id: 'C-SUP-1',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.SUPPORT,
      normalizedType: COMPONENT_TYPES.SUPPORT,
      pipelineRef: '/P1',
      supportId: 'SUP-1',
    });

    addAnchorPort(doc, component, ANCHOR_ROLES.SUPPORT_POINT, p(500, 0, 0), PORT_ROLES.SUPPORT_POINT, {
      connectsTo: 'SEGMENT',
    });

    doc.components.push(component);
    doc.supports.push(createUxmlSupport({
      id: 'SUP-1',
      componentId: 'C-SUP-1',
      type: 'GUIDE',
      supportAnchorId: `A-C-SUP-1-${ANCHOR_ROLES.SUPPORT_POINT}`,
    }));

    const graph = buildUxmlUniversalTopoGraph(doc);

    expect(graph.summary.supportAssociationPortCount).toBe(0);
    expect(graph.summary.supportContinuityEdgeCount).toBe(0);
    expect(graph.edges.some(edge => edge.sourceComponentId === 'C-SUP-1' || edge.targetComponentId === 'C-SUP-1')).toBe(false);
  });

  it('provides createUxmlUniversalTopoGraph alias', () => {
    const doc = baseDoc();
    addPipe(doc, 'C-PIPE-1', p(0, 0, 0), p(1000, 0, 0));

    const graph = createUxmlUniversalTopoGraph(doc);

    expect(graph.schema).toBe('uxml-universal-topo-graph/v1');
  });
});