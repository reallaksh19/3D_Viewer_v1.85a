import {
  DEFAULT_OPTIONS as BASE_DEFAULT_OPTIONS,
  runPsMappingResolver as runBasePsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics.js?v=20260611-line-diagnostics-1';

export { rowsToCsv };

export const DEFAULT_SUPPORT_KEYWORD_RULES_TEXT = `Pattern	Canonical
REST	REST
PIPE REST	REST
XRT	REST
GUIDE	GUIDE
LINE STOP	LINE_STOP
LINESTOP	LINE_STOP
PIPE STOP	LINE_STOP
STOP	LINE_STOP
ANCHOR	LINE_STOP
PIPE ANCHOR	LINE_STOP
*WEAR PLATE*	REST
*Directional Anchor*	LINE_STOP
*PIPE SHOE*	REST`;

export const DEFAULT_OPTIONS = {
  ...BASE_DEFAULT_OPTIONS,
  attemptApproxLineMatch: false,
  attemptApproxBoreMatch: false,
  useBuiltInSupportKeywordLogic: true,
  treatAnchorAsLineStop: true,
  supportKeywordRulesText: DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  enableSupportGapComparison: true,
  supportGapToleranceMm: 0,
  enableNearLineDiagnostic: false,
  allowRawDiaMatch: false,
};

function toFiniteNumber(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function numeric(value) { const parsed = Number(String(value ?? '').replace(/,/g, '').trim()); return Number.isFinite(parsed) ? parsed : null; }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function appendWarning(existing, warning) { const parts = String(existing || '').split(';').map((part) => part.trim()).filter(Boolean); if (warning && !parts.includes(warning)) parts.push(warning); return parts.join('; '); }
function normalizeCanonical(value) { const upper = String(value || '').toUpperCase().replace(/[\s_-]+/g, ' ').trim(); if (!upper) return ''; if (upper === 'LINE STOP' || upper === 'LINESTOP' || upper === 'STOP') return 'LINE_STOP'; return upper.replace(/\s+/g, '_'); }
function displaySupportKeyword(value) { const canonical = normalizeCanonical(value); if (canonical === 'LINE_STOP') return 'STOP'; return canonical.replace(/_/g, ' '); }
function supportDisplayList(values) { return unique(values || []).map(displaySupportKeyword).join(', '); }
function escapeRegex(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function wildcardToRegex(pattern) { const source = String(pattern || '').trim(); if (!source) return null; const escaped = escapeRegex(source).replace(/\\\*/g, '.*').replace(/\s+/g, '\\s+'); return new RegExp(source.includes('*') ? escaped : `\\b${escaped}\\b`, 'i'); }

function parseSupportKeywordRules(options = DEFAULT_OPTIONS) {
  const text = String(options.supportKeywordRulesText || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT);
  const rules = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^pattern\s+/i.test(line) || /^-+$/.test(line)) continue;
    let parts = line.split('\t').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) { const tokens = line.split(/\s+/); parts = [tokens.slice(0, -1).join(' '), tokens[tokens.length - 1]]; }
    const pattern = parts[0];
    const canonical = normalizeCanonical(parts[1]);
    const regex = wildcardToRegex(pattern);
    if (!pattern || !canonical || !regex) continue;
    if (options.treatAnchorAsLineStop === false && /\bANCHOR\b/i.test(pattern)) continue;
    rules.push({ pattern, canonical, regex });
  }
  return rules;
}

