import { anchorMap, distanceMm } from './pointMath.js';

export function clusterEndpointPorts(graph, toleranceMm = 1) {
  const anchors = anchorMap(graph);
  const ports = (graph.ports || [])
    .filter(isEndpointPort)
    .map((port) => ({ port, anchor: anchors.get(port.anchorId) }))
    .filter((entry) => entry.anchor?.point)
    .sort((a, b) => a.port.id.localeCompare(b.port.id));

  const clusters = [];
  for (const entry of ports) {
    const cluster = clusters.find((candidate) =>
      distanceMm(candidate.anchor.point, entry.anchor.point) <= toleranceMm
    );
    if (cluster) cluster.entries.push(entry);
    else clusters.push({ anchor: entry.anchor, entries: [entry] });
  }

  return clusters.map((cluster) => ({
    ports: cluster.entries.map((entry) => entry.port),
    anchorIds: cluster.entries.map((entry) => entry.anchor.id),
    point: cluster.anchor.point,
    maxDistanceMm: maxDistance(cluster.entries, cluster.anchor.point),
  }));
}

export function isEndpointPort(port) {
  const role = String(port?.role || '').toUpperCase();
  if (!port?.anchorId) return false;
  if (role === 'SUPPORT_POINT') return false;
  return role.includes('END') || role.includes('RUN') || role.includes('BRANCH');
}

function maxDistance(entries, point) {
  return entries.reduce((max, entry) => Math.max(max, distanceMm(entry.anchor.point, point)), 0);
}
