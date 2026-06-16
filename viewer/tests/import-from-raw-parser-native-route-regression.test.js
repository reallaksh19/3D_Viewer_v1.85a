import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- import-from-raw-parser-native-route-regression.test.js ---');

  const importer = read('viewer/js/pcf2glb/import/ImportFromRawParser.js');

  assert.ok(
    importer.includes("import { parseBinaryAccdb }"),
    'ACCDB/MDB import must remain present'
  );

  assert.ok(
    importer.includes("import { parse }"),
    'CAESAR/XML parser import must remain present'
  );

  assert.ok(
    importer.includes("parseStpSupportMembers"),
    'STEP import must remain present'
  );

  assert.ok(
    importer.includes("ext === 'stp' || ext === 'step'"),
    'STEP branch must remain present'
  );

  assert.ok(
    importer.includes("ext === 'xml' || ext === 'pdf'"),
    'XML/PDF branch must remain present'
  );

  assert.ok(
    importer.includes("String(parsed?.format || '').toUpperCase() === 'XML'"),
    'XML format branch must remain present'
  );

  assert.ok(
    importer.includes('buildNativeXmlDirectData(parsed, fileName, defaults)'),
    'XML format branch must route to native XML direct builder'
  );

  assert.ok(
    importer.includes('_parsedToDirectPcfData(parsed, fileName, defaults)'),
    'non-XML parser route must still use _parsedToDirectPcfData'
  );

  console.log('[PASS] ImportFromRawParser native route regression passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] ImportFromRawParser native route regression failed.');
  console.error(error);
  process.exit(1);
}
