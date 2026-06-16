export function componentDimensions(component) {
  return component.derived?.dimensions || {};
}

export function primarySegment(graph, componentId) {
  return (graph.segments || []).find((segment) => segment.componentId === componentId) || null;
}

export function componentAnchors(graph, component) {
  const ids = new Set(component.anchorIds || []);
  return (graph.anchors || []).filter((anchor) => ids.has(anchor.id));
}

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function numericLeaves(value, path = 'root', out = []) {
  if (typeof value === 'number') out.push({ path, value });
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) numericLeaves(child, `${path}.${key}`, out);
  return out;
}

export function sortSpecs(specs) {
  return [...specs].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
