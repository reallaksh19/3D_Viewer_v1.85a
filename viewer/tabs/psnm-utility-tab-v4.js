import {
  PSNM_buildMatchTable,
  PSNM_createRunLogger,
  PSNM_deriveTransformFromAnchor,
  PSNM_parseMandatoryNodeRows,
  PSNM_parseNodeDiaRows,
  PSNM_parseNodePosition,
  PSNM_parseNodeRows,
  PSNM_parsePsPosition,
  PSNM_parsePsRows,
  PSNM_transformNodeToPsPosition,
} from './psnm-utility/psnm-match-engine.js';

const SAMPLE_PS = `PS NAME\tPosition\tp1bore\tMandatory
PS-12231/DATUM\tE 438023.221mm S 1140070.762mm U 1184.15mm\t150.00\t
PS-12697/DATUM\tE 604665.151mm S 1092727mm U 607.15mm\t100.00\t`;
const SAMPLE_NODE = `Node\tX\tY\tZ\tBore\tMandatory
22140\t-724492.312 mm.\t998.952 mm.\t-110590.633 mm.\t150\tYES
20015\t-699514.875 mm.\t3024.352 mm.\t-115566.000 mm.\t\t`;
const SAMPLE_DIA = `Node\tDia(mm)
22140\t168.3
20015\t273`;
const SAMPLE_MANDATORY_NODE = `Mandatory Node No
22140
20015
22220`;
const SAMPLE_MANDATORY_PS = `Mandatory PS Name
PS-12231/DATUM
PS-12697/DATUM`;

