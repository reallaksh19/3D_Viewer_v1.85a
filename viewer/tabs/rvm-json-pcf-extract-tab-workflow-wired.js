import { state, updateRvmPcfExtractState } from '../core/state.js';
import { mount as mountBaseRvmJsonPcfExtractTab, dispose as disposeBaseRvmJsonPcfExtractTab } from './rvm-json-pcf-extract-tab.js';
import {
  createRvmJsonPcfWorkflowActions,
  mountRvmJsonPcfWorkflowPanel,
} from './rvm-json-pcf-workflow-panel.js';

const WORKFLOW_PANEL_ID = 'workflow';

function _setRailActive(container, panelId) {
  container.querySelectorAll('[data-panel]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.panel === panelId);
  });
}

function _ensureWorkflowRailButton(container) {
  const rail = container.querySelector('.rvm-pcf-extract-rail');
  if (!rail) return null;

  let button = rail.querySelector('[data-panel="workflow"]');
  if (button) return button;

  button = document.createElement('button');
  button.type = 'button';
  button.dataset.panel = WORKFLOW_PANEL_ID;
  button.textContent = 'Workflow';

  const scopeButton = rail.querySelector('[data-panel="scope"]');
  if (scopeButton?.nextSibling) {
    rail.insertBefore(button, scopeButton.nextSibling);
  } else if (scopeButton) {
    rail.appendChild(button);
  } else {
    rail.prepend(button);
  }

  return button;
}

function _showWorkflowPanel(container) {
  const host = container.querySelector('#rvm-pcf-extract-panel-host');
  if (!host) return null;

  _setRailActive(container, WORKFLOW_PANEL_ID);

  const actions = createRvmJsonPcfWorkflowActions({
    updateExtractState: updateRvmPcfExtractState,
    refresh: () => _showWorkflowPanel(container),
  });

  return mountRvmJsonPcfWorkflowPanel(host, {
    extractState: state.rvmPcfExtract || {},
    actions,
  });
}

function _bindWorkflowRailButton(container, button) {
  if (!button || button.dataset.workflowBound === 'true') return;
  button.dataset.workflowBound = 'true';

  button.addEventListener('click', () => {
    updateRvmPcfExtractState({
      requestedPanel: WORKFLOW_PANEL_ID,
    }, 'json-rvm-pcf-workflow-panel-opened');
    _showWorkflowPanel(container);
  });
}

function _installWorkflowPanel(container) {
  const button = _ensureWorkflowRailButton(container);
  _bindWorkflowRailButton(container, button);

  const requestedPanel = state.rvmPcfExtract?.requestedPanel;
  if (requestedPanel === WORKFLOW_PANEL_ID) {
    _showWorkflowPanel(container);
  }
}

export function mount(container, context) {
  const baseResult = mountBaseRvmJsonPcfExtractTab(container, context);
  _installWorkflowPanel(container);

  return () => {
    if (typeof baseResult === 'function') {
      try { baseResult(); } catch (error) { console.warn('[rvm-json-pcf] Base tab cleanup failed.', error); }
    }
    try { disposeBaseRvmJsonPcfExtractTab(); } catch (error) { console.warn('[rvm-json-pcf] Base tab dispose failed.', error); }
  };
}

export default mount;
