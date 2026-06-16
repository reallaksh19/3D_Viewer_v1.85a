const DEFAULT_OPTIONS = {
  boreMode: 'prefer',
  lineMode: 'prefer',
  supportMode: 'prefer',
  odToleranceMm: 1.5,
  allowRawDiaMatch: true,
  allowDnMatch: true,
  allowDuplicateAssignment: true,
};

const DEFAULT_MASTER_KEYWORDS = 'Rest, Guide, Line stop';

const DEFAULT_SUPPORT_KEYWORD_CATALOG = [
  { raw: 'Rest', canonical: 'REST', aliases: ['REST', 'PIPE REST', 'XRT'] },
  { raw: 'Guide', canonical: 'GUIDE', aliases: ['GUIDE'] },
  { raw: 'Line stop', canonical: 'LINE_STOP', aliases: ['LINE STOP', 'LINESTOP', 'PIPE STOP', 'STOP'] },
];

const OD_TO_DN = [
  { od: 21.3, dn: 15 }, { od: 26.7, dn: 20 }, { od: 33.4, dn: 25 }, { od: 48.3, dn: 40 },
  { od: 60.3, dn: 50 }, { od: 73.0, dn: 65 }, { od: 88.9, dn: 80 }, { od: 114.3, dn: 100 },
  { od: 141.3, dn: 125 }, { od: 168.3, dn: 150 }, { od: 219.1, dn: 200 }, { od: 273.0, dn: 250 },
  { od: 273.1, dn: 250 }, { od: 323.9, dn: 300 }, { od: 355.6, dn: 350 }, { od: 406.4, dn: 400 },
];

const NPS_TO_DN = new Map([
  [0.5, 15], [0.75, 20], [1, 25], [1.25, 32], [1.5, 40], [2, 50], [2.5, 65],
  [3, 80], [3.5, 90], [4, 100], [5, 125], [6, 150], [8, 200], [10, 250],
  [12, 300], [14, 350], [16, 400], [18, 450], [20, 500], [22, 550], [24, 600],
  [26, 650], [28, 700], [30, 750], [32, 800], [34, 850], [36, 900],
]);

function hkey(value) {
  return String(value ?? '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function splitLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
}
function splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((v) => v.trim());
  if (raw.includes(',')) return raw.split(',').map((v) => v.trim());
  return raw.split(/ {2,}/).map((v) => v.trim()).filter(Boolean);
}
function idx(headers, aliases) {
  const set = new Set(aliases.map(hkey));
  return headers.findIndex((header) => set.has(hkey(header)));
}
function cell(cells, index) {
  return index >= 0 ? String(cells[index] ?? '').trim() : '';
}
function number(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}
function natural(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}
function uniqueSorted(values) {
  return [...new Set((values || []).filter((value) => value != null && value !== ''))].sort(natural);
}
function truthy(value) {
  return /^(yes|y|true|1|m|mandatory|required|req|must|audit|100%)$/i.test(String(value ?? '').trim());
}
function tagLabel(tag) {
  return tag ? ` [Tag: ${tag}]` : '';
}
function nodeTagLabel(row) {
  return row?.tag ? ` [Tag: ${row.tag}]` : '';
}
function nodeSubject(node, tag = '') {
  return `Node ${node}${tagLabel(tag)}`;
}
function table1Context(row) {
  return { node: row?.node || '', tag: row?.tag || '', table1PsNo: row?.table1PsNo || row?.rawPsNo || '' };
}
function mergeUniqueText(existing, next, sep = ' | ') {
  const values = uniqueSorted(String(existing || '').split(sep).concat(String(next || '').split(sep)).map((x) => x.trim()).filter(Boolean));
  return values.join(sep);
}

export function normalizePsNo(rawValue) {
  const raw = String(rawValue ?? '').trim();
  const [beforeTag, ...tagParts] = raw.split('|');
  const tag = tagParts.length ? tagParts.join('|').trim() : '';
  let clean = String(beforeTag ?? '').trim();
  const isDatum = /\/\s*DATUM\b/i.test(clean);
  clean = clean.replace(/\/\s*DATUM\b/gi, '').replace(/\.\d+\b/g, '').trim();
  const basePsMatch = clean.match(/\bPS[-_ ]?\d+\b/i);
  const basePs = basePsMatch ? basePsMatch[0].toUpperCase().replace(/\s+/g, '').replace('_', '-') : clean.toUpperCase();
  const exactRawKey = raw.toUpperCase().replace(/\s+/g, '');
  return { raw, exactRawKey, basePs, isDatum, tag };
}

