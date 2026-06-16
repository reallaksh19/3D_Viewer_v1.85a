import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = fs.readFileSync(new URL('../tabs/model-converters-tab.js', import.meta.url), 'utf8');
for (const token of [
  'RMSS_XML_TYPE_PATTERNS',
  "'VALV'",
  "'FLAN'",
  "'ELBO'",
  "'TEE'",
  '_expandRmssChildToPsiXmlNodes',
  '_buildXmlNodeBlock(lines, { ...expandedNode, nodeNumber })',
]) {
  assert.ok(text.includes(token), `expected ${token} in fitting-preserving staged JSON XML path`);
}
console.log('✅ stagedjson-xml-preserves-fittings smoke test passed.');
