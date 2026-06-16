import { renderPSNM_UtilityTab as renderBasePSNMUtilityTab } from './psnm-utility-tab-v6.js?v=20260612-psnm-axis-engine-1';

const STYLE_ID = 'psnm-coordinate-first-phase-a-style';
const PHASE_A_VERSION = '20260615-coordinate-first-phase-a-1';

function text(value) {
  return String(value ?? '').trim();
}

function cellValue(cell) {
  const field = cell?.querySelector?.('input,select,textarea');
  return text(field ? field.value : cell?.textContent);
}

function parseDisplayedNumber(value) {
  const match = text(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function setupDecimals(container) {
  const raw = container.querySelector('[data-setup="coordinateDecimals"]')?.value;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 3;
  return Math.max(0, Math.min(6, Math.trunc(n)));
}

function coordinateKey(values, decimals) {
  const nums = values.map(parseDisplayedNumber);
  if (!nums.every(Number.isFinite)) return '';
  return nums.map((value) => value.toFixed(decimals)).join('|');
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-coordinate-first-note{border:1px solid rgba(96,165,250,.32);background:rgba(30,64,175,.18);border-radius:10px;padding:9px 10px;color:#dbeafe;font-size:12px;line-height:1.45}
.psnm-coordinate-warning{border:1px solid rgba(251,191,36,.38);background:rgba(113,63,18,.22);border-radius:10px;padding:9px 10px;color:#fde68a;font-size:12px;line-height:1.45;margin-bottom:8px}
.psnm-coordinate-warning b{color:#facc15}.psnm-coordinate-key-cell{font-family:ui-monospace,Consolas,monospace;color:#bfdbfe}
`;
  document.head.appendChild(style);
}

function insertNote(host, id, html, where = 'afterbegin') {
  if (!host || host.querySelector(`[data-psnm-coordinate-note="${id}"]`)) return;
  const note = document.createElement('div');
  note.className = 'psnm-coordinate-first-note';
  note.dataset.psnmCoordinateNote = id;
  note.innerHTML = html;
  host.insertAdjacentElement(where, note);
}

function headerIndexes(table) {
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => text(th.textContent));
  const indexOf = (label) => headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  return { headers, indexOf };
}

function insertColumnAfter(table, afterIndex, label, compute) {
  if (!table || afterIndex < 0) return;
  const { headers } = headerIndexes(table);
  if (headers.includes(label)) return;
  const headerRow = table.querySelector('thead tr');
  const th = document.createElement('th');
  th.textContent = label;
  headerRow?.insertBefore(th, headerRow.children[afterIndex + 1] || null);
  Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
    const td = document.createElement('td');
    td.className = 'psnm-coordinate-key-cell';
    td.textContent = compute(row) || '-';
    row.insertBefore(td, row.children[afterIndex + 1] || null);
  });
}

function collectDuplicates(table, keyLabel, keyIndex, labelIndexes = []) {
  if (!table || keyIndex < 0) return [];
  const groups = new Map();
  Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
    const key = cellValue(row.children[keyIndex]);
    if (!key || key === '-') return;
    const label = labelIndexes.map((idx) => cellValue(row.children[idx])).filter(Boolean).join(' / ') || '(row)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(label);
  });
  return Array.from(groups.entries())
    .filter(([, labels]) => labels.length > 1)
    .map(([key, labels]) => `${keyLabel} ${key}: ${labels.join(', ')}`);
}

function updateDuplicateBanner(table, id, duplicates, action) {
  const wrap = table?.closest?.('.psnm-tablewrap');
  const host = wrap?.parentElement;
  if (!host) return;
  host.querySelector(`[data-psnm-coordinate-warning="${id}"]`)?.remove();
  if (!duplicates.length) return;
  const div = document.createElement('div');
  div.className = 'psnm-coordinate-warning';
  div.dataset.psnmCoordinateWarning = id;
  div.innerHTML = `<b>DUPLICATE_COORDINATE:</b> ${duplicates.length} duplicate coordinate key group(s). ${action}<br>${duplicates.slice(0, 5).map((item) => `• ${item}`).join('<br>')}${duplicates.length > 5 ? '<br>• ...' : ''}`;
  host.insertBefore(div, wrap);
}

function enhanceMasterPsTable(container) {
  const panel = container.querySelector('[data-psnm-panel="master"]');
  const table = Array.from(panel?.querySelectorAll('table.psnm-table') || [])
    .find((candidate) => /PS Name/i.test(candidate.textContent || '') && /Position Raw/i.test(candidate.textContent || ''));
  if (!table) return;
  const decimals = setupDecimals(container);
  let { indexOf } = headerIndexes(table);
  const eIndex = indexOf('PS E');
  const uIndex = indexOf('PS U');
  const sIndex = indexOf('PS S');
  insertColumnAfter(table, sIndex, 'PS Coord Key', (row) => coordinateKey([cellValue(row.children[eIndex]), cellValue(row.children[uIndex]), cellValue(row.children[sIndex])], decimals));
  ({ indexOf } = headerIndexes(table));
  const keyIndex = indexOf('PS Coord Key');
  const psIndex = indexOf('PS Name');
  const duplicates = collectDuplicates(table, 'PS Coord', keyIndex, [psIndex]);
  updateDuplicateBanner(table, 'master-ps-coordinate', duplicates, 'PS Name is only a label; review duplicate PS coordinates before matching.');
}

function enhanceMasterNodeTable(container) {
  const panel = container.querySelector('[data-psnm-panel="master"]');
  const table = Array.from(panel?.querySelectorAll('table.psnm-table') || [])
    .find((candidate) => /Node E/i.test(candidate.textContent || '') && /Node U/i.test(candidate.textContent || '') && /Node S/i.test(candidate.textContent || ''));
  if (!table) return;
  const decimals = setupDecimals(container);
  let { indexOf } = headerIndexes(table);
  const eIndex = indexOf('Node E');
  const uIndex = indexOf('Node U');
  const sIndex = indexOf('Node S');
  insertColumnAfter(table, sIndex, 'Node Coord Key', (row) => coordinateKey([cellValue(row.children[eIndex]), cellValue(row.children[uIndex]), cellValue(row.children[sIndex])], decimals));
  ({ indexOf } = headerIndexes(table));
  const keyIndex = indexOf('Node Coord Key');
  const nodeIndex = indexOf('Node');
  const occIndex = indexOf('Occurrence');
  const duplicates = collectDuplicates(table, 'Node Coord', keyIndex, [nodeIndex, occIndex]);
  updateDuplicateBanner(table, 'master-node-coordinate', duplicates, 'Multiple nodes share the same transformed coordinate; ambiguous matches should be manually reviewed.');
}

function enhanceMatchResultTable(container) {
  const panel = container.querySelector('[data-psnm-panel="match"]');
  const table = Array.from(panel?.querySelectorAll('table.psnm-table') || [])
    .find((candidate) => /Final Status/i.test(candidate.textContent || '') && /Max d/i.test(candidate.textContent || ''));
  if (!table) return;
  const { headers, indexOf } = headerIndexes(table);
  if (headers.includes('Decision Basis')) return;
  const statusIndex = indexOf('Final Status');
  const matchIndex = indexOf('Match Type');
  const boreIndex = indexOf('Bore');
  const maxIndex = indexOf('Max d');
  insertColumnAfter(table, maxIndex, 'Decision Basis', (row) => {
    const status = cellValue(row.children[statusIndex]);
    const match = cellValue(row.children[matchIndex]);
    const bore = cellValue(row.children[boreIndex]);
    const max = cellValue(row.children[maxIndex]);
    if (/USER_REVIEW_REQUIRED|AMBIGUOUS/i.test(`${status} ${match}`)) return 'Manual review: equivalent coordinate-ranked candidates.';
    if (/UNMAPPED|NO_MATCH/i.test(`${status} ${match}`)) return 'No coordinate candidate passed tolerance/bore policy.';
    return `Selected by coordinate class ${match}, bore ${bore}, max Δ ${max} mm.`;
  });
}

function enhanceCandidateMatrix(container) {
  const table = container.querySelector('[data-psnm-panel="candidate"] table.psnm-table');
  if (!table) return;
  const { headers, indexOf } = headerIndexes(table);
  if (!headers.includes('PS E') || !headers.includes('Node E')) return;
  const decimals = setupDecimals(container);
  const psE = indexOf('PS E');
  const psU = indexOf('PS U');
  const psS = indexOf('PS S');
  const nodeE = indexOf('Node E');
  const nodeU = indexOf('Node U');
  const nodeS = indexOf('Node S');
  const sourceAfter = Math.max(psS, nodeS);
  insertColumnAfter(table, sourceAfter, 'PS Coord Key', (row) => coordinateKey([cellValue(row.children[psE]), cellValue(row.children[psU]), cellValue(row.children[psS])], decimals));
  const afterPs = headerIndexes(table).indexOf('PS Coord Key');
  insertColumnAfter(table, afterPs, 'Node Coord Key', (row) => coordinateKey([cellValue(row.children[nodeE]), cellValue(row.children[nodeU]), cellValue(row.children[nodeS])], decimals));
}

function addCoordinateFirstNotes(container) {
  const sourceBody = container.querySelector('[data-psnm-panel="source"] .psnm-card-body');
  insertNote(sourceBody, 'source-coordinate-first', '<b>Coordinate-first PSNM:</b> PS Name and Node are labels. Match identity is transformed coordinate + bore policy + mandatory pairing + ambiguity check.');

  const masterBody = container.querySelector('[data-psnm-panel="master"] .psnm-card-body');
  insertNote(masterBody, 'master-coordinate-first', '<b>Coordinate audit:</b> Coordinate Key columns are diagnostic keys. Duplicate coordinate keys are warnings; they do not auto-change the selected match in Phase A.');

  const setupBody = container.querySelector('[data-psnm-panel="setup"] .psnm-card-body');
  insertNote(setupBody, 'setup-coordinate-first', '<b>Anchor rule:</b> Node XYZ is transformed into PS E/U/S space. Tolerances are then applied to ΔE, ΔU, and ΔS.');
}

function enhance(container) {
  addCoordinateFirstNotes(container);
  enhanceMasterPsTable(container);
  enhanceMasterNodeTable(container);
  enhanceMatchResultTable(container);
  enhanceCandidateMatrix(container);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const destroyBase = renderBasePSNMUtilityTab(container, ctx);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => enhance(container), 0);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', schedule, true);
  container.addEventListener('change', schedule, true);
  container.addEventListener('input', schedule, true);
  schedule();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    container.removeEventListener('click', schedule, true);
    container.removeEventListener('change', schedule, true);
    container.removeEventListener('input', schedule, true);
    destroyBase?.();
  };
}

export default renderPSNM_UtilityTab;
