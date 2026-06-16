import assert from 'node:assert/strict';
import fs from 'node:fs';

const hintsSource = fs.readFileSync(new URL('../converters/xml-cii2019-core/weight-valve-hints.js', import.meta.url), 'utf8');
const modelSource = fs.readFileSync(new URL('../converters/xml-cii2019-core/weight-match-model.js', import.meta.url), 'utf8');
const previewSource = fs.readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js', import.meta.url), 'utf8');
const weightRendererSource = fs.readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');

for (const token of [
  'rankXmlCiiWeightCandidates',
  'resolveCandidateWeight',
  'length-extrapolated',
  'rejectedCandidates',
  'showLengthRejectedSemanticMatches',
  'useWeightExtrapolation',
  'classifyWeightMasterCandidate',
]) {
  assert.ok(hintsSource.includes(token), `weight-valve-hints.js should contain ${token}`);
}

assert.ok(
  /CHECK\|SWING\|NRV/.test(hintsSource) && hintsSource.indexOf('CHECK|SWING|NRV') < hintsSource.indexOf('FLANGE|FLANGED'),
  'Valve subtype classification must run before flange classification.'
);

assert.ok(
  modelSource.includes("import { rankXmlCiiWeightCandidates }") &&
  modelSource.includes('rejectedCandidates: ranking.rejectedCandidates') &&
  modelSource.includes('componentRefNo: xmlText(node, \'ComponentRefNo\')'),
  'Weight model must use shared ranking and expose rejected candidates/context.'
);

assert.ok(
  previewSource.includes('rankXmlCiiWeightCandidates') &&
  previewSource.includes('rejectedWeightCandidates'),
  'Preview must consume shared ranking output and carry rejected candidates.'
);

assert.ok(
  weightRendererSource.includes('skipAutoWeightMatch: true') &&
  weightRendererSource.includes('Use weight extrapolation') &&
  weightRendererSource.includes('Rejected by length') &&
  weightRendererSource.includes('selectedWeight'),
  'Weight Match renderer must avoid dry-run auto-weight pollution and show extrapolated/rejected candidates.'
);
