export const UXML_TO_CEG_ANCHOR_ROLE = Object.freeze({
  EP1: 'EP1',
  EP2: 'EP2',
  CP: 'CP',
  BP: 'BRANCH_OUT',
  POS: 'ORIGIN',
  SUPPORT_POINT: 'SUPPORT_ORIGIN',
  TEE_BRANCH_POINT: 'BRANCH_OUT',
  OLET_HEADER_TAP: 'ORIGIN',
  OLET_BRANCH_POINT: 'BRANCH_OUT',
});

export const CEG_TO_UXML_ANCHOR_ROLE = Object.freeze({
  EP1: 'EP1',
  EP2: 'EP2',
  CP: 'CP',
  BRANCH_OUT: 'BP',
  ORIGIN: 'POS',
  SUPPORT_ORIGIN: 'SUPPORT_POINT',
});

export function mapUxmlAnchorRoleToCeg(role) {
  return UXML_TO_CEG_ANCHOR_ROLE[String(role || '').toUpperCase()] || String(role || 'ORIGIN');
}

export function mapCegAnchorRoleToUxml(role) {
  return CEG_TO_UXML_ANCHOR_ROLE[String(role || '').toUpperCase()] || String(role || 'POS');
}

export function mapUxmlTypeToCegType(type) {
  return String(type || 'UNKNOWN').toUpperCase();
}

export function mapCegTypeToUxmlType(type, attributes = {}) {
  const value = String(type || attributes.COMPONENT || attributes.TYPE || 'UNKNOWN').toUpperCase();
  if (value === 'LINE') return 'PIPE';
  if (value === 'ARC' || value === 'BEND') return 'ELBOW';
  return value;
}

export function geometryRoleForCeg(type) {
  const value = String(type || '').toUpperCase();
  if (['PIPE', 'LINE', 'VALVE', 'FLANGE', 'REDUCER', 'GASKET'].includes(value)) return 'LINEAR';
  if (['ELBOW', 'BEND', 'ARC'].includes(value)) return 'CURVE';
  if (['TEE', 'OLET', 'WELDOLET', 'SOCKOLET'].includes(value)) return 'BRANCH';
  return 'POINT';
}
