import {
  DEFAULT_OPTIONS as V7_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeV7Options,
  runPsMappingResolver as runV7PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v7.js?v=20260612-table1-only-ps-unmapped-2';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...V7_DEFAULT_OPTIONS,
  showOptionalUnmatchedPsNo: false,
  showOptionalUnmatchedNodeNo: false,
};

function bool(value) {
  return value === true || String(value ?? '').trim() === 'true' || String(value ?? '').trim() === '1';
}

export function normalizePsMappingOptions(options = {}) {
  const normalized = normalizeV7Options(options);
  return {
    ...normalized,
    showOptionalUnmatchedPsNo: bool(options.showOptionalUnmatchedPsNo),
    showOptionalUnmatchedNodeNo: bool(options.showOptionalUnmatchedNodeNo),
  };
}

function isTruthy(value) {
  return value === true || /^(yes|y|true|1|mandatory|required|req|must|audit)$/i.test(String(value ?? '').trim());
}

function cleanIdPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[|]+/g, '/')
    || '';
}

function existingTable2SourceId(row = {}) {
  return cleanIdPart(row.table2SourceId || row.modelSourceId || row.sourceId || '');
}

function table2RowOrdinal(row = {}, index = -1) {
  const raw = cleanIdPart(row.table2Row || row.modelTable2Row || row.sourceRow || row.rowIndex || row.modelRowIndex || '');
  if (raw) return raw;
  return Number.isFinite(index) && index >= 0 ? String(index + 1) : '';
}

function makeTable2SourceId(row = {}, index = -1) {
  const existing = existingTable2SourceId(row);
  if (existing) return existing;

  const ordinal = table2RowOrdinal(row, index);
  if (ordinal) return `T2:${ordinal}`;

  const ps = cleanIdPart(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || row.basePs || 'PS?');
  const bore = cleanIdPart(row.modelBore ?? row.bore ?? 'BORE?');
  const line = cleanIdPart(row.lineFamily || row.modelLineFamily || row.pipe || 'LINE?');
  const support = cleanIdPart(row.supportTypesRequested || row.modelDtxrKeywords || row.dtxr || 'SUPPORT?');
  return `T2KEY:${ps}|${bore}|${line}|${support}`;
}

function withTable2SourceId(row = {}, index = -1) {
  if (!row || typeof row !== 'object') return row;
  const table2SourceId = makeTable2SourceId(row, index);
  return {
    ...row,
    table2SourceId,
    modelSourceId: row.modelSourceId || table2SourceId,
  };
}

function withTable2SourceIds(rows) {
  return Array.isArray(rows) ? rows.map((row, index) => withTable2SourceId(row, index)) : rows;
}

function sourceTable2Rows(result = {}, fallbackRows = []) {
  const source = Array.isArray(result?.consolidatedTable2Rows) && result.consolidatedTable2Rows.length
    ? result.consolidatedTable2Rows
    : Array.isArray(result?.table2SourceRows) && result.table2SourceRows.length
      ? result.table2SourceRows
      : Array.isArray(result?.modelRows) && result.modelRows.length
        ? result.modelRows
        : Array.isArray(result?.normalizedTable2Rows) && result.normalizedTable2Rows.length
          ? result.normalizedTable2Rows
          : Array.isArray(fallbackRows)
            ? fallbackRows
            : [];
  return withTable2SourceIds(source) || [];
}

function modelKey(row = {}) {
  return row.modelSourceId || row.table2SourceId || row.psnoModel || row.modelPsNo || row.basePs || '__UNKNOWN_MODEL__';
}

function hasNode(row = {}) {
  return Boolean(String(row.mappedNode || row.candidateNode || row.node || '').trim());
}

function hasMappedTable2Ps(row = {}) {
  const value = String(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || '').trim();
  return Boolean(value && value !== '-' && value.toUpperCase() !== 'N/A');
}

function isMandatory(row = {}) {
  return isTruthy(row.mandatory || row.modelMandatory || row.mandatoryRaw || row.isMandatory || row.table1Mandatory || row.nodeMandatory);
}

function hasNoNodeTable2Ps(row = {}) {
  return hasMappedTable2Ps(row) && !hasNode(row);
}

function noNodeAction(row = {}, mandatory = false) {
  return mandatory ? 'No matching node, needs review.' : 'Optional PS No. not mapped.';
}

