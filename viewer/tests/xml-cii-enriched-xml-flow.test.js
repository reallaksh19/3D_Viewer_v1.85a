import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readAllJsFiles(dir) {
  let content = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      content += readAllJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      content += fs.readFileSync(fullPath, 'utf8') + '\n';
    }
  }
  return content;
}

const tabSource = fs.readFileSync(new URL('../tabs/model-converters-tab.js', import.meta.url), 'utf8') + '\n' +
  readAllJsFiles(path.resolve(__dirname, '../tabs/model-converters')) + '\n' +
  readAllJsFiles(path.resolve(__dirname, '../converters/xml-cii2019-core'));

const pySource = fs.readFileSync(new URL('../converters/scripts/xml_to_cii2019.py', import.meta.url), 'utf8');

for (const token of [
  'Create enriched XML before CII',
  'enrichXmlForCii2019',
  'removedDuplicateSupports',
  'datumNode || restrainedNode || group[0]',
  'buildStagedSupportIndex',
  'Support Type Mapper',
  'getAllRules()',
  'PipelineReference',
  'pipingClassRegex',
  'pipingClassTokenIndex',
  'boreTokenIndex',
  'supportTagsFromAttrs',
  'xmlNodeSupportTags',
  '_enrichment_diagnostics.json',
  'diagnosticText',
  'ps-tag',
  'stagedName',
  'tokenDelimiter',
  'boreTokenIndex',
  'diagnostics.push',
  'createElementNS',
  'npsToDn',
  'masterUrl',
  'loadXmlCiiWeightMasterRows',
  'model-converters-diagnostics-table',
  'setDiagnosticRows',
  'diagnosticRowsForTable',
  'weight-master-source',
  'ratingSequence',
  'findWeightMasterMatch',
  'collectXmlCiiZeroRigidWeightIssues',
  'openXmlCiiZeroRigidWeightPopup',
  'applyXmlCiiRigidWeightOverrides',
  'xmlCiiDtxrPsForNode',
  'xmlCiiDtxrPosForNode',
  'DTXR_PS',
  'DTXR_POS',
  'dtxrPsAnnotations',
  'dtxrPosAnnotations',
  'dtxrPositionOffset',
  'rigidWeight',
  '4A Weight Match',
  "t2: 'T2'",
  "t3: 'T3'",
  'Temperature2',
  'Temperature3',
  'Rigid zero-weight review applied',
  'const enriched = await enrichXmlForCii2019',
  'const diagnosticSource = Array.isArray(enriched?.diagnostics) ? enriched.diagnostics : diagnostics',
  'ElementLengthMm',
  'Rating annotations',
  'weight annotations',
  '_enriched.xml',
  'xmlCiiApproximateClass',
  'xmlCiiResolveMaterialCode',
  'findPipingClassMaster',
  'loadXmlCiiMaterialMap',
  'class-master-match',
  'WallThickness',
  'CorrosionAllowance',
  'MaterialCode',
  'Piping_class_master.json',
  'PCF_MAT_MAP.TXT',
  'data-popup-tab="regex"',
  'Regex Tester',
  'renderRegexTab',
  'data-popup-regex',
  'data-popup-tab="masters"',
  'renderMastersTab',
  'data-popup-masters',
  'Material Map (code',
  'data-mm-field',
  'data-ov-key',
  'data-popup-tab="logs"',
  'Diagnostics Log',
  'renderLogsTab',
  'materialMethod',
]) {
  assert.ok(tabSource.includes(token), `expected ${token} in Model Converter enriched XML flow`);
}

assert.ok(!pySource.includes('--staged-json'), 'xml_to_cii2019.py must remain a pure XML->CII converter');
assert.ok(!pySource.includes('--support-config-json'), 'xml_to_cii2019.py must not consume enrichment config');

console.log('xml-cii-enriched-xml-flow smoke test passed.');
