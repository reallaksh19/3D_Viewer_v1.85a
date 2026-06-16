import { toFiniteNumber } from './config.js';

export const DEFAULT_PIPING_CLASS_MATCH_CONFIG = Object.freeze({
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
  rowScoring: Object.freeze({
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
  }),
});

export function normalizePipingClass(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^=/, '')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function displayPipingClass(value) {
  return String(value ?? '').trim().toUpperCase();
}

function mergeConfig(config = {}) {
  const supplied = config.pipingClassMatch || config || {};
  return {
    ...DEFAULT_PIPING_CLASS_MATCH_CONFIG,
    ...supplied,
    rowScoring: {
      ...DEFAULT_PIPING_CLASS_MATCH_CONFIG.rowScoring,
      ...(supplied.rowScoring || config.rowScoring || {}),
    },
  };
}

function normalizeForRatio(value) {
  return normalizePipingClass(value).toLowerCase();
}

function leadingNumeric(value) {
  const match = normalizePipingClass(value).match(/^\d+/);
  return match ? match[0] : '';
}

function commonPrefixLength(a, b) {
  const aa = normalizePipingClass(a);
  const bb = normalizePipingClass(b);
  let i = 0;
  while (i < aa.length && i < bb.length && aa[i] === bb[i]) i += 1;
  return i;
}

