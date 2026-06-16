import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-support-ui-v2.js?v=20260611-psmap-robust-gap-ui-1';

const STYLE_ID = 'psmap-preflight-style';

const HEADER_ALIASES = {
  table1c: {
    lineNo: ['line no', 'lineno', 'line', 'pipe', 'branchname', 'branch name'],
    node: ['node', 'node no', 'node number', 'candidate node'],
    psNo: ['ps no', 'psno', 'ps name', 'ps', 'support no'],
    pipeSize: ['pipe size', 'nps', 'size', 'nb'],
    isonote: ['isonote', 'iso note', 'note', 'description'],
    mandatory: ['mandatory', 'required'],
  },
  table2: {
    psNo: ['ps no', 'psno', 'ps name', 'psno_model', 'psno model'],
    bore: ['bore', 'model bore', 'nb', 'dn'],
    pipe: ['pipe', 'line no', 'line', 'branchname', 'branch name'],
    dtxr: ['dtxr', 'support', 'support description', 'description'],
    supportGap: ['support gap', 'guide gap', 'gap'],
    mandatory: ['mandatory', 'required'],
  },
};

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePsBase(value) {
  let text = String(value ?? '').trim().toUpperCase();
  if (!text) return '';
  text = text.replace(/^['"]+|['"]+$/g, '');
  text = text.replace(/^FDN[-_\s]*/i, '');
  text = text.split('|')[0].trim();
  text = text.replace(/\/DATUM\b/i, '').replace(/\/SREF\b/i, '');
  text = text.replace(/\.[0-9]+\b.*$/, '');
  const match = text.match(/[A-Z]+-?PS-?\d+|PS-?\d+|SL-?\d+|[A-Z]{2,}-?\d+/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : text;
}

function splitRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLine(line) {
  if (String(line).includes('\t')) return String(line).split('\t').map((c) => c.trim());
  if (String(line).includes('|')) return String(line).split('|').map((c) => c.trim());
  return String(line).split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

function looksLikeDataRow(cells) {
  const first = String(cells?.[0] || '').trim();
  const second = String(cells?.[1] || '').trim();
  return /^(?:FDN[-_\s]*)?(?:[A-Z]+-)?PS[-_]?\d+|^SL[-_]?\d+/i.test(first)
    || (/^[-+]?\d+(?:\.\d+)?$/.test(second) && /ASIM|\d+\"|[A-Z]\d{5,}/i.test(cells.join(' ')));
}

function parseTable(text) {
  const lines = splitRows(text);
  if (!lines.length) return { lines, header: [], rows: [], hasHeader: false, delimiterIssue: false };
  const first = splitLine(lines[0]);
  const delimiterIssue = lines.length > 1 && first.length <= 1;
  const normalized = first.map(normalizeHeader);
  const hasHeader = !looksLikeDataRow(first) && normalized.some((h0) => ['ps no', 'psno', 'node', 'line no', 'bore', 'pipe', 'dtxr', 'isonote'].includes(h0));
  const header = hasHeader ? normalized : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines.map(splitLine).filter((cells) => cells.some(Boolean));
  return { lines, header, headerRaw: hasHeader ? first : [], rows, hasHeader, delimiterIssue };
}

function hasHeader(table, aliases) {
  return aliases.some((alias) => table.header.includes(normalizeHeader(alias)));
}

function headerIndex(table, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return table.header.findIndex((header) => normalizedAliases.includes(header));
}

function columnValues(table, aliases) {
  const index = headerIndex(table, aliases);
  if (index < 0) return [];
  return table.rows.map((row) => row[index] || '').filter(Boolean);
}

function headerSet(table) {
  return new Set(table.header || []);
}

function isTable2Style(table) {
  const headers = headerSet(table);
  const hasPs = headers.has('ps no') || headers.has('psno') || headers.has('ps name');
  return hasPs && headers.has('bore') && headers.has('pipe') && headers.has('dtxr');
}

function isTable1cRichStyle(table) {
  return hasHeader(table, HEADER_ALIASES.table1c.lineNo)
    && hasHeader(table, HEADER_ALIASES.table1c.node)
    && hasHeader(table, HEADER_ALIASES.table1c.psNo)
    && (hasHeader(table, HEADER_ALIASES.table1c.pipeSize) || hasHeader(table, HEADER_ALIASES.table1c.isonote));
}

function uniqueBases(values) {
  return new Set(values.map(normalizePsBase).filter(Boolean));
}

function missingCount(values) {
  return values.reduce((count, value) => count + (String(value || '').trim() ? 0 : 1), 0);
}

function inferTable2BasesFromHeaderless(table) {
  return uniqueBases(table.rows.map((row) => row[0] || ''));
}

function intersectionCount(a, b) {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function issue(severity, code, title, detail, action) {
  return { severity, code, title, detail, action };
}

function auditSourceTables({ table1CText, table2Text }) {
  const issues = [];
  const t1c = parseTable(table1CText);
  const t2 = parseTable(table2Text);

  if (!t1c.lines.length) {
    issues.push(issue('blocker', 'TABLE1C_EMPTY', 'Table-1C is empty', 'No Table-1C / support master rows were pasted.', 'Paste Table-1C with Line No, Node, PS No, Pipe size, ISONOTE, Mandatory.'));
  }
  if (!t2.lines.length) {
    issues.push(issue('blocker', 'TABLE2_EMPTY', 'Table-2 is empty', 'No model PS rows were pasted.', 'Paste Table-2 with PS NO, Bore, pipe, DTXR, Support Gap, Mandatory.'));
  }
  if (t1c.delimiterIssue) {
    issues.push(issue('warning', 'TABLE1C_DELIMITER_SUSPECT', 'Table-1C delimiter looks wrong', 'The first row was parsed as one column. Tabs are preferred.', 'Paste directly from Excel/CSV as tab-separated columns.'));
  }
  if (t2.delimiterIssue) {
    issues.push(issue('warning', 'TABLE2_DELIMITER_SUSPECT', 'Table-2 delimiter looks wrong', 'The first row was parsed as one column. Tabs are preferred.', 'Paste directly from Excel/CSV as tab-separated columns.'));
  }

  if (t1c.lines.length && isTable2Style(t1c) && !hasHeader(t1c, HEADER_ALIASES.table1c.node)) {
    issues.push(issue('blocker', 'TABLE1C_LOOKS_LIKE_TABLE2', 'Table-1C looks like Table-2 data', 'Headers are PS NO / Bore / pipe / DTXR, but Table-1C needs Node and ISONOTE reference data.', 'Move these rows to Table-2, or paste Table-1C as Line No | Node | PS No | Pipe size | ISONOTE | Mandatory.'));
  }

  if (t2.lines.length && !t2.hasHeader) {
    const inferred = looksLikeDataRow(t2.rows[0] || []);
    issues.push(issue(inferred ? 'blocker' : 'warning', 'TABLE2_HEADER_MISSING', 'Table-2 header row is missing', 'The first Table-2 row appears to be data, so columns cannot be reliably assigned.', 'Add header: PS NO | Bore | pipe | DTXR | Support Gap | Mandatory.'));
  }

  if (t1c.lines.length && t1c.hasHeader && !isTable1cRichStyle(t1c)) {
    const missing = [];
    if (!hasHeader(t1c, HEADER_ALIASES.table1c.node)) missing.push('Node');
    if (!hasHeader(t1c, HEADER_ALIASES.table1c.psNo)) missing.push('PS No');
    if (!hasHeader(t1c, HEADER_ALIASES.table1c.lineNo)) missing.push('Line No');
    if (!hasHeader(t1c, HEADER_ALIASES.table1c.isonote)) missing.push('ISONOTE');
    if (missing.length) {
      issues.push(issue('blocker', 'TABLE1C_REQUIRED_COLUMNS_MISSING', 'Table-1C required columns missing', `Missing: ${missing.join(', ')}.`, 'Use Line No | Node | PS No | Pipe size | ISONOTE | Mandatory.'));
    }
  }

  if (t2.lines.length && t2.hasHeader) {
    const missing = [];
    if (!hasHeader(t2, HEADER_ALIASES.table2.psNo)) missing.push('PS NO');
    if (!hasHeader(t2, HEADER_ALIASES.table2.bore)) missing.push('Bore');
    if (!hasHeader(t2, HEADER_ALIASES.table2.pipe)) missing.push('pipe');
    if (!hasHeader(t2, HEADER_ALIASES.table2.dtxr)) missing.push('DTXR');
    if (missing.length) {
      issues.push(issue('blocker', 'TABLE2_REQUIRED_COLUMNS_MISSING', 'Table-2 required columns missing', `Missing: ${missing.join(', ')}.`, 'Use PS NO | Bore | pipe | DTXR | Support Gap | Mandatory.'));
    }
  }

  if (isTable1cRichStyle(t1c)) {
    const nodeValues = columnValues(t1c, HEADER_ALIASES.table1c.node);
    const blankNodes = missingCount(nodeValues) + Math.max(0, t1c.rows.length - nodeValues.length);
    if (blankNodes > 0) {
      issues.push(issue('blocker', 'TABLE1C_NODE_MISSING', 'Table-1C has blank Node values', `${blankNodes} Table-1C row(s) have no Node, so no candidate node can be assigned.`, 'Fill Node for each Table-1C reference row.'));
    }
    if (!hasHeader(t1c, HEADER_ALIASES.table1c.pipeSize)) {
      issues.push(issue('warning', 'TABLE1C_PIPE_SIZE_MISSING', 'Table-1C Pipe size column missing', 'Bore comparison may fall back to Table-1A Dia or become missing.', 'Add Pipe size or ensure Table-1A has Node/Dia for the same nodes.'));
    }
  }

  if (t1c.hasHeader && t2.hasHeader && isTable1cRichStyle(t1c)) {
    const t1Bases = uniqueBases(columnValues(t1c, HEADER_ALIASES.table1c.psNo));
    const t2Bases = uniqueBases(columnValues(t2, HEADER_ALIASES.table2.psNo));
    if (t1Bases.size && t2Bases.size && intersectionCount(t1Bases, t2Bases) === 0) {
      const t1Preview = Array.from(t1Bases).slice(0, 4).join(', ');
      const t2Preview = Array.from(t2Bases).slice(0, 4).join(', ');
      issues.push(issue('blocker', 'NO_COMMON_BASE_PS', 'No common base PS between Table-1C and Table-2', `Table-1C bases: ${t1Preview || '-'}; Table-2 bases: ${t2Preview || '-'}.`, 'Paste matching PS ranges, or check whether one dataset was pasted into the wrong table.'));
    }
  } else if (t1c.hasHeader && !t2.hasHeader && isTable1cRichStyle(t1c) && t2.rows.length) {
    const t1Bases = uniqueBases(columnValues(t1c, HEADER_ALIASES.table1c.psNo));
    const t2Bases = inferTable2BasesFromHeaderless(t2);
    if (t1Bases.size && t2Bases.size && intersectionCount(t1Bases, t2Bases) === 0) {
      issues.push(issue('warning', 'NO_COMMON_BASE_PS_HEADERLESS_T2', 'No common base PS detected', 'Table-2 has no header, but inferred PS bases do not overlap Table-1C.', 'Add the Table-2 header and confirm the pasted PS range.'));
    }
  }

  return issues;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-preflight{border:1px solid rgba(251,191,36,.38);background:rgba(120,53,15,.22);border-radius:12px;padding:10px 12px;color:#fde68a;font-size:12px;line-height:1.45;display:grid;gap:8px}
.psmap-preflight.ok{border-color:rgba(34,197,94,.28);background:rgba(20,83,45,.14);color:#bbf7d0}.psmap-preflight-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800}.psmap-preflight-badges{display:flex;gap:6px;flex-wrap:wrap}.psmap-preflight-badge{border:1px solid currentColor;border-radius:999px;padding:2px 7px;font-size:11px;opacity:.9}.psmap-preflight-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}.psmap-preflight-item{background:rgba(15,23,42,.36);border-radius:8px;padding:7px 8px}.psmap-preflight-item b{color:#fff}.psmap-preflight-action{color:#dbeafe}.psmap-preflight-code{opacity:.72;font-family:ui-monospace,Consolas,monospace;font-size:11px}`;
  document.head.appendChild(style);
}

function sourceValues() {
  return {
    table1CText: document.querySelector('[data-psmap-source="table1CText"]')?.value || '',
    table2Text: document.querySelector('[data-psmap-source="table2Text"]')?.value || '',
  };
}

function severityCounts(issues) {
  return {
    blockers: issues.filter((item) => item.severity === 'blocker').length,
    warnings: issues.filter((item) => item.severity === 'warning').length,
  };
}

function renderNotification(host, issues) {
  const counts = severityCounts(issues);
  if (!issues.length) {
    host.innerHTML = `<div class="psmap-preflight ok"><div class="psmap-preflight-title"><span>Preflight check: table structure looks usable.</span><span class="psmap-preflight-badge">No hard blockers</span></div></div>`;
    return;
  }
  const title = counts.blockers
    ? `Preflight found ${counts.blockers} hard blocker${counts.blockers === 1 ? '' : 's'} before mapping.`
    : `Preflight found ${counts.warnings} warning${counts.warnings === 1 ? '' : 's'}.`;
  const topIssues = issues.slice(0, 6);
  host.innerHTML = `<div class="psmap-preflight">
    <div class="psmap-preflight-title"><span>${h(title)}</span><span class="psmap-preflight-badges"><span class="psmap-preflight-badge">${counts.blockers} blockers</span><span class="psmap-preflight-badge">${counts.warnings} warnings</span></span></div>
    <ul class="psmap-preflight-list">${topIssues.map((item) => `<li class="psmap-preflight-item"><b>${h(item.title)}</b><div>${h(item.detail)}</div><div class="psmap-preflight-action">Fix: ${h(item.action)}</div><div class="psmap-preflight-code">${h(item.code)}</div></li>`).join('')}</ul>
    ${issues.length > topIssues.length ? `<div class="psmap-preflight-code">+${issues.length - topIssues.length} more diagnostics hidden.</div>` : ''}
  </div>`;
}

function ensureHost() {
  const panel = document.querySelector('[data-psmap-panel="source"]');
  if (!panel) return null;
  let host = panel.querySelector('[data-psmap-preflight-host]');
  if (host) return host;
  host = document.createElement('div');
  host.setAttribute('data-psmap-preflight-host', '1');
  const cardBody = panel.querySelector('.psmap-card-body');
  const firstBanner = cardBody?.querySelector('.psmap-banner');
  if (firstBanner?.nextSibling) firstBanner.parentNode.insertBefore(host, firstBanner.nextSibling);
  else cardBody?.prepend(host);
  return host;
}

function runPreflight() {
  installStyle();
  const host = ensureHost();
  if (!host) return [];
  const issues = auditSourceTables(sourceValues());
  renderNotification(host, issues);
  return issues;
}

function schedule(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

function installPreflightNotification() {
  const run = schedule(runPreflight);
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', run, true);
  document.addEventListener('change', run, true);
  document.addEventListener('click', run, true);
  run();
  return () => {
    observer.disconnect();
    document.removeEventListener('input', run, true);
    document.removeEventListener('change', run, true);
    document.removeEventListener('click', run, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyPreflight = installPreflightNotification();
  return () => {
    try { destroyPreflight?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
