import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV11PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v11.js?v=20260612-line-family-enrichment-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

function text(value) {
  return String(value ?? '').trim();
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ');
}

function normalizePs(value) {
  const raw = clean(value).toUpperCase();
  if (!raw || raw === '-' || raw === 'N/A') return '';
  const beforeTag = raw.split('|')[0];
  const datum = beforeTag.replace(/\/DATUM\b/i, '');
  return datum.replace(/\.\d+\b/g, '').trim();
}

function normalizeLine(value) {
  const raw = clean(value).toUpperCase().replace(/^\/+/, '').replace(/\s+/g, '');
  if (!raw) return '';
  const nps = String.raw`(?:\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const match = raw.match(new RegExp(`(${nps}["']?-[A-Z]\d{4,})`, 'i'));
  if (match) return match[1].toUpperCase();
  const stem = raw.match(/\b([A-Z]\d{4,})\b/i);
  return stem ? stem[1].toUpperCase() : raw;
}

function normalizeDn(value) {
  const raw = clean(value);
  if (!raw) return '';
  const numeric = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric)) return raw.toUpperCase();
  return String(Math.round(numeric));
}

function nodeId(row = {}) {
  return clean(row.node || row.candidateNode || row.table1Node || row.nodeNo || row.Node || '');
}

function table1Ps(row = {}) {
  return clean(row.table1PsNo || row.psNo || row['PS No'] || row.basePs || row.psno || '');
}

function table1Line(row = {}) {
  return clean(row.nodeLineFamily || row.lineFamily || row.lineNoKey || row.lineNo || row['Line No'] || row.pipe || '');
}

function table1Dn(row = {}) {
  return clean(row.derivedDn ?? row.pipeSizeRaw ?? row.pipeSize ?? row['Pipe size'] ?? row.nps ?? '');
}

function duplicateGroupKey(row = {}) {
  const ps = normalizePs(table1Ps(row));
  const line = normalizeLine(table1Line(row));
  const dn = normalizeDn(table1Dn(row));
  if (!ps || !line || !dn) return '';
  return `${ps}|${line}|${dn}`;
}

function rowGroupKey(row = {}) {
  const ps = normalizePs(row.table1PsNo || row.mappedTable1PsNo || row.psNo || row.basePs || row.psnoModel || row.modelPsNo || '');
  const line = normalizeLine(row.nodeLineFamily || row.lineFamily || row.modelLineFamily || row.lineNoKey || row.pipe || '');
  const dn = normalizeDn(row.derivedDn ?? row.pipeSizeRaw ?? row.modelBore ?? row.bore ?? '');
  if (!ps || !line || !dn) return '';
  return `${ps}|${line}|${dn}`;
}

function sourceTable1Rows(result = {}) {
  const rows = Array.isArray(result.consolidatedTable1Rows) && result.consolidatedTable1Rows.length
    ? result.consolidatedTable1Rows
    : Array.isArray(result.table1SourceRows) && result.table1SourceRows.length
      ? result.table1SourceRows
      : Array.isArray(result.richReferenceRows) && result.richReferenceRows.length
        ? result.richReferenceRows
        : [];
  return rows;
}

function buildDuplicateMap(result = {}) {
  const groups = new Map();
  sourceTable1Rows(result).forEach((row) => {
    const key = duplicateGroupKey(row);
    const node = nodeId(row);
    if (!key || !node) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      node,
      ps: normalizePs(table1Ps(row)),
      line: normalizeLine(table1Line(row)),
      dn: normalizeDn(table1Dn(row)),
    });
  });

  const out = new Map();
  for (const [key, rows] of groups.entries()) {
    const nodes = [...new Set(rows.map((row) => row.node).filter(Boolean))];
    if (nodes.length <= 1) continue;
    const sample = rows[0] || {};
    out.set(key, {
      key,
      nodes,
      ps: sample.ps || key.split('|')[0] || '',
      line: sample.line || key.split('|')[1] || '',
      dn: sample.dn || key.split('|')[2] || '',
      note: `Duplicate Table-1 nodes for same PS No. + line family + bore: ${nodes.join('|')}. Verify duplicate PS No. or select correct node.`,
    });
  }
  return out;
}

function appendNote(existing, note) {
  const current = clean(existing);
  if (!note) return current;
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current} ${note}`;
}

function annotateRow(row = {}, duplicateMap) {
  if (!row || typeof row !== 'object') return row;
  const key = rowGroupKey(row);
  const duplicate = duplicateMap.get(key);
  if (!duplicate) return row;

  const nodeCoverageNote = appendNote(row.nodeCoverageNote || row.consolidatedNodeWiseAction || '', duplicate.note);
  const warnings = appendNote(row.warnings || '', 'DUPLICATE_TABLE1_NODE_CONTEXT');

  return {
    ...row,
    duplicateNodeContext: 'YES',
    duplicateNodeContextKey: duplicate.key,
    duplicateNodeContextNodes: duplicate.nodes.join('|'),
    nodeCoverageNote,
    consolidatedNodeWiseAction: nodeCoverageNote,
    warnings,
    reviewRequired: row.reviewRequired === false ? true : (row.reviewRequired ?? true),
    finalStatus: row.finalStatus === 'MATCHED' ? 'USER_REVIEW_REQUIRED' : row.finalStatus,
    confidence: row.confidence === 'HIGH' ? 'REVIEW' : row.confidence,
    reason: appendNote(row.reason || '', 'Duplicate Table-1 node context detected.'),
  };
}

function annotateRows(rows, duplicateMap) {
  return Array.isArray(rows) ? rows.map((row) => annotateRow(row, duplicateMap)) : rows;
}

function duplicateSummaryRows(duplicateMap) {
  return [...duplicateMap.values()].map((item) => ({
    section: 'Table-1 Duplicate Node Contexts',
    sourceTotal: item.nodes.length,
    matched: 0,
    mandatoryUnmatched: 0,
    optionalUnmatched: 0,
    formula: `${item.nodes.length} duplicate node(s)` ,
    check: 'REVIEW',
    action: item.note,
    matchedRows: item.nodes.join('|'),
    mandatoryUnmatchedRows: '',
    optionalUnmatchedRows: '',
    duplicateNodeContextKey: item.key,
  }));
}

export function runPsMappingResolver(input = {}) {
  const result = runV11PsMappingResolver(input);
  const duplicateMap = buildDuplicateMap(result);
  if (!duplicateMap.size) return result;

  const tallyRows = [
    ...(Array.isArray(result.tallyRows) ? result.tallyRows : []),
    ...duplicateSummaryRows(duplicateMap),
  ];

  return {
    ...result,
    rows: annotateRows(result.rows, duplicateMap),
    outputRows: annotateRows(result.outputRows, duplicateMap),
    validatorRows: annotateRows(result.validatorRows, duplicateMap),
    candidateRows: annotateRows(result.candidateRows, duplicateMap),
    candidates: annotateRows(result.candidates, duplicateMap),
    tallyRows,
    summary: {
      ...(result.summary || {}),
      duplicateTable1NodeContexts: duplicateMap.size,
    },
    approxConfig: {
      ...(result.approxConfig || {}),
      duplicateTable1NodeContextEnrichment: 'Addon enrichment: Candidate Matrix nodeCoverageNote is annotated when multiple Table-1 nodes share same base PS + line family + DN.',
    },
  };
}
