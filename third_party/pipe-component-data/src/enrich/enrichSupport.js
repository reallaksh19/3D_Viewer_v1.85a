import { addComponentDiagnostic, applyDimensions } from './enrichmentHelpers.js';

export function enrichSupport(graph, component, db) {
  const support = graph.supports.find((item) => item.componentId === component.id);
  const row = db.datasets.supportDefaults.find((item) => item.supportKind === component.normalized?.supportKind);
  if (!row) {
    addComponentDiagnostic(component, {
      code: 'SUPPORT_DEFAULT_LOOKUP_MISS',
      message: 'Support defaults lookup failed.',
      details: { supportKind: component.normalized?.supportKind },
    });
    return;
  }
  const hit = {
    row,
    matchKey: `SUPPORT|${row.supportKind}`,
    provenance: pickProvenance(row),
  };
  applyDimensions(component, {
    shoeHeightMm: row.shoeHeightMm,
    baseLengthMm: row.baseLengthMm,
    baseWidthMm: row.baseWidthMm,
    guideGapMm: row.guideGapMm,
    guidePlateHeightMm: row.guidePlateHeightMm,
  }, hit);
  if (support) support.supportKind = row.supportKind;
}

function pickProvenance(row) {
  return {
    standard: row.standard,
    source: row.source,
    datasetVersion: row.datasetVersion,
    dataStatus: row.dataStatus,
  };
}
