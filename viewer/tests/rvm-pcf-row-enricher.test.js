import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { enrichRowsForFinalPcf } from '../rvm-pcf-extract/RvmPcfRowEnricher.js';
import {
  pcfSupportPositionKey,
  resolveSupportMatchForPcfRow,
} from '../converters/xml-cii2019-core/support-pcf-row-matcher.js';
import { buildStagedSupportIndex } from '../converters/xml-cii2019-core/support-mapping.js';

/**
 * JSON/RVM→PCF row enrichment unit tests.
 * These validate shared XML→CII service reuse and row-level enrichment only.
 * They do not validate topology acceptance or final PCF emission.
 */

const enricherSource = await fs.readFile(new URL('../rvm-pcf-extract/RvmPcfRowEnricher.js', import.meta.url), 'utf8');

assert(enricherSource.includes('xml-cii2019-core/master-context.js'), 'B1: row enricher imports shared master-context');
assert(enricherSource.includes('branch-process-resolver.js'), 'B1: row enricher imports branch process resolver');
assert(enricherSource.includes('dtxr-resolver.js'), 'B1: row enricher imports central DTXR resolver');
assert(enricherSource.includes('weight-valve-hints.js'), 'B1: row enricher imports shared weight ranking');
assert(enricherSource.includes('support-pcf-row-matcher.js'), 'B1: row enricher imports core support row matcher');
assert(!enricherSource.includes('RvmPcfEmitter'), 'B1: row enricher must not import the PCF emitter');
assert(!/Uxml|UXML|uxml/.test(enricherSource), 'B1: row enricher must not import/reference UXML');
assert(!/runTopology|TopologyGate/.test(enricherSource), 'B1: row enricher must not run topology');
assert(enricherSource.includes('componentType:'), 'B2: weight ranking receives componentType context');
assert(enricherSource.includes('componentRefNo:'), 'B2: weight ranking receives componentRefNo context');
assert(enricherSource.includes('dtxr:'), 'B2: weight ranking receives dtxr/typeDesc context');
assert(enricherSource.includes("type: 'pcf-row-weight-unselected'"), 'B3: weight-unselected diagnostic is implemented');
assert(enricherSource.includes("type: 'pcf-row-support-unmatched'"), 'B3: support-unmatched diagnostic is implemented');
assert(enricherSource.includes("type: 'pcf-row-dtxr-missing'"), 'B3: DTXR-missing diagnostic is implemented');

function hasDiagnostic(result, type) {
  return (result.diagnostics || []).some((item) => item.type === type);
}

const config = {
  linelist: { masterRows: [{ lineNoKey: '91261M7', pipingClass: 'A1A', rating: '150', material: 'A106 GR.B' }] },
  material: { mapRows: [{ code: '101', material: 'A106 GR.B' }] },
  pipingClass: { masterRows: [{ pipingClass: 'A1A', convertedBore: 100, componentType: 'VALVE', rating: '150', material: 'A106 GR.B', wallThickness: 8.56, corrosion: 1.5 }] },
  weight: { masterRows: [{ boreMm: 100, lengthMm: 200, weight: 50, rating: '150', type: 'VALVE', typeDesc: 'GATE VALVE' }] },
};

const baseValveRow = {
  rowNo: 1,
  seqNo: 'SEQ-1',
  refNo: 'REF-1',
  sourceCanonicalId: 'UCI:VALVE-1',
  type: 'VALVE',
  nodeName: '88-VGT-20359',
  pipelineRef: '/ASIM-1885-10-S8810101-91261M7-HC/B1',
  lineNoKey: '91261M7',
  convertedBore: 100,
  rating: '150',
  ep1: { x: 0, y: 0, z: 1 },
  ep2: { x: 200, y: 0, z: 1 },
};

const previousFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('fetch must not be called when inline masters are supplied'); };

