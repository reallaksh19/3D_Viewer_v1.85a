import {
  PS_MAPPING_SAMPLE_TABLE1,
  PS_MAPPING_SAMPLE_TABLE1A,
  PS_MAPPING_SAMPLE_TABLE1B,
  PS_MAPPING_SAMPLE_TABLE1C,
  PS_MAPPING_SAMPLE_TABLE1D,
  PS_MAPPING_SAMPLE_TABLE2,
} from './ps-mapping-utility/ps-mapping-sample-data.js';
import {
  DEFAULT_OPTIONS,
  runPsMappingResolver,
  rowsToCsv,
} from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260611-approx-overrides-1';

const STYLE_ID = 'ps-mapping-utility-style';

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countRows(text) {
  return Math.max(0, String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length - 1);
}

function displayList(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

function tableToTsv(rows = [], keys = []) {
  return [keys, ...rows.map((row) => keys.map((key) => displayList(row?.[key])))]
    .map((line) => line.map((value) => String(value ?? '').replace(/\t/g, ' ')).join('\t'))
    .join('\n');
}

function yn(value) {
  return value === true || String(value || '').toUpperCase() === 'YES' ? 'YES' : '';
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-tile{height:160px;width:220px;border:1px solid rgba(143,197,255,.25);border-radius:18px;background:linear-gradient(145deg,#10213a,#0b1220);color:#e8f2ff;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);display:grid;place-items:center;text-align:center;padding:16px;margin-top:18px}
.psmap-tile-icon{font-size:42px;margin-bottom:8px}.psmap-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.75);z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px}
.psmap-modal{width:min(1500px,98vw);height:min(940px,94vh);display:flex;flex-direction:column;background:#0f1724;color:#d9e6f7;border:1px solid rgba(143,197,255,.25);border-radius:16px;overflow:hidden}
.psmap-head,.psmap-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(143,197,255,.16);background:#162238}.psmap-title{margin:0;color:#8fc5ff}.psmap-sub{margin:4px 0 0;color:#9fb2c7;font-size:12px}
.psmap-btn{border:1px solid rgba(143,197,255,.28);border-radius:8px;background:#1d4ed8;color:#fff;padding:8px 12px;cursor:pointer;font-weight:700}.psmap-btn.secondary{background:#111827}.psmap-btn:disabled{opacity:.45;cursor:not-allowed}
.psmap-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(143,197,255,.14);background:#101a2b}.psmap-tab{border:1px solid rgba(143,197,255,.18);border-radius:999px;background:#0b1220;color:#b7c9dd;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:800}.psmap-tab.active{background:#1d4ed8;color:#fff}.psmap-tab.config{border-color:rgba(251,191,36,.55);color:#fde68a}
.psmap-body{flex:1;overflow:auto;padding:14px;display:grid;gap:14px}.psmap-panel{display:none}.psmap-panel.active{display:grid;gap:14px}.psmap-card{border:1px solid rgba(143,197,255,.2);border-radius:14px;background:#101a2b;overflow:hidden}.psmap-card-body{padding:12px;display:grid;gap:12px}.psmap-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.psmap-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.psmap-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.psmap-field{display:grid;gap:4px}.psmap-field label{font-size:12px;color:#b7c9dd;font-weight:800}.psmap-field input,.psmap-field textarea,.psmap-field select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.2);border-radius:8px;background:#0b1220;color:#e5edf7;padding:8px;font:12px ui-monospace,Consolas,monospace}.psmap-field textarea{min-height:150px;resize:vertical}.psmap-check{display:flex;align-items:center;gap:8px;font-size:12px;color:#d9e6f7}.psmap-help{display:inline-grid;place-items:center;width:18px;height:18px;border:1px solid rgba(143,197,255,.35);border-radius:999px;color:#93c5fd;font-size:12px;cursor:help}
.psmap-summary{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.psmap-summary div{background:#0b1220;border:1px solid rgba(143,197,255,.15);border-radius:10px;padding:9px}.psmap-summary b{display:block;color:#8fc5ff;font-size:18px}.psmap-summary span{font-size:11px;color:#9fb2c7}.psmap-banner{font-size:12px;line-height:1.5;color:#cfe4ff;border:1px solid rgba(143,197,255,.16);background:#0b1220;border-radius:10px;padding:10px}.psmap-banner.warn{border-color:rgba(251,191,36,.42);color:#fde68a}.psmap-mini{font-size:11px;color:#9fb2c7}
.psmap-tablewrap{overflow:auto;max-height:600px}.psmap-table{width:100%;border-collapse:collapse;font-size:12px}.psmap-table th,.psmap-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;white-space:nowrap;vertical-align:top}.psmap-table th{position:sticky;top:0;background:#1e293b;color:#9fc9ff;z-index:1}.psmap-table .psmap-group th{top:0;background:#0f2744;color:#dbeafe;border-bottom:1px solid rgba(143,197,255,.25);text-transform:uppercase;font-size:11px}.psmap-table .psmap-labels th{top:31px}.psmap-table td.group-source{background:rgba(59,130,246,.06)}.psmap-table td.group-operation{background:rgba(16,185,129,.05)}.psmap-table td.group-result{background:rgba(251,191,36,.05)}.psmap-table td.group-diagnostic{background:rgba(244,114,182,.05)}
@media(max-width:1100px){.psmap-grid-2,.psmap-grid-3,.psmap-grid-4,.psmap-summary{grid-template-columns:1fr}.psmap-modal{height:96vh}}`;
  document.head.appendChild(style);
}

function makeState() {
  return {
    activeTab: 'source',
    source: {
      table1Text: PS_MAPPING_SAMPLE_TABLE1,
      table1AText: PS_MAPPING_SAMPLE_TABLE1A,
      table1BText: PS_MAPPING_SAMPLE_TABLE1B,
      table1CText: PS_MAPPING_SAMPLE_TABLE1C,
      table1DText: PS_MAPPING_SAMPLE_TABLE1D,
      table2Text: PS_MAPPING_SAMPLE_TABLE2,
    },
    setup: { ...DEFAULT_OPTIONS },
    result: null,
  };
}

function tab(id, label, state, extraClass = '') {
  return `<button type="button" class="psmap-tab ${extraClass} ${state.activeTab === id ? 'active' : ''}" data-psmap-tab="${h(id)}">${h(label)}</button>`;
}

function panel(id, state, html) {
  return `<section class="psmap-panel ${state.activeTab === id ? 'active' : ''}" data-psmap-panel="${h(id)}">${html}</section>`;
}

function optionChecked(state, key) {
  return state.setup[key] === true ? 'checked' : '';
}

function help(text) {
  return `<span class="psmap-help" title="${h(text)}">i</span>`;
}

function presetOptions(value) {
  return `<option value="SERVICE_STEM_SIZE_OPTIONAL" ${value === 'SERVICE_STEM_SIZE_OPTIONAL' ? 'selected' : ''}>Service Stem, Size Optional</option><option value="STRICT_SIZE_SERVICE_STEM" ${value === 'STRICT_SIZE_SERVICE_STEM' ? 'selected' : ''}>Strict Size + Service Stem</option><option value="RAW_EXACT_ONLY" ${value === 'RAW_EXACT_ONLY' ? 'selected' : ''}>Raw Exact Only</option>`;
}

function visibleColumns(columns, state) {
  const showT1Regex = state.setup.showTable1LineRegexBasis === true;
  const showT2Regex = state.setup.showTable2LineRegexBasis === true;
  return columns.filter((column) => {
    if (column.regexSide === 'T1' && !showT1Regex) return false;
    if (column.regexSide === 'T2' && !showT2Regex) return false;
    return true;
  });
}

function groupClass(group) {
  const key = String(group || '').toLowerCase();
  if (key.includes('source') || key.includes('table')) return 'group-source';
  if (key.includes('operation') || key.includes('match') || key.includes('basis')) return 'group-operation';
  if (key.includes('result') || key.includes('status') || key.includes('confidence')) return 'group-result';
  return 'group-diagnostic';
}

function groupedHeader(columns) {
  const groups = [];
  for (const column of columns) {
    const group = column.group || 'Other';
    const last = groups[groups.length - 1];
    if (last && last.label === group) last.span += 1;
    else groups.push({ label: group, span: 1 });
  }
  return `<tr class="psmap-group">${groups.map((group) => `<th colspan="${group.span}">${h(group.label)}</th>`).join('')}</tr>`;
}

function table(rows = [], columns = [], state = null) {
  const cols = state ? visibleColumns(columns, state) : columns;
  if (!rows.length) return '<div class="psmap-banner">No rows.</div>';
  return `<div class="psmap-tablewrap"><table class="psmap-table"><thead>${groupedHeader(cols)}<tr class="psmap-labels">${cols.map((c) => `<th>${h(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td class="${groupClass(c.group)}">${h(displayList(c.value ? c.value(row) : row[c.key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function summary(state) {
  const s = state.result?.summary || {};
  return `<div class="psmap-summary"><div><b>${countRows(state.source.table1Text)}</b><span>Table-1 rows</span></div><div><b>${countRows(state.source.table1CText)}</b><span>Table-1C rows</span></div><div><b>${s.table1Rows ?? 0}</b><span>Consolidated T1</span></div><div><b>${s.table2Rows ?? 0}</b><span>Consolidated T2</span></div><div><b>${s.mapped ?? 0}</b><span>Mapped</span></div><div><b>${s.review ?? 0}</b><span>Review</span></div><div><b>${s.noMatch ?? 0}</b><span>No Match</span></div><div><b>${s.candidateRows ?? 0}</b><span>Candidates</span></div><div><b>${s.supportCoverageIssues ?? 0}</b><span>Coverage Issues</span></div></div>`;
}

function sourcePanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Source Tables</b><div><button class="psmap-btn secondary" data-psmap-action="loadSample">Load Sample</button> <button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div></div><div class="psmap-card-body"><div class="psmap-banner"><b>Table-1C can be simple Node/ISONOTE or rich Line No / Node / PS No / Pipe size / ISONOTE / Mandatory.</b> Rich Table-1C can synthesize Table-1/1A/1B reference data.</div><div class="psmap-grid-2"><div class="psmap-field"><label>Table-1 - PS No / Node Optional</label><textarea data-psmap-source="table1Text">${h(state.source.table1Text)}</textarea></div><div class="psmap-field"><label>Table-2 - Model PS Data</label><textarea data-psmap-source="table2Text">${h(state.source.table2Text)}</textarea></div></div><div class="psmap-grid-3"><div class="psmap-field"><label>Table-1A - Node / Dia Optional</label><textarea data-psmap-source="table1AText">${h(state.source.table1AText)}</textarea></div><div class="psmap-field"><label>Table-1B - Node / Line No Optional</label><textarea data-psmap-source="table1BText">${h(state.source.table1BText)}</textarea></div><div class="psmap-field"><label>Table-1D - Master Keyword Searcher</label><textarea data-psmap-source="table1DText">${h(state.source.table1DText)}</textarea></div></div><div class="psmap-field"><label>Table-1C - Support Master / ISONOTE Master</label><textarea data-psmap-source="table1CText" style="min-height:210px">${h(state.source.table1CText)}</textarea></div></div></section>`;
}

function setupPanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Resolver Setup</b><button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div><div class="psmap-card-body"><div class="psmap-grid-3"><div class="psmap-field"><label>Bore Mode</label><select data-psmap-setup="boreMode"><option value="prefer" ${state.setup.boreMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.boreMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.boreMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Line Mode</label><select data-psmap-setup="lineMode"><option value="prefer" ${state.setup.lineMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.lineMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.lineMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div><div class="psmap-field"><label>Support Mode</label><select data-psmap-setup="supportMode"><option value="prefer" ${state.setup.supportMode === 'prefer' ? 'selected' : ''}>Prefer</option><option value="strict" ${state.setup.supportMode === 'strict' ? 'selected' : ''}>Strict</option><option value="ignore" ${state.setup.supportMode === 'ignore' ? 'selected' : ''}>Ignore</option></select></div></div><div class="psmap-banner warn">Approximate line and approximate bore matching are controlled in <b>Config / Diagnostics</b> and are OFF by default.</div></div></section>`;
}

function configPanel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Config / Diagnostics</b><button class="psmap-btn" data-psmap-action="run">Run Mapping</button></div><div class="psmap-card-body"><div class="psmap-banner"><b>Line Family is size-free.</b> Examples: 6&quot;-S8811951, 6&quot;-S-8811951, and ASIM-1885-6&quot;-S-8811951-91261M7-HC all normalize to <b>S8811951</b>. Pipe size/DN is checked separately.</div><div class="psmap-grid-2"><label class="psmap-check"><input type="checkbox" data-psmap-setup="attemptApproxLineMatch" ${optionChecked(state, 'attemptApproxLineMatch')}> Attempt Approx Line No. match ${help('OFF by default. When enabled, after exact size-free Line Family fails, compare Table-2 and Table-1 families using edit distance. Distance <= max becomes LINE_FAMILY_NEAR_MISMATCH / USER_REVIEW_REQUIRED. It never auto-corrects or auto-approves.')}</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="attemptApproxBoreMatch" ${optionChecked(state, 'attemptApproxBoreMatch')}> Approx Bore match ${help('OFF by default. Exact DN matching remains enabled. When ON, raw/OD tolerance matching is allowed using OD tolerance. This can produce BORE_OD or BORE_OD_APPROX basis.')}</label></div><div class="psmap-grid-2"><div class="psmap-field"><label>Table-1 Line Regex Preset</label><select data-psmap-setup="lineFamilyTable1Preset">${presetOptions(state.setup.lineFamilyTable1Preset)}</select></div><div class="psmap-field"><label>Table-2 Line Regex Preset</label><select data-psmap-setup="lineFamilyTable2Preset">${presetOptions(state.setup.lineFamilyTable2Preset)}</select></div></div><div class="psmap-grid-3"><label class="psmap-check"><input type="checkbox" data-psmap-setup="showTable1LineRegexBasis" ${optionChecked(state, 'showTable1LineRegexBasis')}> Show Table-1 regex basis</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="showTable2LineRegexBasis" ${optionChecked(state, 'showTable2LineRegexBasis')}> Show Table-2 regex basis</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="normalizeServiceDash" ${optionChecked(state, 'normalizeServiceDash')}> Normalize service dash: S-8811951 → S8811951</label></div><div class="psmap-grid-3"><label class="psmap-check"><input type="checkbox" data-psmap-setup="stripLeadingSlashForLine" ${optionChecked(state, 'stripLeadingSlashForLine')}> Strip leading slash</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="stripProjectPrefixForLine" ${optionChecked(state, 'stripProjectPrefixForLine')}> Strip project prefix for line-family extraction</label><label class="psmap-check"><input type="checkbox" data-psmap-setup="enableNearLineDiagnostic" ${optionChecked(state, 'enableNearLineDiagnostic')}> Enable near diagnostic engine flag</label></div><div class="psmap-grid-4"><div class="psmap-field"><label>Near max edit distance</label><input type="number" min="0" max="3" step="1" data-psmap-setup="nearLineMaxEditDistance" value="${h(state.setup.nearLineMaxEditDistance)}"></div><div class="psmap-field"><label>Near min stem length</label><input type="number" min="1" max="20" step="1" data-psmap-setup="nearLineMinStemLength" value="${h(state.setup.nearLineMinStemLength)}"></div><div class="psmap-field"><label>OD tolerance mm</label><input type="number" min="0" max="25" step="0.1" data-psmap-setup="odToleranceMm" value="${h(state.setup.odToleranceMm)}"></div><label class="psmap-check"><input type="checkbox" data-psmap-setup="nearLineReviewOnly" ${optionChecked(state, 'nearLineReviewOnly')}> Near diagnostic review-only</label></div><div class="psmap-banner"><b>Near diagnostic logic:</b> Requires <b>Attempt Approx Line No. match</b> ON. After Base PS matches, exact size-free line-family match fails, and DN/support are otherwise acceptable, the resolver calculates edit distance between Table-2 and Table-1 line families. Distance ≤ max becomes LINE_FAMILY_NEAR_MISMATCH and USER_REVIEW_REQUIRED; no auto-correction.</div><div class="psmap-banner"><b>Approx bore logic:</b> Requires <b>Approx Bore match</b> ON. Table-1C Pipe size → DN and Table-1A Dia → derived DN remain exact engineering checks when OFF. ON adds raw/OD tolerance matching using OD tolerance mm.</div></div></section>`;
}

const CONSOLIDATED_T1_COLUMNS = [
  { group: 'Source', key: 'id', label: 'ID' }, { group: 'Source', key: 'source', label: 'Source' }, { group: 'Source', key: 'sourceRow', label: 'Source Row' }, { group: 'Source', key: 'mandatory', label: 'Mandatory', value: (r) => yn(r.mandatory) },
  { group: 'PS / Node', key: 'table1PsNo', label: 'Table-1 PS No' }, { group: 'PS / Node', key: 'basePs', label: 'Base PS' }, { group: 'PS / Node', key: 'tag', label: 'Tag' }, { group: 'PS / Node', key: 'node', label: 'Node' },
  { group: 'Line Diagnostics', key: 'nodeLine', label: 'Line No' }, { group: 'Line Diagnostics', key: 'lineFamily', label: 'Line Family' }, { group: 'Line Diagnostics', key: 'lineRegexBasis', label: 'Regex Basis', regexSide: 'T1' }, { group: 'Line Diagnostics', key: 'lineNormalized', label: 'Normalized', regexSide: 'T1' }, { group: 'Line Diagnostics', key: 'lineTransforms', label: 'Transforms', regexSide: 'T1' }, { group: 'Line Diagnostics', key: 'lineWarning', label: 'Line Warning' },
  { group: 'Bore / Size', key: 'pipeSizeRaw', label: 'Pipe Size' }, { group: 'Bore / Size', key: 'nps', label: 'NPS' }, { group: 'Bore / Size', key: 'derivedDn', label: 'Derived DN' }, { group: 'Bore / Size', key: 'nodeDia', label: 'Dia/OD' }, { group: 'Bore / Size', key: 'boreSource', label: 'Bore Source' },
  { group: 'Support', key: 'nodeIsonote', label: 'ISONOTE' }, { group: 'Support', key: 'supportTypesAvailable', label: 'Master Keywords' },
];
const CONSOLIDATED_T2_COLUMNS = [
  { group: 'Source', key: 'id', label: 'ID' }, { group: 'Source', key: 'sourceRow', label: 'Source Row' }, { group: 'Source', key: 'mandatory', label: 'Mandatory', value: (r) => yn(r.mandatory) }, { group: 'Source', key: 'rawColumns', label: 'Raw Columns', value: (r) => JSON.stringify(r.rawColumns || {}, null, 2) },
  { group: 'PS', key: 'psnoModel', label: 'PSNO_Model' }, { group: 'PS', key: 'basePs', label: 'Base PS' }, { group: 'PS', key: 'modelTag', label: 'Model Tag' }, { group: 'PS', key: 'isDatum', label: 'Datum', value: (r) => yn(r.isDatum) },
  { group: 'Bore', key: 'boreRaw', label: 'Bore Raw' }, { group: 'Bore', key: 'bore', label: 'Bore' }, { group: 'Bore', key: 'boreStatus', label: 'Bore Status' },
  { group: 'Line Diagnostics', key: 'pipe', label: 'Pipe' }, { group: 'Line Diagnostics', key: 'pipeKey', label: 'Pipe Key' }, { group: 'Line Diagnostics', key: 'lineFamily', label: 'Line Family' }, { group: 'Line Diagnostics', key: 'lineRegexBasis', label: 'Regex Basis', regexSide: 'T2' }, { group: 'Line Diagnostics', key: 'lineNormalized', label: 'Normalized', regexSide: 'T2' }, { group: 'Line Diagnostics', key: 'lineTransforms', label: 'Transforms', regexSide: 'T2' }, { group: 'Line Diagnostics', key: 'lineWarning', label: 'Line Warning' },
  { group: 'Support', key: 'dtxr', label: 'DTXR' }, { group: 'Support', key: 'supportTypesRequested', label: 'DTXR Keywords' },
  { group: 'Diagnostics', key: 'parseWarnings', label: 'Parse Warnings' },
];
const VALIDATOR_COLUMNS = [
  { group: 'Table-2 Source', key: 'psnoModel', label: 'PSNO_Model' }, { group: 'Table-2 Source', key: 'modelBore', label: 'T2 Bore' }, { group: 'Table-2 Source', key: 'modelLineFamily', label: 'T2 Line Family' }, { group: 'Table-2 Source', key: 'dtxr', label: 'T2 DTXR' }, { group: 'Table-2 Source', key: 'mandatory', label: 'T2 Mandatory', value: (r) => yn(r.mandatory) },
  { group: 'Table-1 Match', key: 'node', label: 'Node' }, { group: 'Table-1 Match', key: 'table1PsNo', label: 'Table-1 PS No' }, { group: 'Table-1 Match', key: 'tag', label: 'Tag' }, { group: 'Table-1 Match', key: 'source', label: 'T1 Source' }, { group: 'Table-1 Match', key: 'nodeLineFamily', label: 'T1 Line Family' }, { group: 'Table-1 Match', key: 'derivedDn', label: 'T1 Derived DN' },
  { group: 'Match Basis', key: 'supportMatch', label: 'Support Match' }, { group: 'Match Basis', key: 'basis', label: 'Basis' }, { group: 'Match Basis', key: 'modelLineRegexBasis', label: 'T2 Regex Basis', regexSide: 'T2' }, { group: 'Match Basis', key: 'nodeLineRegexBasis', label: 'T1 Regex Basis', regexSide: 'T1' }, { group: 'Match Basis', key: 'nearDistance', label: 'Near Distance' },
  { group: 'Result', key: 'enabled', label: 'Enabled', value: (r) => yn(r.enabled) }, { group: 'Result', key: 'finalStatus', label: 'Final Status' }, { group: 'Result', key: 'confidence', label: 'Confidence' }, { group: 'Result', key: 'confidenceScore', label: 'Confidence Score' },
  { group: 'Diagnostics / Action', key: 'reviewAction', label: 'Review Action' }, { group: 'Diagnostics / Action', key: 'lineWarning', label: 'Line Warning' }, { group: 'Diagnostics / Action', key: 'warnings', label: 'Warnings' }, { group: 'Diagnostics / Action', key: 'nodeCoverageNote', label: 'Node Coverage Note' },
];
const CANDIDATE_COLUMNS = [
  { group: 'Table-2 Source', key: 'psnoModel', label: 'PSNO_Model' }, { group: 'Table-2 Source', key: 'modelBore', label: 'T2 Bore' }, { group: 'Table-2 Source', key: 'lineFamily', label: 'T2 Line Family' }, { group: 'Table-2 Source', key: 'supportTypesRequested', label: 'T2 Keywords' },
  { group: 'Table-1 Candidate', key: 'candidateNode', label: 'Candidate Node' }, { group: 'Table-1 Candidate', key: 'table1PsNo', label: 'Table-1 PS No' }, { group: 'Table-1 Candidate', key: 'tag', label: 'Tag' }, { group: 'Table-1 Candidate', key: 'source', label: 'Source' }, { group: 'Table-1 Candidate', key: 'nodeLineFamily', label: 'T1 Line Family' }, { group: 'Table-1 Candidate', key: 'pipeSizeRaw', label: 'Pipe Size' }, { group: 'Table-1 Candidate', key: 'derivedDn', label: 'Derived DN' }, { group: 'Table-1 Candidate', key: 'nodeIsonote', label: 'ISONOTE' },
  { group: 'Match Basis', key: 'psBasis', label: 'PS Basis' }, { group: 'Match Basis', key: 'boreBasis', label: 'Bore Basis' }, { group: 'Match Basis', key: 'lineBasis', label: 'Line Basis' }, { group: 'Match Basis', key: 'supportBasis', label: 'Support Basis' }, { group: 'Match Basis', key: 'supportMatch', label: 'Support Match' }, { group: 'Match Basis', key: 'lineRegexBasis', label: 'T2 Regex Basis', regexSide: 'T2' }, { group: 'Match Basis', key: 'nodeLineRegexBasis', label: 'T1 Regex Basis', regexSide: 'T1' }, { group: 'Match Basis', key: 'nearDistance', label: 'Near Distance' },
  { group: 'Result', key: 'eligible', label: 'Eligible', value: (r) => yn(r.eligible) }, { group: 'Result', key: 'autoSelectable', label: 'Auto Selectable', value: (r) => yn(r.autoSelectable) }, { group: 'Result', key: 'reviewRequired', label: 'Review Required', value: (r) => yn(r.reviewRequired) }, { group: 'Result', key: 'selected', label: 'Selected', value: (r) => yn(r.selected) }, { group: 'Result', key: 'finalStatus', label: 'Final Status' }, { group: 'Result', key: 'confidence', label: 'Confidence' }, { group: 'Result', key: 'confidenceScore', label: 'Confidence Score' }, { group: 'Result', key: 'score', label: 'Score' },
  { group: 'Diagnostics / Action', key: 'warnings', label: 'Warnings' }, { group: 'Diagnostics / Action', key: 'reason', label: 'Reason' }, { group: 'Diagnostics / Action', key: 'nodeCoverageNote', label: 'Node Coverage Note' },
];
const COVERAGE_COLUMNS = [
  { group: 'Table-1 Source', key: 'node', label: 'Node' }, { group: 'Table-1 Source', key: 'table1PsNo', label: 'Table-1 PS No' }, { group: 'Table-1 Source', key: 'tag', label: 'Tag' }, { group: 'Table-1 Source', key: 'source', label: 'Source' }, { group: 'Table-1 Source', key: 'lineNo', label: 'Line No' }, { group: 'Table-1 Source', key: 'lineFamily', label: 'Line Family' }, { group: 'Table-1 Source', key: 'pipeSizeRaw', label: 'Pipe Size' }, { group: 'Table-1 Source', key: 'derivedDn', label: 'Derived DN' }, { group: 'Table-1 Source', key: 'isonote', label: 'ISONOTE' }, { group: 'Table-1 Source', key: 'mandatory', label: 'Mandatory' },
  { group: 'Coverage Operation', key: 'masterKeywords', label: 'Master Keywords' }, { group: 'Coverage Operation', key: 'mappedPsnoModel', label: 'Mapped PSNO_Model' }, { group: 'Coverage Operation', key: 'coveredDtxrKeywords', label: 'Covered DTXR Keywords' }, { group: 'Coverage Operation', key: 'missingMasterKeywords', label: 'Missing Master Keywords' }, { group: 'Coverage Operation', key: 'extraDtxrKeywords', label: 'Extra DTXR Keywords' },
  { group: 'Result / Action', key: 'coverageStatus', label: 'Coverage Status' }, { group: 'Result / Action', key: 'action', label: 'Action' },
];
const USER_LOG_COLUMNS = [
  { group: 'Source', key: 'level', label: 'Level' }, { group: 'Source', key: 'stage', label: 'Stage' }, { group: 'Source', key: 'psnoModel', label: 'PSNO_Model' }, { group: 'Source', key: 'node', label: 'Node' }, { group: 'Source', key: 'table1PsNo', label: 'Table-1 PS No' }, { group: 'Source', key: 'tag', label: 'Tag' },
  { group: 'Message', key: 'subject', label: 'Subject' }, { group: 'Message', key: 'message', label: 'Message' }, { group: 'Action', key: 'action', label: 'Action' },
];
const DEBUG_COLUMNS = [
  { group: 'Log', key: 'time', label: 'Time' }, { group: 'Log', key: 'level', label: 'Level' }, { group: 'Log', key: 'code', label: 'Code' }, { group: 'Log', key: 'subject', label: 'Subject' }, { group: 'Details', key: 'details', label: 'Details', value: (r) => JSON.stringify(r.details || {}) },
];

function consolidatedTable1Panel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Consolidated Table-1</b><button class="psmap-btn secondary" data-psmap-action="copyT1">Copy Consolidated T1</button></div><div class="psmap-card-body"><div class="psmap-banner">Grouped by Source → PS/Node → Line Diagnostics → Bore/Size → Support. This is the exact Table-1 reference model passed into the resolver.</div>${table(state.result?.consolidatedTable1Rows || [], CONSOLIDATED_T1_COLUMNS, state)}</div></section>`;
}
function consolidatedTable2Panel(state) {
  return `<section class="psmap-card"><div class="psmap-card-head"><b>Consolidated Table-2</b><button class="psmap-btn secondary" data-psmap-action="copyT2">Copy Consolidated T2</button></div><div class="psmap-card-body"><div class="psmap-banner">Grouped by Source → PS → Bore → Line Diagnostics → Support → Diagnostics. This shows exactly how model Table-2 was parsed before matching.</div>${table(state.result?.consolidatedTable2Rows || [], CONSOLIDATED_T2_COLUMNS, state)}</div></section>`;
}
function validatorPanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 2 Validator</b><button class="psmap-btn secondary" data-psmap-action="copyOutput">Copy CSV</button></div><div class="psmap-card-body"><div class="psmap-banner">Grouped by Table-2 Source → Table-1 Match → Match Basis → Result → Diagnostics / Action.</div>${table(state.result?.rows || [], VALIDATOR_COLUMNS, state)}</div></section>`; }
function candidatesPanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Candidate Matrix</b><button class="psmap-btn secondary" data-psmap-action="copyCandidates">Copy Candidates</button></div><div class="psmap-card-body"><div class="psmap-banner">Grouped by Table-2 Source → Table-1 Candidate → Match Basis → Result → Diagnostics / Action. Approx line and duplicate equivalent candidates are review-only.</div>${table(state.result?.candidates || [], CANDIDATE_COLUMNS, state)}</div></section>`; }
function coveragePanel(state) { return `<section class="psmap-card"><div class="psmap-card-head"><b>Table 1 Support Coverage</b><button class="psmap-btn secondary" data-psmap-action="copyCoverage">Copy Coverage</button></div><div class="psmap-card-body">${table(state.result?.supportCoverageRows || [], COVERAGE_COLUMNS, state)}</div></section>`; }
function logPanel(state, debug = false) { return `<section class="psmap-card"><div class="psmap-card-head"><b>${debug ? 'Debug Log' : 'User Log'}</b><button class="psmap-btn secondary" data-psmap-action="${debug ? 'copyDebug' : 'copyUser'}">Copy</button></div><div class="psmap-card-body">${table(debug ? state.result?.debugLog || [] : state.result?.userLog || [], debug ? DEBUG_COLUMNS : USER_LOG_COLUMNS, state)}</div></section>`; }

function renderModal(state) {
  return `<div class="psmap-backdrop" data-psmap-modal><div class="psmap-modal"><div class="psmap-head"><div><h2 class="psmap-title">PS Mapping Utility</h2><p class="psmap-sub">Consolidated Table-1 + Consolidated Table-2 → Resolver → Validator</p><p class="psmap-sub"><b>Config / Diagnostics</b> is available as a highlighted tab. Approx Line and Approx Bore are OFF by default.</p></div><button class="psmap-btn secondary" data-psmap-action="close">Close</button></div><div class="psmap-tabs">${tab('source', 'Source Tables', state)}${tab('setup', 'Resolver Setup', state)}${tab('config', '⚙ Config / Diagnostics', state, 'config')}${tab('ct1', 'Consolidated Table-1', state)}${tab('ct2', 'Consolidated Table-2', state)}${tab('validator', 'Table 2 Validator', state)}${tab('coverage', 'Table 1 Support Coverage', state)}${tab('candidates', 'Candidate Matrix', state)}${tab('user', 'User Log', state)}${tab('debug', 'Debug Log', state)}</div><div class="psmap-body">${summary(state)}${panel('source', state, sourcePanel(state))}${panel('setup', state, setupPanel(state))}${panel('config', state, configPanel(state))}${panel('ct1', state, consolidatedTable1Panel(state))}${panel('ct2', state, consolidatedTable2Panel(state))}${panel('validator', state, validatorPanel(state))}${panel('coverage', state, coveragePanel(state))}${panel('candidates', state, candidatesPanel(state))}${panel('user', state, logPanel(state, false))}${panel('debug', state, logPanel(state, true))}</div></div></div>`;
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  installStyle();
  const root = document.createElement('div');
  root.innerHTML = `<button type="button" class="psmap-tile" data-psmap-action="open"><div><div class="psmap-tile-icon">🧭</div><div><b>PS Mapping Utility</b></div><div class="psmap-sub">Support PS → Model PS</div></div></button>`;
  container.appendChild(root);
  let state = makeState();

  function refresh() {
    const modal = document.querySelector('[data-psmap-modal]');
    if (modal) modal.outerHTML = renderModal(state);
  }
  function run() {
    state.result = runPsMappingResolver({
      table1PsNodeText: state.source.table1Text,
      table1aNodeDiaText: state.source.table1AText,
      table1bNodeLineText: state.source.table1BText,
      table1cNodeIsonoteText: state.source.table1CText,
      table1dKeywordText: state.source.table1DText,
      table2ModelText: state.source.table2Text,
      options: state.setup,
    });
    state.activeTab = 'ct2';
    refresh();
    const review = state.result.summary.review || 0;
    ctx.showToast?.(`PS Mapping complete: ${state.result.summary.mapped} mapped, ${review} review, ${state.result.summary.noMatch} no match.`, state.result.summary.noMatch || review ? 'warning' : 'success');
  }
  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => ctx.showToast?.('Copied.', 'success')).catch((error) => ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error'));
  }

  function onClick(event) {
    const action = event.target?.closest?.('[data-psmap-action]')?.dataset?.psmapAction;
    const tabBtn = event.target?.closest?.('[data-psmap-tab]');
    if (tabBtn) { state.activeTab = tabBtn.dataset.psmapTab; refresh(); return; }
    if (!action) return;
    if (action === 'open') { document.body.insertAdjacentHTML('beforeend', renderModal(state)); return; }
    if (action === 'close') { document.querySelector('[data-psmap-modal]')?.remove(); return; }
    if (action === 'loadSample') { state = makeState(); refresh(); return; }
    if (action === 'run') { run(); return; }
    if (action === 'copyOutput') copy(rowsToCsv(state.result?.rows || []));
    if (action === 'copyT1') copy(tableToTsv(state.result?.consolidatedTable1Rows || [], visibleColumns(CONSOLIDATED_T1_COLUMNS, state).map((c) => c.key)));
    if (action === 'copyT2') copy(tableToTsv(state.result?.consolidatedTable2Rows || [], visibleColumns(CONSOLIDATED_T2_COLUMNS, state).map((c) => c.key)));
    if (action === 'copyCandidates') copy(tableToTsv(state.result?.candidates || [], visibleColumns(CANDIDATE_COLUMNS, state).map((c) => c.key)));
    if (action === 'copyCoverage') copy(tableToTsv(state.result?.supportCoverageRows || [], COVERAGE_COLUMNS.map((c) => c.key)));
    if (action === 'copyUser') copy(tableToTsv(state.result?.userLog || [], USER_LOG_COLUMNS.map((c) => c.key)));
    if (action === 'copyDebug') copy(tableToTsv(state.result?.debugLog || [], ['time', 'level', 'code', 'subject', 'details']));
  }
  function onInput(event) {
    const source = event.target?.closest?.('[data-psmap-source]');
    if (source) { state.source[source.dataset.psmapSource] = source.value; return; }
    const setup = event.target?.closest?.('[data-psmap-setup]');
    if (setup) {
      const key = setup.dataset.psmapSetup;
      if (setup.type === 'checkbox') state.setup[key] = setup.checked;
      else if (setup.type === 'number') state.setup[key] = Number(setup.value);
      else state.setup[key] = setup.value;
    }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('input', onInput);
    document.removeEventListener('change', onInput);
    root.remove();
  };
}
