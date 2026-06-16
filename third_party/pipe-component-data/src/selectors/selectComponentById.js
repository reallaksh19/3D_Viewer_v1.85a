export function selectComponentById(graph, componentId) {
  return graph.components.find((component) => component.id === componentId) || null;
}
