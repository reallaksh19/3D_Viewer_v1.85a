import { distanceMm } from './geometryMath.js';

export function developedLengthMm(component, segment, graph) {
  const dimensions = component.derived?.dimensions || {};
  if (segment?.type === 'BEND_CHORD') return bendDevelopedLength(component, segment, graph);
  return firstFinite(segment?.length, dimensions.lengthMm, dimensions.faceToFaceMm, anchorLength(segment, graph));
}

function bendDevelopedLength(component, segment, graph) {
  const dimensions = component.derived?.dimensions || {};
  const explicit = firstFinite(dimensions.developedLengthMm, dimensions.arcLengthMm);
  if (Number.isFinite(explicit)) return explicit;

  const radiusMm = firstFinite(dimensions.centerlineRadiusMm, component.derived?.radiusMm);
  const angleDeg = firstFinite(dimensions.angleDeg, component.derived?.angleDeg);
  if (Number.isFinite(radiusMm) && Number.isFinite(angleDeg)) {
    return radiusMm * angleDeg * Math.PI / 180;
  }
  return anchorLength(segment, graph);
}

export function anchorLength(segment, graph) {
  const anchors = new Map((graph.anchors || []).map((anchor) => [anchor.id, anchor]));
  return distanceMm(anchors.get(segment?.startAnchorId)?.point, anchors.get(segment?.endAnchorId)?.point);
}

function firstFinite(...values) {
  return values.find((value) => Number.isFinite(value));
}
