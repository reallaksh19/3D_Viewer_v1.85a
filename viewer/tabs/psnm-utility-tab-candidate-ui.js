import { renderPSNM_UtilityTab as renderBasePSNM } from './psnm-utility-tab-phase1-ui.js?v=20260612-psnm-phase1-source-preflight-1';
import {
  PSNM_buildMatchTable,
  PSNM_createRunLogger,
  PSNM_deriveTransformFromAnchor,
} from './psnm-utility/psnm-match-engine.js';
import { PSNM_resolveMasterPsTable } from './psnm-utility/psnm-master-resolver.js';
import {
  PSNM_applyMasterNodeTransform,
  PSNM_resolveMasterNodeTable,
} from './psnm-utility/psnm-master-node-resolver.js';
import {
  PSNM_masterMandatoryNodeRows,
  PSNM_masterNodeToMatchRows,
  PSNM_masterPsToMatchRows,
} from './psnm-utility/psnm-master-adapter.js';

const DETAIL_STORAGE_KEY = 'psnm.showCandidateDiagnosticColumns';

const VISIBLE_COLUMNS = [
  ['psName', 'PS Name'],
  ['candidateNode', 'Candidate Node'],
  ['node', 'Node'],
  ['occurrenceId', 'Node Occurrence'],
  ['coordMatchType', 'Coordinate Match'],
  ['matchType', 'Match Class'],
  ['decision', 'Candidate Decision'],
  ['boreStatus', 'Bore Check'],
  ['psBore', 'PS Bore'],
  ['nodeBoreMm', 'Node Bore'],
  ['nodeBoreSource', 'Node Bore Source'],
  ['dxMm', 'ΔE mm'],
  ['dyMm', 'ΔU mm'],
  ['dzMm', 'ΔS mm'],
  ['maxAxisDeltaMm', 'Max Axis Δ mm'],
  ['reason', 'Reason / Action'],
];

const DETAIL_COLUMNS = [
  ['psRowIndex', 'PS Row Index'],
  ['nodeRowIndex', 'Node Row Index'],
  ['psE', 'PS E'],
  ['psU', 'PS U'],
  ['psS', 'PS S'],
  ['nodeE', 'Node E'],
  ['nodeU', 'Node U'],
  ['nodeS', 'Node S'],
  ['euclideanDeltaMm', '3D Delta mm'],
  ['mandatoryPairRank', 'Mandatory Rank'],
  ['boreRank', 'Bore Rank'],
  ['terminalRank', 'Terminal Rank'],
  ['finalStatus', 'Final Status'],
  ['isMandatoryPs', 'PS Mandatory'],
  ['isMandatoryNode', 'Node Mandatory'],
  ['sourceTable', 'Source Table'],
  ['sourceRow', 'Source Row'],
];

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function objectRowsCsv(rows) {
  if (!rows?.length) return '';
  const keys = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  return [keys.map(csv).join(','), ...rows.map((row) => keys.map((key) => csv(row?.[key])).join(','))].join('\n');
}

async function copyText(text, ctx) {
  try {
    await navigator.clipboard.writeText(String(text || ''));
    ctx.showToast?.('Copied CSV.', 'success');
  } catch (error) {
    ctx.showToast?.(`Copy failed: ${error?.message || error}`, 'error');
  }
}

function num(value, decimals = 3) {
  const x = Number(value);
  return Number.isFinite(x) ? x.toFixed(decimals) : (value ?? '');
}

function triple(value, fallback) {
  const p = String(value || '').split(',').map((x) => Number(x.trim()));
  return p.length === 3 && p.every(Number.isFinite)
    ? { xMm: p[0], yMm: p[1], zMm: p[2] }
    : { xMm: fallback[0], yMm: fallback[1], zMm: fallback[2] };
}

