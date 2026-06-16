import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-tally-ui.js?v=20260612-psmap-compact-tally-ui-1';
import {
  DEFAULT_OPTIONS,
  runPsMappingResolver,
} from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260614-node-restraint-coverage-1';

const STORAGE_KEY = 'psmap.showDetailDiagnosticColumns';
const STYLE_ID = 'psmap-candidate-copy-ui-style';

const BASIC_COLUMNS = [
  ['psnoModel', 'PSNO_Model'],
  ['modelBore', 'T2 Bore'],
  ['lineFamily', 'T2 Line Family'],
  ['supportTypesRequested', 'T2 Keywords'],
  ['candidateNode', 'Candidate Node'],
  ['table1PsNo', 'Table-1 PS No'],
  ['tag', 'Tag'],
  ['source', 'Source'],
  ['nodeLineFamily', 'T1 Line Family'],
  ['pipeSizeRaw', 'Pipe Size'],
  ['derivedDn', 'Derived DN'],
  ['nodeIsonote', 'ISONOTE'],
  ['supportMatch', 'Support Match'],
  ['t1NodeRestraints', 'T1 Node Restraints'],
  ['t2CoveredRestraints', 'T2 Covered Restraints'],
  ['missingNodeRestraints', 'Missing Node Restraints'],
  ['extraTable2Restraints', 'Extra Table-2 Restraints'],
  ['proposedMissingSupportPsNo', 'Proposed Table-2 PS No'],
  ['supportGapMatch', 'Support Gap Match'],
  ['reason', 'Reason'],
  ['psNoWiseAction', 'PS No. Wise Action'],
  ['nodeCoverageNote', 'Node Coverage Note'],
];

const DETAIL_COLUMNS = [
  ['psBasis', 'PS Basis'],
  ['boreBasis', 'Bore Basis'],
  ['lineBasis', 'Line Match'],
  ['supportBasis', 'Support Basis'],
  ['lineRegexBasis', 'T2 Regex Basis'],
  ['nodeLineRegexBasis', 'T1 Regex Basis'],
  ['nearDistance', 'Near Line Diff'],
  ['eligible', 'Passes Basic Checks'],
  ['autoSelectable', 'Auto-map Allowed'],
  ['reviewRequired', 'Needs Review'],
  ['selected', 'Chosen Mapping'],
  ['finalStatus', 'Mapping Status'],
  ['confidence', 'Confidence Level'],
  ['confidenceScore', 'Confidence /100'],
  ['score', 'Internal Rank'],
  ['warnings', 'Warnings'],
  ['reviewAction', 'Review Action'],
  ['consolidatedNodeWiseAction', 'Consolidated Node wise Action'],
  ['table2SourceId', 'Table-2 Source ID'],
  ['modelSourceId', 'Model Source ID'],
];

