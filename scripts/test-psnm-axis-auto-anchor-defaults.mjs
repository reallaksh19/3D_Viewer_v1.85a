#!/usr/bin/env node

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

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^-{3,}$/.test(line));
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

function num(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function fmt(value, decimals = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : '-';
}

function parsePsRows(text) {
  const lines = splitLines(text);
  const headers = splitCells(lines[0] || '').map(norm);
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const iName = idx(['ps name', 'ps', 'ps no', 'ps number', 'psname']);
  const iE = idx(['e', 'east', 'easting', 'ps e']);
  const iN = idx(['n', 'north', 'northing', 's', 'south', 'southing', 'ps s']);
  const iU = idx(['u', 'up', 'elevation', 'el', 'z', 'ps u']);
  const iBore = idx(['bore', 'p1bore', 'p1 bore', 'dn', 'nb', 'bore mm', 'bore(mm)']);
  return lines.slice(1).map((line, i) => {
    const cells = splitCells(line);
    const psName = String(cells[iName] ?? '').trim();
    return { psName, e: num(cells[iE]), s: num(cells[iN]), u: num(cells[iU]), bore: num(cells[iBore]), rowIndex: i + 1, id: `${psName}#${i + 1}` };
  }).filter((row) => row.psName && Number.isFinite(row.e) && Number.isFinite(row.s) && Number.isFinite(row.u));
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
  const headers = splitCells(lines[0] || '').map(norm);
  const idx = (names) => headers.findIndex((header) => names.includes(header));
  const iNode = idx(['node', 'node no', 'node number']);
  const iX = idx(['x', 'raw x', 'node x', 'coord x']);
  const iY = idx(['y', 'raw y', 'node y', 'coord y']);
  const iZ = idx(['z', 'raw z', 'node z', 'coord z']);
  const iBore = idx(['bore', 'dn', 'nb', 'nominal bore', 'bore mm', 'bore(mm)']);
  const iDia = idx(['dia', 'dia mm', 'dia(mm)', 'od', 'od mm', 'od(mm)']);
  const counts = new Map();
  return lines.slice(1).map((line, i) => {
    const cells = splitCells(line);
    const node = String(cells[iNode] ?? cells[0] ?? '').trim();
    const x = num(cells[iX]);
    const y = num(cells[iY]);
    const z = num(cells[iZ]);
    const directBore = iBore >= 0 ? num(cells[iBore]) : NaN;
    const dia = iDia >= 0 ? num(cells[iDia]) : NaN;
    const bore = Number.isFinite(directBore) ? directBore : odToBore(dia);
    const count = (counts.get(node) || 0) + 1;
    counts.set(node, count);
    return { node, occurrenceId: `${node}#${String(count).padStart(3, '0')}`, x, y, z, dia: Number.isFinite(dia) ? dia : null, bore, rowIndex: i + 1, id: `${node}#${count}` };
  }).filter((row) => row.node && Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z));
}

function classify(delta, tol) {
  const ae = Math.abs(delta.de), as = Math.abs(delta.ds), au = Math.abs(delta.du);
  if (ae <= tol.exact.e && as <= tol.exact.s && au <= tol.exact.u) return 'EXACT';
  if (ae <= tol.a1.e && as <= tol.a1.s && au <= tol.a1.u) return 'APPROX_1';
  if (ae <= tol.a2.e && as <= tol.a2.s && au <= tol.a2.u) return 'APPROX_2';
  if (ae <= tol.a3.e && as <= tol.a3.s && au <= tol.a3.u) return 'APPROX_3';
  return 'NO_MATCH';
}

function rankType(type) {
  return type === 'EXACT' ? 0 : type === 'APPROX_1' ? 1 : type === 'APPROX_2' ? 2 : type === 'APPROX_3' ? 3 : 99;
}

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
  if (!exp) return 'CHECK';
  const expectedText = mode === 'with' ? exp.with : exp.without;
  const nodeOk = node === exp.node || expectedText.startsWith('No match');
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

function validateMode(best, mode) {
  const byPs = new Map(best.matches.map((m) => [m.ps.psName, m]));
  const rows = Array.from(EXPECTED.keys()).map((psName) => {
    const exp = EXPECTED.get(psName);
    const match = byPs.get(psName);
    const label = match ? typeLabel(match.type) : 'No match';
    const status = benchmarkStatus(psName, match?.node?.node || '', label, mode);
    return {
      psName,
      expectedNode: exp.node,
      actualNode: match?.node?.node || '-',
      actualType: label,
      expectedRemark: mode === 'with' ? exp.with : exp.without,
      maxDelta: match ? match.delta.maxAbs : null,
      status,
    };
  });
  return {
    mode,
    transform: transformLabel(best.transform),
    anchor: `${best.anchorPs.psName} -> Node ${best.anchorNode.node}`,
    matches: best.matches.length,
    counts: best.counts,
    pass: rows.every((row) => row.status === 'PASS'),
    rows,
  };
}

function main() {
  const psRows = parsePsRows(DEFAULT_TABLE1);
  const nodeRows = parseNodeRows(DEFAULT_TABLE2);
  const tol = { exact: { e: 0.01, s: 0.01, u: 0.01 }, a1: { e: 25, s: 25, u: 25 }, a2: { e: 125, s: 125, u: 125 }, a3: { e: 1000, s: 1000, u: 1000 } };
  const noBore = findBestTransform(psRows, nodeRows, tol, false);
  const withBore = findBestTransform(psRows, nodeRows, tol, true);
  const result = {
    ok: false,
    tableCounts: { psRows: psRows.length, nodeRows: nodeRows.length, expectedRows: EXPECTED.size },
    withoutBore: validateMode(noBore, 'without'),
    withBore: validateMode(withBore, 'with'),
  };
  const expectedTransform = 'E=Z+20000.000; N=X+5000.000; U=Y+100000.000';
  result.ok = result.tableCounts.psRows === 13
    && result.tableCounts.nodeRows === 13
    && result.withoutBore.pass
    && result.withBore.pass
    && result.withoutBore.anchor === 'PS-02 -> Node 50'
    && result.withBore.anchor === 'PS-02 -> Node 50'
    && result.withoutBore.transform === expectedTransform
    && result.withBore.transform === expectedTransform;

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.error('PSNM axis auto-anchor default benchmark failed.');
    process.exit(1);
  }
  console.log('✅ PSNM axis auto-anchor default benchmark passed.');
}

main();