export function normalizeLineKey(value) {
  return String(value ?? '').toUpperCase().replace(/^\/+/, '').replace(/-HC\b/g, '').replace(/\s+/g, '').trim();
}
function extractLineFamily(value) {
  const text = normalizeLineKey(value);
  if (!text) return '';
  // Line-family is a deliberately weaker key than full Pipe Key.
  // It keeps only NPS + service/line-number stem, for example:
  //   ASIM-1885-4"-P8810246-31441C4-PP -> 4"-P8810246
  //   ASIM-1885-3"-W8810140-31441C4-PP -> 3"-W8810140
  //   ASIM-1885-10"-S8810101-91261M7-HC -> 10"-S8810101
  // Previous logic only handled S-lines, leaving P/W/D families blank.
  const nps = String.raw`(?:\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const match = text.match(new RegExp(`(${nps}["']?-[A-Z]\\d{4,})`, 'i'));
  if (match) return match[1].toUpperCase();
  const stem = text.match(/\b([A-Z]\d{4,})\b/i);
  return stem ? stem[1].toUpperCase() : '';
}

function canonicalKeywordName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}
function catalogForKeyword(rawKeyword) {
  const raw = String(rawKeyword || '').trim();
  const upper = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!upper) return null;
  if (upper === 'REST') return { raw, canonical: 'REST', aliases: ['REST', 'PIPE REST', 'XRT'] };
  if (upper === 'GUIDE') return { raw, canonical: 'GUIDE', aliases: ['GUIDE'] };
  if (upper === 'LINE STOP' || upper === 'LINESTOP' || upper === 'STOP') return { raw, canonical: 'LINE_STOP', aliases: ['LINE STOP', 'LINESTOP', 'PIPE STOP', 'STOP'] };
  return { raw, canonical: canonicalKeywordName(raw), aliases: [upper] };
}
function parseTable1DKeywords(text, log) {
  const source = String(text || '').trim() || DEFAULT_MASTER_KEYWORDS;
  const lines = splitLines(source);
  let rawText = source;
  if (lines.length > 1 && /master\s+keywords/i.test(lines[0])) rawText = lines.slice(1).join(',');
  const parsed = rawText.split(',').map((item) => catalogForKeyword(item)).filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const item of parsed.length ? parsed : DEFAULT_SUPPORT_KEYWORD_CATALOG) {
    if (!item.canonical || seen.has(item.canonical)) continue;
    seen.add(item.canonical);
    unique.push(item);
  }
  log.debug('INFO', 'T1D_KEYWORD_CATALOG_PARSED', 'Table-1D', { source, catalog: unique });
  log.user('INFO', 'PARSE', 'Table-1D', `Parsed master support keyword(s): ${unique.map((item) => item.canonical).join(', ')}.`);
  return unique;
}

export function normalizeSupportTypes(value, catalog = DEFAULT_SUPPORT_KEYWORD_CATALOG) {
  const cleaned = String(value ?? '').replace(/\[[^\]]*GAP[^\]]*\]/gi, ' ').toUpperCase();
  const types = new Set();
  for (const item of catalog || DEFAULT_SUPPORT_KEYWORD_CATALOG) {
    for (const alias of item.aliases || [item.raw]) {
      const escaped = String(alias).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(cleaned)) { types.add(item.canonical); break; }
    }
  }
  return [...types];
}
function supportDisplay(type) {
  if (type === 'LINE_STOP') return 'STOP';
  if (type === 'REST') return 'REST';
  if (type === 'GUIDE') return 'GUIDE';
  return String(type || '').replace(/_/g, ' ');
}
function supportMatchText(types) {
  return types.length ? `${types.map(supportDisplay).join('+')} Match` : '';
}
function supportListText(types) {
  return (types || []).map(supportDisplay).join(', ');
}

function createLogger() {
  const userLog = [];
  const debugLog = [];
  return {
    userLog,
    debugLog,
    user(level, stage, subject, message, action = '', details = {}) {
      userLog.push({
        time: new Date().toISOString(),
        level,
        stage,
        subject,
        message,
        action,
        tag: details.tag || '',
        table1PsNo: details.table1PsNo || '',
        node: details.node || '',
        psnoModel: details.psnoModel || '',
      });
    },
    debug(level, code, subject, details = {}) { debugLog.push({ time: new Date().toISOString(), level, code, subject, details }); },
  };
}

function parseTable1(text, log) {
  const lines = splitLines(text);
  if (!lines.length) { log.user('INFO', 'PARSE', 'Table-1', 'Optional Table-1 is blank. Consolidated Table-1 may be synthesized from rich Table-1C.'); return []; }
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['ps no', 'ps name', 'ps']);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  if (psIdx < 0 || nodeIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1', 'Required columns PS No and Node were not found. Rich Table-1C may still supply references.'); return []; }
  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const rawPsNo = cell(cells, psIdx);
    const node = cell(cells, nodeIdx);
    if (!rawPsNo || !node) { log.user('WARNING', 'PARSE', `Table-1 row ${sourceRow}`, 'Blank PS No or Node skipped.'); continue; }
    const norm = normalizePsNo(rawPsNo);
    const row = { id: `T1#${String(offset + 1).padStart(3, '0')}`, sourceRow, rawPsNo, table1PsNo: rawPsNo, node, ...norm, tag: norm.tag, source: 'TABLE1', used: false };
    rows.push(row);
    log.debug('DEBUG', 'T1_ROW_PARSED', rawPsNo, row);
    if (norm.tag) log.user('INFO', 'NORMALIZE', rawPsNo, `Extracted tag "${norm.tag}" from Table-1 PS data.`, '', { tag: norm.tag, table1PsNo: rawPsNo, node });
  }
  log.user('INFO', 'PARSE', 'Table-1', `Parsed ${rows.length} PS→Node rows.`);
  return rows;
}

function parseTable1A(text, log) {
  const map = new Map();
  if (!String(text || '').trim()) { log.user('INFO', 'PARSE', 'Table-1A', 'Optional Node/Dia table is blank. Bore check may use rich Table-1C pipe size.'); return map; }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const diaIdx = idx(headers, ['dia', 'diameter', 'od', 'od mm', 'dia mm', 'dia(mm)']);
  if (nodeIdx < 0 || diaIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1A', 'Node/Dia columns not found. Bore will not use Table-1A.'); return map; }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = cell(cells, nodeIdx);
    const dia = number(cell(cells, diaIdx));
    if (!node || !Number.isFinite(dia)) { log.user('WARNING', 'PARSE', `Table-1A row ${sourceRow}`, 'Invalid Node or Dia skipped.'); continue; }
    map.set(node, { node, dia, sourceRow, source: 'TABLE1A' });
    log.debug('DEBUG', 'T1A_DIA_PARSED', node, { node, dia, sourceRow });
  }
  log.user('INFO', 'PARSE', 'Table-1A', `Parsed ${map.size} Node/Dia rows.`);
  return map;
}

