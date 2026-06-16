import { createAdapterGraph } from '../graph/createAdapterGraph.js';
import { parseEntityCount } from './dxfLines.js';

export function fromSemanticDxf(input, options = {}) {
  if (input?.sidecar?.graph) return JSON.parse(JSON.stringify(input.sidecar.graph));

  const dxf = typeof input === 'string' ? input : input?.dxf;
  const lineCount = parseEntityCount(dxf, 'LINE');
  const pointCount = parseEntityCount(dxf, 'POINT');
  const graph = createAdapterGraph({ profile: 'UXML-DXF-BRIDGE' });

  for (let index = 0; index < lineCount; index += 1) {
    graph.components.push(downgradedComponent(`DXF-LINE-${index + 1}`, 'PIPE'));
  }
  for (let index = 0; index < pointCount; index += 1) {
    graph.components.push(downgradedComponent(`DXF-POINT-${index + 1}`, 'SUPPORT'));
  }

  graph.diagnostics.push({
    severity: 'WARNING',
    code: 'DXF_ONLY_IMPORT_DOWNGRADED',
    message: 'DXF-only import restored entity counts without semantic sidecar.',
    details: { lineCount, pointCount, source: options.source || '' },
  });
  return graph;
}

function downgradedComponent(id, type) {
  return {
    id,
    sourceRefs: [{ format: 'DXF' }],
    type,
    normalizedType: type,
    pipelineRef: '',
    lineKey: '',
    refNo: '',
    seqNo: '',
    name: id,
    bore: null,
    branchBore: null,
    boreUnit: 'MM',
    sizeRaw: '',
    skey: '',
    ca: {},
    rawAttributes: {},
    normalized: {},
    derived: {},
    anchorIds: [],
    portIds: [],
    segmentIds: [],
    supportId: '',
    confidence: 'DOWNGRADED_DXF_ONLY',
    diagnostics: [{ severity: 'WARNING', code: 'DXF_ONLY_COMPONENT_DOWNGRADED' }],
  };
}
