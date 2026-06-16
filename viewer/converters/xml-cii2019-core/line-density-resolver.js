const BLANK_DENSITY_VALUES = new Set(['', '-', '--', '---', 'NA', 'N/A', 'NULL', 'NONE', 'NIL']);

function rawText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function isBlankDensityValue(value) {
  const normalized = rawText(value).toUpperCase().replace(/\s+/g, '');
  return BLANK_DENSITY_VALUES.has(normalized);
}

function text(value) {
  const raw = rawText(value);
  return isBlankDensityValue(raw) ? '' : raw;
}

function upper(value) {
  return text(value).toUpperCase();
}

function readRowValue(row, keys = []) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    if (!key) continue;
    const value = row[key] ?? row._raw?.[key];
    const cleaned = text(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function readOverride(processOverride, key) {
  if (!processOverride || typeof processOverride !== 'object') return '';
  if (!Object.prototype.hasOwnProperty.call(processOverride, key)) return '';
  return text(processOverride[key]);
}

const DENSITY_ALIASES = Object.freeze({
  density: Object.freeze(['density', 'Density', 'DENSITY', 'FluidDensity', 'Fluid Density', 'Density kg/m3', 'kg/m3']),
  densityMixed: Object.freeze(['densityMixed', 'Density Mixed', 'Mixed Density', 'Mixed kg/m3', 'Density (Mixed)', 'Mixed']),
  densityGas: Object.freeze(['densityGas', 'Density Gas', 'Gas Density', 'Gas kg/m3', 'Density (Gas)', 'Gas']),
  densityLiquid: Object.freeze(['densityLiquid', 'Density Liquid', 'Liquid Density', 'Liquid kg/m3', 'Density (Liquid)', 'Liquid', 'Liq Density']),
  phase: Object.freeze(['phase', 'Phase', 'PHASE', 'Fluid Phase', 'Medium Phase', 'Medium', 'State']),
});

export function resolveLineListDensity(row, processOverride = null) {
  const overrideDensity = readOverride(processOverride, 'density');
  if (overrideDensity) return { value: overrideDensity, source: 'override', phase: '', selected: 'density' };

  const direct = readRowValue(row, DENSITY_ALIASES.density);
  const mixed = readRowValue(row, DENSITY_ALIASES.densityMixed);
  const gas = readRowValue(row, DENSITY_ALIASES.densityGas);
  const liquid = readRowValue(row, DENSITY_ALIASES.densityLiquid);
  const phase = upper(readRowValue(row, DENSITY_ALIASES.phase));

  if ((phase.startsWith('M') || phase.includes('MIX')) && mixed) return { value: mixed, source: 'linelist-density-mixed', phase, selected: 'densityMixed' };
  if ((phase.startsWith('G') || phase.includes('GAS')) && gas) return { value: gas, source: 'linelist-density-gas', phase, selected: 'densityGas' };
  if ((phase.startsWith('L') || phase.includes('LIQ')) && liquid) return { value: liquid, source: 'linelist-density-liquid', phase, selected: 'densityLiquid' };

  if (direct) return { value: direct, source: 'linelist-density', phase, selected: 'density' };
  if (mixed) return { value: mixed, source: 'linelist-density-mixed', phase, selected: 'densityMixed' };
  if (gas) return { value: gas, source: 'linelist-density-gas', phase, selected: 'densityGas' };
  if (liquid) return { value: liquid, source: 'linelist-density-liquid', phase, selected: 'densityLiquid' };
  return { value: '', source: 'none', phase, selected: '' };
}
