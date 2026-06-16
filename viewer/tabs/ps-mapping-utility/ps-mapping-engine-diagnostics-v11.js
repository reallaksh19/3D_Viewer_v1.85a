import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV10PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v10.js?v=20260612-table1-source-ledger-audit-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

function normalizeLineKey(value) {
  return String(value ?? '').toUpperCase().replace(/^\/+/, '').replace(/-HC\b/g, '').replace(/\s+/g, '').trim();
}

function extractLineFamily(value) {
  const text = normalizeLineKey(value);
  if (!text) return '';
  const nps = String.raw`(?:\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const match = text.match(new RegExp(`(${nps}["']?-[A-Z]\d{4,})`, 'i'));
  if (match) return match[1].toUpperCase();
  const stem = text.match(/\b([A-Z]\d{4,})\b/i);
  return stem ? stem[1].toUpperCase() : '';
}

function clean(value) {
  return String(value ?? '').trim();
}

function rowKeys(row = {}) {
  const keys = [];
  for (const value of [
    row.table2SourceId,
    row.modelSourceId,
    row.table2Row ? `T2:${row.table2Row}` : '',
    row.sourceRow ? `T2:${row.sourceRow}` : '',
    row.psnoModel,
    row.modelPsNo,
    row.rawPsNo,
  ]) {
    const key = clean(value);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function buildTable2Lookup(result = {}) {
  const lookup = new Map();
  const rows = Array.isArray(result.consolidatedTable2Rows) && result.consolidatedTable2Rows.length
    ? result.consolidatedTable2Rows
    : Array.isArray(result.table2SourceRows) && result.table2SourceRows.length
      ? result.table2SourceRows
      : [];

  rows.forEach((row) => {
    const enriched = {
      ...row,
      lineFamily: row.lineFamily || row.modelLineFamily || extractLineFamily(row.pipe || row.pipeKey || row.lineNo || row.lineFamily || ''),
    };
    for (const key of rowKeys(enriched)) lookup.set(key, enriched);
  });
  return lookup;
}

function enrichLineFamily(row = {}, lookup) {
  if (!row || typeof row !== 'object') return row;
  const existing = clean(row.lineFamily || row.modelLineFamily);
  if (existing) return row;

  let source = null;
  for (const key of rowKeys(row)) {
    source = lookup.get(key);
    if (source) break;
  }

  const lineFamily = clean(
    source?.lineFamily
    || source?.modelLineFamily
    || extractLineFamily(source?.pipe || source?.pipeKey || row.pipe || row.pipeKey || row.lineNo || '')
  );

  if (!lineFamily) return row;
  return {
    ...row,
    lineFamily,
    modelLineFamily: row.modelLineFamily || lineFamily,
  };
}

function enrichRows(rows, lookup) {
  return Array.isArray(rows) ? rows.map((row) => enrichLineFamily(row, lookup)) : rows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV10PsMappingResolver(input);
  const lookup = buildTable2Lookup(result);
  const consolidatedTable2Rows = enrichRows(result.consolidatedTable2Rows, lookup);
  const table2SourceRows = enrichRows(result.table2SourceRows || consolidatedTable2Rows, lookup);

  return {
    ...result,
    consolidatedTable2Rows,
    table2SourceRows,
    rows: enrichRows(result.rows, lookup),
    outputRows: enrichRows(result.outputRows, lookup),
    validatorRows: enrichRows(result.validatorRows, lookup),
    candidateRows: enrichRows(result.candidateRows, lookup),
    candidates: enrichRows(result.candidates, lookup),
  };
}
