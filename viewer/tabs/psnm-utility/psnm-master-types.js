export const PSNM_MASTER_STATUS = Object.freeze({
  OK: 'OK',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DISABLED: 'DISABLED',
  MISSING_FROM_TABLE1: 'MISSING_FROM_TABLE1',
  MISSING_FROM_TABLE2: 'MISSING_FROM_TABLE2',
  INVALID_POSITION: 'INVALID_POSITION',
  INVALID_COORDINATE: 'INVALID_COORDINATE',
  DUPLICATE_PS: 'DUPLICATE_PS',
  BORE_CONFLICT: 'BORE_CONFLICT',
  MISSING_BORE: 'MISSING_BORE',
  AUDIT_REQUIRED_PS_NAME_MISSING: 'AUDIT_REQUIRED_PS_NAME_MISSING',
  AUDIT_REQUIRED_PS_POSITION_MISSING: 'AUDIT_REQUIRED_PS_POSITION_MISSING',
  AUDIT_REQUIRED_PS_BORE_MISSING: 'AUDIT_REQUIRED_PS_BORE_MISSING',
  AUDIT_REQUIRED_NODE_NAME_MISSING: 'AUDIT_REQUIRED_NODE_NAME_MISSING',
  AUDIT_REQUIRED_NODE_COORDINATE_MISSING: 'AUDIT_REQUIRED_NODE_COORDINATE_MISSING',
});

export function PSNM_isAuditStatus(value) {
  return /^AUDIT_REQUIRED_/i.test(String(value || ''));
}

let PSNM_ROW_SEQUENCE = 0;

function PSNM_nextRowId(prefix) {
  PSNM_ROW_SEQUENCE += 1;
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${PSNM_ROW_SEQUENCE.toString(36)}`;
}

function PSNM_unresolvedNumber(value) {
  return value == null || value === '' ? NaN : value;
}

export function PSNM_normalizePsName(value) {
  return String(value ?? '').trim().replace(/\.$/, '');
}

export function PSNM_makeMasterPsRow(seed = {}) {
  return {
    rowId: seed.rowId || PSNM_nextRowId('ps'),
    psKey: seed.psKey || PSNM_normalizePsName(seed.psName || ''),
    psName: seed.psName || '',
    positionRaw: seed.positionRaw || '',
    psE: PSNM_unresolvedNumber(seed.psE),
    psU: PSNM_unresolvedNumber(seed.psU),
    psS: PSNM_unresolvedNumber(seed.psS),
    p1bore: seed.p1bore ?? null,
    isMandatoryPs: seed.isMandatoryPs === true,
    mandatorySource: seed.mandatorySource || '',
    sourceTable: seed.sourceTable || '',
    sourceRow: seed.sourceRow ?? null,
    status: seed.status || PSNM_MASTER_STATUS.OK,
    enabled: seed.enabled !== false,
    userEdited: seed.userEdited === true,
    auditStatus: seed.auditStatus || '',
    auditSeverity: seed.auditSeverity || '',
    auditAction: seed.auditAction || '',
    remarks: seed.remarks || '',
  };
}

export function PSNM_makeMasterNodeRow(seed = {}) {
  return {
    rowId: seed.rowId || PSNM_nextRowId('node'),
    node: String(seed.node ?? '').trim(),
    occurrenceIndex: seed.occurrenceIndex ?? 1,
    occurrenceId: seed.occurrenceId || '',
    rawX: seed.rawX ?? null,
    rawY: seed.rawY ?? null,
    rawZ: seed.rawZ ?? null,
    nodeE: PSNM_unresolvedNumber(seed.nodeE),
    nodeU: PSNM_unresolvedNumber(seed.nodeU),
    nodeS: PSNM_unresolvedNumber(seed.nodeS),
    table2Bore: seed.table2Bore ?? null,
    table3Od: seed.table3Od ?? null,
    table3DerivedBore: seed.table3DerivedBore ?? null,
    finalNodeBore: seed.finalNodeBore ?? null,
    boreSource: seed.boreSource || 'MISSING',
    boreConflict: seed.boreConflict === true,
    isMandatoryNode: seed.isMandatoryNode === true,
    mandatorySource: seed.mandatorySource || '',
    isTerminal: seed.isTerminal === true,
    sourceTable: seed.sourceTable || '',
    sourceRow: seed.sourceRow ?? null,
    status: seed.status || PSNM_MASTER_STATUS.OK,
    enabled: seed.enabled !== false,
    userEdited: seed.userEdited === true,
    auditStatus: seed.auditStatus || '',
    auditSeverity: seed.auditSeverity || '',
    auditAction: seed.auditAction || '',
    remarks: seed.remarks || '',
  };
}

export function PSNM_cloneMasterPsRow(row) {
  return PSNM_makeMasterPsRow({ ...row, rowId: row.rowId });
}

export function PSNM_cloneMasterNodeRow(row) {
  return PSNM_makeMasterNodeRow({ ...row, rowId: row.rowId });
}

export const PSNM_EDITABLE_MASTER_PS_FIELDS = new Set([
  'psName',
  'positionRaw',
  'p1bore',
  'isMandatoryPs',
  'enabled',
  'remarks',
]);

export const PSNM_EDITABLE_MASTER_NODE_FIELDS = new Set([
  'node',
  'rawX',
  'rawY',
  'rawZ',
  'finalNodeBore',
  'isMandatoryNode',
  'enabled',
  'remarks',
]);
