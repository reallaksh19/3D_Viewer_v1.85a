const STYLE_ID = 'psnm-auto-anchor-style';
const MAX_ANCHOR_BUCKETS = 80;
const MAX_TABLE_ROWS = 500;

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function num(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function fmt(value, decimals = 3) {
  if (value == null || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : '-';
}

function splitLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
}

function splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function norm(value) {
  return String(value || '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePsPosition(text) {
  const src = String(text || '').replace(/,/g, ' ');
  const out = { e: NaN, u: NaN, s: NaN };
  for (const match of src.matchAll(/\b([EWSNUD])\s*(-?\d+(?:\.\d+)?)\s*(?:mm)?\b/gi)) {
    const axis = match[1].toUpperCase();
    const value = Number(match[2]);
    if (axis === 'E') out.e = value;
    else if (axis === 'W') out.e = -value;
    else if (axis === 'S') out.s = value;
    else if (axis === 'N') out.s = -value;
    else if (axis === 'U') out.u = value;
    else if (axis === 'D') out.u = -value;
  }
  return out;
}

function validCoord3(row, a, b, c) {
  return Number.isFinite(row[a]) && Number.isFinite(row[b]) && Number.isFinite(row[c]);
}

function parsePsRows(text) {
  const lines = splitLines(text).slice(0, MAX_TABLE_ROWS + 1);
  if (!lines.length) return [];
  const first = splitCells(lines[0]);
  const headers = first.map(norm);
  const hasHeader = headers.some((x) => ['ps name', 'ps', 'ps no', 'ps number', 'position', 'p1bore', 'bore'].includes(x));
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const idxName = idx(['ps name', 'ps', 'ps no', 'ps number', 'psname']);
  const idxPosition = idx(['position', 'ps position', 'coordinate']);
  const idxBore = idx(['p1bore', 'bore', 'nb', 'dn', 'bore mm', 'bore(mm)']);
  const data = hasHeader ? lines.slice(1) : lines;
  const rows = [];
  for (const [i, line] of data.entries()) {
    const cells = splitCells(line);
    const full = cells.join(' ');
    const psName = hasHeader ? String(cells[idxName] ?? '').trim() : (full.match(/\bPS[-_/A-Z0-9.]+(?:\/DATUM)?\b/i)?.[0] || '').trim();
    const positionText = hasHeader && idxPosition >= 0 ? String(cells[idxPosition] || '') : full;
    const coord = parsePsPosition(positionText);
    const bore = hasHeader && idxBore >= 0 ? num(cells[idxBore]) : num(cells[cells.length - 1]);
    if (!psName || !validCoord3(coord, 'e', 'u', 's')) continue;
    rows.push({ psName: psName.replace(/\.$/, ''), e: coord.e, u: coord.u, s: coord.s, bore: Number.isFinite(bore) ? bore : null, rowIndex: i + 1 });
  }
  return rows;
}

function parseTable2Rows(text) {
  const lines = splitLines(text).slice(0, MAX_TABLE_ROWS + 1);
  if (!lines.length) return [];
  const first = splitCells(lines[0]);
  const headers = first.map(norm);
  const hasHeader = headers.some((x) => ['node', 'node no', 'node number', 'x', 'raw x', 'y', 'raw y', 'z', 'raw z', 'position'].includes(x));
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const idxNode = idx(['node', 'node no', 'node number']);
  const idxX = idx(['x', 'raw x', 'node x', 'coord x']);
  const idxY = idx(['y', 'raw y', 'node y', 'coord y']);
  const idxZ = idx(['z', 'raw z', 'node z', 'coord z']);
  const idxBore = idx(['bore', 'nb', 'dn', 'nominal bore', 'bore mm', 'bore(mm)']);
  const data = hasHeader ? lines.slice(1) : lines;
  const rows = [];
  const counts = new Map();
  for (const [i, line] of data.entries()) {
    const cells = splitCells(line);
    const node = String(hasHeader ? (cells[idxNode] ?? cells[0]) : cells[0] ?? '').trim();
    const x = hasHeader && idxX >= 0 ? num(cells[idxX]) : num(cells[1]);
    const y = hasHeader && idxY >= 0 ? num(cells[idxY]) : num(cells[2]);
    const z = hasHeader && idxZ >= 0 ? num(cells[idxZ]) : num(cells[3]);
    const bore = hasHeader && idxBore >= 0 ? num(cells[idxBore]) : num(cells[4]);
    if (!node || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const occurrence = (counts.get(node) || 0) + 1;
    counts.set(node, occurrence);
    rows.push({ node, occurrenceId: `${node}#${String(occurrence).padStart(3, '0')}`, x, y, z, bore: Number.isFinite(bore) ? bore : null, rowIndex: i + 1 });
  }
  return rows;
}

function toleranceFromInput(root, key, fallback) {
  const value = root.querySelector(`[data-setup="${key}"]`)?.value || '';
  const parts = value.split(',').map((part) => Number(part.trim()));
  return parts.length === 3 && parts.every(Number.isFinite) ? { e: parts[0], u: parts[1], s: parts[2] } : fallback;
}

function tolerances(root) {
  return {
    exact: { e: 0.01, u: 0.01, s: 0.01 },
    a1: toleranceFromInput(root, 'approx1', { e: 25, u: 25, s: 25 }),
    a2: toleranceFromInput(root, 'approx2', { e: 100, u: 50, s: 100 }),
    a3: toleranceFromInput(root, 'approx3', { e: 500, u: 100, s: 500 }),
  };
}

function classify(delta, tol) {
  const ae = Math.abs(delta.de);
  const au = Math.abs(delta.du);
  const as = Math.abs(delta.ds);
  if (ae <= tol.exact.e && au <= tol.exact.u && as <= tol.exact.s) return 'EXACT';
  if (ae <= tol.a1.e && au <= tol.a1.u && as <= tol.a1.s) return 'APPROX_1';
  if (ae <= tol.a2.e && au <= tol.a2.u && as <= tol.a2.s) return 'APPROX_2';
  if (ae <= tol.a3.e && au <= tol.a3.u && as <= tol.a3.s) return 'APPROX_3';
  return 'NO_MATCH';
}

function rankType(type) {
  if (type === 'EXACT') return 0;
  if (type === 'APPROX_1') return 1;
  if (type === 'APPROX_2') return 2;
  if (type === 'APPROX_3') return 3;
  return 99;
}

function nodeToPs(node, datum) {
  return { e: node.x + datum.e, u: node.y + datum.u, s: node.z + datum.s };
}

function deltaPs(ps, nodePs) {
  const de = nodePs.e - ps.e;
  const du = nodePs.u - ps.u;
  const ds = nodePs.s - ps.s;
  return { de, du, ds, maxAbs: Math.max(Math.abs(de), Math.abs(du), Math.abs(ds)), euclid: Math.sqrt(de * de + du * du + ds * ds) };
}

function compatibleBore(ps, node) {
  if (ps.bore == null || node.bore == null) return true;
  return Math.abs(Number(ps.bore) - Number(node.bore)) <= 1e-6;
}

function makeDatum(ps, node) {
  return { e: ps.e - node.x, u: ps.u - node.y, s: ps.s - node.z };
}

function bucketKey(datum, tol) {
  const be = Math.max(10, tol.a3.e || 50);
  const bu = Math.max(10, tol.a3.u || 25);
  const bs = Math.max(10, tol.a3.s || 50);
  return `${Math.round(datum.e / be)}|${Math.round(datum.u / bu)}|${Math.round(datum.s / bs)}`;
}

function candidateAnchorBuckets(psRows, nodeRows, tol) {
  const buckets = new Map();
  for (const ps of psRows) {
    for (const node of nodeRows) {
      if (!compatibleBore(ps, node)) continue;
      const datum = makeDatum(ps, node);
      const key = bucketKey(datum, tol);
      const bucket = buckets.get(key) || { key, count: 0, ps, node, datum };
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count).slice(0, MAX_ANCHOR_BUCKETS);
}

function scoreAnchor(anchor, psRows, nodeRows, tol) {
  const datum = anchor.datum;
  const used = new Set();
  const perPs = [];
  let exact = 0;
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  let borePass = 0;
  let boreMissing = 0;
  let sumMax = 0;
  let worst = 0;
  for (const ps of psRows) {
    let best = null;
    for (const node of nodeRows) {
      if (used.has(node.occurrenceId)) continue;
      const np = nodeToPs(node, datum);
      const delta = deltaPs(ps, np);
      const type = classify(delta, tol);
      const boreOk = compatibleBore(ps, node);
      const candidate = { ps, node, nodePs: np, delta, type, boreOk };
      if (!best || rankType(candidate.type) < rankType(best.type) || (rankType(candidate.type) === rankType(best.type) && candidate.delta.maxAbs < best.delta.maxAbs)) best = candidate;
    }
    if (!best) continue;
    if (best.type !== 'NO_MATCH' && best.boreOk) {
      used.add(best.node.occurrenceId);
      if (best.type === 'EXACT') exact += 1;
      else if (best.type === 'APPROX_1') a1 += 1;
      else if (best.type === 'APPROX_2') a2 += 1;
      else if (best.type === 'APPROX_3') a3 += 1;
      if (best.ps.bore != null && best.node.bore != null) borePass += 1;
      else boreMissing += 1;
      sumMax += best.delta.maxAbs;
      worst = Math.max(worst, best.delta.maxAbs);
    }
    perPs.push(best);
  }
  const totalMatches = exact + a1 + a2 + a3;
  const avgMax = totalMatches ? sumMax / totalMatches : Number.POSITIVE_INFINITY;
  const score = exact * 100000 + a1 * 50000 + a2 * 20000 + a3 * 10000 + borePass * 5000 + boreMissing * 500 - worst * 2 - avgMax;
  return { ...anchor, exact, a1, a2, a3, totalMatches, borePass, boreMissing, avgMax, worst, score, perPs };
}

function currentData(root) {
  return {
    psRows: parsePsRows(root.querySelector('[data-source="table1Text"]')?.value || ''),
    nodeRows: parseTable2Rows(root.querySelector('[data-source="table2Text"]')?.value || ''),
    tol: tolerances(root),
  };
}

function runAutoAnchor(root) {
  const { psRows, nodeRows, tol } = currentData(root);
  const panel = ensureAutoPanel(root);
  if (!psRows.length || !nodeRows.length) {
    panel.innerHTML = '<div class="psnm-auto-note">Auto Anchor requires valid Table 1 PS rows and Table 2 Node/X/Y/Z rows.</div>';
    return [];
  }
  const anchors = candidateAnchorBuckets(psRows, nodeRows, tol).map((anchor) => scoreAnchor(anchor, psRows, nodeRows, tol)).sort((a, b) => b.score - a.score || b.totalMatches - a.totalMatches || a.avgMax - b.avgMax).slice(0, 20);
  renderAutoResults(root, anchors);
  return anchors;
}

function optionText(option) {
  return String(option?.textContent || '').replace(/\s+/g, ' ').trim();
}

function applyAnchor(root, anchor) {
  const psSelect = root.querySelector('select[data-setup="anchorPsRowId"]');
  const nodeSelect = root.querySelector('select[data-setup="anchorNodeRowId"]');
  const psOption = Array.from(psSelect?.options || []).find((option) => option.value && optionText(option).includes(anchor.ps.psName));
  const nodeOption = Array.from(nodeSelect?.options || []).find((option) => option.value && optionText(option).startsWith(anchor.node.node));
  if (psSelect && psOption) {
    psSelect.value = psOption.value;
    psSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (nodeSelect && nodeOption) {
    nodeSelect.value = nodeOption.value;
    nodeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  scheduleEnhance(80);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-auto-note{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psnm-auto-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-auto-table th,.psnm-auto-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap}.psnm-auto-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psnm-auto-scroll{overflow:auto;max-height:360px}.psnm-auto-actions{display:flex;gap:8px;flex-wrap:wrap}.psnm-auto-small{font-size:11px;color:#9fb2c7}`;
  document.head.appendChild(style);
}

function modal() {
  return document.querySelector('[data-psnm="modal"]');
}

function setupPanel(root) {
  return root?.querySelector('[data-psnm-panel="setup"]') || null;
}

function matchPanel(root) {
  return root?.querySelector('[data-psnm-panel="match"]') || null;
}

function ensureSetupControls(root) {
  const panel = setupPanel(root);
  if (!panel || panel.querySelector('[data-psnm-auto-anchor-controls]')) return;
  const card = document.createElement('section');
  card.className = 'psnm-card';
  card.dataset.psnmAutoAnchorControls = '1';
  card.innerHTML = `<div class="psnm-card-head"><b>Auto Anchor</b><div class="psnm-auto-actions"><button class="psnm-btn" type="button" data-psnm-auto-anchor="run">Auto Anchor</button></div></div><div class="psnm-card-body"><div class="psnm-auto-note">Searches candidate PS↔Node anchor datums and ranks the anchors that produce the most Exact/Approx matches. This does not run matching until you click Use Anchor and then Run Match.</div><div data-psnm-auto-anchor-panel></div></div>`;
  panel.appendChild(card);
}

function ensureAutoPanel(root) {
  ensureSetupControls(root);
  return root.querySelector('[data-psnm-auto-anchor-panel]');
}

function renderAutoResults(root, anchors) {
  const panel = ensureAutoPanel(root);
  if (!anchors.length) {
    panel.innerHTML = '<div class="psnm-auto-note">No viable anchor candidates found. Check source parsing and bore filters.</div>';
    return;
  }
  panel.__psnmAutoAnchors = anchors;
  panel.innerHTML = `<div class="psnm-auto-scroll"><table class="psnm-auto-table"><thead><tr><th>Use</th><th>Rank</th><th>Anchor PS</th><th>Anchor Node</th><th>Matches</th><th>Exact</th><th>A1</th><th>A2</th><th>A3</th><th>Avg Max Δ</th><th>Worst Δ</th><th>datumE</th><th>datumU</th><th>datumS</th><th>Score</th></tr></thead><tbody>${anchors.map((a, i) => `<tr><td><button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-auto-anchor-use="${i}">Use Anchor</button></td><td>${i + 1}</td><td>${h(a.ps.psName)}</td><td>${h(a.node.node)} <span class="psnm-auto-small">${h(a.node.occurrenceId)}</span></td><td>${a.totalMatches}</td><td>${a.exact}</td><td>${a.a1}</td><td>${a.a2}</td><td>${a.a3}</td><td>${fmt(a.avgMax)}</td><td>${fmt(a.worst)}</td><td>${fmt(a.datum.e)}</td><td>${fmt(a.datum.u)}</td><td>${fmt(a.datum.s)}</td><td>${Math.round(a.score)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderNearestRca(root) {
  const panel = matchPanel(root);
  if (!panel) return;
  let rca = panel.querySelector('[data-psnm-nearest-rca]');
  if (!rca) {
    rca = document.createElement('section');
    rca.className = 'psnm-card';
    rca.dataset.psnmNearestRca = '1';
    panel.appendChild(rca);
  }
  const { psRows, nodeRows, tol } = currentData(root);
  const psSelect = root.querySelector('select[data-setup="anchorPsRowId"]');
  const nodeSelect = root.querySelector('select[data-setup="anchorNodeRowId"]');
  const psLabel = optionText(psSelect?.selectedOptions?.[0]);
  const nodeLabel = optionText(nodeSelect?.selectedOptions?.[0]);
  const anchorPs = psRows.find((row) => psLabel.includes(row.psName));
  const anchorNode = nodeRows.find((row) => nodeLabel.startsWith(row.node));
  if (!anchorPs || !anchorNode) {
    rca.innerHTML = '<div class="psnm-card-head"><b>Nearest Candidate / Approx RCA</b></div><div class="psnm-card-body"><div class="psnm-auto-note">Select an explicit anchor to calculate nearest rejected candidates and true signed deltas.</div></div>';
    return;
  }
  const datum = makeDatum(anchorPs, anchorNode);
  const rows = psRows.map((ps) => {
    let best = null;
    for (const node of nodeRows) {
      const np = nodeToPs(node, datum);
      const delta = deltaPs(ps, np);
      const type = classify(delta, tol);
      const candidate = { ps, node, np, delta, type };
      if (!best || rankType(type) < rankType(best.type) || (rankType(type) === rankType(best.type) && delta.maxAbs < best.delta.maxAbs)) best = candidate;
    }
    return best;
  }).filter(Boolean).slice(0, 100);
  rca.innerHTML = `<div class="psnm-card-head"><b>Nearest Candidate / Approx RCA</b></div><div class="psnm-card-body"><div class="psnm-auto-note">Shows nearest candidate under the selected anchor. Signed deltas are Node transformed minus PS. Approx kicks in only if all axis magnitudes fit the configured tolerance.</div><div class="psnm-auto-scroll"><table class="psnm-auto-table"><thead><tr><th>PS</th><th>Nearest Node</th><th>Type</th><th>Signed ΔE</th><th>Signed ΔU</th><th>Signed ΔS</th><th>Abs Max Δ</th><th>Node E</th><th>Node U</th><th>Node S</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${h(r.ps.psName)}</td><td>${h(r.node.node)} <span class="psnm-auto-small">${h(r.node.occurrenceId)}</span></td><td>${h(r.type)}</td><td>${fmt(r.delta.de)}</td><td>${fmt(r.delta.du)}</td><td>${fmt(r.delta.ds)}</td><td>${fmt(r.delta.maxAbs)}</td><td>${fmt(r.np.e)}</td><td>${fmt(r.np.u)}</td><td>${fmt(r.np.s)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

let enhanceTimer = null;
function scheduleEnhance(delay = 120) {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(() => {
    const root = modal();
    if (!root) return;
    installStyle();
    ensureSetupControls(root);
    renderNearestRca(root);
  }, delay);
}

document.addEventListener('click', (event) => {
  const run = event.target.closest?.('[data-psnm-auto-anchor="run"]');
  if (run) {
    const root = modal();
    if (root) runAutoAnchor(root);
    return;
  }
  const use = event.target.closest?.('[data-psnm-auto-anchor-use]');
  if (use) {
    const root = modal();
    const anchors = root?.querySelector('[data-psnm-auto-anchor-panel]')?.__psnmAutoAnchors || [];
    const anchor = anchors[Number(use.dataset.psnmAutoAnchorUse)];
    if (root && anchor) applyAnchor(root, anchor);
    return;
  }
  if (event.target.closest?.('[data-psnm-action="open"], [data-psnm-tab="setup"], [data-psnm-tab="match"], [data-psnm-action="resolveMasters"], [data-psnm-action="runMatch"]')) {
    scheduleEnhance(180);
    setTimeout(() => scheduleEnhance(0), 450);
  }
}, false);

document.addEventListener('change', (event) => {
  if (event.target.closest?.('[data-setup], [data-source]')) scheduleEnhance(160);
}, false);

document.addEventListener('input', (event) => {
  if (event.target.closest?.('[data-setup], [data-source]')) scheduleEnhance(220);
}, false);

installStyle();

export function PSNM_autoAnchorInstalled() {
  return true;
}
