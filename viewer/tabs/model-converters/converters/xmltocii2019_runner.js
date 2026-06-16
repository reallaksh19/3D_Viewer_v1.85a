import { decodeTextUtf8, encodeTextUtf8, baseNameWithoutExtension } from '../core/output-utils.js';
import { collectXmlCiiZeroRigidWeightIssues, applyXmlCiiRigidWeightOverrides } from '../../../converters/xml-cii2019-core/weight-match-model.js';
import { buildXmlCiiNodeResolverIndex } from '../../../converters/xml-cii2019-core/sideload-resolver.js';
import { resolveManualRestraintRows } from '../../../converters/xml-cii2019-core/sideload-restraints.js';
import { mergeXmlCiiMatchedFacts, matchedFactsFromEnrichmentDiagnostics } from '../../../converters/xml-cii2019-core/sideload-ledger.js';
import { applyManualMatchedFactsToEnrichedXml } from '../../../converters/xml-cii2019-core/sideload-apply.js';
import { enrichXmlForCii2019 } from './xmltocii2019_helper/enrichment-core.js';

const XML_CII_STAGE_TIMEOUT_MS = 120000;
const MATCHED_PREVIEW_STORAGE_KEY = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';
const MATCHED_PREVIEW_EVENT = 'xml-cii-matched-preview:diagnostics';

function timeoutMessage(stage, timeoutMs) {
  return `XML->CII(2019) timed out during ${stage} after ${Math.round(timeoutMs / 1000)}s. Check network access to Pyodide/CDN and converter script loading.`;
}

function withTimeout(promise, stage, timeoutMs = XML_CII_STAGE_TIMEOUT_MS) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage(stage, timeoutMs))), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function publishMatchedPreviewDiagnostics(payload) {
  if (typeof window === 'undefined' || !payload || typeof payload !== 'object') return;

  const eventPayload = {
    ...payload,
    source: payload.source || 'latest-run',
  };

  try {
    window.localStorage?.setItem(MATCHED_PREVIEW_STORAGE_KEY, JSON.stringify(eventPayload));
  } catch {
    // Storage can be blocked in private modes; event dispatch is still useful.
  }

  try {
    window.dispatchEvent(new CustomEvent(MATCHED_PREVIEW_EVENT, { detail: eventPayload }));
  } catch {
    // Keep conversion success independent of UI preview publishing.
  }
}

