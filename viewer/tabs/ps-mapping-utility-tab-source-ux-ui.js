import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-rules-preview-ui.js?v=20260612-psmap-rules-preview-1';
import {
  PS_MAPPING_SAMPLE_TABLE1,
  PS_MAPPING_SAMPLE_TABLE1A,
  PS_MAPPING_SAMPLE_TABLE1B,
  PS_MAPPING_SAMPLE_TABLE1D,
} from './ps-mapping-utility/ps-mapping-sample-data.js';

const STYLE_ID = 'psmap-source-ux-style';

const CANDIDATE_HEADER_RENAMES = new Map([
  ['Near Distance', 'Near Line Diff'],
  ['Eligible', 'Passes Basic Checks'],
  ['Auto Selectable', 'Auto-map Allowed'],
  ['Review Required', 'Needs Review'],
  ['Selected', 'Chosen Mapping'],
  ['Final Status', 'Mapping Status'],
  ['Confidence', 'Confidence Level'],
  ['Confidence Score', 'Confidence /100'],
  ['Score', 'Internal Rank'],
  ['Gap Match', 'Support Gap Match'],
]);

const EXPECTED_HEADERS = {
  table1CText: 'Expected: Line No | Node | PS No | Pipe size | ISONOTE | Mandatory',
  table2Text: 'Expected: PS NO | Bore | pipe | DTXR | Support Gap | Mandatory',
  table1Text: 'Expected: PS No | Node',
  table1AText: 'Expected: Node | Dia',
  table1BText: 'Expected: Node | Line No',
};

