import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-v6.js?v=20260609-psnm-v6-stable-1';

const EXPECTED_HEADERS = {
  table1Text: ['PS NAME', 'Position', 'p1bore', 'Mandatory'],
  table4AText: ['Mandatory PS Name'],
  table2Text: ['Node', 'X', 'Y', 'Z', 'Bore', 'Mandatory'],
  table3Text: ['Node', 'Dia(mm)'],
  table4BText: ['Mandatory Node No'],
};

const SOURCE_LABELS = {
  table1Text: 'Table 1 - PS Source',
  table4AText: 'Table 4A - Mandatory PS / PS Override (optional)',
  table2Text: 'Table 2 - Node XYZ Source',
  table3Text: 'Table 3 - Node OD / Dia (optional)',
  table4BText: 'Table 4B - Mandatory Node / Node Override (optional)',
};

const CANONICAL_FIELDS = {
  table1Text: ['', 'PS NAME', 'Position', 'p1bore', 'Mandatory'],
  table4AText: ['', 'Mandatory PS Name'],
  table2Text: ['', 'Node', 'X', 'Y', 'Z', 'Bore', 'Mandatory'],
  table3Text: ['', 'Node', 'Dia(mm)'],
  table4BText: ['', 'Mandatory Node No'],
};

const HEADER_ALIASES = {
  'PS NAME': ['ps name', 'ps no', 'ps number', 'psno', 'ps', 'support name', 'support point', 'ps tag'],
  Position: ['position', 'coordinate', 'coordinates', 'coord', 'ps position', 'e/u/s', 'esu', 'location'],
  p1bore: ['p1bore', 'p1 bore', 'bore', 'nb', 'dn', 'nominal bore', 'diameter'],
  Mandatory: ['mandatory', 'required', 'mand', 'audit', 'must map'],
  Node: ['node', 'node no', 'node number', 'node id', 'support node'],
  X: ['x', 'raw x', 'coord x', 'node x'],
  Y: ['y', 'raw y', 'coord y', 'node y'],
  Z: ['z', 'raw z', 'coord z', 'node z'],
  Bore: ['bore', 'nb', 'dn', 'nominal bore', 'diameter'],
  'Dia(mm)': ['dia(mm)', 'dia', 'od', 'outside diameter', 'diameter', 'od(mm)', 'pipe od'],
  'Mandatory PS Name': ['mandatory ps name', 'mandatory ps', 'ps name', 'ps no', 'required ps'],
  'Mandatory Node No': ['mandatory node no', 'mandatory node', 'node', 'node no', 'required node'],
};

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function norm(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

function splitLine(line) {
  const raw = String(line || '');
  if (raw.includes('\t')) return raw.split('\t').map((x) => x.trim());
  if (raw.includes('|')) return raw.split('|').map((x) => x.trim());
  if (raw.includes(',')) return raw.split(',').map((x) => x.trim());
  return raw.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
}

function nonEmptyLines(text) {
  return String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function headerOf(text) {
  const line = nonEmptyLines(text)[0] || '';
  return splitLine(line);
}

function looksLikeDataRow(cells) {
  const joined = cells.join('\t');
  if (/\bE\s*[-+]?\d+(?:\.\d+)?\s*mm\b/i.test(joined) && /\bS\s*[-+]?\d+(?:\.\d+)?\s*mm\b/i.test(joined)) return true;
  if (/^\d+(?:\.\d+)?$/.test(cells[0] || '') && cells.length >= 3) return true;
  if (/^PS[-_/A-Z0-9.]+/i.test(cells[0] || '')) return true;
  return false;
}

function canonicalForHeader(header, allowedFields = []) {
  const n = norm(header);
  for (const field of allowedFields) {
    if (!field) continue;
    if (norm(field) === n) return field;
    const aliases = HEADER_ALIASES[field] || [];
    if (aliases.some((alias) => norm(alias) === n)) return field;
  }
  return '';
}

function analyzeText(sourceKey, text) {
  const expected = EXPECTED_HEADERS[sourceKey] || [];
  const allowed = CANONICAL_FIELDS[sourceKey] || [''];
  const lines = nonEmptyLines(text);
  const cells = headerOf(text);
  const mapped = cells.map((cell) => canonicalForHeader(cell, allowed));
  const present = new Set(mapped.filter(Boolean));
  return { expected, cells, mapped, present, lines, firstRowLooksData: looksLikeDataRow(cells) };
}

function preflight(container) {
  const issues = [];
  const get = (key) => container.querySelector(`textarea[data-source="${key}"]`)?.value || '';
  const t1 = analyzeText('table1Text', get('table1Text'));
  const t2 = analyzeText('table2Text', get('table2Text'));
  const t3 = analyzeText('table3Text', get('table3Text'));

  if (!t1.lines.length) issues.push(['hard', 'TABLE1_EMPTY', 'Table 1 - PS Source is empty.', 'Paste PS source with PS NAME, Position, p1bore, Mandatory.']);
  if (!t2.lines.length) issues.push(['hard', 'TABLE2_EMPTY', 'Table 2 - Node XYZ Source is empty.', 'Paste Node source with Node, X, Y, Z, Bore, Mandatory.']);

  if (t1.lines.length && t1.firstRowLooksData) issues.push(['hard', 'TABLE1_HEADER_MISSING', 'Table 1 first row looks like data, not a header.', 'Use Map headers / aliases and insert PS NAME | Position | p1bore | Mandatory.']);
  if (t2.lines.length && t2.firstRowLooksData) issues.push(['hard', 'TABLE2_HEADER_MISSING', 'Table 2 first row looks like data, not a header.', 'Use Map headers / aliases and insert Node | X | Y | Z | Bore | Mandatory.']);

  if (t1.lines.length && !t1.firstRowLooksData) {
    const missing = ['PS NAME', 'Position'].filter((field) => !t1.present.has(field));
    if (missing.length) issues.push(['hard', 'TABLE1_REQUIRED_COLUMNS_MISSING', `Table 1 is missing required column(s): ${missing.join(', ')}.`, 'Map aliases or rename the header row.']);
    if (t1.present.has('Node') || t1.present.has('X') || t1.present.has('Y') || t1.present.has('Z')) issues.push(['hard', 'TABLE1_LOOKS_LIKE_NODE_TABLE', 'Table 1 contains Node/X/Y/Z-style headers.', 'Move node rows to Table 2, or map headers correctly.']);
  }

  if (t2.lines.length && !t2.firstRowLooksData) {
    const missing = ['Node'].filter((field) => !t2.present.has(field));
    const hasXYZ = t2.present.has('X') && t2.present.has('Y') && t2.present.has('Z');
    if (missing.length || !hasXYZ) issues.push(['hard', 'TABLE2_REQUIRED_COLUMNS_MISSING', `Table 2 needs Node plus X/Y/Z columns. Missing: ${[...missing, ...(hasXYZ ? [] : ['X/Y/Z'])].join(', ')}.`, 'Map aliases or rename the header row.']);
    if (t2.present.has('PS NAME') || t2.present.has('Position')) issues.push(['hard', 'TABLE2_LOOKS_LIKE_PS_TABLE', 'Table 2 contains PS NAME / Position-style headers.', 'Move PS rows to Table 1, or map headers correctly.']);
  }

  if (t3.lines.length && !t3.firstRowLooksData) {
    const missing = ['Node', 'Dia(mm)'].filter((field) => !t3.present.has(field));
    if (missing.length) issues.push(['warn', 'TABLE3_COLUMNS_MISSING', `Optional Table 3 is missing: ${missing.join(', ')}.`, 'Leave Table 3 blank or map Node and Dia(mm).']);
  }

  return issues;
}

function ensureStyle() {
  if (document.getElementById('psnm-phase1-ux-style')) return;
  const style = document.createElement('style');
  style.id = 'psnm-phase1-ux-style';
  style.textContent = `
.psnm-ux-primary{display:grid;grid-template-columns:minmax(420px,1fr) minmax(420px,1fr);gap:12px;align-items:start}
.psnm-ux-optional{border:1px solid rgba(143,197,255,.18);border-radius:12px;background:#0b1220;padding:10px}
.psnm-ux-expected{font:11px ui-monospace,Consolas,monospace;color:#9fc9ff;background:#0b1220;border:1px dashed rgba(143,197,255,.24);border-radius:8px;padding:7px;margin:6px 0}
.psnm-ux-preflight{border:1px solid rgba(252,211,77,.35);background:rgba(113,63,18,.24);border-radius:12px;padding:10px;display:grid;gap:8px}
.psnm-ux-preflight.ok{border-color:rgba(134,239,172,.35);background:rgba(20,83,45,.18)}
.psnm-ux-issue{font-size:12px;line-height:1.45;border-top:1px solid rgba(255,255,255,.08);padding-top:7px}.psnm-ux-issue b{color:#fde68a}.psnm-ux-issue.warn b{color:#bfdbfe}
.psnm-ux-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}.psnm-ux-tools button{font-size:11px;padding:5px 8px}.psnm-ux-map-bg{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px}.psnm-ux-map{width:min(760px,96vw);max-height:88vh;overflow:auto;background:#0f1724;border:1px solid rgba(143,197,255,.25);border-radius:14px;color:#d9e6f7;box-shadow:0 24px 80px rgba(0,0,0,.4)}.psnm-ux-map-head,.psnm-ux-map-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(143,197,255,.14)}.psnm-ux-map-foot{border-top:1px solid rgba(143,197,255,.14);border-bottom:0}.psnm-ux-map-body{padding:12px 14px;display:grid;gap:10px}.psnm-ux-map-row{display:grid;grid-template-columns:minmax(160px,1fr) 220px;gap:10px;align-items:center}.psnm-ux-map select{background:#0b1220;color:#e5edf7;border:1px solid rgba(143,197,255,.2);border-radius:8px;padding:7px}.psnm-ux-card-note{font-size:12px;color:#b7c9dd}
@media(max-width:1100px){.psnm-ux-primary{grid-template-columns:1fr}.psnm-ux-map-row{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function addExpectedHeader(field, sourceKey) {
  if (field.querySelector(':scope > .psnm-ux-expected')) return;
  const expected = EXPECTED_HEADERS[sourceKey];
  if (!expected) return;
  const div = document.createElement('div');
  div.className = 'psnm-ux-expected';
  div.textContent = `Expected columns: ${expected.join(' | ')}`;
  const textarea = field.querySelector('textarea[data-source]');
  field.insertBefore(div, textarea || field.firstChild);
}

function addMapButton(field, sourceKey) {
  if (field.querySelector('[data-psnm-ux-map-source]')) return;
  const tools = document.createElement('div');
  tools.className = 'psnm-ux-tools';
  tools.innerHTML = `<button type="button" class="psnm-btn psnm-btn-secondary" data-psnm-ux-map-source="${h(sourceKey)}">Map headers / aliases</button>`;
  const textarea = field.querySelector('textarea[data-source]');
  field.insertBefore(tools, textarea || null);
}

function renameLabels(panel) {
  panel.querySelectorAll('.psnm-field').forEach((field) => {
    const textarea = field.querySelector('textarea[data-source]');
    if (!textarea) return;
    const sourceKey = textarea.dataset.source;
    const label = field.querySelector('label');
    if (label && SOURCE_LABELS[sourceKey]) label.textContent = SOURCE_LABELS[sourceKey];
    addExpectedHeader(field, sourceKey);
    addMapButton(field, sourceKey);
  });
}

function optimizeSourceLayout(panel) {
  const cardBody = panel.querySelector('.psnm-card-body');
  if (!cardBody || cardBody.dataset.psnmUxLayout === '1') return;
  const fields = new Map(Array.from(panel.querySelectorAll('textarea[data-source]')).map((textarea) => [textarea.dataset.source, textarea.closest('.psnm-field')]));
  const table1 = fields.get('table1Text');
  const table2 = fields.get('table2Text');
  if (!table1 || !table2) return;

  const primary = document.createElement('div');
  primary.className = 'psnm-ux-primary';
  primary.append(table1, table2);

  const optional = document.createElement('details');
  optional.className = 'psnm-ux-optional';
  optional.innerHTML = '<summary>Optional master/reference inputs - Table 4A / Table 3 / Table 4B</summary>';
  const optionalBody = document.createElement('div');
  optionalBody.className = 'psnm-source-node';
  ['table4AText', 'table3Text', 'table4BText'].forEach((key) => {
    const field = fields.get(key);
    if (field) optionalBody.appendChild(field);
  });
  optional.appendChild(optionalBody);

  const banner = cardBody.querySelector('.psnm-banner');
  const counts = cardBody.querySelector('.psnm-counts');
  const h3s = Array.from(cardBody.querySelectorAll('h3'));
  h3s.forEach((node) => node.remove());
  cardBody.insertBefore(primary, counts?.nextSibling || banner?.nextSibling || cardBody.firstChild);
  cardBody.insertBefore(optional, primary.nextSibling);
  cardBody.dataset.psnmUxLayout = '1';
}

function renderPreflight(container) {
  const sourcePanel = container.querySelector('[data-psnm-panel="source"]');
  const cardBody = sourcePanel?.querySelector('.psnm-card-body');
  if (!cardBody) return;
  const issues = preflight(container);
  let box = sourcePanel.querySelector('[data-psnm-ux="preflight"]');
  if (!box) {
    box = document.createElement('div');
    box.dataset.psnmUx = 'preflight';
    const counts = sourcePanel.querySelector('.psnm-counts');
    cardBody.insertBefore(box, counts?.nextSibling || cardBody.firstChild);
  }
  const hard = issues.filter(([level]) => level === 'hard');
  if (!issues.length) {
    box.className = 'psnm-ux-preflight ok';
    box.innerHTML = '<b>Preflight check:</b> source headers look usable. Build Master Tables when ready.';
    return;
  }
  box.className = 'psnm-ux-preflight';
  box.innerHTML = `<b>Preflight found ${hard.length} hard blocker(s) and ${issues.length - hard.length} warning(s).</b>${issues.map(([level, code, message, action]) => `<div class="psnm-ux-issue ${h(level)}"><b>${h(code)}</b><br>${h(message)}<br><span>${h(action)}</span></div>`).join('')}`;
}

function enhanceSource(container) {
  const sourcePanel = container.querySelector('[data-psnm-panel="source"]');
  if (!sourcePanel) return;
  renameLabels(sourcePanel);
  optimizeSourceLayout(sourcePanel);
  renderPreflight(container);
}

function openHeaderMapDialog(container, sourceKey) {
  const textarea = container.querySelector(`textarea[data-source="${sourceKey}"]`);
  if (!textarea) return;
  const fields = CANONICAL_FIELDS[sourceKey] || [''];
  const cells = headerOf(textarea.value);
  const firstRowLooksData = looksLikeDataRow(cells);
  const rows = (cells.length ? cells : ['Column 1']).map((cell, index) => {
    const current = canonicalForHeader(cell, fields);
    return `<label class="psnm-ux-map-row"><span><b>Column ${index + 1}</b><br><span class="psnm-ux-card-note">${h(cell || '(blank)')}</span></span><select data-psnm-ux-map-index="${index}">${fields.map((field) => `<option value="${h(field)}" ${field === current ? 'selected' : ''}>${h(field || 'Ignore')}</option>`).join('')}</select></label>`;
  }).join('');
  const dialog = document.createElement('div');
  dialog.className = 'psnm-ux-map-bg';
  dialog.innerHTML = `<div class="psnm-ux-map" role="dialog" aria-modal="true"><div class="psnm-ux-map-head"><div><b>Map headers - ${h(SOURCE_LABELS[sourceKey] || sourceKey)}</b><div class="psnm-ux-card-note">Column order can change. Map each pasted column to the canonical PSNM field.</div></div><button type="button" class="psnm-btn psnm-btn-secondary" data-psnm-ux-close>Close</button></div><div class="psnm-ux-map-body"><label><input type="checkbox" data-psnm-ux-insert-header ${firstRowLooksData ? 'checked' : ''}> First row is data; insert mapped header above it</label>${rows}</div><div class="psnm-ux-map-foot"><button type="button" class="psnm-btn psnm-btn-secondary" data-psnm-ux-close>Cancel</button><button type="button" class="psnm-btn" data-psnm-ux-apply-map>Apply header mapping</button></div></div>`;
  dialog.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-psnm-ux-close]')) { dialog.remove(); return; }
    if (!event.target?.closest?.('[data-psnm-ux-apply-map]')) return;
    const mapped = Array.from(dialog.querySelectorAll('[data-psnm-ux-map-index]')).map((select) => select.value || '');
    const header = mapped.map((value, index) => value || `Ignore_${index + 1}`).join('\t');
    const lines = String(textarea.value || '').split(/\r?\n/);
    const insert = dialog.querySelector('[data-psnm-ux-insert-header]')?.checked;
    textarea.value = insert ? [header, ...lines].join('\n') : [header, ...lines.slice(1)].join('\n');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.remove();
    setTimeout(() => enhanceSource(container), 0);
  });
  document.body.appendChild(dialog);
}

function onUxClick(container, event) {
  const map = event.target?.closest?.('[data-psnm-ux-map-source]');
  if (map) {
    event.preventDefault();
    openHeaderMapDialog(container, map.dataset.psnmUxMapSource);
  }
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const destroyCore = renderPSNMCoreUtilityTab(container, ctx);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => enhanceSource(container), 0);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  const click = (event) => onUxClick(container, event);
  const input = () => renderPreflight(container);
  container.addEventListener('click', click);
  container.addEventListener('input', input);
  container.addEventListener('change', input);
  schedule();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    container.removeEventListener('click', click);
    container.removeEventListener('input', input);
    container.removeEventListener('change', input);
    try { destroyCore?.(); } catch {}
  };
}
