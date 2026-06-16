import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV14PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v14.js?v=20260614-psno-wise-action-guard-clean-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const SUPPORT_ORDER = Object.freeze(['REST', 'GUIDE', 'LINE_STOP']);

function text(value) {
  return String(value ?? '').trim();
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

function labelSupport(type) {
  if (type === 'LINE_STOP') return 'LINE STOP';
  return clean(type).replace(/_/g, ' ');
}

function psActionKey(row = {}) {
  return clean(
    row.table1PsNo
    || row.mappedTable1PsNo
    || row.psNo
    || row['Table-1 PS No']
    || row.basePs
    || ''
  );
}

function modelPsNo(row = {}) {
  return clean(row.psnoModel || row.modelPsNo || row.rawPsNo || row.basePs || row['PSNO_Model'] || '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function t1LineFamily(row = {}) {
  return clean(row.t1LineFamily || row.nodeLineFamily || row.lineFamily || row['T1 Line Family'] || '');
}

function derivedDn(row = {}) {
  return clean(row.derivedDn || row.nodeDerivedDn || row['Derived DN'] || '');
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
  const source = normalizeSupportText(...values);
  const out = new Set();
  if (!source) return out;
  if (/\bREST\b|\bPIPE\s+REST\b|\bXRT\b|\bPIPE\s+SHOE\b|\bWEAR\s+PLATE\b/.test(source)) out.add('REST');
  if (/\bGUIDE\b/.test(source)) out.add('GUIDE');
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bLIMIT\s*STOP\b|\bPIPE\s+STOP\b|\bDIRECTIONAL\s+ANCHOR\b|\bANCHOR\b|\bSTOP\b/.test(source)) out.add('LINE_STOP');
  return out;
}

function table1SupportTypes(row = {}) {
  return supportSetFromText(
    row.supportTypesAvailable,
    row.nodeMasterKeywords,
    row.table1SupportTypes,
    row.nodeIsonote,
    row.nodeIsonoteRaw,
    row.isonote,
    row.ISONOTE,
    row['ISONOTE'],
  );
}

function table2SupportTypes(row = {}) {
  return supportSetFromText(
    row.supportTypesRequested,
    row.modelDtxrKeywords,
    row.dtxr,
    row.t2Keywords,
    row.DTXR,
    row['T2 Keywords'],
  );
}

function numericText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return clean(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

function readRawField(row = {}, names = []) {
  const raw = row.rawColumns && typeof row.rawColumns === 'object' ? row.rawColumns : null;
  for (const name of names) {
    if (row[name] != null && clean(row[name])) return row[name];
    if (raw && raw[name] != null && clean(raw[name])) return raw[name];
  }
  if (raw) {
    const wanted = names.map((name) => upper(name));
    for (const [key, value] of Object.entries(raw)) {
      if (wanted.includes(upper(key)) && clean(value)) return value;
    }
  }
  return '';
}

function sourceForTable1Gap(row = {}) {
  return clean([
    row.nodeIsonote,
    row.nodeIsonoteRaw,
    row.table1Isonote,
    row.isonote,
    row.ISONOTE,
    row['ISONOTE'],
  ].filter(Boolean).join(' '));
}

function sourceForTable2Gap(row = {}) {
  return clean([
    readRawField(row, [
      'supportGapRaw',
      'supportGap',
      'supportGapMm',
      'Support Gap',
      'Guide Gap',
      'Gap',
      'gap',
      'modelSupportGap',
      't2SupportGap',
    ]),
    row.t2Isonote,
    row.modelIsonote,
  ].filter(Boolean).join(' '));
}

function setGap(out, kind, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return;
  out[kind] = value;
}

function extractTypedGaps(source, parentTypes = new Set()) {
  const src = upper(source);
  const out = {};
  if (!src) return out;

  for (const match of src.matchAll(/\bLINE\s*STOP\s*GAP\b\s*(?:=|:|-)?\s*(-?\d+(?:\.\d+)?)\s*(?:M\s*M|MM)?\b/gi)) {
    setGap(out, 'LINE_STOP', match[1]);
  }
  for (const match of src.matchAll(/\bGUIDE\s*GAP\b\s*(?:=|:|-)?\s*(-?\d+(?:\.\d+)?)\s*(?:M\s*M|MM)?\b/gi)) {
    setGap(out, 'GUIDE', match[1]);
  }

  if (out.GUIDE != null || out.LINE_STOP != null) return out;

  const generic = src.match(/(?:^|\b)GAP\b\s*(?:=|:|-)?\s*(-?\d+(?:\.\d+)?)\s*(?:M\s*M|MM)?\b/i)
    || src.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:M\s*M|MM)?\s*$/i);
  if (!generic) return out;

  const gapBearingParents = SUPPORT_ORDER.filter((type) => type !== 'REST' && parentTypes.has(type));
  if (gapBearingParents.length === 1) setGap(out, gapBearingParents[0], generic[1]);
  return out;
}

