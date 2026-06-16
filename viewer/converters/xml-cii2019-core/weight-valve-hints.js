function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function pickText(row, keys) {
  for (const key of keys || []) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value).trim()) return text(value).trim();
  }
  return '';
}

function pickNumber(row, keys) {
  for (const key of keys || []) {
    const match = text(row?.[key] ?? row?._raw?.[key])
      .replace(/,/g, '')
      .match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const numeric = Number(match[0]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

export function normalizeWeightText(value) {
  return text(value)
    .toUpperCase()
    .replace(/[_/\\]+/g, '-')
    .replace(/[^A-Z0-9#+.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeRegex(pattern) {
  try { return pattern ? new RegExp(pattern, 'i') : null; }
  catch { return null; }
}

function normalizedRating(value) {
  return text(value).replace(/#/g, '').trim().toUpperCase();
}

function masterLength(rawLength, xmlLengthMm, config) {
  if (rawLength === null || rawLength === undefined) return null;
  if (config?.weight?.convertSmallLengthsInToMm !== true) return rawLength;
  return rawLength < 100 && xmlLengthMm > 100
    ? rawLength * numberOr(config?.weight?.inchToMm, 25.4)
    : rawLength;
}

export const DEFAULT_VALVE_HINT_MAPPING = Object.freeze([
  {
    on: true,
    priority: 10,
    code: 'VGT',
    label: 'Gate Valve',
    subtype: 'GATE',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VGT(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bGATE\b.*\bVALVE\b|\bVALVE\b.*\bGATE\b|\bGATE\b`,
    notes: 'Gate valve tag',
  },
  {
    on: true,
    priority: 20,
    code: 'VCH',
    label: 'Check Valve',
    subtype: 'CHECK',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VCH(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\b(CHECK|SWING|NRV|NON[- ]?RETURN)\b`,
    notes: 'Check / swing / NRV tag',
  },
  {
    on: true,
    priority: 30,
    code: 'VBL',
    label: 'Ball Valve',
    subtype: 'BALL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBL(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBALL\b.*\bVALVE\b|\bVALVE\b.*\bBALL\b|\bBALL\b`,
    notes: 'Ball valve tag',
  },
  {
    on: true,
    priority: 40,
    code: 'VCV',
    label: 'Control Valve',
    subtype: 'CONTROL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VCV(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bCONTROL\b.*\bVALVE\b|\bVALVE\b.*\bCONTROL\b|\bCONTROL\b`,
    notes: 'Control valve tag',
  },
  {
    on: true,
    priority: 50,
    code: 'VGL',
    label: 'Globe Valve',
    subtype: 'GLOBE',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VGL(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bGLOBE\b.*\bVALVE\b|\bVALVE\b.*\bGLOBE\b|\bGLOBE\b`,
    notes: 'Globe valve tag',
  },
  {
    on: true,
    priority: 60,
    code: 'VBF',
    label: 'Butterfly Valve',
    subtype: 'BUTTERFLY',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBF(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBUTTERFLY\b.*\bVALVE\b|\bVALVE\b.*\bBUTTERFLY\b|\bBUTTERFLY\b`,
    notes: 'Butterfly valve tag',
  },
  {
    on: true,
    priority: 70,
    code: 'VBV',
    label: 'Ball Valve',
    subtype: 'BALL',
    nodeNameRegex: String.raw`(?:^|[-_/\s])VBV(?=$|[-_/\s]|\d)`,
    masterRegex: String.raw`\bBALL\b.*\bVALVE\b|\bVALVE\b.*\bBALL\b|\bBALL\b`,
    notes: 'Alternate ball valve tag',
  },
]);

export function valveHintLengthToleranceMm(config) {
  return Math.max(0, numberOr(config?.weight?.valveHintLengthToleranceMm, 6));
}

export function useNodeNameValveHints(config) {
  return config?.weight?.useNodeNameValveHints !== false;
}

export function valveHintMappingRows(config) {
  const rows = Array.isArray(config?.weight?.valveHintMapping) && config.weight.valveHintMapping.length
    ? config.weight.valveHintMapping
    : DEFAULT_VALVE_HINT_MAPPING;
  return rows.map((row, index) => ({
    on: row?.on !== false,
    priority: numberOr(row?.priority, (index + 1) * 10),
    code: text(row?.code).trim().toUpperCase(),
    label: text(row?.label).trim(),
    family: text(row?.family || 'VALVE').trim().toUpperCase() || 'VALVE',
    subtype: text(row?.subtype).trim().toUpperCase(),
    nodeNameRegex: text(row?.nodeNameRegex).trim(),
    masterRegex: text(row?.masterRegex).trim(),
    notes: text(row?.notes).trim(),
  }));
}

export function ensureValveHintConfig(config) {
  if (!config.weight || typeof config.weight !== 'object') config.weight = {};
  if (!Array.isArray(config.weight.valveHintMapping) || !config.weight.valveHintMapping.length) {
    config.weight.valveHintMapping = valveHintMappingRows(config);
  }
  if (!Number.isFinite(Number(config.weight.valveHintLengthToleranceMm))) config.weight.valveHintLengthToleranceMm = 6;
  if (config.weight.useNodeNameValveHints !== false) config.weight.useNodeNameValveHints = true;
  if (config.weight.showLengthRejectedSemanticMatches !== false) config.weight.showLengthRejectedSemanticMatches = true;
  if (config.weight.useWeightExtrapolation !== false) config.weight.useWeightExtrapolation = true;
  if (!Number.isFinite(Number(config.weight.extrapolationMinRatio))) config.weight.extrapolationMinRatio = 0.65;
  if (!Number.isFinite(Number(config.weight.extrapolationMaxRatio))) config.weight.extrapolationMaxRatio = 1.6;
  return config.weight;
}

export function resolveNodeNameValveHint(nodeName, config) {
  if (!useNodeNameValveHints(config)) return null;
  const raw = text(nodeName);
  if (!raw.trim()) return null;
  const normalized = normalizeWeightText(raw);
  for (const row of valveHintMappingRows(config).filter((entry) => entry.on !== false).sort((a, b) => a.priority - b.priority)) {
    const regex = safeRegex(row.nodeNameRegex);
    if (regex && (regex.test(raw) || regex.test(normalized))) return { ...row, family: 'VALVE' };
    if (row.code && (`-${normalized}-`).includes(`-${row.code}-`)) return { ...row, family: 'VALVE' };
  }
  return null;
}

export function formatValveHint(hint) {
  return hint ? `${hint.code} → ${hint.label || hint.subtype || 'Valve'}` : '';
}

export function classifyWeightMasterCandidate(candidate) {
  const value = typeof candidate === 'string' ? candidate : `${candidate?.type || ''} ${candidate?.typeDesc || ''}`;
  const normalized = normalizeWeightText(value);
  if (/\b(SPECTACLE|SPADE|SPACER|BLIND)\b/.test(normalized)) return { family: 'BLIND', subtype: 'BLIND' };
  if (/\b(CHECK|SWING|NRV|NON-RETURN|NONRETURN)\b/.test(normalized)) return { family: 'VALVE', subtype: 'CHECK' };
  if (/\bGATE\b/.test(normalized)) return { family: 'VALVE', subtype: 'GATE' };
  if (/\bBALL\b/.test(normalized)) return { family: 'VALVE', subtype: 'BALL' };
  if (/\bGLOBE\b/.test(normalized)) return { family: 'VALVE', subtype: 'GLOBE' };
  if (/\bCONTROL\b/.test(normalized)) return { family: 'VALVE', subtype: 'CONTROL' };
  if (/\bBUTTERFLY\b/.test(normalized)) return { family: 'VALVE', subtype: 'BUTTERFLY' };
  if (/\b(VALVE|VLV)\b/.test(normalized)) return { family: 'VALVE', subtype: 'VALVE_GENERIC' };
  if (/\b(FLANGE|FLANGED|WELDNECK|WELDING-NECK|WNFL)\b/.test(normalized)) return { family: 'FLANGE', subtype: 'FLANGE' };
  return { family: '', subtype: '' };
}

export function scoreValveHintAgainstCandidate(nodeHint, candidateClass, candidate) {
  if (!nodeHint) return { tier: 0, reason: '' };
  const masterText = `${candidate?.type || ''} ${candidate?.typeDesc || ''}`;
  const regex = safeRegex(nodeHint.masterRegex);
  if (regex && regex.test(masterText)) return { tier: 120, reason: `${nodeHint.code} exact` };
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE' && nodeHint.subtype && nodeHint.subtype === candidateClass.subtype) {
    return { tier: 110, reason: `${nodeHint.code} exact` };
  }
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE' && candidateClass.subtype && candidateClass.subtype !== 'VALVE_GENERIC') {
    return { tier: 70, reason: `${nodeHint.code} valve, wrong subtype` };
  }
  if (nodeHint.family === 'VALVE' && candidateClass.family === 'VALVE') return { tier: 50, reason: `${nodeHint.code} generic valve` };
  if (nodeHint.family === 'VALVE' && ['FLANGE', 'BLIND'].includes(candidateClass.family)) return { tier: -80, reason: `${nodeHint.code} non-valve demoted` };
  return { tier: 0, reason: `${nodeHint.code} no semantic match` };
}

function resolveCandidateWeight(candidate, xmlLengthMm, config) {
  const masterWeight = Number(candidate.weight);
  const masterLength = Number(candidate.rowLength);
  const xmlLength = Number(xmlLengthMm);
  if (config?.weight?.useWeightExtrapolation === false || !Number.isFinite(masterWeight) || !Number.isFinite(masterLength) || !Number.isFinite(xmlLength) || masterLength <= 0) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: 1, weightWarning: '' };
  }
  const ratio = xmlLength / masterLength;
  const minRatio = numberOr(config?.weight?.extrapolationMinRatio, 0.65);
  const maxRatio = numberOr(config?.weight?.extrapolationMaxRatio, 1.6);
  if (ratio < minRatio || ratio > maxRatio) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: ratio, weightWarning: `extrapolation ratio ${ratio.toFixed(2)} outside ${minRatio}-${maxRatio}` };
  }
  if (Math.abs(ratio - 1) <= 1e-9) {
    return { masterWeight, selectedWeight: masterWeight, suggestedWeight: masterWeight, weightMethod: 'master', extrapolationRatio: 1, weightWarning: '' };
  }
  const selectedWeight = Math.round(masterWeight * ratio * 1000) / 1000;
  return { masterWeight, selectedWeight, suggestedWeight: selectedWeight, weightMethod: 'length-extrapolated', extrapolationRatio: ratio, weightWarning: '' };
}

function baseCandidateFromRow(row, config, lengthMm) {
  const rowBore = pickNumber(row, ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'DN', 'NB']);
  const rawLength = pickNumber(row, ['lengthMm', 'length', 'Length (RF-F/F)', 'RF-F/F', 'LEN', 'faceToFace']);
  const rowLength = masterLength(rawLength, Number(lengthMm), config);
  const weight = pickNumber(row, ['valveWeight', 'directWeight', 'weight', 'Weight', 'RF/RTJ KG', 'Valve Weight']);
  const rowRating = normalizedRating(pickText(row, ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']));
  const type = pickText(row, ['type', 'Type', 'TYPE', 'valveType', 'Valve Type']);
  const typeDesc = pickText(row, ['typeDesc', 'TypeDesc', 'Type Desc', 'Type Description', 'Description', 'Valve Type']);
  if (rowBore === null || rowLength === null || weight === null || !rowRating) return null;
  return { weight, rowBore, rowLength, rowRating, type, valveType: type, typeDesc, rowData: row };
}

function enrichWeightCandidate({ candidate, nodeHint, xmlLengthMm, toleranceMm, config, wantedRating, boreMm }) {
  const lengthDelta = Number.isFinite(candidate.lengthDelta) ? candidate.lengthDelta : Math.abs(Number(candidate.rowLength) - Number(xmlLengthMm));
  const boreDelta = Number.isFinite(candidate.boreDelta) ? candidate.boreDelta : Math.abs(Number(candidate.rowBore) - Number(boreMm));
  const ratingExact = candidate.rowRating === wantedRating;
  const ratingPartial = !ratingExact && candidate.rowRating && wantedRating && (candidate.rowRating.includes(wantedRating) || wantedRating.includes(candidate.rowRating));
  const ratingScore = ratingExact ? 1 : (ratingPartial ? 0.65 : 0);
  const lengthQualified = Number.isFinite(lengthDelta) && lengthDelta <= toleranceMm;
  const candidateClass = classifyWeightMasterCandidate(candidate);
  const semantic = scoreValveHintAgainstCandidate(nodeHint, candidateClass, candidate);
  const weightInfo = resolveCandidateWeight(candidate, xmlLengthMm, config);
  const boreScore = Math.max(0, 1 - Math.min(boreDelta / Math.max(Math.abs(Number(boreMm)) * 0.25, 25), 1));
  const lengthScore = 1 - Math.min(lengthDelta / Math.max(toleranceMm, 1), 1);
  const score = ((ratingScore * 3) + (boreScore * 2) + lengthScore) / 6;
  return {
    ...candidate,
    ...weightInfo,
    lengthDelta,
    boreDelta,
    ratingExact,
    ratingScore,
    score,
    candidateClass,
    lengthQualified,
    lengthToleranceMm: toleranceMm,
    nodeValveHint: nodeHint,
    valveHintLabel: formatValveHint(nodeHint),
    semanticTier: lengthQualified ? semantic.tier : 0,
    semanticPotentialTier: semantic.tier,
    semanticReason: semantic.reason,
    rejectedReason: lengthQualified ? '' : `length failed, Δ${lengthDelta.toFixed(1)}mm > ±${toleranceMm}mm`,
    preferred: ratingExact && boreDelta < 1 && lengthQualified && Number(weightInfo.selectedWeight) > 0,
  };
}

export function compareRankedWeightCandidates(a, b) {
  return (b.semanticTier - a.semanticTier) || (Number(b.preferred) - Number(a.preferred)) || (b.score - a.score) || (a.lengthDelta - b.lengthDelta) || (a.boreDelta - b.boreDelta);
}

export function compareRejectedWeightCandidates(a, b) {
  return (b.semanticPotentialTier - a.semanticPotentialTier) || (a.lengthDelta - b.lengthDelta) || (b.score - a.score) || (a.boreDelta - b.boreDelta);
}

export function rankXmlCiiWeightCandidates(context, config, options = {}) {
  ensureValveHintConfig(config || {});
  const { boreMm, rating, lengthMm, nodeName = '' } = context || {};
  if (boreMm === null || boreMm === undefined || lengthMm === null || lengthMm === undefined) return { nodeHint: null, candidates: [], rejectedCandidates: [], best: null };
  const rows = Array.isArray(config?.weight?.masterRows) ? config.weight.masterRows : [];
  if (!rows.length) return { nodeHint: null, candidates: [], rejectedCandidates: [], best: null };
  const toleranceMm = valveHintLengthToleranceMm(config);
  const includeRejected = options.includeRejected !== false && config?.weight?.showLengthRejectedSemanticMatches !== false;
  const wantedRating = normalizedRating(rating);
  const nodeHint = useNodeNameValveHints(config) ? resolveNodeNameValveHint(nodeName, config) : null;
  const ranked = [];
  const rejected = [];
  for (const row of rows) {
    const base = baseCandidateFromRow(row, config, lengthMm);
    if (!base) continue;
    const boreDelta = Math.abs(base.rowBore - Number(boreMm));
    if (!Number.isFinite(boreDelta) || boreDelta >= 1) continue;
    const ratingExact = base.rowRating === wantedRating;
    const ratingPartial = !ratingExact && base.rowRating && wantedRating && (base.rowRating.includes(wantedRating) || wantedRating.includes(base.rowRating));
    if (!ratingExact && !ratingPartial) continue;
    const enriched = enrichWeightCandidate({ candidate: { ...base, boreDelta }, nodeHint, xmlLengthMm: lengthMm, toleranceMm, config, wantedRating, boreMm });
    if (enriched.lengthQualified) ranked.push(enriched);
    else if (includeRejected && enriched.semanticPotentialTier > 0) rejected.push(enriched);
  }
  ranked.sort(compareRankedWeightCandidates);
  rejected.sort(compareRejectedWeightCandidates);
  return { nodeHint, candidates: ranked, rejectedCandidates: rejected, best: ranked[0] || null };
}

export function buildRankedWeightCandidates(context, config) {
  return rankXmlCiiWeightCandidates(context, config, { includeRejected: false }).candidates.slice(0, 8);
}
