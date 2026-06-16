const REF_FIELDS = Object.freeze([
  'id',
  'componentId',
  'anchorId',
  'startAnchorId',
  'endAnchorId',
  'supportAnchorId',
  'supportId',
]);

const REF_ARRAY_FIELDS = Object.freeze(['anchorIds', 'portIds', 'segmentIds']);

export function namespaceImportedIds(graph, namespace = '') {
  if (!namespace) return graph;
  const idMap = buildIdMap(graph, namespace);
  return rewriteValue(graph, idMap);
}

function buildIdMap(graph, namespace) {
  const idMap = new Map();
  for (const key of ['components', 'anchors', 'ports', 'segments', 'supports']) {
    for (const item of graph?.[key] || []) {
      if (item?.id) idMap.set(item.id, `${namespace}:${item.id}`);
    }
  }
  return idMap;
}

function rewriteValue(value, idMap, key = '') {
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, idMap, key));
  if (!value || typeof value !== 'object') return rewriteScalar(value, idMap, key);
  const next = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    next[childKey] = rewriteField(childKey, childValue, idMap);
  }
  return next;
}

function rewriteField(key, value, idMap) {
  if (REF_ARRAY_FIELDS.includes(key) && Array.isArray(value)) {
    return value.map((id) => idMap.get(id) || id);
  }
  if (REF_FIELDS.includes(key)) return rewriteScalar(value, idMap, key);
  return rewriteValue(value, idMap, key);
}

function rewriteScalar(value, idMap) {
  return typeof value === 'string' ? idMap.get(value) || value : value;
}
