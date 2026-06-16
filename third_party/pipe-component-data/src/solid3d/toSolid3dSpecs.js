import { componentSolidSpec } from './componentSolidSpec.js';
import { numericLeaves, sortSpecs } from './solidSpecHelpers.js';

export function toSolid3dSpecs(graph, options = {}) {
  const specs = sortSpecs((graph.components || []).map((component) => componentSolidSpec(graph, component)));
  const summary = summarize(specs);
  return {
    schema: 'solid3d-specs/v1',
    sourceGraphSchema: graph.schemaVersion,
    profile: options.profile || 'SOLID_3D',
    units: graph.units || {},
    specs,
    summary,
  };
}

export function assertNoInvalidSpecNumbers(payload) {
  for (const leaf of numericLeaves(payload)) {
    if (!Number.isFinite(leaf.value)) {
      throw new Error(`Invalid Solid3D numeric leaf: ${leaf.path}`);
    }
  }
}

function summarize(specs) {
  return {
    componentCount: specs.length,
    placeholderCount: specs.filter((spec) => spec.placeholder).length,
    maxTriangleBudget: Math.max(0, ...specs.map((spec) => spec.triangleBudget || 0)),
  };
}
