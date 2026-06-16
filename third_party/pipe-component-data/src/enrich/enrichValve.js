import { addComponentDiagnostic, applyDimensions, updateBoreAndSegments } from './enrichmentHelpers.js';

export function enrichValve(graph, component, db) {
  const query = {
    valveType: component.normalized?.subtype,
    nps: component.normalized?.nps,
    classRating: component.normalized?.classRating,
    facing: component.normalized?.facing || 'RF',
  };
  const hit = db.lookupValve(query);
  if (!hit.ok) {
    addComponentDiagnostic(component, {
      code: hit.code,
      message: 'Valve lookup failed.',
      details: hit.query,
    });
    return;
  }
  if (hit.row.dataStatus === 'SKETCH_ONLY') {
    addComponentDiagnostic(component, {
      code: 'VALVE_SKETCH_ONLY_NO_DIMENSION_TABLE',
      message: 'Valve record has no dimensional CSV table; no face-to-face length fabricated.',
      details: query,
    });
    component.derived = { ...(component.derived || {}), pipeData: { ...hit.provenance, matchKey: hit.matchKey } };
    return;
  }
  const faceToFaceMm = pickValveLength(hit.row, query.facing);
  if (!Number.isFinite(faceToFaceMm)) {
    addComponentDiagnostic(component, {
      severity: 'ERROR',
      code: 'VALVE_FACE_TO_FACE_MISSING',
      message: 'Selected valve length basis is missing.',
      details: query,
    });
    return;
  }
  applyDimensions(component, {
    faceToFaceMm,
    ffRfMm: hit.row.ffRfMm,
    ffRtjMm: hit.row.ffRtjMm,
    ffBwMm: hit.row.ffBwMm,
    boreMm: hit.row.boreMm,
    heightMm: hit.row.heightMm,
    handwheelDiaMm: hit.row.handwheelDiaMm,
    weightKg: hit.row.weightKg,
  }, hit);
  component.normalized.standard = hit.row.standard;
  updateBoreAndSegments(graph, component, hit.row.boreMm, faceToFaceMm);
}

function pickValveLength(row, facing) {
  if (facing === 'RTJ') return row.ffRtjMm;
  if (facing === 'BW') return row.ffBwMm;
  return row.ffRfMm ?? row.lengthMm;
}