function h(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function csv(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function n(value, decimals = 3) { const x = Number(value); return Number.isFinite(x) ? x.toFixed(decimals) : '-'; }
function normalizePsName(value) { return String(value ?? '').trim().replace(/\.$/, ''); }
function countRows(text) { return Math.max(0, String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).filter((x) => !/^-{3,}$/.test(x)).length - 1); }
function triple(value, fallback) { const p = String(value || '').split(',').map((x) => Number(x.trim())); return p.length === 3 && p.every(Number.isFinite) ? { xMm: p[0], yMm: p[1], zMm: p[2] } : { xMm: fallback[0], yMm: fallback[1], zMm: fallback[2] }; }
function nextFrame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
async function copyText(text, ctx) { try { await navigator.clipboard.writeText(String(text || '')); ctx.showToast?.('Copied CSV.', 'success'); } catch (error) { ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error'); } }
function objectRowsCsv(rows) { if (!rows?.length) return ''; const keys = Array.from(rows.reduce((set, row) => { Object.keys(row || {}).forEach((key) => set.add(key)); return set; }, new Set())); return [keys.map(csv).join(','), ...rows.map((row) => keys.map((key) => csv(row?.[key])).join(','))].join('\n'); }
function coverageCsv(result) { return `Mandatory PS Coverage\n${objectRowsCsv(result.mandatoryPsCoverageRows || [])}\n\nMandatory Node Coverage\n${objectRowsCsv(result.mandatoryCoverageRows || [])}`; }

function parseMandatoryPsRows(text, logger = null) {
  const rows = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  for (const line of lines) {
    if (/mandatory|ps name|psname/i.test(line) && !/PS[-_/A-Z0-9]/i.test(line)) continue;
    const psName = normalizePsName(line.split(/\t| {2,}/)[0] || line);
    if (!psName || /^mandatory ps name$/i.test(psName)) continue;
    if (seen.has(psName)) {
      logger?.user?.('WARNING', 'Duplicate Mandatory PS', 'Mandatory PS Name List', psName, 'Mandatory PS appears more than once.', 'Remove duplicate entry from mandatory PS list.', { psName });
      continue;
    }
    seen.add(psName);
    rows.push({ psName, mandatorySource: 'MANDATORY_PS_LIST', rowIndex: rows.length + 1 });
  }
  return rows;
}

function makeFormState() {
  return {
    anchorPsName: 'PS-12231/DATUM',
    anchorNode: '22140',
    anchorPsPosition: 'E 438023.221mm S 1140070.762mm U 1184.15mm',
    anchorNodePosition: '-724492.312, 998.952, -110590.633',
    decimals: '0',
    boreMode: 'prefer',
    a1: '25,25,25',
    a2: '50,25,50',
    a3: '50,25,50',
    enableA1: true,
    enableA2: true,
    enableA3: true,
    ps: SAMPLE_PS,
    node: SAMPLE_NODE,
    dia: SAMPLE_DIA,
    mandatory: SAMPLE_MANDATORY_NODE,
    mandatoryPs: SAMPLE_MANDATORY_PS,
  };
}
function emptyResult() { return { boreMode: 'prefer', rows: [], candidateRows: [], mandatoryCoverageRows: [], mandatoryPsCoverageRows: [], userLog: [], debugLog: [] }; }
function makeStatus() { return { phase: 'Idle', detail: 'Paste tables, choose Anchor PS/Node from dropdowns, then run match.', percent: 0 }; }

function parsePsOptions(form) {
  try { return PSNM_parsePsRows(form.ps).map((row) => ({ value: row.psName, label: row.psName, position: row.position })); } catch { return []; }
}
function parseNodeOptions(form) {
  try {
    return PSNM_parseNodeRows(form.node).map((row) => {
      const position = Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z) ? `${row.x}, ${row.y}, ${row.z}` : row.position;
      return { value: row.node, label: row.node, position };
    });
  } catch { return []; }
}
function selectOptions(items, selectedValue) {
  if (!items.length) return '<option value="">Paste table first</option>';
  return items.map((item) => `<option value="${h(item.value)}" ${String(item.value) === String(selectedValue) ? 'selected' : ''}>${h(item.label)}</option>`).join('');
}
function syncAnchorFromTables(form) {
  const ps = parsePsOptions(form);
  const nodes = parseNodeOptions(form);
  const psFound = ps.find((item) => item.value === form.anchorPsName) || ps[0];
  const nodeFound = nodes.find((item) => item.value === form.anchorNode) || nodes[0];
  if (psFound) { form.anchorPsName = psFound.value; form.anchorPsPosition = psFound.position; }
  if (nodeFound) { form.anchorNode = nodeFound.value; form.anchorNodePosition = nodeFound.position; }
}

function installStyle() {
  if (document.getElementById('psnm-style-v4')) return;
  const style = document.createElement('style');
  style.id = 'psnm-style-v4';
  style.textContent = `
.psnm-root{min-height:100%;padding:22px;background:#0f1724;color:#d9e6f7;font-family:system-ui}.psnm-title{margin:0 0 6px;color:#8fc5ff}.psnm-sub{color:#9fb2c7;margin:0}.psnm-tile-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,220px));gap:16px;margin-top:18px}.psnm-launch-tile{height:160px;border:1px solid rgba(143,197,255,.25);border-radius:18px;background:linear-gradient(145deg,#10213a,#0b1220);color:#e8f2ff;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);display:grid;place-items:center;text-align:center;padding:16px}.psnm-launch-tile:hover{border-color:#8fc5ff;transform:translateY(-1px)}.psnm-tile-icon{font-size:42px;margin-bottom:8px}.psnm-tile-name{font-weight:800;font-size:15px}.psnm-tile-note{font-size:12px;color:#9fb2c7;margin-top:6px}.psnm-modal-bg{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px}.psnm-modal{width:min(1260px,97vw);height:min(860px,calc(95vh - 1cm));margin-top:1cm;display:flex;flex-direction:column;border:1px solid rgba(143,197,255,.25);border-radius:16px;background:#0f1724;color:#d9e6f7;overflow:hidden}.psnm-p2-fullscreen .psnm-modal{margin-top:0!important}.psnm-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(143,197,255,.16);background:#162238}.psnm-btn{border:1px solid rgba(143,197,255,.28);border-radius:8px;background:#1d4ed8;color:#fff;padding:8px 12px;cursor:pointer;font-weight:700}.psnm-btn-secondary{background:#111827}.psnm-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(143,197,255,.14);background:#101a2b}.psnm-tab-btn{border:1px solid rgba(143,197,255,.18);border-radius:999px;background:#0b1220;color:#b7c9dd;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:800}.psnm-tab-btn.active{background:#1d4ed8;color:#fff}.psnm-modal-body{flex:1;overflow:auto;padding:14px;display:grid;gap:14px}.psnm-panel{display:none}.psnm-panel.active{display:grid;gap:14px}.psnm-grid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:10px}.psnm-field{display:grid;gap:4px}.psnm-field label{font-size:12px;color:#b7c9dd;font-weight:700}.psnm-field input,.psnm-field textarea,.psnm-field select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.2);border-radius:8px;background:#0b1220;color:#e5edf7;padding:8px;font:12px ui-monospace,Consolas,monospace}.psnm-field textarea{min-height:150px;resize:vertical}.psnm-field input[readonly]{opacity:.78}.psnm-help{font-size:12px;line-height:1.45;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psnm-card{border:1px solid rgba(143,197,255,.2);border-radius:14px;background:#101a2b;overflow:hidden}.psnm-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(143,197,255,.15);background:#162238}.psnm-copy{font-size:12px;padding:6px 9px}.psnm-summary{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.psnm-summary div,.psnm-counts div,.psnm-anchor-grid div,.psnm-ranking-note div{background:#0b1220;border:1px solid rgba(143,197,255,.15);border-radius:10px;padding:9px}.psnm-summary b{display:block;color:#8fc5ff;font-size:18px}.psnm-summary span,.psnm-counts span{font-size:11px;color:#9fb2c7}.psnm-counts{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.psnm-anchor-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.psnm-ok{color:#86efac;font-weight:800}.psnm-warn{color:#fcd34d;font-weight:800}.psnm-error{color:#fca5a5;font-weight:800}.psnm-tablewrap{overflow:auto;max-height:520px}.psnm-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-table th,.psnm-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap;vertical-align:top}.psnm-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff}.psnm-badge{border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800}.psnm-badge-exact{background:rgba(34,197,94,.18);color:#86efac}.psnm-badge-approx_1,.psnm-badge-approx_2{background:rgba(245,158,11,.18);color:#fcd34d}.psnm-badge-approx_3{background:rgba(168,85,247,.18);color:#d8b4fe}.psnm-badge-coord_exact,.psnm-badge-coord_approx_1,.psnm-badge-coord_approx_2,.psnm-badge-coord_approx_3{background:rgba(14,165,233,.18);color:#7dd3fc}.psnm-badge-no_match,.psnm-badge-ambiguous{background:rgba(239,68,68,.16);color:#fca5a5}.psnm-chip{border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800}.psnm-chip-yes{background:rgba(59,130,246,.18);color:#93c5fd}.psnm-chip-no{background:rgba(148,163,184,.15);color:#cbd5e1}.psnm-decision-selected{color:#86efac;font-weight:800}.psnm-decision-ambiguous{color:#fca5a5;font-weight:800}.psnm-decision-rejected_by_rank{color:#fcd34d;font-weight:800}.psnm-candidate-card{border:1px solid rgba(143,197,255,.16);border-radius:12px;overflow:hidden;background:#0b1220}.psnm-candidate-card summary{cursor:pointer;padding:11px 12px;color:#cfe4ff;font-weight:800;background:#111827}.psnm-candidate-meta{color:#9fb2c7;font-size:12px;margin-left:8px}.psnm-ranking-note{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.psnm-status-covered{color:#86efac;font-weight:800}.psnm-status-uncovered{color:#fcd34d;font-weight:800}.psnm-status-missing_from_ps_table,.psnm-status-missing_from_node_table,.psnm-status-unmapped,.psnm-status-ambiguous{color:#fca5a5;font-weight:800}.psnm-log-row-error td:first-child{color:#fca5a5;font-weight:800}.psnm-log-row-warning td:first-child{color:#fcd34d;font-weight:800}.psnm-log-row-info td:first-child{color:#93c5fd;font-weight:800}.psnm-statusbar{border-top:1px solid rgba(143,197,255,.16);background:#0b1220;padding:9px 12px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.psnm-status-title{font-size:12px;font-weight:800;color:#cfe4ff}.psnm-status-detail{font-size:12px;color:#9fb2c7}.psnm-progress{height:7px;background:#111827;border-radius:999px;overflow:hidden;margin-top:6px}.psnm-progress-fill{height:100%;width:0%;background:#1d4ed8;transition:width .18s ease}.psnm-status-actions{display:flex;gap:8px;align-items:center}.psnm-filter{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 10px}.psnm-filter input[type=text]{min-width:260px}@media(max-width:1100px){.psnm-grid,.psnm-summary,.psnm-counts,.psnm-anchor-grid,.psnm-ranking-note{grid-template-columns:1fr}.psnm-modal{height:calc(96vh - 1cm)}.psnm-statusbar{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function badge(type) { return `<span class="psnm-badge psnm-badge-${h(String(type || '').toLowerCase())}">${h(type)}</span>`; }
function yesNo(value) { return `<span class="psnm-chip ${value ? 'psnm-chip-yes' : 'psnm-chip-no'}">${value ? 'YES' : 'NO'}</span>`; }
function statusClass(value) { return String(value || '').toLowerCase(); }
function resultCard(title, action, body) { return `<section class="psnm-card"><div class="psnm-card-head"><b>${h(title)}</b><button class="psnm-btn psnm-btn-secondary psnm-copy" data-psnm-action="${h(action)}">Copy CSV</button></div>${body}</section>`; }
function panel(id, active, content) { return `<section class="psnm-panel ${active === id ? 'active' : ''}" data-psnm-panel="${id}">${content}</section>`; }
function tabButton(id, label, active) { return `<button class="psnm-tab-btn ${active === id ? 'active' : ''}" data-psnm-tabbtn="${id}">${h(label)}</button>`; }

function summary(result) {
  const rows = result.rows || [];
  const nodeCov = result.mandatoryCoverageRows || [];
  const psCov = result.mandatoryPsCoverageRows || [];
  const exact = rows.filter((row) => row.matchType === 'EXACT').length;
  const coord = rows.filter((row) => String(row.matchType || '').startsWith('COORD_')).length;
  const nodeCovered = nodeCov.filter((row) => row.status === 'COVERED').length;
  const psCovered = psCov.filter((row) => row.status === 'COVERED').length;
  const warnings = (result.userLog || []).filter((row) => row.level === 'WARNING').length;
  const errors = (result.userLog || []).filter((row) => row.level === 'ERROR').length;
  return `<div class="psnm-summary"><div><b>${rows.length}</b><span>PS Rows</span></div><div><b>${exact}</b><span>Exact Bore</span></div><div><b>${coord}</b><span>Coord Only</span></div><div><b>${rows.filter((row) => row.matchType === 'NO_MATCH').length}</b><span>No Match</span></div><div><b>${nodeCovered}/${nodeCov.length}</b><span>Mandatory Node</span></div><div><b>${psCovered}/${psCov.length}</b><span>Mandatory PS</span></div><div><b>${h(result.boreMode || 'prefer')}</b><span>Bore Mode</span></div><div><b>${warnings}</b><span>Warnings</span></div><div><b>${errors}</b><span>Errors</span></div></div>`;
}
function tableCounts(form) { return `<div class="psnm-counts"><div><b>${countRows(form.ps)}</b><br><span>PS rows</span></div><div><b>${countRows(form.node)}</b><br><span>Node rows</span></div><div><b>${countRows(form.dia)}</b><br><span>Dia rows</span></div><div><b>${countRows(form.mandatory)}</b><br><span>Mandatory Node</span></div><div><b>${countRows(form.mandatoryPs)}</b><br><span>Mandatory PS</span></div></div>`; }
function helpBlock() { return `<div class="psnm-help"><b>Anchor inputs are now selected from imported data.</b><br>• Anchor PS Name dropdown is populated from the pasted PS table, and its position is fetched automatically.<br>• Anchor Node dropdown is populated from the pasted Node XYZ table, and its X,Y,Z coordinate is fetched automatically.<br>• Mandatory PS and Mandatory Node are explicit, independent coverage inputs.</div>`; }
function anchorCard(form) {
  let status = '<span class="psnm-error">CHECK REQUIRED</span>';
  let transformText = '-';
  let deltaText = '-';
  let psFound = '<span class="psnm-warn">MISSING</span>';
  let nodeFound = '<span class="psnm-warn">MISSING</span>';
  try {
    const anchor = { psName: form.anchorPsName, psPosition: form.anchorPsPosition, node: form.anchorNode, nodePosition: form.anchorNodePosition };
    const transform = PSNM_deriveTransformFromAnchor(anchor);
    const ps = PSNM_parsePsPosition(form.anchorPsPosition);
    const node = PSNM_parseNodePosition(form.anchorNodePosition);
    const nodePs = PSNM_transformNodeToPsPosition(node, transform, Number(form.decimals) || 0);
    const dE = Math.abs(ps.e - nodePs.e), dU = Math.abs(ps.u - nodePs.u), dS = Math.abs(ps.s - nodePs.s);
    status = dE <= 1 && dU <= 1 && dS <= 1 ? '<span class="psnm-ok">PASS</span>' : '<span class="psnm-error">FAIL</span>';
    transformText = `E=X+${n(transform.datumE)} | U=Y+${n(transform.datumU)} | S=Z+${n(transform.datumS)}`;
    deltaText = `ΔE=${n(dE)} | ΔU=${n(dU)} | ΔS=${n(dS)}`;
  } catch (error) { deltaText = h(error.message || error); }
  try { psFound = PSNM_parsePsRows(form.ps).some((row) => row.psName === form.anchorPsName) ? '<span class="psnm-ok">FOUND</span>' : psFound; } catch {}
  try { nodeFound = PSNM_parseNodeRows(form.node).some((row) => row.node === form.anchorNode) ? '<span class="psnm-ok">FOUND</span>' : nodeFound; } catch {}
  return `<section class="psnm-card"><div class="psnm-card-head"><b>Anchor Validation</b><span>${status}</span></div><div class="psnm-modal-body"><div class="psnm-anchor-grid"><div><b>Anchor PS</b><br>${psFound}</div><div><b>Anchor Node</b><br>${nodeFound}</div><div><b>Base Transform</b><br>${h(transformText)}</div><div><b>Anchor Delta</b><br>${h(deltaText)}</div></div></div></section>`;
}
function matchTable(rows) {
  if (!rows?.length) return '<div class="psnm-modal-body">No match output yet. Open Input tab and run match.</div>';
  return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>PS NAME</th><th>Node</th><th>Occ.</th><th>PS Mandatory</th><th>PS Source</th><th>Node Mandatory</th><th>Node Source</th><th>Type</th><th>Status</th><th>Bore Mode</th><th>Bore</th><th>Bore Source</th><th>Conflict</th><th>PS E</th><th>PS U</th><th>PS S</th><th>Node E</th><th>Node U</th><th>Node S</th><th>ΔE</th><th>ΔU</th><th>ΔS</th><th>Max Δ</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${h(row.psName)}</td><td>${h(row.matchingNode || '-')}</td><td>${h(row.occurrenceId || '-')}</td><td>${yesNo(row.isMandatoryPs)}</td><td>${h(row.psMandatorySource || '-')}</td><td>${yesNo(row.isMandatoryNode)}</td><td>${h(row.nodeMandatorySource || '-')}</td><td>${badge(row.matchType)}</td><td>${h(row.finalStatus || '-')}</td><td>${h(row.boreMode || '-')}</td><td>${h(row.boreStatus || '-')}</td><td>${h(row.nodeBoreSource || '-')}</td><td>${yesNo(row.boreConflict)}</td><td>${n(row.psE)}</td><td>${n(row.psU)}</td><td>${n(row.psS)}</td><td>${n(row.nodeE)}</td><td>${n(row.nodeU)}</td><td>${n(row.nodeS)}</td><td>${n(row.dxMm)}</td><td>${n(row.dyMm)}</td><td>${n(row.dzMm)}</td><td>${n(row.maxAxisDeltaMm)}</td></tr>`).join('')}</tbody></table></div>`;
}
function candidateTable(rows) {
  if (!rows?.length) return '<div class="psnm-modal-body">No candidate groups yet. Run matcher with enough nodes to see candidate ranking.</div>';
  const groups = new Map();
  rows.forEach((row) => { if (!groups.has(row.psName)) groups.set(row.psName, []); groups.get(row.psName).push(row); });
  return `<div class="psnm-modal-body"><div class="psnm-ranking-note"><div>1. Coord type</div><div>2. Mandatory pair</div><div>3. Bore policy</div><div>4. Lowest max Δ</div><div>5. Lowest 3D Δ</div><div>6. Non-terminal + row order</div></div>${Array.from(groups.entries()).map(([ps, list]) => `<details class="psnm-candidate-card" open><summary>${h(ps)} <span class="psnm-candidate-meta">${list.length} candidate(s)</span></summary><div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Rank</th><th>Decision</th><th>Node</th><th>Occ.</th><th>PS Mand.</th><th>Node Mand.</th><th>Type</th><th>Bore</th><th>ΔE</th><th>ΔU</th><th>ΔS</th><th>Why</th></tr></thead><tbody>${list.map((row, i) => `<tr><td>${i + 1}</td><td class="psnm-decision-${h(String(row.decision || '').toLowerCase())}">${h(row.decision)}</td><td>${h(row.matchingNode)}</td><td>${h(row.occurrenceId)}</td><td>${yesNo(row.isMandatoryPs)}</td><td>${yesNo(row.isMandatoryNode)}</td><td>${badge(row.matchType)}</td><td>${h(row.boreStatus)}</td><td>${n(row.dxMm)}</td><td>${n(row.dyMm)}</td><td>${n(row.dzMm)}</td><td>${h(row.reason)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</div>`;
}
function coverageTable(result) {
  const nodeRows = result.mandatoryCoverageRows || [];
  const psRows = result.mandatoryPsCoverageRows || [];
  if (!nodeRows.length && !psRows.length) return '<div class="psnm-modal-body">No mandatory node or PS coverage rows loaded.</div>';
  return `<div class="psnm-modal-body"><section class="psnm-card"><div class="psnm-card-head"><b>Mandatory Node Coverage</b></div><div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Node</th><th>Source</th><th>In Table</th><th>Occ.</th><th>Covered</th><th>Status</th><th>Matched PS</th></tr></thead><tbody>${nodeRows.map((row) => `<tr><td>${h(row.node)}</td><td>${h(row.mandatorySource || '-')}</td><td>${yesNo(row.inNodeTable)}</td><td>${h(row.occurrences)}</td><td>${h(row.coveredOccurrences)}</td><td class="psnm-status-${h(statusClass(row.status))}">${h(row.status)}</td><td>${h((row.matchedPsNames || []).join(', '))}</td></tr>`).join('')}</tbody></table></div></section><section class="psnm-card"><div class="psnm-card-head"><b>Mandatory PS Coverage</b></div><div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>PS Name</th><th>Source</th><th>Matched Node</th><th>Occ.</th><th>Node Mandatory</th><th>Status</th></tr></thead><tbody>${psRows.map((row) => `<tr><td>${h(row.psName)}</td><td>${h(row.mandatorySource || '-')}</td><td>${h(row.matchedNode || '-')}</td><td>${h(row.occurrenceId || '-')}</td><td>${yesNo(row.nodeMandatory)}</td><td class="psnm-status-${h(statusClass(row.status))}">${h(row.status)}</td></tr>`).join('')}</tbody></table></div></section></div>`;
}
function userTable(rows) { if (!rows?.length) return '<div class="psnm-modal-body">No user log items.</div>'; return `<div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Severity</th><th>Category</th><th>Source</th><th>Item</th><th>Reason</th><th>Suggested Action</th></tr></thead><tbody>${rows.map((row) => `<tr class="psnm-log-row-${h(String(row.level || '').toLowerCase())}"><td>${h(row.level)}</td><td>${h(row.category)}</td><td>${h(row.source)}</td><td>${h(row.item)}</td><td>${h(row.reason)}</td><td>${h(row.suggestedAction)}</td></tr>`).join('')}</tbody></table></div>`; }
function debugTable(rows) { if (!rows?.length) return '<div class="psnm-modal-body">No debug events.</div>'; return `<div class="psnm-modal-body"><div class="psnm-filter"><input type="text" data-psnm="debugSearch" placeholder="Search debug table"><label><input type="checkbox" data-psnm-level="INFO" checked> Info</label><label><input type="checkbox" data-psnm-level="WARNING" checked> Warning</label><label><input type="checkbox" data-psnm-level="ERROR" checked> Error</label><label><input type="checkbox" data-psnm-level="DEBUG"> Debug</label></div><div class="psnm-tablewrap"><table class="psnm-table"><thead><tr><th>Seq</th><th>Level</th><th>Code</th><th>Message</th><th>Key Data</th></tr></thead><tbody>${rows.map((row) => `<tr data-psnm-debug-row data-level="${h(row.level)}"><td>${h(row.sequence)}</td><td>${h(row.level)}</td><td>${h(row.code)}</td><td>${h(row.message)}</td><td>${h(JSON.stringify(row.data || {}).slice(0, 240))}</td></tr>`).join('')}</tbody></table></div></div>`; }
function statusBar(status, form) { return `<div class="psnm-statusbar"><div><div class="psnm-status-title">${h(status.phase)} — ${h(status.percent)}%</div><div class="psnm-status-detail">${h(status.detail)}</div><div class="psnm-progress"><div class="psnm-progress-fill" style="width:${Math.max(0, Math.min(100, Number(status.percent) || 0))}%"></div></div></div><div class="psnm-status-actions"><span class="psnm-status-detail">Mode ${h(form.boreMode)} | PS ${countRows(form.ps)} | Node ${countRows(form.node)} | Mandatory PS ${countRows(form.mandatoryPs)}</span><button class="psnm-btn" data-psnm-action="run">Run Match</button></div></div>`; }
function applyMandatoryPsList(psRows, mandatoryPsRows, logger) {
  const psByName = new Map(psRows.map((row) => [normalizePsName(row.psName), row]));
  const missing = [];
  for (const item of mandatoryPsRows) {
    const row = psByName.get(normalizePsName(item.psName));
    if (row) {
      row.isMandatoryPs = true;
      row.mandatorySource = row.mandatorySource ? `${row.mandatorySource};MANDATORY_PS_LIST` : 'MANDATORY_PS_LIST';
    } else {
      missing.push(item);
      logger.user('WARNING', 'Mandatory PS Missing', 'Mandatory PS Name List', item.psName, 'PS name is mandatory but absent from PS table.', 'Add the PS row or remove it from the Mandatory PS Name list.', item);
    }
  }
  return missing;
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  installStyle();
  let form = makeFormState();
  let result = emptyResult();
  let status = makeStatus();
  let activeTab = 'input';
  let refreshTimer = null;
  syncAnchorFromTables(form);

  function inputPanel() {
    const psOptions = parsePsOptions(form);
    const nodeOptions = parseNodeOptions(form);
    return `${anchorCard(form)}${helpBlock()}${tableCounts(form)}<div class="psnm-grid"><div class="psnm-field"><label>Anchor PS Name - fetched from PS table</label><select data-psnm-input="anchorPsName">${selectOptions(psOptions, form.anchorPsName)}</select></div><div class="psnm-field"><label>Anchor Node - fetched from Node XYZ table</label><select data-psnm-input="anchorNode">${selectOptions(nodeOptions, form.anchorNode)}</select></div><div class="psnm-field"><label>Anchor PS Position - auto fetched</label><input data-psnm-input="anchorPsPosition" value="${h(form.anchorPsPosition)}" readonly></div><div class="psnm-field"><label>Anchor Node X,Y,Z - auto fetched</label><input data-psnm-input="anchorNodePosition" value="${h(form.anchorNodePosition)}" readonly></div><div class="psnm-field"><label>Exact Decimals</label><input data-psnm-input="decimals" type="number" value="${h(form.decimals)}"></div><div class="psnm-field"><label>Bore Matching Mode</label><select data-psnm-input="boreMode"><option value="strict" ${form.boreMode === 'strict' ? 'selected' : ''}>Strict Bore - reject missing/different bore</option><option value="prefer" ${form.boreMode === 'prefer' ? 'selected' : ''}>Prefer Bore - coordinate match with bore ranking/warnings</option><option value="ignore" ${form.boreMode === 'ignore' ? 'selected' : ''}>Ignore Bore - coordinate only</option></select></div><div class="psnm-field"><label>Approx 1 ΔE,ΔU,ΔS mm</label><input data-psnm-input="a1" value="${h(form.a1)}"></div><div class="psnm-field"><label>Approx 2 ΔE,ΔU,ΔS mm</label><input data-psnm-input="a2" value="${h(form.a2)}"></div><div class="psnm-field"><label>Approx 3 ΔE,ΔU,ΔS mm</label><input data-psnm-input="a3" value="${h(form.a3)}"></div></div><div class="psnm-grid"><div class="psnm-field"><label>1. PS table: PS NAME / Position / p1bore / optional Mandatory column</label><textarea data-psnm-input="ps">${h(form.ps)}</textarea></div><div class="psnm-field"><label>2. Node XYZ table: Node / X / Y / Z / optional Bore / optional Mandatory</label><textarea data-psnm-input="node">${h(form.node)}</textarea></div><div class="psnm-field"><label>3. Node Dia table: Node / Dia(mm) fallback when Table 2 Bore is absent</label><textarea data-psnm-input="dia">${h(form.dia)}</textarea></div><div class="psnm-field"><label>4. Mandatory Node No list - explicit node coverage requirement</label><textarea data-psnm-input="mandatory">${h(form.mandatory)}</textarea></div><div class="psnm-field"><label>5. Mandatory PS Name list - explicit PS coverage requirement</label><textarea data-psnm-input="mandatoryPs">${h(form.mandatoryPs)}</textarea></div></div><div><label><input type="checkbox" data-psnm-input="enableA1" ${form.enableA1 ? 'checked' : ''}> Approx 1</label> <label><input type="checkbox" data-psnm-input="enableA2" ${form.enableA2 ? 'checked' : ''}> Approx 2</label> <label><input type="checkbox" data-psnm-input="enableA3" ${form.enableA3 ? 'checked' : ''}> Approx 3</label></div>`;
  }
  function modal() { return `<div class="psnm-modal-bg" data-psnm="modal" role="dialog" aria-modal="true" aria-labelledby="psnm-title"><div class="psnm-modal"><div class="psnm-modal-head"><div><h2 class="psnm-title" id="psnm-title">PSNM - PS Name vs Node Matcher</h2><p class="psnm-sub">Anchor PS/Node are selected from imported data. Coordinates are auto-fetched. Mandatory PS and Node are explicit.</p></div><button class="psnm-btn psnm-btn-secondary" data-psnm-action="close">Close</button></div><div class="psnm-tabs" role="tablist">${tabButton('input','Input',activeTab)}${tabButton('match','Match Preview',activeTab)}${tabButton('candidates','Candidate Resolver',activeTab)}${tabButton('coverage','Mandatory Coverage',activeTab)}${tabButton('user','User Log',activeTab)}${tabButton('debug','Debug Console',activeTab)}</div><div class="psnm-modal-body"><div data-psnm="summary">${summary(result)}</div>${panel('input',activeTab,inputPanel())}${panel('match',activeTab,resultCard('Match Preview','copyMatch',matchTable(result.rows)))}${panel('candidates',activeTab,resultCard('Candidate Resolver','copyCandidates',candidateTable(result.candidateRows)))}${panel('coverage',activeTab,resultCard('Mandatory Coverage','copyCoverage',coverageTable(result)))}${panel('user',activeTab,resultCard('User Log','copyUser',userTable(result.userLog)))}${panel('debug',activeTab,resultCard('Debug Console','copyDebug',debugTable(result.debugLog)))}</div>${statusBar(status, form)}</div></div>`; }
  function refreshInputPanel() { const p = container.querySelector('[data-psnm-panel="input"]'); if (p) p.innerHTML = inputPanel(); const old = container.querySelector('.psnm-statusbar'); if (old) old.outerHTML = statusBar(status, form); }
  function refreshResults() { const m = container.querySelector('[data-psnm="modal"]'); if (!m) return; const summaryBox = m.querySelector('[data-psnm="summary"]'); if (summaryBox) summaryBox.innerHTML = summary(result); const panels = { match: resultCard('Match Preview','copyMatch',matchTable(result.rows)), candidates: resultCard('Candidate Resolver','copyCandidates',candidateTable(result.candidateRows)), coverage: resultCard('Mandatory Coverage','copyCoverage',coverageTable(result)), user: resultCard('User Log','copyUser',userTable(result.userLog)), debug: resultCard('Debug Console','copyDebug',debugTable(result.debugLog)) }; Object.entries(panels).forEach(([id, html]) => { const p = m.querySelector(`[data-psnm-panel="${id}"]`); if (p) p.innerHTML = html; }); const old = m.querySelector('.psnm-statusbar'); if (old) old.outerHTML = statusBar(status, form); }
  function showTab(id) { activeTab = id; container.querySelectorAll('[data-psnm-tabbtn]').forEach((button) => button.classList.toggle('active', button.dataset.psnmTabbtn === id)); container.querySelectorAll('[data-psnm-panel]').forEach((panelEl) => panelEl.classList.toggle('active', panelEl.dataset.psnmPanel === id)); }
  function updateStatus(next) { status = { ...status, ...next }; const old = container.querySelector('.psnm-statusbar'); if (old) old.outerHTML = statusBar(status, form); }
  function readFormValue(key) { const el = container.querySelector(`[data-psnm-input="${key}"]`); return el?.type === 'checkbox' ? el.checked : (el?.value ?? ''); }
  function syncForm() { Object.keys(form).forEach((key) => { if (container.querySelector(`[data-psnm-input="${key}"]`) && key !== 'anchorPsPosition' && key !== 'anchorNodePosition') form[key] = readFormValue(key); }); syncAnchorFromTables(form); }
  async function run() {
    try {
      syncForm();
      updateStatus({ phase: 'Parsing pasted tables', detail: `Reading inputs. Bore Mode: ${form.boreMode}.`, percent: 10 });
      await nextFrame();
      const logger = PSNM_createRunLogger();
      const psRows = PSNM_parsePsRows(form.ps, logger);
      const mandatoryPsRows = parseMandatoryPsRows(form.mandatoryPs, logger);
      const missingMandatoryPs = applyMandatoryPsList(psRows, mandatoryPsRows, logger);
      const nodeRows = PSNM_parseNodeRows(form.node, logger);
      const nodeDiaRows = PSNM_parseNodeDiaRows(form.dia, logger);
      const mandatoryNodeRows = PSNM_parseMandatoryNodeRows(form.mandatory, logger);
      updateStatus({ phase: 'Matching candidates', detail: `PS ${psRows.length}, Mandatory PS ${mandatoryPsRows.length}, Node ${nodeRows.length}, Mandatory Node ${mandatoryNodeRows.length}.`, percent: 55 });
      await nextFrame();
      result = PSNM_buildMatchTable({ logger, anchor: { psName: form.anchorPsName, psPosition: form.anchorPsPosition, node: form.anchorNode, nodePosition: form.anchorNodePosition }, psRows, nodeRows, nodeDiaRows, mandatoryNodeRows, boreMode: form.boreMode, coordinateDecimals: Number(form.decimals) || 0, enableApprox1: form.enableA1, enableApprox2: form.enableA2, enableApprox3: form.enableA3, approx1: triple(form.a1, [25,25,25]), approx2: triple(form.a2, [50,25,50]), approx3: triple(form.a3, [50,25,50]) });
      for (const missing of missingMandatoryPs) result.mandatoryPsCoverageRows.push({ psName: missing.psName, mandatorySource: 'MANDATORY_PS_LIST', matchedNode: '', occurrenceId: '', nodeMandatory: false, status: 'MISSING_FROM_PS_TABLE' });
      updateStatus({ phase: 'Rendering output tables', detail: 'Updating match, candidates, coverage and logs.', percent: 85 });
      await nextFrame();
      refreshResults();
      showTab('match');
      const mapped = result.rows.filter((row) => String(row.finalStatus || '').startsWith('MATCHED')).length;
      updateStatus({ phase: 'Complete', detail: `Mapped ${mapped} of ${result.rows.length} PS row(s). Mandatory PS listed: ${mandatoryPsRows.length}.`, percent: 100 });
      ctx.showToast?.(`PSNM completed: ${mapped} mapped.`, 'success');
    } catch (error) {
      updateStatus({ phase: 'Failed', detail: String(error?.message || error), percent: 100 });
      ctx.showToast?.(`PSNM failed: ${error?.message || error}`, 'error');
    }
  }
  function onClick(event) { const tab = event.target?.closest?.('[data-psnm-tabbtn]')?.dataset?.psnmTabbtn; if (tab) { showTab(tab); return; } const action = event.target?.closest?.('[data-psnm-action]')?.dataset?.psnmAction; if (!action) return; if (action === 'open' && !container.querySelector('[data-psnm="modal"]')) { syncAnchorFromTables(form); container.insertAdjacentHTML('beforeend', modal()); } else if (action === 'close') container.querySelector('[data-psnm="modal"]')?.remove(); else if (action === 'run') void run(); else if (action === 'copyMatch') copyText(objectRowsCsv(result.rows), ctx); else if (action === 'copyCandidates') copyText(objectRowsCsv(result.candidateRows), ctx); else if (action === 'copyCoverage') copyText(coverageCsv(result), ctx); else if (action === 'copyUser') copyText(objectRowsCsv(result.userLog), ctx); else if (action === 'copyDebug') copyText(objectRowsCsv(result.debugLog), ctx); }
  function onInput(event) {
    const input = event.target?.closest?.('[data-psnm-input]');
    if (input) {
      const key = input.dataset.psnmInput;
      if (key !== 'anchorPsPosition' && key !== 'anchorNodePosition') form[key] = input.type === 'checkbox' ? input.checked : input.value;
      if (key === 'anchorPsName' || key === 'anchorNode') { syncAnchorFromTables(form); refreshInputPanel(); }
      else if (key === 'ps' || key === 'node') { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { syncAnchorFromTables(form); refreshInputPanel(); }, 250); }
      else { const old = container.querySelector('.psnm-statusbar'); if (old) old.outerHTML = statusBar({ ...status, phase: 'Edited', detail: 'Inputs changed. Run match to refresh output.', percent: Math.min(status.percent, 5) }, form); }
      return;
    }
    if (!event.target?.matches?.('[data-psnm="debugSearch"], [data-psnm-level]')) return;
    const search = String(container.querySelector('[data-psnm="debugSearch"]')?.value || '').toLowerCase();
    const levels = new Set(Array.from(container.querySelectorAll('[data-psnm-level]')).filter((x) => x.checked).map((x) => x.dataset.psnmLevel));
    container.querySelectorAll('[data-psnm-debug-row]').forEach((row) => { row.style.display = levels.has(row.dataset.level) && (!search || row.textContent.toLowerCase().includes(search)) ? '' : 'none'; });
  }
  function onKeydown(event) { if (event.key === 'Escape' && container.querySelector('[data-psnm="modal"]')) container.querySelector('[data-psnm="modal"]')?.remove(); }

  container.innerHTML = `<section class="psnm-root"><h1 class="psnm-title">Utilities</h1><p class="psnm-sub">Standalone utility tiles. This page intentionally shows only launch tiles; the full workbench opens in a popup.</p><div class="psnm-tile-grid"><button class="psnm-launch-tile" data-psnm-action="open" type="button"><div><div class="psnm-tile-icon">🔗</div><div class="psnm-tile-name">PSNM Matcher</div><div class="psnm-tile-note">PS Name ↔ Node, Mandatory PS/Node, Bore Mode, Debug</div></div></button></div></section>`;
  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  return () => { clearTimeout(refreshTimer); container.removeEventListener('click', onClick); container.removeEventListener('input', onInput); document.removeEventListener('keydown', onKeydown); };
}
