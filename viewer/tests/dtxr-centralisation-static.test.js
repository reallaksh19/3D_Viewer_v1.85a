import assert from 'node:assert/strict';
import fs from 'node:fs';

const dtxrResolverSource = fs.readFileSync(new URL('../converters/xml-cii2019-core/dtxr-resolver.js', import.meta.url), 'utf8');
const weightMatchSource = fs.readFileSync(new URL('../converters/xml-cii2019-core/weight-match-model.js', import.meta.url), 'utf8');

for (const token of [
  'buildDtxrContext',
  'resolveDtxrForXmlNode',
  'trustExistingXmlDtxr',
  'DTXR_PURPOSE_RULES',
  "'weight-review'",
  "'tee-description'",
  "'support-restraint'",
  'allowedStagedTypes',
  'suppressionReason',
  'applyDtxrAnnotations',
]) {
  assert.ok(dtxrResolverSource.includes(token), `dtxr-resolver.js should contain ${token}`);
}

assert.ok(
  /purpose:\s*'weight-review'/.test(weightMatchSource),
  'Weight Match must resolve DTXR using weight-review purpose.'
);
assert.ok(
  /trustExistingXmlDtxr:\s*false/.test(weightMatchSource),
  'Weight Match must not trust sticky existing XML DTXR.'
);
assert.ok(
  weightMatchSource.includes('dtxrSuppressionReason'),
  'Weight Match rows should expose DTXR suppression reason.'
);
assert.ok(
  weightMatchSource.includes('buildDtxrContext'),
  'Weight Match should build and consume the central DTXR context.'
);
