import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV13PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v13.js?v=20260614-psno-wise-action-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const INTERNAL_GUIDE_GAP_GUARD_TEXT = 'Do not report as GUIDE gap; treat as LINE STOP gap only.';

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function removeInternalGuideGapGuard(value) {
  if (typeof value !== 'string' || !value) return value;
  return clean(
    value
      .replaceAll(INTERNAL_GUIDE_GAP_GUARD_TEXT, '')
      .replace(/\s+([.;,:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
  );
}

function sanitizeActionRow(row) {
  if (!row || typeof row !== 'object') return row;
  const psNoWiseAction = removeInternalGuideGapGuard(row.psNoWiseAction);
  const nodeCoverageNote = removeInternalGuideGapGuard(row.nodeCoverageNote);
  const consolidatedNodeWiseAction = removeInternalGuideGapGuard(row.consolidatedNodeWiseAction);
  const reason = removeInternalGuideGapGuard(row.reason);

  if (
    psNoWiseAction === row.psNoWiseAction
    && nodeCoverageNote === row.nodeCoverageNote
    && consolidatedNodeWiseAction === row.consolidatedNodeWiseAction
    && reason === row.reason
  ) {
    return row;
  }

  return {
    ...row,
    psNoWiseAction,
    nodeCoverageNote,
    consolidatedNodeWiseAction,
    reason,
  };
}

function sanitizeRows(rows) {
  return Array.isArray(rows) ? rows.map(sanitizeActionRow) : rows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV13PsMappingResolver(input);
  return {
    ...result,
    rows: sanitizeRows(result.rows),
    outputRows: sanitizeRows(result.outputRows),
    validatorRows: sanitizeRows(result.validatorRows),
    candidateRows: sanitizeRows(result.candidateRows),
    candidates: sanitizeRows(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      psNoWiseActionRules: 'REST/GUIDE/LINE STOP missing/extra, support-specific GUIDE/LINE STOP gap corrections under matched parent supports, bore mismatch, line-family mismatch, duplicate Table-1 node context, and clean no-action cases.',
    },
  };
}