function parseSupportConfig(options = {}) {
  try {
    const parsed = JSON.parse(options.supportConfigJson || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function optionText(options, supportConfig, ...keys) {
  for (const key of keys) {
    const value = options?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  const sideload = supportConfig?.sideload && typeof supportConfig.sideload === 'object' ? supportConfig.sideload : {};
  for (const key of keys) {
    const value = sideload?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
}

function optionNumber(options, supportConfig, fallback, ...keys) {
  const sideload = supportConfig?.sideload && typeof supportConfig.sideload === 'object' ? supportConfig.sideload : {};
  for (const source of [options || {}, sideload]) {
    for (const key of keys) {
      const numeric = Number(source?.[key]);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return fallback;
}

function optionPolicy(options, supportConfig) {
  return options.sideloadPolicy || supportConfig?.sideload?.policy || 'ADD_IF_MISSING';
}

function sideloadDiagnosticRows(facts = [], type) {
  return facts.map((fact) => ({
    type,
    nodeNumber: fact.resolvedNodeNumber || '',
    method: fact.basis || '',
    kind: fact.value || '',
    message: fact.meta?.rawLine || fact.key || fact.status || '',
    source: fact.source || '',
    status: fact.status || '',
  }));
}

function ensureEnrichedPreviewLedger(enriched) {
  if (!enriched || typeof enriched !== 'object') return { matchedFacts: [], rejectedFacts: [] };

  if (!Array.isArray(enriched.matchedFacts) || !enriched.matchedFacts.length) {
    enriched.matchedFacts = matchedFactsFromEnrichmentDiagnostics(enriched.diagnostics || []);
  }
  if (!Array.isArray(enriched.rejectedFacts)) enriched.rejectedFacts = [];
  if (!enriched.stats || typeof enriched.stats !== 'object') enriched.stats = {};

  enriched.stats.previewMatchedFacts = enriched.matchedFacts.length;
  enriched.stats.previewRejectedFacts = enriched.rejectedFacts.length;

  return {
    matchedFacts: enriched.matchedFacts,
    rejectedFacts: enriched.rejectedFacts,
  };
}

function applyOptionalManualSideload(enriched, runValues) {
  const supportConfig = parseSupportConfig(runValues);
  const sideloadText = optionText(runValues, supportConfig, 'sideloadRestraintsText', 'xmlCiiSideloadRestraintsText', 'restraintsText');
  ensureEnrichedPreviewLedger(enriched);
  if (!sideloadText.trim()) return { applied: false, stdout: [] };

  const exactToleranceMm = optionNumber(runValues, supportConfig, 1, 'sideloadPosExactToleranceMm', 'posExactToleranceMm');
  const nearestToleranceMm = optionNumber(runValues, supportConfig, 5, 'sideloadPosToleranceMm', 'posToleranceMm');
  const policy = optionPolicy(runValues, supportConfig);
  const resolverIndex = buildXmlCiiNodeResolverIndex(enriched.xmlText, { exactToleranceMm });
  const manual = resolveManualRestraintRows(sideloadText, resolverIndex, { exactToleranceMm, nearestToleranceMm });
  const previewFacts = enriched.matchedFacts || [];
  const merged = mergeXmlCiiMatchedFacts(previewFacts, manual.matchedFacts, { policy });
  const applied = applyManualMatchedFactsToEnrichedXml(enriched.xmlText, merged.matchedFacts, enriched.config, { policy });

  enriched.xmlText = applied.xmlText;
  enriched.matchedFacts = merged.matchedFacts;
  enriched.rejectedFacts = [
    ...(enriched.rejectedFacts || []),
    ...manual.rejectedFacts,
    ...merged.rejectedFacts,
    ...applied.rejectedFacts,
  ];
  enriched.stats.manualSideloadRows = manual.rows.length;
  enriched.stats.manualSideloadMatched = manual.matchedFacts.length;
  enriched.stats.manualSideloadRejected = manual.rejectedFacts.length + merged.rejectedFacts.length + applied.rejectedFacts.length;
  enriched.stats.manualSideloadApplied = applied.stats.appliedManualRestraints;
  enriched.stats.normalizedRestraints = (enriched.stats.normalizedRestraints || 0) + applied.stats.appliedManualRestraints;
  enriched.stats.previewMatchedFacts = enriched.matchedFacts.length;
  enriched.stats.previewRejectedFacts = enriched.rejectedFacts.length;

  enriched.diagnostics.push({
    type: 'sideload-restraint-summary',
    rows: manual.rows.length,
    matched: manual.matchedFacts.length,
    applied: applied.stats.appliedManualRestraints,
    rejected: enriched.stats.manualSideloadRejected,
    policy,
    exactToleranceMm,
    nearestToleranceMm,
  });
  enriched.diagnostics.push(...sideloadDiagnosticRows(manual.rejectedFacts, 'sideload-restraint-rejected'));
  enriched.diagnostics.push(...sideloadDiagnosticRows(merged.rejectedFacts, 'sideload-restraint-skipped'));
  enriched.diagnostics.push(...sideloadDiagnosticRows(applied.appliedFacts, 'sideload-restraint-applied'));
  enriched.diagnostics.push(...sideloadDiagnosticRows(applied.rejectedFacts, 'sideload-restraint-apply-skipped'));

  return {
    applied: true,
    stdout: [
      `Manual side-load restraints parsed: ${manual.rows.length}.`,
      `Manual side-load restraints matched: ${manual.matchedFacts.length}.`,
      `Manual side-load restraints applied: ${applied.stats.appliedManualRestraints}.`,
      `Manual side-load restraints rejected/skipped: ${enriched.stats.manualSideloadRejected}.`,
    ],
  };
}

export async function run(context) {
  const primary = context.inputFiles.find(f => f.role === 'primary');
  if (!primary || !primary.bytes) throw new Error('Primary XML input is required for XML->CII(2019).');
  const secondary = context.inputFiles.find(f => f.role === 'secondary');
  const secondaryBytes = secondary ? secondary.bytes : null;
  const originalXmlText = decodeTextUtf8(primary.bytes);
  const stagedJsonText = secondaryBytes ? decodeTextUtf8(secondaryBytes) : '';
  const runValues = context.options || {};
  const stem = baseNameWithoutExtension(primary.name);

  if (runValues.createEnrichedXml === false) {
    if (!context.workerRunner) throw new Error('Python worker runtime is not available.');
    context.setStatus?.('Starting Python worker...', 'running');
    const serializableOptions = Object.fromEntries(Object.entries(runValues).filter(([, v]) => typeof v !== 'function'));
    return await withTimeout(
      context.workerRunner.runJob({ converterId: context.converterId, inputFiles: context.inputFiles, options: serializableOptions }),
      'Python worker conversion',
    );
  }

  context.setStatus?.('Enriching XML before CII conversion...', 'running');
  const enriched = await withTimeout(
    enrichXmlForCii2019(originalXmlText, stagedJsonText, runValues),
    'browser-side XML enrichment',
  );
  const rigidReviewLogLines = [];
  const rigidWeightIssues = collectXmlCiiZeroRigidWeightIssues(enriched.xmlText, stagedJsonText, enriched.config);

  if (rigidWeightIssues.length > 0 && typeof runValues.openXmlCiiZeroRigidWeightPopup === 'function') {
    context.setStatus(`Review needed: ${rigidWeightIssues.length} rigid weight(s) are zero.`, 'running');
    let review = null;
    try {
      review = await withTimeout(runValues.openXmlCiiZeroRigidWeightPopup(rigidWeightIssues), 'rigid zero-weight review', 300000);
    } catch (error) {
      review = { cancelled: true, error };
    }

    if (review?.cancelled) {
      rigidReviewLogLines.push(`Rigid zero-weight review dismissed: ${rigidWeightIssues.length} unresolved rigid(s) left unchanged.`);
      enriched.diagnostics.push({
        type: 'rigid-zero-weight-review-dismissed',
        count: rigidWeightIssues.length,
        message: 'Review popup was dismissed; CII generation continued with zero weights unchanged.',
      });
    } else if (review?.skipped) {
      rigidReviewLogLines.push(`Rigid zero-weight review skipped: ${rigidWeightIssues.length} unresolved rigid(s) left unchanged.`);
      enriched.diagnostics.push({
        type: 'rigid-zero-weight-review-skipped',
        count: rigidWeightIssues.length,
        message: 'User skipped rigid zero-weight review; CII generation continued with zero weights unchanged.',
      });
    } else {
      const applied = applyXmlCiiRigidWeightOverrides(enriched.xmlText, review?.weightsByKey || {});
      enriched.xmlText = applied.xmlText;
      enriched.stats.rigidWeightManualOverrides = applied.appliedCount;
      enriched.stats.weightAnnotations = (enriched.stats.weightAnnotations || 0) + applied.appliedCount;
      enriched.diagnostics.push(...applied.appliedRows);
      if (typeof runValues.saveXmlCiiRigidWeightOverrides === 'function') runValues.saveXmlCiiRigidWeightOverrides(review?.weightsByKey || {});
      rigidReviewLogLines.push(`Rigid zero-weight review applied: ${applied.appliedCount} manual rigid weight(s).`);
    }
  }

  ensureEnrichedPreviewLedger(enriched);
  const sideloadLogLines = applyOptionalManualSideload(enriched, runValues).stdout;

  const enrichedName = `${stem}_enriched.xml`;
  if (!context.workerRunner) throw new Error('Python worker runtime is not available.');
  const serializableOptions = Object.fromEntries(Object.entries({ ...runValues, createEnrichedXml: false }).filter(([, v]) => typeof v !== 'function'));
  context.setStatus?.('Running CII conversion in Python worker...', 'running');
  const ciiResponse = await withTimeout(
    context.workerRunner.runJob({
      converterId: context.converterId,
      inputFiles: [{ role: 'primary', name: enrichedName, bytes: encodeTextUtf8(enriched.xmlText) }],
      options: serializableOptions
    }),
    'Python worker conversion',
  );

  const ciiOutputs = Array.isArray(ciiResponse.outputs) ? ciiResponse.outputs : [];
  const stats = enriched.stats;
  const diagnostics = enriched.diagnostics;
  const diagnosticPayload = {
    generatedAt: new Date().toISOString(),
    source: 'latest-run',
    inputName: primary.name,
    enrichedName,
    diagnosticsName: `${stem}_enrichment_diagnostics.json`,
    stats,
    diagnostics,
    matchedFacts: enriched.matchedFacts || [],
    rejectedFacts: enriched.rejectedFacts || [],
  };
  const diagnosticText = JSON.stringify(diagnosticPayload, null, 2);
  publishMatchedPreviewDiagnostics(diagnosticPayload);
  const diagnosticRows = (Array.isArray(diagnostics) ? diagnostics : []).map((item) => ({
    type: item?.type || '',
    nodeNumber: item?.nodeNumber || item?.keptNode || item?.removedNode || '',
    branchName: item?.branchName || '',
    pipingClass: item?.pipingClass || item?.resolvedPipingClass || '',
    rating: item?.rating || '',
    boreMm: item?.boreMm == null ? '' : Number(item.boreMm).toFixed ? Number(item.boreMm).toFixed(3) : item.boreMm,
    lengthMm: item?.lengthMm == null ? '' : Number(item.lengthMm).toFixed ? Number(item.lengthMm).toFixed(3) : item.lengthMm,
    weight: item?.weight ?? '',
    method: item?.method || item?.reason || item?.source || item?.status || '',
    kind: item?.kind || '',
    message: item?.message || item?.stagedName || item?.url || item?.reason || '',
  }));

  return {
    outputs: [
      { name: enrichedName, text: enriched.xmlText, mime: 'text/xml;charset=utf-8' },
      { name: `${stem}_enrichment_diagnostics.json`, text: diagnosticText, mime: 'application/json;charset=utf-8' },
      ...ciiOutputs,
    ],
    logs: {
      stdout: [
        'Created enriched XML before XML->CII(2019).',
        `DATUM duplicate support nodes removed: ${stats.removedDuplicateSupports}.`,
        `XML restraints normalized: ${stats.normalizedRestraints}.`,
        `Staged JSON support matches applied: ${stats.stagedSupportsMapped}.`,
        `DTXR_PS annotations: ${stats.dtxrPsAnnotations || 0}.`,
        `DTXR_POS annotations: ${stats.dtxrPosAnnotations || 0}.`,
        `Branch line keys annotated from Branchname: ${stats.branchLineKeys}.`,
        `Rating annotations: ${stats.ratingAnnotations}; weight annotations: ${stats.weightAnnotations}.`,
        `Matched enrichment preview facts: ${stats.previewMatchedFacts || 0}.`,
        `Rejected enrichment preview facts: ${stats.previewRejectedFacts || 0}.`,
        ...rigidReviewLogLines,
        ...sideloadLogLines,
        `Enrichment diagnostics written: ${stem}_enrichment_diagnostics.json`,
        ...(ciiResponse.logs?.stdout || []),
      ],
      stderr: [...(ciiResponse.logs?.stderr || [])]
    },
    diagnosticsRows: diagnosticRows
  };
}
