import { addComponentDiagnostic, applyDimensions, updateBoreAndSegments } from './enrichmentHelpers.js';

export function enrichFitting(graph, component, db) {
  const hit = db.lookupFitting({
    subtype: component.normalized?.subtype || 'LR90',
    nps: component.normalized?.nps,
    schedule: component.normalized?.schedule,
  });
  if (!hit.ok) {
    addComponentDiagnostic(component, {
      code: hit.code,
      message: 'Fitting lookup failed.',
      details: hit.query,
    });
    return;
  }
  const row = hit.row;
  applyDimensions(component, {
    centerlineRadiusMm: row.centerlineRadiusMm,
    angleDeg: row.angleDeg,
    developedLengthMm: row.developedLengthMm,
    weightKg: row.weightKg,
  }, hit);
  updateBoreAndSegments(graph, component, null, row.developedLengthMm);
}
