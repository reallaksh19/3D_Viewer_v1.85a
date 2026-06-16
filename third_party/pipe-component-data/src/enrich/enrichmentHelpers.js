export function cloneGraph(graph) {
  return JSON.parse(JSON.stringify(graph));
}

export function addComponentDiagnostic(component, diagnostic) {
  component.diagnostics = Array.isArray(component.diagnostics) ? component.diagnostics : [];
  component.diagnostics.push({
    severity: diagnostic.severity || 'WARNING',
    code: diagnostic.code || 'ENRICHMENT_DIAGNOSTIC',
    message: diagnostic.message || diagnostic.code || 'Enrichment diagnostic',
    componentId: component.id,
    details: diagnostic.details || {},
  });
}

export function applyDimensions(component, dimensions, hit) {
  const clean = withoutEmptyValues(dimensions);
  const provenance = {
    ...(hit.provenance || {}),
    matchKey: hit.matchKey,
  };
  component.derived = {
    ...(component.derived || {}),
    dimensions: {
      ...(component.derived?.dimensions || {}),
      ...clean,
    },
    dimensionProvenance: {
      ...(component.derived?.dimensionProvenance || {}),
      ...dimensionProvenance(clean, provenance),
    },
    pipeData: provenance,
  };
}

export function updateBoreAndSegments(graph, component, bore, length) {
  if (Number.isFinite(bore)) component.bore = bore;
  for (const port of graph.ports.filter((p) => p.componentId === component.id)) {
    if (Number.isFinite(bore)) port.bore = bore;
  }
  for (const segment of graph.segments.filter((s) => s.componentId === component.id)) {
    if (Number.isFinite(bore)) segment.bore = bore;
    if (Number.isFinite(length)) segment.length = length;
  }
}

function dimensionProvenance(dimensions, provenance) {
  return Object.fromEntries(Object.keys(dimensions).map((key) => [key, provenance]));
}

function withoutEmptyValues(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}
