import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV18PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v18.js?v=20260614-support-number-wording-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const SUPPORT_ORDER = Object.freeze(['REST', 'GUIDE', 'LINE_STOP']);
const MULTI_VALUE_RE = /[,\n]/;
const JOINED_ISONOTE_RE = /\s+\|\s+/;

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function labelSupport(type) {
  return type === 'LINE_STOP' ? 'LINE STOP' : clean(type).replace(/_/g, ' ');
}

function supportCode(label) {
  const text = clean(label).toUpperCase().replace(/[\s-]+/g, '_');
  if (/^LINE_?STOP$/.test(text) || text === 'STOP') return 'LINE_STOP';
  if (text === 'GUIDE') return 'GUIDE';
  if (text === 'REST') return 'REST';
  return text;
}

function parseSupportList(value) {
  const source = clean(value);
  if (!source) return [];
  const seen = new Set();
  const out = [];
  for (const part of source.split(/\s*\+\s*|\s*;\s*|\s*,\s*/)) {
    const code = supportCode(part);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return SUPPORT_ORDER.filter((type) => seen.has(type)).concat(out.filter((type) => !SUPPORT_ORDER.includes(type)));
}

function supportsFromIsonote(value) {
  const text = clean(value).toUpperCase();
  const seen = new Set();
  if (/\bREST\b|PIPE\s+REST|\bXRT\b/.test(text)) seen.add('REST');
  if (/\bGUIDE\b/.test(text)) seen.add('GUIDE');
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bSTOP\b|\bLIM\b/.test(text)) seen.add('LINE_STOP');
  return SUPPORT_ORDER.filter((type) => seen.has(type));
}

