export function resetEndpointConnections(graph, clusters) {
  for (const cluster of clusters) {
    for (const port of cluster.ports) {
      port.connectsTo = 'ENDPOINT';
      port.connectionConfidence = '';
    }
  }
}

export function applyPortClusters(graph, clusters) {
  const summary = { connectedPairs: 0, terminals: 0, ambiguous: 0 };
  for (const cluster of clusters) {
    if (cluster.ports.length === 1) {
      markTerminal(graph, cluster.ports[0], cluster);
      summary.terminals += 1;
    } else if (cluster.ports.length === 2) {
      connectPair(graph, cluster.ports[0], cluster.ports[1], cluster);
      summary.connectedPairs += 1;
    } else {
      markAmbiguous(graph, cluster);
      summary.ambiguous += 1;
    }
  }
  return summary;
}

function markTerminal(graph, port, cluster) {
  port.connectsTo = 'TERMINAL';
  port.connectionConfidence = 'TOPOLOGY_INFERRED';
  graph.topologyHints.push({
    id: `hint:${port.id}:terminal`,
    type: 'TERMINAL',
    portIds: [port.id],
    anchorIds: cluster.anchorIds,
    confidence: 'TOPOLOGY_INFERRED',
  });
}

function connectPair(graph, first, second, cluster) {
  first.connectsTo = second.id;
  second.connectsTo = first.id;
  first.connectionConfidence = 'TOPOLOGY_INFERRED';
  second.connectionConfidence = 'TOPOLOGY_INFERRED';
  graph.topologyHints.push({
    id: `hint:${first.id}:${second.id}`,
    type: 'EXACT_OR_TOLERANT_CONNECTION',
    edgeClass: cluster.maxDistanceMm === 0 ? 'EXACT_CONNECTION' : 'WITHIN_CONNECT_TOLERANCE',
    portIds: [first.id, second.id].sort(),
    anchorIds: cluster.anchorIds,
    confidence: 'TOPOLOGY_INFERRED',
    maxDistanceMm: cluster.maxDistanceMm,
  });
}

function markAmbiguous(graph, cluster) {
  graph.diagnostics.push({
    severity: 'WARNING',
    code: 'AMBIGUOUS_PORT_CLUSTER',
    message: 'More than two endpoint ports share a connection tolerance cluster.',
    details: { portIds: cluster.ports.map((port) => port.id).sort(), anchorIds: cluster.anchorIds },
  });
}
