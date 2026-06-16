function text(value) {
  return String(value ?? '').trim();
}

function cleanNodeDisplayText(value) {
  const raw = text(value);
  if (!raw) return '';
  if (/SUPPORT_POINT/i.test(raw)) return '';

  const withoutEndpoint = raw.replace(/[-_\s]*EP[12]\b/ig, '').trim();
  if (/^\d+(?:\.\d+)?$/.test(withoutEndpoint)) return withoutEndpoint.replace(/\.0+$/, '');

  const nodeMatch = withoutEndpoint.match(/\b(?:NODE|N)\s*[-_:.]?\s*(\d+(?:\.\d+)?)\b/i);
  if (nodeMatch) return nodeMatch[1].replace(/\.0+$/, '');

  const nums = withoutEndpoint.match(/\b\d{1,6}(?:\.\d+)?\b/g);
  if (nums?.length) return nums[nums.length - 1].replace(/\.0+$/, '');

  return withoutEndpoint;
}

function point3(point = {}) {
  const x = Number(point.x);
  const y = Number(point.y);
  const z = Number(point.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function nodeLabelFromAnchor(anchor = {}) {
  const raw = anchor.rawAttributes || anchor.raw || {};
  const candidates = [
    anchor.nodeNumber,
    anchor.nodeLabel,
    anchor.nodeName,
    anchor.name,
    raw.NodeNumber,
    raw.NODE_NUMBER,
    raw.NodeName,
    raw.NODE_NAME,
    raw.NODE,
    raw.node,
    raw.nodeNumber,
    raw.nodeName,
  ];

  return candidates
    .map(text)
    .find(Boolean)
    ?.replace(/^anchor[:_-]?/i, '')
    .replace(/^node[:_-]?/i, '')
    .trim() || '';
}

function pointClusterKey(point) {
  if (!point) return 'no-point';
  const step = 5;
  return [
    Math.round(point.x / step),
    Math.round(point.y / step),
    Math.round(point.z / step),
  ].join(':');
}

function makeNodeLabelComponent(anchor, index) {
  const point = point3(anchor.point);
  const label = cleanNodeDisplayText(nodeLabelFromAnchor(anchor));
  if (!point || !label) return null;

  return {
    id: `node-label-${label}-${index}`,
    type: 'NODE_LABEL',
    coOrds: point,
    centrePoint: point,
    ep1: point,
    bore: 20,
    refNo: label,
    label,
    attributes: {
      COMPONENT_IDENTIFIER: label,
      NODE_LABEL: label,
      NODE_NUMBER: label,
      SOURCE_ANCHOR_ID: text(anchor.id),
      LABEL_KIND: 'NODE',
      glbShape: 'node-label-anchor',
    },
    raw: {
      NODE_LABEL: label,
      NODE_NUMBER: label,
      SOURCE_ANCHOR_ID: text(anchor.id),
      LABEL_KIND: 'NODE',
    },
  };
}

export function appendInputXmlGlbNodeLabels(model, doc, stats = {}) {
  const components = Array.isArray(model?.components) ? model.components : [];
  const existing = new Set(components
    .filter((component) => component.type === 'NODE_LABEL')
    .map((component) => `${cleanNodeDisplayText(component.label || component.refNo || component.id)}|${pointClusterKey(point3(component.coOrds || component.centrePoint || component.ep1))}`));
  let nodeLabelCount = 0;

  for (const [index, anchor] of (doc?.anchors || []).entries()) {
    const nodeLabel = makeNodeLabelComponent(anchor, index);
    if (!nodeLabel) continue;
    const key = `${nodeLabel.label || nodeLabel.refNo || nodeLabel.id}|${pointClusterKey(nodeLabel.coOrds)}`;
    if (existing.has(key)) continue;
    existing.add(key);
    components.push(nodeLabel);
    nodeLabelCount += 1;
  }

  if (stats && typeof stats === 'object') {
    stats.nodeLabelCount = (Number(stats.nodeLabelCount) || 0) + nodeLabelCount;
    stats.componentCount = components.length;
    stats.typeCounts = { ...(stats.typeCounts || {}) };
    if (nodeLabelCount) stats.typeCounts.NODE_LABEL = (Number(stats.typeCounts.NODE_LABEL) || 0) + nodeLabelCount;
  }

  return { nodeLabelCount };
}
