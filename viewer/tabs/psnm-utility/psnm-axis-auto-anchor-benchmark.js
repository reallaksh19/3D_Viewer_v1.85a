const STYLE_ID = 'psnm-axis-auto-anchor-style';
const STORAGE_KEY = 'psnm.workbench.lastSourceSetup.v1';
const DEFAULTS_VERSION = '20260610-axis-benchmark-1';
const PS_AXES = ['e', 's', 'u'];
const NODE_AXES = ['x', 'y', 'z'];
const SIGN_SETS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];

const DEFAULT_TABLE1 = `PS Name\tE\tN\tU\tbore
PS-01\t0\t3000\t100000\t250
PS-02\t0\t6000\t100000\t250
PS-03\t0\t12000\t100000\t250
PS-04\t3000\t12000\t100000\t250
PS-05\t6000\t12000\t100000\t50
PS-06\t9000\t15000\t100000\t200
PS-07\t12000\t16800\t100000\t250
PS-08\t15000\t18600\t100000\t250
PS-09\t18000\t20400\t100000\t250
PS-10\t21000\t22200\t100000\t250
PS-11\t21000\t22200\t110000\t250
PS-12\t21000\t22200\t120000\t250
PS-13\t21000\t22200\t130000\t250`;

const DEFAULT_TABLE2 = `Node\tX\tY\tZ\tdia
10\t17200\t0\t1000\t273
20\t15400\t0\t-2000\t273
30\t13600\t0\t-5000\t273
40\t-2000\t0\t-19875\t273
50\t1000\t0\t-20000\t273
60\t7000\t0\t-20000\t273.2
70\t7100\t0\t-17000\t273
80\t7000\t0\t-14000\t273
90\t10000\t0\t-11000\t168.3
100\t11800\t0\t-8000\t273
110\t17200\t10024\t1000\t273
120\t17200\t20000\t1000\t274
130\t17200\t30000\t1500\t275`;

const DEFAULT_TABLE3 = `Node\tDia(mm)
10\t273
20\t273
30\t273
40\t273
50\t273
60\t273.2
70\t273
80\t273
90\t168.3
100\t273
110\t273
120\t274
130\t275`;

