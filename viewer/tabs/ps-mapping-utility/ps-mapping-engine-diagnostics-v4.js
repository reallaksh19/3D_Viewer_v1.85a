import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeV3Options,
  runPsMappingResolver as runV3PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v3.js?v=20260611-support-gap-rules-1';
import {
  evaluateSupportGapComparison,
  extractTypedSupportGaps,
  supportTypesFromText,
} from './ps-mapping-support-gap-logic.js?v=20260614-support-parent-gap-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export function normalizePsMappingOptions(options = {}) {
  return normalizeV3Options(options);
}

function rawColumnValue(rawColumns, aliases = []) {
  const cols = rawColumns || {};
  const wanted = aliases.map((item) => String(item).toLowerCase().replace(/[\s_-]+/g, ' ').trim());
  for (const [key, value] of Object.entries(cols)) {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (wanted.includes(normalized)) return value;
  }
  return '';
}

function supportGapRawFromModel(model = {}) {
  return model.supportGapRaw
    || model.supportGap
    || rawColumnValue(model.rawColumns, ['support gap', 'guide gap', 'line stop gap', 'stop gap', 'gap'])
    || '';
}

function table1TextFromRow(row = {}) {
  return [
    row.supportTypesAvailable,
    row.nodeMasterKeywords,
    row.table1SupportTypes,
    row.nodeIsonote,
    row.nodeIsonoteRaw,
    row.isonote,
  ].filter(Boolean).join(' ');
}

function table2TextFromRow(row = {}, model = {}) {
  return [
    row.supportTypesRequested,
    row.modelDtxrKeywords,
    row.t2Keywords,
    row.dtxr,
    row.DTXR,
    model.dtxr,
  ].filter(Boolean).join(' ');
}

function modelGapMmFromModel(model = {}) {
  const modelTypes = supportTypesFromText(model.supportTypesRequested, model.modelDtxrKeywords, model.dtxr);
  const gaps = extractTypedSupportGaps(supportGapRawFromModel(model), modelTypes, { fieldFallback: true });
  return gaps.GUIDE ?? gaps.LINE_STOP ?? '';
}

function buildModelMap(models = []) {
  const map = new Map();
  for (const model of models || []) {
    if (!model?.psnoModel) continue;
    const supportGapRaw = supportGapRawFromModel(model);
    const normalized = {
      ...model,
      supportGapRaw,
      supportGapMm: modelGapMmFromModel({ ...model, supportGapRaw }),
    };
    if (!map.has(model.psnoModel)) map.set(model.psnoModel, []);
    map.get(model.psnoModel).push(normalized);
  }
  return map;
}

function appendWarning(existing, warning) {
  const parts = String(existing || '').split(';').map((part) => part.trim()).filter(Boolean);
  if (warning && !parts.includes(warning)) parts.push(warning);
  return parts.join('; ');
}

function removeGapWarnings(existing) {
  return String(existing || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^(?:GAP_|GUIDE_GAP_|LINE_STOP_GAP_)/i.test(part))
    .join('; ');
}

function hasCleanResolvedContext(row) {
  return ['BORE_DN_FROM_NPS', 'BORE_DN_FROM_OD', 'BORE_NPS_RAW', 'BORE_OD', 'BORE_IGNORED'].includes(row.boreBasis)
    && ['LINE_EXACT', 'LINE_FAMILY'].includes(row.lineBasis)
    && ['SUPPORT_EXACT', 'SUPPORT_PARTIAL', 'SUPPORT_IGNORED'].includes(row.supportBasis);
}

function markGapExact(row, comparison) {
  row.gapMatch = comparison.status;
  row.gapMatchDetail = comparison.detail;
  row.supportGapBasis = comparison.status;
  row.warnings = removeGapWarnings(row.warnings);
  if (comparison.kind === 'GUIDE') row.nodeGuideGapMm = comparison.table1GapMm ?? '';
  if (comparison.kind === 'LINE_STOP') row.nodeLineStopGapMm = comparison.table1GapMm ?? '';
  if (row.finalStatus === 'USER_REVIEW_REQUIRED' && hasCleanResolvedContext(row) && !row.warnings) {
    row.finalStatus = 'MATCHED';
    row.reviewRequired = false;
    row.autoSelectable = true;
    row.confidence = 'HIGH';
    row.confidenceScore = Math.max(Number(row.confidenceScore || 0), 90);
    row.reason = row.selected ? 'Selected best auto-approved consolidated Table-1 candidate.' : `${comparison.kind === 'LINE_STOP' ? 'Line stop' : 'Guide'} gap comparison matched.`;
    row.reviewAction = '';
    row.nodeCoverageNote = '';
  }
}

