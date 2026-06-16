import { developedLengthMm } from './developedLength.js';
import { segmentMass } from './segmentMass.js';
import { supportReactions, reactionSumN } from './supportReactions.js';
import { DEFAULT_GRAVITY_M_S2, round } from './geometryMath.js';

export function toCanonicalGeometry(graph, options = {}) {
  const segments = projectSegments(graph, options);
  const totalMassKg = segments.reduce((sum, segment) => sum + segment.totalMass_kg, 0);
  const totalWeightN = segments.reduce((sum, segment) => sum + segment.totalWeight_N, 0);
  const supports = supportReactions(graph, totalWeightN, options);

  return {
    schema: 'simplified-canonical-geometry/v1',
    sourceGraphProfile: graph.profile,
    units: { length: 'MM', mass: 'KG', force: 'N' },
    options: {
      fluidDensityKgM3: Number(options.fluidDensityKgM3 ?? 1000),
      gravityM_S2: Number(options.gravityM_S2 ?? DEFAULT_GRAVITY_M_S2),
    },
    segments,
    supports,
    totals: {
      mass_kg: round(totalMassKg),
      weight_N: round(totalWeightN),
      supportReaction_N: reactionSumN(supports),
    },
    diagnostics: graph.diagnostics || [],
  };
}

function projectSegments(graph, options) {
  const components = new Map((graph.components || []).map((component) => [component.id, component]));
  return (graph.segments || [])
    .filter((segment) => segment.type !== 'SUPPORT_ASSOCIATION')
    .map((segment) => projectSegment(graph, components.get(segment.componentId), segment, options))
    .filter(Boolean);
}

function projectSegment(graph, component, segment, options) {
  if (!component || component.type === 'SUPPORT') return null;
  const dimensions = component.derived?.dimensions || {};
  const lengthMm = developedLengthMm(component, segment, graph);
  const mass = segmentMass(component, lengthMm, options);
  return {
    id: segment.id,
    componentId: component.id,
    componentType: component.type,
    segmentType: segment.type,
    length_mm: round(lengthMm),
    pipe: pipePayload(component, dimensions),
    contents: { fluidDensity_kg_per_m3: Number(options.fluidDensityKgM3 ?? 1000) },
    component: { componentWeight_kg: mass.componentWeight_kg },
    ...mass,
    provenance: component.derived?.dimensionProvenance || {},
  };
}

function pipePayload(component, dimensions) {
  return {
    outerDiameter_mm: finiteOrNull(dimensions.odMm),
    wallThickness_mm: finiteOrNull(dimensions.wallMm),
    internalDiameter_mm: finiteOrNull(dimensions.boreMm ?? component.bore),
    materialDensity_kg_per_m3: finiteOrNull(dimensions.materialDensityKgM3),
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
