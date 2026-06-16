export function patchComponent(graph, componentId, patch = {}) {
  let changed = false;
  const components = graph.components.map((component) => {
    if (component.id !== componentId) return component;
    changed = true;
    return patchOneComponent(component, patch);
  });
  return changed ? { ...graph, components } : graph;
}

function patchOneComponent(component, patch) {
  return {
    ...component,
    ...withoutNestedPatchKeys(patch),
    rawAttributes: mergePlain(component.rawAttributes, patch.rawAttributes),
    normalized: mergePlain(component.normalized, patch.normalized),
    derived: mergePlain(component.derived, patch.derived),
    diagnostics: patch.diagnostics ? [...patch.diagnostics] : component.diagnostics,
  };
}

function withoutNestedPatchKeys(patch) {
  const { rawAttributes, normalized, derived, diagnostics, ...rest } = patch;
  return rest;
}

function mergePlain(base, patch) {
  if (patch == null) return base;
  return {
    ...(base || {}),
    ...patch,
  };
}
