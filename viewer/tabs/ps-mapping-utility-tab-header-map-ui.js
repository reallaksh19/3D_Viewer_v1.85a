import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-preflight-ui.js?v=20260611-psmap-preflight-1';

const STYLE_ID = 'psmap-header-map-style';

const TABLE_CONFIGS = {
  table1c: {
    title: 'Table-1C Reference',
    source: 'table1CText',
    insertHint: 'Line No | Node | PS No | Pipe size | ISONOTE | Mandatory',
    fields: [
      { key: 'lineNo', label: 'Line No', aliases: ['line no', 'line number', 'lineno', 'line', 'pipe', 'branchname', 'branch name', 'pipeline', 'line id'] },
      { key: 'node', label: 'Node', aliases: ['node', 'node no', 'node number', 'node id', 'candidate node', 'support node'] },
      { key: 'psNo', label: 'PS No', aliases: ['ps no', 'psno', 'ps name', 'ps', 'support no', 'support number', 'support tag'] },
      { key: 'pipeSize', label: 'Pipe size', aliases: ['pipe size', 'pipe nps', 'nps', 'size', 'nb', 'nominal bore', 'nominal size'] },
      { key: 'isonote', label: 'ISONOTE', aliases: ['isonote', 'iso note', 'iso-note', 'note', 'notes', 'description', 'support note', 'support description'] },
      { key: 'mandatory', label: 'Mandatory', aliases: ['mandatory', 'required', 'mand', 'audit', 'is mandatory'] },
    ],
  },
  table2: {
    title: 'Table-2 Model',
    source: 'table2Text',
    insertHint: 'PS NO | Bore | pipe | DTXR | Support Gap | Mandatory',
    fields: [
      { key: 'psNo', label: 'PS NO', aliases: ['ps no', 'psno', 'ps name', 'psno_model', 'psno model', 'support no', 'support tag'] },
      { key: 'bore', label: 'Bore', aliases: ['bore', 'model bore', 'nb', 'dn', 'nominal bore', 'diameter'] },
      { key: 'pipe', label: 'pipe', aliases: ['pipe', 'line no', 'line number', 'line', 'branchname', 'branch name', 'pipeline', 'line id'] },
      { key: 'dtxr', label: 'DTXR', aliases: ['dtxr', 'support', 'support type', 'support description', 'description', 'desc', 'support desc'] },
      { key: 'supportGap', label: 'Support Gap', aliases: ['support gap', 'guide gap', 'gap', 'gap mm', 'support gap mm'] },
      { key: 'mandatory', label: 'Mandatory', aliases: ['mandatory', 'required', 'mand', 'audit', 'is mandatory'] },
    ],
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

function splitPhysicalRows(text) {
  return String(text || '').split(/\r?\n/);
}

function nonBlankRows(text) {
  return splitPhysicalRows(text).map((line, index) => ({ line, index })).filter((row) => row.line.trim());
}

function detectDelimiter(line) {
  if (String(line).includes('\t')) return '\t';
  if (String(line).includes('|')) return '|';
  return '\t';
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
    || (/^[-+]?\d+(?:\.\d+)?$/.test(second) && /ASIM|\d+"|[A-Z]\d{5,}/i.test(cells.join(' ')));
}

function fieldByKey(config, key) {
  return config.fields.find((field) => field.key === key) || null;
}

function matchField(config, rawHeader) {
  const normalized = normalizeHeader(rawHeader);
  if (!normalized) return '';
  const exact = config.fields.find((field) => normalizeHeader(field.label) === normalized);
  if (exact) return exact.key;
  const alias = config.fields.find((field) => field.aliases.some((item) => normalizeHeader(item) === normalized));
  return alias?.key || '';
}

function defaultFieldByPosition(config, index) {
  return config.fields[index]?.key || '';
}

function textareaFor(config) {
  return document.querySelector(`[data-psmap-source="${config.source}"]`);
}

function sourceSnapshot(config) {
  const textarea = textareaFor(config);
  const text = textarea?.value || '';
  const rows = nonBlankRows(text);
  const first = rows[0]?.line || '';
  const firstCells = splitLine(first);
  const firstIsData = looksLikeDataRow(firstCells);
  const delimiter = detectDelimiter(first);
  const rawHeaders = firstCells.length ? firstCells : config.fields.map((field) => field.label);
  return { textarea, text, rows, first, firstCells, firstIsData, delimiter, rawHeaders };
}

function renderMappingSection(configKey) {
  const config = TABLE_CONFIGS[configKey];
  const snapshot = sourceSnapshot(config);
  const missingText = !snapshot.text.trim();
  const rows = snapshot.rawHeaders.map((rawHeader, index) => {
    const selected = snapshot.firstIsData ? defaultFieldByPosition(config, index) : matchField(config, rawHeader);
    const preview = snapshot.firstIsData ? rawHeader : '';
    return `<tr>
      <td>${index + 1}</td>
      <td><code>${h(rawHeader || `Column ${index + 1}`)}</code>${preview ? `<div class="psmap-header-map-preview">data preview</div>` : ''}</td>
      <td>
        <select data-psmap-header-map-select="${h(configKey)}" data-col-index="${index}">
          <option value="">Ignore / keep as extra column</option>
          ${config.fields.map((field) => `<option value="${h(field.key)}" ${selected === field.key ? 'selected' : ''}>${h(field.label)}</option>`).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');
  const detected = snapshot.rawHeaders.filter((rawHeader, index) => snapshot.firstIsData ? Boolean(defaultFieldByPosition(config, index)) : Boolean(matchField(config, rawHeader))).length;
  return `<section class="psmap-header-map-section" data-psmap-header-map-section="${h(configKey)}">
    <div class="psmap-header-map-section-title">
      <span>${h(config.title)}</span>
      <span>${missingText ? 'No pasted data' : snapshot.firstIsData ? 'First row looks like data — header will be inserted' : `${detected}/${snapshot.rawHeaders.length} headers recognized`}</span>
    </div>
    <p class="psmap-header-map-note">Standard header: <code>${h(config.insertHint)}</code></p>
    <table>
      <thead><tr><th>#</th><th>${snapshot.firstIsData ? 'First data row preview' : 'Current header'}</th><th>Map to field</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">Paste data first, then map headers.</td></tr>'}</tbody>
    </table>
    <label class="psmap-header-map-inline"><input type="checkbox" data-psmap-header-insert="${h(configKey)}" ${snapshot.firstIsData ? 'checked' : ''}> First row is data; insert a new header instead of replacing the first row</label>
    <button type="button" class="psmap-header-map-apply" data-psmap-header-apply="${h(configKey)}">Apply ${h(config.title)} header mapping</button>
  </section>`;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-header-map-host{margin:8px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.psmap-header-map-btn{border:1px solid rgba(96,165,250,.42);background:rgba(30,64,175,.22);color:#dbeafe;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;cursor:pointer}.psmap-header-map-hint{color:#cbd5e1;font-size:12px}.psmap-header-map-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.72);display:flex;align-items:flex-start;justify-content:center;padding:5vh 18px;overflow:auto}.psmap-header-map-dialog{width:min(1040px,96vw);background:#0f172a;border:1px solid rgba(148,163,184,.34);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.45);color:#e5e7eb}.psmap-header-map-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.22)}.psmap-header-map-head h3{margin:0;font-size:16px}.psmap-header-map-close{border:0;background:rgba(148,163,184,.16);color:#e5e7eb;border-radius:10px;padding:6px 9px;cursor:pointer}.psmap-header-map-body{display:grid;gap:14px;padding:14px 16px}.psmap-header-map-section{border:1px solid rgba(148,163,184,.22);border-radius:12px;padding:12px;background:rgba(15,23,42,.6)}.psmap-header-map-section-title{display:flex;justify-content:space-between;gap:10px;font-weight:800;color:#f8fafc;margin-bottom:6px}.psmap-header-map-note{margin:0 0 8px;color:#cbd5e1;font-size:12px}.psmap-header-map-section table{width:100%;border-collapse:collapse;font-size:12px}.psmap-header-map-section th,.psmap-header-map-section td{border-top:1px solid rgba(148,163,184,.18);padding:6px 8px;text-align:left;vertical-align:top}.psmap-header-map-section select{width:100%;background:#020617;color:#e5e7eb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:6px}.psmap-header-map-inline{display:flex;align-items:center;gap:7px;font-size:12px;color:#dbeafe;margin:8px 0}.psmap-header-map-apply{border:1px solid rgba(34,197,94,.42);background:rgba(22,101,52,.28);color:#bbf7d0;border-radius:10px;padding:7px 10px;font-weight:800;cursor:pointer}.psmap-header-map-preview{font-size:11px;color:#fbbf24;margin-top:2px}.psmap-header-map-toast{position:fixed;right:18px;bottom:18px;z-index:10000;background:#064e3b;color:#d1fae5;border:1px solid rgba(52,211,153,.42);border-radius:12px;padding:9px 12px;font-size:12px;box-shadow:0 12px 35px rgba(0,0,0,.35)}`;
  document.head.appendChild(style);
}

function ensureButtonHost() {
  const panel = document.querySelector('[data-psmap-panel="source"]');
  if (!panel) return null;
  let host = panel.querySelector('[data-psmap-header-map-host]');
  if (host) return host;
  host = document.createElement('div');
  host.className = 'psmap-header-map-host';
  host.setAttribute('data-psmap-header-map-host', '1');
  host.innerHTML = `<button type="button" class="psmap-header-map-btn" data-psmap-header-map-open>Map headers / aliases</button><span class="psmap-header-map-hint">Use when column titles differ or a header row is missing. Column order can vary.</span>`;
  const cardBody = panel.querySelector('.psmap-card-body');
  const preflight = cardBody?.querySelector('[data-psmap-preflight-host]');
  if (preflight?.nextSibling) preflight.parentNode.insertBefore(host, preflight.nextSibling);
  else cardBody?.prepend(host);
  return host;
}

function openMapper() {
  installStyle();
  document.querySelector('[data-psmap-header-map-dialog]')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'psmap-header-map-backdrop';
  backdrop.setAttribute('data-psmap-header-map-dialog', '1');
  backdrop.innerHTML = `<div class="psmap-header-map-dialog" role="dialog" aria-modal="true" aria-label="PS Mapping header mapper">
    <div class="psmap-header-map-head">
      <div><h3>Map pasted headers to PS Mapping fields</h3><div class="psmap-header-map-note">Headers may be in any order. If the first row is data, keep “insert header” checked. Extra columns can be ignored safely.</div></div>
      <button type="button" class="psmap-header-map-close" data-psmap-header-map-close>Close</button>
    </div>
    <div class="psmap-header-map-body">${renderMappingSection('table1c')}${renderMappingSection('table2')}</div>
  </div>`;
  document.body.appendChild(backdrop);
}

function mappedHeaderCells(configKey) {
  const config = TABLE_CONFIGS[configKey];
  const snapshot = sourceSnapshot(config);
  const selects = [...document.querySelectorAll(`[data-psmap-header-map-select="${configKey}"]`)];
  return selects.map((select, index) => {
    const field = fieldByKey(config, select.value);
    if (field) return field.label;
    return snapshot.firstIsData ? `Extra ${index + 1}` : (snapshot.rawHeaders[index] || `Extra ${index + 1}`);
  });
}

function applyMapping(configKey) {
  const config = TABLE_CONFIGS[configKey];
  const snapshot = sourceSnapshot(config);
  if (!snapshot.text.trim() || !snapshot.textarea) return false;
  const physicalRows = splitPhysicalRows(snapshot.text);
  const firstNonBlank = nonBlankRows(snapshot.text)[0];
  if (!firstNonBlank) return false;
  const insert = document.querySelector(`[data-psmap-header-insert="${configKey}"]`)?.checked || false;
  const delimiter = snapshot.delimiter || '\t';
  const headerLine = mappedHeaderCells(configKey).join(delimiter);
  if (insert) {
    physicalRows.splice(firstNonBlank.index, 0, headerLine);
  } else {
    physicalRows[firstNonBlank.index] = headerLine;
  }
  snapshot.textarea.value = physicalRows.join('\n');
  snapshot.textarea.dispatchEvent(new Event('input', { bubbles: true }));
  snapshot.textarea.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'psmap-header-map-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function handleClick(event) {
  const open = event.target.closest('[data-psmap-header-map-open]');
  if (open) {
    event.preventDefault();
    openMapper();
    return;
  }
  const close = event.target.closest('[data-psmap-header-map-close]');
  if (close || (event.target.matches?.('[data-psmap-header-map-dialog]'))) {
    event.preventDefault();
    document.querySelector('[data-psmap-header-map-dialog]')?.remove();
    return;
  }
  const apply = event.target.closest('[data-psmap-header-apply]');
  if (apply) {
    event.preventDefault();
    const table = apply.getAttribute('data-psmap-header-apply');
    if (applyMapping(table)) {
      showToast(`${TABLE_CONFIGS[table]?.title || 'Table'} header mapping applied.`);
      openMapper();
    }
  }
}

function installHeaderMapper() {
  installStyle();
  const ensure = () => ensureButtonHost();
  const observer = new MutationObserver(ensure);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', handleClick, true);
  ensure();
  return () => {
    observer.disconnect();
    document.removeEventListener('click', handleClick, true);
    document.querySelector('[data-psmap-header-map-dialog]')?.remove();
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyHeaderMapper = installHeaderMapper();
  return () => {
    try { destroyHeaderMapper?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
