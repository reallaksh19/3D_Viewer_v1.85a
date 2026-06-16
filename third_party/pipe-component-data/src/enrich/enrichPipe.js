import { addComponentDiagnostic, applyDimensions, updateBoreAndSegments } from './enrichmentHelpers.js';

export function enrichPipe(graph, component, db) {
  const hit = db.lookupPipe({
    nps: component.normalized?.nps,
    schedule: component.normalized?.schedule,
  });
  if (!hit.ok) {
    addComponentDiagnostic(component, {
      code: hit.code,
      message: 'Pipe schedule lookup failed.',
      details: hit.query,
    });
    return;
  }
  const row = hit.row;
  applyDimensions(component, {
    odMm: row.odMm,
    wallMm: row.wallMm,
    boreMm: row.idMm,
    weightKgPerM: row.weightKgPerM,
    materialDensityKgM3: row.materialDensityKgM3,
  }, hit);
  updateBoreAndSegments(graph, component, row.idMm, component.derived?.dimensions?.lengthMm);
}
