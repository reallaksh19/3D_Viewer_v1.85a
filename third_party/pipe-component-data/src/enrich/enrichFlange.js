import { addComponentDiagnostic, applyDimensions, updateBoreAndSegments } from './enrichmentHelpers.js';

export function enrichFlange(graph, component, db) {
  const hit = db.lookupFlange({
    subtype: component.normalized?.subtype || 'WN',
    nps: component.normalized?.nps,
    classRating: component.normalized?.classRating,
    facing: component.normalized?.facing || 'RF',
  });
  if (!hit.ok) {
    addComponentDiagnostic(component, {
      code: hit.code,
      message: 'Flange lookup failed.',
      details: hit.query,
    });
    return;
  }
  const row = hit.row;
  applyDimensions(component, {
    flangeOdMm: row.flangeOdMm,
    flangeThicknessMm: row.flangeThicknessMm,
    hubDiaMm: row.hubDiaMm,
    weldDiaMm: row.weldDiaMm,
    hubLengthMm: row.hubLengthMm,
    rfDiaMm: row.rfDiaMm,
    rfHeightMm: row.rfHeightMm,
    pcdMm: row.pcdMm,
    boltCount: row.boltCount,
    weightKg: row.weightKg,
  }, hit);
  component.normalized.standard = row.standard;
  updateBoreAndSegments(graph, component, null, row.hubLengthMm);
}
