import {
  migrateSupportMappingConfig,
  supportKindToXmlTypeFromMapping,
} from './support-mapping-config.js';
import { isBlankDensityValue, resolveLineListDensity } from './line-density-resolver.js';

export function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
}

function firstRowText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (toText(value).trim()) return toText(value).trim();
  }
  return '';
}

function withNormalizedLineListDensity(config) {
  const rows = config?.linelist?.masterRows;
  if (!Array.isArray(rows) || !rows.length) return config;
  let anyDerivedDensity = false;
  const masterRows = rows.map((row) => {
    const current = toText(row?.density).trim();
    if (current && !isBlankDensityValue(current)) {
      anyDerivedDensity = true;
      return row;
    }
    const resolved = resolveLineListDensity(row, null);
    if (!resolved.value) return row;
    anyDerivedDensity = true;
    return { ...row, density: resolved.value, densitySource: resolved.source };
  });
  const fieldMap = config.linelist?.fieldMap && typeof config.linelist.fieldMap === 'object'
    ? { ...config.linelist.fieldMap }
    : {};
  if (anyDerivedDensity && !fieldMap.density) fieldMap.density = '__xmlcii_derived_density';
  return { ...config, linelist: { ...config.linelist, fieldMap, masterRows } };
}

function withNormalizedWeightTypeDesc(config) {
  const rows = config?.weight?.masterRows;
  if (!Array.isArray(rows) || !rows.length) return config;
  let hasTypeDesc = false;
  const masterRows = rows.map((row) => {
    const typeDesc = firstRowText(row, ['typeDesc', 'TypeDesc', 'Type Desc', 'Type Description', 'Description', 'Valve Type']);
    if (!typeDesc) return row;
    hasTypeDesc = true;
    return { ...row, typeDesc };
  });
  const fieldMap = config.weight?.fieldMap && typeof config.weight.fieldMap === 'object' ? { ...config.weight.fieldMap } : {};
  if (hasTypeDesc && !fieldMap.typeDesc) fieldMap.typeDesc = 'TypeDesc';
  return { ...config, weight: { ...config.weight, convertSmallLengthsInToMm: config.weight?.convertSmallLengthsInToMm === true, fieldMap, masterRows } };
}

function withNormalizedSupportMapping(config) {
  const supportMapping = migrateSupportMappingConfig(config);
  return {
    ...config,
    supportMapping,
    supportKindToXmlType: supportKindToXmlTypeFromMapping(supportMapping),
  };
}

function normalizeFullConfig(config) {
  return withNormalizedSupportMapping(withNormalizedWeightTypeDesc(withNormalizedLineListDensity(config)));
}

export function migrateXmlCiiSupportConfigJson(rawJson) {
  const text = toText(rawJson).trim();
  if (!text) return text;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text;
    const normalized = normalizeFullConfig({
      ...parsed,
      supportKindToXmlType: normalizeXmlCiiSupportKindToTypeConfig(parsed.supportKindToXmlType),
    });
    return JSON.stringify(normalized, null, 2);
  } catch {
    return text;
  }
}

export function normalizeXmlCiiSupportKindToTypeConfig(value) {
  const mapping = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  const normalizedGuide = toText(mapping.GUIDE).trim().toUpperCase();
  const normalizedLimit = toText(mapping.LIMIT).trim().toUpperCase();
  const normalizedLinestop = toText(mapping.LINESTOP).trim().toUpperCase();
  if (normalizedGuide === 'X' || normalizedGuide === 'GUIDE') mapping.GUIDE = 'GUI';
  if (normalizedLimit === 'Z' || normalizedLimit === 'LIMIT') mapping.LIMIT = 'LIM';
  if (normalizedLinestop === 'Z' || normalizedLinestop === 'LINESTOP') mapping.LINESTOP = 'LIM';
  return mapping;
}

const DEFAULT_PIPING_CLASS_MATCH = Object.freeze({
  classExactScore: 1000,
  overrideScore: 1100,
  leadingNumericExactScore: 940,
  prefixBaseScore: 910,
  startsWithScore: 860,
  numericDistanceBaseScore: 760,
  numericDistancePenalty: 45,
  numericDistanceMax: 5,
  fuzzyRatioWeight: 780,
  fuzzyMinRatio: 0.60,
  ambiguousScoreDelta: 50,
  minAcceptScore: 760,
  reviewBelowConfidence: 1.0,
  maxCandidates: 8,
  rowScoring: {
    boreToleranceMm: 1.0,
    classExactWeight: 1000,
    boreExactWeight: 300,
    boreNearWeight: 220,
    componentExactWeight: 180,
    pipeRigidWeight: 120,
    ratingExactWeight: 80,
    scheduleExactWeight: 60,
    minAcceptScore: 1000,
    ambiguousScoreDelta: 50,
  }
});

