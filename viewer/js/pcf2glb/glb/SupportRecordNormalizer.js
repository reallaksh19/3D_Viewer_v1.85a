import {
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
  layerIdsForRestraintSupport,
} from './RestraintVisualProfile.js';

export const BM_CII_SUPPORT_RECORD_SCHEMA = 'bm-cii-support-record/v1';

function text(value) {
  return String(value ?? '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && text(value) !== '') return value;
  }
  return '';
}

function normalizedSource(value) {
  return text(value).toLowerCase().includes('isonote') ? 'isonote' : 'inputxml';
}

function normalizeKind(value) {
  const kind = normalizeRestraintKind(value) || 'UNKNOWN';
  if (kind === 'SHOE') return 'REST';
  if (kind === 'SUPPORT') return 'REST';
  return kind;
}

function normalizeAxis(value) {
  const axis = normalizeRestraintAxisLabel(value);
  if (axis.includes('X')) return axis.startsWith('-') ? '-X' : '+X';
  if (axis.includes('Y')) return axis.startsWith('-') ? '-Y' : '+Y';
  if (axis.includes('Z')) return axis.startsWith('-') ? '-Z' : '+Z';
  return '';
}

export function supportSymbolContractFor(kind) {
  const normalizedKind = normalizeKind(kind);
  if (normalizedKind === 'GUIDE') return 'guide-lateral-arrows-tip-at-od2';
  if (normalizedKind === 'REST' || normalizedKind === 'HOLDDOWN' || normalizedKind === 'SHOE') return 'rest-vertical-arrow-tip-at-od2';
  if (normalizedKind === 'LINESTOP') return 'linestop-axial-arrows-offset-od2';
  if (normalizedKind === 'LIMIT') return 'limit-axial-arrow-offset-od2';
  if (normalizedKind === 'HANGER' || normalizedKind === 'SPRING') return 'hanger-spring-symbol';
  if (normalizedKind === 'ANCHOR') return 'anchor-fixed-symbol';
  return 'unknown-debug-default-off';
}

export function supportRecordIdOf({ source = 'inputxml', index = 0, node = '', kind = 'UNKNOWN', axis = '' } = {}) {
  const indexText = String(Number(index) > 0 ? Number(index) : 0).padStart(2, '0');
  const normalizedKind = normalizeKind(kind);
  const normalizedAxis = normalizeAxis(axis).replace(/^\+/, '') || 'NA';
  return `${normalizedSource(source)}:${indexText}:node:${text(node) || 'NA'}:kind:${normalizedKind}:axis:${normalizedAxis}`;
}

export function normalizeSupportRecord(raw = {}, context = {}) {
  const source = normalizedSource(firstNonEmpty(context.source, context.supportSource, raw.source, raw.supportSource, raw.SUPPORT_SOURCE));
  const index = Number(context.index ?? raw.index ?? raw.recordIndex ?? raw.supportIndex ?? 0) || 0;
  const node = text(firstNonEmpty(raw.node, raw.nodeNumber, raw.NodeNumber, raw.supportNode, raw.sourceNode, raw.CAESAR_NODE));
  const kind = normalizeKind(firstNonEmpty(raw.kind, raw.type, raw.display, raw.supportKind, raw.restraintType, raw.CMPSUPTYPE, raw.SKEY, raw.labelText));
  const axis = normalizeAxis(firstNonEmpty(raw.axis, raw.axisGlb, raw.direction, raw.restraintAxis, raw.supportAxis, raw.SUPPORT_AXIS, raw.SUPPORT_DIRECTION, raw.AXIS, raw.Direction));
  const recordId = text(firstNonEmpty(
    raw.recordId,
    raw.supportRecordId,
    raw.id,
    raw.supportId,
    context.recordId,
    supportRecordIdOf({ source, index, node, kind, axis }),
  ));
  const layerIds = layerIdsForRestraintSupport({ source, kind, axisLabel: axis });
  return {
    schema: BM_CII_SUPPORT_RECORD_SCHEMA,
    recordId,
    source,
    index,
    node,
    kind,
    axis,
    visibleDefault: kind !== 'UNKNOWN',
    supportSymbolContract: supportSymbolContractFor(kind),
    layerIds,
    raw,
  };
}

export function isUnknownSupportRecord(record = {}) {
  return normalizeKind(record.kind).includes('UNKNOWN') || normalizeKind(record.kind).includes('TYPE0');
}

export function supportTraceFromRecord(record = {}, extra = {}) {
  return {
    schema: BM_CII_SUPPORT_RECORD_SCHEMA,
    entity: 'support',
    semanticCategory: 'support',
    recordId: record.recordId,
    supportRecordId: record.recordId,
    source: record.source,
    supportSource: record.source,
    node: record.node,
    sourceNode: record.node,
    supportKind: record.kind,
    kind: record.kind,
    axis: record.axis,
    restraintAxis: record.axis,
    supportSymbolContract: record.supportSymbolContract,
    visibleDefault: record.visibleDefault,
    ...extra,
  };
}
