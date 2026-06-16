import { geometryRoleForCeg, mapUxmlAnchorRoleToCeg, mapUxmlTypeToCegType } from './roleMaps.js';
import { toCegAttributes } from './cegAttributes.js';

export function toCeg(adapterGraph, options = {}) {
  return {
    schemaVersion: 'CEG-1.0',
    sourceFormat: 'UXML',
    name: options.name || adapterGraph.header?.modelId || 'AdapterGraph Import',
    anchors: Object.fromEntries((adapterGraph.anchors || []).map((a) => [a.id, toCegAnchor(a)])),
    components: Object.fromEntries((adapterGraph.components || []).map((c) => [c.id, toCegComponent(c, adapterGraph)])),
    lossContract: { unsupportedEntities: [], downgradedEntities: [], proxyEntities: [], exportWarnings: [] },
  };
}

function toCegAnchor(anchor) {
  return {
    id: anchor.id,
    role: mapUxmlAnchorRoleToCeg(anchor.role),
    point: anchor.point,
    connectedTo: [],
    locked: false,
    sourceRef: anchor.sourceRef || null,
  };
}

function toCegComponent(component, graph) {
  const type = mapUxmlTypeToCegType(component.type);
  return {
    id: component.id,
    type,
    layerId: component.pipelineRef || 'default',
    anchorIds: [...(component.anchorIds || [])],
    geometryRole: geometryRoleForCeg(type),
    attributes: toCegAttributes(component),
    rawAttributes: {
      ...(component.rawAttributes || {}),
      pipeAdapter: {
        schemaVersion: graph.schemaVersion,
        profile: graph.profile,
        diagnostics: component.diagnostics || [],
        sourceRefs: component.sourceRefs || [],
        normalized: component.normalized || {},
        derived: component.derived || {},
      },
    },
    derived: {
      bore: component.bore ?? component.derived?.dimensions?.boreMm ?? null,
      branchBore: component.branchBore ?? null,
      ...(component.derived || {}),
    },
    diagnostics: (component.diagnostics || []).map((d) => d.code || String(d)),
    sourceRef: { format: 'UXML', componentId: component.id },
  };
}
