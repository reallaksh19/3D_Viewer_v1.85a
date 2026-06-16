import { cleanMaterialText, cleanMaterialCode, mapMaterialTextToCiiCode } from './linelist-mapping.js';
import { findBestPipingClassRow, normalizePipingClass } from './piping-class-resolver.js';
import { toFiniteNumber } from './config.js';

function text(value) {
  return String(value ?? '').trim();
}

function firstText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value)) return text(value);
  }
  return '';
}

function overrideValue(overrides, bucketName, keys = []) {
  const bucket = overrides?.[bucketName];
  if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
    for (const key of keys) {
      if (key && Object.prototype.hasOwnProperty.call(bucket, key) && text(bucket[key])) return text(bucket[key]);
    }
  }
  if (bucket !== undefined && (typeof bucket !== 'object' || bucket === null) && text(bucket)) return text(bucket);
  return '';
}

function numericOverrideValue(overrides, bucketName, keys = []) {
  const raw = overrideValue(overrides, bucketName, keys);
  const numeric = toFiniteNumber(raw);
  return numeric == null ? null : numeric;
}

function readClassRowRating(row) {
  return text(row?.rating ?? row?.Rating ?? row?.RATING ?? row?.['Pressure Class'] ?? row?.ratingClass ?? '');
}

function classRowMaterial(row) {
  return text(row?.materialName || row?.Material_Name || row?.Material || row?.material || row?.MATERIAL || '');
}

function materialMapRowCode(row) {
  return cleanMaterialCode(row?.code ?? row?.Code ?? row?.materialCode ?? row?.MaterialCode ?? row?.CA3 ?? '');
}

function materialMapRowNames(row) {
  return [row?.material, row?.Material, row?.materialName, row?.Material_Name, row?.description, row?.Description, row?.name, row?.Name].map(text).filter(Boolean);
}

function materialComparable(value) {
  return cleanMaterialText(value)
    .replace(/\b(ASTM|ASME|API)\b/g, ' ')
    .replace(/\bA\s*\/\s*SA\b/g, ' ')
    .replace(/\bSA\b/g, ' ')
    .replace(/\bGR(?:ADE)?\.?\b/g, ' ')
    .replace(/\bCL(?:ASS)?\.?\b/g, 'CL')
    .replace(/[^A-Z0-9]/g, '');
}

function mapMaterialTextToCiiCodeRobust(materialText, materialMap) {
  const exact = mapMaterialTextToCiiCode(materialText, materialMap);
  if (exact) return exact;
  const key = materialComparable(materialText);
  if (!key) return null;
  const rows = Array.isArray(materialMap) ? materialMap : [];
  return rows.find((row) => {
    if (!materialMapRowCode(row)) return false;
    return materialMapRowNames(row).some((candidate) => {
      const cand = materialComparable(candidate);
      if (!cand) return false;
      return cand === key || (cand.length >= 4 && key.endsWith(cand)) || (key.length >= 4 && cand.endsWith(key));
    });
  }) || null;
}

function shouldUseNumericOverride(value, classValue, config) {
  if (value == null) return false;
  if (value !== 0) return true;
  if (config?.allowZeroWallCorrosionOverrides === true) return true;
  if (classValue != null && classValue !== 0) return false;
  return true;
}

