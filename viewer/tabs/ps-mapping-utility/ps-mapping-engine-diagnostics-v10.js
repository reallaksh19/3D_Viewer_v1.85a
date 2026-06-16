import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV9PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v9.js?v=20260612-tally-source-ledger-toggle-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

function text(value) {
  return String(value ?? '').trim();
}

function truthy(value) {
  return value === true || /^(yes|y|true|1|mandatory|required|req|must|audit)$/i.test(text(value));
}

function hasNode(row = {}) {
  return Boolean(text(row.mappedNode || row.candidateNode || row.node || row.table1Node || ''));
}

function hasMappedTable2Ps(row = {}) {
  const value = text(row.psnoModel || row.modelPsNo || row.modelPsNoRaw || '');
  return Boolean(value && value !== '-' && value.toUpperCase() !== 'N/A');
}

function table1ContextKey(row = {}, index = -1) {
  const node = text(row.node || row.candidateNode || row.table1Node || '');
  const ps = text(row.table1PsNo || row.psNo || row.basePs || row.psno || '');
  const line = text(row.nodeLineFamily || row.lineFamily || row.lineNoKey || row.lineNo || '');
  const dn = text(row.derivedDn ?? row.pipeSizeRaw ?? row.pipeSize ?? row.nps ?? '');
  if (node || ps || line || dn) return [node, ps, line, dn].join('|');
  return `T1:${index + 1}`;
}

function table1SourceRows(result = {}) {
  const source = Array.isArray(result.consolidatedTable1Rows) && result.consolidatedTable1Rows.length
    ? result.consolidatedTable1Rows
    : Array.isArray(result.table1SourceRows) && result.table1SourceRows.length
      ? result.table1SourceRows
      : Array.isArray(result.richReferenceRows) && result.richReferenceRows.length
        ? result.richReferenceRows
        : [];
  return source.map((row, index) => ({
    ...row,
    table1ContextId: row?.table1ContextId || table1ContextKey(row, index),
  }));
}

function evidenceRows(result = {}) {
  return [
    ...(Array.isArray(result.rows) ? result.rows : []),
    ...(Array.isArray(result.outputRows) ? result.outputRows : []),
    ...(Array.isArray(result.validatorRows) ? result.validatorRows : []),
    ...(Array.isArray(result.candidateRows) ? result.candidateRows : []),
    ...(Array.isArray(result.candidates) ? result.candidates : []),
  ];
}

function matchedTable1Keys(result = {}) {
  const keys = new Set();
  for (const row of evidenceRows(result)) {
    if (!hasMappedTable2Ps(row) || !hasNode(row)) continue;
    keys.add(table1ContextKey({
      node: row.mappedNode || row.candidateNode || row.node,
      table1PsNo: row.mappedTable1PsNo || row.table1PsNo,
      nodeLineFamily: row.nodeLineFamily || row.lineFamily,
      derivedDn: row.derivedDn || row.modelBore,
    }));
  }
  return keys;
}

function isMandatoryTable1(row = {}) {
  return truthy(row.mandatory || row.table1Mandatory || row.nodeMandatory || row.isMandatory);
}

function isExistingTable1UnmappedRow(row = {}) {
  return hasNode(row)
    && !hasMappedTable2Ps(row)
    && text(row.nodeCoverageNote || row.consolidatedNodeWiseAction || row.reason) === 'PS No. not Mapped';
}

function existingTable1UnmappedKeys(rows = []) {
  const out = new Set();
  for (const row of rows) {
    if (!isExistingTable1UnmappedRow(row)) continue;
    out.add(table1ContextKey({
      node: row.candidateNode || row.node || row.table1Node,
      table1PsNo: row.table1PsNo || row.psNo,
      nodeLineFamily: row.nodeLineFamily || row.lineFamily,
      derivedDn: row.derivedDn || row.pipeSizeRaw,
    }));
  }
  return out;
}