const PRIMARY_KEYS = new Set([...BASIC_COLUMNS, ...DETAIL_COLUMNS].map(([key]) => key));
const EXPORT_EXCLUDE_KEYS = new Set(['rawColumns']);

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .psmap-candidate-copy-note{font-size:12px;color:#cbd5e1;border:1px solid rgba(148,163,184,.22);border-radius:10px;background:rgba(15,23,42,.62);padding:9px 11px;line-height:1.45;}
    .psmap-candidate-copy-note b{color:#bfdbfe;}
  `;
  document.head.appendChild(style);
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function displayList(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

function readShowDetails() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function writeShowDetails(value) {
  try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch {}
}

function boolLabel(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  const text = String(value ?? '').trim();
  if (/^(true|false)$/i.test(text)) return /^true$/i.test(text) ? 'YES' : 'NO';
  return text;
}

function lineBasisLabel(value) {
  const text = String(value ?? '').trim();
  if (text === 'LINE_EXACT') return 'Full Line Exact';
  if (text === 'LINE_FAMILY') return 'Line Family Exact';
  if (text === 'LINE_FAMILY_NEAR_MISMATCH') return 'Near Line Review';
  if (text === 'LINE_CONFLICT') return 'Line Conflict';
  if (text === 'LINE_MISSING') return 'Line Missing';
  return text;
}

function supportGapValue(row = {}) {
  return row.supportGapMatch || row.gapMatch || row.supportGapBasis || '';
}

function valueFor(row = {}, key) {
  if (key === 'supportGapMatch') return supportGapValue(row);
  if (key === 'lineBasis') return lineBasisLabel(row.lineBasis);
  if (['eligible', 'autoSelectable', 'reviewRequired', 'selected'].includes(key)) return boolLabel(row[key]);
  return displayList(row[key]);
}

function sourceValue(modal, key) {
  return modal?.querySelector?.(`[data-psmap-source="${key}"]`)?.value || '';
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
  for (const input of modal?.querySelectorAll?.('[data-psmap-setup]') || []) {
    const key = input.dataset.psmapSetup;
    if (!key) continue;
    if (input.type === 'checkbox') options[key] = input.checked;
    else if (input.type === 'number') options[key] = Number(input.value);
    else options[key] = input.value;
  }
  return options;
}

function resolveCurrent(modal) {
  return runPsMappingResolver({ ...collectInputFromModal(modal), options: parseOptionsFromModal(modal) });
}

function visibleCandidateColumns(showDetails = readShowDetails()) {
  return showDetails ? [...BASIC_COLUMNS, ...DETAIL_COLUMNS] : BASIC_COLUMNS;
}

function exportCandidateColumns(rows = []) {
  const columns = [...BASIC_COLUMNS, ...DETAIL_COLUMNS];
  const seen = new Set(columns.map(([key]) => key));
  const extra = [];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (seen.has(key) || EXPORT_EXCLUDE_KEYS.has(key)) continue;
      seen.add(key);
      extra.push([key, key]);
    }
  }
  extra.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  return [...columns, ...extra];
}

function rowsToCsv(rows = [], columns = []) {
  return [
    columns.map(([, label]) => csvEscape(label)).join(','),
    ...rows.map((row) => columns.map(([key]) => csvEscape(valueFor(row, key))).join(',')),
  ].join('\n');
}

function candidateTable(rows = [], columns = []) {
  if (!rows.length) return '<div class="psmap-banner">No candidate rows. Run Mapping first.</div>';
  return `<div class="psmap-tablewrap"><table class="psmap-table"><thead><tr class="psmap-labels">${columns.map(([, label]) => `<th>${html(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${html(valueFor(row, key))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderCandidatePanel(panel, result) {
  if (!panel) return;
  ensureStyle();
  const rows = result?.candidates || result?.candidateRows || [];
  const showDetails = readShowDetails();
  const columns = visibleCandidateColumns(showDetails);
  panel.innerHTML = `<section class="psmap-card"><div class="psmap-card-head"><b>Candidate Matrix</b><button class="psmap-btn secondary" data-psmap-action="copyCandidates">Copy Candidates</button></div><div class="psmap-card-body">
    <div class="psmap-candidate-detail-toggle" data-psmap-candidate-detail-toggle="1">
      <label><input type="checkbox" data-psmap-candidate-detail-checkbox ${showDetails ? 'checked' : ''}> <span>Show detail diagnostic columns</span></label>
      <span class="psmap-candidate-detail-help">Default off. Shows internal basis, review flags, score, warnings and source IDs.</span>
    </div>
    <div class="psmap-candidate-copy-note"><b>ⓘ PS No. wise action assumption:</b> Table-1 is treated as the source of truth. Generated actions are Table-2/model correction instructions only. <b>Node restraint coverage:</b> Support Match is row-local; T1 Node Restraints vs T2 Covered Restraints shows whether the combined Table-2 rows cover REST/GUIDE/LINE STOP. Missing support actions use synthetic IDs like PS-XYZ.X1 and never reuse existing .1/.2 Table-2 row numbers. <b>Support gaps are child properties:</b> GUIDE GAP is checked only when GUIDE exists in both Table-1 and Table-2; LINE STOP GAP is checked only when LINE STOP exists in both Table-1 and Table-2.</div>
    ${candidateTable(rows, columns)}
  </div></section>`;
  panel.querySelector('[data-psmap-candidate-detail-checkbox]')?.addEventListener('change', (event) => {
    writeShowDetails(event.target.checked === true);
    renderCandidatePanel(panel, result);
  });
}

function enhanceCandidatePanel() {
  const modal = document.querySelector('[data-psmap-modal]');
  const panel = modal?.querySelector?.('[data-psmap-panel="candidates"]');
  if (!modal || !panel) return;
  try {
    const result = resolveCurrent(modal);
    renderCandidatePanel(panel, result);
  } catch (error) {
    console.warn('[psmap] candidate enhancement failed', error);
  }
}

function scheduleEnhance() {
  requestAnimationFrame(() => setTimeout(enhanceCandidatePanel, 0));
}

async function copyCurrentCandidates(event, ctx = {}) {
  const modal = document.querySelector('[data-psmap-modal]');
  if (!modal) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  try {
    const result = resolveCurrent(modal);
    const rows = result?.candidates || result?.candidateRows || [];
    const csv = rowsToCsv(rows, exportCandidateColumns(rows));
    await navigator.clipboard?.writeText(csv);
    ctx.showToast?.(`Copied ${rows.length} candidate rows with enriched columns.`, 'success');
  } catch (error) {
    ctx.showToast?.(`Copy candidates failed: ${error?.message || error}`, 'error');
  }
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const clickHandler = (event) => {
    const action = event.target?.closest?.('[data-psmap-action]')?.dataset?.psmapAction;
    if (action === 'copyCandidates') {
      copyCurrentCandidates(event, ctx);
      return;
    }
    const tab = event.target?.closest?.('[data-psmap-tab]')?.dataset?.psmapTab;
    if (action === 'run' || action === 'open' || tab === 'candidates') scheduleEnhance();
  };
  document.addEventListener('click', clickHandler, true);
  scheduleEnhance();
  return () => {
    document.removeEventListener('click', clickHandler, true);
    if (typeof destroyBase === 'function') destroyBase();
  };
}
