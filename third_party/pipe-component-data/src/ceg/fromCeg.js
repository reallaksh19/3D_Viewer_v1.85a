import { createAdapterGraph } from '../graph/createAdapterGraph.js';
import { normalizeCegAttributes, restoreStructuredDiagnostics } from './cegAttributes.js';
import { cegLossContractToUxmlLosses } from './lossContract.js';
import { mapCegAnchorRoleToUxml, mapCegTypeToUxmlType } from './roleMaps.js';
import { rebuildUxmlTopology } from './rebuildUxmlTopology.js';

export function fromCeg(ceg, options = {}) {
  const graph = createAdapterGraph({
    now: options.now,
    profile: options.profile || 'UXML-TOPOLOGY-FULL',
    adapter: { importSessionId: options.importSessionId || '', idNamespace: options.idNamespace || 'CEG' },
  });
  const owners = anchorOwners(ceg.components || {});
  for (const [componentId, component] of Object.entries(ceg.components || {})) {
    graph.components.push(toUxmlComponent(componentId, component));
  }
  for (const [anchorId, anchor] of Object.entries(ceg.anchors || {})) {
    graph.anchors.push(toUxmlAnchor(anchorId, anchor, owners.get(anchorId)));
  }
  graph.lossContract = cegLossContractToUxmlLosses(ceg.lossContract);
  return rebuildUxmlTopology(graph);
}

function anchorOwners(components) {
  const owners = new Map();
  for (const [componentId, component] of Object.entries(components)) {
    for (const anchorId of component.anchorIds || []) owners.set(anchorId, componentId);
  }
  return owners;
}

function toUxmlAnchor(anchorId, anchor, componentId = '') {
  return {
    id: anchor.id || anchorId,
    componentId,
    role: mapCegAnchorRoleToUxml(anchor.role),
    point: anchor.point || { x: 0, y: 0, z: 0 },
    sourceField: anchor.role || '',
    confidence: 'EXACT_SOURCE',
    fallbackLevel: '',
    derivationMethod: 'CEG_ANCHOR',
    diagnostics: componentId ? [] : [ownerDiagnostic(anchorId)],
  };
}

function toUxmlComponent(componentId, component) {
  const envelope = component.rawAttributes?.pipeAdapter || null;
  const attributes = component.attributes || {};
  const normalized = envelope?.normalized || normalizeCegAttributes(attributes, component);
  const type = mapCegTypeToUxmlType(component.type, attributes);
  return {
    id: component.id || componentId,
    sourceRefs: envelope?.sourceRefs || [{ format: 'CEG', componentId }],
    type,
    normalizedType: type,
    pipelineRef: component.layerId || attributes['PIPELINE-REFERENCE'] || '',
    lineKey: attributes.LINEKEY || attributes.LINE_KEY || '',
    refNo: attributes.REFNO || attributes.REF_NO || '',
    seqNo: attributes.SEQNO || attributes.SEQ_NO || '',
    name: attributes.NAME || component.label || componentId,
    bore: component.derived?.bore ?? attributes.BORE ?? null,
    branchBore: component.derived?.branchBore ?? attributes.BRANCH_BORE ?? null,
    boreUnit: 'MM',
    sizeRaw: attributes.NPS || attributes.SIZE || attributes.DN || '',
    skey: attributes.SKEY || '',
    ca: attributes.CA || {},
    rawAttributes: { ...attributes, ...(component.rawAttributes || {}) },
    normalized: { ...normalized, type },
    derived: { ...(component.derived || {}), ...(envelope?.derived || {}) },
    anchorIds: [...(component.anchorIds || [])],
    portIds: [],
    segmentIds: [],
    supportId: '',
    confidence: envelope?.confidence || 'EXACT_SOURCE',
    diagnostics: restoreStructuredDiagnostics(component),
  };
}

function ownerDiagnostic(anchorId) {
  return {
    severity: 'WARNING',
    code: 'CEG_ANCHOR_HAS_NO_COMPONENT_OWNER',
    message: `Anchor ${anchorId} is not referenced by any CEG component.`,
    details: {},
  };
}