function makeTable1UnmappedCandidate(row = {}, { mandatory = false } = {}) {
  const action = mandatory ? 'PS No. not Mapped' : 'Optional Node No. not mapped.';
  return {
    psnoModel: '-',
    modelBore: '',
    lineFamily: '',
    supportTypesRequested: '',
    candidateNode: row.node || row.candidateNode || row.table1Node || '',
    node: row.node || row.candidateNode || row.table1Node || '',
    table1PsNo: row.table1PsNo || row.psNo || row.basePs || '',
    tag: row.tag || '',
    source: row.source || 'TABLE1C_RICH',
    nodeLineFamily: row.nodeLineFamily || row.lineFamily || row.lineNoKey || '',
    pipeSizeRaw: row.pipeSizeRaw ?? row.pipeSize ?? row.nps ?? '',
    derivedDn: row.derivedDn ?? '',
    nodeIsonote: row.nodeIsonote || row.isonote || row.ISONOTE || '',
    psBasis: row.psBasis || 'PS_BASE',
    boreBasis: row.boreBasis || (row.derivedDn || row.pipeSizeRaw || row.pipeSize ? 'BORE_DN_FROM_NPS' : ''),
    lineBasis: '',
    supportBasis: 'PS_NO_NOT_MAPPED',
    supportMatch: '',
    eligible: false,
    autoSelectable: false,
    reviewRequired: mandatory,
    selected: false,
    finalStatus: mandatory ? 'USER_REVIEW_REQUIRED' : 'OPTIONAL_NODE_NO_UNMAPPED',
    confidence: mandatory ? 'REVIEW' : 'AUDIT',
    confidenceScore: 0,
    score: 999999,
    warnings: mandatory ? 'PS_NO_NOT_MAPPED' : 'OPTIONAL_NODE_NO_NOT_MAPPED',
    reason: action,
    reviewAction: action,
    consolidatedNodeWiseAction: action,
    nodeCoverageNote: action,
    matchGroup: mandatory ? '04_UNMATCHED_MANDATORY_NODE' : '05_UNMATCHED_OPTIONAL_NODE_NO',
    table1ContextId: row.table1ContextId || table1ContextKey(row),
  };
}

function appendTable1UnmappedAuditRows(result = {}, options = {}) {
  const sourceRows = table1SourceRows(result);
  if (!sourceRows.length) return result;

  const matched = matchedTable1Keys(result);
  const candidates = Array.isArray(result.candidateRows || result.candidates)
    ? [...(result.candidateRows || result.candidates)]
    : [];
  const existing = existingTable1UnmappedKeys(candidates);

  for (const row of sourceRows) {
    const key = row.table1ContextId || table1ContextKey(row);
    if (matched.has(key) || existing.has(key)) continue;
    const mandatory = isMandatoryTable1(row);
    if (!mandatory && options.showOptionalUnmatchedNodeNo !== true) continue;
    candidates.push(makeTable1UnmappedCandidate(row, { mandatory }));
    existing.add(key);
  }

  return {
    ...result,
    consolidatedTable1Rows: sourceRows,
    table1SourceRows: sourceRows,
    candidateRows: candidates,
    candidates,
    summary: {
      ...(result.summary || {}),
      candidateRows: candidates.length,
      table1SourceRows: sourceRows.length,
      table1OnlyUnmappedPsRows: candidates.filter((row) => text(row.nodeCoverageNote || row.consolidatedNodeWiseAction) === 'PS No. not Mapped').length,
      optionalUnmatchedNodeNoRows: candidates.filter((row) => text(row.nodeCoverageNote || row.consolidatedNodeWiseAction) === 'Optional Node No. not mapped.').length,
    },
    approxConfig: {
      ...(result.approxConfig || {}),
      table1SourceLedgerAudit: 'Mandatory Table-1 node contexts are audited from the full consolidatedTable1Rows/table1SourceRows ledger. If no mapped Table-2 PS row anchors to that context, Candidate Matrix shows PS No. not Mapped.',
    },
  };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV9PsMappingResolver({ ...input, options });
  return appendTable1UnmappedAuditRows(result, options);
}
