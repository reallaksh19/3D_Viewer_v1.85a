import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- native-xml-direct-builder-smoke.test.js ---');

  const builder = read('viewer/js/pcf2glb/import/NativeXmlDirectBuilder.js');
  const importer = read('viewer/js/pcf2glb/import/ImportFromRawParser.js');

  assert.ok(
    builder.includes('buildNativeXmlDirectData'),
    'NativeXmlDirectBuilder.js must export buildNativeXmlDirectData'
  );

  assert.ok(
    builder.includes('buildXmlGraphData'),
    'native builder must use buildXmlGraphData'
  );

  assert.ok(
    builder.includes('buildXmlSupportComponents'),
    'native builder must use buildXmlSupportComponents'
  );

  assert.ok(
    builder.includes('xml-support-merge'),
    'native builder must preserve support merge diagnostics'
  );

  assert.ok(
    importer.includes("import { buildNativeXmlDirectData } from './NativeXmlDirectBuilder.js';"),
    'ImportFromRawParser.js must import extracted native builder'
  );

  assert.ok(
    importer.includes('? buildNativeXmlDirectData(parsed, fileName, defaults)'),
    'XML branch must use extracted native builder'
  );

  assert.ok(
    !builder.includes('viewer3d-rvm-tab') &&
    !builder.includes('RvmPcf') &&
    !builder.includes('rvm-pcf-extract'),
    'native builder must not reference RVM modules'
  );

  console.log('[PASS] Native XML direct builder smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Native XML direct builder smoke failed.');
  console.error(error);
  process.exit(1);
}