function parseTable1B(text, log) {
  const map = new Map();
  if (!String(text || '').trim()) { log.user('INFO', 'PARSE', 'Table-1B', 'Optional Node/Line No table is blank. Line check may use rich Table-1C Line No.'); return map; }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const lineIdx = idx(headers, ['line no', 'line', 'pipe', 'line number']);
  if (nodeIdx < 0 || lineIdx < 0) { log.user('WARNING', 'PARSE', 'Table-1B', 'Node/Line No columns not found. Line check may use rich Table-1C Line No.'); return map; }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = cell(cells, nodeIdx);
    const lineNo = cell(cells, lineIdx);
    if (!node || !lineNo) continue;
    const row = { node, lineNo, lineKey: normalizeLineKey(lineNo), sourceRow, source: 'TABLE1B' };
    map.set(node, row);
    log.debug('DEBUG', 'T1B_LINE_PARSED', node, row);
  }
  log.user('INFO', 'PARSE', 'Table-1B', `Parsed ${map.size} Node/Line rows.`);
  return map;
}

function parsePipeSize(value) {
  const raw = String(value ?? '').trim();
  const nps = number(raw);
  return { raw, nps: Number.isFinite(nps) ? nps : null, derivedDn: Number.isFinite(nps) ? (NPS_TO_DN.get(nps) ?? null) : null };
}

function parseTable1C(text, log, keywordCatalog) {
  const supportByNode = new Map();
  const richRows = [];
  if (!String(text || '').trim()) {
    log.user('INFO', 'PARSE', 'Table-1C', 'Optional Support Master / ISONOTE table is blank.');
    return { supportByNode, richRows, isRich: false };
  }
  const lines = splitLines(text);
  const headers = splitCells(lines[0]);
  const lineIdx = idx(headers, ['line no', 'line', 'line number', 'pipe', 'branchname']);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const psIdx = idx(headers, ['ps no', 'ps name', 'ps', 'support ps no']);
  const pipeSizeIdx = idx(headers, ['pipe size', 'size', 'nps', 'pipe nps']);
  const isoIdx = idx(headers, ['isonote', 'iso note', 'support', 'support note', 'dtxr']);
  const mandatoryIdx = idx(headers, ['mandatory', 'required', 'is mandatory', 'must audit', 'audit']);
  const isRich = nodeIdx >= 0 && (psIdx >= 0 || lineIdx >= 0 || pipeSizeIdx >= 0 || mandatoryIdx >= 0) && isoIdx >= 0;
  if (nodeIdx < 0 || isoIdx < 0) {
    log.user('WARNING', 'PARSE', 'Table-1C', 'Node/ISONOTE columns not found. Support check disabled.');
    return { supportByNode, richRows, isRich: false };
  }
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const node = cell(cells, nodeIdx);
    const isonote = cell(cells, isoIdx);
    const rawPsNo = cell(cells, psIdx);
    const lineNo = cell(cells, lineIdx);
    const pipeSize = parsePipeSize(cell(cells, pipeSizeIdx));
    const mandatory = truthy(cell(cells, mandatoryIdx));
    if (!node && !rawPsNo && !isonote) continue;
    const supportTypes = normalizeSupportTypes(isonote, keywordCatalog);
    if (node) {
      const existing = supportByNode.get(node);
      const supportRow = { node, isonote, supportTypes, sourceRow, rawPsNo, lineNo, pipeSizeRaw: pipeSize.raw, nps: pipeSize.nps, derivedDnFromNps: pipeSize.derivedDn, mandatory, source: isRich ? 'TABLE1C_RICH' : 'TABLE1C' };
      if (existing) {
        existing.isonote = mergeUniqueText(existing.isonote, isonote);
        existing.supportTypes = uniqueSorted([...(existing.supportTypes || []), ...supportTypes]);
        existing.mandatory = existing.mandatory || mandatory;
        if (!existing.rawPsNo && rawPsNo) existing.rawPsNo = rawPsNo;
        if (!existing.lineNo && lineNo) existing.lineNo = lineNo;
        if (!existing.pipeSizeRaw && pipeSize.raw) existing.pipeSizeRaw = pipeSize.raw;
        if (existing.derivedDnFromNps == null && pipeSize.derivedDn != null) existing.derivedDnFromNps = pipeSize.derivedDn;
      } else {
        supportByNode.set(node, supportRow);
      }
    }
    if (isRich) {
      const norm = normalizePsNo(rawPsNo);
      richRows.push({
        id: `T1C#${String(offset + 1).padStart(3, '0')}`,
        source: 'TABLE1C_RICH',
        sourceRow,
        rawPsNo,
        table1PsNo: rawPsNo,
        node,
        ...norm,
        tag: norm.tag,
        nodeLine: lineNo,
        nodeLineKey: normalizeLineKey(lineNo),
        pipeSizeRaw: pipeSize.raw,
        nps: pipeSize.nps,
        derivedDn: pipeSize.derivedDn,
        nodeIsonote: isonote,
        supportTypesAvailable: supportTypes,
        mandatory,
        used: false,
      });
      if (!rawPsNo && mandatory) log.user('WARNING', 'TABLE1C_RICH', nodeSubject(node), 'Mandatory rich Table-1C row has blank PS No. It will be visible in support coverage but cannot be matched by PS name.', 'Add PS No or verify this is a new support.', { node, tag: '', table1PsNo: '' });
    }
    log.debug('DEBUG', isRich ? 'T1C_RICH_ROW_PARSED' : 'T1C_SUPPORT_PARSED', node || rawPsNo || `row ${sourceRow}`, { node, rawPsNo, lineNo, pipeSize, isonote, supportTypes, mandatory, sourceRow });
    if (supportTypes.length && node) log.user('INFO', 'SUPPORT_PARSE', nodeSubject(node), `Parsed support type(s): ${supportListText(supportTypes)}.`);
  }
  log.user('INFO', 'PARSE', 'Table-1C', `Parsed ${supportByNode.size} support node row(s)${isRich ? ` and ${richRows.length} rich reference row(s)` : ''}.`);
  return { supportByNode, richRows, isRich };
}

