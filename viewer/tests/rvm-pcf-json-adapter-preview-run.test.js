/**
 * JSON/RVM→PCF adapter Preview/Run wiring test.
 * Adapter-level sequencing only; not a full topology or PCF dialect certification.
 */

import fs from 'node:fs/promises';

const { jsonRvmPcfWorkflowAdapter } = await import('../tabs/model-converters/workflow/adapters/json-rvm-pcf-workflow-adapter.js');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

const adapterSource = await fs.readFile(new URL('../tabs/model-converters/workflow/adapters/json-rvm-pcf-workflow-adapter.js', import.meta.url), 'utf8');
const enricherSource = await fs.readFile(new URL('../rvm-pcf-extract/RvmPcfRowEnricher.js', import.meta.url), 'utf8');

assert(adapterSource.includes('prepareXmlCiiMasterContext'), 'adapter imports shared master context');
assert(adapterSource.includes('enrichRowsForFinalPcf'), 'adapter imports row enricher');
assert(adapterSource.includes('runUxmlTopologyForRvmRows'), 'adapter imports real topology bridge');
assert(adapterSource.includes('RvmPcfEmitter'), 'adapter imports PCF emitter');
assert(!adapterSource.includes('_notYetImplemented'), 'adapter no longer uses deferred placeholder helper');
assert(enricherSource.includes('masterContext = null'), 'row enricher accepts prepared masterContext');
assert(enricherSource.includes('masterContext || await prepareXmlCiiMasterContext'), 'row enricher reuses prepared masterContext before loading');

const sampleRows = [{ rowNo: 1, type: 'VALVE', nodeName: '88-VGT-20359', pipelineRef: '88-TEST', convertedBore: 100, rating: '150', lengthMm: 326.7, ep1: { x: 0, y: 0, z: 0 }, ep2: { x: 326.7, y: 0, z: 0 }, ca: {} }];
const inlineConfig = { linelist: { masterRows: [] }, material: { mapRows: [] }, pipingClass: { masterRows: [] }, weight: { masterRows: [] }, pcf: { allowPartialPcf: true } };
const repeatedDiagnostic = { type: 'topology-pass', severity: 'INFO', message: 'same' };

let order = [];
let enrichmentArgs = [];
const services = {
  async enrichRowsForFinalPcf(args) {
    order.push(`enrich:${args.mode}:${args.commit === false ? 'dry' : 'commit'}`);
    enrichmentArgs.push(args);
    return { rows: (args.rows || []).map((row) => ({ ...row, previewOnly: args.mode === 'preview' || args.commit === false })), diagnostics: [{ type: `enriched-${args.mode}`, severity: 'INFO' }], context: args.masterContext || { config: args.config || inlineConfig } };
  },
  async runTopologyForRows(rows) {
    order.push('topology');
    return { ok: true, legacyRows: rows.map((row) => ({ ...row, topologyApplied: true })), acceptedTopologyHandoff: { rows: [] }, readinessGate: { pass: true, diagnostics: [repeatedDiagnostic] }, diagnostics: [repeatedDiagnostic], topologyDecision: { exportAllowed: true } };
  },
  emitPcf(rows) {
    order.push('emit');
    return { pcfTextByPipelineRef: { '88-TEST': 'ISOGEN-FILES ISOGEN.FLS\r\n' }, errors: null, warnings: [{ type: 'emit-warning', severity: 'WARN', rowCount: rows.length }] };
  },
};

const preview = await jsonRvmPcfWorkflowAdapter.buildPreviewModel({ source: { rows: sampleRows, stagedJsonText: '{}' }, config: inlineConfig, services });
assert(preview.ok === true, 'preview succeeds');
assert(preview.previewOnly === true && preview.commit === false, 'preview is dry-run and non-committing');
assert(preview.rows.length === 1 && preview.rows[0].previewOnly === true, 'preview returns dry-run enriched rows');
assert(order.join('>') === 'enrich:preview:dry', 'preview runs enrichment only');
assert(Boolean(enrichmentArgs[0]?.masterContext), 'preview passes prepared masterContext into enrichment');

order = [];
enrichmentArgs = [];
const finalResult = await jsonRvmPcfWorkflowAdapter.runFinal({ source: { rows: sampleRows, stagedJsonText: '{}' }, config: inlineConfig, services });
const topologyPassCount = finalResult.diagnostics.filter((d) => d.type === 'topology-pass').length;
assert(finalResult.ok === true, 'final run succeeds when accepted');
assert(order.join('>') === 'topology>enrich:run:commit>emit', 'final run order is topology then enrichment then emitter');
assert(finalResult.enrichedRows[0].topologyApplied === true, 'final enrichment receives topology-applied rows');
assert(Boolean(enrichmentArgs[0]?.masterContext), 'final passes prepared masterContext into enrichment');
assert(!enrichmentArgs[0].diagnostics.some((d) => d.type === 'topology-pass'), 'final does not seed enrichment diagnostics with topology diagnostics');
assert(topologyPassCount === 1, 'topology diagnostics are deduplicated');
assert(finalResult.diagnostics.some((d) => d.type === 'enriched-run'), 'final includes enrichment diagnostics');
assert(finalResult.diagnostics.some((d) => d.type === 'emit-warning'), 'final includes emitter warnings');
assert(Array.isArray(finalResult.errors) && finalResult.errors.length === 0, 'emitter null errors normalize to empty array');

order = [];
const rejected = await jsonRvmPcfWorkflowAdapter.runFinal({ source: { rows: sampleRows, stagedJsonText: '{}' }, config: inlineConfig, services: { ...services, async runTopologyForRows() { order.push('topology'); return { ok: false, readinessGate: { pass: false, diagnostics: [{ type: 'topology-stop', severity: 'ERROR' }] }, diagnostics: [{ type: 'topology-stop', severity: 'ERROR' }] }; }, async enrichRowsForFinalPcf() { order.push('bad-enrich'); return { rows: [], diagnostics: [] }; }, emitPcf() { order.push('bad-emit'); return { pcfTextByPipelineRef: {}, errors: [], warnings: [] }; } } });
assert(rejected.ok === false, 'final rejects when topology rejects');
assert(order.join('>') === 'topology', 'rejected topology prevents enrichment and emitter');
assert(Object.keys(rejected.pcfTextByPipelineRef || {}).length === 0, 'rejected topology emits no PCF');
assert(rejected.errors.some((d) => d.type === 'topology-stop'), 'rejected topology exposes diagnostics as errors');

order = [];
const decisionRejected = await jsonRvmPcfWorkflowAdapter.runFinal({ source: { rows: sampleRows, stagedJsonText: '{}' }, config: inlineConfig, services: { ...services, async runTopologyForRows() { order.push('topology'); return { ok: true, readinessGate: { pass: true, diagnostics: [] }, topologyDecision: { exportAllowed: false }, diagnostics: [{ type: 'decision-stop', severity: 'ERROR' }] }; }, async enrichRowsForFinalPcf() { order.push('bad-enrich'); return { rows: [], diagnostics: [] }; }, emitPcf() { order.push('bad-emit'); return { pcfTextByPipelineRef: {}, errors: [], warnings: [] }; } } });
assert(decisionRejected.ok === false, 'topologyDecision.exportAllowed=false overrides loose ok/readiness pass');
assert(order.join('>') === 'topology', 'topology decision rejection prevents enrichment and emitter');
assert(decisionRejected.errors.some((d) => d.type === 'decision-stop'), 'topology decision diagnostics are exposed as errors');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
