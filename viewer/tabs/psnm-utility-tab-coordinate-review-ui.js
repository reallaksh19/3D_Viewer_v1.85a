import { renderPSNM_UtilityTab as renderCoordinateOccurrencePSNMUtilityTab } from './psnm-utility-tab-coordinate-occurrence-ui.js?v=20260615-coordinate-occurrence-phase-b-1';

const STYLE_ID = 'psnm-coordinate-playground-phase-c-style';
const STORAGE_PREFIX = 'psnm.coordinatePlayground.';

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

function parsePsPosition(value) {
  const source = text(value);
  const e = source.match(/\bE\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const s = source.match(/\bS\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const u = source.match(/\bU\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  if (e && s && u) return { e: Number(e[1]), u: Number(u[1]), s: Number(s[1]), ok: true };
  const nums = source.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (nums.length >= 3) return { e: nums[0], s: nums[1], u: nums[2], ok: true };
  return { e: NaN, u: NaN, s: NaN, ok: false };
}

function parseXyz(value) {
  const source = text(value);
  const x = source.match(/\bX\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const y = source.match(/\bY\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const z = source.match(/\bZ\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  if (x && y && z) return { x: Number(x[1]), y: Number(y[1]), z: Number(z[1]), ok: true };
  const nums = source.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (nums.length >= 3) return { x: nums[0], y: nums[1], z: nums[2], ok: true };
  return { x: NaN, y: NaN, z: NaN, ok: false };
}

function fmt(value, decimals = 3) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '-';
}

function triple(value, fallback) {
  const nums = text(value).split(',').map((part) => Number(part.trim()));
  if (nums.length === 3 && nums.every(Number.isFinite)) return { e: nums[0], u: nums[1], s: nums[2] };
  return { e: fallback[0], u: fallback[1], s: fallback[2] };
}

function maxAbs(delta) {
  return Math.max(Math.abs(delta.e), Math.abs(delta.u), Math.abs(delta.s));
}

function classify(delta, setup) {
  const epsilon = Math.max(0.01, 0.5 * Math.pow(10, -Math.max(0, setup.decimals || 0)));
  if (Math.abs(delta.e) <= epsilon && Math.abs(delta.u) <= epsilon && Math.abs(delta.s) <= epsilon) return 'EXACT';
  for (const [label, tol] of [['APPROX_1', setup.approx1], ['APPROX_2', setup.approx2], ['APPROX_3', setup.approx3]]) {
    if (Math.abs(delta.e) <= tol.e && Math.abs(delta.u) <= tol.u && Math.abs(delta.s) <= tol.s) return label;
  }
  return 'NO_MATCH';
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-phase-c-card{border:1px solid rgba(52,211,153,.26);background:rgba(6,78,59,.16);border-radius:12px;padding:10px;display:grid;gap:10px}
.psnm-phase-c-title{color:#a7f3d0;font-weight:900}.psnm-phase-c-grid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:10px}.psnm-phase-c-grid-3{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}
.psnm-phase-c-result{border:1px solid rgba(148,163,184,.24);background:#0b1220;border-radius:10px;padding:10px;font:12px ui-monospace,Consolas,monospace;color:#d9e6f7;line-height:1.5;white-space:pre-wrap}
.psnm-phase-c-queue{border:1px solid rgba(251,191,36,.32);background:rgba(113,63,18,.18);border-radius:10px;padding:10px;margin-bottom:10px;color:#fde68a;font-size:12px;line-height:1.45}
.psnm-phase-c-queue table{width:100%;border-collapse:collapse;margin-top:8px}.psnm-phase-c-queue th,.psnm-phase-c-queue td{border-bottom:1px solid rgba(251,191,36,.18);padding:6px;text-align:left;vertical-align:top}.psnm-phase-c-queue th{color:#facc15}.psnm-phase-c-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
@media(max-width:900px){.psnm-phase-c-grid,.psnm-phase-c-grid-3{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

function fieldHtml(label, key, value, placeholder = '') {
  return `<div class="psnm-field"><label>${escapeHtml(label)}</label><input data-psnm-playground="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;
}

function stored(key, fallback = '') {
  try { return localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? fallback; } catch { return fallback; }
}

function store(key, value) {
  try { localStorage.setItem(`${STORAGE_PREFIX}${key}`, value); } catch {}
}

function setupValue(container, key) {
  return text(container.querySelector(`[data-setup="${key}"]`)?.value);
}

function readonlyValueByLabel(panel, labelText) {
  const fields = Array.from(panel?.querySelectorAll?.('.psnm-field') || []);
  const field = fields.find((candidate) => text(candidate.querySelector('label')?.textContent).toLowerCase() === labelText.toLowerCase());
  return text(field?.querySelector('input,textarea,select')?.value);
}

function currentSetupSnapshot(container) {
  const panel = container.querySelector('[data-psnm-panel="setup"]');
  return {
    anchorPs: readonlyValueByLabel(panel, 'Anchor PS Position'),
    anchorNode: readonlyValueByLabel(panel, 'Anchor Node X,Y,Z'),
    decimals: Number(setupValue(container, 'coordinateDecimals')) || 0,
    approx1: setupValue(container, 'approx1') || '25,25,25',
    approx2: setupValue(container, 'approx2') || '50,25,50',
    approx3: setupValue(container, 'approx3') || '50,25,50',
  };
}

function playgroundValues(card, container) {
  const read = (key) => text(card.querySelector(`[data-psnm-playground="${key}"]`)?.value);
  const setup = currentSetupSnapshot(container);
  return {
    testPs: read('testPs'),
    testNode: read('testNode'),
    anchorPs: read('anchorPs') || setup.anchorPs,
    anchorNode: read('anchorNode') || setup.anchorNode,
    decimals: Number(read('decimals') || setup.decimals) || 0,
    approx1: triple(read('approx1') || setup.approx1, [25, 25, 25]),
    approx2: triple(read('approx2') || setup.approx2, [50, 25, 50]),
    approx3: triple(read('approx3') || setup.approx3, [50, 25, 50]),
  };
}

function renderPlaygroundResult(card, container) {
  const out = card.querySelector('[data-psnm-playground-result]');
  if (!out) return;
  const values = playgroundValues(card, container);
  const testPs = parsePsPosition(values.testPs);
  const testNode = parseXyz(values.testNode);
  const anchorPs = parsePsPosition(values.anchorPs);
  const anchorNode = parseXyz(values.anchorNode);
  const setup = { decimals: values.decimals, approx1: values.approx1, approx2: values.approx2, approx3: values.approx3 };

  if (!testPs.ok || !testNode.ok || !anchorPs.ok || !anchorNode.ok) {
    out.textContent = 'Paste valid values to preview. Accepted PS format: E ... S ... U ... or E,S,U. Accepted Node format: X,Y,Z or X=... Y=... Z=...';
    return;
  }

  const datum = {
    e: anchorPs.e - anchorNode.x,
    u: anchorPs.u - anchorNode.y,
    s: anchorPs.s - anchorNode.z,
  };
  const transformed = {
    e: testNode.x + datum.e,
    u: testNode.y + datum.u,
    s: testNode.z + datum.s,
  };
  const delta = {
    e: transformed.e - testPs.e,
    u: transformed.u - testPs.u,
    s: transformed.s - testPs.s,
  };
  const cls = classify(delta, setup);
  const euclid = Math.sqrt(delta.e ** 2 + delta.u ** 2 + delta.s ** 2);
  out.textContent = [
    `Datum from anchor: dE=${fmt(datum.e)} dU=${fmt(datum.u)} dS=${fmt(datum.s)}`,
    `Transformed test Node -> E=${fmt(transformed.e)} U=${fmt(transformed.u)} S=${fmt(transformed.s)}`,
    `Test PS coordinate       E=${fmt(testPs.e)} U=${fmt(testPs.u)} S=${fmt(testPs.s)}`,
    `Delta                   dE=${fmt(delta.e)} dU=${fmt(delta.u)} dS=${fmt(delta.s)}`,
    `Max axis delta          ${fmt(maxAbs(delta))} mm`,
    `3D delta                ${fmt(euclid)} mm`,
    `Coordinate class        ${cls}`,
  ].join('\n');
}

function ensurePlayground(container) {
  const panel = container.querySelector('[data-psnm-panel="setup"]');
  const body = panel?.querySelector('.psnm-card-body');
  if (!body || body.querySelector('[data-psnm-coordinate-playground="phase-c"]')) return;
  const setup = currentSetupSnapshot(container);
  const card = document.createElement('div');
  card.className = 'psnm-phase-c-card';
  card.dataset.psnmCoordinatePlayground = 'phase-c';
  card.innerHTML = `
<div class="psnm-phase-c-title">Coordinate Transform Playground</div>
<div class="psnm-banner">Preview how a Node XYZ value is transformed into PS E/U/S space before matching. This is a sandbox only; it does not change match results.</div>
<div class="psnm-phase-c-grid">
  ${fieldHtml('Test PS Position', 'testPs', stored('testPs', setup.anchorPs), 'E 604665.151 S 1092727 U 607.15')}
  ${fieldHtml('Test Node X,Y,Z', 'testNode', stored('testNode', setup.anchorNode), '-699514.875, 3024.352, -115566')}
  ${fieldHtml('Anchor PS Position', 'anchorPs', stored('anchorPs', setup.anchorPs), 'E ... S ... U ...')}
  ${fieldHtml('Anchor Node X,Y,Z', 'anchorNode', stored('anchorNode', setup.anchorNode), 'X,Y,Z')}
</div>
<div class="psnm-phase-c-grid-3">
  ${fieldHtml('Exact Decimals', 'decimals', stored('decimals', String(setup.decimals)), '0')}
  ${fieldHtml('Approx 1 dE,dU,dS', 'approx1', stored('approx1', setup.approx1), '25,25,25')}
  ${fieldHtml('Approx 2 dE,dU,dS', 'approx2', stored('approx2', setup.approx2), '50,25,50')}
  ${fieldHtml('Approx 3 dE,dU,dS', 'approx3', stored('approx3', setup.approx3), '50,25,50')}
</div>
<div class="psnm-phase-c-actions"><button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-c-action="useCurrentAnchor">Use current anchor values</button><button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-c-action="useAnchorAsTest">Use anchor as test pair</button></div>
<div class="psnm-phase-c-result" data-psnm-playground-result></div>`;
  body.appendChild(card);
  renderPlaygroundResult(card, container);
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

function reviewRows(container) {
  const rows = [];
  const warnings = Array.from(container.querySelectorAll('.psnm-coordinate-warning')).map((el) => text(el.textContent)).filter(Boolean);
  warnings.forEach((warning, index) => rows.push({ category: 'Coordinate duplicate', item: `Warning ${index + 1}`, reason: warning, action: 'Manual review: confirm duplicate coordinate intent before accepting match.' }));

  const matchTable = Array.from(container.querySelectorAll('[data-psnm-panel="match"] table.psnm-table'))[0];
  tableData(matchTable).forEach((row) => {
    const joined = `${row['Final Status']} ${row['Match Type']} ${row['Bore']} ${row['Decision Basis']}`;
    if (/USER_REVIEW_REQUIRED|AMBIGUOUS|UNMAPPED|NO_MATCH|CONFLICT/i.test(joined)) {
      rows.push({
        category: 'Match result',
        item: `${row['PS Name'] || '-'} -> ${row.Node || '-'}`,
        reason: text(joined),
        action: /AMBIGUOUS|USER_REVIEW_REQUIRED/i.test(joined) ? 'Manual review: choose occurrence or tighten coordinate/bore tolerance.' : 'Review source/master coordinates, bore mode, and tolerance buckets.',
      });
    }
  });

  Array.from(container.querySelectorAll('[data-psnm-panel="coverage"] table.psnm-table')).forEach((table, tableIndex) => {
    tableData(table).forEach((row) => {
      const status = row.status || row.Status || '';
      const severity = row.severity || row.Severity || '';
      const action = row.action || row.Action || '';
      if (/MISS|UNMATCH|REVIEW|WARN|ERROR|CONFLICT|FAIL/i.test(`${status} ${severity} ${action}`)) {
        rows.push({
          category: tableIndex === 0 ? 'Mandatory PS coverage' : 'Mandatory Node coverage',
          item: row.psName || row.node || row.matchedPs || row.matchedNode || '-',
          reason: `${status} ${severity}`.trim() || action || 'Coverage exception',
          action: action || 'Manual review: resolve mandatory coverage exception.',
        });
      }
    });
  });
  return rows;
}

function ensureReviewQueue(container) {
  const panel = container.querySelector('[data-psnm-panel="coverage"]');
  const body = panel?.querySelector('.psnm-card-body');
  if (!body) return;
  body.querySelector('[data-psnm-review-queue="phase-c"]')?.remove();
  const rows = reviewRows(container);
  const div = document.createElement('div');
  div.className = 'psnm-phase-c-queue';
  div.dataset.psnmReviewQueue = 'phase-c';
  if (!rows.length) {
    div.innerHTML = '<b>Manual Review Queue:</b> No coordinate duplicates, ambiguous matches, or mandatory coverage exceptions currently visible.';
  } else {
    div.innerHTML = `<div class="psnm-phase-c-actions"><b>Manual Review Queue:</b><span>${rows.length} item(s)</span><button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-phase-c-action="copyReviewQueue">Copy Queue CSV</button></div><table><thead><tr><th>Category</th><th>Item</th><th>Reason</th><th>Suggested Action</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.reason)}</td><td>${escapeHtml(row.action)}</td></tr>`).join('')}</tbody></table>`;
  }
  body.insertBefore(div, body.firstChild);
}

function updatePlayground(container) {
  const card = container.querySelector('[data-psnm-coordinate-playground="phase-c"]');
  if (!card) return;
  card.querySelectorAll('[data-psnm-playground]').forEach((input) => store(input.dataset.psnmPlayground, input.value));
  renderPlaygroundResult(card, container);
}

function syncCurrentAnchor(container) {
  const card = container.querySelector('[data-psnm-coordinate-playground="phase-c"]');
  if (!card) return;
  const setup = currentSetupSnapshot(container);
  const set = (key, value) => {
    const input = card.querySelector(`[data-psnm-playground="${key}"]`);
    if (input) input.value = value || '';
  };
  set('anchorPs', setup.anchorPs);
  set('anchorNode', setup.anchorNode);
  set('decimals', String(setup.decimals));
  set('approx1', setup.approx1);
  set('approx2', setup.approx2);
  set('approx3', setup.approx3);
  updatePlayground(container);
}

function useAnchorAsTest(container) {
  const card = container.querySelector('[data-psnm-coordinate-playground="phase-c"]');
  if (!card) return;
  const anchorPs = text(card.querySelector('[data-psnm-playground="anchorPs"]')?.value);
  const anchorNode = text(card.querySelector('[data-psnm-playground="anchorNode"]')?.value);
  const set = (key, value) => {
    const input = card.querySelector(`[data-psnm-playground="${key}"]`);
    if (input) input.value = value || '';
  };
  set('testPs', anchorPs);
  set('testNode', anchorNode);
  updatePlayground(container);
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function copyReviewQueue(container, ctx) {
  const rows = reviewRows(container);
  const csv = ['Category,Item,Reason,Suggested Action', ...rows.map((row) => [row.category, row.item, row.reason, row.action].map(csvEscape).join(','))].join('\n');
  try {
    await navigator.clipboard.writeText(csv);
    ctx.showToast?.('Manual review queue copied.', 'success');
  } catch (error) {
    ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error');
  }
}

function enhance(container) {
  ensurePlayground(container);
  ensureReviewQueue(container);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const destroyBase = renderCoordinateOccurrencePSNMUtilityTab(container, ctx);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => enhance(container), 0);
  };
  const onInput = (event) => {
    if (event.target?.closest?.('[data-psnm-playground]')) updatePlayground(container);
  };
  const onClick = (event) => {
    const action = event.target?.closest?.('[data-psnm-phase-c-action]')?.dataset?.psnmPhaseCAction;
    if (!action) return;
    if (action === 'useCurrentAnchor') syncCurrentAnchor(container);
    if (action === 'useAnchorAsTest') useAnchorAsTest(container);
    if (action === 'copyReviewQueue') void copyReviewQueue(container, ctx);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('input', onInput, true);
  container.addEventListener('click', onClick, true);
  schedule();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    container.removeEventListener('input', onInput, true);
    container.removeEventListener('click', onClick, true);
    destroyBase?.();
  };
}

export default renderPSNM_UtilityTab;
