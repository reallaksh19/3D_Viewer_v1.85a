import { renderSharedEnrichmentWorkflowShell, bindSharedEnrichmentWorkflowShell } from './model-converters/workflow/SharedEnrichmentWorkflowShell.js';
import { WORKFLOW_MODES } from './model-converters/workflow/WorkflowAdapterContract.js';
import { getWorkflowAdapter } from './model-converters/workflow/adapters/workflow-adapter-registry.js';

const DEFAULT_WORKFLOW_STATE = Object.freeze({
  workflowMode: WORKFLOW_MODES.JSON_RVM_PCF,
  workflowAdapterId: WORKFLOW_MODES.JSON_RVM_PCF,
  sourceKind: 'RVM_VIEWER_CURRENT_MODEL',
  requestedPanel: 'workflow',
  activeWorkflowPhase: 'preview',
});

function _normalizeWorkflowState(extractState = {}) {
  return {
    ...DEFAULT_WORKFLOW_STATE,
    ...extractState,
    workflowMode: extractState.workflowMode || extractState.workflowAdapterId || DEFAULT_WORKFLOW_STATE.workflowMode,
    workflowAdapterId: extractState.workflowAdapterId || extractState.workflowMode || DEFAULT_WORKFLOW_STATE.workflowAdapterId,
    sourceKind: extractState.sourceKind || DEFAULT_WORKFLOW_STATE.sourceKind,
    requestedPanel: extractState.requestedPanel || DEFAULT_WORKFLOW_STATE.requestedPanel,
    activeWorkflowPhase: extractState.activeWorkflowPhase || DEFAULT_WORKFLOW_STATE.activeWorkflowPhase,
  };
}

function _esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _scopeSummary(workflowState) {
  const ids = Array.isArray(workflowState.selectedCanonicalIds)
    ? workflowState.selectedCanonicalIds
    : [];
  const scope = workflowState.scope || (ids.length ? 'selected' : 'full');
  return {
    scope,
    selectedCount: ids.length,
    sourceKind: workflowState.sourceKind || DEFAULT_WORKFLOW_STATE.sourceKind,
  };
}

export function buildRvmJsonPcfWorkflowPanelModel(extractState = {}) {
  const workflowState = _normalizeWorkflowState(extractState);
  const adapter = getWorkflowAdapter(
    workflowState.workflowAdapterId,
    WORKFLOW_MODES.JSON_RVM_PCF
  );
  const phaseModel = adapter.getPhaseModel(workflowState) || {};
  const scope = _scopeSummary(workflowState);

  return {
    workflowState,
    adapter,
    adapterId: adapter.id,
    phaseModel,
    activePhase: workflowState.activeWorkflowPhase,
    scope,
    title: 'JSON/RVM → PCF Workflow',
    subtitle: 'Shared XML→CII(2019) enrichment workflow mounted inside the RVM PCF extract tab.',
  };
}

export function renderRvmJsonPcfWorkflowPanel({
  extractState = {},
  actions = {},
} = {}) {
  const model = buildRvmJsonPcfWorkflowPanelModel(extractState);

  return `
    <section class="rvm-json-pcf-workflow-panel" data-rvm-json-pcf-workflow="true">
      <header class="rvm-json-pcf-workflow-panel__header">
        <div>
          <div class="rvm-json-pcf-workflow-panel__eyebrow">RVM JSON/RVM → PCF</div>
          <h3>${_esc(model.title)}</h3>
          <p>${_esc(model.subtitle)}</p>
        </div>
        <dl class="rvm-json-pcf-workflow-panel__meta">
          <div><dt>Adapter</dt><dd>${_esc(model.adapterId)}</dd></div>
          <div><dt>Phase</dt><dd>${_esc(model.activePhase)}</dd></div>
          <div><dt>Scope</dt><dd>${_esc(model.scope.scope)}</dd></div>
          <div><dt>Selected</dt><dd>${_esc(model.scope.selectedCount)}</dd></div>
        </dl>
      </header>
      <div class="rvm-json-pcf-workflow-panel__notice">
        Preview is dry-run only. Final PCF export must run topology, then enrichment, then RvmPcfEmitter.
      </div>
      ${renderSharedEnrichmentWorkflowShell({
        adapter: model.adapter,
        state: model.workflowState,
        actions,
      })}
    </section>
  `;
}

export function mountRvmJsonPcfWorkflowPanel(container, {
  extractState = {},
  actions = {},
} = {}) {
  if (!container) return null;

  container.innerHTML = renderRvmJsonPcfWorkflowPanel({ extractState, actions });

  const workflowRoot = container.querySelector('.shared-enrichment-workflow');
  bindSharedEnrichmentWorkflowShell(workflowRoot, {
    state: _normalizeWorkflowState(extractState),
    actions,
  });

  return {
    adapterId: workflowRoot?.getAttribute('data-workflow-adapter') || '',
    activePhase: workflowRoot
      ?.querySelector('[data-active-workflow-phase]')
      ?.getAttribute('data-active-workflow-phase') || '',
  };
}

export function createRvmJsonPcfWorkflowActions({
  updateExtractState,
  refresh,
} = {}) {
  return {
    setActiveWorkflowPhase(phase) {
      if (typeof updateExtractState === 'function') {
        updateExtractState({ activeWorkflowPhase: phase, requestedPanel: 'workflow' }, 'workflow-phase');
      }
      if (typeof refresh === 'function') refresh();
    },
  };
}

export const RVM_JSON_PCF_WORKFLOW_DEFAULTS = DEFAULT_WORKFLOW_STATE;
