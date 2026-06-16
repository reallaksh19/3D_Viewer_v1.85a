import { renderPSNM_UtilityTab as renderCoordinateReviewPSNMUtilityTab } from './psnm-utility-tab-coordinate-review-ui.js?v=20260615-coordinate-review-phase-c-1';

const STYLE_ID = 'psnm-coordinate-audit-phase-d-style';
const STORAGE_KEY = 'psnm.manualOverrides.v1';

function text(value) {
  return String(value ?? '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function loadOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOverrides(rows) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch {}
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-phase-d-card{border:1px solid rgba(96,165,250,.32);background:rgba(30,64,175,.16);border-radius:12px;padding:10px;margin-bottom:10px;color:#dbeafe;font-size:12px;line-height:1.45}
.psnm-phase-d-title{font-weight:900;color:#bfdbfe;margin-bottom:6px}.psnm-phase-d-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:8px;align-items:end}.psnm-phase-d-field label{display:block;font-size:11px;color:#bfdbfe;margin-bottom:3px}.psnm-phase-d-field input,.psnm-phase-d-field select{width:100%;box-sizing:border-box;background:#0b1220;color:#e5eefb;border:1px solid rgba(148,163,184,.28);border-radius:8px;padding:7px}
.psnm-phase-d-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.psnm-phase-d-table{width:100%;border-collapse:collapse;margin-top:8px}.psnm-phase-d-table th,.psnm-phase-d-table td{border-bottom:1px solid rgba(96,165,250,.2);padding:6px;text-align:left;vertical-align:top}.psnm-phase-d-table th{color:#93c5fd}.psnm-phase-d-note{color:#bfdbfe;font-size:11px;margin-top:6px}
@media(max-width:900px){.psnm-phase-d-grid{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function tableData(table) {
  const headers = Array.from(table?.querySelectorAll?.('thead th') || []).map((th) => text(th.textContent));
  return Array.from(table?.querySelectorAll?.('tbody tr') || []).map((row) => {
    const cells = Array.from(row.children).map((cell) => text(cell.textContent));
    const item = {};
    headers.forEach((header, index) => { item[header] = cells[index] || ''; });
    return item;
  });
}

function readField(card, key) {
  return text(card.querySelector(`[data-psnm-phase-d-field="${key}"]`)?.value);
}

function overrideRowsHtml(rows) {
  if (!rows.length) return '<div class="psnm-phase-d-note">No saved manual overrides yet.</div>';
  return `<table class="psnm-phase-d-table"><thead><tr><th>Decision</th><th>PS Occurrence / PS</th><th>Node / Occurrence</th><th>Note</th><th>Saved</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.decision)}</td><td>${escapeHtml(row.ps)}</td><td>${escapeHtml(row.node)}</td><td>${escapeHtml(row.note)}</td><td>${escapeHtml(row.createdAt)}</td></tr>`).join('')}</tbody></table>`;
}

function renderOverrides(card) {
  const host = card.querySelector('[data-psnm-phase-d-overrides]');
  if (host) host.innerHTML = overrideRowsHtml(loadOverrides());
}

function ensureAuditCard(container) {
  const panel = container.querySelector('[data-psnm-panel="coverage"]');
  const body = panel?.querySelector('.psnm-card-body');
  if (!body || body.querySelector('[data-psnm-audit-card="phase-d"]')) return;

  const card = document.createElement('div');
  card.className = 'psnm-phase-d-card';
  card.dataset.psnmAuditCard = 'phase-d';
  card.innerHTML = `
<div class="psnm-phase-d-title">Manual Override + Audit Export</div>
<div class="psnm-banner">Overrides are stored locally as an audit layer only. They do not mutate Source, Master, or Match results. Export the override/audit CSV to apply or review externally.</div>
<div class="psnm-phase-d-grid">
  <div class="psnm-phase-d-field"><label>Decision</label><select data-psnm-phase-d-field="decision"><option value="ACCEPT_MATCH">Accept match</option><option value="REJECT_MATCH">Reject match</option><option value="FORCE_MATCH">Force PS → Node</option><option value="NOT_REQUIRED">Mark not required</option></select></div>
  <div class="psnm-phase-d-field"><label>PS Occurrence / PS Name</label><input data-psnm-phase-d-field="ps" placeholder="PS-12156#001 or PS-12156"></div>
  <div class="psnm-phase-d-field"><label>Node / Occurrence</label><input data-psnm-phase-d-field="node" placeholder="20300#001 or 20300"></div>
  <div class="psnm-phase-d-field"><label>Note</label><input data-psnm-phase-d-field="note" placeholder="Reason / reviewer note"></div>
</div>
<div class="psnm-phase-d-actions">
  <button class="psnm-btn psnm-btn-primary" type="button" data-psnm-phase-d-action="addOverride">Add Override</button>
  <button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-d-action="copyOverrides">Copy Overrides CSV</button>
  <button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-d-action="copyAudit">Copy Full Audit CSV</button>
  <button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-d-action="clearOverrides">Clear Overrides</button>
</div>
<div data-psnm-phase-d-overrides></div>`;
  body.insertBefore(card, body.firstChild);
  renderOverrides(card);
}

function collectReviewQueue(container) {
  const table = container.querySelector('[data-psnm-review-queue="phase-c"] table');
  return tableData(table).map((row) => ({
    recordType: 'REVIEW_QUEUE',
    category: row.Category || '',
    ps: row.Item || '',
    node: '',
    status: row.Reason || '',
    action: row['Suggested Action'] || '',
    note: '',
    createdAt: '',
  }));
}

function collectMatchResults(container) {
  const table = container.querySelector('[data-psnm-panel="match"] table.psnm-table');
  return tableData(table).map((row) => ({
    recordType: 'MATCH_RESULT',
    category: row['Match Type'] || '',
    ps: row['PS Name'] || '',
    node: [row.Node, row.Occurrence].filter(Boolean).join(' / '),
    status: row['Final Status'] || '',
    action: row['Decision Basis'] || row.Bore || '',
    note: `dE=${row.dE || ''}; dU=${row.dU || ''}; dS=${row.dS || ''}; Max d=${row['Max d'] || ''}`,
    createdAt: '',
  }));
}

function collectOverrideAuditRows() {
  return loadOverrides().map((row) => ({
    recordType: 'MANUAL_OVERRIDE',
    category: row.decision,
    ps: row.ps,
    node: row.node,
    status: row.decision,
    action: row.decision,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

function rowsToCsv(rows) {
  const headers = ['recordType', 'category', 'ps', 'node', 'status', 'action', 'note', 'createdAt'];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
}

async function copyText(value, ctx, okMessage) {
  try {
    await navigator.clipboard.writeText(value);
    ctx.showToast?.(okMessage, 'success');
  } catch (error) {
    ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error');
  }
}

function addOverride(container, ctx) {
  const card = container.querySelector('[data-psnm-audit-card="phase-d"]');
  if (!card) return;
  const decision = readField(card, 'decision') || 'ACCEPT_MATCH';
  const ps = readField(card, 'ps');
  const node = readField(card, 'node');
  const note = readField(card, 'note');
  if (!ps && !node) {
    ctx.showToast?.('Enter a PS occurrence/name or node before adding an override.', 'warning');
    return;
  }
  const rows = loadOverrides();
  rows.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, decision, ps, node, note, createdAt: nowIso() });
  saveOverrides(rows);
  renderOverrides(card);
  ['ps', 'node', 'note'].forEach((key) => { const input = card.querySelector(`[data-psnm-phase-d-field="${key}"]`); if (input) input.value = ''; });
  ctx.showToast?.('Manual override saved locally.', 'success');
}

function copyOverrides(ctx) {
  void copyText(rowsToCsv(collectOverrideAuditRows()), ctx, 'Manual overrides copied.');
}

function copyAudit(container, ctx) {
  const rows = [
    ...collectMatchResults(container),
    ...collectReviewQueue(container),
    ...collectOverrideAuditRows(),
  ];
  void copyText(rowsToCsv(rows), ctx, 'PSNM audit CSV copied.');
}

function clearOverrides(container, ctx) {
  saveOverrides([]);
  const card = container.querySelector('[data-psnm-audit-card="phase-d"]');
  if (card) renderOverrides(card);
  ctx.showToast?.('Manual overrides cleared.', 'success');
}

function enhance(container) {
  ensureAuditCard(container);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const destroyBase = renderCoordinateReviewPSNMUtilityTab(container, ctx);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => enhance(container), 0);
  };
  const onClick = (event) => {
    const action = event.target?.closest?.('[data-psnm-phase-d-action]')?.dataset?.psnmPhaseDAction;
    if (!action) return;
    if (action === 'addOverride') addOverride(container, ctx);
    if (action === 'copyOverrides') copyOverrides(ctx);
    if (action === 'copyAudit') copyAudit(container, ctx);
    if (action === 'clearOverrides') clearOverrides(container, ctx);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', onClick, true);
  schedule();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    container.removeEventListener('click', onClick, true);
    destroyBase?.();
  };
}

export default renderPSNM_UtilityTab;
