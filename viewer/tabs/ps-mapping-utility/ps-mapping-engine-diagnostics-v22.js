import {
  DEFAULT_OPTIONS as BASE_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeBasePsMappingOptions,
  runPsMappingResolver as runV21PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v21.js';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = Object.freeze({
  ...BASE_DEFAULT_OPTIONS,
  supportNoPrefixKeywords: 'PS,SL',
  duplicateSupportKeyMode: 'warn',
});

export function normalizePsMappingOptions(options = {}) {
  const normalized = normalizeBasePsMappingOptions(options);
  return {
    ...normalized,
    supportNoPrefixKeywords: clean(options.supportNoPrefixKeywords ?? normalized.supportNoPrefixKeywords ?? DEFAULT_OPTIONS.supportNoPrefixKeywords),
    duplicateSupportKeyMode: clean(options.duplicateSupportKeyMode ?? normalized.duplicateSupportKeyMode ?? DEFAULT_OPTIONS.duplicateSupportKeyMode) || 'warn',
  };
}

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

function splitCsv(value) {
  return clean(value)
    .split(/\s*,\s*/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function supportNoPrefixKeywords(options = {}) {
  const prefixes = splitCsv(options.supportNoPrefixKeywords || DEFAULT_OPTIONS.supportNoPrefixKeywords);
  return prefixes.length ? prefixes : splitCsv(DEFAULT_OPTIONS.supportNoPrefixKeywords);
}

function table1SupportNo(row = {}) {
  return clean(row.table1SupportNo || row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 Support No'] || row['Table-1 PS No'] || '');
}

function baseSupportNo(value) {
  return clean(value)
    .split('|')[0]
    .replace(/^\//, '')
    .replace(/\/DATUM$/i, '')
    .replace(/\.\d+\b/g, '')
    .trim()
    .toUpperCase();
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function lineFamily(row = {}) {
  return clean(row.nodeLineFamily || row.t1LineFamily || row['T1 Line Family'] || '');
}

function pipeSize(row = {}) {
  return clean(row.pipeSizeRaw || row.pipeSize || row.nps || row['Pipe Size'] || row['Pipe size'] || row.derivedDn || row.table1Dn || row.dn || row['Derived DN'] || '');
}

function derivedDn(row = {}) {
  return clean(row.derivedDn || row.table1Dn || row.nodeDerivedDn || row.dn || row['Derived DN'] || '');
}

function keyParts(row = {}) {
  const supportNo = baseSupportNo(table1SupportNo(row));
  const line = upper(lineFamily(row));
  const size = upper(pipeSize(row) || derivedDn(row));
  const node = upper(candidateNode(row));
  if (!supportNo || !line || !size || !node) return null;
  return { supportNo, line, size, node };
}

function duplicateKey(row = {}) {
  const parts = keyParts(row);
  if (!parts) return '';
  return `${parts.supportNo} :: ${parts.line} :: ${parts.size} :: ${parts.node}`;
}

function sourceIdentity(row = {}) {
  return clean([
    row.source,
    row.table1SourceId || row.table1Row || row.sourceRow || row.modelSourceId || row.table2SourceId,
    row.nodeIsonote || row.isonote || row.ISONOTE,
  ].filter(Boolean).join(' | '));
}

function buildDuplicateSupportKeyMap(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    if (!row || row.syntheticMissingSupport === true || row.source === 'TABLE1C_MISSING_SUPPORT') continue;
    const key = duplicateKey(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const out = new Map();
  for (const [key, groupRows] of groups.entries()) {
    const identities = [...new Set(groupRows.map(sourceIdentity).filter(Boolean))];
    const supportNos = [...new Set(groupRows.map((row) => baseSupportNo(table1SupportNo(row))).filter(Boolean))];
    const nodes = [...new Set(groupRows.map(candidateNode).filter(Boolean))];
    if (groupRows.length <= 1 || identities.length <= 1) continue;
    out.set(key, {
      key,
      count: groupRows.length,
      supportNos,
      nodes,
      note: `DUPLICATE_SUPPORT_KEY: ${groupRows.length} candidate rows share Support No + Line + Pipe Size/DN + Node key (${key}). Manual review: verify whether these are duplicate Table-1 rows or split them using Support No + Line + Pipe Size + Node${nodes.length ? `; node(s): ${nodes.join('|')}` : ''}.`,
    });
  }
  return out;
}

function append(existing, next) {
  const a = clean(existing);
  const b = clean(next);
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a} ${b}`;
}

function patchDuplicateRow(row = {}, duplicate) {
  if (!duplicate) return row;
  return {
    ...row,
    duplicateSupportKey: duplicate.key,
    duplicateSupportKeyCount: duplicate.count,
    duplicateSupportKeyNote: duplicate.note,
    reason: append(row.reason, duplicate.note),
    nodeCoverageNote: append(row.nodeCoverageNote, duplicate.note),
    consolidatedNodeWiseAction: append(row.consolidatedNodeWiseAction, 'Manual review: duplicate Support No + Line + Pipe Size/DN + Node key detected.'),
    supportNoWiseAction: row.supportNoWiseAction || row.psNoWiseAction || 'Manual review: duplicate key detected.',
    psNoWiseAction: row.psNoWiseAction || row.supportNoWiseAction || 'Manual review: duplicate key detected.',
    reviewRequired: true,
  };
}

function patchRows(rows, duplicateMap) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => patchDuplicateRow(row, duplicateMap.get(duplicateKey(row))));
}

function patchPrefixMetadata(row = {}, prefixes = []) {
  return {
    ...row,
    supportNoPrefixKeywords: prefixes.join(','),
    supportNoPrefixNote: `Support No. prefixes configured: ${prefixes.join(', ') || 'any alphanumeric prefix'}. Existing support numbers keep their original prefix; missing support rows use <SupportNo>.Xn.`,
  };
}

function patchPrefixRows(rows, prefixes) {
  return Array.isArray(rows) ? rows.map((row) => patchPrefixMetadata(row, prefixes)) : rows;
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV21PsMappingResolver({ ...input, options });
  const rowsForDuplicateScan = Array.isArray(result.candidateRows) && result.candidateRows.length
    ? result.candidateRows
    : Array.isArray(result.candidates) ? result.candidates : [];
  const duplicateMap = upper(options.duplicateSupportKeyMode) === 'SILENT'
    ? new Map()
    : buildDuplicateSupportKeyMap(rowsForDuplicateScan);
  const prefixes = supportNoPrefixKeywords(options);

  function patchCollection(rows) {
    return patchPrefixRows(patchRows(rows, duplicateMap), prefixes);
  }

  return {
    ...result,
    rows: patchCollection(result.rows),
    outputRows: patchCollection(result.outputRows),
    validatorRows: patchCollection(result.validatorRows),
    candidateRows: patchCollection(result.candidateRows),
    candidates: patchCollection(result.candidates),
    summary: {
      ...(result.summary || {}),
      duplicateSupportKeys: duplicateMap.size,
      supportNoPrefixKeywords: prefixes.join(','),
    },
    approxConfig: {
      ...(result.approxConfig || {}),
      supportNoPrefixKeywords: prefixes.join(','),
      duplicateSupportKeyDiagnostics: 'Readable v22: duplicate Support No + Line + Pipe Size/DN + Node keys are flagged in Candidate Matrix instead of silently reusing the first representative row.',
    },
  };
}