const DEFAULT_TEE_SIF_TYPE_MAPPING = Object.freeze([
  { code: 1, label: 'Reinforced Fabricated Tee', patterns: ['\\bREINFORCED\\b.*\\bFAB(?:RICATED)?\\b.*\\bTEE\\b', '\\bFAB(?:RICATED)?\\b.*\\bREINFORCED\\b.*\\bTEE\\b', '\\bREINF(?:ORCED)?\\b.*\\bTEE\\b'] },
  { code: 2, label: 'Unreinforced Fabricated Tee', patterns: ['\\bUN[-\\s]?REINFORCED\\b.*\\bFAB(?:RICATED)?\\b.*\\bTEE\\b', '\\bFAB(?:RICATED)?\\b.*\\bUN[-\\s]?REINFORCED\\b.*\\bTEE\\b', '\\bUNREINF(?:ORCED)?\\b.*\\bTEE\\b'] },
  { code: 3, label: 'Welding Tee', patterns: ['\\bWELD(?:ING)?\\s+TEE\\b', '\\bTEE\\b.*\\bBW\\b', '\\bTEE\\b.*\\bBUTT\\s*WELD\\b', '\\bTEE\\s+(?:EQUAL|REDUC(?:ING|ER)?)\\b', '\\bTEEB?\\b'] },
  { code: 4, label: 'Sweepolet', patterns: ['\\bSWEEPOLET\\b', '\\bSWEEP\\s*OLET\\b'] },
  { code: 5, label: 'Weldolet', patterns: ['\\bWELDOLET\\b', '\\bWELD\\s*OLET\\b', '\\bWOLET\\b'] },
  { code: 6, label: 'Extruded Welding Tee', patterns: ['\\bEXTRUDED\\b.*\\bWELD(?:ING)?\\b.*\\bTEE\\b', '\\bEXTRUDED\\b.*\\bTEE\\b', '\\bEXT(?:RUDED)?\\s+TEE\\b'] },
]);