function table1SupportNo(row = {}) {
  return clean(row.table1SupportNo || row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 Support No'] || row['Table-1 PS No'] || '');
}

function baseSupportNo(row = {}) {
  return clean(table1SupportNo(row).split('|')[0])
    .replace(/^\//, '')
    .replace(/\/DATUM$/i, '')
    .replace(/\.\s*$/i, '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function lineFamily(row = {}) {
  return clean(row.nodeLineFamily || row.t1LineFamily || row['T1 Line Family'] || '');
}

function derivedDn(row = {}) {
  return clean(row.derivedDn || row.table1Dn || row.dn || row['Derived DN'] || '');
}

function splitCommaList(value) {
  const source = clean(value);
  if (!source) return [];
  return source.split(/\s*,\s*/).map(clean).filter(Boolean);
}

function splitJoinedIsonotes(value) {
  const source = clean(value);
  if (!source) return [];
  return source.split(JOINED_ISONOTE_RE).map(clean).filter(Boolean);
}

function firstAlignedValue(values, index, fallback = '') {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  return values[index] || fallback;
}

function hasMultipleTable1Context(row = {}) {
  return MULTI_VALUE_RE.test(table1SupportNo(row))
    || MULTI_VALUE_RE.test(lineFamily(row))
    || MULTI_VALUE_RE.test(derivedDn(row))
    || JOINED_ISONOTE_RE.test(clean(row.isonote || row.ISONOTE || row.nodeIsonote || row.nodeIsonoteRaw || ''));
}

function isAtomicSupportNo(value) {
  const text = clean(value);
  return !!text && !MULTI_VALUE_RE.test(text) && !JOINED_ISONOTE_RE.test(text);
}

function groupKey(row = {}) {
  const supportNo = table1SupportNo(row);
  if (!supportNo || !isAtomicSupportNo(supportNo)) return '';
  return [supportNo, candidateNode(row), lineFamily(row), derivedDn(row)].join('||');
}

function setAtomicField(row, names, value) {
  const next = { ...row };
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(next, name) || name === names[0]) next[name] = value;
  }
  return next;
}

function atomicRowsForRepresentative(row = {}) {
  if (!hasMultipleTable1Context(row)) return [row];

  const supportNos = splitCommaList(table1SupportNo(row));
  if (supportNos.length <= 1) return [row];

  const lineFamilies = splitCommaList(lineFamily(row));
  const dns = splitCommaList(derivedDn(row));
  const isonoteRaw = clean(row.isonote || row.ISONOTE || row.nodeIsonote || row.nodeIsonoteRaw || '');
  const isonotes = splitJoinedIsonotes(isonoteRaw);
  const aligned = [lineFamilies, dns, isonotes].every((values) => values.length <= 1 || values.length === supportNos.length);

  if (!aligned) {
    return [{
      ...row,
      suppressSyntheticMissingSupport: true,
      ambiguousMultiTable1Context: true,
      reason: clean([row.reason, 'AMBIGUOUS_MULTI_TABLE1_CONTEXT: multiple Table-1 supports are merged; split by PS No + Line + DN before generating missing-support rows.'].filter(Boolean).join(' ')),
      psNoWiseAction: clean(row.psNoWiseAction || 'Manual review: split merged Table-1 support context before adding missing supports.'),
      supportNoWiseAction: clean(row.supportNoWiseAction || 'Manual review: split merged Table-1 support context before adding missing supports.'),
      consolidatedNodeWiseAction: clean(row.consolidatedNodeWiseAction || 'Manual review: split merged Table-1 support context before adding missing supports.'),
    }];
  }

  return supportNos.map((supportNo, index) => {
    const line = firstAlignedValue(lineFamilies, index, lineFamily(row));
    const dn = firstAlignedValue(dns, index, derivedDn(row));
    const iso = firstAlignedValue(isonotes, index, isonoteRaw);
    let next = { ...row };
    next = setAtomicField(next, ['table1SupportNo', 'table1PsNo', 'mappedTable1PsNo', 'psNo', 'Table-1 Support No', 'Table-1 PS No'], supportNo);
    next = setAtomicField(next, ['nodeLineFamily', 't1LineFamily', 'T1 Line Family'], line);
    next = setAtomicField(next, ['derivedDn', 'table1Dn', 'dn', 'Derived DN'], dn);
    next = setAtomicField(next, ['isonote', 'ISONOTE', 'nodeIsonote', 'nodeIsonoteRaw'], iso);
    const supports = supportsFromIsonote(iso);
    next.missingNodeRestraints = supports.join('+');
    next.atomicTable1ContextFromMerged = true;
    next.atomicTable1ContextIndex = index + 1;
    next.atomicTable1ContextCount = supportNos.length;
    return next;
  });
}

function representativeRows(rows = []) {
  const reps = new Map();
  for (const row of rows) {
    const atomics = atomicRowsForRepresentative(row);
    for (const atomic of atomics) {
      if (atomic.suppressSyntheticMissingSupport) continue;
      const key = groupKey(atomic);
      if (!key || reps.has(key)) continue;
      reps.set(key, atomic);
    }
  }
  return reps;
}

function parseProposedPairs(row = {}) {
  const source = clean(row.proposedMissingSupportNo || row.proposedMissingSupportPsNo || '');
  const pairs = [];
  if (source) {
    for (const chunk of source.split(/\s*;\s*/)) {
      const match = chunk.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (!match) continue;
      const type = supportCode(match[1]);
      const supportNo = clean(match[2]);
      if (type && supportNo && isAtomicSupportNo(supportNo)) pairs.push({ type, supportNo });
    }
  }

  if (pairs.length) return pairs;

  const missing = parseSupportList(row.missingNodeRestraints);
  const base = baseSupportNo(row) || 'SUPPORT-UNKNOWN';
  return missing.map((type, index) => ({ type, supportNo: `${base}.X${index + 1}` }));
}

function hasSyntheticRows(rows = []) {
  return rows.some((row) => row?.source === 'TABLE1C_MISSING_SUPPORT' || row?.syntheticMissingSupport === true);
}

function stripProposedColumnValue(row = {}) {
  return {
    ...row,
    proposedMissingSupportNo: '',
    proposedMissingSupportPsNo: '',
  };
}

function buildSyntheticRow(rep = {}, item = {}, index = 0) {
  const label = labelSupport(item.type);
  const supportNo = clean(item.supportNo) || `${baseSupportNo(rep) || 'SUPPORT-UNKNOWN'}.X${index + 1}`;
  const reason = `Table-1 data has ${label} but missing in Table-2 data.`;
  const action = `Add missing ${label} as per Table 1's ISONOTE`;
  const line = lineFamily(rep);
  const dn = derivedDn(rep);

  return {
    ...rep,
    psnoModel: supportNo,
    supportNoModel: supportNo,
    modelPsNo: supportNo,
    rawPsNo: supportNo,
    basePs: baseSupportNo(rep) || supportNo,
    modelBore: dn || rep.modelBore || rep.t2Bore || '',
    t2Bore: dn || rep.t2Bore || rep.modelBore || '',
    bore: dn || rep.bore || rep.modelBore || '',
    lineFamily: line || rep.lineFamily || rep.t2LineFamily || '',
    t2LineFamily: line || rep.t2LineFamily || rep.lineFamily || '',
    supportTypesRequested: label,
    t2Keywords: label,
    dtxr: `MISSING ${label} - proposed from Table-1 ISONOTE`,
    DTXR: `MISSING ${label} - proposed from Table-1 ISONOTE`,
    supportMatch: `Missing ${label}`,
    supportGapMatch: '',
    gapMatch: '',
    supportGapBasis: '',
    reason,
    psNoWiseAction: action,
    supportNoWiseAction: action,
    nodeCoverageNote: reason,
    reviewAction: action,
    source: 'TABLE1C_MISSING_SUPPORT',
    table2SourceId: 'PROPOSED_FROM_TABLE1_ISONOTE',
    modelSourceId: supportNo,
    syntheticMissingSupport: true,
    proposedMissingSupportNo: '',
    proposedMissingSupportPsNo: '',
    missingNodeRestraints: rep.missingNodeRestraints || label,
    t1NodeRestraints: rep.t1NodeRestraints || '',
    t2CoveredRestraints: rep.t2CoveredRestraints || '',
    extraTable2Restraints: rep.extraTable2Restraints || '',
    consolidatedNodeWiseAction: rep.consolidatedNodeWiseAction || action,
    syntheticAtomicTable1Context: rep.atomicTable1ContextFromMerged === true,
  };
}

function addSyntheticMissingSupportRows(rows) {
  if (!Array.isArray(rows)) return rows;
  if (hasSyntheticRows(rows)) return rows.map(stripProposedColumnValue);

  const cleanedRows = rows.map(stripProposedColumnValue);
  const reps = representativeRows(rows);
  const syntheticRows = [];

  for (const rep of reps.values()) {
    const missing = parseSupportList(rep.missingNodeRestraints);
    if (!missing.length) continue;

    const proposed = parseProposedPairs(rep).filter((item) => missing.includes(item.type));
    proposed.forEach((item, index) => syntheticRows.push(buildSyntheticRow(rep, item, index)));
  }

  return syntheticRows.length ? [...cleanedRows, ...syntheticRows] : cleanedRows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV18PsMappingResolver(input);
  return {
    ...result,
    rows: addSyntheticMissingSupportRows(result.rows),
    outputRows: addSyntheticMissingSupportRows(result.outputRows),
    validatorRows: addSyntheticMissingSupportRows(result.validatorRows),
    candidateRows: addSyntheticMissingSupportRows(result.candidateRows),
    candidates: addSyntheticMissingSupportRows(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      supportNoSyntheticActionRows: 'Readable v20: missing Table-1 supports are emitted as synthetic Table-2 candidate rows from atomic Table-1 support contexts only. Merged multi-PS contexts are split by PS No + Line + DN before .X rows are generated; ambiguous merged contexts are blocked for manual review.',
    },
  };
}
