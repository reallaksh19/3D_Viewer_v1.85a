import {
  DEFAULT_OPTIONS as BASE_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as baseNormalize,
  runPsMappingResolver as baseRun,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v4.js?v=20260611-robust-gap-1';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...BASE_OPTIONS,
  useBuiltInSupportKeywordLogic: true,
  treatAnchorAsLineStop: true,
  supportKeywordRulesText: DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
};

export function normalizePsMappingOptions(options = {}) {
  const normalized = baseNormalize({
    ...options,
    useBuiltInSupportKeywordLogic: true,
    treatAnchorAsLineStop: true,
    supportKeywordRulesText: String(options.supportKeywordRulesText || '').trim() || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  });
  normalized.useBuiltInSupportKeywordLogic = true;
  normalized.treatAnchorAsLineStop = true;
  normalized.supportKeywordRulesText = String(normalized.supportKeywordRulesText || '').trim() || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT;
  return normalized;
}

function addSupportGapAlias(row) {
  if (!row || typeof row !== 'object') return row;
  const gapValue = row.supportGapMatch || row.gapMatch || row.supportGapBasis || '';
  return {
    ...row,
    supportGapMatch: gapValue,
    gapMatch: row.gapMatch || gapValue,
  };
}

function aliasRows(rows) {
  return Array.isArray(rows) ? rows.map(addSupportGapAlias) : rows;
}

function annotateSupportGapAliases(result) {
  const rows = aliasRows(result?.rows);
  const outputRows = aliasRows(result?.outputRows);
  const candidateRows = aliasRows(result?.candidateRows || result?.candidates);
  const candidates = aliasRows(result?.candidates || candidateRows);
  const validatorRows = aliasRows(result?.validatorRows || rows);
  return {
    ...result,
    rows,
    outputRows,
    candidateRows,
    candidates,
    validatorRows,
    approxConfig: {
      ...(result?.approxConfig || {}),
      supportGapMatchField: 'supportGapMatch mirrors gapMatch/supportGapBasis for exports and UI diagnostics.',
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = baseRun({ ...input, options });
  return annotateSupportGapAliases({
    ...result,
    approxConfig: {
      ...(result?.approxConfig || {}),
      supportKeywordSource: 'Support Keyword Rules: Pattern -> Canonical',
      supportKeywordRulesText: options.supportKeywordRulesText,
    },
  });
}
