import { numberOrNull } from './normalizers.js';

export function readPoint(row, prefix) {
  const x = numberOrNull(row[`${prefix}x`] ?? row[`${prefix}_x`] ?? row[`x${prefix}`]);
  const y = numberOrNull(row[`${prefix}y`] ?? row[`${prefix}_y`] ?? row[`y${prefix}`]);
  const z = numberOrNull(row[`${prefix}z`] ?? row[`${prefix}_z`] ?? row[`z${prefix}`]);
  if ([x, y, z].some((value) => value == null)) return null;
  return { x, y, z };
}

export function readOrigin(row) {
  const x = numberOrNull(row.x ?? row.origin_x ?? row.at_x);
  const y = numberOrNull(row.y ?? row.origin_y ?? row.at_y);
  const z = numberOrNull(row.z ?? row.origin_z ?? row.at_z);
  if ([x, y, z].some((value) => value == null)) return null;
  return { x, y, z };
}

export function fallbackPoint(index) {
  return { x: index * 1000, y: 0, z: 0 };
}
