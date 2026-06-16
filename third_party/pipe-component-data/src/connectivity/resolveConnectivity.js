import { applyPortClusters, resetEndpointConnections } from './connectPorts.js';
import { clusterEndpointPorts } from './portClusters.js';
import { attachSupportsToNearestPipe } from './supportAttachment.js';

export function resolveConnectivity(graph, options = {}) {
  const next = cloneGraph(graph);
  next.topologyHints = [];
  const clusters = clusterEndpointPorts(next, Number(options.toleranceMm ?? 1));
  resetEndpointConnections(next, clusters);
  const summary = applyPortClusters(next, clusters);
  attachSupportsToNearestPipe(next, options);
  sortGraphSections(next);
  next.adapter = {
    ...(next.adapter || {}),
    connectivity: {
      toleranceMm: Number(options.toleranceMm ?? 1),
      supportToleranceMm: Number(options.supportToleranceMm ?? 50),
      ...summary,
    },
  };
  return next;
}

function cloneGraph(graph) {
  return JSON.parse(JSON.stringify(graph));
}

function sortGraphSections(graph) {
  for (const section of ['components', 'anchors', 'ports', 'segments', 'supports']) {
    graph[section] = [...(graph[section] || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  graph.diagnostics = [...(graph.diagnostics || [])].sort(compareByCodeAndDetails);
  graph.topologyHints = [...(graph.topologyHints || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function compareByCodeAndDetails(a, b) {
  const code = String(a.code || '').localeCompare(String(b.code || ''));
  if (code) return code;
  return JSON.stringify(a.details || {}).localeCompare(JSON.stringify(b.details || {}));
}
