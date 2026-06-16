import {
  DEFAULT_OPTIONS as V8_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeV8Options,
  runPsMappingResolver as runV8PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v8.js?v=20260612-source-ledger-unmatched-1';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...V8_DEFAULT_OPTIONS,
};

const CSV_CELL_SAFE_CHAR_LIMIT = 30000;

export function normalizePsMappingOptions(options = {}) {
  return normalizeV8Options(options);
}

function text(value) {
  return String(value ?? '').trim();
}

function truthy(value) {
  return value === true || /^(yes|y|true|1|mandatory|required|req|must|audit)$/i.test(text(value));
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ');
}

function table2SourceId(row = {}, index = -1) {
  const existing = clean(row.table2SourceId || row.modelSourceId || row.sourceId || '');
  if (existing) return existing;
  const ordinal = clean(row.table2Row || row.modelTable2Row || row.sourceRow || row.rowIndex || row.modelRowIndex || '');
  if (ordinal) return `T2:${ordinal}`;
  if (Number.isFinite(index) && index >= 0) return `T2:${index + 1}`;
  const ps = clean(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || row.basePs || 'PS?');
  const bore = clean(row.modelBore ?? row.bore ?? 'BORE?');
  const line = clean(row.lineFamily || row.modelLineFamily || row.pipe || 'LINE?');
  const support = clean(row.supportTypesRequested || row.modelDtxrKeywords || row.dtxr || 'SUPPORT?');
  return `T2KEY:${ps}|${bore}|${line}|${support}`;
}

function withTable2Ids(rows = []) {
  return Array.isArray(rows) ? rows.map((row, index) => {
    const table2Id = table2SourceId(row, index);
    return {
      ...row,
      table2SourceId: table2Id,
      modelSourceId: row?.modelSourceId || table2Id,
    };
  }) : [];
}

function hasNode(row = {}) {
  return Boolean(clean(row.mappedNode || row.candidateNode || row.node || ''));
}

