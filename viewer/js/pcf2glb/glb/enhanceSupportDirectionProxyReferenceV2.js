import { applyBakedRestraintGlyph } from './BakedRestraintGlyphGeometry.js';

export function enhanceSupportDirectionProxy(object, comp = {}, options = {}) {
  return applyBakedRestraintGlyph(object, comp, options);
}
