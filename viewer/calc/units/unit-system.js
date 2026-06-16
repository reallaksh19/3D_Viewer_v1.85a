import { UNIT_FAMILIES } from './unit-defs.js';
import { convertValue, normalizeInput, formatOutput } from './convert.js';

export const UnitSystem = {
  families: UNIT_FAMILIES,
  convert: convertValue,
  normalize: normalizeInput,
  format: formatOutput
};
