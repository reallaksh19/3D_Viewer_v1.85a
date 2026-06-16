export function rebuildUxmlTopology(graph) {
  graph.ports = [];
  graph.segments = [];
  graph.supports = [];
  for (const component of graph.components) {
    component.portIds = [];
    component.segmentIds = [];
    component.supportId = '';
    if (component.type === 'SUPPORT') addSupport(graph, component);
    else if (['TEE', 'OLET', 'WELDOLET', 'SOCKOLET'].includes(component.type)) addTee(graph, component);
    else if (['ELBOW', 'BEND', 'ARC'].includes(component.type)) addCurve(graph, component);
    else addLinear(graph, component);
  }
  return graph;
}

function addLinear(graph, component) {
  const ep1 = anchorByRole(graph, component, ['EP1']);
  const ep2 = anchorByRole(graph, component, ['EP2']);
  if (!ep1 || !ep2) return;
  addPort(graph, component, `${component.type}_END_1`, ep1.id);
  addPort(graph, component, `${component.type}_END_2`, ep2.id);
  addSegment(graph, component, `${component.type}_AXIS`, ep1.id, ep2.id);
}

function addCurve(graph, component) {
  const ep1 = anchorByRole(graph, component, ['EP1']);
  const ep2 = anchorByRole(graph, component, ['EP2']);
  if (!ep1 || !ep2) return;
  addPort(graph, component, 'ELBOW_END_1', ep1.id);
  addPort(graph, component, 'ELBOW_END_2', ep2.id);
  addSegment(graph, component, 'BEND_CHORD', ep1.id, ep2.id);
}

function addTee(graph, component) {
  const ep1 = anchorByRole(graph, component, ['EP1']);
  const ep2 = anchorByRole(graph, component, ['EP2']);
  const bp = anchorByRole(graph, component, ['BP', 'TEE_BRANCH_POINT']);
  if (!ep1 || !ep2 || !bp) return;
  addPort(graph, component, 'TEE_RUN_IN', ep1.id);
  addPort(graph, component, 'TEE_RUN_OUT', ep2.id);
  addPort(graph, component, 'TEE_BRANCH_OUT', bp.id);
  addSegment(graph, component, 'TEE_MAIN_RUN', ep1.id, ep2.id);
}

function addSupport(graph, component) {
  const anchor = anchorByRole(graph, component, ['SUPPORT_POINT', 'POS']) || firstAnchor(graph, component);
  if (!anchor) return;
  const support = {
    id: `${component.id}:SUPPORT`,
    componentId: component.id,
    supportAnchorId: anchor.id,
    supportKind: component.normalized?.supportKind || component.normalized?.subtype || 'SUPPORT',
    hostCandidates: [],
    restraint: {},
    diagnostics: [],
  };
  graph.supports.push(support);
  component.supportId = support.id;
  addPort(graph, component, 'SUPPORT_POINT', anchor.id);
  addSegment(graph, component, 'SUPPORT_ASSOCIATION', anchor.id, '');
}

function addPort(graph, component, role, anchorId) {
  const port = { id: `${component.id}:${role}`, componentId: component.id, anchorId, role, bore: component.bore, connectsTo: 'ENDPOINT', maxDegree: 1, diagnostics: [] };
  graph.ports.push(port);
  component.portIds.push(port.id);
}

function addSegment(graph, component, type, startAnchorId, endAnchorId) {
  const segment = { id: `${component.id}:SEG`, componentId: component.id, type, startAnchorId, endAnchorId, supportAnchorId: '', bore: component.bore, length: null, lengthUnit: 'MM', diagnostics: [] };
  graph.segments.push(segment);
  component.segmentIds.push(segment.id);
}

function anchorByRole(graph, component, roles) {
  return graph.anchors.find((a) => component.anchorIds.includes(a.id) && roles.includes(a.role));
}

function firstAnchor(graph, component) {
  return graph.anchors.find((a) => component.anchorIds.includes(a.id));
}