export function parseXmlCiiEnrichmentConfig(rawJson) {
  const defaults = {
    useFrictionSentinelForNonYSupports: true,
    convertDensityKgM3ToKgCm3: true,
    disableCiiSupportTagPopulation: false,
    duplicateSupportPolicy: 'prefer_datum',
    coordinateTolerance: 1,
    dtxrPositionOffset: { enabled: true, xOffset: 150500, yOffset: 43000, zOffset: 100000, tolerance: 0.5 },
    xmlAxisToCiiAxis: { Z: 'Y', ANCI: '+Y' },
    supportKindToXmlType: { REST: '+Y', GUIDE: 'GUI', LINESTOP: 'LIM', LIMIT: 'LIM', ANCHOR: 'A', SPRING: 'Y' },
    supportMapping: null,
    defaultXmlSupportType: 'Y',
    defaultStiffness: '1.751270E+12',
    defaultFriction: '0.3',
    defaultWallThickness: 0,
    defaultCorrosionAllowance: 0,
    teeSifTypeMapping: DEFAULT_TEE_SIF_TYPE_MAPPING.map((entry) => ({ ...entry, patterns: [...entry.patterns] })),
    defaultTeeSifType: 0,
    processDefaults: { p1: '700', t1: '120', t2: '309', t3: '-5', density: '100' },
    linelist: { sampleBranchName: '/ASIM-1885-10"-S8810101-91261M7-HC/B1', tokenDelimiter: '-', lineKeyTokenPositions: '4', lineKeyJoiner: '', branchNameRegex: '', lineNoGroup: 1, linelistColumnRegex: '^\\s*(.*?)\\s*$', linelistColumnGroup: 1 },
    rating: { sourceFields: ['RATING', 'PRAT', 'PSPE', 'SPRE', 'LSTU'], tokenDelimiter: '-', pipingClassTokenIndex: 5, pipingClassRegex: '', pipingClassGroup: 1, ratingSequence: [['200', '20000'], ['150', '15000'], ['100', '10000'], ['25', '2500'], ['15', '1500'], ['5', '5000'], ['1', '150'], ['3', '300'], ['6', '600'], ['9', '900']] },
    weight: {
      sourceFields: ['WEIGHT', 'PSIWEIGHT', 'CMPWEIGHTDRY'],
      tokenDelimiter: '-',
      boreTokenIndex: 3,
      boreRegex: '',
      boreGroup: 1,
      inchToMm: 25.4,
      npsToDn: { '0.25': 8, '0.375': 10, '0.5': 15, '0.75': 20, '1': 25, '1.25': 32, '1.5': 40, '2': 50, '2.5': 65, '3': 80, '4': 100, '6': 150, '8': 200, '10': 250, '12': 300, '14': 350, '16': 400, '18': 450, '20': 500, '24': 600 },
      lengthToleranceMm: 4,
      masterLengthUnit: 'raw',
      convertSmallLengthsInToMm: false,
      masterUrl: '../docs/Masters/wtValveweights.json',
      masterRows: [],
    },
    pipingClass: { masterUrl: '../docs/Masters/Piping_class_master.json', masterRows: [], startsWithConfidence: 0.8, fuzzyThreshold: 0.6, reviewBelow: 1.0 },
    pipingClassMatch: DEFAULT_PIPING_CLASS_MATCH,
    material: { masterUrl: '../docs/Masters/PCF_MAT_MAP.TXT', mapRows: [], containsConfidence: 0.9, tokenJaccardThreshold: 0.35 },
    overrides: { pipingClass: {}, material: {}, materialCode: {}, rating: {}, wallThickness: {}, corrosion: {}, rigidWeight: {}, processData: {} },
  };
  const text = toText(rawJson).trim();
  if (!text) return normalizeFullConfig(defaults);
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return normalizeFullConfig(defaults);
    const parsedOverrides = parsed.overrides || {};
    const parsedPipingClassMatch = parsed.pipingClassMatch || {};
    const supportKindToXmlType = normalizeXmlCiiSupportKindToTypeConfig({ ...defaults.supportKindToXmlType, ...(parsed.supportKindToXmlType || {}) });
    const merged = {
      ...defaults,
      ...parsed,
      dtxrPositionOffset: { ...defaults.dtxrPositionOffset, ...(parsed.dtxrPositionOffset || {}) },
      xmlAxisToCiiAxis: { ...defaults.xmlAxisToCiiAxis, ...(parsed.xmlAxisToCiiAxis || {}) },
      supportKindToXmlType,
      teeSifTypeMapping: Array.isArray(parsed.teeSifTypeMapping) ? parsed.teeSifTypeMapping : defaults.teeSifTypeMapping,
      defaultTeeSifType: toFiniteNumber(parsed.defaultTeeSifType, defaults.defaultTeeSifType),
      linelist: { ...defaults.linelist, ...(parsed.linelist || {}) },
      rating: { ...defaults.rating, ...(parsed.rating || {}) },
      weight: { ...defaults.weight, ...(parsed.weight || {}), convertSmallLengthsInToMm: parsed.weight?.convertSmallLengthsInToMm === true },
      pipingClass: { ...defaults.pipingClass, ...(parsed.pipingClass || {}) },
      pipingClassMatch: { ...DEFAULT_PIPING_CLASS_MATCH, ...parsedPipingClassMatch, rowScoring: { ...DEFAULT_PIPING_CLASS_MATCH.rowScoring, ...(parsedPipingClassMatch.rowScoring || {}) } },
      material: { ...defaults.material, ...(parsed.material || {}) },
      processDefaults: { ...defaults.processDefaults, ...(parsed.processDefaults || {}) },
      overrides: {
        pipingClass: { ...(defaults.overrides.pipingClass), ...(parsedOverrides.pipingClass || {}) },
        material: { ...(defaults.overrides.material), ...(parsedOverrides.material || {}) },
        materialCode: { ...(defaults.overrides.materialCode), ...(parsedOverrides.materialCode || {}) },
        rating: { ...(defaults.overrides.rating), ...(parsedOverrides.rating || {}) },
        wallThickness: { ...(defaults.overrides.wallThickness), ...(parsedOverrides.wallThickness || {}) },
        corrosion: { ...(defaults.overrides.corrosion), ...(parsedOverrides.corrosion || {}) },
        rigidWeight: { ...(defaults.overrides.rigidWeight), ...(parsedOverrides.rigidWeight || {}) },
        processData: { ...(parsedOverrides.processData || {}) },
        __previewFillDown: parsedOverrides.__previewFillDown || undefined,
      },
    };
    return normalizeFullConfig(merged);
  } catch {
    return normalizeFullConfig(defaults);
  }
}