function hasTable2Ps(row = {}) {
  const ps = clean(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || '');
  return Boolean(ps && ps !== '-' && ps.toUpperCase() !== 'N/A');
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function compactIdList(rows = [], idFn) {
  return uniq(rows.map(idFn).map(clean).filter(Boolean)).join('|');
}

function compactTable2RowId(row = {}) {
  return clean(
    row.psnoModel
    || row.modelPsNo
    || row.modelPsNoRaw
    || row.psNo
    || row['PS NO']
    || row.table2SourceId
    || row.modelSourceId
  );
}

function compactTable1RowId(row = {}) {
  return clean(
    row.node
    || row.candidateNode
    || row.nodeNo
    || row['Node']
    || row.table1ContextId
  );
}

function compactSupportRowId(row = {}) {
  return clean(
    row.node
    || row.candidateNode
    || row.table1Node
    || row.nodeId
    || row.table1ContextId
    || row.coverageNode
    || row.coverageStatus
    || row.action
  );
}

function splitPipeListCell(value, limit = CSV_CELL_SAFE_CHAR_LIMIT) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length <= limit) return raw ? [raw] : [];

  const ids = raw.split('|').map((part) => part.trim()).filter(Boolean);
  if (!ids.length) return [raw.slice(0, limit)];

  const chunks = [];
  let current = '';
  for (const id of ids) {
    const next = current ? `${current}|${id}` : id;
    if (next.length > limit && current) {
      chunks.push(current);
      current = id;
    } else if (next.length > limit) {
      chunks.push(next.slice(0, limit));
      current = next.slice(limit);
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function addSplitFields(row = {}, key) {
  const chunks = splitPipeListCell(row[key]);
  if (chunks.length <= 1) return row;
  const next = { ...row, [key]: chunks[0] };
  for (let index = 1; index < chunks.length; index += 1) {
    next[`${key}${index}`] = chunks[index];
  }
  return next;
}

function addRowListSplitFields(row = {}) {
  return ['matchedRows', 'mandatoryUnmatchedRows', 'optionalUnmatchedRows']
    .reduce((current, key) => addSplitFields(current, key), row);
}

function table1ContextKey(row = {}, index = -1) {
  const node = clean(row.node || row.candidateNode || '');
  const ps = clean(row.table1PsNo || row.psNo || row.basePs || '');
  const line = clean(row.lineFamily || row.nodeLineFamily || '');
  const dn = clean(row.derivedDn ?? row.pipeSizeRaw ?? row.nps ?? '');
  if (node || ps || line || dn) return `${node}|${ps}|${line}|${dn}`;
  return `T1:${index + 1}`;
}

function buildTable2TallyRows(result = {}) {
  const sourceRows = withTable2Ids(
    Array.isArray(result.consolidatedTable2Rows) && result.consolidatedTable2Rows.length
      ? result.consolidatedTable2Rows
      : Array.isArray(result.table2SourceRows) && result.table2SourceRows.length
        ? result.table2SourceRows
        : (result.rows || result.outputRows || result.validatorRows || [])
  );
  const evidenceRows = withTable2Ids([...(result.rows || []), ...(result.outputRows || []), ...(result.validatorRows || []), ...(result.candidateRows || result.candidates || [])]);
  const matchedIds = new Set(evidenceRows.filter((row) => hasTable2Ps(row) && hasNode(row)).map((row) => row.table2SourceId));
  const matched = sourceRows.filter((row) => matchedIds.has(row.table2SourceId));
  const mandatoryUnmatched = sourceRows.filter((row) => !matchedIds.has(row.table2SourceId) && truthy(row.mandatory || row.modelMandatory || row.mandatoryRaw || row.isMandatory));
  const optionalUnmatched = sourceRows.filter((row) => !matchedIds.has(row.table2SourceId) && !truthy(row.mandatory || row.modelMandatory || row.mandatoryRaw || row.isMandatory));
  const total = sourceRows.length;
  const checkOk = matched.length + mandatoryUnmatched.length + optionalUnmatched.length === total;
  return [addRowListSplitFields({
    section: 'Table-2 PS No',
    sourceTotal: total,
    matched: matched.length,
    mandatoryUnmatched: mandatoryUnmatched.length,
    optionalUnmatched: optionalUnmatched.length,
    formula: `${matched.length} + ${mandatoryUnmatched.length} + ${optionalUnmatched.length} = ${total}`,
    check: checkOk ? 'OK' : 'CHECK',
    action: checkOk ? 'Tally balanced against Table-2 source rows.' : 'Tally mismatch; inspect source IDs.',
    matchedRows: compactIdList(matched, compactTable2RowId),
    mandatoryUnmatchedRows: compactIdList(mandatoryUnmatched, compactTable2RowId),
    optionalUnmatchedRows: compactIdList(optionalUnmatched, compactTable2RowId),
  })];
}

function buildTable1TallyRows(result = {}) {
  const sourceRows = Array.isArray(result.consolidatedTable1Rows) ? result.consolidatedTable1Rows : [];
  const sourceWithKeys = sourceRows.map((row, index) => ({ ...row, table1ContextId: table1ContextKey(row, index) }));
  const evidenceRows = [...(result.rows || []), ...(result.outputRows || []), ...(result.validatorRows || []), ...(result.candidateRows || result.candidates || [])];
  const matchedKeys = new Set(evidenceRows.filter((row) => hasTable2Ps(row) && hasNode(row)).map((row) => table1ContextKey({
    node: row.node || row.candidateNode,
    table1PsNo: row.table1PsNo,
    lineFamily: row.nodeLineFamily,
    derivedDn: row.derivedDn,
  })).filter(Boolean));
  const matched = sourceWithKeys.filter((row) => matchedKeys.has(row.table1ContextId));
  const mandatoryUnmatched = sourceWithKeys.filter((row) => !matchedKeys.has(row.table1ContextId) && truthy(row.mandatory || row.table1Mandatory || row.nodeMandatory));
  const optionalUnmatched = sourceWithKeys.filter((row) => !matchedKeys.has(row.table1ContextId) && !truthy(row.mandatory || row.table1Mandatory || row.nodeMandatory));
  const total = sourceWithKeys.length;
  const checkOk = matched.length + mandatoryUnmatched.length + optionalUnmatched.length === total;
  return [addRowListSplitFields({
    section: 'Table-1 Nodes',
    sourceTotal: total,
    matched: matched.length,
    mandatoryUnmatched: mandatoryUnmatched.length,
    optionalUnmatched: optionalUnmatched.length,
    formula: `${matched.length} + ${mandatoryUnmatched.length} + ${optionalUnmatched.length} = ${total}`,
    check: checkOk ? 'OK' : 'CHECK',
    action: checkOk ? 'Tally balanced against Table-1 node source rows.' : 'Tally mismatch; inspect Table-1 node context keys.',
    matchedRows: compactIdList(matched, compactTable1RowId),
    mandatoryUnmatchedRows: compactIdList(mandatoryUnmatched, compactTable1RowId),
    optionalUnmatchedRows: compactIdList(optionalUnmatched, compactTable1RowId),
  })];
}

function buildSupportTallyRows(result = {}) {
  const coverageRows = Array.isArray(result.supportCoverageRows) ? result.supportCoverageRows : [];
  if (!coverageRows.length) return [];
  const issueRows = coverageRows.filter((row) => {
    const status = clean(row.coverageStatus || row.status || '').toUpperCase();
    return status && !/^(OK|MATCHED|COVERED)$/.test(status);
  });
  const coveredRows = coverageRows.filter((row) => !issueRows.includes(row));
  return [addRowListSplitFields({
    section: 'Node Support Coverage',
    sourceTotal: coverageRows.length,
    matched: coveredRows.length,
    mandatoryUnmatched: issueRows.length,
    optionalUnmatched: 0,
    formula: `${coveredRows.length} covered + ${issueRows.length} issue = ${coverageRows.length}`,
    check: issueRows.length ? 'REVIEW' : 'OK',
    action: issueRows.length ? 'Review node-wise support coverage actions.' : 'Support coverage has no reported issue.',
    matchedRows: compactIdList(coveredRows, compactSupportRowId),
    mandatoryUnmatchedRows: compactIdList(issueRows, compactSupportRowId),
    optionalUnmatchedRows: '',
  })];
}

function withTally(result = {}) {
  const tallyRows = [
    ...buildTable2TallyRows(result),
    ...buildTable1TallyRows(result),
    ...buildSupportTallyRows(result),
  ];
  return {
    ...result,
    tallyRows,
    summary: {
      ...(result.summary || {}),
      tallyRows: tallyRows.length,
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV8PsMappingResolver({ ...input, options });
  return withTally(result);
}