function markGapReview(row, comparison) {
  row.gapMatch = comparison.status;
  row.gapMatchDetail = comparison.detail;
  row.supportGapBasis = comparison.status;
  row.autoSelectable = false;
  row.reviewRequired = true;
  row.selected = false;
  row.finalStatus = 'USER_REVIEW_REQUIRED';
  row.confidence = row.confidence === 'HIGH' ? 'REVIEW' : (row.confidence || 'REVIEW');
  row.confidenceScore = Math.min(Number(row.confidenceScore || 60) || 60, 60);
  row.warnings = appendWarning(removeGapWarnings(row.warnings), comparison.status);
  row.reason = comparison.detail;
  row.reviewAction = comparison.detail;
  row.nodeCoverageNote = comparison.detail;
  if (comparison.kind === 'GUIDE') row.nodeGuideGapMm = comparison.table1GapMm ?? '';
  if (comparison.kind === 'LINE_STOP') row.nodeLineStopGapMm = comparison.table1GapMm ?? '';
}

function overlapScore(row = {}, model = {}) {
  const rowTypes = supportTypesFromText(table1TextFromRow(row), table2TextFromRow(row, {}));
  const modelTypes = supportTypesFromText(model.supportTypesRequested, model.modelDtxrKeywords, model.dtxr);
  let score = 0;
  for (const type of modelTypes) if (rowTypes.has(type)) score += 10;
  if (String(row.dtxr || row.DTXR || '').trim() && String(row.dtxr || row.DTXR || '').trim() === String(model.dtxr || '').trim()) score += 100;
  return score;
}

function resolveModelForRow(row = {}, modelByPs) {
  const models = modelByPs.get(row.psnoModel) || [];
  if (!models.length) return {};
  if (models.length === 1) return models[0];
  return [...models].sort((a, b) => overlapScore(row, b) - overlapScore(row, a))[0] || models[0];
}

function applyRobustGapComparison(row, options, modelByPs) {
  if (!row || options.enableSupportGapComparison === false) return row;
  const model = resolveModelForRow(row, modelByPs);
  const supportGapRaw = supportGapRawFromModel(model) || row.supportGapRaw || '';
  const comparison = evaluateSupportGapComparison({
    table1Text: table1TextFromRow(row),
    table2Text: table2TextFromRow(row, model),
    table2GapRaw: supportGapRaw,
    tolerance: options.supportGapToleranceMm ?? 0,
    enabled: options.enableSupportGapComparison !== false,
  });

  row.supportGapRaw = supportGapRaw || row.supportGapRaw || '';
  row.supportGapMm = comparison.table2GapMm ?? modelGapMmFromModel({ ...model, supportGapRaw }) ?? '';
  if (comparison.kind === 'GUIDE') row.nodeGuideGapMm = comparison.table1GapMm ?? '';
  if (comparison.kind === 'LINE_STOP') row.nodeLineStopGapMm = comparison.table1GapMm ?? '';

  if (!comparison.status) {
    row.gapMatch = row.gapMatch || '';
    row.supportGapBasis = row.supportGapBasis || '';
    return row;
  }

  if (/_EXACT$/i.test(comparison.status)) markGapExact(row, comparison);
  else markGapReview(row, comparison);
  return row;
}

function normalizeRows(rows, options, modelByPs) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => applyRobustGapComparison({ ...row }, options, modelByPs));
}

function normalizeConsolidatedTable2Rows(rows = []) {
  return (rows || []).map((row) => {
    const supportGapRaw = supportGapRawFromModel(row);
    return {
      ...row,
      supportGapRaw,
      supportGapMm: modelGapMmFromModel({ ...row, supportGapRaw }),
    };
  });
}

function annotateRobustGapResult(result, options) {
  const consolidatedTable2Rows = normalizeConsolidatedTable2Rows(result?.consolidatedTable2Rows || []);
  const modelByPs = buildModelMap(consolidatedTable2Rows);
  const rows = normalizeRows(result?.rows, options, modelByPs);
  const outputRows = normalizeRows(result?.outputRows, options, modelByPs);
  const candidateRows = normalizeRows(result?.candidateRows || result?.candidates, options, modelByPs);
  const candidates = normalizeRows(result?.candidates || candidateRows, options, modelByPs);
  const validatorRows = normalizeRows(result?.validatorRows || rows, options, modelByPs);
  const gapConflicts = (candidates || []).filter((row) => /GAP_CONFLICT$/i.test(row.gapMatch || '')).length;
  return {
    ...result,
    consolidatedTable2Rows,
    rows,
    outputRows,
    candidateRows,
    candidates,
    validatorRows,
    summary: {
      ...(result?.summary || {}),
      gapConflicts,
    },
    approxConfig: {
      ...(result?.approxConfig || {}),
      supportGapLogic: 'Support-aware parser: GUIDE GAP is checked only under matched GUIDE parent; LINE STOP GAP is checked only under matched LINE_STOP parent; generic numeric Support Gap is inferred from the Table-2 support row type only.',
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV3PsMappingResolver({ ...input, options });
  return annotateRobustGapResult(result, options);
}
