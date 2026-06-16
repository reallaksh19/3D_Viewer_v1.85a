import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260611-psmap-support-gap-rules-1';
import {
  evaluateSupportGapComparison,
  extractTypedSupportGaps,
  supportTypesFromText,
} from './ps-mapping-utility/ps-mapping-support-gap-logic.js?v=20260614-support-parent-gap-1';

const DEFAULT_SUPPORT_KEYWORD_RULES_TEXT = `Pattern	Canonical
REST	REST
PIPE REST	REST
XRT	REST
GUIDE	GUIDE
LINE STOP	LINE_STOP
LINESTOP	LINE_STOP
PIPE STOP	LINE_STOP
STOP	LINE_STOP
ANCHOR	LINE_STOP
PIPE ANCHOR	LINE_STOP
*WEAR PLATE*	REST
*Directional Anchor*	LINE_STOP
*PIPE SHOE*	REST`;

const supportOptionState = {
  useBuiltInSupportKeywordLogic: true,
  enableSupportGapComparison: true,
  supportGapToleranceMm: 0,
  supportKeywordRulesText: DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
};

const CANONICAL_VALUES = ['REST', 'GUIDE', 'LINE_STOP'];

function installSupportKeywordTableStyle() {
  if (document.getElementById('psmap-skr-style')) return;
  const s = document.createElement('style');
  s.id = 'psmap-skr-style';
  s.textContent = `.psmap-skr-table{width:100%;border-collapse:collapse;font-size:12px}.psmap-skr-table th{background:#1e293b;color:#9fc9ff;padding:5px 8px;text-align:left;border-bottom:1px solid rgba(143,197,255,.2);font-weight:700}.psmap-skr-table td{border-bottom:1px solid rgba(143,197,255,.08);padding:3px 4px;vertical-align:middle}.psmap-skr-input{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.18);border-radius:6px;background:#0b1220;color:#e5edf7;padding:4px 7px;font:12px ui-monospace,Consolas,monospace}.psmap-skr-input:focus{outline:none;border-color:rgba(143,197,255,.55)}.psmap-skr-del{border:none;background:rgba(239,68,68,.12);color:#fca5a5;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:11px;line-height:1.4}.psmap-skr-del:hover{background:rgba(239,68,68,.28)}.psmap-skr-add-row{margin-top:6px;padding:4px 10px;font-size:11px}`;
  document.head.appendChild(s);
}

function parseKeywordRules(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^pattern\b/i.test(l)).map((l) => {
    const parts = l.split(/\t/);
    return { pattern: (parts[0] || '').trim(), canonical: ((parts[1] || '').trim().toUpperCase() || 'REST') };
  });
}

function rulesToText(rules) {
  return ['Pattern\tCanonical', ...rules.map((r) => `${r.pattern}\t${r.canonical}`)].join('\n');
}