function ensureStyle() {
  if (document.getElementById('psnm-candidate-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'psnm-candidate-ui-style';
  style.textContent = `
.psnm-candidate-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.psnm-candidate-tools label{font-size:12px;color:#b7c9dd;font-weight:800;display:flex;gap:6px;align-items:center}
.psnm-candidate-note{font-size:12px;color:#9fb2c7;line-height:1.45}
.psnm-candidate-hidden{display:none!important}
`;
  document.head.appendChild(style);
}

function getText(modal, key) {
  return modal.querySelector(`textarea[data-source="${key}"]`)?.value || '';
}

function getSetup(modal) {
  const get = (key, fallback = '') => modal.querySelector(`[data-setup="${key}"]`)?.value ?? fallback;
  return {
    anchorPsRowId: get('anchorPsRowId', ''),
    anchorNodeRowId: get('anchorNodeRowId', ''),
    coordinateDecimals: Number(get('coordinateDecimals', 0)) || 0,
    boreMode: get('boreMode', 'prefer'),
    approx1: get('approx1', '25,25,25'),
    approx2: get('approx2', '50,25,50'),
    approx3: get('approx3', '50,25,50'),
    enableApprox1: modal.querySelector('[data-setup="enableApprox1"]')?.checked ?? true,
    enableApprox2: modal.querySelector('[data-setup="enableApprox2"]')?.checked ?? true,
    enableApprox3: modal.querySelector('[data-setup="enableApprox3"]')?.checked ?? true,
  };
}

function selectAnchor(psRows, nodeRows, setup) {
  const psCandidates = psRows.filter((row) => row.enabled !== false && row.status === 'OK' && row.positionRaw);
  const nodeCandidates = nodeRows.filter((row) => row.enabled !== false && row.status !== 'MISSING_FROM_TABLE2' && row.status !== 'INVALID_COORDINATE' && Number.isFinite(row.rawX) && Number.isFinite(row.rawY) && Number.isFinite(row.rawZ));
  const ps = psCandidates.find((row) => row.rowId === setup.anchorPsRowId) || psCandidates[0];
  const node = nodeCandidates.find((row) => row.rowId === setup.anchorNodeRowId) || nodeCandidates[0];
  if (!ps || !node) throw new Error('Build Master Tables and select a valid anchor before Candidate Matrix can be generated.');
  return { psName: ps.psName, psPosition: ps.positionRaw, node: node.node, nodePosition: `${node.rawX}, ${node.rawY}, ${node.rawZ}` };
}

function computeCandidates(modal) {
  const logger = PSNM_createRunLogger();
  const setup = getSetup(modal);
  const ps = PSNM_resolveMasterPsTable({
    table1Text: getText(modal, 'table1Text'),
    table4AText: getText(modal, 'table4AText'),
    logger,
  });
  const node = PSNM_resolveMasterNodeTable({
    table2Text: getText(modal, 'table2Text'),
    table3Text: getText(modal, 'table3Text'),
    table4BText: getText(modal, 'table4BText'),
    logger,
  });
  const anchor = selectAnchor(ps.rows, node.rows, setup);
  const transform = PSNM_deriveTransformFromAnchor(anchor);
  PSNM_applyMasterNodeTransform(node.rows, transform, setup.coordinateDecimals);
  const result = PSNM_buildMatchTable({
    logger,
    anchor,
    psRows: PSNM_masterPsToMatchRows(ps.rows),
    nodeRows: PSNM_masterNodeToMatchRows(node.rows),
    nodeDiaRows: [],
    mandatoryNodeRows: PSNM_masterMandatoryNodeRows(node.rows),
    boreMode: setup.boreMode,
    coordinateDecimals: setup.coordinateDecimals,
    enableApprox1: setup.enableApprox1,
    enableApprox2: setup.enableApprox2,
    enableApprox3: setup.enableApprox3,
    approx1: triple(setup.approx1, [25, 25, 25]),
    approx2: triple(setup.approx2, [50, 25, 50]),
    approx3: triple(setup.approx3, [50, 25, 50]),
  });
  return result.candidateRows || [];
}

function rowValue(row, key) {
  const value = row?.[key];
  if (typeof value === 'number') return num(value);
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  return value ?? '';
}

function renderTable(rows, showDetails) {
  if (!rows.length) return '<div class="psnm-banner">No candidate rows yet. Run Match after resolving master tables.</div>';
  const columns = showDetails ? [...VISIBLE_COLUMNS, ...DETAIL_COLUMNS] : VISIBLE_COLUMNS;
  return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr>${columns.map(([, label]) => `<th>${h(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${h(rowValue(row, key))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function candidatePanelHtml(rows, showDetails) {
  return `<section class="psnm-panel" data-psnm-panel="candidate"><section class="psnm-card"><div class="psnm-card-head"><b>Candidate Matrix</b><div class="psnm-actions"><button class="psnm-btn psnm-btn-secondary" data-psnm-candidate-copy="1">Copy CSV</button></div></div><div class="psnm-card-body"><div class="psnm-candidate-tools"><label><input type="checkbox" data-psnm-candidate-detail ${showDetails ? 'checked' : ''}> Show detail diagnostic columns</label></div><div class="psnm-candidate-note">Candidate Matrix is generated from the same Master PS / Master Node resolver and match engine. Detail columns are hidden by default.</div><div data-psnm-candidate-table>${renderTable(rows, showDetails)}</div></div></section></section>`;
}

function injectCandidateUi(container, state) {
  const modal = container.querySelector('[data-psnm="modal"]');
  if (!modal) return;
  const tabs = modal.querySelector('.psnm-tabs');
  const body = modal.querySelector('.psnm-body');
  if (!tabs || !body) return;
  if (!tabs.querySelector('[data-psnm-candidate-tab]')) {
    const button = document.createElement('button');
    button.className = 'psnm-tab-btn';
    button.type = 'button';
    button.dataset.psnmCandidateTab = '1';
    button.textContent = '5. Candidate Matrix';
    const coverageTab = Array.from(tabs.querySelectorAll('[data-psnm-tab]')).find((btn) => /coverage/i.test(btn.textContent || ''));
    tabs.insertBefore(button, coverageTab || null);
  }
  let panel = body.querySelector('[data-psnm-panel="candidate"]');
  if (!panel) {
    body.insertAdjacentHTML('beforeend', candidatePanelHtml(state.rows, state.showDetails));
  } else {
    const tableHost = panel.querySelector('[data-psnm-candidate-table]');
    if (tableHost) tableHost.innerHTML = renderTable(state.rows, state.showDetails);
    const toggle = panel.querySelector('[data-psnm-candidate-detail]');
    if (toggle) toggle.checked = state.showDetails;
  }
}

function activateCandidateTab(container) {
  const modal = container.querySelector('[data-psnm="modal"]');
  if (!modal) return;
  modal.querySelectorAll('.psnm-tab-btn').forEach((btn) => btn.classList.remove('active'));
  modal.querySelector('[data-psnm-candidate-tab]')?.classList.add('active');
  modal.querySelectorAll('.psnm-panel').forEach((panel) => panel.classList.remove('active'));
  modal.querySelector('[data-psnm-panel="candidate"]')?.classList.add('active');
}

function scheduleCandidateBuild(container, state) {
  window.setTimeout(() => {
    try {
      const modal = container.querySelector('[data-psnm="modal"]');
      if (!modal) return;
      state.rows = computeCandidates(modal);
      injectCandidateUi(container, state);
    } catch (error) {
      state.rows = [];
      injectCandidateUi(container, state);
      console.warn('[PSNM] Candidate Matrix could not be generated:', error);
    }
  }, 120);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const state = {
    rows: [],
    showDetails: localStorage.getItem(DETAIL_STORAGE_KEY) === '1',
  };
  const destroyBase = renderBasePSNM(container, ctx);
  const observer = new MutationObserver(() => injectCandidateUi(container, state));
  observer.observe(container, { childList: true, subtree: true });
  injectCandidateUi(container, state);

  function onClick(event) {
    if (event.target?.closest?.('[data-psnm-action="runMatch"]')) {
      scheduleCandidateBuild(container, state);
      return;
    }
    if (event.target?.closest?.('[data-psnm-candidate-tab]')) {
      injectCandidateUi(container, state);
      activateCandidateTab(container);
      return;
    }
    if (event.target?.closest?.('[data-psnm-candidate-copy]')) {
      void copyText(objectRowsCsv(state.rows), ctx);
    }
  }

  function onChange(event) {
    const toggle = event.target?.closest?.('[data-psnm-candidate-detail]');
    if (!toggle) return;
    state.showDetails = toggle.checked === true;
    localStorage.setItem(DETAIL_STORAGE_KEY, state.showDetails ? '1' : '0');
    injectCandidateUi(container, state);
    activateCandidateTab(container);
  }

  container.addEventListener('click', onClick, true);
  container.addEventListener('change', onChange, true);
  return () => {
    observer.disconnect();
    container.removeEventListener('click', onClick, true);
    container.removeEventListener('change', onChange, true);
    destroyBase?.();
  };
}
