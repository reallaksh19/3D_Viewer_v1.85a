const STYLE_ID = 'psnm-auto-datum-groups-style';
const MAX_TABLE_ROWS = 700;
const MAX_ANCHOR_BUCKETS = 120;
const MAX_GROUPS = 20;

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

function valid3(row, a, b, c) {
  return Number.isFinite(row[a]) && Number.isFinite(row[b]) && Number.isFinite(row[c]);
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

function parsePsRows(text) {
  const lines = splitLines(text).slice(0, MAX_TABLE_ROWS + 1);
  if (!lines.length) return [];
  const headers = splitCells(lines[0]).map(norm);
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
    if (!psName || !valid3(coord, 'e', 'u', 's')) continue;
    rows.push({ psName: psName.replace(/\.$/, ''), e: coord.e, u: coord.u, s: coord.s, bore: Number.isFinite(bore) ? bore : null, rowIndex: i + 1, id: `${psName.replace(/\.$/, '')}#${i + 1}` });
  }
  return rows;
}

function parseNodeRows(text) {
  const lines = splitLines(text).slice(0, MAX_TABLE_ROWS + 1);
  if (!lines.length) return [];
  const headers = splitCells(lines[0]).map(norm);
  const hasHeader = headers.some((x) => ['node', 'node no', 'node number', 'x', 'raw x', 'y', 'raw y', 'z', 'raw z', 'position'].includes(x));
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const idxNode = idx(['node', 'node no', 'node number']);
  const idxX = idx(['x', 'raw x', 'node x', 'coord x']);
  const idxY = idx(['y', 'raw y', 'node y', 'coord y']);
  const idxZ = idx(['z', 'raw z', 'node z', 'coord z']);
  const idxBore = idx(['bore', 'nb', 'dn', 'nominal bore', 'bore mm', 'bore(mm)']);
  const data = hasHeader ? lines.slice(1) : lines;
  const counts = new Map();
  const rows = [];
  for (const [i, line] of data.entries()) {
    const cells = splitCells(line);
    const node = String(hasHeader ? (cells[idxNode] ?? cells[0]) : (cells[0] ?? '')).trim();
    const x = hasHeader && idxX >= 0 ? num(cells[idxX]) : num(cells[1]);
    const y = hasHeader && idxY >= 0 ? num(cells[idxY]) : num(cells[2]);
    const z = hasHeader && idxZ >= 0 ? num(cells[idxZ]) : num(cells[3]);
    const bore = hasHeader && idxBore >= 0 ? num(cells[idxBore]) : num(cells[4]);
    if (!node || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const count = (counts.get(node) || 0) + 1;
    counts.set(node, count);
    const occurrenceId = `${node}#${String(count).padStart(3, '0')}`;
    rows.push({ node, occurrenceId, x, y, z, bore: Number.isFinite(bore) ? bore : null, rowIndex: i + 1, id: occurrenceId });
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

function compatibleBore(ps, node) {
  if (ps.bore == null || node.bore == null) return true;
  return Math.abs(Number(ps.bore) - Number(node.bore)) <= 1e-6;
}

function makeDatum(ps, node) {
  return { e: ps.e - node.x, u: ps.u - node.y, s: ps.s - node.z };
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

function bucketKey(datum, tol) {
  const be = Math.max(10, tol.a3.e || 50);
  const bu = Math.max(10, tol.a3.u || 25);
  const bs = Math.max(10, tol.a3.s || 50);
  return `${Math.round(datum.e / be)}|${Math.round(datum.u / bu)}|${Math.round(datum.s / bs)}`;
}

function anchorBuckets(psRows, nodeRows, tol) {
  const buckets = new Map();
  for (const ps of psRows) {
    for (const node of nodeRows) {
      if (!compatibleBore(ps, node)) continue;
      const datum = makeDatum(ps, node);
      const key = bucketKey(datum, tol);
      const existing = buckets.get(key) || { key, count: 0, ps, node, datum };
      existing.count += 1;
      buckets.set(key, existing);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count).slice(0, MAX_ANCHOR_BUCKETS);
}

function bestForPs(ps, nodeRows, datum, tol, usedNodes) {
  let best = null;
  for (const node of nodeRows) {
    if (usedNodes?.has(node.id)) continue;
    if (!compatibleBore(ps, node)) continue;
    const nodePs = nodeToPs(node, datum);
    const delta = deltaPs(ps, nodePs);
    const type = classify(delta, tol);
    const candidate = { ps, node, nodePs, delta, type };
    if (!best || rankType(type) < rankType(best.type) || (rankType(type) === rankType(best.type) && delta.maxAbs < best.delta.maxAbs)) best = candidate;
  }
  return best;
}

function scoreAnchor(anchor, psRows, nodeRows, tol) {
  const usedNodes = new Set();
  const accepted = [];
  const rejectedNearest = [];
  let exact = 0;
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  let borePass = 0;
  let boreMissing = 0;
  let sumMax = 0;
  let worst = 0;
  for (const ps of psRows) {
    const best = bestForPs(ps, nodeRows, anchor.datum, tol, usedNodes);
    if (!best) continue;
    if (best.type !== 'NO_MATCH') {
      usedNodes.add(best.node.id);
      accepted.push(best);
      if (best.type === 'EXACT') exact += 1;
      else if (best.type === 'APPROX_1') a1 += 1;
      else if (best.type === 'APPROX_2') a2 += 1;
      else if (best.type === 'APPROX_3') a3 += 1;
      if (best.ps.bore != null && best.node.bore != null) borePass += 1;
      else boreMissing += 1;
      sumMax += best.delta.maxAbs;
      worst = Math.max(worst, best.delta.maxAbs);
    } else {
      rejectedNearest.push(best);
    }
  }
  const totalMatches = accepted.length;
  const avgMax = totalMatches ? sumMax / totalMatches : Number.POSITIVE_INFINITY;
  const score = exact * 100000 + a1 * 50000 + a2 * 20000 + a3 * 10000 + borePass * 5000 + boreMissing * 500 - worst * 2 - avgMax;
  return { ...anchor, exact, a1, a2, a3, borePass, boreMissing, totalMatches, avgMax, worst, score, accepted, rejectedNearest };
}

function currentData(root) {
  return {
    psRows: parsePsRows(root.querySelector('[data-source="table1Text"]')?.value || ''),
    nodeRows: parseNodeRows(root.querySelector('[data-source="table2Text"]')?.value || ''),
    tol: tolerances(root),
  };
}

function chooseBestAnchor(psRows, nodeRows, tol) {
  return anchorBuckets(psRows, nodeRows, tol)
    .map((anchor) => scoreAnchor(anchor, psRows, nodeRows, tol))
    .filter((anchor) => anchor.totalMatches > 0)
    .sort((a, b) => b.score - a.score || b.totalMatches - a.totalMatches || a.avgMax - b.avgMax || a.ps.rowIndex - b.ps.rowIndex || a.node.rowIndex - b.node.rowIndex)[0] || null;
}

function runDatumGroups(root) {
  const { psRows, nodeRows, tol } = currentData(root);
  const panel = ensureGroupsPanel(root);
  if (!psRows.length || !nodeRows.length) {
    panel.innerHTML = '<div class="psnm-adg-note">Auto Datum Groups requires valid Table 1 PS rows and Table 2 Node/X/Y/Z rows.</div>';
    return [];
  }
  let remainingPs = [...psRows];
  let remainingNodes = [...nodeRows];
  const groups = [];
  for (let index = 1; index <= MAX_GROUPS && remainingPs.length && remainingNodes.length; index += 1) {
    const best = chooseBestAnchor(remainingPs, remainingNodes, tol);
    if (!best || best.totalMatches <= 0) break;
    const group = { ...best, groupNo: index, remainingPsBefore: remainingPs.length, remainingNodesBefore: remainingNodes.length };
    groups.push(group);
    const matchedPs = new Set(best.accepted.map((item) => item.ps.id));
    const matchedNodes = new Set(best.accepted.map((item) => item.node.id));
    remainingPs = remainingPs.filter((ps) => !matchedPs.has(ps.id));
    remainingNodes = remainingNodes.filter((node) => !matchedNodes.has(node.id));
  }
  renderGroups(root, groups, { remainingPs, remainingNodes, psRows, nodeRows });
  return groups;
}

function optionText(option) {
  return String(option?.textContent || '').replace(/\s+/g, ' ').trim();
}

function applyGroupAnchor(root, group) {
  const psSelect = root.querySelector('select[data-setup="anchorPsRowId"]');
  const nodeSelect = root.querySelector('select[data-setup="anchorNodeRowId"]');
  const psOption = Array.from(psSelect?.options || []).find((option) => option.value && optionText(option).includes(group.ps.psName));
  const nodeOption = Array.from(nodeSelect?.options || []).find((option) => option.value && optionText(option).startsWith(group.node.node));
  if (psSelect && psOption) {
    psSelect.value = psOption.value;
    psSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (nodeSelect && nodeOption) {
    nodeSelect.value = nodeOption.value;
    nodeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psnm-adg-note{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psnm-adg-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-adg-table th,.psnm-adg-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap}.psnm-adg-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psnm-adg-scroll{overflow:auto;max-height:420px}.psnm-adg-actions{display:flex;gap:8px;flex-wrap:wrap}.psnm-adg-small{font-size:11px;color:#9fb2c7}.psnm-adg-warning{color:#fde68a}`;
  document.head.appendChild(style);
}

function modal() {
  return document.querySelector('[data-psnm="modal"]');
}

function setupPanel(root) {
  return root?.querySelector('[data-psnm-panel="setup"]') || null;
}

function ensureGroupsControls(root) {
  const panel = setupPanel(root);
  if (!panel || panel.querySelector('[data-psnm-auto-datum-groups-controls]')) return;
  const card = document.createElement('section');
  card.className = 'psnm-card';
  card.dataset.psnmAutoDatumGroupsControls = '1';
  card.innerHTML = `<div class="psnm-card-head"><b>Auto Datum Groups</b><div class="psnm-adg-actions"><button class="psnm-btn" type="button" data-psnm-auto-datum-groups="run">Auto Datum Groups</button></div></div><div class="psnm-card-body"><div class="psnm-adg-note">Iteratively finds the best PS↔Node anchor datum, removes matched PS/Node rows, and repeats. Use this when one global anchor cannot explain all rows.</div><div data-psnm-auto-datum-groups-panel></div></div>`;
  panel.appendChild(card);
}

function ensureGroupsPanel(root) {
  ensureGroupsControls(root);
  return root.querySelector('[data-psnm-auto-datum-groups-panel]');
}

function renderGroups(root, groups, meta) {
  const panel = ensureGroupsPanel(root);
  if (!groups.length) {
    panel.innerHTML = '<div class="psnm-adg-note">No datum groups found. Check source parsing, bore compatibility, and tolerance setup.</div>';
    return;
  }
  panel.__psnmAutoDatumGroups = groups;
  const coveredPs = groups.reduce((n, group) => n + group.accepted.length, 0);
  const coverage = meta.psRows.length ? (coveredPs / meta.psRows.length) * 100 : 0;
  const summary = `<div class="psnm-adg-note"><b>${groups.length}</b> datum group(s) found. Covered <b>${coveredPs}/${meta.psRows.length}</b> PS rows (${fmt(coverage, 1)}%). Remaining PS: <b>${meta.remainingPs.length}</b>; remaining nodes: <b>${meta.remainingNodes.length}</b>. ${groups.length > 1 ? '<span class="psnm-adg-warning">Multiple datum groups detected; single-anchor mode is insufficient.</span>' : ''}</div>`;
  const groupRows = groups.map((g, i) => `<tr><td><button class="psnm-btn psnm-btn-secondary" type="button" data-psnm-auto-datum-group-use="${i}">Use Group Anchor</button></td><td>${g.groupNo}</td><td>${h(g.ps.psName)}</td><td>${h(g.node.node)} <span class="psnm-adg-small">${h(g.node.occurrenceId)}</span></td><td>${g.totalMatches}</td><td>${g.exact}</td><td>${g.a1}</td><td>${g.a2}</td><td>${g.a3}</td><td>${fmt(g.avgMax)}</td><td>${fmt(g.worst)}</td><td>${fmt(g.datum.e)}</td><td>${fmt(g.datum.u)}</td><td>${fmt(g.datum.s)}</td><td>${Math.round(g.score)}</td></tr>`).join('');
  const matchRows = groups.flatMap((g) => g.accepted.map((m) => ({ group: g.groupNo, datum: g.datum, match: m }))).slice(0, 250).map(({ group, match }) => `<tr><td>${group}</td><td>${h(match.ps.psName)}</td><td>${h(match.node.node)} <span class="psnm-adg-small">${h(match.node.occurrenceId)}</span></td><td>${h(match.type)}</td><td>${fmt(match.delta.de)}</td><td>${fmt(match.delta.du)}</td><td>${fmt(match.delta.ds)}</td><td>${fmt(match.delta.maxAbs)}</td><td>${fmt(match.nodePs.e)}</td><td>${fmt(match.nodePs.u)}</td><td>${fmt(match.nodePs.s)}</td></tr>`).join('');
  panel.innerHTML = `${summary}<h4>Datum Groups</h4><div class="psnm-adg-scroll"><table class="psnm-adg-table"><thead><tr><th>Use</th><th>Group</th><th>Anchor PS</th><th>Anchor Node</th><th>Matches</th><th>Exact</th><th>A1</th><th>A2</th><th>A3</th><th>Avg Max Δ</th><th>Worst Δ</th><th>datumE</th><th>datumU</th><th>datumS</th><th>Score</th></tr></thead><tbody>${groupRows}</tbody></table></div><h4>Grouped Matches</h4><div class="psnm-adg-scroll"><table class="psnm-adg-table"><thead><tr><th>Group</th><th>PS</th><th>Node</th><th>Type</th><th>Signed ΔE</th><th>Signed ΔU</th><th>Signed ΔS</th><th>Max Δ</th><th>Node E</th><th>Node U</th><th>Node S</th></tr></thead><tbody>${matchRows}</tbody></table></div>`;
}

let timer = null;
function schedule(delay = 120) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const root = modal();
    if (!root) return;
    installStyle();
    ensureGroupsControls(root);
  }, delay);
}

document.addEventListener('click', (event) => {
  const run = event.target.closest?.('[data-psnm-auto-datum-groups="run"]');
  if (run) {
    const root = modal();
    if (root) runDatumGroups(root);
    return;
  }
  const use = event.target.closest?.('[data-psnm-auto-datum-group-use]');
  if (use) {
    const root = modal();
    const groups = root?.querySelector('[data-psnm-auto-datum-groups-panel]')?.__psnmAutoDatumGroups || [];
    const group = groups[Number(use.dataset.psnmAutoDatumGroupUse)];
    if (root && group) applyGroupAnchor(root, group);
    return;
  }
  if (event.target.closest?.('[data-psnm-action="open"], [data-psnm-tab="setup"], [data-psnm-action="resolveMasters"]')) {
    schedule(180);
    setTimeout(() => schedule(0), 450);
  }
}, false);

document.addEventListener('input', (event) => {
  if (event.target.closest?.('[data-source], [data-setup]')) schedule(220);
}, false);

document.addEventListener('change', (event) => {
  if (event.target.closest?.('[data-source], [data-setup]')) schedule(160);
}, false);

installStyle();

export function PSNM_autoDatumGroupsInstalled() {
  return true;
}