function firstFilled(cells, indexes = []) {
  for (const index of indexes) {
    const value = cell(cells, index);
    if (value) return value;
  }
  return '';
}
function indexes(headers, aliases) {
  const set = new Set(aliases.map(hkey));
  const out = [];
  headers.forEach((header, index) => { if (set.has(hkey(header))) out.push(index); });
  return out;
}
function rawColumnMap(headers, cells) {
  const out = {};
  headers.forEach((header, index) => {
    const key = String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    out[key] = cell(cells, index);
  });
  return out;
}
function parseTable2(text, log, keywordCatalog) {
  const lines = splitLines(text);
  if (!lines.length) { log.user('ERROR', 'PARSE', 'Table-2', 'Table-2 is required.'); return []; }
  const headers = splitCells(lines[0]);
  const psIndexes = indexes(headers, ['psno model', 'psno_model', 'ps model', 'ps no', 'ps no.', 'psno', 'ps', 'ps name', 'ps number', 'support ps no']);
  const boreIndexes = indexes(headers, ['bore', 'nb', 'dn', 'size', 'nominal bore', 'model bore']);
  const pipeIndexes = indexes(headers, ['pipe', 'line no', 'line', 'branchname', 'branch name', 'line number']);
  const dtxrIndexes = indexes(headers, ['dtxr', 'dtxr optional', 'dtxr(optional)', 'support', 'support note', 'support description', 'description']);
  const mandatoryIndexes = indexes(headers, ['mandatory', 'required', 'is mandatory', 'must audit', 'audit', '100% audit']);
  if (!psIndexes.length) {
    log.user('ERROR', 'PARSE', 'Table-2', `Required PS column was not found. Headers read: ${headers.join(' | ')}`, 'Use PS NO, PSNO_Model, PS No, or PS Name as the model PS column.');
    log.debug('ERROR', 'T2_HEADER_PARSE_FAILED', 'Table-2', { headers });
    return [];
  }
  log.debug('INFO', 'T2_HEADER_MAP', 'Table-2', {
    headers,
    psIndexes,
    boreIndexes,
    pipeIndexes,
    dtxrIndexes,
    mandatoryIndexes,
  });
  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    const rawPsNo = firstFilled(cells, psIndexes);
    const rawColumns = rawColumnMap(headers, cells);
    if (!rawPsNo) {
      const hasData = cells.some((value) => String(value || '').trim());
      if (hasData) log.user('WARNING', 'PARSE', `Table-2 row ${sourceRow}`, 'Row has data but blank PS NO / PSNO_Model; skipped.', 'Fill PS NO or remove this row.', { psnoModel: '', sourceRow });
      continue;
    }
    const norm = normalizePsNo(rawPsNo);
    const boreRaw = firstFilled(cells, boreIndexes);
    const bore = boreRaw ? number(boreRaw) : NaN;
    const pipe = firstFilled(cells, pipeIndexes);
    const dtxr = firstFilled(cells, dtxrIndexes);
    const mandatoryRaw = firstFilled(cells, mandatoryIndexes);
    const mandatory = truthy(mandatoryRaw);
    const supportTypesRequested = normalizeSupportTypes(dtxr, keywordCatalog);
    const pipeKey = normalizeLineKey(pipe);
    const row = {
      id: `CT2#${String(rows.length + 1).padStart(3, '0')}`,
      source: 'TABLE2',
      sourceRow,
      rawPsNo,
      psnoModel: rawPsNo,
      ...norm,
      modelTag: norm.tag,
      boreRaw,
      bore: Number.isFinite(bore) ? bore : null,
      boreStatus: boreRaw ? (Number.isFinite(bore) ? 'PARSED' : 'INVALID') : 'MISSING',
      pipe,
      pipeKey,
      lineFamily: extractLineFamily(pipeKey),
      dtxr,
      supportTypesRequested,
      supportMatchRequested: supportMatchText(supportTypesRequested),
      mandatory,
      mandatoryRaw,
      rawColumns,
      parseWarnings: [],
    };
    if (boreRaw && !Number.isFinite(bore)) row.parseWarnings.push('BORE_INVALID');
    if (!pipe) row.parseWarnings.push('PIPE_MISSING');
    if (!dtxr) row.parseWarnings.push('DTXR_BLANK');
    rows.push(row);
    log.debug('DEBUG', 'CONSOLIDATED_T2_ROW_BUILT', rawPsNo, row);
    if (row.parseWarnings.length) {
      log.user('WARNING', 'TABLE2_CONSOLIDATE', rawPsNo, `Resolved Table-2 row with warning(s): ${row.parseWarnings.join(', ')}.`, 'Review the Consolidated Table-2 tab for missed/blank source columns.', { psnoModel: rawPsNo });
    }
  }
  log.user('INFO', 'CONSOLIDATE', 'Consolidated Table-2', `Built ${rows.length} consolidated model row(s) from Table-2.`);
  return rows;
}

export function deriveDnFromOd(od) {
  const value = Number(od);
  if (!Number.isFinite(value)) return null;
  let best = null;
  let bestErr = Infinity;
  for (const item of OD_TO_DN) {
    const err = Math.abs(value - item.od);
    if (err < bestErr) { best = item; bestErr = err; }
  }
  if (!best) return null;
  const tolerance = Math.max(1.5, Math.abs(best.od) * 0.006);
  return bestErr <= tolerance ? best.dn : null;
}

