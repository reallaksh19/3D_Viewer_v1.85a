import { dxfFooter, dxfHeader, lineEntity, pointEntity } from './dxfLines.js';

export function toSemanticDxf(graph, options = {}) {
  const lines = [...dxfHeader()];
  const anchorById = new Map((graph.anchors || []).map((anchor) => [anchor.id, anchor]));

  for (const segment of graph.segments || []) {
    const start = anchorById.get(segment.startAnchorId || segment.anchorIds?.[0]);
    const end = anchorById.get(segment.endAnchorId || segment.anchorIds?.[1]);
    if (start && end) lines.push(...lineEntity(segment.id, start.point, end.point, layerFor(segment)));
  }

  for (const support of graph.supports || []) {
    const anchor = anchorById.get(support.anchorId || support.supportAnchorId);
    if (anchor) lines.push(...pointEntity(support.id, anchor.point));
  }

  lines.push(...dxfFooter());
  return {
    dxf: `${lines.join('\n')}\n`,
    sidecar: {
      schema: 'semantic-dxf-sidecar/v1',
      source: options.source || 'PipeComponentData',
      graph: JSON.parse(JSON.stringify(graph)),
      componentCount: graph.components?.length || 0,
      segmentCount: graph.segments?.length || 0,
      supportCount: graph.supports?.length || 0,
    },
  };
}

function layerFor(segment) {
  const type = String(segment.type || '').toUpperCase();
  if (type.includes('SUPPORT')) return 'SUPPORTS';
  if (type.includes('VALVE')) return 'VALVES';
  if (type.includes('FLANGE')) return 'FLANGES';
  return 'PIPING';
}
