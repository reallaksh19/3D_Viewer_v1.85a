import { PIPE_OD_TO_DN } from '../../pcf-legacy/services/bore-converter.js';
import {
  psnmAxisPermutations,
  psnmDelta,
  psnmFixed,
  psnmHtml,
  psnmMakeAxisTransform,
  psnmNumber,
  psnmParsePsPositionAny,
  psnmSignSets,
  psnmText,
  psnmTransformNodeToPs,
} from './psnm-axis-transform-core.js';

const TRUE_RE = /^(yes|y|true|1|m|mandatory|required|req|must)$/i;

function splitLine(line) {
  const raw = psnmText(line);
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}
function normHeader(value) { return psnmText(value).toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function parseTable(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  if (!lines.length) return [];
  const headers = splitLine(lines[0]).map(normHeader);
  return lines.slice(1).map((line, index) => {
    const cells = splitLine(line);
    const row = { __rowIndex: index + 1, __raw: line };
    headers.forEach((header, i) => { row[header] = cells[i] ?? ''; });
    return row;
  });
}
function first(row, names) {
  for (const name of names) {
    const value = row[normHeader(name)];
    if (value != null && psnmText(value) !== '') return value;
  }
  return '';
}
function parsePsRows(text) {
  return parseTable(text).map((row) => {
    let coord = psnmParsePsPositionAny(first(row, ['Position', 'PS Position', 'Coordinates']));
    const e = psnmNumber(first(row, ['E', 'East', 'Easting', 'PS E']));
    const north = psnmNumber(first(row, ['N', 'North', 'Northing', 'S', 'South', 'Southing', 'PS N', 'PS S']));
    const u = psnmNumber(first(row, ['U', 'Up', 'Elevation', 'EL', 'PS U']));
    if ([e, north, u].every(Number.isFinite)) coord = { e, s: north, u };
    return {
      psName: psnmText(first(row, ['PS NAME', 'PS No', 'PS Number', 'PS'])),
      e: coord.e,
      u: coord.u,
      s: coord.s,
      bore: psnmNumber(first(row, ['p1bore', 'Bore', 'NB', 'DN', 'Bore mm'])),
      mandatory: TRUE_RE.test(first(row, ['Mandatory', 'Required', 'Req'])),
    };
  }).filter((row) => row.psName && Number.isFinite(row.e) && Number.isFinite(row.u) && Number.isFinite(row.s));
}
function parseNodeRows(text) {
  return parseTable(text).map((row) => ({
    node: psnmText(first(row, ['Node', 'Node No', 'Node Number'])),
    x: psnmNumber(first(row, ['X', 'Raw X'])),
    y: psnmNumber(first(row, ['Y', 'Raw Y'])),
    z: psnmNumber(first(row, ['Z', 'Raw Z'])),
    bore: psnmNumber(first(row, ['Bore', 'NB', 'DN'])),
    dia: psnmNumber(first(row, ['Dia(mm)', 'Dia mm', 'Dia', 'OD', 'OD mm'])),
  })).filter((row) => row.node && Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z));
}
function odToDn(odMm) {
  const od = Number(odMm);
  if (!Number.isFinite(od)) return NaN;
  let best = null;
  let bestErr = Infinity;
  for (const row of PIPE_OD_TO_DN) {
    const err = Math.abs(Number(row.od) - od);
    if (err < bestErr) { bestErr = err; best = row; }
  }
  if (!best) return NaN;
  const tolerance = Math.max(2, Math.abs(Number(best.od)) * 0.008);
  return bestErr <= tolerance ? Number(best.dn) : NaN;
}
function nodeBore(row) {
  const direct = Number(row?.bore);
  if (Number.isFinite(direct)) return direct;
  return odToDn(row?.dia);
}
function classify(d, tol) {
  if (Math.abs(d.de) <= 0.01 && Math.abs(d.du) <= 0.01 && Math.abs(d.ds) <= 0.01) return 'EXACT';
  if (Math.abs(d.de) <= tol.a1.e && Math.abs(d.du) <= tol.a1.u && Math.abs(d.ds) <= tol.a1.s) return 'APPROX_1';
  if (Math.abs(d.de) <= tol.a2.e && Math.abs(d.du) <= tol.a2.u && Math.abs(d.ds) <= tol.a2.s) return 'APPROX_2';
  if (Math.abs(d.de) <= tol.a3.e && Math.abs(d.du) <= tol.a3.u && Math.abs(d.ds) <= tol.a3.s) return 'APPROX_3';
  return 'NO_MATCH';
}
function rank(type) { return type === 'EXACT' ? 0 : type === 'APPROX_1' ? 1 : type === 'APPROX_2' ? 2 : type === 'APPROX_3' ? 3 : 99; }
function tolFromModal(modal) {
  const parse = (name, fallback) => {
    const parts = psnmText(modal.querySelector(`[data-setup="${name}"]`)?.value).split(',').map((x) => Number(x.trim()));
    return parts.length === 3 && parts.every(Number.isFinite) ? { e: parts[0], u: parts[1], s: parts[2] } : fallback;
  };
  return { a1: parse('approx1', { e: 25, u: 25, s: 25 }), a2: parse('approx2', { e: 50, u: 25, s: 50 }), a3: parse('approx3', { e: 50, u: 25, s: 50 }) };
}
function scoreTransform(anchorPs, anchorNode, transform, psRows, nodeRows, tol) {
  const used = new Set();
  let exact = 0, approx1 = 0, approx2 = 0, approx3 = 0, borePass = 0, boreMissing = 0, boreConflict = 0, sumMax = 0, worst = 0;
  for (const ps of psRows) {
    let best = null;
    for (const node of nodeRows) {
      if (used.has(node.node)) continue;
      const d = psnmDelta(ps, psnmTransformNodeToPs(node, transform));
      const type = classify(d, tol);
      const item = { node, d, type, rank: rank(type) };
      if (!best || item.rank < best.rank || (item.rank === best.rank && item.d.maxAbs < best.d.maxAbs)) best = item;
    }
    if (!best || best.type === 'NO_MATCH') continue;
    used.add(best.node.node);
    if (best.type === 'EXACT') exact += 1;
    else if (best.type === 'APPROX_1') approx1 += 1;
    else if (best.type === 'APPROX_2') approx2 += 1;
    else approx3 += 1;
    const pb = Number(ps.bore);
    const nb = nodeBore(best.node);
    if (!Number.isFinite(pb) || !Number.isFinite(nb)) boreMissing += 1;
    else if (Math.abs(pb - nb) <= 1e-6) borePass += 1;
    else boreConflict += 1;
    sumMax += best.d.maxAbs;
    worst = Math.max(worst, best.d.maxAbs);
  }
  const totalMatches = exact + approx1 + approx2 + approx3;
  const avgMax = totalMatches ? sumMax / totalMatches : Number.POSITIVE_INFINITY;
  const coverage = psRows.length ? totalMatches / psRows.length : 0;
  const exactShare = totalMatches ? exact / totalMatches : 0;
  const boreGoodShare = totalMatches ? (borePass + boreMissing * 0.35) / totalMatches : 0;
  const confidenceScore = Math.max(0, Math.min(99, Math.round(coverage * 55 + exactShare * 30 + boreGoodShare * 15 - boreConflict * 4 - Math.min(20, avgMax / 25))));
  const confidence = confidenceScore >= 80 ? 'HIGH' : confidenceScore >= 55 ? 'MEDIUM' : 'LOW';
  const score = exact * 100000 + approx1 * 50000 + approx2 * 20000 + approx3 * 10000 + borePass * 1000 + boreMissing * 150 - boreConflict * 5000 - worst * 2 - avgMax;
  return { psName: anchorPs.psName, node: anchorNode.node, transform, exact, approx1, approx2, approx3, totalMatches, borePass, boreMissing, boreConflict, avgMax, worst, confidence, confidenceScore, score };
}
function bestPair(anchorPs, anchorNode, psRows, nodeRows, tol) {
  let best = null;
  for (const axisOrder of psnmAxisPermutations()) {
    for (const signs of psnmSignSets()) {
      const item = scoreTransform(anchorPs, anchorNode, psnmMakeAxisTransform(anchorPs, anchorNode, axisOrder, signs), psRows, nodeRows, tol);
      if (!best || item.confidenceScore > best.confidenceScore || (item.confidenceScore === best.confidenceScore && item.score > best.score)) best = item;
    }
  }
  return best;
}
function renderPairs(modal, pairs) {
  const card = modal.querySelector('[data-psnm-action="runAutoAnchor"]')?.closest('.psnm-card');
  const old = card?.querySelector('.psnm-auto-table')?.closest('.psnm-tablewrap') || card?.querySelector('.psnm-card-body > .psnm-banner')?.nextElementSibling;
  const markup = pairs.length ? `<div class="psnm-tablewrap"><table class="psnm-table psnm-auto-table"><thead><tr><th>Use</th><th>Rank</th><th>Confidence</th><th>Anchor PS</th><th>Anchor Node</th><th>Matches</th><th>Exact</th><th>A1</th><th>A2</th><th>A3</th><th>Bore Pass</th><th>Bore Missing</th><th>Bore Conflict</th><th>Avg Max d</th><th>Worst d</th><th>Axis Formula</th></tr></thead><tbody>${pairs.map((p, i) => `<tr><td><button class="psnm-btn psnm-btn-secondary" data-psnm-axis-use="${i}">Use Pair</button></td><td>${i + 1}</td><td><b>${psnmHtml(p.confidence)} ${p.confidenceScore}/100</b></td><td>${psnmHtml(p.psName)}</td><td>${psnmHtml(p.node)}</td><td>${p.totalMatches}</td><td>${p.exact}</td><td>${p.approx1}</td><td>${p.approx2}</td><td>${p.approx3}</td><td>${p.borePass}</td><td>${p.boreMissing}</td><td>${p.boreConflict}</td><td>${psnmFixed(p.avgMax)}</td><td>${psnmFixed(p.worst)}</td><td>${psnmHtml(p.transform.axisFormula)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="psnm-banner">No viable axis-aware auto-anchor pairs found.</div>';
  if (old) old.outerHTML = markup;
  else card?.querySelector('.psnm-card-body')?.insertAdjacentHTML('beforeend', markup);
}
function findOption(select, text) {
  const needle = psnmText(text).toLowerCase();
  return Array.from(select?.options || []).find((option) => psnmText(option.textContent).toLowerCase().startsWith(needle));
}
export function installPsnmAxisAutoAnchorAddon(container, ctx = {}) {
  function onClick(event) {
    const modal = container.querySelector('[data-psnm="modal"]');
    if (!modal) return;
    const run = event.target?.closest?.('[data-psnm-action="runAutoAnchor"]');
    if (run) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const psRows = parsePsRows(modal.querySelector('[data-source="table1Text"]')?.value || '');
      const nodeRows = parseNodeRows(modal.querySelector('[data-source="table2Text"]')?.value || '');
      if (!psRows.length || !nodeRows.length) {
        ctx.showToast?.('Auto Anchor needs PS E/N/U or Position rows and Node X/Y/Z rows.', 'error');
        return;
      }
      const tol = tolFromModal(modal);
      const pairs = [];
      for (const ps of psRows) for (const node of nodeRows) pairs.push(bestPair(ps, node, psRows, nodeRows, tol));
      pairs.sort((a, b) => b.confidenceScore - a.confidenceScore || b.score - a.score || b.totalMatches - a.totalMatches || a.avgMax - b.avgMax || String(a.psName).localeCompare(String(b.psName)) || String(a.node).localeCompare(String(b.node), undefined, { numeric: true }));
      window.__PSNM_AXIS_AUTO_ANCHOR_PAIRS = pairs.slice(0, 25);
      renderPairs(modal, window.__PSNM_AXIS_AUTO_ANCHOR_PAIRS);
      return;
    }
    const use = event.target?.closest?.('[data-psnm-axis-use]');
    if (use) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const pair = window.__PSNM_AXIS_AUTO_ANCHOR_PAIRS?.[Number(use.dataset.psnmAxisUse)];
      if (!pair) return;
      window.__PSNM_AXIS_TRANSFORM = { ...pair.transform, anchorPsName: pair.psName, anchorNode: String(pair.node) };
      const psSelect = modal.querySelector('[data-setup="anchorPsRowId"]');
      const nodeSelect = modal.querySelector('[data-setup="anchorNodeRowId"]');
      const psOpt = findOption(psSelect, pair.psName);
      const nodeOpt = findOption(nodeSelect, pair.node);
      if (psOpt) psSelect.value = psOpt.value;
      if (nodeOpt) nodeSelect.value = nodeOpt.value;
      psSelect?.dispatchEvent(new Event('input', { bubbles: true }));
      nodeSelect?.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  container.addEventListener('click', onClick, true);
  return () => container.removeEventListener('click', onClick, true);
}
