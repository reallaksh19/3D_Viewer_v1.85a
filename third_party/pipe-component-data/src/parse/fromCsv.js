import { buildGraphFromRows } from './buildGraphFromRows.js';
import { parseCsvRows } from './csvRows.js';

export function fromCsv(csvText, options = {}) {
  const rows = parseCsvRows(csvText);
  const graph = buildGraphFromRows(rows, options);
  return addMalformedRowDiagnostics(graph, rows);
}

function addMalformedRowDiagnostics(graph, rows) {
  const diagnostics = [];
  rows.forEach((row) => {
    if (!row.type && !row.name && !row.description) {
      diagnostics.push({
        severity: 'WARNING',
        code: 'CSV_ROW_MISSING_TYPE_HINT',
        message: 'CSV row has no type/name/description classification hint.',
        componentId: row.id || '',
        details: { line: row.__line },
      });
    }
  });
  return diagnostics.length ? { ...graph, diagnostics: [...graph.diagnostics, ...diagnostics] } : graph;
}
