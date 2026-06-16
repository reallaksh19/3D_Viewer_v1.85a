import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV6PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v6.js?v=20260612-table1-only-ps-unmapped-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

function visibleAction(row = {}) {
  return String(row.consolidatedNodeWiseAction || row.nodeCoverageNote || '').trim();
}

function exposeNodeAction(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const action = visibleAction(row);
  if (!action) return row;
  const next = {
    ...row,
    consolidatedNodeWiseAction: row.consolidatedNodeWiseAction || action,
    nodeCoverageNote: action,
  };
  if (action === 'No matching node, needs review.') {
    next.reviewRequired = true;
    next.autoSelectable = false;
    next.finalStatus = next.finalStatus || 'USER_REVIEW_REQUIRED';
    next.reviewAction = next.reviewAction || action;
    next.reason = next.reason || action;
  }
  if (action === 'PS No. not Mapped') {
    next.reviewRequired = true;
    next.autoSelectable = false;
    next.finalStatus = next.finalStatus || 'USER_REVIEW_REQUIRED';
    next.reviewAction = next.reviewAction || action;
    next.reason = next.reason || action;
  }
  return next;
}

function exposeRows(rows) {
  return Array.isArray(rows) ? rows.map(exposeNodeAction) : rows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV6PsMappingResolver(input);
  const rows = exposeRows(result?.rows);
  const outputRows = exposeRows(result?.outputRows);
  const validatorRows = exposeRows(result?.validatorRows || rows);
  const candidateRows = exposeRows(result?.candidateRows || result?.candidates);
  const candidates = exposeRows(result?.candidates || candidateRows);
  return {
    ...result,
    rows,
    outputRows,
    validatorRows,
    candidateRows,
    candidates,
    approxConfig: {
      ...(result?.approxConfig || {}),
      nodeWiseActionVisibleColumn: 'consolidatedNodeWiseAction is also mirrored to nodeCoverageNote so the existing Candidate Matrix / Validator visible column shows the action immediately.',
    },
  };
}