function unionInto(target, source) {
  for (const item of source || []) target.add(item);
}

function orderedDifference(a, b) {
  return SUPPORT_ORDER.filter((type) => a.has(type) && !b.has(type));
}

function hasBoreMismatch(row = {}) {
  const basis = upper(row.boreBasis);
  const reason = upper(`${row.reason || ''} ${row.warnings || ''}`);
  return /BORE.*(CONFLICT|MISMATCH|REJECT)/.test(reason)
    || ['BORE_CONFLICT', 'BORE_REJECT', 'BORE_MISMATCH'].includes(basis);
}

function hasLineMismatch(row = {}) {
  const basis = upper(row.lineBasis);
  const reason = upper(`${row.reason || ''} ${row.warnings || ''}`);
  return /LINE.*(CONFLICT|MISMATCH|REJECT)/.test(reason)
    || ['LINE_CONFLICT', 'LINE_REJECT', 'LINE_MISMATCH'].includes(basis);
}

function hasDuplicateNodeContext(row = {}) {
  return upper(`${row.reason || ''} ${row.warnings || ''} ${row.nodeCoverageNote || ''}`).includes('DUPLICATE TABLE-1 NODE CONTEXT')
    || upper(row.warnings || '').includes('DUPLICATE_TABLE1_NODE_CONTEXT')
    || upper(row.duplicateNodeContext || '') === 'YES';
}

function isLineBoreClean(row = {}) {
  return !hasLineMismatch(row) && !hasBoreMismatch(row);
}

function groupKey(row = {}) {
  const ps = psActionKey(row);
  if (!ps) return '';
  return [ps, candidateNode(row), t1LineFamily(row), derivedDn(row)].join('\u241f');
}

function buildGroup(firstRow = {}) {
  return {
    key: groupKey(firstRow),
    psNo: psActionKey(firstRow),
    nodes: new Set(),
    t1Lines: new Set(),
    derivedDns: new Set(),
    rows: [],
    cleanRows: [],
    t1Types: new Set(),
    t2Types: new Set(),
    t1Gaps: {},
    t2Gaps: {},
    duplicateNodeContext: false,
  };
}

function mergeGap(target, source) {
  for (const [kind, value] of Object.entries(source || {})) {
    if (target[kind] == null) target[kind] = value;
  }
}

function addGroupRow(group, row = {}) {
  group.rows.push(row);
  if (isLineBoreClean(row)) group.cleanRows.push(row);
  const node = candidateNode(row);
  const line = t1LineFamily(row);
  const dn = derivedDn(row);
  if (node) group.nodes.add(node);
  if (line) group.t1Lines.add(line);
  if (dn) group.derivedDns.add(dn);
  unionInto(group.t1Types, table1SupportTypes(row));
  mergeGap(group.t1Gaps, extractTypedGaps(sourceForTable1Gap(row), table1SupportTypes(row)));
  if (hasDuplicateNodeContext(row)) group.duplicateNodeContext = true;
}

function finalizeGroupCoverage(group) {
  const coverageRows = group.cleanRows.length ? group.cleanRows : group.rows;
  for (const row of coverageRows) {
    const t2Types = table2SupportTypes(row);
    unionInto(group.t2Types, t2Types);
    mergeGap(group.t2Gaps, extractTypedGaps(sourceForTable2Gap(row), t2Types));
  }
}

function pushUnique(actions, seen, priority, textValue) {
  const value = clean(textValue);
  if (!value || seen.has(value)) return;
  seen.add(value);
  actions.push({ priority, text: value });
}

function buildGroupAction(group) {
  finalizeGroupCoverage(group);
  const actions = [];
  const seen = new Set();

  for (const type of orderedDifference(group.t1Types, group.t2Types)) {
    if (type === 'REST') pushUnique(actions, seen, 10, 'Add REST in Table-2');
    else if (type === 'GUIDE') pushUnique(actions, seen, 11, 'Add GUIDE in Table-2');
    else if (type === 'LINE_STOP') pushUnique(actions, seen, 12, 'Add LINE STOP in Table-2 for this PS No.');
  }

  for (const type of orderedDifference(group.t2Types, group.t1Types)) {
    if (type === 'GUIDE') pushUnique(actions, seen, 20, 'Remove or reclassify extra GUIDE in Table-2; Table-1 does not require GUIDE.');
    else pushUnique(actions, seen, 21, `Remove or reclassify extra ${labelSupport(type)} in Table-2; Table-1 does not require ${labelSupport(type)}.`);
  }

  for (const kind of ['GUIDE', 'LINE_STOP']) {
    if (!group.t1Types.has(kind) || !group.t2Types.has(kind) || group.t1Gaps[kind] == null) continue;
    const t1 = Number(group.t1Gaps[kind]);
    const t2 = Number(group.t2Gaps[kind]);
    if (!Number.isFinite(t2) || Math.abs(t1 - t2) > 0) {
      pushUnique(actions, seen, kind === 'GUIDE' ? 30 : 31, `Correct Table-2 ${labelSupport(kind)} GAP to Table-1's ${labelSupport(kind)} GAP ${numericText(t1)} mm value.`);
    }
  }

  if (!group.cleanRows.length && group.rows.length) {
    if (group.rows.some(hasBoreMismatch)) pushUnique(actions, seen, 40, 'Correct Table-2 bore to Table-1 derived DN.');
    if (group.rows.some(hasLineMismatch)) pushUnique(actions, seen, 50, 'Correct Table-2 line family to Table-1 line family.');
  }

  if (group.duplicateNodeContext) {
    pushUnique(actions, seen, 60, 'Manual review: multiple Table-1 nodes share same PS No. + line + bore; select correct node.');
  }

  const body = actions.length
    ? actions.sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text, undefined, { numeric: true })).map((item) => item.text).join('; ')
    : 'No Action based on Table-2';

  const scope = formatScope(group);
  return {
    body,
    scoped: scope ? `${scope}: ${body}` : body,
  };
}

