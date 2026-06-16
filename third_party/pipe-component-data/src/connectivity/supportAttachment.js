import { anchorMap, componentMap, pointToSegmentProjection } from './pointMath.js';

export function attachSupportsToNearestPipe(graph, options = {}) {
  const toleranceMm = Number(options.supportToleranceMm ?? 50);
  const anchors = anchorMap(graph);
  const components = componentMap(graph);
  const pipeSegments = (graph.segments || []).filter((segment) => {
    const component = components.get(segment.componentId);
    return component?.type === 'PIPE' && segment.startAnchorId && segment.endAnchorId;
  });

  for (const support of graph.supports || []) {
    support.hostCandidates = [];
    const supportAnchor = anchors.get(support.supportAnchorId);
    const candidate = nearestPipe(supportAnchor?.point, pipeSegments, anchors);
    if (!candidate || candidate.distanceMm > toleranceMm) {
      support.diagnostics.push(orphanDiagnostic(toleranceMm));
      continue;
    }
    support.hostCandidates.push({
      componentId: candidate.segment.componentId,
      segmentId: candidate.segment.id,
      distanceMm: round(candidate.distanceMm),
      stationMm: round(candidate.stationMm),
      confidence: 'TOPOLOGY_INFERRED',
    });
  }
}

function nearestPipe(point, pipeSegments, anchors) {
  if (!point) return null;
  let best = null;
  for (const segment of pipeSegments) {
    const start = anchors.get(segment.startAnchorId)?.point;
    const end = anchors.get(segment.endAnchorId)?.point;
    if (!start || !end) continue;
    const projection = pointToSegmentProjection(point, start, end);
    const candidate = { segment, ...projection };
    if (!best || compareCandidate(candidate, best) < 0) best = candidate;
  }
  return best;
}

function compareCandidate(a, b) {
  const distanceDelta = a.distanceMm - b.distanceMm;
  if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;
  const stationDelta = a.stationMm - b.stationMm;
  if (Math.abs(stationDelta) > 1e-9) return stationDelta;
  return a.segment.id.localeCompare(b.segment.id);
}

function orphanDiagnostic(toleranceMm) {
  return {
    severity: 'WARNING',
    code: 'SUPPORT_ORPHAN_NO_PIPE_WITHIN_TOLERANCE',
    message: 'Support could not be attached to a nearby pipe.',
    details: { toleranceMm },
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
