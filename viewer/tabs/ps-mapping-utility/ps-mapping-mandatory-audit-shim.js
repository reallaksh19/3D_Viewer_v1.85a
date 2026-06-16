// Lightweight DOM shim for PS Mapping mandatory audit scope.
// Purpose: Mandatory=YES in Table-1C/Table-2 forces audit visibility without changing candidate ranking.
const PS_MAP_AUDIT_SHIM_KEY = '__psMapMandatoryAuditShimV1';

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
function hkey(value) {
  return String(value ?? '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function idx(headers, aliases) {
  const set = new Set(aliases.map(hkey));
  return headers.findIndex((header) => set.has(hkey(header)));
}
function yes(value) {
  return /^(Y|YES|TRUE|1|MANDATORY|REQUIRED|REQ|MUST|AUDIT|100%)$/i.test(String(value ?? '').trim());
}
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function normalizeTable1Ps(rawValue) {
  const raw = String(rawValue ?? '').trim();
  const [beforeTag, ...tagParts] = raw.split('|');
  const tag = tagParts.length ? tagParts.join('|').trim() : '';
  return { raw, tag };
}
function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}
function parseT1(text) {
  const byNode = new Map();
  const lines = splitLines(text);
  if (!lines.length) return byNode;
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['ps no', 'ps name', 'ps']);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  if (psIdx < 0 || nodeIdx < 0) return byNode;
  for (const line of lines.slice(1)) {
    const cells = splitCells(line);
    const node = String(cells[nodeIdx] ?? '').trim();
    const psNo = String(cells[psIdx] ?? '').trim();
    if (!node || !psNo) continue;
    const norm = normalizeTable1Ps(psNo);
    if (!byNode.has(node)) byNode.set(node, { table1PsNos: [], tags: [] });
    const item = byNode.get(node);
    item.table1PsNos.push(norm.raw);
    if (norm.tag) item.tags.push(norm.tag);
  }
  for (const [node, item] of byNode.entries()) {
    byNode.set(node, {
      table1PsNo: unique(item.table1PsNos).join(', '),
      tag: unique(item.tags).join(', '),
    });
  }
  return byNode;
}
function supportTypes(value) {
  const text = String(value || '').replace(/\[[^\]]*GAP[^\]]*\]/gi, ' ').toUpperCase();
  const out = new Set();
  if (/\bPIPE\s+REST\b|\bREST\b|\bXRT\b/.test(text)) out.add('REST');
  if (/\bGUIDE\b/.test(text)) out.add('GUIDE');
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bPIPE\s+STOP\b|\bSTOP\b/.test(text)) out.add('LINE_STOP');
  return [...out];
}
function supportText(types) {
  return (types || []).map((type) => type === 'LINE_STOP' ? 'STOP' : String(type || '').replace(/_/g, ' ')).join(', ');
}
function parseT2(text) {
  const rows = new Map();
  const lines = splitLines(text);
  if (!lines.length) return rows;
  const headers = splitCells(lines[0]);
  const psIdx = idx(headers, ['psno model', 'psno_model', 'ps model', 'ps no', 'ps']);
  const dtxrIdx = idx(headers, ['dtxr', 'dtxr optional', 'dtxr(optional)', 'support', 'support note']);
  const mandatoryIdx = idx(headers, ['mandatory', 'required', 'audit', 'audit required', '100 audit', '100% audit']);
  if (psIdx < 0 || mandatoryIdx < 0) return rows;
  for (const line of lines.slice(1)) {
    const cells = splitCells(line);
    const psno = String(cells[psIdx] ?? '').trim();
    if (!psno) continue;
    const dtxr = dtxrIdx >= 0 ? String(cells[dtxrIdx] ?? '').trim() : '';
    rows.set(psno, { psno, mandatory: yes(cells[mandatoryIdx]), dtxr, supportTypes: supportTypes(dtxr) });
  }
  return rows;
}
function parseT1C(text) {
  const rows = new Map();
  const lines = splitLines(text);
  if (!lines.length) return rows;
  const headers = splitCells(lines[0]);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number']);
  const isoIdx = idx(headers, ['isonote', 'iso note', 'support', 'support note', 'dtxr']);
  const mandatoryIdx = idx(headers, ['mandatory', 'required', 'audit', 'audit required', '100 audit', '100% audit']);
  if (nodeIdx < 0 || mandatoryIdx < 0) return rows;
  for (const line of lines.slice(1)) {
    const cells = splitCells(line);
    const node = String(cells[nodeIdx] ?? '').trim();
    if (!node) continue;
    const isonote = isoIdx >= 0 ? String(cells[isoIdx] ?? '').trim() : '';
    rows.set(node, { node, mandatory: yes(cells[mandatoryIdx]), isonote, supportTypes: supportTypes(isonote) });
  }
  return rows;
}
function readSources(root) {
  const source = {};
  root.querySelectorAll('[data-psmap-source]').forEach((el) => { source[el.dataset.psmapSource] = el.value; });
  return source;
}
function cell(row, index) {
  return row?.children?.[index] || null;
}
function headerIndexes(table) {
  const headers = [...(table?.querySelectorAll('thead th') || [])].map((th) => hkey(th.textContent));
  const find = (name) => headers.indexOf(hkey(name));
  return { headers, find };
}
function addHeaderAfter(table, afterName, newName) {
  const { find } = headerIndexes(table);
  if (find(newName) >= 0) return;
  const afterIdx = find(afterName);
  const th = document.createElement('th');
  th.textContent = newName;
  const row = table.querySelector('thead tr');
  row?.insertBefore(th, afterIdx >= 0 ? row.children[afterIdx + 1] || null : null);
  for (const tr of table.querySelectorAll('tbody tr')) {
    const td = document.createElement('td');
    tr.insertBefore(td, afterIdx >= 0 ? tr.children[afterIdx + 1] || null : null);
  }
}
function setInsertedCell(table, bodyRow, headerName, value, cls = '') {
  const { find } = headerIndexes(table);
  const i = find(headerName);
  if (i < 0) return;
  const td = cell(bodyRow, i);
  if (!td) return;
  td.textContent = value || '';
  if (cls) td.className = cls;
}
function statusClass(value) {
  const text = String(value || '').toUpperCase();
  if (text.startsWith('AUDIT_REQUIRED') || text === 'ERROR') return 'psmap-error';
  if (text === 'WARNING') return 'psmap-warn';
  return 'psmap-ok';
}
function augmentValidator(modal, sources) {
  const table = [...modal.querySelectorAll('.psmap-card')].find((card) => /Table 2 Validator/i.test(card.textContent))?.querySelector('table');
  if (!table || table.dataset.mandatoryAuditApplied) return;
  const t2 = parseT2(sources.table2);
  if (!t2.size) return;
  addHeaderAfter(table, 'Enabled', 'Mandatory');
  addHeaderAfter(table, 'Node Coverage Note', 'Audit Status');
  addHeaderAfter(table, 'Audit Status', 'Audit Severity');
  addHeaderAfter(table, 'Audit Severity', 'Audit Action');
  const h = headerIndexes(table);
  const psIdx = h.find('PSNO_Model');
  const nodeIdx = h.find('Node');
  const supportIdx = h.find('Support match');
  const noteIdx = h.find('Node Coverage Note');
  const warningsIdx = h.find('Warnings');
  for (const tr of table.querySelectorAll('tbody tr')) {
    const psno = cell(tr, psIdx)?.textContent?.trim();
    const audit = t2.get(psno);
    if (!audit?.mandatory) continue;
    const node = cell(tr, nodeIdx)?.textContent?.trim();
    const supportMatch = cell(tr, supportIdx)?.textContent?.trim();
    const note = cell(tr, noteIdx)?.textContent?.trim();
    const warnings = cell(tr, warningsIdx)?.textContent || '';
    let status = 'AUDIT_REQUIRED_VALIDATED';
    let severity = 'OK';
    let action = 'No action.';
    if (!node) { status = 'AUDIT_REQUIRED_NO_NODE_MATCH'; severity = 'ERROR'; action = 'Add/verify Table-1 PS No/Node mapping for this mandatory Table-2 PSNO_Model.'; }
    else if (!audit.dtxr) { status = 'AUDIT_REQUIRED_DTXR_BLANK'; severity = 'WARNING'; action = 'Add/verify DTXR/support entry for this mandatory Table-2 PSNO_Model.'; }
    else if (/SUPPORT_CONFLICT/.test(warnings) || (!supportMatch && audit.supportTypes.length)) { status = 'AUDIT_REQUIRED_SUPPORT_REVIEW'; severity = 'WARNING'; action = 'Review mandatory DTXR support against selected node ISONOTE.'; }
    if (note && status === 'AUDIT_REQUIRED_VALIDATED') { status = 'AUDIT_REQUIRED_NODE_COVERAGE_WARNING'; severity = 'WARNING'; action = 'Review node-level Table 1 Support Coverage for this mandatory row.'; }
    setInsertedCell(table, tr, 'Mandatory', 'YES');
    setInsertedCell(table, tr, 'Audit Status', status, statusClass(status));
    setInsertedCell(table, tr, 'Audit Severity', severity, statusClass(severity));
    setInsertedCell(table, tr, 'Audit Action', action);
  }
  table.dataset.mandatoryAuditApplied = '1';
}
function augmentCoverage(modal, sources) {
  const table = [...modal.querySelectorAll('.psmap-card')].find((card) => /Table 1 Support Coverage/i.test(card.textContent))?.querySelector('table');
  if (!table || table.dataset.mandatoryAuditApplied) return;
  const t1c = parseT1C(sources.table1C);
  if (!t1c.size) return;
  const t1ByNode = parseT1(sources.table1);
  addHeaderAfter(table, 'Node', 'Mandatory');
  addHeaderAfter(table, 'Coverage Status', 'Audit Severity');
  const h = headerIndexes(table);
  const nodeIdx = h.find('Node');
  const tagIdx = h.find('Tag');
  const table1PsIdx = h.find('Table-1 PS No');
  const statusIdx = h.find('Coverage Status');
  const missingIdx = h.find('Missing Master Keywords');
  const masterIdx = h.find('Master Keywords');
  const coveredIdx = h.find('Covered DTXR Keywords');
  const actionIdx = h.find('Action');
  const existing = new Set();
  for (const tr of table.querySelectorAll('tbody tr')) {
    const node = cell(tr, nodeIdx)?.textContent?.trim();
    const audit = t1c.get(node);
    if (!audit?.mandatory) continue;
    existing.add(node);
    const ctx = t1ByNode.get(node) || {};
    if (tagIdx >= 0 && ctx.tag && !cell(tr, tagIdx)?.textContent?.trim()) cell(tr, tagIdx).textContent = ctx.tag;
    if (table1PsIdx >= 0 && ctx.table1PsNo && !cell(tr, table1PsIdx)?.textContent?.trim()) cell(tr, table1PsIdx).textContent = ctx.table1PsNo;
    const missing = cell(tr, missingIdx)?.textContent?.trim();
    const master = cell(tr, masterIdx)?.textContent?.trim();
    const covered = cell(tr, coveredIdx)?.textContent?.trim();
    let status = cell(tr, statusIdx)?.textContent?.trim() || '';
    let action = cell(tr, actionIdx)?.textContent?.trim() || '';
    const label = ctx.tag ? `Node ${node} [Tag: ${ctx.tag}]` : `Node ${node}`;
    if (!audit.isonote) { status = 'AUDIT_REQUIRED_ISONOTE_MISSING'; action = `Add/verify Table-1C ISONOTE/support data for mandatory ${label}.`; }
    else if (missing) { status = 'AUDIT_REQUIRED_MISSING_SUPPORT'; action = `Add/verify mapped Table-2 DTXR containing ${missing} for mandatory ${label}.`; }
    else if (master && !covered) { status = 'AUDIT_REQUIRED_DTXR_MISSING'; action = `Add/verify mapped Table-2 DTXR row(s) for mandatory ${label}.`; }
    setInsertedCell(table, tr, 'Mandatory', 'YES');
    setInsertedCell(table, tr, 'Coverage Status', status, statusClass(status));
    setInsertedCell(table, tr, 'Audit Severity', status.startsWith('AUDIT_REQUIRED') ? 'WARNING' : 'OK', status.startsWith('AUDIT_REQUIRED') ? 'psmap-warn' : 'psmap-ok');
    setInsertedCell(table, tr, 'Action', action);
  }
  const tbody = table.querySelector('tbody');
  for (const audit of t1c.values()) {
    if (!audit.mandatory || existing.has(audit.node)) continue;
    const ctx = t1ByNode.get(audit.node) || {};
    const label = ctx.tag ? `Node ${audit.node} [Tag: ${ctx.tag}]` : `Node ${audit.node}`;
    const status = audit.isonote ? 'AUDIT_REQUIRED_DTXR_MISSING' : 'AUDIT_REQUIRED_ISONOTE_MISSING';
    const action = audit.isonote ? `Add/verify mapped Table-2 DTXR row(s) for mandatory ${label}.` : `Add/verify Table-1C ISONOTE/support data for mandatory ${label}.`;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(audit.node)}</td><td>YES</td><td>${esc(ctx.table1PsNo || '')}</td><td>${esc(ctx.tag || '')}</td><td></td><td></td><td></td><td>${esc(audit.isonote)}</td><td>${esc(supportText(audit.supportTypes))}</td><td></td><td></td><td>${esc(supportText(audit.supportTypes))}</td><td></td><td class="psmap-error">${status}</td><td class="psmap-warn">WARNING</td><td>${esc(action)}</td>`;
    tbody?.appendChild(tr);
  }
  table.dataset.mandatoryAuditApplied = '1';
}
function augment(modal = document.querySelector('[data-psmap-modal-bg]')) {
  if (!modal || !window[PS_MAP_AUDIT_SHIM_KEY]?.lastSource) return;
  augmentValidator(modal, window[PS_MAP_AUDIT_SHIM_KEY].lastSource);
  augmentCoverage(modal, window[PS_MAP_AUDIT_SHIM_KEY].lastSource);
}
export function installPsMappingMandatoryAuditShim() {
  if (window[PS_MAP_AUDIT_SHIM_KEY]?.installed) return;
  window[PS_MAP_AUDIT_SHIM_KEY] = { installed: true, lastSource: null };
  document.addEventListener('click', (event) => {
    const modal = event.target.closest('[data-psmap-modal-bg]');
    if (!modal) return;
    if (event.target.closest('[data-psmap-action="run"]') || event.target.closest('[data-psmap-tab]')) {
      const source = readSources(modal);
      if (Object.keys(source).length) window[PS_MAP_AUDIT_SHIM_KEY].lastSource = source;
      setTimeout(() => augment(), 80);
      setTimeout(() => augment(), 250);
    }
  }, true);
  setTimeout(() => augment(), 300);
}

installPsMappingMandatoryAuditShim();
