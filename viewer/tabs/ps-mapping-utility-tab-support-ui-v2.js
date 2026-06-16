import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-support-ui.js?v=20260611-psmap-support-gap-rules-1';
import {
  evaluateSupportGapComparison,
  extractTypedSupportGaps,
  supportTypesFromText,
} from './ps-mapping-utility/ps-mapping-support-gap-logic.js?v=20260614-support-parent-gap-1';

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
    const supportGapVisible = readCell(row, info.labels, 'Support Gap');
    const raw = parseRawColumns(readCell(row, info.labels, 'Raw Columns'));
    const supportGapRaw = supportGapVisible || readSupportGapRawFromRawColumns(raw);
    if (!psno) continue;
    if (!map.has(psno)) map.set(psno, []);
    map.get(psno).push({
      psno,
      dtxr,
      supportGapRaw,
      supportGapMm: firstGapValue(supportGapRaw, dtxr),
    });
  }
  return map;
}

function readCoverageIsonote(node) {
  const coverage = getTableInfo('coverage');
  if (!coverage) return '';
  for (const row of coverage.tbody.querySelectorAll('tr')) {
    if (readCell(row, coverage.labels, 'Node') === node) return readCell(row, coverage.labels, 'ISONOTE');
  }
  return '';
}

function currentGapTolerance() {
  const input = document.querySelector('[data-psmap-setup="supportGapToleranceMm"]');
  return Number(input?.value || 0);
}

function currentGapEnabled() {
  const input = document.querySelector('[data-psmap-setup="enableSupportGapComparison"]');
  return input ? input.checked !== false : true;
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

function computeGapMatch(supportGapRaw, isonote, dtxr = '', tolerance = 0, enabled = true) {
  return evaluateSupportGapComparison({
    table1Text: isonote,
    table2Text: dtxr,
    table2GapRaw: supportGapRaw,
    tolerance,
    enabled,
  }).status;
}

function patchCt2SupportGapValues(modelMap) {
  const info = getTableInfo('ct2');
  if (!info || !info.labels.includes('Support Gap')) return;
  for (const row of info.tbody.querySelectorAll('tr')) {
    const psno = readCell(row, info.labels, 'PSNO_Model');
    const dtxr = readCell(row, info.labels, 'DTXR');
    const models = modelMap.get(psno) || [];
    const model = models.find((item) => item.dtxr === dtxr) || models[0] || {};
    if (model?.supportGapRaw) setCell(row, info.labels, 'Support Gap', model.supportGapRaw);
  }
}

function patchValidatorGapValues(modelMap) {
  const info = getTableInfo('validator');
  if (!info || !info.labels.includes('Gap Match')) return;
  const tolerance = currentGapTolerance();
  const enabled = currentGapEnabled();
  for (const row of info.tbody.querySelectorAll('tr')) {
    const psno = readCell(row, info.labels, 'PSNO_Model');
    const node = readCell(row, info.labels, 'Node');
    const isonote = readCoverageIsonote(node);
    const model = resolveModel(psno, row, info.labels, modelMap, isonote);
    if (info.labels.includes('T2 Support Gap')) setCell(row, info.labels, 'T2 Support Gap', model.supportGapRaw || '');
    setCell(row, info.labels, 'Gap Match', computeGapMatch(model.supportGapRaw, isonote, model.dtxr, tolerance, enabled));
  }
}

function patchCandidateGapValues(modelMap) {
  const info = getTableInfo('candidates');
  if (!info || !info.labels.includes('Gap Match')) return;
  const tolerance = currentGapTolerance();
  const enabled = currentGapEnabled();
  for (const row of info.tbody.querySelectorAll('tr')) {
    const psno = readCell(row, info.labels, 'PSNO_Model');
    const isonote = readCell(row, info.labels, 'ISONOTE');
    const model = resolveModel(psno, row, info.labels, modelMap, isonote);
    const dtxr = model.dtxr || readCell(row, info.labels, 'T2 DTXR');
    if (info.labels.includes('T2 Support Gap')) setCell(row, info.labels, 'T2 Support Gap', model.supportGapRaw || '');
    if (info.labels.includes('T2 DTXR')) setCell(row, info.labels, 'T2 DTXR', dtxr);
    setCell(row, info.labels, 'Gap Match', computeGapMatch(model.supportGapRaw, isonote, dtxr, tolerance, enabled));
  }
}

function schedulePatch(patch) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; patch(); });
  };
}

function installRobustGapUiPatch() {
  const patch = () => {
    const modelMap = readCt2ModelMap();
    patchCt2SupportGapValues(modelMap);
    patchValidatorGapValues(modelMap);
    patchCandidateGapValues(modelMap);
  };
  const runPatch = schedulePatch(patch);
  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('input', runPatch, true);
  document.addEventListener('change', runPatch, true);
  runPatch();
  return () => {
    observer.disconnect();
    document.removeEventListener('input', runPatch, true);
    document.removeEventListener('change', runPatch, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyRobustGap = installRobustGapUiPatch();
  return () => {
    try { destroyRobustGap?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