function renderSkrRows(rules) {
  return rules.map((r, i) => `<tr data-psmap-skr-row="${i}">
    <td><input class="psmap-skr-input" type="text" value="${h(r.pattern)}" data-psmap-skr-col="pattern"></td>
    <td><select class="psmap-skr-input" data-psmap-skr-col="canonical">${CANONICAL_VALUES.map((v) => `<option value="${v}"${v === r.canonical ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
    <td><button type="button" class="psmap-skr-del" data-psmap-skr-action="delete-row">✕</button></td>
  </tr>`).join('');
}

function syncSkrTextarea(card) {
  const tbody = card.querySelector('[data-psmap-skr-body]');
  const hidden = card.querySelector('[data-psmap-skr-hidden]');
  if (!tbody || !hidden) return;
  const rules = [];
  for (const row of tbody.querySelectorAll('tr[data-psmap-skr-row]')) {
    const pattern = row.querySelector('[data-psmap-skr-col="pattern"]')?.value?.trim() || '';
    const canonical = row.querySelector('[data-psmap-skr-col="canonical"]')?.value?.trim() || 'REST';
    if (pattern) rules.push({ pattern, canonical });
  }
  hidden.value = rulesToText(rules);
  supportOptionState.supportKeywordRulesText = hidden.value;
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function schedulePatch(patch) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch();
    });
  };
}

function patchSupportConfigControls() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel) return;
  if (panel.querySelector('[data-psmap-support-config]')) return;

  installSupportKeywordTableStyle();
  const rules = parseKeywordRules(supportOptionState.supportKeywordRulesText);

  const host = document.createElement('div');
  host.className = 'psmap-card';
  host.setAttribute('data-psmap-support-config', '1');
  host.innerHTML = `
    <div class="psmap-card-head"><b>Support Keyword Logic</b></div>
    <div class="psmap-card-body">
      <div class="psmap-grid-3">
        <label class="psmap-check">
          <input type="checkbox" data-psmap-setup="useBuiltInSupportKeywordLogic" ${supportOptionState.useBuiltInSupportKeywordLogic ? 'checked' : ''}>
          Use built-in keyword logic
          <span class="psmap-help" title="Uses the Pattern → Canonical table below for both Table-1C ISONOTE and Table-2 DTXR. Wildcards (*text*) are supported.">i</span>
        </label>
        <label class="psmap-check">
          <input type="checkbox" data-psmap-setup="enableSupportGapComparison" ${supportOptionState.enableSupportGapComparison ? 'checked' : ''}>
          Compare Support Gap
          <span class="psmap-help" title="Support gaps are child properties. GUIDE GAP is compared only when GUIDE exists in both Table-1 and Table-2. LINE STOP GAP is compared only when LINE_STOP exists in both Table-1 and Table-2.">i</span>
        </label>
        <div class="psmap-field">
          <label>Gap tolerance mm</label>
          <input type="number" min="0" max="25" step="0.1" data-psmap-setup="supportGapToleranceMm" value="${h(supportOptionState.supportGapToleranceMm)}">
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;color:#b7c9dd;font-weight:700">Support Keyword Rules: Pattern → Canonical</span>
          <button type="button" class="psmap-btn secondary psmap-skr-add-row" data-psmap-skr-action="add-row">+ Add Rule</button>
        </div>
        <table class="psmap-skr-table">
          <thead><tr><th style="width:55%">Pattern (wildcards: *text*)</th><th style="width:30%">Canonical</th><th style="width:15%"></th></tr></thead>
          <tbody data-psmap-skr-body>${renderSkrRows(rules)}</tbody>
        </table>
        <textarea hidden data-psmap-setup="supportKeywordRulesText" data-psmap-skr-hidden data-psmap-support-rules>${h(supportOptionState.supportKeywordRulesText)}</textarea>
      </div>
      <div class="psmap-banner">
        Canonical values: <b>REST</b>, <b>GUIDE</b>, <b>LINE_STOP</b>. Wildcards: <b>*WEAR PLATE* → REST</b>, <b>*PIPE SHOE* → REST</b>, <b>*Directional Anchor* → LINE_STOP</b>. Add/remove rows to customise.
      </div>
    </div>`;

  const firstGrid = panel.querySelector('.psmap-grid-2');
  if (firstGrid?.nextSibling) firstGrid.parentNode.insertBefore(host, firstGrid.nextSibling);
  else panel.querySelector('.psmap-card-body')?.appendChild(host);
}

function getTableInfo(panelName) {
  const table = document.querySelector(`[data-psmap-panel="${panelName}"] table.psmap-table`);
  if (!table) return null;
  const labels = Array.from(table.querySelectorAll('thead tr.psmap-labels th')).map((th) => th.textContent.trim());
  const tbody = table.querySelector('tbody');
  if (!labels.length || !tbody) return null;
  return { table, labels, tbody };
}

function readCell(row, labels, label) {
  const index = labels.indexOf(label);
  return index >= 0 ? row.children[index]?.textContent?.trim() || '' : '';
}

function setCell(row, labels, label, value) {
  const index = labels.indexOf(label);
  if (index < 0) return;
  const next = value == null ? '' : String(value);
  if (row.children[index].textContent !== next) row.children[index].textContent = next;
}

function addColumn(info, label, afterLabel, valueFn, groupLabel = '') {
  if (!info || info.labels.includes(label)) return;
  const insertAfter = info.labels.indexOf(afterLabel);
  if (insertAfter < 0) return;
  const groupRow = info.table.querySelector('thead tr.psmap-group');
  if (groupLabel) {
    const group = Array.from(groupRow?.children || []).find((th) => th.textContent.trim() === groupLabel);
    if (group) group.colSpan = Number(group.colSpan || 1) + 1;
  }
  const th = document.createElement('th');
  th.textContent = label;
  info.table.querySelector('thead tr.psmap-labels')?.children[insertAfter]?.after(th);
  for (const row of info.tbody.querySelectorAll('tr')) {
    const td = document.createElement('td');
    td.className = row.children[insertAfter]?.className || 'group-source';
    td.textContent = valueFn(row, info.labels) || '';
    row.children[insertAfter]?.after(td);
  }
  info.labels.splice(insertAfter + 1, 0, label);
}

function supportLabel(type) {
  return type === 'LINE_STOP' || type === 'STOP' ? 'LINE STOP' : String(type || '').replace(/_/g, ' ');
}

function splitSupportList(value) {
  return String(value || '')
    .split(/[;,|/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toUpperCase().replace(/^LINE[_\s-]*STOP$/, 'LINE_STOP').replace(/^STOP$/, 'LINE_STOP'));
}

function parseRawColumns(value) {
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
}

function readSupportGapRawFromRawColumns(raw) {
  const cols = raw || {};
  for (const [key, value] of Object.entries(cols)) {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (normalized === 'support gap' || normalized === 'guide gap' || normalized === 'line stop gap' || normalized === 'stop gap' || normalized === 'gap') return value;
  }
  return '';
}

function firstGapValue(supportGapRaw, dtxr) {
  const gaps = extractTypedSupportGaps(supportGapRaw, supportTypesFromText(dtxr), { fieldFallback: true });
  return gaps.GUIDE ?? gaps.LINE_STOP ?? '';
}

function readCt2ModelMap() {
  const info = getTableInfo('ct2');
  const map = new Map();
  if (!info) return map;
  for (const row of info.tbody.querySelectorAll('tr')) {
    const psno = readCell(row, info.labels, 'PSNO_Model');
    const dtxr = readCell(row, info.labels, 'DTXR');
    const raw = parseRawColumns(readCell(row, info.labels, 'Raw Columns'));
    const supportGapRaw = readCell(row, info.labels, 'Support Gap') || readSupportGapRawFromRawColumns(raw);
    if (!psno) continue;
    if (!map.has(psno)) map.set(psno, []);
    map.get(psno).push({ psno, dtxr, supportGapRaw, supportGapMm: firstGapValue(supportGapRaw, dtxr) });
  }
  return map;
}

function patchCt2SupportGapColumn() {
  const info = getTableInfo('ct2');
  if (!info) return;
  addColumn(info, 'Support Gap', 'DTXR', (row, labels) => {
    const raw = parseRawColumns(readCell(row, labels, 'Raw Columns'));
    return readSupportGapRawFromRawColumns(raw);
  }, 'Support');
}

function readCoverageIsonote(node) {
  const coverage = getTableInfo('coverage');
  if (!coverage) return '';
  for (const row of coverage.tbody.querySelectorAll('tr')) {
    if (readCell(row, coverage.labels, 'Node') === node) return readCell(row, coverage.labels, 'ISONOTE');
  }
  return '';
}

function rowSupportContext(row, labels, fallbackIsonote = '') {
  return [
    readCell(row, labels, 'T2 DTXR'),
    readCell(row, labels, 'T2 Keywords'),
    readCell(row, labels, 'T2 Support Types'),
    readCell(row, labels, 'Support Match'),
    fallbackIsonote,
  ].filter(Boolean).join(' ');
}

function modelScore(model, rowContext) {
  const modelTypes = supportTypesFromText(model?.dtxr || '');
  const rowTypes = supportTypesFromText(rowContext || '');
  let score = 0;
  for (const type of modelTypes) if (rowTypes.has(type)) score += 10;
  if (model?.dtxr && String(rowContext || '').toUpperCase().includes(String(model.dtxr).toUpperCase())) score += 100;
  return score;
}

function resolveModel(psno, row, labels, modelMap, isonote = '') {
  const models = modelMap.get(psno) || [];
  if (!models.length) return {};
  if (models.length === 1) return models[0];
  const context = rowSupportContext(row, labels, isonote);
  return [...models].sort((a, b) => modelScore(b, context) - modelScore(a, context))[0] || models[0];
}

function computeGapMatch(supportGapRaw, isonote, dtxr = '') {
  return evaluateSupportGapComparison({
    table1Text: isonote,
    table2Text: dtxr,
    table2GapRaw: supportGapRaw,
    tolerance: supportOptionState.supportGapToleranceMm || 0,
    enabled: supportOptionState.enableSupportGapComparison !== false,
  }).status;
}

function patchValidatorGapColumns() {
  const info = getTableInfo('validator');
  if (!info) return;
  const modelMap = readCt2ModelMap();
  addColumn(info, 'T2 Support Gap', 'T2 DTXR', (row, labels) => {
    const note = readCoverageIsonote(readCell(row, labels, 'Node'));
    return resolveModel(readCell(row, labels, 'PSNO_Model'), row, labels, modelMap, note)?.supportGapRaw || '';
  }, 'Table-2 Source');
  addColumn(info, 'Gap Match', 'Support Match', (row, labels) => {
    const psno = readCell(row, labels, 'PSNO_Model');
    const note = readCoverageIsonote(readCell(row, labels, 'Node'));
    const model = resolveModel(psno, row, labels, modelMap, note);
    return computeGapMatch(model.supportGapRaw, note, model.dtxr);
  }, 'Match Basis');
}

function patchCandidateGapColumns() {
  const info = getTableInfo('candidates');
  if (!info) return;
  const modelMap = readCt2ModelMap();
  addColumn(info, 'T2 DTXR', 'T2 Line Family', (row, labels) => resolveModel(readCell(row, labels, 'PSNO_Model'), row, labels, modelMap, readCell(row, labels, 'ISONOTE'))?.dtxr || '', 'Table-2 Source');
  addColumn(info, 'T2 Support Gap', 'T2 DTXR', (row, labels) => resolveModel(readCell(row, labels, 'PSNO_Model'), row, labels, modelMap, readCell(row, labels, 'ISONOTE'))?.supportGapRaw || '', 'Table-2 Source');
  addColumn(info, 'Gap Match', 'Support Match', (row, labels) => {
    const psno = readCell(row, labels, 'PSNO_Model');
    const isonote = readCell(row, labels, 'ISONOTE');
    const model = resolveModel(psno, row, labels, modelMap, isonote);
    return computeGapMatch(model.supportGapRaw, isonote, model.dtxr || readCell(row, labels, 'T2 DTXR'));
  }, 'Match Basis');
}

function auditKey(row) { return [row.node, row.table1PsNo, row.missing].join('|'); }
function makeAuditRowsFromCoverage() {
  const info = getTableInfo('coverage');
  if (!info) return [];
  const rows = [];
  const seen = new Set();
  for (const tr of info.tbody.querySelectorAll('tr')) {
    const node = readCell(tr, info.labels, 'Node');
    const table1PsNo = readCell(tr, info.labels, 'Table-1 PS No');
    const missingMasterKeywords = readCell(tr, info.labels, 'Missing Master Keywords');
    for (const missing of splitSupportList(missingMasterKeywords)) {
      const missingText = supportLabel(missing);
      const row = {
        node,
        candidateNode: node,
        table1PsNo,
        tag: readCell(tr, info.labels, 'Tag'),
        source: readCell(tr, info.labels, 'Source'),
        lineFamily: readCell(tr, info.labels, 'Line Family'),
        pipeSizeRaw: readCell(tr, info.labels, 'Pipe Size'),
        derivedDn: readCell(tr, info.labels, 'Derived DN'),
        isonote: readCell(tr, info.labels, 'ISONOTE'),
        masterKeywords: readCell(tr, info.labels, 'Master Keywords'),
        missing,
        supportMatch: `${missingText} missing`,
        supportBasis: 'SUPPORT_MISSING_MASTER_REQUIRED',
        finalStatus: 'SUPPORT_MISSING_REQUIRED',
        confidence: 'AUDIT',
        confidenceScore: '0',
        warnings: `SUPPORT_MISSING_REQUIRED: ${missingText}`,
        action: `Add ${missingText} in Table-2 for this PS No.`,
        note: `${missingText} missing from mapped Table-2 DTXR for Node ${node || '-'}. Table-1 is treated as correct.`,
      };
      const key = auditKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function appendAuditRow(info, row, fill) {
  const key = auditKey(row);
  if (info.tbody.querySelector(`[data-psmap-support-audit-key="${CSS.escape(key)}"]`)) return;
  const tr = document.createElement('tr');
  tr.setAttribute('data-psmap-support-audit-key', key);
  tr.setAttribute('data-psmap-support-audit-row', '1');
  for (let i = 0; i < info.labels.length; i += 1) {
    const td = document.createElement('td');
    td.className = 'group-diagnostic';
    tr.appendChild(td);
  }
  fill(tr, info.labels, row);
  info.tbody.appendChild(tr);
}

function patchValidatorMissingSupportAuditRows(auditRows) {
  const info = getTableInfo('validator');
  if (!info) return;
  for (const audit of auditRows) appendAuditRow(info, audit, (tr, labels, row) => {
    setCell(tr, labels, 'PSNO_Model', '-'); setCell(tr, labels, 'Node', row.node); setCell(tr, labels, 'Table-1 PS No', row.table1PsNo); setCell(tr, labels, 'Tag', row.tag); setCell(tr, labels, 'T1 Source', row.source); setCell(tr, labels, 'T1 Line Family', row.lineFamily); setCell(tr, labels, 'T1 Derived DN', row.derivedDn); setCell(tr, labels, 'Support Match', row.supportMatch); setCell(tr, labels, 'Basis', `PS_BASE + BORE_DN_FROM_NPS + ${row.supportBasis}`); setCell(tr, labels, 'Enabled', ''); setCell(tr, labels, 'Final Status', row.finalStatus); setCell(tr, labels, 'Confidence', row.confidence); setCell(tr, labels, 'Confidence Score', row.confidenceScore); setCell(tr, labels, 'Review Action', row.action); setCell(tr, labels, 'Warnings', row.warnings); setCell(tr, labels, 'Node Coverage Note', row.note);
  });
}
function patchCandidateMissingSupportAuditRows(auditRows) {
  const info = getTableInfo('candidates');
  if (!info) return;
  for (const audit of auditRows) appendAuditRow(info, audit, (tr, labels, row) => {
    setCell(tr, labels, 'PSNO_Model', '-'); setCell(tr, labels, 'Candidate Node', row.candidateNode); setCell(tr, labels, 'Table-1 PS No', row.table1PsNo); setCell(tr, labels, 'Tag', row.tag); setCell(tr, labels, 'Source', row.source); setCell(tr, labels, 'T1 Line Family', row.lineFamily); setCell(tr, labels, 'Pipe Size', row.pipeSizeRaw); setCell(tr, labels, 'Derived DN', row.derivedDn); setCell(tr, labels, 'ISONOTE', row.isonote); setCell(tr, labels, 'PS Basis', 'PS_BASE'); setCell(tr, labels, 'Bore Basis', row.derivedDn ? 'BORE_DN_FROM_NPS' : ''); setCell(tr, labels, 'Line Basis', '-'); setCell(tr, labels, 'Support Basis', row.supportBasis); setCell(tr, labels, 'Support Match', row.supportMatch); setCell(tr, labels, 'Eligible', ''); setCell(tr, labels, 'Auto Selectable', ''); setCell(tr, labels, 'Review Required', 'YES'); setCell(tr, labels, 'Selected', ''); setCell(tr, labels, 'Final Status', row.finalStatus); setCell(tr, labels, 'Confidence', row.confidence); setCell(tr, labels, 'Confidence Score', row.confidenceScore); setCell(tr, labels, 'Score', '999999'); setCell(tr, labels, 'Warnings', row.warnings); setCell(tr, labels, 'Reason', row.action); setCell(tr, labels, 'Node Coverage Note', row.note);
  });
}
function patchMissingSupportAuditRows() { const auditRows = makeAuditRowsFromCoverage(); if (!auditRows.length) return; patchValidatorMissingSupportAuditRows(auditRows); patchCandidateMissingSupportAuditRows(auditRows); }

function onSkrClick(event) {
  const action = event.target?.closest?.('[data-psmap-skr-action]')?.dataset?.psmapSkrAction;
  const card = event.target?.closest?.('[data-psmap-support-config]');
  if (!card || !action) return;
  const tbody = card.querySelector('[data-psmap-skr-body]');
  if (!tbody) return;
  if (action === 'add-row') {
    const tr = document.createElement('tr');
    tr.setAttribute('data-psmap-skr-row', tbody.querySelectorAll('tr').length);
    tr.innerHTML = `<td><input class="psmap-skr-input" type="text" value="" data-psmap-skr-col="pattern"></td><td><select class="psmap-skr-input" data-psmap-skr-col="canonical">${CANONICAL_VALUES.map((v) => `<option value="${v}">${v}</option>`).join('')}</select></td><td><button type="button" class="psmap-skr-del" data-psmap-skr-action="delete-row">✕</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('input')?.focus();
    syncSkrTextarea(card);
  } else if (action === 'delete-row') {
    event.target.closest('tr')?.remove();
    syncSkrTextarea(card);
  }
}

function onSkrInput(event) {
  if (!event.target?.dataset?.psmapSkrCol) return;
  const card = event.target.closest('[data-psmap-support-config]');
  if (card) syncSkrTextarea(card);
}

function installPsMappingSupportUiBridge() {
  const patch = () => { patchSupportConfigControls(); patchCt2SupportGapColumn(); patchValidatorGapColumns(); patchCandidateGapColumns(); patchMissingSupportAuditRows(); };
  const runPatch = schedulePatch(patch);
  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', onSkrClick, true);
  document.addEventListener('input', onSkrInput, true);
  document.addEventListener('change', onSkrInput, true);
  document.addEventListener('change', onSupportOptionChange, true);
  document.addEventListener('input', onSupportOptionChange, true);
  runPatch();
  return () => {
    observer.disconnect();
    document.removeEventListener('click', onSkrClick, true);
    document.removeEventListener('input', onSkrInput, true);
    document.removeEventListener('change', onSkrInput, true);
    document.removeEventListener('change', onSupportOptionChange, true);
    document.removeEventListener('input', onSupportOptionChange, true);
  };
}

function onSupportOptionChange(event) {
  const target = event.target;
  const key = target?.dataset?.psmapSetup;
  if (key === 'useBuiltInSupportKeywordLogic' || key === 'enableSupportGapComparison') supportOptionState[key] = target.checked === true;
  if (key === 'supportGapToleranceMm') supportOptionState[key] = Number(target.value || 0);
  if (key === 'supportKeywordRulesText') supportOptionState[key] = target.value;
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyBridge = installPsMappingSupportUiBridge();
  return () => {
    try { destroyBridge?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
