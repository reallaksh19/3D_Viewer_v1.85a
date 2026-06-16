import { createAdapterGraph } from '../graph/createAdapterGraph.js';
import { makeComponent } from './componentFactory.js';
import { attachAnchor, attachPort, attachSegment } from './graphAttach.js';
import { fallbackPoint, readOrigin, readPoint } from './rowGeometry.js';

export function buildGraphFromRows(rows, options = {}) {
  const graph = createAdapterGraph({
    now: options.now,
    adapter: { importSessionId: options.importSessionId || '', idNamespace: options.idNamespace || 'CSV' },
  });
  rows.forEach((row, index) => addRow(graph, row, index));
  return graph;
}

function addRow(graph, row, index) {
  const component = makeComponent(row, index);
  graph.components.push(component);
  if (component.type === 'SUPPORT') attachSupport(graph, component, row, index);
  else if (component.type === 'ELBOW') attachCurve(graph, component, row, index);
  else if (component.type === 'TEE') attachTee(graph, component, row, index);
  else attachLinear(graph, component, row, index);
}

function attachLinear(graph, component, row, index) {
  const ep1 = readPoint(row, '1') || readOrigin(row) || fallbackPoint(index);
  const ep2 = readPoint(row, '2') || { x: ep1.x + 100, y: ep1.y, z: ep1.z };
  const a1 = attachAnchor(graph, component, 'EP1', ep1);
  const a2 = attachAnchor(graph, component, 'EP2', ep2);
  attachPort(graph, component, `${component.type}_END_1`, a1.id);
  attachPort(graph, component, `${component.type}_END_2`, a2.id);
  attachSegment(graph, component, `${component.type}_AXIS`, a1.id, a2.id);
}

function attachCurve(graph, component, row, index) {
  const ep1 = readPoint(row, '1') || fallbackPoint(index);
  const cp = readPoint(row, 'c') || { x: ep1.x + 50, y: ep1.y + 50, z: ep1.z };
  const ep2 = readPoint(row, '2') || { x: ep1.x + 100, y: ep1.y + 100, z: ep1.z };
  const a1 = attachAnchor(graph, component, 'EP1', ep1);
  attachAnchor(graph, component, 'CP', cp);
  const a2 = attachAnchor(graph, component, 'EP2', ep2);
  attachPort(graph, component, 'ELBOW_END_1', a1.id);
  attachPort(graph, component, 'ELBOW_END_2', a2.id);
  attachSegment(graph, component, 'BEND_CHORD', a1.id, a2.id);
}

function attachTee(graph, component, row, index) {
  const ep1 = readPoint(row, '1') || fallbackPoint(index);
  const ep2 = readPoint(row, '2') || { x: ep1.x + 100, y: ep1.y, z: ep1.z };
  const bp = readPoint(row, 'b') || { x: ep1.x + 50, y: ep1.y + 100, z: ep1.z };
  const a1 = attachAnchor(graph, component, 'EP1', ep1);
  const a2 = attachAnchor(graph, component, 'EP2', ep2);
  const ab = attachAnchor(graph, component, 'BP', bp);
  attachPort(graph, component, 'TEE_RUN_IN', a1.id);
  attachPort(graph, component, 'TEE_RUN_OUT', a2.id);
  attachPort(graph, component, 'TEE_BRANCH_OUT', ab.id);
  attachSegment(graph, component, 'TEE_MAIN_RUN', a1.id, a2.id);
}

function attachSupport(graph, component, row, index) {
  const origin = readOrigin(row) || readPoint(row, '1') || fallbackPoint(index);
  const anchor = attachAnchor(graph, component, 'SUPPORT_POINT', origin);
  const support = {
    id: `${component.id}:SUPPORT`,
    componentId: component.id,
    supportAnchorId: anchor.id,
    supportKind: component.normalized.supportKind || 'SUPPORT',
    hostCandidates: [],
    restraint: {},
    diagnostics: [],
  };
  graph.supports.push(support);
  component.supportId = support.id;
  attachPort(graph, component, 'SUPPORT_POINT', anchor.id);
  attachSegment(graph, component, 'SUPPORT_ASSOCIATION', anchor.id, '');
}
