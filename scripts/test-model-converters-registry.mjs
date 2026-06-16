import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPECTED_IDS = [
  'rvm_to_rev',
  'rvmattr_to_xml',
  'rev_to_pcf',
  'rev_to_xml',
  'rev_to_stp',
  'json_to_xml',
  'stagedjson_to_xml',
  'stagedjson_to_inputxml',
  'stagedjson_to_csv',
  'pdf_to_inputxml',
  'pdf_to_inputxml_cii14',
  'xml_to_cii',
  'cii_syntax_check_2019',
  'inputxml_to_cii',
  'inputxml14_to_cii',
  'inputxml_to_cii2019',
  'pcf_continuity_check'
];

async function runTest() {
  console.log('Running Model Converters registry test...');
  const registryPath = path.join(__dirname, '../viewer/tabs/model-converters/converter-registry.js');
  
  const moduleUrl = new URL(`file://${registryPath.replace(/\\/g, '/')}`);
  const { CONVERTERS, getConverterById } = await import(moduleUrl.href);

  assert(Array.isArray(CONVERTERS), 'CONVERTERS must be an array');
  assert.strictEqual(CONVERTERS.length, EXPECTED_IDS.length, `Expected ${EXPECTED_IDS.length} converters, found ${CONVERTERS.length}`);

  for (const id of EXPECTED_IDS) {
    const found = getConverterById(id);
    assert(found, `Converter with ID ${id} not found in registry`);
    assert.strictEqual(found.id, id, `Converter ID mismatch: expected ${id}, found ${found.id}`);
  }

  console.log('✅ Registry test passed successfully!');
}

runTest().catch((err) => {
  console.error('❌ Registry test failed:', err);
  process.exit(1);
});