function extractSupportKeywords(text, options = DEFAULT_OPTIONS) {
  if (options.useBuiltInSupportKeywordLogic === false) return [];
  const source = String(text || '');
  if (!source.trim()) return [];
  return unique(parseSupportKeywordRules(options).filter((rule) => rule.regex.test(source)).map((rule) => rule.canonical));
}
function splitSupportList(value, options = DEFAULT_OPTIONS) { const raw = String(value || '').trim(); if (!raw) return []; const extracted = extractSupportKeywords(raw, options); if (extracted.length) return extracted; return unique(raw.split(/[;,|/]+/).map((part) => normalizeCanonical(part)).filter(Boolean)); }
function supportAvailableOnRow(row, options) { return unique([...extractSupportKeywords(row?.nodeIsonote, options), ...extractSupportKeywords(row?.nodeIsonoteRaw, options), ...extractSupportKeywords(row?.nodeMasterKeywords, options), ...extractSupportKeywords(row?.masterKeywords, options), ...splitSupportList(row?.supportTypesAvailable, options)]); }
function supportRequestedOnRow(row, options, modelByPs = new Map()) { const model = modelByPs.get(row?.psnoModel) || {}; return unique([...extractSupportKeywords(model.dtxr, options), ...extractSupportKeywords(row?.dtxr, options), ...extractSupportKeywords(row?.dtxrRaw, options), ...splitSupportList(row?.supportTypesRequested, options), ...splitSupportList(row?.modelDtxrKeywords, options)]); }
function hasLineConflict(row) { return String(row?.lineBasis || '').toUpperCase() === 'LINE_CONFLICT'; }

function fixBoreBasis(row) {
  if (!row || String(row.boreBasis || '').toUpperCase() !== 'BORE_MISSING') return row;
  const modelBore = numeric(row.modelBore ?? row.bore ?? row.t2Bore);
  const derivedDn = numeric(row.derivedDn ?? row.nodeDerivedDn ?? row.table1DerivedDn);
  if (modelBore == null || derivedDn == null) return row;
  if (Math.abs(modelBore - derivedDn) <= 1e-6) { row.boreBasis = row.pipeSizeRaw ? 'BORE_DN_FROM_NPS' : 'BORE_DN_FROM_OD'; row.warnings = String(row.warnings || '').split(';').map((part) => part.trim()).filter((part) => part && part !== 'BORE_MISSING').join('; '); return row; }
  row.boreBasis = 'BORE_CONFLICT';
  row.warnings = appendWarning(row.warnings, 'BORE_CONFLICT');
  if (hasLineConflict(row)) { row.eligible = false; row.autoSelectable = false; row.reviewRequired = false; row.selected = false; row.finalStatus = 'BASE_PS_FOUND_BUT_CONTEXT_REJECTED'; row.confidence = 'LOW'; row.confidenceScore = 20; row.warnings = appendWarning(row.warnings, 'BASE_PS_FOUND_BUT_CONTEXT_REJECTED'); row.reason = `Rejected: base PS matched, but Table-2 Bore ${modelBore} conflicts with Table-1 derived DN ${derivedDn}, and line family conflicts.`; row.nodeCoverageNote = row.reason; }
  return row;
}
function fixLineBasis(row) { if (!row || String(row.lineBasis || '').toUpperCase() !== 'LINE_SUBSTRING') return row; const table2Family = String(row.lineFamily || row.modelLineFamily || '').toUpperCase(); const table1Family = String(row.nodeLineFamily || '').toUpperCase(); if (table2Family && table1Family && table2Family === table1Family) { row.lineBasis = 'LINE_FAMILY'; if (row.basis) row.basis = String(row.basis).replace('LINE_SUBSTRING', 'LINE_FAMILY'); } return row; }
function markSupportReview(row, requested, missing) { row.eligible = row.supportBasis === 'SUPPORT_CONFLICT' ? row.eligible : true; row.autoSelectable = false; row.reviewRequired = true; row.selected = false; row.finalStatus = 'USER_REVIEW_REQUIRED'; row.confidence = row.confidence === 'HIGH' ? 'REVIEW' : (row.confidence || 'REVIEW'); row.confidenceScore = Math.min(Number(row.confidenceScore || 60) || 60, 60); row.warnings = appendWarning(row.warnings, 'SUPPORT_CONFLICT'); row.reason = `Review required: Table-2 requests ${supportDisplayList(requested)}, but Table-1 support basis is missing ${supportDisplayList(missing)}.`; row.reviewAction = row.reviewAction || row.reason; row.nodeCoverageNote = row.reason; }
function fixSupportDiagnostics(row, options, modelByPs) {
  if (!row) return row;
  const requested = supportRequestedOnRow(row, options, modelByPs);
  const available = supportAvailableOnRow(row, options);
  const supportBasis = String(row.supportBasis || '').toUpperCase();
  if (requested.length) { row.supportTypesRequested = supportDisplayList(requested); row.modelDtxrKeywords = supportDisplayList(requested); }
  if (!requested.length) return row;
  const matched = requested.filter((type) => available.includes(type));
  const missing = requested.filter((type) => !available.includes(type));
  if (!missing.length) { if (supportBasis === 'SUPPORT_NOT_REQUESTED' || supportBasis === 'SUPPORT_CONFLICT' || supportBasis === 'SUPPORT_MISSING_MASTER' || !row.supportMatch) { row.supportBasis = 'SUPPORT_EXACT'; row.supportMatch = `${supportDisplayList(matched)} Match`; row.matchedSupportKeywords = supportDisplayList(matched); row.missingSupportKeywords = ''; } return row; }
  row.missingSupportKeywords = supportDisplayList(missing);
  if (matched.length) row.matchedSupportKeywords = supportDisplayList(matched);
  if (supportBasis === 'SUPPORT_PARTIAL' || matched.length) { row.supportBasis = 'SUPPORT_PARTIAL'; row.supportMatch = `${supportDisplayList(matched)} Match; Missing ${supportDisplayList(missing)}`; } else { row.supportBasis = available.length ? 'SUPPORT_CONFLICT' : 'SUPPORT_MISSING_MASTER'; row.supportMatch = available.length ? `Missing ${supportDisplayList(missing)}` : `Missing master support ${supportDisplayList(missing)}`; }
  row.warnings = appendWarning(row.warnings, `SUPPORT_MISSING_${missing.join('_')}`);
  markSupportReview(row, requested, missing);
  return row;
}

