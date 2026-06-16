import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV5PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v5.js?v=20260612-support-gap-match-alias-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const EXACT_BORE = new Set([
  'BORE_DN_FROM_NPS',
  'BORE_DN_FROM_OD',
  'BORE_NPS_RAW',
  'BORE_OD',
  'BORE_IGNORED',
]);
const APPROX_BORE = new Set(['BORE_OD_APPROX', 'BORE_APPROX', 'BORE_RAW_APPROX']);
const EXACT_LINE = new Set(['LINE_EXACT', 'LINE_FAMILY']);
const APPROX_LINE = new Set(['LINE_FAMILY_NEAR_MISMATCH']);

function upper(value) { return String(value || '').toUpperCase(); }
function modelKey(row = {}) { return row.psnoModel || row.modelPsNo || row.basePs || '__UNKNOWN_MODEL__'; }
function isAuditRow(row = {}) { return row.psnoModel === '-' || /^SUPPORT_MISSING_/i.test(String(row.finalStatus || '')); }
function isPsCandidate(row = {}) { return ['PS_BASE', 'PS_EXACT'].includes(row.psBasis); }
function hasExactBore(row = {}) { return EXACT_BORE.has(upper(row.boreBasis)); }
function hasApproxBore(row = {}) { return APPROX_BORE.has(upper(row.boreBasis)); }
function hasExactLine(row = {}) { return EXACT_LINE.has(upper(row.lineBasis)); }
function hasApproxLine(row = {}) { return APPROX_LINE.has(upper(row.lineBasis)); }

function psRank(row = {}) {
  const basis = upper(row.psBasis);
  if (basis === 'PS_EXACT') return 0;
  if (basis === 'PS_BASE') return 1;
  return 9;
}

function lineRank(row = {}) {
  const basis = upper(row.lineBasis);
  if (basis === 'LINE_EXACT') return 0;
  if (basis === 'LINE_FAMILY') return 1;
  if (basis === 'LINE_FAMILY_NEAR_MISMATCH') return 5;
  if (basis === 'LINE_IGNORED') return 7;
  return 9;
}

function boreRank(row = {}) {
  const basis = upper(row.boreBasis);
  if (basis === 'BORE_DN_FROM_NPS') return 0;
  if (basis === 'BORE_DN_FROM_OD') return 1;
  if (basis === 'BORE_NPS_RAW') return 2;
  if (basis === 'BORE_OD') return 3;
  if (basis === 'BORE_OD_APPROX' || basis === 'BORE_APPROX' || basis === 'BORE_RAW_APPROX') return 6;
  if (basis === 'BORE_IGNORED') return 8;
  return 9;
}

function naturalCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });
}

function candidateSortByAnchor(a, b) {
  // IMPORTANT: supportBasis, supportMatch, gapMatch/supportGapMatch, selected,
  // autoSelectable and raw score are deliberately not used here. They may be
  // influenced by support/gap diagnostics. Mapping anchor must be chosen only
  // from PS + line + bore context; support/gap are evaluated after anchoring.
  return psRank(a) - psRank(b)
    || lineRank(a) - lineRank(b)
    || boreRank(a) - boreRank(b)
    || naturalCompare(a.candidateNode || a.node || '', b.candidateNode || b.node || '')
    || naturalCompare(a.table1PsNo || '', b.table1PsNo || '');
}

function selectStageCandidate(group, options = {}) {
  const candidates = (group || []).filter((row) => isPsCandidate(row));
  const loop1 = candidates.filter((row) => hasExactBore(row) && hasExactLine(row));
  if (loop1.length) return { stage: 'LOOP1_EXACT_LINE_BORE', candidate: [...loop1].sort(candidateSortByAnchor)[0] };

  if (options.attemptApproxLineMatch === true) {
    const loop2 = candidates.filter((row) => hasExactBore(row) && hasApproxLine(row));
    if (loop2.length) return { stage: 'LOOP2_APPROX_LINE', candidate: [...loop2].sort(candidateSortByAnchor)[0] };
  }

  if (options.attemptApproxBoreMatch === true) {
    const loop3 = candidates.filter((row) => (hasExactLine(row) || (options.attemptApproxLineMatch === true && hasApproxLine(row))) && hasApproxBore(row));
    if (loop3.length) return { stage: 'LOOP3_APPROX_BORE', candidate: [...loop3].sort(candidateSortByAnchor)[0] };
  }

  return { stage: 'UNMAPPED', candidate: null };
}