try {
  const valveResult = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, ca: { '1': 'EXISTING-CLASS' } }],
    config,
    mode: 'preview',
    commit: false,
  });

  const valve = valveResult.rows[0];
  assert.equal(valve.previewOnly, true, 'preview enrichment is marked preview-only');
  assert.equal(valve.resolvedPipingClass, 'A1A', 'resolved piping class is populated');
  assert.equal(valve.rating, '150', 'rating is populated');
  assert.equal(valve.materialCode, '101', 'material code is populated through material map');
  assert.equal(valve.wallThicknessMm, 8.56, 'wall thickness is populated from piping class master');
  assert.equal(valve.corrosionAllowanceMm, 1.5, 'corrosion allowance is populated from piping class master');
  assert.equal(valve.weight, 50, 'selected weight is populated from ranked weight candidate');
  assert.equal(valve.ca['1'], 'EXISTING-CLASS', 'CA1 is preserved by default');
  assert.equal(valve.ca['2'], '150', 'CA2 rating is populated');
  assert.equal(valve.ca['3'], '101', 'CA3 material code is populated');
  assert.equal(valve.ca['4'], '8.56', 'CA4 wall thickness is populated');
  assert.equal(valve.ca['5'], '1.5', 'CA5 corrosion allowance is populated');
  assert.equal(valve.ca['6'], '50', 'CA6 selected weight is populated');
  assert.equal(valve.ca['7'], 'master', 'CA7 weight method is populated');
  assert.equal(valve.ca['8'], 'GATE VALVE', 'CA8 weight TypeDesc is populated');
  assert.equal(valve.ca['97'], 'REF-1', 'CA97 refNo is populated');
  assert.equal(valve.ca['98'], 'SEQ-1', 'CA98 seqNo is populated');

  const overwriteResult = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, rowNo: 2, seqNo: 'SEQ-2', refNo: 'REF-2', ca: { '1': 'OLD' } }],
    config: { ...config, pcf: { overwriteCaFromEnrichment: true } },
  });
  assert.equal(overwriteResult.rows[0].ca['1'], 'A1A', 'CA overwrite is opt-in only');

  const rankingContextConfig = {
    ...config,
    weight: {
      masterRows: [
        { boreMm: 100, lengthMm: 200, weight: 30, rating: '150', type: 'VALVE', typeDesc: 'BALL VALVE' },
        { boreMm: 100, lengthMm: 200, weight: 50, rating: '150', type: 'VALVE', typeDesc: 'GATE VALVE' },
      ],
    },
  };
  const typeDescRankResult = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, nodeName: '88-XXX-20359', typeDesc: 'VGT GATE VALVE' }],
    config: rankingContextConfig,
    mode: 'preview',
    commit: false,
  });
  assert.equal(typeDescRankResult.rows[0].weight, 50, 'DTXR/typeDesc context can drive semantic valve ranking');

  const rejectedConfig = {
    ...config,
    weight: { masterRows: [{ boreMm: 100, lengthMm: 200, weight: 50, rating: '150', type: 'VALVE', typeDesc: 'GATE VALVE' }] },
  };
  const previewRejected = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, ep2: { x: 260, y: 0, z: 1 } }],
    config: rejectedConfig,
    mode: 'preview',
    commit: false,
  });
  assert(previewRejected.rows[0].weightRejectedCandidates.length > 0, 'preview includes length-rejected semantic candidates');

  const runRejected = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, ep2: { x: 260, y: 0, z: 1 } }],
    config: rejectedConfig,
    mode: 'run',
  });
  assert.equal(runRejected.rows[0].weightRejectedCandidates.length, 0, 'run mode hides rejected candidates unless explicitly configured');

  const zeroWeightResult = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, refNo: 'REF-ZERO-WEIGHT' }],
    config: { ...config, weight: { masterRows: [{ boreMm: 100, lengthMm: 200, weight: 0, rating: '150', type: 'VALVE', typeDesc: 'GATE VALVE' }] } },
    mode: 'preview',
    commit: false,
  });
  assert(hasDiagnostic(zeroWeightResult, 'pcf-row-weight-unselected'), 'weight candidates without accepted best emit diagnostic');

  const dtxrMissingResult = await enrichRowsForFinalPcf({
    rows: [{ ...baseValveRow, refNo: 'REF-MISSING-DTXR', dtxr: '', typeDesc: '' }],
    config,
  });
  assert(hasDiagnostic(dtxrMissingResult, 'pcf-row-dtxr-missing'), 'missing DTXR on important component emits diagnostic');

  const supportJson = JSON.stringify([{ type: 'SUPPORT', name: 'PS-12060/DATUM', attributes: { SUPPORT_KIND: 'GUIDE', SUPPORTCOORD: 'E 593473.15 S 1120710 U 100' } }]);
  const supportDiagnostics = [];
  const supportIndex = buildStagedSupportIndex(supportJson, config, supportDiagnostics);
  assert.equal(pcfSupportPositionKey('E 593473.15 S 1120710 U 100', 1), '593473|-1120710|100', 'support coordinate key is stable');
  const directMatch = resolveSupportMatchForPcfRow({ type: 'SUPPORT', nodeName: 'PS-12060/DATUM', supportCoor: 'E 593473.15 S 1120710 U 100' }, supportIndex, config);
  assert.equal(directMatch.primaryKind, 'GUIDE', 'support matcher resolves staged GUIDE support');

  const supportResult = await enrichRowsForFinalPcf({
    rows: [{ rowNo: 3, seqNo: 'SUP-3', refNo: 'SUP-REF-3', type: 'SUPPORT', nodeName: 'PS-12060/DATUM', supportCoor: { x: 593473.15, y: -1120710, z: 100 } }],
    config,
    stagedJsonText: supportJson,
  });
  const support = supportResult.rows[0];
  assert.equal(support.type, 'SUPPORT', 'support row remains SUPPORT');
  assert.equal(support.supportKind, 'GUIDE', 'support kind is applied');
  assert.equal(support.ca['9'], 'GUIDE', 'CA9 support kind is populated');
  assert.equal(support.ca['97'], 'SUP-REF-3', 'support CA97 is populated');
  assert.equal(support.ca['98'], 'SUP-3', 'support CA98 is populated');

  const supportUnmatchedResult = await enrichRowsForFinalPcf({
    rows: [{ rowNo: 4, seqNo: 'SUP-4', refNo: 'SUP-REF-4', type: 'SUPPORT', nodeName: 'PS-99999/DATUM', supportCoor: { x: 1, y: 2, z: 3 } }],
    config,
    stagedJsonText: supportJson,
  });
  assert(hasDiagnostic(supportUnmatchedResult, 'pcf-row-support-unmatched'), 'unmatched support row emits diagnostic');
} finally {
  globalThis.fetch = previousFetch;
}

console.log('rvm-pcf-row-enricher.test.js passed');