function rawColumnValue(rawColumns, aliases = []) { const cols = rawColumns || {}; const wanted = aliases.map((item) => String(item).toLowerCase().replace(/[\s_-]+/g, ' ').trim()); for (const [key, value] of Object.entries(cols)) { const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, ' ').trim(); if (wanted.includes(normalized)) return value; } return ''; }
function extractSupportGapRawFromModel(model = {}) { return model.supportGapRaw || model.supportGap || rawColumnValue(model.rawColumns, ['support gap', 'guide gap', 'gap']); }
function extractFirstMm(value) { const match = String(value || '').replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(?:mm)?/i); return match ? Number(match[1]) : null; }
function extractGuideGapMm(text) { const source = String(text || ''); const explicit = source.match(/GUIDE\s*GAP\s*=?\s*(-?\d+(?:\.\d+)?)\s*MM/i); if (explicit) return Number(explicit[1]); const bracket = source.match(/\[[^\]]*GAP\s*=?\s*(-?\d+(?:\.\d+)?)\s*MM[^\]]*\]/i); return bracket ? Number(bracket[1]) : null; }
function markGapReview(row, status, detail) { row.gapMatch = status; row.gapMatchDetail = detail; row.supportGapBasis = status; row.autoSelectable = false; row.reviewRequired = true; row.selected = false; row.finalStatus = 'USER_REVIEW_REQUIRED'; row.confidence = row.confidence === 'HIGH' ? 'REVIEW' : (row.confidence || 'REVIEW'); row.confidenceScore = Math.min(Number(row.confidenceScore || 60) || 60, 60); row.warnings = appendWarning(row.warnings, status); row.reason = detail; row.reviewAction = detail; row.nodeCoverageNote = detail; }
function applySupportGapComparison(row, options, modelByPs) {
  if (!row || options.enableSupportGapComparison === false) return row;
  const model = modelByPs.get(row.psnoModel) || {};
  const supportGapRaw = extractSupportGapRawFromModel(model);
  const modelGapMm = extractFirstMm(supportGapRaw);
  const table1GapMm = extractGuideGapMm(row.nodeIsonote || row.nodeIsonoteRaw);
  const requested = supportRequestedOnRow(row, options, modelByPs);
  const isGuide = requested.includes('GUIDE') || /\bGUIDE\b/i.test(String(row.dtxr || model.dtxr || row.supportTypesRequested || ''));
  row.supportGapRaw = supportGapRaw || row.supportGapRaw || '';
  row.supportGapMm = modelGapMm ?? '';
  row.nodeGuideGapMm = table1GapMm ?? '';
  if (!isGuide && modelGapMm == null) { row.gapMatch = row.gapMatch || ''; return row; }
  if (modelGapMm != null && table1GapMm != null) { const tolerance = Number(options.supportGapToleranceMm ?? 0); if (Math.abs(modelGapMm - table1GapMm) <= tolerance) { row.gapMatch = 'GAP_EXACT'; row.gapMatchDetail = `Table-2 Support Gap ${modelGapMm} mm matches Table-1C GUIDE GAP ${table1GapMm} mm.`; row.supportGapBasis = 'GAP_EXACT'; return row; } markGapReview(row, 'GAP_CONFLICT', `Support gap conflict: Table-2 Support Gap ${modelGapMm} mm differs from Table-1C GUIDE GAP ${table1GapMm} mm.`); return row; }
  if (isGuide && modelGapMm == null && table1GapMm != null) { markGapReview(row, 'GAP_MISSING_TABLE2', `Support gap missing in Table-2 for GUIDE; Table-1C GUIDE GAP is ${table1GapMm} mm.`); return row; }
  if (modelGapMm != null && table1GapMm == null) { markGapReview(row, 'GAP_MISSING_TABLE1', `Support gap ${modelGapMm} mm exists in Table-2, but Table-1C GUIDE GAP is missing.`); return row; }
  row.gapMatch = row.gapMatch || '';
  return row;
}
function normalizeDiagnosticsInRows(rows, options, modelByPs) { if (!Array.isArray(rows)) return rows; return rows.map((row) => applySupportGapComparison(fixSupportDiagnostics(fixLineBasis(fixBoreBasis({ ...row })), options, modelByPs), options, modelByPs)); }
function isDominantAutoMatch(candidate) { if (!candidate || candidate.selected !== true || candidate.finalStatus !== 'MATCHED') return false; const cleanBore = ['BORE_DN_FROM_NPS', 'BORE_DN_FROM_OD', 'BORE_NPS_RAW', 'BORE_OD', 'BORE_IGNORED'].includes(candidate.boreBasis); const cleanLine = ['LINE_EXACT', 'LINE_FAMILY'].includes(candidate.lineBasis); const cleanSupport = ['SUPPORT_EXACT', 'SUPPORT_PARTIAL', 'SUPPORT_NOT_REQUESTED', 'SUPPORT_IGNORED'].includes(candidate.supportBasis); const cleanGap = !candidate.gapMatch || candidate.gapMatch === 'GAP_EXACT'; return cleanBore && cleanLine && cleanSupport && cleanGap; }
function assignMatchGroup(candidate) { if (candidate.selected) return '01_SELECTED_MATCH'; if (candidate.finalStatus === 'MATCHED' && candidate.autoSelectable) return '02_AUTO_MATCH_NOT_SELECTED'; if (candidate.finalStatus === 'USER_REVIEW_REQUIRED') return '03_REVIEW_REQUIRED'; if (candidate.finalStatus === 'DOMINATED_CONTEXT_REJECTED' || candidate.finalStatus === 'BASE_PS_FOUND_BUT_CONTEXT_REJECTED' || candidate.finalStatus === 'REJECTED' || String(candidate.warnings || '').includes('BASE_PS_FOUND_BUT_CONTEXT_REJECTED')) return '04_REJECTED_CONTEXT'; if (candidate.finalStatus === 'NO_MATCH') return '05_NO_MATCH'; return '99_DIAGNOSTIC'; }
function applyDominance(candidateRows = []) { if (!Array.isArray(candidateRows)) return candidateRows; const byModel = new Map(); for (const candidate of candidateRows) { const key = candidate.psnoModel || candidate.basePs || '__UNKNOWN__'; if (!byModel.has(key)) byModel.set(key, []); byModel.get(key).push(candidate); } for (const group of byModel.values()) { const dominant = group.find(isDominantAutoMatch); if (!dominant) continue; for (const candidate of group) { if (candidate === dominant || candidate.selected) continue; if (!['PS_BASE', 'PS_EXACT'].includes(candidate.psBasis)) continue; candidate.eligible = false; candidate.autoSelectable = false; candidate.reviewRequired = false; candidate.selected = false; candidate.finalStatus = 'DOMINATED_CONTEXT_REJECTED'; candidate.confidence = 'LOW'; candidate.confidenceScore = Math.min(Number(candidate.confidenceScore || 20) || 20, 20); candidate.warnings = appendWarning(candidate.warnings, 'DOMINATED_BY_EXACT_CONTEXT_MATCH'); candidate.reason = `Rejected as weaker same-base candidate because Node ${dominant.node} has exact resolved line/bore/support context.`; candidate.nodeCoverageNote = candidate.reason; } } for (const candidate of candidateRows) candidate.matchGroup = assignMatchGroup(candidate); return candidateRows; }