const LEGACY_DEFAULTS = {
  table1Text: PS_MAPPING_SAMPLE_TABLE1,
  table1AText: PS_MAPPING_SAMPLE_TABLE1A,
  table1BText: PS_MAPPING_SAMPLE_TABLE1B,
  table1DText: PS_MAPPING_SAMPLE_TABLE1D,
};

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-source-primary-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:stretch}.psmap-source-primary-grid .psmap-field textarea{min-height:280px}.psmap-source-hint{font:11px ui-monospace,Consolas,monospace;color:#bae6fd;background:rgba(14,165,233,.08);border:1px solid rgba(56,189,248,.22);border-radius:8px;padding:5px 7px}.psmap-source-label-main{color:#f8fafc!important}.psmap-legacy-source-toggle{display:flex;align-items:center;gap:8px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.75);color:#dbeafe;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}.psmap-legacy-source-wrap{border:1px dashed rgba(148,163,184,.28);border-radius:12px;padding:10px;background:rgba(15,23,42,.35)}.psmap-legacy-source-body{display:none;margin-top:10px;gap:10px}.psmap-legacy-source-wrap.open .psmap-legacy-source-body{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.psmap-retired-note{font-size:12px;color:#fde68a;border:1px solid rgba(251,191,36,.28);background:rgba(120,53,15,.18);border-radius:10px;padding:8px}.psmap-source-ux-note{font-size:12px;color:#cbd5e1}.psmap-table th.psmap-renamed-header{color:#e0f2fe}.psmap-table th.psmap-debug-header{color:#fbbf24}.psmap-gap-sentinel{display:none!important}
@media(max-width:1100px){.psmap-source-primary-grid,.psmap-legacy-source-wrap.open .psmap-legacy-source-body{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function textarea(name) {
  return document.querySelector(`[data-psmap-source="${name}"]`);
}

function fieldFor(name) {
  return textarea(name)?.closest('.psmap-field') || null;
}

function setLabel(name, label) {
  const labelEl = fieldFor(name)?.querySelector('label');
  if (!labelEl) return;
  labelEl.textContent = label;
  labelEl.classList.add('psmap-source-label-main');
}

function ensureHint(name, text) {
  const field = fieldFor(name);
  if (!field || field.querySelector('[data-psmap-source-hint]')) return;
  const hint = document.createElement('div');
  hint.className = 'psmap-source-hint';
  hint.setAttribute('data-psmap-source-hint', '1');
  hint.textContent = text;
  const label = field.querySelector('label');
  if (label?.nextSibling) label.parentNode.insertBefore(hint, label.nextSibling);
  else field.prepend(hint);
}

function dispatchSourceChange(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearLegacyDefaultSamples(panel) {
  if (panel.dataset.psmapLegacyDefaultsCleared === '1') return;
  panel.dataset.psmapLegacyDefaultsCleared = '1';
  for (const [name, sample] of Object.entries(LEGACY_DEFAULTS)) {
    const el = textarea(name);
    if (el && String(el.value || '').trim() === String(sample || '').trim()) {
      el.value = '';
      dispatchSourceChange(el);
    }
  }
}

function moveInto(parent, child) {
  if (parent && child && child.parentNode !== parent) parent.appendChild(child);
}

function patchSourcePanel() {
  const panel = document.querySelector('[data-psmap-panel="source"]');
  if (!panel) return;
  installStyle();
  clearLegacyDefaultSamples(panel);

  setLabel('table1CText', 'Table 1 - Rich Reference / ISONOTE Master');
  setLabel('table2Text', 'Table 2 - Model PS Data');
  setLabel('table1Text', 'Table 1A - PS No / Node (optional legacy)');
  setLabel('table1AText', 'Table 1B - Node / Dia (optional legacy)');
  setLabel('table1BText', 'Table 1C - Node / Line No (optional legacy)');

  for (const [name, hint] of Object.entries(EXPECTED_HEADERS)) ensureHint(name, hint);

  const cardBody = panel.querySelector('.psmap-card-body');
  const rich = fieldFor('table1CText');
  const table2 = fieldFor('table2Text');
  if (cardBody && rich && table2 && !panel.querySelector('[data-psmap-primary-source-grid]')) {
    const grid = document.createElement('div');
    grid.className = 'psmap-source-primary-grid';
    grid.setAttribute('data-psmap-primary-source-grid', '1');
    const banner = cardBody.querySelector('.psmap-banner');
    if (banner?.nextSibling) cardBody.insertBefore(grid, banner.nextSibling);
    else cardBody.prepend(grid);
    moveInto(grid, rich);
    moveInto(grid, table2);
  }

  const optionalFields = ['table1Text', 'table1AText', 'table1BText'].map(fieldFor).filter(Boolean);
  if (cardBody && optionalFields.length && !panel.querySelector('[data-psmap-legacy-source-wrap]')) {
    const wrap = document.createElement('div');
    wrap.className = 'psmap-legacy-source-wrap';
    wrap.setAttribute('data-psmap-legacy-source-wrap', '1');
    wrap.innerHTML = `<button type="button" class="psmap-legacy-source-toggle" data-psmap-legacy-source-toggle><span data-psmap-legacy-caret>▶</span><span>Optional Table 1A / 1B / 1C reference tables</span></button><div class="psmap-source-ux-note">Use these only when Rich Table 1 is not available or needs supplementing. Defaults are intentionally blank.</div><div class="psmap-legacy-source-body" data-psmap-legacy-source-body></div><div class="psmap-retired-note"><b>Table-1D - Master Keyword Searcher is retired.</b> Use Config / Diagnostics → Support Keyword Rules: Pattern → Canonical. Table-1D is hidden and cleared from new sessions.</div>`;
    const primary = panel.querySelector('[data-psmap-primary-source-grid]');
    if (primary?.nextSibling) primary.parentNode.insertBefore(wrap, primary.nextSibling);
    else cardBody.appendChild(wrap);
    const body = wrap.querySelector('[data-psmap-legacy-source-body]');
    for (const field of optionalFields) moveInto(body, field);
  }

  const table1D = fieldFor('table1DText');
  if (table1D) table1D.style.display = 'none';
}

function tableInfo(panelName) {
  const table = document.querySelector(`[data-psmap-panel="${panelName}"] table.psmap-table`);
  if (!table) return null;
  const headerRow = table.querySelector('thead tr.psmap-labels');
  const body = table.querySelector('tbody');
  if (!headerRow || !body) return null;
  return { table, headerRow, body, labels: [...headerRow.children].map((th) => th.textContent.trim()) };
}

function renameHeaders(info) {
  if (!info) return;
  for (const th of info.headerRow.children) {
    if (th.dataset.psmapGapSentinel === '1') continue;
    const old = th.textContent.trim();
    const next = CANDIDATE_HEADER_RENAMES.get(old);
    if (!next) continue;
    th.textContent = next;
    th.classList.add('psmap-renamed-header');
    if (old === 'Score') th.classList.add('psmap-debug-header');
  }
}

function columnIndexes(info, label) {
  return [...info.headerRow.children]
    .map((th, index) => ({ th, index, label: th.textContent.trim() }))
    .filter((entry) => entry.label === label);
}

function removeColumnAt(info, index) {
  info.headerRow.children[index]?.remove();
  for (const row of info.body.querySelectorAll('tr')) row.children[index]?.remove();
}

function dedupeVisibleColumns(info, label) {
  if (!info) return;
  const matches = columnIndexes(info, label).filter((entry) => entry.th.dataset.psmapGapSentinel !== '1');
  for (let i = matches.length - 1; i >= 1; i -= 1) removeColumnAt(info, matches[i].index);
}

function visibleColumnIndex(info, label) {
  return [...info.headerRow.children].findIndex((th) => th.textContent.trim() === label && th.dataset.psmapGapSentinel !== '1');
}

function legacyGapColumnIndex(info) {
  return [...info.headerRow.children].findIndex((th) => th.textContent.trim() === 'Gap Match' && th.dataset.psmapGapSentinel === '1');
}

function ensureLegacyGapSentinel(info) {
  if (!info) return;
  const visible = visibleColumnIndex(info, 'Support Gap Match');
  if (visible < 0) return;
  let sentinel = legacyGapColumnIndex(info);
  if (sentinel < 0) {
    const th = document.createElement('th');
    th.textContent = 'Gap Match';
    th.dataset.psmapGapSentinel = '1';
    th.className = 'psmap-gap-sentinel';
    info.headerRow.appendChild(th);
    for (const row of info.body.querySelectorAll('tr')) {
      const td = document.createElement('td');
      td.className = 'psmap-gap-sentinel';
      td.textContent = row.children[visible]?.textContent || '';
      row.appendChild(td);
    }
    sentinel = legacyGapColumnIndex(info);
  }

  if (sentinel >= 0) {
    for (const row of info.body.querySelectorAll('tr')) {
      const visibleCell = row.children[visible];
      const sentinelCell = row.children[sentinel];
      if (!visibleCell || !sentinelCell) continue;
      if (sentinelCell.textContent && sentinelCell.textContent !== visibleCell.textContent) {
        visibleCell.textContent = sentinelCell.textContent;
      } else if (visibleCell.textContent && !sentinelCell.textContent) {
        sentinelCell.textContent = visibleCell.textContent;
      }
      sentinelCell.classList.add('psmap-gap-sentinel');
    }
  }
}

function moveColumnAfter(info, columnLabel, afterLabel) {
  if (!info) return;
  const labels = [...info.headerRow.children].map((th) => th.textContent.trim());
  const from = labels.findIndex((label, index) => label === columnLabel && info.headerRow.children[index]?.dataset.psmapGapSentinel !== '1');
  const to = labels.indexOf(afterLabel);
  if (from < 0 || to < 0 || from === to + 1) return;
  const header = info.headerRow.children[from];
  info.headerRow.children[to].after(header);
  for (const row of info.body.querySelectorAll('tr')) {
    const cell = row.children[from];
    const target = row.children[to];
    if (cell && target) target.after(cell);
  }
}

function normalizeGapColumns(info) {
  if (!info) return;
  dedupeVisibleColumns(info, 'Support Gap Match');
  moveColumnAfter(info, 'Support Gap Match', 'Support Match');
  ensureLegacyGapSentinel(info);
}

function patchCandidateMatrix() {
  const candidate = tableInfo('candidates');
  renameHeaders(candidate);
  normalizeGapColumns(candidate);
  const validator = tableInfo('validator');
  renameHeaders(validator);
  normalizeGapColumns(validator);
}

function onClick(event) {
  const button = event.target?.closest?.('[data-psmap-legacy-source-toggle]');
  if (!button) return;
  const wrap = button.closest('[data-psmap-legacy-source-wrap]');
  wrap?.classList.toggle('open');
  const caret = wrap?.querySelector('[data-psmap-legacy-caret]');
  if (caret) caret.textContent = wrap.classList.contains('open') ? '▼' : '▶';
}

function installSourceUxPatch() {
  installStyle();
  const patch = () => { patchSourcePanel(); patchCandidateMatrix(); };
  const runPatch = (() => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; patch(); });
    };
  })();
  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', onClick, true);
  runPatch();
  return () => {
    observer.disconnect();
    document.removeEventListener('click', onClick, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyUx = installSourceUxPatch();
  return () => {
    try { destroyUx?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
