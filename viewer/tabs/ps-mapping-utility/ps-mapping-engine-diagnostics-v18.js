import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV17PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v17.js?v=20260614-node-restraint-coverage-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function table1SupportNo(row = {}) {
  return clean(row.table1SupportNo || row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 Support No'] || row['Table-1 PS No'] || '');
}

function modelSupportNo(row = {}) {
  return clean(row.supportNoModel || row.psnoModel || row.modelPsNo || row.rawPsNo || row.basePs || row['SupportNo_Model'] || row['PSNO_Model'] || '');
}

function genericSupportNoText(value) {
  let text = String(value ?? '');
  if (!text) return text;

  text = text.replace(/\bPS-UNKNOWN\b/g, 'SUPPORT-UNKNOWN');
  text = text.replace(/\bPS No\. Wise Action\b/g, 'Support No. Wise Action');
  text = text.replace(/\bPS No\. wise action\b/g, 'Support No. wise action');
  text = text.replace(/\bPS No\b/g, 'Support No');
  text = text.replace(/\bPSNO_Model\b/g, 'SupportNo_Model');
  text = text.replace(/\bTable-2 PS\b/g, 'Table-2 Support No');
  text = text.replace(/\bTable-1 PS\b/g, 'Table-1 Support No');
  text = text.replace(/synthetic PS-XYZ\.Xn IDs/g, 'synthetic <SupportNo>.Xn IDs');
  text = text.replace(/PS-XYZ\.X1/g, '<SupportNo>.X1');
  return text;
}

function patchRow(row = {}) {
  const table1No = table1SupportNo(row);
  const modelNo = modelSupportNo(row);
  const proposed = genericSupportNoText(row.proposedMissingSupportNo || row.proposedMissingSupportPsNo || '');

  return {
    ...row,
    table1SupportNo: table1No,
    supportNoModel: modelNo,
    proposedMissingSupportNo: proposed,
    proposedMissingSupportPsNo: proposed,
    psNoWiseAction: genericSupportNoText(row.psNoWiseAction),
    supportNoWiseAction: genericSupportNoText(row.supportNoWiseAction || row.psNoWiseAction),
    nodeCoverageNote: genericSupportNoText(row.nodeCoverageNote),
    consolidatedNodeWiseAction: genericSupportNoText(row.consolidatedNodeWiseAction),
    reason: genericSupportNoText(row.reason),
    reviewAction: genericSupportNoText(row.reviewAction),
    warnings: genericSupportNoText(row.warnings),
  };
}

function patchRows(rows) {
  return Array.isArray(rows) ? rows.map(patchRow) : rows;
}

export function runPsMappingResolver(input = {}) {
  const result = runV17PsMappingResolver(input);
  return {
    ...result,
    rows: patchRows(result.rows),
    outputRows: patchRows(result.outputRows),
    validatorRows: patchRows(result.validatorRows),
    candidateRows: patchRows(result.candidateRows),
    candidates: patchRows(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      supportNoPresentationRules: 'Readable v18: user-facing output uses Support No. wording, preserves any original prefix such as PS-, SL-, SUP-, or client-specific support IDs, and uses SUPPORT-UNKNOWN only when no Table-1 support number exists.',
    },
  };
}