export function resolveMaterialCodeFromLineMaterial({ lineRow, materialMap, pipingClassRow, overrides = {}, overrideKeys = [], xmlNode, xmlBranch }) {
  const lineMaterialRaw = firstText(lineRow, ['material', 'Material', 'MATERIAL', 'Material_Name', 'MOC']);
  const classMaterialRaw = classRowMaterial(pipingClassRow);
  const materialOverride = overrideValue(overrides, 'material', overrideKeys);

  // The class master is authoritative for piping-class dependent pipe items.
  // The line list material may be a broad construction/material family such as CSS.
  const preferredMaterial = materialOverride || classMaterialRaw || lineMaterialRaw;
  const materialText = cleanMaterialText(preferredMaterial);
  const materialOverrideKeys = [...overrideKeys, classMaterialRaw, lineMaterialRaw, materialText].filter(Boolean);

  const explicitMaterialCode = overrideValue(overrides, 'materialCode', materialOverrideKeys);
  if (explicitMaterialCode) return { material: materialText, materialCode: cleanMaterialCode(explicitMaterialCode), source: 'override' };

  const legacyMaterialCode = overrideValue(overrides, 'material', [classMaterialRaw, lineMaterialRaw, materialText].filter(Boolean));
  if (legacyMaterialCode && legacyMaterialCode !== materialOverride) return { material: materialText, materialCode: cleanMaterialCode(legacyMaterialCode), source: 'override' };

  const fromClassMaterial = mapMaterialTextToCiiCodeRobust(classMaterialRaw, materialMap);
  const fromClassCode = materialMapRowCode(fromClassMaterial);
  if (fromClassCode) return { material: cleanMaterialText(classMaterialRaw), materialCode: fromClassCode, source: 'piping-class-material-map', matchedRow: fromClassMaterial };

  const fromLineMaterial = mapMaterialTextToCiiCodeRobust(materialText || lineMaterialRaw, materialMap);
  const fromLineCode = materialMapRowCode(fromLineMaterial);
  if (fromLineCode) return { material: cleanMaterialText(materialText || lineMaterialRaw), materialCode: fromLineCode, source: materialOverride ? 'override-material-map' : 'line-list-material-map', matchedRow: fromLineMaterial };

  const xmlMaterial = cleanMaterialText(xmlNode?.material || xmlBranch?.material || '');
  return { material: materialText || cleanMaterialText(lineMaterialRaw) || cleanMaterialText(classMaterialRaw) || xmlMaterial, materialCode: '', source: xmlMaterial ? 'xml-fallback' : 'blank', matchedRow: null };
}

function classCorrosionValue(row) {
  return toFiniteNumber(row?.corrosion ?? row?.Corrosion ?? row?.corrosionAllowance ?? row?.CORROSION_ALLOWANCE ?? row?.CA);
}

function classWallValue(row) {
  return toFiniteNumber(row?.wallThickness ?? row?.WallThickness ?? row?.['Wall Thickness'] ?? row?.['Wall thickness'] ?? row?.WALL_THICKNESS ?? row?.WT);
}

export function resolveCorrosionFromPipingClass({ lineRow, boreMm, componentType, rating, pipingClassIndex, overrides = {}, overrideKeys = [], xmlNode, xmlBranch, config = {} }) {
  const pipingClass = lineRow?.pipingClass || lineRow?.['Piping Class'] || '';
  const classMatch = findBestPipingClassRow({ pipingClass, boreMm, componentType, rating, pipingClassIndex, overrides, config });
  const classRow = classMatch?.row || null;
  const fromClass = classCorrosionValue(classRow);
  const overrideCorrosion = numericOverrideValue(overrides, 'corrosion', overrideKeys);
  if (shouldUseNumericOverride(overrideCorrosion, fromClass, config)) return { corrosionAllowanceMm: overrideCorrosion, source: 'override', matchedRow: null, needsReview: false };

  const legacyOverride = toFiniteNumber(overrides.corrosionAllowanceMm);
  if (shouldUseNumericOverride(legacyOverride, fromClass, config)) return { corrosionAllowanceMm: legacyOverride, source: 'override', matchedRow: null, needsReview: false };

  if (fromClass != null) return { corrosionAllowanceMm: fromClass, source: 'piping-class-master', matchedPipingClass: pipingClass, matchedRow: classRow, matchMethod: classMatch.method, matchScore: classMatch.score, matchReasons: classMatch.reasons, needsReview: classMatch.needsReview, candidates: classMatch.candidates };

  const fromXml = toFiniteNumber(xmlNode?.corrosionAllowance ?? xmlNode?.CorrosionAllowance ?? xmlBranch?.corrosionAllowance);
  if (fromXml != null) return { corrosionAllowanceMm: fromXml, source: 'xml-fallback', matchedPipingClass: pipingClass, matchedRow: classRow || null, matchMethod: classMatch?.method || 'none', matchScore: classMatch?.score || 0, matchReasons: classMatch?.reasons || [], needsReview: classMatch?.needsReview ?? true, candidates: classMatch?.candidates || [] };

  const fromConfig = toFiniteNumber(config.defaultCorrosionAllowance);
  return { corrosionAllowanceMm: fromConfig ?? 0, source: fromConfig != null ? 'config-default' : 'default-zero', matchedPipingClass: pipingClass, matchedRow: classRow || null, matchMethod: classMatch?.method || 'none', matchScore: classMatch?.score || 0, matchReasons: classMatch?.reasons || [], needsReview: classMatch?.needsReview ?? true, candidates: classMatch?.candidates || [] };
}

