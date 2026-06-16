import { UNIT_FAMILIES } from './unit-defs.js';

export function convertValue(val, fromUnit, toUnit, family) {
  if (fromUnit === toUnit) return val;

  if (family === 'temperature') {
    if (fromUnit === 'C' && toUnit === 'F') return (val * 9/5) + 32;
    if (fromUnit === 'F' && toUnit === 'C') return (val - 32) * 5/9;
    return val;
  }

  const def = UNIT_FAMILIES[family];
  if (!def || !def.conversions[fromUnit] || !def.conversions[toUnit]) {
    return val; // Fallback
  }

  // Convert to base, then to target
  const baseVal = val * def.conversions[fromUnit];
  return baseVal / def.conversions[toUnit];
}

export function normalizeInput(val, fromUnit, family) {
  const def = UNIT_FAMILIES[family];
  if (!def) return val;
  return convertValue(val, fromUnit, def.base, family);
}

export function formatOutput(val, family, targetMode) {
  const def = UNIT_FAMILIES[family];
  if (!def) return { value: val, unit: '' };

  let targetUnit = def.base;
  if (targetMode === 'SI') targetUnit = def.si;
  if (targetMode === 'Imperial') targetUnit = def.imperial;

  const converted = convertValue(val, def.base, targetUnit, family);
  return { value: converted, unit: targetUnit };
}
