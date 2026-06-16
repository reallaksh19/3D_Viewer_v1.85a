import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-candidate-copy-ui.js?v=20260612-psmap-candidate-copy-1';
import {
  DEFAULT_OPTIONS,
  runPsMappingResolver,
} from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260614-synthetic-missing-support-rows-1';

const COPY_COLUMNS = [
  ['supportNoModel', 'SupportNo_Model'],
  ['modelBore', 'T2 Bore'],
  ['lineFamily', 'T2 Line Family'],
  ['supportTypesRequested', 'T2 Keywords'],
  ['candidateNode', 'Candidate Node'],
  ['table1SupportNo', 'Table-1 Support No'],
  ['tag', 'Tag'],
  ['source', 'Source'],
  ['nodeLineFamily', 'T1 Line Family'],
  ['pipeSizeRaw', 'Pipe Size'],
  ['derivedDn', 'Derived DN'],
  ['nodeIsonote', 'ISONOTE'],
  ['supportMatch', 'Support Match'],
  ['t1NodeRestraints', 'T1 Node Restraints'],
  ['t2CoveredRestraints', 'T2 Covered Restraints'],
  ['missingNodeRestraints', 'Missing Node Restraints'],
  ['extraTable2Restraints', 'Extra Table-2 Restraints'],
  ['supportGapMatch', 'Support Gap Match'],
  ['reason', 'Reason'],
  ['supportNoWiseAction', 'Support No. Wise Action'],
  ['nodeCoverageNote', 'Node Coverage Note'],
  ['psBasis', 'Support No. Basis'],
  ['boreBasis', 'Bore Basis'],
  ['lineBasis', 'Line Match'],
  ['supportBasis', 'Support Basis'],
  ['reviewAction', 'Review Action'],
  ['consolidatedNodeWiseAction', 'Consolidated Node wise Action'],
  ['table2SourceId', 'Table-2 Source ID'],
  ['modelSourceId', 'Model Source ID'],
];

function genericText(value) {
  return String(value ?? '')
    .replace(/\bPSNO_Model\b/g, 'SupportNo_Model')
    .replace(/\bTable-1 PS No\b/g, 'Table-1 Support No')
    .replace(/\bProposed Table-2 PS No\b/g, 'SupportNo_Model')
    .replace(/\bProposed Table-2 Support No\b/g, 'SupportNo_Model')
    .replace(/\bPS No\. Wise Action\b/g, 'Support No. Wise Action')
    .replace(/\bPS No\. wise action\b/g, 'Support No. wise action')
    .replace(/\bPS Basis\b/g, 'Support No. Basis')
    .replace(/\bPS NO\b/g, 'Support No')
    .replace(/\bPS No\b/g, 'Support No')
    .replace(/synthetic IDs like PS-XYZ\.X1/g, 'synthetic missing support rows use SupportNo_Model like <SupportNo>.X1')
    .replace(/synthetic IDs like <SupportNo>\.X1/g, 'synthetic missing support rows use SupportNo_Model like <SupportNo>.X1')
    .replace(/synthetic PS-XYZ\.Xn IDs/g, 'synthetic <SupportNo>.Xn IDs')
    .replace(/PS-UNKNOWN/g, 'SUPPORT-UNKNOWN');
}

function relabelTextNode(node) {
  const next = genericText(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function relabelElement(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (['TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(relabelTextNode);
}

function relabelVisibleUi() {
  relabelElement(document.querySelector('[data-psmap-modal]'));
  relabelElement(document.querySelector('[data-psmap-header-map-dialog]'));
  relabelElement(document.querySelector('[data-psmap-preflight-host]'));
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function supportGapValue(row = {}) {
  return row.supportGapMatch || row.gapMatch || row.supportGapBasis || '';
}

function supportNoModelValue(row = {}) {
  return row.supportNoModel || row.psnoModel || row.modelPsNo || row.rawPsNo || '';
}

function valueFor(row = {}, key) {
  if (key === 'supportGapMatch') return supportGapValue(row);
  if (key === 'supportNoModel') return supportNoModelValue(row);
  if (key === 'supportNoWiseAction') return row.supportNoWiseAction || row.psNoWiseAction || '';
  return row[key] ?? '';
}

function sourceValue(modal, key) {
  return modal?.querySelector?.(`[data-psmap-source="${key}"]`)?.value || '';
}

function collectInputFromModal(modal) {
  return {
    table1PsNodeText: sourceValue(modal, 'table1Text'),
    table1aNodeDiaText: sourceValue(modal, 'table1AText'),
    table1bNodeLineText: sourceValue(modal, 'table1BText'),
    table1cNodeIsonoteText: sourceValue(modal, 'table1CText'),
    table1dKeywordText: sourceValue(modal, 'table1DText'),
    table2ModelText: sourceValue(modal, 'table2Text'),
  };
}

function parseOptionsFromModal(modal) {
  const options = { ...DEFAULT_OPTIONS };
  for (const input of modal?.querySelectorAll?.('[data-psmap-setup]') || []) {
    const key = input.dataset.psmapSetup;
    if (!key) continue;
    if (input.type === 'checkbox') options[key] = input.checked;
    else if (input.type === 'number') options[key] = Number(input.value);
    else options[key] = input.value;
  }
  return options;
}

function rowsToCsv(rows = []) {
  return [
    COPY_COLUMNS.map(([, label]) => csvEscape(label)).join(','),
    ...rows.map((row) => COPY_COLUMNS.map(([key]) => csvEscape(valueFor(row, key))).join(',')),
  ].join('\n');
}

async function copyCandidatesWithSupportNoLabels(event, ctx = {}) {
  const action = event.target?.closest?.('[data-psmap-action]')?.dataset?.psmapAction;
  if (action !== 'copyCandidates') return;
  const modal = document.querySelector('[data-psmap-modal]');
  if (!modal) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  try {
    const result = runPsMappingResolver({ ...collectInputFromModal(modal), options: parseOptionsFromModal(modal) });
    const rows = result?.candidates || result?.candidateRows || [];
    await navigator.clipboard?.writeText(rowsToCsv(rows));
    ctx.showToast?.(`Copied ${rows.length} candidate rows with Support No. labels.`, 'success');
  } catch (error) {
    ctx.showToast?.(`Copy candidates failed: ${error?.message || error}`, 'error');
  }
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const clickHandler = (event) => copyCandidatesWithSupportNoLabels(event, ctx);
  document.addEventListener('click', clickHandler, true);
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const observer = new MutationObserver(relabelVisibleUi);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  relabelVisibleUi();
  return () => {
    document.removeEventListener('click', clickHandler, true);
    observer.disconnect();
    if (typeof destroyBase === 'function') destroyBase();
  };
}
