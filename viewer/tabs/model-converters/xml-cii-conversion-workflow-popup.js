import { WorkflowModal } from './shared/WorkflowModal.js';
import {
  renderXmlCiiWorkflowModelDataPanel,
  renderXmlCiiWorkflowProcessEnrichmentPanel,
} from './xml-cii-conversion-workflow-direct-panels.js';

const FLAG = '__xmlCiiConversionWorkflowPopup_direct_v5';
const ACTIVE_TAB_KEY = 'xmlCii2019.conversionWorkflow.activeTab.v2';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';
const XML_CII_CONVERTER_IDS = new Set(['xml_to_cii', 'inputxml_to_cii2019', 'xml_to_cii2019']);

const WORKFLOW_TABS = Object.freeze([
  { id: 'xml-model-data', label: 'XML - Model Data', state: 'Model' },
  { id: 'process-enrichment', label: 'Process / Piping Class / Wt. Enrichment', state: 'Old Workflow' },
]);

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readStored(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function activeConverterId(root = document) {
  return root.querySelector?.('#model-converters-select')?.value || '';
}

function isXmlCiiActive(root = document) {
  return XML_CII_CONVERTER_IDS.has(activeConverterId(root));
}

function safeScrollTo(node) {
  try {
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  } catch {
    node?.scrollIntoView?.();
  }
}

function openExistingXmlCiiPhase(root, phaseId) {
  const workflow =
    root.querySelector?.('#model-converters-xml-cii-workflow') ||
    document.querySelector('#model-converters-xml-cii-workflow');

  if (!workflow) return false;

  workflow.dataset.selectedPhase = phaseId || 'regex';
  const details = workflow.tagName === 'DETAILS' ? workflow : workflow.closest?.('details');
  if (details) details.open = true;
  safeScrollTo(workflow);
  return true;
}

function scrollToSelector(root, selector) {
  const node = root.querySelector?.(selector) || document.querySelector(selector);
  if (!node) return false;

  const details = node.tagName === 'DETAILS' ? node : node.closest?.('details');
  if (details) details.open = true;
  safeScrollTo(node);
  return true;
}

function dispatchDirectRun(root) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;

  window[DIRECT_RUN_FLAG] = true;
  try {
    runButton.click();
  } finally {
    setTimeout(() => {
      window[DIRECT_RUN_FLAG] = false;
    }, 0);
  }
  return true;
}

function openExactLegacyXmlCiiWorkflow(root, state, phaseId = 'regex') {
  if (!browserReady()) return false;

  const workflow =
    root.querySelector?.('#model-converters-xml-cii-workflow') ||
    document.querySelector('#model-converters-xml-cii-workflow');

  if (!workflow) return false;

  workflow.dataset.selectedPhase = phaseId || 'regex';

  const summary = workflow.querySelector?.('summary');
  if (!summary) return false;

  const openLegacySummary = () => {
    summary.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  };

  if (state?.modal) {
    state.modal.close();
    setTimeout(openLegacySummary, 0);
  } else {
    openLegacySummary();
  }

  return true;
}

function renderActiveTab(root, state) {
  if (!state.body) return;

  const tabId = state.activeTab || WORKFLOW_TABS[0].id;
  const callbacks = {
    openPhase: (phaseId) => openExistingXmlCiiPhase(root, phaseId),
    openLegacyWorkflow: (phaseId = 'regex') => openExactLegacyXmlCiiWorkflow(root, state, phaseId),
    close: () => state.modal?.close(),
    run: () => {
      if (dispatchDirectRun(root)) state.modal?.close();
    },
    showOutput: () => scrollToSelector(root, '#model-converters-output'),
  };

  if (tabId === 'process-enrichment') {
    renderXmlCiiWorkflowProcessEnrichmentPanel(state.body, root, callbacks);
  } else {
    renderXmlCiiWorkflowModelDataPanel(state.body, root, callbacks);
  }
}

function openConversionWorkflow(root = document, state) {
  if (!browserReady()) return;

  if (state.modal) {
    renderActiveTab(root, state);
    return;
  }

  const active = readStored(ACTIVE_TAB_KEY, 'xml-model-data');
  state.activeTab = WORKFLOW_TABS.some((tab) => tab.id === active) ? active : 'xml-model-data';

  state.modal = new WorkflowModal({
    title: 'XML → CII (2019) Conversion Workflow',
    subtitle: 'Two-tab workflow: XML model data side-loads, then the exact old Process / Piping Class / Wt. Enrichment popup.',
    tabs: WORKFLOW_TABS,
    activeTabId: state.activeTab,
    onTabChange: (tabId) => {
      state.activeTab = tabId;
      writeStored(ACTIVE_TAB_KEY, tabId);
      renderActiveTab(root, state);
    },
    onClose: () => {
      state.modal = null;
      state.body = null;
    },
  });

  state.body = state.modal.open();
  renderActiveTab(root, state);
}

function applyWorkflowButtonVisibility(quickButton, xmlActive) {
  quickButton.hidden = !xmlActive;
  quickButton.disabled = !xmlActive;
  quickButton.style.display = xmlActive ? '' : 'none';
  quickButton.setAttribute('aria-hidden', xmlActive ? 'false' : 'true');
}

function ensureWorkflowButton(root, state) {
  const runButton = root.querySelector?.('#model-converters-run');
  if (!runButton) return;

  const xmlActive = isXmlCiiActive(root);
  let quickButton = root.querySelector('[data-xml-cii-open-conversion-workflow]');

  if (!quickButton) {
    quickButton = document.createElement('button');
    quickButton.type = 'button';
    quickButton.className = 'model-converters-download-btn';
    quickButton.dataset.xmlCiiOpenConversionWorkflow = 'true';
    quickButton.textContent = 'Open XML→CII Workflow';
    quickButton.style.cssText = 'width:100%;padding:10px;margin-top:6px;';
    quickButton.addEventListener('click', () => {
      if (isXmlCiiActive(root)) openConversionWorkflow(root, state);
    });
    runButton.parentElement?.insertBefore(quickButton, runButton);
  }

  applyWorkflowButtonVisibility(quickButton, xmlActive);
}

export function installXmlCiiConversionWorkflowPopup(container = document) {
  if (!browserReady() || window[FLAG]) return;

  window[FLAG] = true;
  const root = container || document;
  const state = { modal: null, body: null, activeTab: 'xml-model-data' };

  const interceptRun = (event) => {
    const runButton = event.target?.closest?.('#model-converters-run');
    if (!runButton) return;
    if (window[DIRECT_RUN_FLAG]) return;
    if (!isXmlCiiActive(root)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openConversionWorkflow(root, state);
  };

  const refreshButton = () => setTimeout(() => ensureWorkflowButton(root, state), 0);

  document.addEventListener('click', interceptRun, true);
  ensureWorkflowButton(root, state);
  root.querySelector?.('#model-converters-select')?.addEventListener('change', refreshButton);
}