function evaluateBore(modelBore, ref, options) {
  const nodeDia = ref.nodeDia;
  const nps = Number(ref.nps);
  const npsDn = Number(ref.derivedDnFromNps ?? ref.derivedDn);
  if (options.boreMode === 'ignore') return { basis: 'BORE_IGNORED', rank: 5, eligible: true, derivedDn: Number.isFinite(nodeDia) ? deriveDnFromOd(nodeDia) : Number.isFinite(npsDn) ? npsDn : null };
  if (!Number.isFinite(modelBore)) return { basis: 'BORE_MISSING', rank: 4, eligible: options.boreMode !== 'strict', derivedDn: Number.isFinite(npsDn) ? npsDn : deriveDnFromOd(nodeDia) };
  if (Number.isFinite(npsDn) && Math.abs(modelBore - npsDn) <= 1e-6) return { basis: 'BORE_DN_FROM_NPS', rank: 0, eligible: true, derivedDn: npsDn };
  if (Number.isFinite(nps) && Math.abs(modelBore - nps) <= 1e-6) return { basis: 'BORE_NPS_RAW', rank: 1, eligible: true, derivedDn: Number.isFinite(npsDn) ? npsDn : null };
  if (!Number.isFinite(nodeDia)) return { basis: 'BORE_MISSING', rank: 4, eligible: options.boreMode !== 'strict', derivedDn: Number.isFinite(npsDn) ? npsDn : null };
  const derivedDn = deriveDnFromOd(nodeDia);
  if (options.allowDnMatch && derivedDn != null && Math.abs(modelBore - derivedDn) <= 1e-6) return { basis: 'BORE_DN_FROM_OD', rank: 0, eligible: true, derivedDn };
  if (options.allowRawDiaMatch && Math.abs(modelBore - nodeDia) <= 1e-6) return { basis: 'BORE_OD', rank: 1, eligible: true, derivedDn };
  if (options.allowRawDiaMatch && Math.abs(modelBore - nodeDia) <= options.odToleranceMm) return { basis: 'BORE_OD_APPROX', rank: 2, eligible: true, derivedDn };
  return { basis: 'BORE_CONFLICT', rank: 9, eligible: options.boreMode !== 'strict', derivedDn: Number.isFinite(npsDn) ? npsDn : derivedDn };
}

function evaluateLine(modelPipe, nodeLine, options) {
  if (options.lineMode === 'ignore') return { basis: 'LINE_IGNORED', rank: 5, eligible: true };
  if (!modelPipe || !nodeLine) return { basis: 'LINE_MISSING', rank: 4, eligible: options.lineMode !== 'strict' };
  const a = normalizeLineKey(modelPipe);
  const b = normalizeLineKey(nodeLine);
  if (a === b) return { basis: 'LINE_EXACT', rank: 0, eligible: true };
  if (a.includes(b) || b.includes(a)) return { basis: 'LINE_SUBSTRING', rank: 1, eligible: true };
  const af = extractLineFamily(a);
  const bf = extractLineFamily(b);
  if (af && bf && af === bf) return { basis: 'LINE_FAMILY', rank: 2, eligible: true };
  return { basis: 'LINE_CONFLICT', rank: 9, eligible: options.lineMode !== 'strict' };
}

function evaluateSupport(modelTypes, nodeTypes, options) {
  if (options.supportMode === 'ignore') return { basis: 'SUPPORT_IGNORED', matchText: '', rank: 5, eligible: true, matchedTypes: [] };
  const requested = modelTypes || [];
  const available = nodeTypes || [];
  if (!requested.length) return { basis: 'SUPPORT_NOT_REQUESTED', matchText: '', rank: 4, eligible: true, matchedTypes: [] };
  if (!available.length) return { basis: 'SUPPORT_MISSING_MASTER', matchText: '', rank: 8, eligible: options.supportMode !== 'strict', matchedTypes: [] };
  const matched = requested.filter((type) => available.includes(type));
  if (matched.length === requested.length) return { basis: 'SUPPORT_EXACT', matchText: supportMatchText(matched), rank: 0, eligible: true, matchedTypes: matched };
  if (matched.length) return { basis: 'SUPPORT_PARTIAL', matchText: supportMatchText(matched), rank: 2, eligible: options.supportMode !== 'strict', matchedTypes: matched };
  return { basis: 'SUPPORT_CONFLICT', matchText: '', rank: 9, eligible: options.supportMode !== 'strict', matchedTypes: [] };
}

