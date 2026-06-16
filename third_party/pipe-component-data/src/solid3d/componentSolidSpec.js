import { componentAnchors, componentDimensions, finiteNumber, primarySegment } from './solidSpecHelpers.js';

export function componentSolidSpec(graph, component) {
  const type = String(component.type || component.normalizedType || '').toUpperCase();
  if (type === 'PIPE') return pipeSpec(graph, component);
  if (type === 'FLANGE') return flangeSpec(graph, component);
  if (type === 'VALVE') return valveSpec(graph, component);
  if (type === 'SUPPORT') return supportSpec(graph, component);
  if (type === 'ELBOW' || type === 'BEND') return bendSpec(graph, component);
  if (type === 'TEE') return teeSpec(graph, component);
  return placeholderSpec(component, 'SOLID3D_UNSUPPORTED_COMPONENT');
}

function pipeSpec(graph, component) {
  const dims = componentDimensions(component);
  const segment = primarySegment(graph, component.id) || {};
  return base(component, 'pipe', {
    lengthMm: finiteNumber(segment.length ?? dims.lengthMm),
    outerDiameterMm: finiteNumber(dims.outerDiameterMm ?? component.bore),
    wallThicknessMm: finiteNumber(dims.wallThicknessMm),
    boreMm: finiteNumber(component.bore),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function flangeSpec(graph, component) {
  const dims = componentDimensions(component);
  return base(component, 'flange', {
    outerDiameterMm: finiteNumber(dims.flangeOdMm),
    axialLengthMm: finiteNumber(dims.flangeThicknessMm) + finiteNumber(dims.hubLengthMm),
    thicknessMm: finiteNumber(dims.flangeThicknessMm),
    hubLengthMm: finiteNumber(dims.hubLengthMm),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function valveSpec(graph, component) {
  const dims = componentDimensions(component);
  return base(component, 'valve', {
    faceToFaceMm: finiteNumber(dims.faceToFaceMm),
    heightMm: finiteNumber(dims.heightMm),
    weightKg: finiteNumber(dims.weightKg),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function supportSpec(graph, component) {
  const dims = componentDimensions(component);
  return base(component, 'support', {
    subtype: component.normalized?.subtype || component.subtype || '',
    heightMm: finiteNumber(dims.heightMm),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function bendSpec(graph, component) {
  const dims = componentDimensions(component);
  return base(component, 'bend', {
    developedLengthMm: finiteNumber(dims.developedLengthMm ?? dims.arcLengthMm),
    centerlineRadiusMm: finiteNumber(dims.centerlineRadiusMm),
    angleDeg: finiteNumber(dims.angleDeg ?? 90),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function teeSpec(graph, component) {
  return base(component, 'tee', {
    boreMm: finiteNumber(component.bore),
    branchBoreMm: finiteNumber(component.branchBore ?? component.bore),
    anchors: componentAnchors(graph, component).map((a) => a.point),
  });
}

function placeholderSpec(component, code) {
  return { ...base(component, 'placeholder', {}), placeholder: true, diagnostics: [{ code }] };
}

function base(component, solidType, dimensions) {
  return {
    id: component.id,
    componentType: component.type,
    solidType,
    dimensions,
    material: component.normalized?.material || 'CARBON_STEEL',
    triangleBudget: 5000,
  };
}
