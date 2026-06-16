import { WORKFLOW_MODES } from './model-converters/workflow/WorkflowAdapterContract.js';

export const RVM_JSON_PCF_SOURCE_KIND = 'RVM_VIEWER_CURRENT_MODEL';
export const RVM_JSON_PCF_DEFAULT_PANEL = 'workflow';
export const RVM_JSON_PCF_DEFAULT_PHASE = 'preview';

function _arrayCopy(value) {
  return Array.isArray(value) ? [...value] : [];
}

export function getRvmViewerSelectedCanonicalIds(appState = {}) {
  return _arrayCopy(appState?.rvm?.selection?.canonicalObjectIds);
}

export function resolveRvmJsonPcfScope({ scope, selectedCanonicalIds } = {}) {
  const ids = _arrayCopy(selectedCanonicalIds);
  if (scope === 'selected' || ids.length > 0) return 'selected';
  return 'full';
}

export function buildRvmJsonPcfRequestPayload({ appState = {}, overrides = {} } = {}) {
  const selectedCanonicalIds = Array.isArray(overrides.selectedCanonicalIds)
    ? _arrayCopy(overrides.selectedCanonicalIds)
    : getRvmViewerSelectedCanonicalIds(appState);

  const scope = resolveRvmJsonPcfScope({
    scope: overrides.scope,
    selectedCanonicalIds,
  });

  return {
    mode: overrides.mode || WORKFLOW_MODES.JSON_RVM_PCF,
    workflowAdapterId: overrides.workflowAdapterId || overrides.mode || WORKFLOW_MODES.JSON_RVM_PCF,
    sourceKind: overrides.sourceKind || RVM_JSON_PCF_SOURCE_KIND,
    scope,
    selectedCanonicalIds,
    openWorkflow: overrides.openWorkflow !== false,
    requestedPanel: overrides.requestedPanel || RVM_JSON_PCF_DEFAULT_PANEL,
    requestedPhase: overrides.requestedPhase || RVM_JSON_PCF_DEFAULT_PHASE,
  };
}

export function normalizeRvmJsonPcfRequestPayload({ payload = {}, appState = {} } = {}) {
  const existingExtractState = appState?.rvmPcfExtract || {};
  const explicitFull = payload.scope === 'full';
  const selectedCanonicalIds = explicitFull
    ? []
    : Array.isArray(payload.selectedCanonicalIds)
      ? _arrayCopy(payload.selectedCanonicalIds)
      : _arrayCopy(existingExtractState.selectedCanonicalIds);

  const scope = resolveRvmJsonPcfScope({
    scope: payload.scope,
    selectedCanonicalIds,
  });

  return {
    workflowMode: payload.mode || WORKFLOW_MODES.JSON_RVM_PCF,
    workflowAdapterId: payload.workflowAdapterId || payload.mode || WORKFLOW_MODES.JSON_RVM_PCF,
    sourceKind: payload.sourceKind || RVM_JSON_PCF_SOURCE_KIND,
    scope,
    selectedCanonicalIds,
    activeWorkflowPhase: payload.requestedPhase || RVM_JSON_PCF_DEFAULT_PHASE,
    requestedPanel: payload.requestedPanel || RVM_JSON_PCF_DEFAULT_PANEL,
    openWorkflow: payload.openWorkflow !== false,
  };
}
