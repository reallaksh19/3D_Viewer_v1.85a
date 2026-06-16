function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function flattenRawText(value, depth = 0) {
  if (value === null || value === undefined || depth > 3) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenRawText(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [key, ...flattenRawText(item, depth + 1)]);
  }
  return [];
}

function searchableText(...values) {
  return values.flatMap((value) => flattenRawText(value)).join(' ').toUpperCase();
}

export function parseSelectedBranches(value) {
  if (Array.isArray(value)) return new Set(value.map(text).filter(Boolean));
  return new Set(text(value).split(',').map((item) => item.trim()).filter(Boolean));
}

function componentAliases(component) {
  return [
    component?.pipelineRef,
    component?.lineKey,
    component?.rawAttributes?.pipelineRef,
  ].map(text).filter(Boolean);
}

function componentSelected(component, selectedIds) {
  if (!selectedIds.size) return true;
  return componentAliases(component).some((alias) => selectedIds.has(alias));
}

export function classifyComponentLayer(component, segment = {}) {
  const haystack = searchableText(
    component?.normalizedType,
    component?.type,
    component?.typeDesc,
    component?.name,
    component?.refNo,
    component?.rawAttributes,
    segment?.type,
  );
  if (/VALVE|\bVLV\b|\bVGT\b|\bVG\b/.test(haystack)) return 'VALVES';
  if (/FLANGE|\bFLG\b|GASKET|\bGSKT\b/.test(haystack)) return 'FLANGES';
  if (/REDUCER|\bRED\b|CONC\.?\s*RED|ECC\.?\s*RED/.test(haystack)) return 'REDUCERS';
  if (/\bTEE\b|BRANCH|LATERAL/.test(haystack)) return 'TEES';
  if (/OLET|WELDOLET|SOCKOLET|THREADOLET|WELDING\s+BOSS|BOSS/.test(haystack)) return 'OLETS';
  if (/ELBOW|\bEL\b|\bBEND\b|\bBENT\b/.test(haystack)) return 'ELBOWS';
  if (/NOZZLE|EQUIPMENT|TERMINAL/.test(haystack)) return 'NOZZLES';
  return 'PIPING';
}

function point3(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function lengthLabel(length) {
  const value = Number(length);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${Number(value.toFixed(value >= 100 ? 0 : 1))} mm`;
}

function isSupportComponent(component, segment) {
  const type = upper(component?.normalizedType || component?.type || segment?.type);
  return type.includes('SUPPORT') || upper(segment?.type) === 'SUPPORT_ASSOCIATION';
}

export function classifySupportType(support = {}, component = {}) {
  const haystack = searchableText(
    support?.type,
    support?.name,
    support?.id,
    support?.rawAttributes,
    component?.normalizedType,
    component?.type,
    component?.name,
    component?.refNo,
    component?.rawAttributes,
  );
  if (/GUIDE|\bGUID\b|\bGUD\b/.test(haystack)) return 'guide';
  if (/LINE\s*STOP|LINESTOP|\bLSTOP\b|\bLS\b/.test(haystack)) return 'lineStop';
  if (/LIMIT|\bLIM\b|STOPPER|STOP\b/.test(haystack)) return 'limit';
  if (/ANCHOR|FIXED|\bANC\b/.test(haystack)) return 'anchor';
  if (/SPRING|HANGER|\bHANG\b|ROD/.test(haystack)) return 'hanger';
  if (/SHOE|SADDLE/.test(haystack)) return 'shoe';
  if (/REST|RESTING|RESTRAINT|SUPPORT|\bPS[-_\s]?\d+/.test(haystack)) return 'rest';
  return 'unknown';
}

function supportLabel(support = {}, component = {}, supportType = 'unknown') {
  const base = text(component?.name || support?.name || support?.id || component?.id || 'SUPPORT');
  const typeText = supportType === 'lineStop' ? 'LINE STOP' : supportType.toUpperCase();
  if (!base) return typeText;
  return base.toUpperCase().includes(typeText) ? base : `${base} ${typeText}`;
}

export function projectToDxfGeometry(doc, options = {}) {
  const selectedIds = parseSelectedBranches(options.selectedBranches);
  const components = new Map((doc.components || []).map((component) => [component.id, component]));
  const anchors = new Map((doc.anchors || []).map((anchor) => [anchor.id, anchor]));
  const segments = [];
  const supports = [];
  const diagnostics = [];
  const exportLengthText = options.exportLengthText === true;

  for (const segment of doc.segments || []) {
    const component = components.get(segment.componentId);
    if (!component || !componentSelected(component, selectedIds)) continue;
    if (isSupportComponent(component, segment)) continue;

    const p1 = point3(anchors.get(segment.startAnchorId)?.point);
    const p2 = point3(anchors.get(segment.endAnchorId)?.point);

    if (!p1 || !p2) {
      diagnostics.push({
        type: 'inputxml-dxf-segment-missing-anchor',
        severity: 'WARN',
        componentId: segment.componentId,
        segmentId: segment.id,
      });
      continue;
    }

    const layer = classifyComponentLayer(component, segment);
    const measuredLength = Number(segment.length) > 0 ? Number(segment.length) : distance(p1, p2);
    const measuredLengthLabel = lengthLabel(measuredLength);
    segments.push({
      id: segment.id,
      componentId: segment.componentId,
      layer,
      type: text(component.normalizedType || component.type || segment.type),
      componentType: layer.toLowerCase(),
      label: exportLengthText && measuredLengthLabel ? measuredLengthLabel : text(component.name || component.refNo || component.seqNo || component.id),
      length: measuredLength,
      lengthLabel: measuredLengthLabel,
      p1,
      p2,
      branchAliases: componentAliases(component),
    });
  }

  for (const support of doc.supports || []) {
    const component = components.get(support.componentId);
    if (component && !componentSelected(component, selectedIds)) continue;
    if (!component && selectedIds.size) continue;

    const point = point3(anchors.get(support.supportAnchorId)?.point);
    if (!point) {
      diagnostics.push({
        type: 'inputxml-dxf-support-missing-anchor',
        severity: 'WARN',
        supportId: support.id,
        componentId: support.componentId,
      });
      continue;
    }

    const supportType = classifySupportType(support, component);
    supports.push({
      id: support.id,
      componentId: support.componentId,
      layer: 'SUPPORTS',
      type: text(support.type || component?.type || 'SUPPORT'),
      supportType,
      label: supportLabel(support, component, supportType),
      point,
      branchAliases: component ? componentAliases(component) : [],
    });
  }

  return { selectedBranchIds: [...selectedIds], segments, supports, diagnostics };
}
