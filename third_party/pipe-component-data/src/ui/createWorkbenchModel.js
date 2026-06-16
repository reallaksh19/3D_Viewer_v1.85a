import { fromCsv } from '../parse/fromCsv.js';
import { fromUxmlXml } from '../parse/fromUxmlXml.js';
import { toUxmlXml } from '../uxml/toUxmlXml.js';

export function createWorkbenchModel(input, options = {}) {
  const graph = parseInput(input, options);
  const diagnostics = [...(graph.diagnostics || []), ...componentDiagnostics(graph)];
  return {
    schema: 'piping-adapter-workbench/v1',
    counts: {
      components: graph.components.length,
      anchors: graph.anchors.length,
      ports: graph.ports.length,
      segments: graph.segments.length,
      supports: graph.supports.length,
      diagnostics: diagnostics.length,
    },
    labels: {
      componentCount: `${graph.components.length} components`,
      diagnosticCount: `${diagnostics.length} diagnostics`,
    },
    actions: {
      roundTrip: () => roundTripStatus(graph),
    },
    graph,
  };
}

function parseInput(input, options) {
  const text = String(input || '');
  if (text.trim().startsWith('<')) return fromUxmlXml(text, options);
  return fromCsv(text, options);
}

function componentDiagnostics(graph) {
  return (graph.components || []).flatMap((component) => component.diagnostics || []);
}

function roundTripStatus(graph) {
  const restored = fromUxmlXml(toUxmlXml(graph));
  const passed = JSON.stringify(restored) === JSON.stringify(graph);
  return { passed, label: passed ? 'passed' : 'failed' };
}
