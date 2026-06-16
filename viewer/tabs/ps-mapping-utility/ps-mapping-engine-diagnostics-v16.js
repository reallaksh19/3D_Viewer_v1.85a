import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV15PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v15.js?v=20260614-readable-ps-actions-1';
import { supportTypesFromText } from './ps-mapping-support-gap-logic.js?v=20260614-support-parent-gap-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const SUPPORT_ORDER = Object.freeze(['REST', 'GUIDE', 'LINE_STOP']);

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

function labelSupport(type) {
  return type === 'LINE_STOP' ? 'LINE STOP' : clean(type).replace(/_/g, ' ');
}

function modelPsNo(row = {}) {
  return clean(row.psnoModel || row.modelPsNo || row.rawPsNo || row.basePs || row['PSNO_Model'] || '');
}

function table1PsNo(row = {}) {
  return clean(row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 PS No'] || '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function normalizeSupportSource(...values) {
  return values
    .map((value) => String(value ?? '').toUpperCase())
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/[\[\](){}:;,|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supportSet(...values) {
  const source = normalizeSupportSource(...values);
  const out = supportTypesFromText(source);

  // A directional anchor/anchor-on-shoe is a stop/line-stop support in the mapping
  // matrix.  Do not let the word "shoe" add a row-local REST match.
  if (/\bDIRECTIONAL\s+ANCHOR\b|\bANCHOR\s+ON\s+SHOE\b/.test(source)) {
    out.add('LINE_STOP');
    out.delete('REST');
  }

  return out;
}

function t1Text(row = {}) {
  return [
    row.supportTypesAvailable,
    row.nodeMasterKeywords,
    row.table1SupportTypes,
    row.nodeIsonote,
    row.nodeIsonoteRaw,
    row.isonote,
    row.ISONOTE,
    row['ISONOTE'],
  ].filter(Boolean).join(' ');
}

function t2Text(row = {}) {
  return [
    row.supportTypesRequested,
    row.modelDtxrKeywords,
    row.dtxr,
    row.t2Keywords,
    row.DTXR,
    row['T2 Keywords'],
  ].filter(Boolean).join(' ');
}

function t1Types(row = {}) {
  return supportSet(t1Text(row));
}

function t2Types(row = {}) {
  return supportSet(t2Text(row));
}

function orderedTypes(types) {
  return SUPPORT_ORDER.filter((type) => types.has(type));
}

function rowLocalSupportMatch(row = {}) {
  if (!table1PsNo(row)) return 'No Table-1 PS match';

  const t1 = t1Types(row);
  const t2 = t2Types(row);

  if (!t2.size) {
    const missingAll = orderedTypes(t1).map(labelSupport);
    return missingAll.length ? `Missing ${missingAll.join(', ')}` : '';
  }

  const parts = [];
  for (const type of orderedTypes(t2)) {
    parts.push(t1.has(type) ? `${labelSupport(type)} Match` : `Missing ${labelSupport(type)}`);
  }
  return parts.join('; ');
}

function gapStatus(row = {}) {
  return clean(row.supportGapMatch || row.gapMatch || row.supportGapBasis || row['Support Gap Match'] || '');
}

function gapKindFromStatus(status = '') {
  const s = upper(status);
  if (s.includes('LINE_STOP_GAP') || s.includes('LINE STOP')) return 'LINE_STOP';
  if (s.includes('GUIDE_GAP') || s.includes('GUIDE')) return 'GUIDE';
  return '';
}

function gapValueFromRow(row = {}, kind = '') {
  if (kind === 'LINE_STOP') return row.nodeLineStopGapMm ?? row.table1LineStopGapMm ?? row.lineStopGapMm ?? '';
  if (kind === 'GUIDE') return row.nodeGuideGapMm ?? row.table1GuideGapMm ?? row.guideGapMm ?? '';
  return '';
}

function numericText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return clean(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

function rowGapAction(row = {}, status = '') {
  const kind = gapKindFromStatus(status);
  if (!kind) return '';
  const value = gapValueFromRow(row, kind);
  if (value === '' || value == null) return '';
  return `Correct Table-2 ${labelSupport(kind)} GAP to Table-1's ${labelSupport(kind)} GAP ${numericText(value)} mm value.`;
}

function legacyGapReason(row = {}, status = '') {
  if (!status) return '';
  const detail = clean(row.gapMatchDetail || row.supportGapDetail || row.reviewAction || '');
  if (detail && /gap/i.test(detail)) return detail;

  const kind = gapKindFromStatus(status);
  const value = gapValueFromRow(row, kind);
  const label = kind ? `${labelSupport(kind)} GAP` : 'GAP';
  const support = kind ? labelSupport(kind) : 'support';
  const valueText = value === '' || value == null ? '' : `; Table-1C ${label} is ${numericText(value)} mm`;

  if (/CONFLICT/i.test(status)) return `Support gap conflict${valueText}.`;
  if (/MISSING_TABLE2/i.test(status)) return `Support gap missing in Table-2 for ${support}${valueText}.`;
  if (/MISSING_TABLE1/i.test(status)) return `Support gap exists in Table-2 for ${support}, but Table-1C ${label} is missing.`;
  if (/EXACT/i.test(status)) return `${label} comparison matched.`;
  return '';
}

function hasDuplicateNodeContext(row = {}) {
  return upper(`${row.duplicateNodeContext || ''} ${row.warnings || ''} ${row.reason || ''} ${row.nodeCoverageNote || ''}`)
    .includes('DUPLICATE');
}

function legacyDuplicateReason(row = {}) {
  if (!hasDuplicateNodeContext(row)) return '';
  return 'Two or more consolidated Table-1C rows have same Base PS + Line Family + DN + support basis. Select node manually. Duplicate Table-1 node context detected.';
}

function extraRequestedTypes(row = {}) {
  const t1 = t1Types(row);
  const t2 = t2Types(row);
  return orderedTypes(t2).filter((type) => !t1.has(type));
}

function legacyReason(row = {}, supportMatch = rowLocalSupportMatch(row), status = gapStatus(row)) {
  if (!table1PsNo(row)) return 'No Table-1 PS No. match for Table-2 PS.';

  const gapReason = legacyGapReason(row, status);
  if (gapReason) return gapReason;

  const extras = extraRequestedTypes(row);
  if (extras.length) {
    const labels = extras.map(labelSupport).join(', ');
    const duplicateTail = hasDuplicateNodeContext(row) ? ' Duplicate Table-1 node context detected.' : '';
    return `Review required: Table-2 requests ${labels}, but Table-1 support basis is missing ${labels}.${duplicateTail}`;
  }

  const duplicateReason = legacyDuplicateReason(row);
  if (duplicateReason) return duplicateReason;

  const existing = clean(row.reason || '');
  if (!existing) return '';

  // Keep true resolver diagnostics, but do not echo the newer PS-action wording in Reason.
  if (/^Table-1 support missing in Table-2:/i.test(existing)) return '';
  if (/^Candidate covered by Table-2\.?$/i.test(existing)) return '';
  return existing;
}

function rowSpecificAction(row = {}, supportMatch = rowLocalSupportMatch(row), status = gapStatus(row)) {
  if (!table1PsNo(row)) return 'Manual review: No Match in Table-1';

  const gapAction = rowGapAction(row, status);
  if (gapAction) return gapAction;

  const extras = extraRequestedTypes(row);
  if (extras.includes('GUIDE')) return 'Remove or reclassify extra GUIDE in Table-2; Table-1 does not require GUIDE.';
  if (extras.length) {
    const label = extras.map(labelSupport).join(', ');
    return `Remove or reclassify extra ${label} in Table-2; Table-1 does not require ${label}.`;
  }

  return '';
}

function conciseConsolidatedAction(row = {}, previousRowAction = '') {
  if (!table1PsNo(row)) return 'No Table-1 PS No. match for Table-2 PS. Action: manual review';
  const action = clean(previousRowAction || row.consolidatedNodeWiseAction || '');
  if (!action) return '';

  // v15 scoped format is: PS ... / Node ... / Line ... / DN ...: action body
  const scoped = action.match(/^PS\s+.+?\/\s+DN\s+[^:]+:\s*(.+)$/i);
  if (scoped) return clean(scoped[1]);

  const genericScoped = action.match(/^.+?:\s*(.+)$/);
  if (genericScoped && /^PS\s+/i.test(action)) return clean(genericScoped[1]);
  return action;
}

function coverageNote(row = {}, supportMatch = '', status = '') {
  if (!table1PsNo(row)) return 'No Table-1 PS No. match for Table-2 PS.';
  const parts = [];
  const node = candidateNode(row);
  const model = modelPsNo(row);
  if (supportMatch) parts.push(`Support: ${supportMatch}`);
  if (status) parts.push(`Gap: ${status}`);
  if (!parts.length) parts.push('Row diagnostic restored from resolver context');
  const scope = [node ? `Node ${node}` : '', model ? `Table-2 ${model}` : ''].filter(Boolean).join(' / ');
  return scope ? `${scope}: ${parts.join('; ')}.` : `${parts.join('; ')}.`;
}

function presentRow(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const supportMatch = rowLocalSupportMatch(row);
  const status = gapStatus(row);
  const groupBodyBeforeRowAction = row.psNoWiseAction;
  return {
    ...row,
    supportMatch,
    supportGapMatch: status,
    reason: legacyReason(row, supportMatch, status),
    psNoWiseAction: rowSpecificAction(row, supportMatch, status),
    nodeCoverageNote: coverageNote(row, supportMatch, status),
    consolidatedNodeWiseAction: conciseConsolidatedAction(row, groupBodyBeforeRowAction),
  };
}

function presentRows(rows) {
  return Array.isArray(rows) ? rows.map(presentRow) : rows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV15PsMappingResolver(input);
  return {
    ...result,
    rows: presentRows(result.rows),
    outputRows: presentRows(result.outputRows),
    validatorRows: presentRows(result.validatorRows),
    candidateRows: presentRows(result.candidateRows),
    candidates: presentRows(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      psMappingPresentationRules: 'Readable v16: Reason is row-diagnostic/legacy-style, Support Match is row-local, PS No. Wise Action is row-specific, and Consolidated Node wise Action is group-level only.',
    },
  };
}