function markMapped(row, selected, stage) {
  if (!row || !selected || modelKey(row) !== modelKey(selected)) return row;
  return {
    ...row,
    mapped: true,
    mappedStage: stage,
    mappedNode: selected.candidateNode || selected.node || '',
    mappedTable1PsNo: selected.table1PsNo || '',
  };
}

function normalizeVisibleCandidates(candidates = [], options = {}) {
  if (!Array.isArray(candidates)) return { visibleCandidates: candidates, stageByModel: new Map() };
  const byModel = new Map();
  const auditRows = [];

  for (const row of candidates) {
    if (isAuditRow(row)) {
      auditRows.push(row);
      continue;
    }
    const key = modelKey(row);
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key).push(row);
  }

  const visible = [];
  const stageByModel = new Map();
  for (const [key, group] of byModel.entries()) {
    const { stage, candidate } = selectStageCandidate(group, options);
    stageByModel.set(key, { stage, candidate });
    if (!candidate) continue;
    visible.push({
      ...candidate,
      mapped: true,
      mappedStage: stage,
      mappedNode: candidate.candidateNode || candidate.node || '',
      mappedTable1PsNo: candidate.table1PsNo || '',
      matchGroup: stage === 'LOOP1_EXACT_LINE_BORE'
        ? (candidate.reviewRequired ? '03_REVIEW_REQUIRED' : '01_SELECTED_MATCH')
        : '03_REVIEW_REQUIRED',
      reason: candidate.reason || (stage === 'LOOP1_EXACT_LINE_BORE'
        ? 'Mapped in Loop 1 by PS, exact line family and exact bore. Support/gap diagnostics are evaluated only after this mapping anchor is selected.'
        : `Mapped in ${stage}. Support/gap diagnostics are evaluated only after this mapping anchor is selected.`),
    });
  }

  return { visibleCandidates: [...visible, ...auditRows], stageByModel };
}

function annotateRowsByStage(rows, stageByModel) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const mapped = stageByModel.get(modelKey(row));
    if (!mapped?.candidate) return row;
    return markMapped(row, mapped.candidate, mapped.stage);
  });
}

function isTruthy(value) {
  return value === true || /^(yes|y|true|1|mandatory|required|req|must|audit)$/i.test(String(value ?? '').trim());
}

function hasNode(row = {}) {
  return Boolean(String(row.mappedNode || row.candidateNode || row.node || '').trim());
}

function hasMandatoryNoNode(row = {}) {
  return isTruthy(row.mandatory || row.modelMandatory || row.mandatoryRaw || row.isMandatory) && !hasNode(row);
}

function hasMappedTable2Ps(row = {}) {
  const value = String(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || '').trim();
  return Boolean(value && value !== '-' && value.toUpperCase() !== 'N/A');
}

