import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-candidate-detail-ui.js?v=20260612-psmap-optional-unmatched-config-1';
import {
  DEFAULT_OPTIONS,
  runPsMappingResolver,
} from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260612-table1-source-ledger-audit-1';

const STYLE_ID = 'psmap-tally-ui-style';
const TALLY_ROW_ID_TOGGLE_KEY = 'psmap.tally.showRowIds';

const BASE_TALLY_COLUMNS = [
  ['section', 'Section'],
  ['sourceTotal', 'Source'],
  ['matched', 'Matched'],
  ['mandatoryUnmatched', 'Mandatory Unmatched'],
  ['optionalUnmatched', 'Optional Unmatched'],
  ['formula', 'Check Formula'],
  ['check', 'Check'],
  ['action', 'Action'],
];

const BASE_ROW_ID_COLUMNS = [
  ['matchedRows', 'Matched Rows'],
  ['mandatoryUnmatchedRows', 'Mandatory Unmatched Rows'],
  ['optionalUnmatchedRows', 'Optional Unmatched Rows'],
];

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .psmap-tally-panel{display:grid;gap:10px;}
    .psmap-tally-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;}
    .psmap-tally-toggle{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--psmap-muted,#9fb3c8);}
    .psmap-tally-note{font-size:12px;color:var(--psmap-muted,#9fb3c8);}
    .psmap-tally-table{width:100%;border-collapse:collapse;font-size:12px;}
    .psmap-tally-table th,.psmap-tally-table td{border:1px solid rgba(148,163,184,.25);padding:6px 8px;vertical-align:top;text-align:left;}
    .psmap-tally-table th{background:rgba(15,23,42,.65);color:#dbeafe;position:sticky;top:0;}
    .psmap-tally-ok{color:#86efac;font-weight:700;}
    .psmap-tally-review{color:#fde68a;font-weight:700;}
  `;
  document.head.appendChild(style);
}

function boolStorage(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === '1' || raw === 'true';
  } catch { return fallback; }
}

function setBoolStorage(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function dynamicRowIdColumns(rows = []) {
  const discovered = [];
  const seen = new Set(BASE_ROW_ID_COLUMNS.map(([key]) => key));
  const prefixes = [
    ['matchedRows', 'Matched Rows'],
    ['mandatoryUnmatchedRows', 'Mandatory Unmatched Rows'],
    ['optionalUnmatchedRows', 'Optional Unmatched Rows'],
  ];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      for (const [prefix, label] of prefixes) {
        const match = key.match(new RegExp(`^${prefix}(\\d+)$`));
        if (!match || seen.has(key)) continue;
        seen.add(key);
        discovered.push([key, `${label}.${match[1]}`]);
      }
    }
  }
  discovered.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  return [...BASE_ROW_ID_COLUMNS, ...discovered];
}

function tallyColumns(rows = [], showRowIds = false) {
  if (!showRowIds) return BASE_TALLY_COLUMNS;
  return [...BASE_TALLY_COLUMNS, ...dynamicRowIdColumns(rows)];
}

function rowsToCsvLocal(rows = [], columns = []) {
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.map(([, label]) => esc(label)).join(','), ...rows.map((row) => columns.map(([key]) => esc(row?.[key])).join(','))].join('\n');
}

function renderTally(container, rows = []) {
  ensureStyle();
  const showRowIds = boolStorage(TALLY_ROW_ID_TOGGLE_KEY, false);
  const columns = tallyColumns(rows, showRowIds);
  const table = rows.length
    ? `<table class="psmap-tally-table"><thead><tr>${columns.map(([, label]) => `<th>${html(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td class="${key === 'check' && String(row?.[key]).toUpperCase() === 'OK' ? 'psmap-tally-ok' : key === 'check' ? 'psmap-tally-review' : ''}">${html(row?.[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<div class="psmap-tally-note">Run Mapping first to generate tally rows.</div>';
  container.innerHTML = `<section class="psmap-card"><div class="psmap-card-head"><b>Tally Log</b><div class="psmap-actions"><label class="psmap-tally-toggle"><input type="checkbox" data-psmap-tally-rowids ${showRowIds ? 'checked' : ''}> Show matched / unmatched row IDs</label><button type="button" class="psmap-btn secondary" data-psmap-tally-copy>Copy Tally</button></div></div><div class="psmap-card-body psmap-tally-panel">
    <div class="psmap-banner">Tally equation: <b>Matched + Mandatory Unmatched + Optional Unmatched = Source</b>. Calculated from normalized source rows/source IDs, not Candidate Matrix row count.</div>
    ${table}
  </div></section>`;
  const checkbox = container.querySelector('[data-psmap-tally-rowids]');
  checkbox?.addEventListener('change', () => {
    setBoolStorage(TALLY_ROW_ID_TOGGLE_KEY, checkbox.checked === true);
    renderTally(container, rows);
  });
  container.querySelector('[data-psmap-tally-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(rowsToCsvLocal(rows, tallyColumns(rows, boolStorage(TALLY_ROW_ID_TOGGLE_KEY, false)))); } catch {}
  });
}

function sourceValue(modal, key) {
  const field = modal?.querySelector?.(`[data-psmap-source="${key}"]`);
  return field?.value || '';
}

function collectInputFromModal(modal) {
  return {
    table1PsNodeText: sourceValue(modal, 'table1Text'),
    table1aNodeDiaText: sourceValue(modal, 'table1AText'),
    table1bNodeLineText: sourceValue(modal, 'table1BText'),
    table1cNodeIsonoteText: sourceValue(modal, 'table1CText'),
    table1dKeywordText: sourceValue(modal, 'table1DText'),
    table2ModelText: sourceValue(modal, 'table2Text'),
  };
}

function parseOptionsFromModal(modal) {
  const options = { ...DEFAULT_OPTIONS };
  for (const input of modal.querySelectorAll('[data-psmap-setup]')) {
    const key = input.dataset.psmapSetup;
    if (!key) continue;
    options[key] = input.type === 'checkbox' ? input.checked : input.value;
  }
  return options;
}

function activateTallyPanel(modal, panel, tab) {
  const tabbar = modal.querySelector('.psmap-tabs');
  const body = modal.querySelector('.psmap-body');
  if (!tabbar || !body) return;
  for (const button of tabbar.querySelectorAll('.psmap-tab')) button.classList.remove('active');
  tab.classList.add('active');
  for (const node of body.querySelectorAll(':scope > .psmap-panel')) node.classList.remove('active');
  panel.classList.add('active');
  const result = runPsMappingResolver({ ...collectInputFromModal(modal), options: parseOptionsFromModal(modal) });
  renderTally(panel, result.tallyRows || []);
}

function ensureTallyTab(modal) {
  const tabbar = modal?.querySelector?.('.psmap-tabs');
  const body = modal?.querySelector?.('.psmap-body');
  if (!modal || !tabbar || !body) return;
  if (modal.querySelector('[data-psmap-tally-tab]')) return;

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.textContent = 'Tally Log';
  tab.dataset.psmapTallyTab = '1';
  tab.className = 'psmap-tab';

  const panel = document.createElement('section');
  panel.dataset.psmapTallyPanel = '1';
  panel.className = 'psmap-panel';

  const candidateTab = tabbar.querySelector('[data-psmap-tab="candidates"]');
  if (candidateTab?.nextSibling) tabbar.insertBefore(tab, candidateTab.nextSibling);
  else tabbar.appendChild(tab);

  const candidatePanel = body.querySelector('[data-psmap-panel="candidates"]');
  if (candidatePanel?.nextSibling) body.insertBefore(panel, candidatePanel.nextSibling);
  else body.appendChild(panel);

  tab.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    activateTallyPanel(modal, panel, tab);
  });
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const clickHandler = () => setTimeout(() => {
    const modal = document.querySelector('[data-psmap-modal]');
    ensureTallyTab(modal);
  }, 0);
  container.addEventListener('click', clickHandler);
  setTimeout(() => {
    const modal = document.querySelector('[data-psmap-modal]');
    ensureTallyTab(modal);
  }, 0);
  return () => {
    container.removeEventListener('click', clickHandler);
    if (typeof destroyBase === 'function') destroyBase();
  };
}