function buildConsolidatedTable1Rows({ table1Rows, diaByNode, lineByNode, supportByNode, richRows, log }) {
  const explicitRows = table1Rows.map((row) => ({ ...row }));
  const byBaseNodeLine = new Set();
  const out = [];
  for (const row of explicitRows) {
    const dia = diaByNode.get(row.node);
    const line = lineByNode.get(row.node);
    const support = supportByNode.get(row.node);
    const merged = {
      ...row,
      source: row.source || 'TABLE1',
      nodeDia: dia?.dia ?? null,
      nodeDiaSource: dia ? 'TABLE1A' : '',
      nodeLine: line?.lineNo || support?.lineNo || '',
      nodeLineKey: normalizeLineKey(line?.lineNo || support?.lineNo || ''),
      pipeSizeRaw: support?.pipeSizeRaw || '',
      nps: support?.nps ?? null,
      derivedDn: support?.derivedDnFromNps ?? null,
      derivedDnFromNps: support?.derivedDnFromNps ?? null,
      boreSource: dia ? 'TABLE1A_OD' : support?.derivedDnFromNps != null ? 'TABLE1C_NPS' : '',
      nodeIsonote: support?.isonote || '',
      supportTypesAvailable: support?.supportTypes || [],
      mandatory: support?.mandatory === true,
    };
    out.push(merged);
    byBaseNodeLine.add(`${merged.basePs}|${merged.node}|${merged.nodeLineKey}`);
  }

  for (const rich of richRows || []) {
    if (rich.rawPsNo && rich.node) {
      const key = `${rich.basePs}|${rich.node}|${rich.nodeLineKey}`;
      if (byBaseNodeLine.has(key)) {
        const existing = out.find((row) => `${row.basePs}|${row.node}|${row.nodeLineKey}` === key);
        if (existing) {
          existing.source = existing.source.includes('TABLE1C_RICH') ? existing.source : `${existing.source}+TABLE1C_RICH`;
          existing.nodeIsonote = existing.nodeIsonote || rich.nodeIsonote;
          existing.supportTypesAvailable = existing.supportTypesAvailable?.length ? existing.supportTypesAvailable : rich.supportTypesAvailable;
          existing.pipeSizeRaw = existing.pipeSizeRaw || rich.pipeSizeRaw;
          existing.nps = existing.nps ?? rich.nps;
          existing.derivedDn = existing.derivedDn ?? rich.derivedDn;
          existing.derivedDnFromNps = existing.derivedDnFromNps ?? rich.derivedDn;
          existing.mandatory = existing.mandatory || rich.mandatory;
        }
        continue;
      }
      out.push({ ...rich, source: 'TABLE1C_RICH', nodeDia: null, nodeDiaSource: '', boreSource: rich.derivedDn != null ? 'TABLE1C_NPS' : '', derivedDnFromNps: rich.derivedDn });
      byBaseNodeLine.add(key);
    } else if (rich.node) {
      out.push({
        ...rich,
        id: rich.id || `T1C_AUDIT#${out.length + 1}`,
        source: 'TABLE1C_RICH_AUDIT',
        basePs: '',
        exactRawKey: '',
        nodeDia: null,
        nodeDiaSource: '',
        boreSource: rich.derivedDn != null ? 'TABLE1C_NPS' : '',
        derivedDnFromNps: rich.derivedDn,
      });
    }
  }

  for (const row of out) {
    row.lineFamily = extractLineFamily(row.nodeLineKey || row.nodeLine);
    row.derivedDn = row.derivedDn ?? row.derivedDnFromNps ?? (Number.isFinite(row.nodeDia) ? deriveDnFromOd(row.nodeDia) : null);
    log.debug('DEBUG', 'CONSOLIDATED_T1_ROW', row.table1PsNo || row.node || row.id, row);
  }
  log.user('INFO', 'CONSOLIDATE', 'Consolidated Table-1', `Built ${out.length} consolidated Table-1 reference row(s).`);
  return out;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function candidateScore(model, ref, options) {
  const psBasis = ref.exactRawKey === model.exactRawKey ? 'PS_EXACT' : ref.basePs === model.basePs ? 'PS_BASE' : 'PS_NONE';
  const bore = evaluateBore(Number(model.bore), ref, options);
  const line = evaluateLine(model.pipe, ref.nodeLine, options);
  const support = evaluateSupport(model.supportTypesRequested, ref.supportTypesAvailable, options);
  const warnings = [];
  if (!bore.eligible) warnings.push('BORE_REJECT');
  if (!line.eligible) warnings.push('LINE_REJECT');
  if (!support.eligible) warnings.push('SUPPORT_REJECT');
  const eligible = psBasis !== 'PS_NONE' && bore.eligible && line.eligible && support.eligible;
  return {
    eligible,
    psBasis,
    bore,
    line,
    support,
    warnings,
    numeric: (psBasis === 'PS_EXACT' ? 0 : 1) * 1000 + bore.rank * 100 + support.rank * 10 + line.rank + warnings.length * 10000,
  };
}

function buildCandidate(model, ref, options) {
  const score = candidateScore(model, ref, options);
  return {
    psnoModel: model.psnoModel,
    basePs: model.basePs,
    modelTag: model.modelTag,
    modelBore: model.bore,
    pipe: model.pipe,
    pipeKey: model.pipeKey,
    lineFamily: model.lineFamily,
    dtxr: model.dtxr,
    mandatory: model.mandatory,
    supportTypesRequested: supportListText(model.supportTypesRequested),
    modelDtxrKeywords: supportListText(model.supportTypesRequested),
    table2Row: model.sourceRow,
    candidateNode: ref.node,
    node: ref.node,
    table1PsNo: ref.table1PsNo || ref.rawPsNo || '',
    tag: ref.tag || '',
    source: ref.source || '',
    sourceRow: ref.sourceRow || '',
    nodeLine: ref.nodeLine || '',
    nodeLineKey: ref.nodeLineKey || normalizeLineKey(ref.nodeLine),
    pipeSizeRaw: ref.pipeSizeRaw || '',
    nps: ref.nps ?? '',
    derivedDn: score.bore.derivedDn ?? ref.derivedDn ?? '',
    nodeDia: ref.nodeDia ?? '',
    nodeIsonote: ref.nodeIsonote || '',
    nodeIsonoteRaw: ref.nodeIsonote || '',
    nodeMasterKeywords: supportListText(ref.supportTypesAvailable),
    supportTypesAvailable: supportListText(ref.supportTypesAvailable),
    refMandatory: ref.mandatory === true,
    psBasis: score.psBasis,
    boreBasis: score.bore.basis,
    lineBasis: score.line.basis,
    supportBasis: score.support.basis,
    supportMatch: score.support.matchText,
    matchedTypes: supportListText(score.support.matchedTypes),
    eligible: score.eligible,
    warnings: score.warnings.join('; '),
    score: score.numeric,
    selected: false,
    reason: score.eligible ? 'Candidate eligible.' : `Rejected: ${score.warnings.join(', ')}`,
  };
}

function resolveGroup(models, refs, options, log) {
  const outputRows = [];
  const candidateRows = [];
  const usedNodeSupport = new Set();
  for (const model of models) {
    const candidates = refs.map((ref) => buildCandidate(model, ref, options));
    candidates.sort((a, b) => a.score - b.score || natural(a.candidateNode, b.candidateNode) || natural(a.table1PsNo, b.table1PsNo));
    let selected = candidates.find((c) => c.eligible && (options.allowDuplicateAssignment || !usedNodeSupport.has(`${c.node}|${c.supportMatch}`)));
    if (!selected) selected = candidates.find((c) => c.eligible) || null;
    if (selected) {
      selected.selected = true;
      selected.reason = 'Selected best eligible consolidated Table-1 candidate.';
      usedNodeSupport.add(`${selected.node}|${selected.supportMatch}`);
      outputRows.push({
        enabled: true,
        psnoModel: model.psnoModel,
        node: selected.node,
        tag: selected.tag,
        table1PsNo: selected.table1PsNo,
        source: selected.source,
        sourceRow: selected.sourceRow,
        nodeLine: selected.nodeLine,
        pipeSizeRaw: selected.pipeSizeRaw,
        derivedDn: selected.derivedDn,
        modelBore: model.bore,
        pipe: model.pipe,
        dtxr: model.dtxr,
        mandatory: model.mandatory,
        supportMatch: selected.supportMatch,
        basis: [selected.psBasis, selected.boreBasis, selected.lineBasis, selected.supportBasis].join(' + '),
        confidence: selected.eligible ? 'HIGH' : 'LOW',
        warnings: selected.warnings,
        nodeIsonote: selected.nodeIsonote,
        nodeMasterKeywords: selected.nodeMasterKeywords,
        modelDtxrKeywords: selected.modelDtxrKeywords,
        missingSupportKeywords: '',
        extraSupportKeywords: '',
        nodeCoverageStatus: '',
        nodeCoverageNote: '',
        table2Row: model.sourceRow,
      });
      log.user('INFO', 'RESOLVE', model.psnoModel, `Mapped to Node ${selected.node}${nodeTagLabel(selected)} using ${selected.psBasis} + ${selected.boreBasis} + ${selected.lineBasis} + ${selected.supportBasis}.`, '', { ...table1Context(selected), psnoModel: model.psnoModel });
    } else {
      outputRows.push(makeNoMatch(model, 'NO_ELIGIBLE_CANDIDATE'));
      log.user('WARNING', 'RESOLVE', model.psnoModel, 'No eligible consolidated Table-1 candidate found.', 'Review Candidate Matrix for rejected bore/line/support basis.', { psnoModel: model.psnoModel });
    }
    candidateRows.push(...candidates);
  }
  return { outputRows, candidateRows };
}

function makeNoMatch(model, warning) {
  return {
    enabled: false,
    psnoModel: model.psnoModel,
    node: '',
    tag: '',
    table1PsNo: '',
    source: '',
    sourceRow: '',
    nodeLine: '',
    pipeSizeRaw: '',
    derivedDn: '',
    modelBore: model.bore,
    pipe: model.pipe,
    dtxr: model.dtxr,
    mandatory: model.mandatory,
    supportMatch: '',
    basis: 'NO_MATCH',
    confidence: 'NONE',
    warnings: warning,
    nodeIsonote: '',
    nodeMasterKeywords: '',
    modelDtxrKeywords: supportListText(model.supportTypesRequested),
    missingSupportKeywords: '',
    extraSupportKeywords: '',
    nodeCoverageStatus: '',
    nodeCoverageNote: '',
    table2Row: model.sourceRow,
  };
}

function buildSupportCoverageRows({ table1Rows, resultRows, log }) {
  const selectedByNode = new Map();
  for (const row of resultRows || []) {
    if (!row.node) continue;
    const entry = selectedByNode.get(row.node) || { psnoModels: [], coveredTypes: [], dtxr: [] };
    entry.psnoModels.push(row.psnoModel);
    entry.coveredTypes.push(...normalizeSupportTypes(row.dtxr || ''));
    if (row.dtxr) entry.dtxr.push(row.dtxr);
    selectedByNode.set(row.node, entry);
  }
  const byNode = groupBy(table1Rows || [], (r) => r.node || `__ROW_${r.id}`);
  const rows = [];
  for (const [node, refs] of byNode.entries()) {
    const masterTypes = uniqueSorted(refs.flatMap((r) => r.supportTypesAvailable || []));
    const mapped = selectedByNode.get(node) || { psnoModels: [], coveredTypes: [], dtxr: [] };
    const covered = uniqueSorted(mapped.coveredTypes);
    const missing = masterTypes.filter((type) => !covered.includes(type));
    const extra = covered.filter((type) => !masterTypes.includes(type));
    let status = 'NO_MASTER_SUPPORT';
    if (masterTypes.length && !mapped.psnoModels.length) status = 'UNMAPPED_NODE';
    else if (masterTypes.length && !missing.length && !extra.length) status = 'COVERED';
    else if (masterTypes.length && missing.length && covered.length) status = 'PARTIAL';
    else if (masterTypes.length && missing.length && !covered.length) status = 'MISSING_ALL';
    else if (extra.length) status = 'COVERED_WITH_EXTRA';
    const tags = uniqueSorted(refs.map((r) => r.tag).filter(Boolean));
    const table1PsNos = uniqueSorted(refs.map((r) => r.table1PsNo || r.rawPsNo).filter(Boolean));
    const row = {
      node: node.startsWith('__ROW_') ? '' : node,
      table1PsNo: table1PsNos.join(', '),
      tag: tags.join(', '),
      source: uniqueSorted(refs.map((r) => r.source)).join(', '),
      sourceRow: uniqueSorted(refs.map((r) => r.sourceRow).filter(Boolean)).join(', '),
      lineNo: uniqueSorted(refs.map((r) => r.nodeLine).filter(Boolean)).join(', '),
      pipeSizeRaw: uniqueSorted(refs.map((r) => r.pipeSizeRaw).filter(Boolean)).join(', '),
      derivedDn: uniqueSorted(refs.map((r) => r.derivedDn).filter((v) => v != null)).join(', '),
      isonote: mergeUniqueText('', refs.map((r) => r.nodeIsonote).filter(Boolean).join(' | ')),
      mandatory: refs.some((r) => r.mandatory) ? 'YES' : '',
      masterKeywords: supportListText(masterTypes),
      mappedPsnoModel: uniqueSorted(mapped.psnoModels).join(', '),
      coveredDtxrKeywords: supportListText(covered),
      missingMasterKeywords: supportListText(missing),
      extraDtxrKeywords: supportListText(extra),
      coverageStatus: status,
      action: missing.length ? `${nodeSubject(node, tags.join(', '))} missing ${supportListText(missing)} in mapped DTXR.` : extra.length ? `${nodeSubject(node, tags.join(', '))} has extra mapped DTXR ${supportListText(extra)}.` : '',
    };
    rows.push(row);
    if (missing.length) log.user('WARNING', 'SUPPORT_COVERAGE', nodeSubject(node, row.tag), `Missing mapped DTXR keyword(s): ${supportListText(missing)}.`, 'Review Table-2 DTXR or Table-1C ISONOTE.', { node, tag: row.tag, table1PsNo: row.table1PsNo });
  }
  return rows.sort((a, b) => natural(a.node, b.node));
}

function annotateCandidateCoverage(candidateRows, resultRows) {
  const byKey = new Map();
  for (const row of resultRows || []) byKey.set(`${row.psnoModel}|${row.node}|${row.table1PsNo}`, row);
  for (const candidate of candidateRows || []) {
    const selected = byKey.get(`${candidate.psnoModel}|${candidate.node}|${candidate.table1PsNo}`);
    if (selected) {
      candidate.nodeCoverageNote = selected.nodeCoverageNote || '';
      candidate.nodeCoverageStatus = selected.nodeCoverageStatus || '';
    }
  }
}

function buildSummary(rows, table1Rows, modelRows, candidates, userLog, supportCoverageRows) {
  return {
    table1Rows: table1Rows.length,
    table2Rows: modelRows.length,
    mapped: rows.filter((r) => r.enabled).length,
    noMatch: rows.filter((r) => !r.enabled).length,
    candidateRows: candidates.length,
    supportCoverageIssues: supportCoverageRows.filter((r) => !['COVERED', 'NO_MASTER_SUPPORT'].includes(r.coverageStatus)).length,
    warnings: userLog.filter((l) => l.level === 'WARNING' || l.level === 'ERROR').length,
  };
}

export function runPsMappingResolver(input = {}) {
  const log = createLogger();
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  options.odToleranceMm = Number(options.odToleranceMm ?? 1.5);
  const keywordCatalog = parseTable1DKeywords(input.table1dKeywordText || input.table1DText || DEFAULT_MASTER_KEYWORDS, log);
  const table1SourceRows = parseTable1(input.table1PsNodeText, log);
  const diaByNode = parseTable1A(input.table1aNodeDiaText, log);
  const lineByNode = parseTable1B(input.table1bNodeLineText, log);
  const table1C = parseTable1C(input.table1cNodeIsonoteText, log, keywordCatalog);
  const modelRows = parseTable2(input.table2ModelText, log, keywordCatalog);
  const table1Rows = buildConsolidatedTable1Rows({ table1Rows: table1SourceRows, diaByNode, lineByNode, supportByNode: table1C.supportByNode, richRows: table1C.richRows, log });
  const refsByBase = groupBy(table1Rows.filter((r) => r.basePs), (r) => r.basePs);
  const modelsByBase = groupBy(modelRows, (r) => r.basePs);
  const rows = [];
  const candidates = [];
  for (const [basePs, models] of modelsByBase.entries()) {
    const refs = refsByBase.get(basePs) || [];
    if (!refs.length) {
      for (const model of models) {
        rows.push(makeNoMatch(model, 'NO_BASE_PS_MATCH'));
        log.user('WARNING', 'RESOLVE', model.psnoModel, `No consolidated Table-1 row found for base PS ${basePs}.`, 'Check Table-1 or rich Table-1C PS No / Node source.', { psnoModel: model.psnoModel });
      }
      continue;
    }
    const resolved = resolveGroup(models, refs, options, log);
    rows.push(...resolved.outputRows);
    candidates.push(...resolved.candidateRows);
  }
  rows.sort((a, b) => a.table2Row - b.table2Row);
  const supportCoverageRows = buildSupportCoverageRows({ table1Rows, resultRows: rows, log });
  annotateCandidateCoverage(candidates, rows);
  return {
    rows,
    candidates,
    supportCoverageRows,
    userLog: log.userLog,
    debugLog: log.debugLog,
    summary: buildSummary(rows, table1Rows, modelRows, candidates, log.userLog, supportCoverageRows),
    options,
    consolidatedTable1Rows: table1Rows,
    consolidatedTable2Rows: modelRows,
  };
}

export function rowsToCsv(rows) {
  const headers = ['PSNO_Model', 'Node', 'Table-1 PS No', 'Tag', 'Source', 'Line No', 'Pipe Size', 'Derived DN', 'Table-2 Bore', 'Table-2 Pipe', 'Table-2 DTXR', 'Table-2 Mandatory', 'Support match', 'Node Coverage Note', 'Basis'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => [r.psnoModel, r.node, r.table1PsNo, r.tag, r.source, r.nodeLine, r.pipeSizeRaw, r.derivedDn, r.modelBore, r.pipe, r.dtxr, r.mandatory ? 'YES' : '', r.supportMatch, r.nodeCoverageNote, r.basis].map(esc).join(','))].join('\n');
}