function normalizeSupportText(...values) {
  return values
    .map((value) => String(value ?? '').toUpperCase())
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/[\[\](){}:;,|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supportSetFromText(...values) {
  const text = normalizeSupportText(...values);
  const out = new Set();
  if (!text) return out;
  if (/\bGUIDE\b/.test(text)) out.add('GUIDE');
  if (/\bREST\b/.test(text) || /\bPIPE\s+REST\b/.test(text) || /\bXRT\b/.test(text) || /\bPIPE\s+SHOE\b/.test(text) || /\bWEAR\s+PLATE\b/.test(text)) out.add('REST');
  if (/\bLINE\s*STOP\b/.test(text) || /\bLINESTOP\b/.test(text) || /\bPIPE\s+STOP\b/.test(text) || /\bDIRECTIONAL\s+ANCHOR\b/.test(text) || /\bANCHOR\b/.test(text) || /\bSTOP\b/.test(text)) out.add('LINE_STOP');
  return out;
}

function labelSupport(type) {
  if (type === 'LINE_STOP') return 'LINE STOP';
  if (type === 'REST') return 'REST';
  if (type === 'GUIDE') return 'GUIDE';
  return String(type || '').replace(/_/g, ' ');
}

function difference(a, b) {
  return [...a].filter((value) => !b.has(value)).sort(naturalCompare);
}

function nodeActionKey(row = {}) {
  const node = row.mappedNode || row.candidateNode || row.node || '';
  if (!node) return `__MODEL__|${modelKey(row)}`;
  return [
    node,
    row.mappedTable1PsNo || row.table1PsNo || '',
    row.nodeLineFamily || row.nodeLineKey || row.lineFamily || '',
    row.derivedDn || row.modelBore || '',
  ].map((value) => String(value ?? '').trim()).join('|');
}

function hasTable2GuideGap(row = {}) {
  return /GUIDE/i.test(String(row.supportTypesRequested || row.modelDtxrKeywords || row.dtxr || ''))
    && Boolean(String(row.supportGapRaw || row.supportGap || row.supportGapMm || row.supportGapMatch || row.gapMatch || '').trim());
}

function groupNodeAction(group = []) {
  if (!group.some(hasNode)) {
    return group.some(hasMandatoryNoNode) ? 'No matching node, needs review.' : '';
  }

  if (!group.some(hasMappedTable2Ps)) {
    return 'PS No. not Mapped';
  }

  const required = new Set();
  const provided = new Set();
  for (const row of group) {
    for (const type of supportSetFromText(row.supportTypesAvailable, row.nodeMasterKeywords, row.nodeIsonote, row.nodeIsonoteRaw)) required.add(type);
    for (const type of supportSetFromText(row.supportTypesRequested, row.modelDtxrKeywords, row.dtxr)) provided.add(type);
  }

  const missing = difference(required, provided);
  const extra = difference(provided, required);
  const parts = [];

  for (const type of extra) {
    parts.push(`Table-1 has no ${labelSupport(type)}, but Table-2 has ${labelSupport(type)}.`);
    if (type === 'GUIDE' && group.some(hasTable2GuideGap)) {
      parts.push('Gap cannot be compared because Table-1 has no GUIDE.');
    }
  }

  for (const type of missing) {
    parts.push(`Table-1 requires ${labelSupport(type)}, but Table-2 has no ${labelSupport(type)}.`);
  }

  if (!parts.length && required.size && provided.size) {
    return 'No node-wise action required. Table-2 support coverage matches Table-1 ISONOTE.';
  }
  return parts.join(' ');
}

function annotateConsolidatedNodeActions(rows = []) {
  if (!Array.isArray(rows)) return rows;
  const groups = new Map();
  for (const row of rows) {
    const key = nodeActionKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const actionByKey = new Map();
  for (const [key, group] of groups.entries()) actionByKey.set(key, groupNodeAction(group));

  return rows.map((row) => ({
    ...row,
    consolidatedNodeWiseAction: actionByKey.get(nodeActionKey(row)) || row.consolidatedNodeWiseAction || '',
  }));
}

function buildActionByModel(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const action = row?.consolidatedNodeWiseAction;
    if (action && !map.has(modelKey(row))) map.set(modelKey(row), action);
  }
  return map;
}

function annotateRowsWithActions(rows, stageByModel, actionByModel) {
  const staged = annotateRowsByStage(rows, stageByModel);
  if (!Array.isArray(staged)) return staged;
  return staged.map((row) => {
    const action = actionByModel.get(modelKey(row)) || (hasMandatoryNoNode(row) ? 'No matching node, needs review.' : row.consolidatedNodeWiseAction || '');
    return action ? { ...row, consolidatedNodeWiseAction: action } : row;
  });
}

function makeMandatoryNoNodeCandidate(row = {}) {
  return {
    psnoModel: row.psnoModel || row.modelPsNo || '',
    basePs: row.basePs || '',
    modelBore: row.modelBore ?? row.bore ?? '',
    pipe: row.pipe || '',
    lineFamily: row.lineFamily || '',
    dtxr: row.dtxr || '',
    mandatory: true,
    supportTypesRequested: row.modelDtxrKeywords || row.supportTypesRequested || '',
    modelDtxrKeywords: row.modelDtxrKeywords || row.supportTypesRequested || '',
    candidateNode: '',
    node: '',
    table1PsNo: '',
    psBasis: row.basis || 'NO_MATCH',
    boreBasis: '',
    lineBasis: '',
    supportBasis: '',
    supportMatch: '',
    eligible: false,
    autoSelectable: false,
    reviewRequired: true,
    selected: false,
    finalStatus: 'USER_REVIEW_REQUIRED',
    confidence: 'REVIEW',
    confidenceScore: 0,
    warnings: row.warnings || 'NO_MATCHING_NODE',
    reason: 'No matching node, needs review.',
    reviewAction: 'No matching node, needs review.',
    consolidatedNodeWiseAction: 'No matching node, needs review.',
    matchGroup: '04_UNMATCHED_MANDATORY',
    table2Row: row.table2Row || row.sourceRow || '',
  };
}

function appendMandatoryNoNodeAuditRows(candidateRows = [], resultRows = []) {
  const rows = Array.isArray(candidateRows) ? [...candidateRows] : [];
  const existing = new Set(rows.map((row) => modelKey(row)));
  for (const row of resultRows || []) {
    if (!hasMandatoryNoNode(row)) continue;
    const key = modelKey(row);
    if (existing.has(key)) continue;
    rows.push(makeMandatoryNoNodeCandidate(row));
    existing.add(key);
  }
  return rows;
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV5PsMappingResolver({ ...input, options });
  const { visibleCandidates, stageByModel } = normalizeVisibleCandidates(result?.candidates || result?.candidateRows || [], options);
  const candidatesWithMandatoryNoNode = appendMandatoryNoNodeAuditRows(visibleCandidates, result?.rows || result?.outputRows || []);
  const enrichedCandidates = annotateConsolidatedNodeActions(candidatesWithMandatoryNoNode);
  const actionByModel = buildActionByModel(enrichedCandidates);

  return {
    ...result,
    rows: annotateRowsWithActions(result?.rows, stageByModel, actionByModel),
    outputRows: annotateRowsWithActions(result?.outputRows, stageByModel, actionByModel),
    validatorRows: annotateRowsWithActions(result?.validatorRows, stageByModel, actionByModel),
    candidateRows: enrichedCandidates,
    candidates: enrichedCandidates,
    approxConfig: {
      ...(result?.approxConfig || {}),
      consolidatedNodeWiseAction: 'Node-wise post-anchor action. Mandatory Table-2 rows with no mapped node show: No matching node, needs review. Table-1-only node contexts with no mapped Table-2 PS No show: PS No. not Mapped.',
      stagedResolver: 'Loop 1 exact PS+line+bore maps Table-2 rows first. Loop 2/3 approximate passes run only for still-unmapped rows and only when enabled. Support and support-gap are post-anchor diagnostics only and never select the mapping anchor.',
    },
    summary: {
      ...(result?.summary || {}),
      candidateRows: enrichedCandidates.length,
      stagedMappedRows: [...stageByModel.values()].filter((entry) => entry.candidate).length,
      mandatoryNoNodeRows: enrichedCandidates.filter((row) => row.consolidatedNodeWiseAction === 'No matching node, needs review.').length,
      table1OnlyUnmappedPsRows: enrichedCandidates.filter((row) => row.consolidatedNodeWiseAction === 'PS No. not Mapped').length,
    },
  };
}