function formatScope(group) {
  const parts = [];
  if (group.psNo) parts.push(`PS ${group.psNo}`);
  const nodes = [...group.nodes].filter(Boolean).join('|');
  const lines = [...group.t1Lines].filter(Boolean).join('|');
  const dns = [...group.derivedDns].filter(Boolean).join('|');
  if (nodes) parts.push(`Node(s) ${nodes}`);
  if (lines) parts.push(`Line ${lines}`);
  if (dns) parts.push(`DN ${dns}`);
  return parts.join(' / ');
}

function candidateSourceRows(result = {}) {
  const rows = Array.isArray(result.candidates) && result.candidates.length
    ? result.candidates
    : Array.isArray(result.candidateRows) && result.candidateRows.length
      ? result.candidateRows
      : [];
  return rows.filter((row) => psActionKey(row));
}

function buildGroupedActionMap(result = {}) {
  const groups = new Map();
  for (const row of candidateSourceRows(result)) {
    const key = groupKey(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, buildGroup(row));
    addGroupRow(groups.get(key), row);
  }

  const out = new Map();
  for (const [key, group] of groups.entries()) out.set(key, buildGroupAction(group));
  return out;
}

function table2OnlyAction(row = {}) {
  const model = modelPsNo(row);
  return {
    body: 'Manual review; Table-1 is authoritative.',
    scoped: model
      ? `Table-2 PS ${model}: No Table-1 PS No. match for Table-2 PS. Action: manual review; Table-1 is authoritative.`
      : 'No Table-1 PS No. match for Table-2 PS. Action: manual review; Table-1 is authoritative.',
  };
}

function rowCoverageNote(row = {}, groupAction) {
  const parts = [];
  const model = modelPsNo(row);
  const node = candidateNode(row);
  const support = clean(row.supportMatch || row.supportBasis || row['Support Match']);
  const gap = clean(row.supportGapMatch || row.gapMatch || row['Support Gap Match']);
  if (support) parts.push(`Support: ${support}`);
  if (gap) parts.push(`Gap: ${gap}`);
  if (hasLineMismatch(row)) parts.push('Line family mismatch on this candidate');
  if (hasBoreMismatch(row)) parts.push('Bore mismatch on this candidate');
  if (!parts.length) parts.push(groupAction?.body === 'No Action based on Table-2' ? 'Candidate covered by Table-2' : 'Candidate participates in PS-level coverage');
  const scope = [node ? `Node ${node}` : '', model ? `Table-2 ${model}` : ''].filter(Boolean).join(' / ');
  return scope ? `${scope}: ${parts.join('; ')}.` : `${parts.join('; ')}.`;
}

function applyReadableActions(rows, actionMap) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const key = groupKey(row);
    const action = key ? actionMap.get(key) : null;
    const finalAction = action || (!psActionKey(row) ? table2OnlyAction(row) : null);
    if (!finalAction) return row;
    return {
      ...row,
      psNoWiseAction: finalAction.body,
      nodeCoverageNote: rowCoverageNote(row, finalAction),
      consolidatedNodeWiseAction: finalAction.scoped,
    };
  });
}

export function runPsMappingResolver(input = {}) {
  const result = runV14PsMappingResolver(input);
  const actionMap = buildGroupedActionMap(result);
  return {
    ...result,
    rows: applyReadableActions(result.rows, actionMap),
    outputRows: applyReadableActions(result.outputRows, actionMap),
    validatorRows: applyReadableActions(result.validatorRows, actionMap),
    candidateRows: applyReadableActions(result.candidateRows, actionMap),
    candidates: applyReadableActions(result.candidates, actionMap),
    approxConfig: {
      ...(result.approxConfig || {}),
      psNoWiseActionRules: 'Readable v15: PS actions are grouped by Table-1 PS No. + node + line + DN, support coverage is evaluated from line/bore-clean Table-2 candidates, and table cells use semicolon-separated concise actions.',
    },
  };
}