const EXPECTED = new Map([
  ['PS-10', { node: '10', without: 'Exact', with: 'Exact' }],
  ['PS-09', { node: '20', without: 'Exact', with: 'Exact' }],
  ['PS-08', { node: '30', without: 'Exact', with: 'Exact' }],
  ['PS-01', { node: '40', without: '125mm approx matches', with: '125mm approx matches' }],
  ['PS-02', { node: '50', without: 'Exact', with: 'Exact' }],
  ['PS-03', { node: '60', without: 'Exact', with: 'Exact' }],
  ['PS-04', { node: '70', without: '100mm approx matches', with: '100mm approx matches' }],
  ['PS-05', { node: '80', without: 'Exact', with: 'No match, since bore is different' }],
  ['PS-06', { node: '90', without: 'Exact', with: 'No match, since bore is different' }],
  ['PS-07', { node: '100', without: 'Exact', with: 'Exact' }],
  ['PS-11', { node: '110', without: '25mm approx', with: '25mm approx' }],
  ['PS-12', { node: '120', without: 'Exact', with: 'Exact' }],
  ['PS-13', { node: '130', without: '1000mm approx (Multi axis)', with: '1000mm approx (Multi axis)' }],
]);

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function num(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}
function fmt(value, decimals = 3) {
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
function modal() {
  return document.querySelector('[data-psnm="modal"]');
}
function selectedTab(root) {
  return root?.querySelector('[data-psnm-tab].active')?.dataset?.psnmTab || '';
}
function field(root, key) {
  return root?.querySelector(`[data-source="${key}"]`);
}
function setup(root, key) {
  return root?.querySelector(`[data-setup="${key}"]`);
}
function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psnm-axis-note{font-size:12px;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psnm-axis-warn{color:#fde68a}.psnm-axis-pass{color:#86efac;font-weight:800}.psnm-axis-fail{color:#fca5a5;font-weight:800}.psnm-axis-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-axis-table th,.psnm-axis-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap}.psnm-axis-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psnm-axis-scroll{overflow:auto;max-height:420px}`;
  document.head.appendChild(style);
}
function readSnapshot() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed?.version === 1 ? parsed : { version: 1 };
  } catch { return { version: 1 }; }
}
function writeSnapshot(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSnapshot(), ...next, version: 1, savedAt: new Date().toISOString() })); } catch {}
}
function looksOldOrBlank(root) {
  const t1 = field(root, 'table1Text')?.value || '';
  const t2 = field(root, 'table2Text')?.value || '';
  if (!t1.trim() && !t2.trim()) return true;
  if (t1.includes('PS-12231/DATUM') || t2.includes('22140')) return true;
  return false;
}
function setValue(el, value) {
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function applyBenchmarkDefaults(root = modal(), force = false) {
  if (!root) return false;
  const snap = readSnapshot();
  if (!force && snap.benchmarkDefaultsVersion === DEFAULTS_VERSION && !looksOldOrBlank(root)) return false;
  if (!force && !looksOldOrBlank(root)) return false;
  setValue(field(root, 'table1Text'), DEFAULT_TABLE1);
  setValue(field(root, 'table2Text'), DEFAULT_TABLE2);
  setValue(field(root, 'table3Text'), DEFAULT_TABLE3);
  setValue(field(root, 'table4AText'), 'Mandatory PS Name\n');
  setValue(field(root, 'table4BText'), 'Mandatory Node No\n');
  const a1 = setup(root, 'approx1');
  const a2 = setup(root, 'approx2');
  const a3 = setup(root, 'approx3');
  if (a1) setValue(a1, '25,25,25');
  if (a2) setValue(a2, '125,125,125');
  if (a3) setValue(a3, '1000,1000,1000');
  writeSnapshot({ benchmarkDefaultsVersion: DEFAULTS_VERSION, source: { table1Text: DEFAULT_TABLE1, table2Text: DEFAULT_TABLE2, table3Text: DEFAULT_TABLE3, table4AText: 'Mandatory PS Name\n', table4BText: 'Mandatory Node No\n' }, setup: { ...(snap.setup || {}), approx1: '25,25,25', approx2: '125,125,125', approx3: '1000,1000,1000' } });
  return true;
}
function parsePsPosition(text) {
  const src = String(text || '').replace(/,/g, ' ');
  const out = { e: NaN, s: NaN, u: NaN };
  for (const match of src.matchAll(/\b([EWSNUD])\s*(-?\d+(?:\.\d+)?)\s*(?:mm)?\b/gi)) {
    const axis = match[1].toUpperCase();
    const value = Number(match[2]);
    if (axis === 'E') out.e = value;
    else if (axis === 'W') out.e = -value;
    else if (axis === 'S' || axis === 'N') out.s = value;
    else if (axis === 'U') out.u = value;
    else if (axis === 'D') out.u = -value;
  }
  return out;
}
function parsePsRows(text) {
  const lines = splitLines(text);
  if (!lines.length) return [];
  const headers = splitCells(lines[0]).map(norm);
  const hasHeader = headers.some((x) => ['ps name', 'ps', 'ps no', 'ps number', 'position', 'e', 'n', 's', 'u', 'bore'].includes(x));
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const iName = idx(['ps name', 'ps', 'ps no', 'ps number', 'psname']);
  const iPosition = idx(['position', 'ps position', 'coordinate']);
  const iE = idx(['e', 'east', 'easting', 'ps e']);
  const iN = idx(['n', 'north', 'northing', 's', 'south', 'southing', 'ps s']);
  const iU = idx(['u', 'up', 'elevation', 'el', 'z', 'ps u']);
  const iBore = idx(['bore', 'p1bore', 'p1 bore', 'dn', 'nb', 'bore mm', 'bore(mm)']);
  const rows = [];
  const data = hasHeader ? lines.slice(1) : lines;
  for (const [i, line] of data.entries()) {
    const cells = splitCells(line);
    const joined = cells.join(' ');
    const name = hasHeader ? String(cells[iName] ?? '').trim() : (joined.match(/\bPS[-_/A-Z0-9.]+(?:\/DATUM)?\b/i)?.[0] || '').trim();
    let coord = { e: NaN, s: NaN, u: NaN };
    if (hasHeader && iE >= 0 && iN >= 0 && iU >= 0) coord = { e: num(cells[iE]), s: num(cells[iN]), u: num(cells[iU]) };
    else coord = parsePsPosition(hasHeader && iPosition >= 0 ? cells[iPosition] : joined);
    const bore = hasHeader && iBore >= 0 ? num(cells[iBore]) : num(cells[cells.length - 1]);
    if (!name || !Number.isFinite(coord.e) || !Number.isFinite(coord.s) || !Number.isFinite(coord.u)) continue;
    rows.push({ psName: name.replace(/\.$/, ''), e: coord.e, s: coord.s, u: coord.u, bore: Number.isFinite(bore) ? bore : null, rowIndex: i + 1, id: `${name.replace(/\.$/, '')}#${i + 1}` });
  }
  return rows;
}
function odToBore(od) {
  const n = Number(od);
  if (!Number.isFinite(n)) return null;
  if (n >= 272.5 && n <= 276) return 250;
  if (Math.abs(n - 168.3) <= 1) return 150;
  if (Math.abs(n - 60.3) <= 1) return 50;
  if (Math.abs(n - 219.1) <= 1) return 200;
  return null;
}
function parseNodeRows(text) {
  const lines = splitLines(text);
  if (!lines.length) return [];
  const headers = splitCells(lines[0]).map(norm);
  const hasHeader = headers.some((x) => ['node', 'node no', 'node number', 'x', 'y', 'z', 'dia', 'dia mm', 'od'].includes(x));
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const iNode = idx(['node', 'node no', 'node number']);
  const iX = idx(['x', 'raw x', 'node x', 'coord x']);
  const iY = idx(['y', 'raw y', 'node y', 'coord y']);
  const iZ = idx(['z', 'raw z', 'node z', 'coord z']);
  const iBore = idx(['bore', 'dn', 'nb', 'nominal bore', 'bore mm', 'bore(mm)']);
  const iDia = idx(['dia', 'dia mm', 'dia(mm)', 'od', 'od mm', 'od(mm)']);
  const rows = [];
  const counts = new Map();
  const data = hasHeader ? lines.slice(1) : lines;
  for (const [i, line] of data.entries()) {
    const cells = splitCells(line);
    const node = String(hasHeader ? (cells[iNode] ?? cells[0]) : (cells[0] ?? '')).trim();
    const x = hasHeader && iX >= 0 ? num(cells[iX]) : num(cells[1]);
    const y = hasHeader && iY >= 0 ? num(cells[iY]) : num(cells[2]);
    const z = hasHeader && iZ >= 0 ? num(cells[iZ]) : num(cells[3]);
    const directBore = hasHeader && iBore >= 0 ? num(cells[iBore]) : NaN;
    const dia = hasHeader && iDia >= 0 ? num(cells[iDia]) : num(cells[4]);
    const bore = Number.isFinite(directBore) ? directBore : odToBore(dia);
    if (!node || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const count = (counts.get(node) || 0) + 1;
    counts.set(node, count);
    const occurrenceId = `${node}#${String(count).padStart(3, '0')}`;
    rows.push({ node, occurrenceId, x, y, z, dia: Number.isFinite(dia) ? dia : null, bore, rowIndex: i + 1, id: occurrenceId });
  }
  return rows;
}
function toleranceFromInput(root, key, fallback) {
  const value = root.querySelector(`[data-setup="${key}"]`)?.value || '';
  const parts = value.split(',').map((part) => Number(part.trim()));
  return parts.length === 3 && parts.every(Number.isFinite) ? { e: parts[0], s: parts[1], u: parts[2] } : fallback;
}
function tolerances(root) {
  return { exact: { e: 0.01, s: 0.01, u: 0.01 }, a1: toleranceFromInput(root, 'approx1', { e: 25, s: 25, u: 25 }), a2: toleranceFromInput(root, 'approx2', { e: 125, s: 125, u: 125 }), a3: toleranceFromInput(root, 'approx3', { e: 1000, s: 1000, u: 1000 }) };
}
function classify(delta, tol) {
  const ae = Math.abs(delta.de), as = Math.abs(delta.ds), au = Math.abs(delta.du);
  if (ae <= tol.exact.e && as <= tol.exact.s && au <= tol.exact.u) return 'EXACT';
  if (ae <= tol.a1.e && as <= tol.a1.s && au <= tol.a1.u) return 'APPROX_1';
  if (ae <= tol.a2.e && as <= tol.a2.s && au <= tol.a2.u) return 'APPROX_2';
  if (ae <= tol.a3.e && as <= tol.a3.s && au <= tol.a3.u) return 'APPROX_3';
  return 'NO_MATCH';
}
function rankType(type) { return type === 'EXACT' ? 0 : type === 'APPROX_1' ? 1 : type === 'APPROX_2' ? 2 : type === 'APPROX_3' ? 3 : 99; }
function axisPermutations(values) {
  return [[values[0], values[1], values[2]], [values[0], values[2], values[1]], [values[1], values[0], values[2]], [values[1], values[2], values[0]], [values[2], values[0], values[1]], [values[2], values[1], values[0]]];
}
function makeTransform(ps, node, axes, signs) {
  const offset = {};
  for (let i = 0; i < PS_AXES.length; i += 1) {
    const psAxis = PS_AXES[i];
    const nodeAxis = axes[i];
    const sign = signs[i];
    offset[psAxis] = ps[psAxis] - sign * node[nodeAxis];
  }
  return { axes: { e: axes[0], s: axes[1], u: axes[2] }, signs: { e: signs[0], s: signs[1], u: signs[2] }, offset };
}
function transformNode(node, transform) {
  return {
    e: transform.signs.e * node[transform.axes.e] + transform.offset.e,
    s: transform.signs.s * node[transform.axes.s] + transform.offset.s,
    u: transform.signs.u * node[transform.axes.u] + transform.offset.u,
  };
}
function delta(ps, nodePs) {
  const de = nodePs.e - ps.e;
  const ds = nodePs.s - ps.s;
  const du = nodePs.u - ps.u;
  return { de, ds, du, maxAbs: Math.max(Math.abs(de), Math.abs(ds), Math.abs(du)), euclid: Math.sqrt(de * de + ds * ds + du * du) };
}
function boreOk(ps, node, requireBore) {
  if (!requireBore) return true;
  if (ps.bore == null || node.bore == null) return true;
  return Math.abs(ps.bore - node.bore) <= 1e-6;
}
function scoreTransform(transform, psRows, nodeRows, tol, requireBore) {
  const possible = [];
  for (const ps of psRows) {
    for (const node of nodeRows) {
      if (!boreOk(ps, node, requireBore)) continue;
      const nodePs = transformNode(node, transform);
      const d = delta(ps, nodePs);
      const type = classify(d, tol);
      if (type === 'NO_MATCH') continue;
      possible.push({ ps, node, nodePs, delta: d, type, rank: rankType(type) });
    }
  }
  possible.sort((a, b) => a.rank - b.rank || a.delta.maxAbs - b.delta.maxAbs || a.delta.euclid - b.delta.euclid || a.ps.rowIndex - b.ps.rowIndex || a.node.rowIndex - b.node.rowIndex);
  const usedPs = new Set();
  const usedNode = new Set();
  const matches = [];
  for (const item of possible) {
    if (usedPs.has(item.ps.id) || usedNode.has(item.node.id)) continue;
    usedPs.add(item.ps.id);
    usedNode.add(item.node.id);
    matches.push(item);
  }
  const counts = { exact: 0, a1: 0, a2: 0, a3: 0 };
  let borePass = 0;
  for (const item of matches) {
    if (item.type === 'EXACT') counts.exact += 1;
    else if (item.type === 'APPROX_1') counts.a1 += 1;
    else if (item.type === 'APPROX_2') counts.a2 += 1;
    else if (item.type === 'APPROX_3') counts.a3 += 1;
    if (item.ps.bore != null && item.node.bore != null && Math.abs(item.ps.bore - item.node.bore) <= 1e-6) borePass += 1;
  }
  const worst = matches.reduce((m, item) => Math.max(m, item.delta.maxAbs), 0);
  const avg = matches.length ? matches.reduce((sum, item) => sum + item.delta.maxAbs, 0) / matches.length : 0;
  const score = counts.exact * 100000 + counts.a1 * 50000 + counts.a2 * 20000 + counts.a3 * 10000 + borePass * 5000 - worst * 2 - avg;
  return { transform, matches, counts, borePass, worst, avg, score };
}
function findBestTransform(psRows, nodeRows, tol, requireBore) {
  let best = null;
  const perms = axisPermutations(NODE_AXES);
  for (const anchorPs of psRows) {
    for (const anchorNode of nodeRows) {
      if (!boreOk(anchorPs, anchorNode, requireBore)) continue;
      for (const axes of perms) {
        for (const signs of SIGN_SETS) {
          const transform = makeTransform(anchorPs, anchorNode, axes, signs);
          const scored = scoreTransform(transform, psRows, nodeRows, tol, requireBore);
          scored.anchorPs = anchorPs;
          scored.anchorNode = anchorNode;
          if (!best || scored.score > best.score || (scored.score === best.score && scored.matches.length > best.matches.length) || (scored.score === best.score && scored.matches.length === best.matches.length && scored.avg < best.avg)) best = scored;
        }
      }
    }
  }
  return best;
}
function typeLabel(type) {
  if (type === 'EXACT') return 'Exact';
  if (type === 'APPROX_1') return '25mm approx';
  if (type === 'APPROX_2') return '125mm approx matches';
  if (type === 'APPROX_3') return '1000mm approx (Multi axis)';
  return 'No match';
}
function benchmarkStatus(psName, node, label, mode) {
  const exp = EXPECTED.get(psName);
  if (!exp) return '';
  const expectedNode = exp.node;
  const expectedText = mode === 'with' ? exp.with : exp.without;
  const nodeOk = node === expectedNode || expectedText.startsWith('No match');
  const typeOk = expectedText.startsWith('Exact') ? label === 'Exact'
    : expectedText.startsWith('125mm') ? label.includes('125mm')
      : expectedText.startsWith('100mm') ? label.includes('125mm') || label.includes('100')
        : expectedText.startsWith('25mm') ? label.includes('25mm')
          : expectedText.startsWith('1000mm') ? label.includes('1000mm')
            : expectedText.startsWith('No match') ? label === 'No match'
              : false;
  return nodeOk && typeOk ? 'PASS' : 'CHECK';
}
function transformLabel(t) {
  return `E=${t.signs.e === -1 ? '-' : ''}${t.axes.e.toUpperCase()}+${fmt(t.offset.e)}; N=${t.signs.s === -1 ? '-' : ''}${t.axes.s.toUpperCase()}+${fmt(t.offset.s)}; U=${t.signs.u === -1 ? '-' : ''}${t.axes.u.toUpperCase()}+${fmt(t.offset.u)}`;
}
function renderMatches(best, mode) {
  const byPs = new Map(best.matches.map((m) => [m.ps.psName, m]));
  const rows = Array.from(EXPECTED.keys()).map((psName) => {
    const m = byPs.get(psName);
    const exp = EXPECTED.get(psName);
    const label = m ? typeLabel(m.type) : 'No match';
    const status = benchmarkStatus(psName, m?.node?.node || '', label, mode);
    return `<tr><td>${h(psName)}</td><td>${h(exp.node)}</td><td>${h(m?.node?.node || '-')}</td><td>${h(label)}</td><td>${m ? fmt(m.delta.de) : '-'}</td><td>${m ? fmt(m.delta.ds) : '-'}</td><td>${m ? fmt(m.delta.du) : '-'}</td><td>${m ? fmt(m.delta.maxAbs) : '-'}</td><td>${h(mode === 'with' ? exp.with : exp.without)}</td><td class="${status === 'PASS' ? 'psnm-axis-pass' : 'psnm-axis-warn'}">${h(status)}</td></tr>`;
  }).join('');
  return `<div class="psnm-axis-scroll"><table class="psnm-axis-table"><thead><tr><th>PS</th><th>Expected Node</th><th>Actual Node</th><th>Actual Type</th><th>Signed ΔE</th><th>Signed ΔN</th><th>Signed ΔU</th><th>Max Δ</th><th>Expected Remark</th><th>Benchmark</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderPanel(root, resultNoBore, resultWithBore) {
  const setupPanel = root.querySelector('[data-psnm-panel="setup"]');
  if (!setupPanel) return;
  root.querySelector('[data-psnm-axis-auto-anchor]')?.remove();
  root.querySelector('[data-psnm-auto-anchor]')?.remove();
  root.querySelector('[data-psnm-auto-datum-groups]')?.remove();
  const card = document.createElement('section');
  card.className = 'psnm-card';
  card.dataset.psnmAxisAutoAnchor = '1';
  const noBoreSummary = resultNoBore ? `<div class="psnm-axis-note"><b>Without bore:</b> ${resultNoBore.matches.length} match(es), Exact ${resultNoBore.counts.exact}, A1 ${resultNoBore.counts.a1}, A2 ${resultNoBore.counts.a2}, A3 ${resultNoBore.counts.a3}.<br><b>Transform:</b> ${h(transformLabel(resultNoBore.transform))}</div>${renderMatches(resultNoBore, 'without')}` : '<div class="psnm-axis-note psnm-axis-warn">No without-bore transform found.</div>';
  const withBoreSummary = resultWithBore ? `<div class="psnm-axis-note"><b>With bore:</b> ${resultWithBore.matches.length} match(es), Exact ${resultWithBore.counts.exact}, A1 ${resultWithBore.counts.a1}, A2 ${resultWithBore.counts.a2}, A3 ${resultWithBore.counts.a3}.<br><b>Transform:</b> ${h(transformLabel(resultWithBore.transform))}</div>${renderMatches(resultWithBore, 'with')}` : '<div class="psnm-axis-note psnm-axis-warn">No with-bore transform found.</div>';
  card.innerHTML = `<div class="psnm-card-head"><b>Auto Anchor — Axis Mapping Benchmark</b><div class="psnm-actions"><button class="psnm-btn psnm-btn-secondary" data-psnm-axis-action="defaults">Load Benchmark Defaults</button><button class="psnm-btn" data-psnm-axis-action="run">Run Axis Auto Anchor</button></div></div><div class="psnm-card-body"><div class="psnm-axis-note">Searches all axis permutations and signs. Benchmark expected mapping is <b>E=Z+20000, N=X+5000, U=Y+100000</b>. Table-2 <b>dia</b> is treated as OD and converted to DN for bore matching.</div>${noBoreSummary}<hr>${withBoreSummary}</div>`;
  setupPanel.prepend(card);
}
function runBenchmark(root = modal()) {
  if (!root) return;
  const psRows = parsePsRows(field(root, 'table1Text')?.value || '');
  const nodeRows = parseNodeRows(field(root, 'table2Text')?.value || '');
  const tol = tolerances(root);
  const noBore = findBestTransform(psRows, nodeRows, tol, false);
  const withBore = findBestTransform(psRows, nodeRows, tol, true);
  renderPanel(root, noBore, withBore);
}
function schedule(delay = 120) {
  setTimeout(() => {
    const root = modal();
    if (!root || selectedTab(root) !== 'setup') return;
    applyBenchmarkDefaults(root, false);
    runBenchmark(root);
  }, delay);
}
document.addEventListener('click', (event) => {
  const target = event.target.closest?.('[data-psnm-axis-action]');
  if (target) {
    const root = modal();
    if (!root) return;
    if (target.dataset.psnmAxisAction === 'defaults') applyBenchmarkDefaults(root, true);
    runBenchmark(root);
    return;
  }
  if (event.target.closest?.('[data-psnm-action="open"], [data-psnm-tab="setup"], [data-psnm-action="resolveMasters"]')) schedule(220);
}, false);
document.addEventListener('input', (event) => {
  if (event.target.closest?.('[data-source], [data-setup]')) schedule(260);
}, false);
document.addEventListener('change', (event) => {
  if (event.target.closest?.('[data-source], [data-setup]')) schedule(260);
}, false);
installStyle();
export function PSNM_axisAutoAnchorBenchmarkInstalled() { return true; }
