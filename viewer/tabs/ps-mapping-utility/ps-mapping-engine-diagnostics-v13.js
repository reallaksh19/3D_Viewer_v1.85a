import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV12PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v12.js?v=20260612-duplicate-node-context-1';

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
  if (type === 'REST') return 'REST';
  if (type === 'GUIDE') return 'GUIDE';
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
  return clean(row.psnoModel || row.modelPsNo || row.rawPsNo || row.basePs || '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || '');
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
  );
}

function table2SupportTypes(row = {}) {
  return supportSetFromText(
    row.supportTypesRequested,
    row.modelDtxrKeywords,
    row.dtxr,
    row.t2Keywords,
    row.DTXR,
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

function orderedDifference(a, b) {
  return SUPPORT_ORDER.filter((type) => a.has(type) && !b.has(type));
}

function addAction(bucket, priority, textValue) {
  const value = clean(textValue);
  if (!value) return;
  if (!bucket.actionByText.has(value)) {
    bucket.actionByText.set(value, { priority, text: value });
  }
}

function buildBucket(psNo) {
  return {
    psNo,
    nodes: new Set(),
    modelPsNos: new Set(),
    actionByText: new Map(),
    sawIssue: false,
  };
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

function markIssue(bucket) {
  bucket.sawIssue = true;
}

function analyzeRow(row = {}, bucket) {
  const t1Types = table1SupportTypes(row);
  const t2Types = table2SupportTypes(row);
  const t1Gaps = extractTypedGaps(sourceForTable1Gap(row), t1Types);
  const t2Gaps = extractTypedGaps(sourceForTable2Gap(row), t2Types);

  const node = candidateNode(row);
  const model = modelPsNo(row);
  if (node) bucket.nodes.add(node);
  if (model) bucket.modelPsNos.add(model);

  const missing = orderedDifference(t1Types, t2Types);
  const extra = orderedDifference(t2Types, t1Types);

  for (const type of missing) {
    markIssue(bucket);
    if (type === 'REST') addAction(bucket, 10, 'Add REST in Table-2');
    else if (type === 'GUIDE') addAction(bucket, 11, 'Add GUIDE in Table-2');
    else if (type === 'LINE_STOP') addAction(bucket, 12, 'Add LINE STOP in Table-2 for this PS No.');
  }

  for (const type of extra) {
    markIssue(bucket);
    if (type === 'GUIDE') {
      addAction(bucket, 20, 'Remove or reclassify extra GUIDE in Table-2; Table-1 does not require GUIDE.');
    } else {
      addAction(bucket, 21, `Remove or reclassify extra ${labelSupport(type)} in Table-2; Table-1 does not require ${labelSupport(type)}.`);
    }
  }

  if (t1Gaps.LINE_STOP != null && !t1Types.has('GUIDE')) {
    // Explicit guard for the previously observed false-positive: [LINE STOP GAP=..]
    // must never become a GUIDE GAP action.
    addAction(bucket, 29, 'Do not report as GUIDE gap; treat as LINE STOP gap only.');
  }

  if (t1Types.has('GUIDE') && t2Types.has('GUIDE') && t1Gaps.GUIDE != null) {
    const different = t2Gaps.GUIDE == null || Math.abs(Number(t2Gaps.GUIDE) - Number(t1Gaps.GUIDE)) > 0;
    if (different) {
      markIssue(bucket);
      addAction(bucket, 30, `Correct Table-2 GUIDE GAP to Table-1's GUIDE GAP ${numericText(t1Gaps.GUIDE)} mm value.`);
    }
  }

  if (t1Types.has('LINE_STOP') && t2Types.has('LINE_STOP') && t1Gaps.LINE_STOP != null) {
    const different = t2Gaps.LINE_STOP == null || Math.abs(Number(t2Gaps.LINE_STOP) - Number(t1Gaps.LINE_STOP)) > 0;
    if (different) {
      markIssue(bucket);
      addAction(bucket, 31, `Correct Table-2 LINE STOP GAP to Table-1's LINE STOP GAP ${numericText(t1Gaps.LINE_STOP)} mm value.`);
    }
  }

  if (hasBoreMismatch(row)) {
    markIssue(bucket);
    addAction(bucket, 40, 'Correct Table-2 bore to Table-1 derived DN.');
  }

  if (hasLineMismatch(row)) {
    markIssue(bucket);
    addAction(bucket, 50, 'Correct Table-2 line family to Table-1 line family.');
  }

  if (hasDuplicateNodeContext(row)) {
    markIssue(bucket);
    addAction(bucket, 60, 'Manual review: multiple Table-1 nodes share same PS No. + line + bore; select correct node.');
  }
}

function formatScope(bucket) {
  const parts = [];
  if (bucket.psNo) parts.push(`PS ${bucket.psNo}`);
  const nodes = [...bucket.nodes].filter(Boolean).join('|');
  const modelPs = [...bucket.modelPsNos].filter(Boolean).join('|');
  if (nodes) parts.push(`Node(s) ${nodes}`);
  if (modelPs) parts.push(`Table-2 PS ${modelPs}`);
  return parts.join(' / ');
}

function formatAction(bucket) {
  const actions = [...bucket.actionByText.values()]
    .sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text, undefined, { numeric: true }))
    .map((item) => item.text);
  const body = actions.length ? actions.join(' ') : 'No Action based on Table-2';
  const scope = formatScope(bucket);
  return scope ? `${scope}: ${body}` : body;
}

function candidateSourceRows(result = {}) {
  const rows = Array.isArray(result.candidates) && result.candidates.length
    ? result.candidates
    : Array.isArray(result.candidateRows) && result.candidateRows.length
      ? result.candidateRows
      : [];
  return rows.filter((row) => psActionKey(row));
}

function buildPsActionMap(result = {}) {
  const buckets = new Map();
  for (const row of candidateSourceRows(result)) {
    const key = psActionKey(row);
    if (!buckets.has(key)) buckets.set(key, buildBucket(key));
    analyzeRow(row, buckets.get(key));
  }

  const out = new Map();
  for (const [key, bucket] of buckets.entries()) out.set(key, formatAction(bucket));
  return out;
}

function applyPsActions(rows, psActionMap) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const action = psActionMap.get(psActionKey(row));
    if (!action) return row;
    return {
      ...row,
      psNoWiseAction: action,
      nodeCoverageNote: action,
      consolidatedNodeWiseAction: action,
    };
  });
}

export function runPsMappingResolver(input = {}) {
  const result = runV12PsMappingResolver(input);
  const psActionMap = buildPsActionMap(result);

  return {
    ...result,
    rows: applyPsActions(result.rows, psActionMap),
    outputRows: applyPsActions(result.outputRows, psActionMap),
    validatorRows: applyPsActions(result.validatorRows, psActionMap),
    candidateRows: applyPsActions(result.candidateRows, psActionMap),
    candidates: applyPsActions(result.candidates, psActionMap),
    summary: {
      ...(result.summary || {}),
      psNoWiseActionCount: psActionMap.size,
    },
    approxConfig: {
      ...(result.approxConfig || {}),
      psNoWiseActionAssumption: 'Table-1 is treated as the source of truth. PS No. wise actions are generated as Table-2/model correction instructions only.',
      psNoWiseActionRules: 'REST/GUIDE/LINE STOP missing/extra, support-specific GUIDE/LINE STOP gap corrections, bore mismatch, line-family mismatch, duplicate Table-1 node context, and clean no-action cases.',
    },
  };
}