function buildModelMap(modelRows = []) { const map = new Map(); for (const model of modelRows || []) { if (!model?.psnoModel) continue; const supportGapRaw = extractSupportGapRawFromModel(model); map.set(model.psnoModel, { ...model, supportGapRaw, supportGapMm: extractFirstMm(supportGapRaw) ?? '' }); } return map; }
function enrichConsolidatedTable2Rows(modelRows = [], options) { return (modelRows || []).map((row) => { const supportGapRaw = extractSupportGapRawFromModel(row); const requested = unique([...extractSupportKeywords(row.dtxr, options), ...splitSupportList(row.supportTypesRequested, options)]); return { ...row, supportGapRaw, supportGapMm: extractFirstMm(supportGapRaw) ?? '', supportTypesRequested: supportDisplayList(requested) || row.supportTypesRequested, modelDtxrKeywords: supportDisplayList(requested) || row.modelDtxrKeywords }; }); }
function recomputeSupportCoverageRows(coverageRows = [], selectedRows = [], options = DEFAULT_OPTIONS) { const selectedByNode = new Map(); for (const row of selectedRows || []) { if (!row.enabled || !row.node) continue; const entry = selectedByNode.get(row.node) || { psnoModels: [], coveredTypes: [], dtxr: [] }; entry.psnoModels.push(row.psnoModel); entry.coveredTypes.push(...supportRequestedOnRow(row, options)); if (row.dtxr) entry.dtxr.push(row.dtxr); selectedByNode.set(row.node, entry); } return (coverageRows || []).map((coverage) => { const masterTypes = unique([...extractSupportKeywords(coverage.isonote, options), ...extractSupportKeywords(coverage.masterKeywords, options), ...splitSupportList(coverage.masterKeywords, options)]); const mapped = selectedByNode.get(coverage.node) || { psnoModels: [], coveredTypes: [], dtxr: [] }; const covered = unique(mapped.coveredTypes); const missing = masterTypes.filter((type) => !covered.includes(type)); const extra = covered.filter((type) => !masterTypes.includes(type)); let status = 'NO_MASTER_SUPPORT'; if (masterTypes.length && !mapped.psnoModels.length) status = 'UNMAPPED_NODE'; else if (masterTypes.length && !missing.length && !extra.length) status = 'COVERED'; else if (masterTypes.length && missing.length && covered.length) status = 'PARTIAL'; else if (masterTypes.length && missing.length && !covered.length) status = 'MISSING_ALL'; else if (extra.length) status = 'COVERED_WITH_EXTRA'; return { ...coverage, masterKeywords: supportDisplayList(masterTypes), mappedPsnoModel: unique(mapped.psnoModels).join(', '), coveredDtxrKeywords: supportDisplayList(covered), missingMasterKeywords: supportDisplayList(missing), extraDtxrKeywords: supportDisplayList(extra), coverageStatus: status, action: missing.length ? `Node ${coverage.node || '-'} missing ${supportDisplayList(missing)} in mapped DTXR.` : extra.length ? `Node ${coverage.node || '-'} has extra mapped DTXR ${supportDisplayList(extra)}.` : '' }; }); }
function buildMissingSupportAuditRows(supportCoverageRows = [], options = DEFAULT_OPTIONS) { const auditRows = []; for (const coverage of supportCoverageRows || []) { const missing = splitSupportList(coverage.missingMasterKeywords, options); if (!missing.length) continue; for (const missingType of missing) { const missingDisplay = displaySupportKeyword(missingType); const action = `Add Table-2 DTXR/model support row for ${missingDisplay}, or revise Table-1C ISONOTE if ${missingDisplay} is not required.`; auditRows.push({ enabled: false, psnoModel: '-', basePs: '', modelTag: '', modelBore: '', pipe: '', pipeKey: '', lineFamily: '', dtxr: '', supportGapRaw: '', supportGapMm: '', nodeGuideGapMm: '', gapMatch: '', mandatory: coverage.mandatory === 'YES', supportTypesRequested: '', modelDtxrKeywords: '', table2Row: '', candidateNode: coverage.node || '', node: coverage.node || '', table1PsNo: coverage.table1PsNo || '', tag: coverage.tag || '', source: coverage.source || '', sourceRow: coverage.sourceRow || '', nodeLine: coverage.lineNo || '', nodeLineKey: '', nodeLineFamily: coverage.lineFamily || '', pipeSizeRaw: coverage.pipeSizeRaw || '', derivedDn: coverage.derivedDn || '', nodeIsonote: coverage.isonote || '', nodeIsonoteRaw: coverage.isonote || '', nodeMasterKeywords: coverage.masterKeywords || '', supportTypesAvailable: coverage.masterKeywords || '', refMandatory: coverage.mandatory === 'YES', psBasis: 'PS_BASE', boreBasis: coverage.derivedDn ? 'BORE_DN_FROM_NPS' : '', lineBasis: '', supportBasis: 'SUPPORT_MISSING_MASTER_REQUIRED', supportMatch: `${missingDisplay} missing`, missingSupportKeywords: missingDisplay, extraSupportKeywords: coverage.extraDtxrKeywords || '', matchedSupportKeywords: coverage.coveredDtxrKeywords || '', eligible: false, autoSelectable: false, reviewRequired: true, selected: false, finalStatus: 'SUPPORT_MISSING_REQUIRED', confidence: 'AUDIT', confidenceScore: 0, score: 999999, warnings: `SUPPORT_MISSING_REQUIRED: ${missingDisplay}`, reason: action, reviewAction: action, nodeCoverageStatus: coverage.coverageStatus || '', nodeCoverageNote: `${missingDisplay} missing from mapped Table-2 DTXR for Node ${coverage.node || '-'}.`, matchGroup: '03_REVIEW_REQUIRED', basis: ['PS_BASE', coverage.derivedDn ? 'BORE_DN_FROM_NPS' : '', 'SUPPORT_MISSING_MASTER_REQUIRED'].filter(Boolean).join(' + ') }); } } return auditRows; }

