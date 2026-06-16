export function addGraphDiagnostic(graph, diagnostic) {
  const entry = normalizeDiagnostic(diagnostic);
  return {
    ...graph,
    diagnostics: [...graph.diagnostics, entry],
  };
}

function normalizeDiagnostic(diagnostic = {}) {
  return {
    severity: diagnostic.severity || 'INFO',
    code: diagnostic.code || 'ADAPTER_DIAGNOSTIC',
    message: diagnostic.message || '',
    componentId: diagnostic.componentId || '',
    details: diagnostic.details || {},
  };
}
