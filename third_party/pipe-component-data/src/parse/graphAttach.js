export function attachAnchor(graph, component, role, point) {
  const anchor = {
    id: `${component.id}:${role}`,
    componentId: component.id,
    role,
    point,
    sourceField: role,
    confidence: 'EXACT_SOURCE',
    fallbackLevel: '',
    derivationMethod: 'CSV_ROW',
    diagnostics: [],
  };
  graph.anchors.push(anchor);
  component.anchorIds.push(anchor.id);
  return anchor;
}

export function attachPort(graph, component, role, anchorId) {
  const port = {
    id: `${component.id}:${role}`,
    componentId: component.id,
    anchorId,
    role,
    bore: component.bore,
    connectsTo: 'ENDPOINT',
    maxDegree: 1,
    diagnostics: [],
  };
  graph.ports.push(port);
  component.portIds.push(port.id);
}

export function attachSegment(graph, component, type, startAnchorId, endAnchorId) {
  const segment = {
    id: `${component.id}:SEG`,
    componentId: component.id,
    type,
    startAnchorId,
    endAnchorId,
    supportAnchorId: '',
    bore: component.bore,
    length: null,
    lengthUnit: 'MM',
    diagnostics: [],
  };
  graph.segments.push(segment);
  component.segmentIds.push(segment.id);
}
