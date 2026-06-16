export function toCegAttributes(component) {
  const n = component.normalized || {};
  const d = component.derived?.dimensions || {};
  return pruneEmpty({
    COMPONENT: component.type,
    SUBTYPE: n.subtype,
    NPS: n.nps,
    DN: n.dn,
    SCHEDULE: n.schedule,
    CLASS: n.classRating,
    FACING: n.facing,
    ENDTYPE: n.endType,
    SUPPORT_KIND: n.supportKind,
    LINEKEY: component.lineKey,
    REFNO: component.refNo,
    SEQNO: component.seqNo,
    NAME: component.name,
    BORE: component.bore ?? d.boreMm,
    BRANCH_BORE: component.branchBore,
    LENGTH: d.lengthMm ?? d.faceToFaceMm,
    WEIGHT: d.weightKg,
    STANDARD: n.standard || component.derived?.pipeData?.standard,
    SOURCE: component.derived?.pipeData?.source,
    DATASET_VERSION: component.derived?.pipeData?.datasetVersion,
  });
}

export function normalizeCegAttributes(attributes = {}, component = {}) {
  return {
    type: String(component.type || attributes.COMPONENT || attributes.TYPE || '').toUpperCase(),
    subtype: value(attributes.SUBTYPE || attributes.subtype),
    nps: value(attributes.NPS || attributes.SIZE || attributes.size),
    dn: value(attributes.DN || attributes.dn),
    schedule: value(attributes.SCHEDULE || attributes.SCH || attributes.schedule),
    classRating: value(attributes.CLASS || attributes.RATING || attributes.rating),
    facing: value(attributes.FACING || attributes.FACE || attributes.face),
    endType: value(attributes.ENDTYPE || attributes.END_TYPE || attributes.endType),
    supportKind: value(attributes.SUPPORT_KIND || attributes.SUBTYPE || attributes.supportKind),
  };
}

export function restoreStructuredDiagnostics(component = {}) {
  const structured = component.rawAttributes?.pipeAdapter?.diagnostics;
  if (Array.isArray(structured)) return structured;
  return (component.diagnostics || []).map((code) => ({
    severity: 'WARNING',
    code: String(code),
    message: String(code),
    details: {},
  }));
}

function value(input) {
  return input == null ? '' : String(input).trim();
}

function pruneEmpty(input) {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== '' && v != null));
}
