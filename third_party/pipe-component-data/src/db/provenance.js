export const REQUIRED_PROVENANCE_FIELDS = Object.freeze([
  'standard',
  'source',
  'datasetVersion',
  'dataStatus',
]);

export function rowProvenance(row) {
  return REQUIRED_PROVENANCE_FIELDS.reduce((acc, field) => {
    acc[field] = row?.[field] ?? '';
    return acc;
  }, {});
}

export function validateDatasetProvenance(datasets) {
  const failures = [];
  for (const [datasetName, rows] of Object.entries(datasets || {})) {
    for (const [index, row] of (rows || []).entries()) {
      for (const field of REQUIRED_PROVENANCE_FIELDS) {
        if (!row?.[field]) failures.push({ datasetName, index, field });
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

export function listDatasetRows(datasets) {
  const rows = [];
  for (const [datasetName, items] of Object.entries(datasets || {})) {
    for (const [index, row] of (items || []).entries()) {
      rows.push({ datasetName, index, row });
    }
  }
  return rows;
}
