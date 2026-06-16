const TYPE_ALIASES = {
  LINE: 'PIPE',
  PIPE: 'PIPE',
  FLANGE: 'FLANGE',
  VALVE: 'VALVE',
  SUPPORT: 'SUPPORT',
  ELBOW: 'ELBOW',
  BEND: 'ELBOW',
  TEE: 'TEE',
  OLET: 'TEE',
  REDUCER: 'REDUCER',
};

export function normalizeType(value) {
  const key = clean(value);
  return TYPE_ALIASES[key] || key || 'UNKNOWN';
}

export function normalizeSubtype(value) {
  return clean(value).replace(/\s+/g, '_');
}

export function normalizeFacing(value) {
  const key = clean(value);
  if (['RF', 'RTJ', 'FF', 'BW'].includes(key)) return key;
  if (key.includes('RAISED')) return 'RF';
  if (key.includes('RING')) return 'RTJ';
  return key;
}

export function normalizeEndType(value) {
  const key = clean(value);
  if (['FL', 'FLG', 'FLANGED'].includes(key)) return 'FLANGED';
  if (['BW', 'BUTTWELD', 'BUTT_WELD'].includes(key)) return 'BW';
  if (['SW', 'SOCKETWELD', 'SOCKET_WELD'].includes(key)) return 'SW';
  return key;
}

export function normalizeNps(value) {
  return String(value ?? '').trim().replace(/"/g, '');
}

export function normalizeClass(value) {
  return String(value ?? '').trim().replace(/#/g, '');
}

export function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function clean(value) {
  return String(value ?? '').trim().toUpperCase();
}