export function resolveWallThicknessFromPipingClass({ pipingClassRow, overrides = {}, overrideKeys = [], xmlNode, xmlBranch, config = {} }) {
  const fromClass = classWallValue(pipingClassRow);
  const overrideWall = numericOverrideValue(overrides, 'wallThickness', overrideKeys);
  if (shouldUseNumericOverride(overrideWall, fromClass, config)) return { valueMm: overrideWall, source: 'override' };
  if (fromClass != null) return { valueMm: fromClass, source: 'piping-class-master' };
  const fromXml = toFiniteNumber(xmlNode?.wallThickness ?? xmlNode?.WallThickness ?? xmlBranch?.wallThickness);
  if (fromXml != null) return { valueMm: fromXml, source: 'xml-fallback' };
  const fromConfig = toFiniteNumber(config.defaultWallThickness);
  return { valueMm: fromConfig ?? 0, source: fromConfig != null ? 'config-default' : 'default-zero' };
}

export function resolveBranchProcessData({ branchName, lineKey, lineRow, boreMm, componentType, rating, schedule, materialMap, pipingClassIndex, overrides = {}, xmlNode, xmlBranch, config = {} }) {
  const requestedPipingClass = firstText(lineRow, ['pipingClass', 'Piping Class', 'PIPING_CLASS']) || '';
  const overrideKeys = [lineKey, branchName, requestedPipingClass].filter(Boolean);
  const classMatch = findBestPipingClassRow({ pipingClass: requestedPipingClass, boreMm, componentType, rating: rating || firstText(lineRow, ['rating', 'Rating', 'RATING']), schedule, pipingClassIndex, overrides, config });
  const pipingClassRow = classMatch?.row || null;
  const resolvedPipingClass = classMatch?.resolvedPipingClass || classMatch?.classMatch?.pipingClass || requestedPipingClass;
  const resolvedRating = overrideValue(overrides, 'rating', overrideKeys) || readClassRowRating(pipingClassRow) || text(rating || firstText(lineRow, ['rating', 'Rating', 'RATING']));
  const resolverLineRow = { ...(lineRow || {}), pipingClass: resolvedPipingClass };
  const material = resolveMaterialCodeFromLineMaterial({ lineRow: resolverLineRow, materialMap, pipingClassRow, overrides, overrideKeys, xmlNode, xmlBranch });
  const corrosion = resolveCorrosionFromPipingClass({ lineRow: resolverLineRow, boreMm, componentType, rating: resolvedRating, pipingClassIndex, overrides, overrideKeys, xmlNode, xmlBranch, config });
  const wallThicknessMm = resolveWallThicknessFromPipingClass({ pipingClassRow, overrides, overrideKeys, xmlNode, xmlBranch, config });
  return {
    branchName, lineKey, requestedPipingClass, resolvedPipingClass, normalizedPipingClass: normalizePipingClass(resolvedPipingClass), pipingClass: resolvedPipingClass, rating: resolvedRating,
    material: material.material, materialCode: material.materialCode, materialSource: material.source,
    corrosionAllowanceMm: corrosion.corrosionAllowanceMm, corrosionSource: corrosion.source,
    wallThicknessMm: wallThicknessMm.valueMm, wallThicknessSource: wallThicknessMm.source,
    pipingClassMatchedRow: pipingClassRow,
    pipingClassMatchMethod: classMatch.classMatch?.method || classMatch.method,
    pipingClassConfidence: classMatch.classMatch?.confidence ?? classMatch.confidence,
    pipingClassScore: classMatch.classMatch?.score ?? classMatch.score,
    pipingClassRowMethod: classMatch.method,
    pipingClassRowScore: classMatch.score,
    pipingClassRowReasons: classMatch.reasons,
    pipingClassNeedsReview: classMatch.classMatch?.needsReview || classMatch.needsReview,
    pipingClassCandidates: classMatch.classMatch?.candidates || classMatch.candidates || []
  };
}
