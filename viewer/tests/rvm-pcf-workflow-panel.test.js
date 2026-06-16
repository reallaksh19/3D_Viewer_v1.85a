import assert from 'node:assert/strict';
import {
  buildRvmJsonPcfWorkflowPanelModel,
  createRvmJsonPcfWorkflowActions,
  renderRvmJsonPcfWorkflowPanel,
  RVM_JSON_PCF_WORKFLOW_DEFAULTS,
} from '../tabs/rvm-json-pcf-workflow-panel.js';
import { WORKFLOW_MODES } from '../tabs/model-converters/workflow/WorkflowAdapterContract.js';

/**
 * Mountable panel scaffold test.
 * This does not validate topology/enrichment/emitter execution.
 */

const defaultModel = buildRvmJsonPcfWorkflowPanelModel({});
assert.equal(defaultModel.adapterId, WORKFLOW_MODES.JSON_RVM_PCF, 'default adapter must be JSON/RVM→PCF');
assert.equal(defaultModel.activePhase, 'preview', 'default active phase must be preview');
assert.equal(defaultModel.scope.scope, 'full', 'default scope must be full');

const selectedModel = buildRvmJsonPcfWorkflowPanelModel({
  activeWorkflowPhase: 'run',
  selectedCanonicalIds: ['A', 'B'],
});
assert.equal(selectedModel.activePhase, 'run', 'active phase override must be preserved');
assert.equal(selectedModel.scope.scope, 'selected', 'selected IDs imply selected scope');
assert.equal(selectedModel.scope.selectedCount, 2, 'selected count must be shown');

const html = renderRvmJsonPcfWorkflowPanel({
  extractState: {
    selectedCanonicalIds: ['A'],
    activeWorkflowPhase: 'weightMatch',
  },
});
assert(html.includes('data-rvm-json-pcf-workflow="true"'), 'workflow panel root marker must be rendered');
assert(html.includes('shared-enrichment-workflow'), 'shared workflow shell must be rendered');
assert(html.includes('Preview is dry-run only'), 'dry-run preview notice must be visible');
assert(html.includes('RvmPcfEmitter'), 'final run order notice must mention emitter');

const calls = [];
const actions = createRvmJsonPcfWorkflowActions({
  updateExtractState(patch, reason) {
    calls.push({ patch, reason });
  },
  refresh() {
    calls.push({ refresh: true });
  },
});
actions.setActiveWorkflowPhase('run');
assert.deepEqual(calls[0], {
  patch: { activeWorkflowPhase: 'run', requestedPanel: 'workflow' },
  reason: 'workflow-phase',
});
assert.deepEqual(calls[1], { refresh: true });

assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.workflowMode, WORKFLOW_MODES.JSON_RVM_PCF);
assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.workflowAdapterId, WORKFLOW_MODES.JSON_RVM_PCF);
assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.requestedPanel, 'workflow');

console.log('rvm-pcf-workflow-panel.test.js passed');
