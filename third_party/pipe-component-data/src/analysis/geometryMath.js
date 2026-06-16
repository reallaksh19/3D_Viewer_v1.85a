export const DEFAULT_GRAVITY_M_S2 = 9.80665;

export function distanceMm(a, b) {
  if (!a || !b) return null;
  const dx = Number(b.x) - Number(a.x);
  const dy = Number(b.y) - Number(a.y);
  const dz = Number(b.z) - Number(a.z);
  if (![dx, dy, dz].every(Number.isFinite)) return null;
  return Math.hypot(dx, dy, dz);
}

export function annulusMetalMassKg({ odMm, wallMm, lengthMm, densityKgM3 }) {
  if (![odMm, wallMm, lengthMm, densityKgM3].every(Number.isFinite)) return 0;
  const odM = odMm / 1000;
  const idM = Math.max(0, (odMm - 2 * wallMm) / 1000);
  const lengthM = lengthMm / 1000;
  return Math.PI / 4 * (odM ** 2 - idM ** 2) * lengthM * densityKgM3;
}

export function contentsMassKg({ boreMm, lengthMm, densityKgM3 }) {
  if (![boreMm, lengthMm, densityKgM3].every(Number.isFinite)) return 0;
  const boreM = boreMm / 1000;
  const lengthM = lengthMm / 1000;
  return Math.PI / 4 * boreM ** 2 * lengthM * densityKgM3;
}

export function round(value, digits = 6) {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