export function normalizePsMappingOptions(options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const attemptApproxLineMatch = merged.attemptApproxLineMatch === true;
  const attemptApproxBoreMatch = merged.attemptApproxBoreMatch === true;
  merged.attemptApproxLineMatch = attemptApproxLineMatch;
  merged.attemptApproxBoreMatch = attemptApproxBoreMatch;
  merged.useBuiltInSupportKeywordLogic = merged.useBuiltInSupportKeywordLogic !== false;
  merged.treatAnchorAsLineStop = merged.treatAnchorAsLineStop !== false;
  merged.supportKeywordRulesText = String(merged.supportKeywordRulesText || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT);
  merged.enableSupportGapComparison = merged.enableSupportGapComparison !== false;
  merged.supportGapToleranceMm = toFiniteNumber(merged.supportGapToleranceMm, 0);
  merged.enableNearLineDiagnostic = attemptApproxLineMatch && merged.enableNearLineDiagnostic !== false;
  merged.nearLineReviewOnly = true;
  merged.nearLineMaxEditDistance = toFiniteNumber(merged.nearLineMaxEditDistance, 1);
  merged.nearLineMinStemLength = toFiniteNumber(merged.nearLineMinStemLength, 6);
  merged.allowRawDiaMatch = attemptApproxBoreMatch;
  merged.odToleranceMm = attemptApproxBoreMatch ? toFiniteNumber(merged.odToleranceMm, 1.5) : 0;
  return merged;
}