function sequenceRatio(a, b) {
  const s1 = normalizeForRatio(a);
  const s2 = normalizeForRatio(b);
  if (!s1 || !s2) return 0;
  const dp = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i += 1) {
    for (let j = 1; j <= s2.length; j += 1) {
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[s1.length][s2.length];
  return (2 * lcs) / (s1.length + s2.length);
}

function readClassFromRow(row, fieldMap = {}) {
  return row?.[fieldMap.pipingClass] ??
    row?.pipingClass ??
    row?.['Piping Class'] ??
    row?.PIPING_CLASS ??
    row?.Class ??
    row?.SPEC ??
    row?.Spec ??
    '';
}

function overrideForClass(overrides, requestedClass) {
  const bucket = overrides?.pipingClass || overrides?.pipingClassApprox || overrides?.approxPipingClass || {};
  const requestedNorm = normalizePipingClass(requestedClass);
  for (const [key, value] of Object.entries(bucket || {})) {
    if (normalizePipingClass(key) === requestedNorm && String(value ?? '').trim()) {
      return displayPipingClass(value);
    }
  }
  return '';
}

function uniqueClasses(classes) {
  const out = [];
  const seen = new Set();
  for (const cls of classes || []) {
    const raw = displayPipingClass(cls);
    const norm = normalizePipingClass(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(raw);
  }
  return out;
}

function knownClassesFromIndex(pipingClassIndex) {
  if (Array.isArray(pipingClassIndex?.knownClasses)) return uniqueClasses(pipingClassIndex.knownClasses);
  if (pipingClassIndex?.byClass instanceof Map) return uniqueClasses([...pipingClassIndex.byClass.keys()]);
  if (pipingClassIndex instanceof Map) return uniqueClasses([...pipingClassIndex.keys()]);
  return [];
}

function rowsForClass(pipingClassIndex, cls) {
  const norm = normalizePipingClass(cls);
  if (!norm) return [];
  if (pipingClassIndex?.byClass instanceof Map) return pipingClassIndex.byClass.get(norm) || [];
  if (pipingClassIndex instanceof Map) return pipingClassIndex.get(norm) || [];
  return [];
}

export function scorePipingClassCandidate(requestedClass, candidateClass, config = {}) {
  const cfg = mergeConfig(config);
  const requested = normalizePipingClass(requestedClass);
  const candidate = normalizePipingClass(candidateClass);

  if (!requested || !candidate) {
    return {
      candidate: displayPipingClass(candidateClass),
      score: -Infinity,
      confidence: 0,
      method: 'invalid',
      reasons: ['invalid-empty-class'],
    };
  }

  if (requested === candidate) {
    return {
      candidate: displayPipingClass(candidateClass),
      score: cfg.classExactScore,
      confidence: 1.0,
      method: 'exact',
      reasons: ['class-exact'],
    };
  }

  const reqLead = leadingNumeric(requested);
  const candLead = leadingNumeric(candidate);

  if (reqLead && candLead && reqLead === candLead) {
    const candidateIsBase = requested.startsWith(candidate);
    const requestedIsBase = candidate.startsWith(requested);
    const score = candidateIsBase || requestedIsBase
      ? cfg.leadingNumericExactScore
      : cfg.leadingNumericExactScore - 30;
    return {
      candidate: displayPipingClass(candidateClass),
      score,
      confidence: Math.min(0.97, score / cfg.classExactScore),
      method: candidateIsBase ? 'leading-numeric-base' : 'leading-numeric-exact',
      reasons: [`leading-numeric-exact:${reqLead}`],
    };
  }

  if (requested.startsWith(candidate) || candidate.startsWith(requested)) {
    const score = requested.startsWith(candidate) ? cfg.prefixBaseScore : cfg.startsWithScore;
    return {
      candidate: displayPipingClass(candidateClass),
      score,
      confidence: Math.min(0.94, score / cfg.classExactScore),
      method: requested.startsWith(candidate) ? 'prefix-base' : 'starts-with',
      reasons: ['prefix-compatible'],
    };
  }

  if (reqLead && candLead) {
    const reqNum = Number(reqLead);
    const candNum = Number(candLead);
    const distance = Math.abs(reqNum - candNum);
    if (Number.isFinite(distance) && distance > 0 && distance <= cfg.numericDistanceMax) {
      const prefixLen = commonPrefixLength(reqLead, candLead);
      const prefixBonus = Math.min(60, prefixLen * 10);
      const score = cfg.numericDistanceBaseScore - (distance * cfg.numericDistancePenalty) + prefixBonus;
      return {
        candidate: displayPipingClass(candidateClass),
        score,
        confidence: Math.max(0, Math.min(0.86, score / cfg.classExactScore)),
        method: 'numeric-near',
        reasons: [`numeric-distance:${distance}`, `common-prefix:${prefixLen}`],
      };
    }
  }

  const ratio = sequenceRatio(requested, candidate);
  const fuzzyScore = Math.round(ratio * cfg.fuzzyRatioWeight);
  return {
    candidate: displayPipingClass(candidateClass),
    score: fuzzyScore,
    confidence: Math.max(0, Math.min(ratio >= cfg.fuzzyMinRatio ? 0.8 : 0.6, ratio)),
    method: ratio >= cfg.fuzzyMinRatio ? 'fuzzy-ratio' : 'below-threshold',
    reasons: [`ratio:${ratio.toFixed(3)}`],
  };
}

export function resolveApproximatePipingClass({ requestedClass, knownClasses, pipingClassIndex, overrides = {}, config = {} }) {
  const cfg = mergeConfig(config);
  const rawRequested = displayPipingClass(requestedClass);
  const requestedNorm = normalizePipingClass(rawRequested);
  const classes = uniqueClasses(knownClasses || knownClassesFromIndex(pipingClassIndex));

  if (!requestedNorm) {
    return {
      requestedClass: rawRequested,
      pipingClass: '',
      normalizedRequestedClass: '',
      method: 'none',
      confidence: 0,
      score: 0,
      needsReview: true,
      reasons: ['missing-requested-class'],
      candidates: [],
    };
  }

  const scored = classes
    .map((cls) => scorePipingClassCandidate(rawRequested, cls, config))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  const second = scored[1] || null;

  const override = overrideForClass(overrides, rawRequested);
  if (override) {
    const overrideNorm = normalizePipingClass(override);
    const bestNorm = normalizePipingClass(best?.candidate);
    if (best && overrideNorm && overrideNorm === bestNorm) {
      const ambiguous = second && Math.abs(best.score - second.score) <= cfg.ambiguousScoreDelta;
      return {
        requestedClass: rawRequested,
        pipingClass: best.candidate,
        normalizedRequestedClass: requestedNorm,
        method: ambiguous ? 'ambiguous-approximate' : best.method,
        confidence: best.confidence,
        score: best.score,
        needsReview: ambiguous || best.confidence < cfg.reviewBelowConfidence || best.method !== 'exact',
        reasons: [...(best.reasons || []), 'redundant-override-same-as-auto'],
        candidates: scored.slice(0, cfg.maxCandidates),
      };
    }
    return {
      requestedClass: rawRequested,
      pipingClass: override,
      normalizedRequestedClass: requestedNorm,
      method: 'override',
      confidence: 1.0,
      score: cfg.overrideScore,
      needsReview: false,
      reasons: ['manual-override'],
      candidates: scored.slice(0, cfg.maxCandidates),
    };
  }

  if (!best || best.score < cfg.minAcceptScore) {
    return {
      requestedClass: rawRequested,
      pipingClass: '',
      normalizedRequestedClass: requestedNorm,
      method: 'none',
      confidence: best?.confidence ?? 0,
      score: best?.score ?? 0,
      needsReview: true,
      reasons: ['below-min-accept-score', ...(best?.reasons || [])],
      candidates: scored.slice(0, cfg.maxCandidates),
    };
  }

  const ambiguous = second && Math.abs(best.score - second.score) <= cfg.ambiguousScoreDelta;
  return {
    requestedClass: rawRequested,
    pipingClass: best.candidate,
    normalizedRequestedClass: requestedNorm,
    method: ambiguous ? 'ambiguous-approximate' : best.method,
    confidence: best.confidence,
    score: best.score,
    needsReview: ambiguous || best.confidence < cfg.reviewBelowConfidence || best.method !== 'exact',
    reasons: best.reasons,
    candidates: scored.slice(0, cfg.maxCandidates),
  };
}

export function buildPipingClassIndex(rows, fieldMap = {}) {
  const map = new Map();
  const knownClasses = [];
  const safeRows = Array.isArray(rows) ? rows : [];
  for (const row of safeRows) {
    const rawClass = readClassFromRow(row, fieldMap);
    const cls = normalizePipingClass(rawClass);
    if (!cls) continue;
    if (!map.has(cls)) map.set(cls, []);
    map.get(cls).push(row);
    if (!knownClasses.some((existing) => normalizePipingClass(existing) === cls)) {
      knownClasses.push(displayPipingClass(rawClass));
    }
  }
  // Backward-compatible Map shape with richer metadata.
  map.byClass = map;
  map.knownClasses = knownClasses;
  map.rows = safeRows;
  return map;
}

function normalizeComponentType(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (text === 'RIGID') return 'PIPE';
  if (text.includes('PIPE')) return 'PIPE';
  if (text.includes('ELBOW') || text === 'BEND') return 'BEND';
  if (text.includes('TEE')) return 'TEE';
  if (text.includes('VALVE') || text.startsWith('VLV')) return 'VALVE';
  if (text.includes('FLANGE') || text === 'FLG') return 'FLANGE';
  return text;
}

function normalizeRating(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/CLASS|CL|#|RATING/g, '')
    .replace(/\s+/g, '');
}

function normalizeSchedule(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function scorePipingClassRow({ row, pipingClass, boreMm, componentType, rating, schedule, config = {} }) {
  const cfg = mergeConfig(config).rowScoring;
  const rowClass = normalizePipingClass(readClassFromRow(row));
  const requestedClass = normalizePipingClass(pipingClass);
  const reasons = [];
  let score = 0;

  if (!rowClass || !requestedClass || rowClass !== requestedClass) {
    return { score: -Infinity, confidence: 0, needsReview: true, reasons: ['class-mismatch'] };
  }
  score += cfg.classExactWeight;
  reasons.push('class-exact');

  const rowBore = toFiniteNumber(
    row?.convertedBore ?? row?.['Converted Bore'] ?? row?.boreMm ?? row?.sizeMm ?? row?.Size ?? row?.size ?? row?.DN ?? row?.NB ?? row?.NPS
  );
  const requestedBore = toFiniteNumber(boreMm);
  if (requestedBore != null && rowBore != null) {
    const diff = Math.abs(rowBore - requestedBore);
    if (diff <= 0.001) {
      score += cfg.boreExactWeight;
      reasons.push('bore-exact');
    } else if (diff <= cfg.boreToleranceMm) {
      score += cfg.boreNearWeight;
      reasons.push(`bore-near:${diff.toFixed(3)}mm`);
    } else {
      score -= cfg.boreExactWeight;
      reasons.push(`bore-mismatch:${diff.toFixed(3)}mm`);
    }
  } else {
    reasons.push('bore-missing');
  }

  const rowComp = normalizeComponentType(row?.componentType ?? row?.['Component Type'] ?? row?.COMPONENT_TYPE ?? row?.type ?? row?.itemType);
  const reqComp = normalizeComponentType(componentType);
  if (rowComp && reqComp && rowComp === reqComp) {
    score += cfg.componentExactWeight;
    reasons.push('component-exact');
  } else if (rowComp === 'PIPE' && (reqComp === 'PIPE' || reqComp === 'RIGID')) {
    score += cfg.pipeRigidWeight;
    reasons.push('pipe-rigid-compatible');
  }

  const rowRating = normalizeRating(row?.rating ?? row?.Rating ?? row?.RATING ?? row?.['Pressure Class'] ?? row?.class);
  const reqRating = normalizeRating(rating);
  if (rowRating && reqRating && rowRating === reqRating) {
    score += cfg.ratingExactWeight;
    reasons.push('rating-exact');
  }

  const rowSchedule = normalizeSchedule(row?.schedule ?? row?.Schedule ?? row?.SCH);
  const reqSchedule = normalizeSchedule(schedule);
  if (rowSchedule && reqSchedule && rowSchedule === reqSchedule) {
    score += cfg.scheduleExactWeight;
    reasons.push('schedule-exact');
  }

  const maxScore = cfg.classExactWeight + cfg.boreExactWeight + cfg.componentExactWeight + cfg.ratingExactWeight + cfg.scheduleExactWeight;
  return {
    score,
    confidence: Math.max(0, Math.min(1, score / maxScore)),
    needsReview: reasons.includes('bore-missing'),
    reasons,
  };
}

export function findBestPipingClassRow({ pipingClass, boreMm, componentType, rating, schedule, pipingClassIndex, overrides = {}, config = {} }) {
  const cfg = mergeConfig(config).rowScoring;
  const classMatch = resolveApproximatePipingClass({
    requestedClass: pipingClass,
    pipingClassIndex,
    overrides,
    config,
  });
  const resolvedClass = normalizePipingClass(classMatch.pipingClass || pipingClass);
  const rows = rowsForClass(pipingClassIndex, resolvedClass);
  const scored = rows
    .map((row) => ({
      row,
      ...scorePipingClassRow({ row, pipingClass: resolvedClass, boreMm, componentType, rating, schedule, config }),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || null;
  const second = scored[1] || null;
  if (!best || best.score < cfg.minAcceptScore) {
    return {
      row: null,
      resolvedPipingClass: resolvedClass,
      classMatch,
      method: 'none',
      confidence: classMatch.confidence || 0,
      needsReview: true,
      score: best?.score ?? 0,
      reasons: ['row-below-min-accept-score', ...(best?.reasons || [])],
      candidates: scored.slice(0, mergeConfig(config).maxCandidates),
    };
  }

  const ambiguous = second && Math.abs(best.score - second.score) <= cfg.ambiguousScoreDelta;
  return {
    row: best.row,
    resolvedPipingClass: resolvedClass,
    classMatch,
    method: ambiguous ? 'ambiguous-best-score' : 'best-score',
    confidence: best.confidence,
    needsReview: classMatch.needsReview || best.needsReview || ambiguous,
    score: best.score,
    reasons: [...(classMatch.reasons || []), ...(best.reasons || [])],
    candidates: scored.slice(0, mergeConfig(config).maxCandidates),
  };
}
