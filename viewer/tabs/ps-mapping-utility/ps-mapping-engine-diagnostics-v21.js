import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV20PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v20.js?v=20260614-atomic-synthetic-missing-support-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const MULTI_VALUE_RE = /[,\n]/;
const JOINED_ISONOTE_RE = /\s+\|\s+/;

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function table1SupportNo(row = {}) {
  return clean(row.table1SupportNo || row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 Support No'] || row['Table-1 PS No'] || '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function lineFamily(row = {}) {
  return clean(row.nodeLineFamily || row.t1LineFamily || row['T1 Line Family'] || '');
}

function derivedDn(row = {}) {
  return clean(row.derivedDn || row.table1Dn || row.nodeDerivedDn || row.dn || row['Derived DN'] || '');
}

function isonoteText(row = {}) {
  return clean(row.isonote || row.ISONOTE || row.nodeIsonote || row.nodeIsonoteRaw || row['ISONOTE'] || '');
}

function hasMergedTable1Context(row = {}) {
  return MULTI_VALUE_RE.test(table1SupportNo(row))
    || MULTI_VALUE_RE.test(lineFamily(row))
    || MULTI_VALUE_RE.test(derivedDn(row))
    || JOINED_ISONOTE_RE.test(isonoteText(row));
}

function ambiguousContextReason(row = {}) {
  const node = candidateNode(row);
  const supportNo = table1SupportNo(row);
  const line = lineFamily(row);
  const dn = derivedDn(row);
  const context = [
    node ? `candidate node ${node}` : 'one candidate context',
    supportNo ? `Table-1 Support No ${supportNo}` : '',
    line ? `Line ${line}` : '',
    dn ? `DN ${dn}` : '',
  ].filter(Boolean).join('; ');
  return `AMBIGUOUS_MULTI_TABLE1_CONTEXT: multiple Table-1 supports are merged into ${context}. Manual review: split by Support No + Line + DN before generating missing-support rows.`;
}

function isSyntheticFromMergedContext(row = {}) {
  if (row.syntheticAtomicTable1Context === true) return true;
  if (row.source !== 'TABLE1C_MISSING_SUPPORT' && row.syntheticMissingSupport !== true) return false;
  return hasMergedTable1Context(row) || /,/.test(clean(row.psnoModel || row.supportNoModel || row.modelPsNo || ''));
}

function patchRow(row = {}) {
  if (!hasMergedTable1Context(row)) return row;
  const reason = ambiguousContextReason(row);
  const action = 'Manual review: split merged Table-1 support context before adding missing supports.';
  return {
    ...row,
    suppressSyntheticMissingSupport: true,
    ambiguousMultiTable1Context: true,
    supportMatch: 'Ambiguous multi Table-1 context',
    supportGapMatch: '',
    gapMatch: '',
    reason,
    psNoWiseAction: action,
    supportNoWiseAction: action,
    nodeCoverageNote: reason,
    consolidatedNodeWiseAction: action,
    proposedMissingSupportNo: '',
    proposedMissingSupportPsNo: '',
  };
}

function patchRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows
    .filter((row) => !isSyntheticFromMergedContext(row))
    .map(patchRow);
}

export function runPsMappingResolver(input = {}) {
  const result = runV20PsMappingResolver(input);
  return {
    ...result,
    rows: patchRows(result.rows),
    outputRows: patchRows(result.outputRows),
    validatorRows: patchRows(result.validatorRows),
    candidateRows: patchRows(result.candidateRows),
    candidates: patchRows(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      supportNoMergedContextGuard: 'Readable v21: merged multi-Table-1 contexts are marked AMBIGUOUS_MULTI_TABLE1_CONTEXT and synthetic .X rows generated from such merged contexts are suppressed.',
    },
  };
}
