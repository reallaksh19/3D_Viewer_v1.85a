import { classifyComponent } from './classifyComponent.js';
import { normalizeClass, normalizeEndType, normalizeFacing, normalizeNps, normalizeSubtype } from './normalizers.js';

export function makeComponent(row, index) {
  const type = classifyComponent(row);
  const id = row.id || `${type}-${index + 1}`;
  return {
    id,
    sourceRefs: [{ format: 'CSV', sourceId: String(row.__line || index + 1) }],
    type,
    normalizedType: type,
    pipelineRef: row.pipeline || row.pipeline_ref || '',
    lineKey: row.line_key || row.linekey || '',
    refNo: row.ref_no || row.refno || '',
    seqNo: row.seq_no || row.seqno || '',
    name: row.name || id,
    bore: null,
    branchBore: null,
    boreUnit: 'MM',
    sizeRaw: row.nps || row.size || row.dn || '',
    skey: row.skey || '',
    ca: {},
    rawAttributes: { ...row },
    normalized: makeNormalized(row, type),
    derived: {},
    anchorIds: [],
    portIds: [],
    segmentIds: [],
    supportId: '',
    confidence: type === 'UNKNOWN' ? 'UNRESOLVED' : 'EXACT_SOURCE',
    diagnostics: type === 'UNKNOWN' ? [unknownDiagnostic(id)] : [],
  };
}

function makeNormalized(row, type) {
  return {
    type,
    subtype: normalizeSubtype(row.subtype),
    nps: normalizeNps(row.nps || row.size),
    dn: String(row.dn || '').trim(),
    schedule: String(row.schedule || row.sch || '').trim(),
    classRating: normalizeClass(row.class || row.rating),
    facing: normalizeFacing(row.face || row.facing),
    endType: normalizeEndType(row.endtype || row.end_type || row.end),
    supportKind: normalizeSubtype(row.support_kind || row.subtype),
  };
}

function unknownDiagnostic(componentId) {
  return {
    severity: 'WARNING',
    code: 'UNKNOWN_COMPONENT_TYPE',
    message: 'Could not classify component row.',
    componentId,
    details: {},
  };
}