function makeNoNodeCandidate(row = {}, { mandatory = false } = {}) {
  const rowWithId = withTable2SourceId(row);
  const action = noNodeAction(rowWithId, mandatory);
  return {
    psnoModel: rowWithId.psnoModel || rowWithId.modelPsNo || '',
    basePs: rowWithId.basePs || '',
    modelBore: rowWithId.modelBore ?? rowWithId.bore ?? '',
    pipe: rowWithId.pipe || '',
    lineFamily: rowWithId.lineFamily || rowWithId.modelLineFamily || '',
    dtxr: rowWithId.dtxr || '',
    mandatory,
    supportTypesRequested: rowWithId.modelDtxrKeywords || rowWithId.supportTypesRequested || '',
    modelDtxrKeywords: rowWithId.modelDtxrKeywords || rowWithId.supportTypesRequested || '',
    candidateNode: '',
    node: '',
    table1PsNo: '',
    psBasis: rowWithId.basis || 'NO_MATCH',
    boreBasis: '',
    lineBasis: '',
    supportBasis: '',
    supportMatch: '',
    eligible: false,
    autoSelectable: false,
    reviewRequired: mandatory,
    selected: false,
    finalStatus: mandatory ? 'USER_REVIEW_REQUIRED' : 'OPTIONAL_PS_NO_UNMAPPED',
    confidence: mandatory ? 'REVIEW' : 'AUDIT',
    confidenceScore: 0,
    warnings: rowWithId.warnings || (mandatory ? 'NO_MATCHING_NODE' : 'OPTIONAL_NO_MATCHING_NODE'),
    reason: action,
    reviewAction: action,
    consolidatedNodeWiseAction: action,
    nodeCoverageNote: action,
    matchGroup: mandatory ? '04_UNMATCHED_MANDATORY' : '05_UNMATCHED_OPTIONAL_PS_NO',
    table2Row: rowWithId.table2Row || rowWithId.sourceRow || '',
    table2SourceId: rowWithId.table2SourceId,
    modelSourceId: rowWithId.modelSourceId,
  };
}

function appendConfiguredNoNodeAuditRows(candidateRows = [], table2SourceRows = [], options = {}) {
  const rows = Array.isArray(candidateRows) ? withTable2SourceIds(candidateRows) : [];
  const existing = new Set(rows.map((row) => modelKey(row)));
  for (const row of withTable2SourceIds(table2SourceRows || []) || []) {
    if (!hasNoNodeTable2Ps(row)) continue;
    const mandatory = isMandatory(row);
    if (!mandatory && options.showOptionalUnmatchedPsNo !== true) continue;
    const key = modelKey(row);
    if (existing.has(key)) continue;
    rows.push(makeNoNodeCandidate(row, { mandatory }));
    existing.add(key);
  }
  return rows;
}

function visibleAction(row = {}) {
  return String(row.consolidatedNodeWiseAction || row.nodeCoverageNote || row.reason || '').trim();
}

function isTable1OnlyUnmappedNode(row = {}) {
  return hasNode(row) && !hasMappedTable2Ps(row) && visibleAction(row) === 'PS No. not Mapped';
}

function keepRow(row = {}, options = {}) {
  if (!isTable1OnlyUnmappedNode(row)) return true;
  if (isMandatory(row)) return true;
  return options.showOptionalUnmatchedNodeNo === true;
}

function filterOptionalRows(rows, options) {
  return Array.isArray(rows) ? rows.filter((row) => keepRow(row, options)) : rows;
}

function applyOptionalUnmatchedPolicy(result = {}, options = {}) {
  const rowsWithIds = withTable2SourceIds(result?.rows);
  const outputRowsWithIds = withTable2SourceIds(result?.outputRows);
  const validatorRowsWithIds = withTable2SourceIds(result?.validatorRows || rowsWithIds);
  const supportCoverageRowsWithIds = withTable2SourceIds(result?.supportCoverageRows);
  const table2SourceRowsWithIds = sourceTable2Rows(result, rowsWithIds || outputRowsWithIds || []);
  const candidateBase = withTable2SourceIds(result?.candidateRows || result?.candidates || []);
  const candidates = filterOptionalRows(appendConfiguredNoNodeAuditRows(candidateBase, table2SourceRowsWithIds, options), options);
  const rows = filterOptionalRows(rowsWithIds, options);
  const outputRows = filterOptionalRows(outputRowsWithIds, options);
  const validatorRows = filterOptionalRows(validatorRowsWithIds || rows, options);
  const supportCoverageRows = filterOptionalRows(supportCoverageRowsWithIds, options);
  return {
    ...result,
    consolidatedTable2Rows: table2SourceRowsWithIds,
    table2SourceRows: table2SourceRowsWithIds,
    rows,
    outputRows,
    validatorRows,
    candidateRows: candidates,
    candidates,
    supportCoverageRows,
    summary: {
      ...(result?.summary || {}),
      candidateRows: candidates.length,
      table2SourceIds: new Set((table2SourceRowsWithIds || []).map((row) => row?.table2SourceId).filter(Boolean)).size,
      optionalUnmatchedPsNoRows: candidates.filter((row) => visibleAction(row) === 'Optional PS No. not mapped.').length,
      optionalUnmatchedNodeNoRows: candidates.filter((row) => isTable1OnlyUnmappedNode(row) && !isMandatory(row)).length,
    },
    approxConfig: {
      ...(result?.approxConfig || {}),
      table2SourceId: 'Each normalized Table-2 row receives table2SourceId/modelSourceId. Tally and unmatched-row checks must use this source ID as the denominator key, not PS No or base PS.',
      optionalUnmatchedPolicy: 'Mandatory unmatched rows are always shown. Optional unmatched Table-2 PS rows require showOptionalUnmatchedPsNo=true. Optional Table-1-only node rows require showOptionalUnmatchedNodeNo=true.',
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV7PsMappingResolver({ ...input, options });
  return applyOptionalUnmatchedPolicy(result, options);
}
