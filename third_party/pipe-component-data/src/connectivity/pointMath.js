export function anchorMap(graph) {
  return new Map((graph.anchors || []).map((anchor) => [anchor.id, anchor]));
}

export function componentMap(graph) {
  return new Map((graph.components || []).map((component) => [component.id, component]));
}

export function distanceMm(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

export function distanceSquared(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  const dz = Number(a?.z || 0) - Number(b?.z || 0);
  return dx * dx + dy * dy + dz * dz;
}

export function pointToSegmentProjection(point, start, end) {
  const ax = Number(start?.x || 0);
  const ay = Number(start?.y || 0);
  const az = Number(start?.z || 0);
  const bx = Number(end?.x || 0);
  const by = Number(end?.y || 0);
  const bz = Number(end?.z || 0);
  const px = Number(point?.x || 0);
  const py = Number(point?.y || 0);
  const pz = Number(point?.z || 0);
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;
  const len2 = vx * vx + vy * vy + vz * vz;
  const t = len2 ? clamp(((px - ax) * vx + (py - ay) * vy + (pz - az) * vz) / len2, 0, 1) : 0;
  const projected = { x: ax + vx * t, y: ay + vy * t, z: az + vz * t };
  return {
    point: projected,
    distanceMm: distanceMm(point, projected),
    stationMm: Math.sqrt(len2) * t,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