function annotateResult(result, options) {
  const consolidatedTable2Rows = enrichConsolidatedTable2Rows(result?.consolidatedTable2Rows || [], options);
  const modelByPs = buildModelMap(consolidatedTable2Rows);
  const rows = normalizeDiagnosticsInRows(result?.rows, options, modelByPs);
  const outputRows = normalizeDiagnosticsInRows(result?.outputRows, options, modelByPs);
  const baseCandidates = result?.candidates || result?.candidateRows || [];
  const candidateRows = applyDominance(normalizeDiagnosticsInRows(baseCandidates, options, modelByPs));
  const validatorRows = normalizeDiagnosticsInRows(result?.validatorRows || rows, options, modelByPs);
  const supportCoverageRows = recomputeSupportCoverageRows(result?.supportCoverageRows || [], rows, options);
  const missingSupportAuditRows = buildMissingSupportAuditRows(supportCoverageRows, options);
  const allCandidates = applyDominance([...(candidateRows || []), ...missingSupportAuditRows]);
  const allRows = [...(rows || []), ...missingSupportAuditRows];
  const allOutputRows = [...(outputRows || []), ...missingSupportAuditRows];
  const allValidatorRows = [...(validatorRows || []), ...missingSupportAuditRows];
  const approxConfig = { ...(result?.approxConfig || {}), attemptApproxLineMatch: options.attemptApproxLineMatch, attemptApproxBoreMatch: options.attemptApproxBoreMatch, useBuiltInSupportKeywordLogic: options.useBuiltInSupportKeywordLogic, treatAnchorAsLineStop: options.treatAnchorAsLineStop, supportKeywordRulesText: options.supportKeywordRulesText, supportKeywordLogic: 'Editable support keyword rules are Pattern -> Canonical. Wildcards such as *PIPE SHOE* are supported. Canonical values include REST, GUIDE, LINE_STOP.', supportGapLogic: 'Table-2 Support Gap is compared against Table-1C ISONOTE GUIDE GAP. Conflicts set GAP_CONFLICT and require review.' };
  return { ...result, consolidatedTable2Rows, rows: allRows, outputRows: allOutputRows, candidateRows: allCandidates, candidates: allCandidates, validatorRows: allValidatorRows, supportCoverageRows, missingSupportAuditRows, optionsUsed: options, approxConfig, summary: { ...(result?.summary || {}), review: allRows.filter((row) => row.finalStatus === 'USER_REVIEW_REQUIRED' || row.finalStatus === 'SUPPORT_MISSING_REQUIRED').length, noMatch: allRows.filter((row) => !row.enabled).length, candidateRows: allCandidates.length, approxLineEnabled: options.attemptApproxLineMatch, approxBoreEnabled: options.attemptApproxBoreMatch, missingSupportAuditRows: missingSupportAuditRows.length, gapConflicts: allCandidates.filter((row) => row.gapMatch === 'GAP_CONFLICT').length } };
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runBasePsMappingResolver({ ...input, options });
  return annotateResult(result, options);
}
