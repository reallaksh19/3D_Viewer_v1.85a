import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- inputxml-uxml-roundtrip-no-rvm-import.test.js ---');

  const files = [
    'viewer/xml-compare/InputXmlUxmlRoundTripRoute.js',
    'viewer/xml-compare/InputXmlUxmlToViewerComponents.js',
  ];

  for (const file of files) {
    const text = read(file);

    assert.ok(
      !/viewer3d-rvm-tab|rvm-viewer|rvm-pcf-extract|viewer\/rvm\/|RvmPcf|RvmSupport|RvmTag/i.test(text),
      `${file} must not import or reference RVM-specific modules`
    );

    assert.ok(
      !/buildPcfFromContinuity|pcfxDocumentFromPcfText|PcfEmitter|CII/i.test(text),
      `${file} must not emit PCF/CII`
    );
  }

  console.log('[PASS] InputXML UXML roundtrip no-RVM/no-emitter boundary passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] InputXML UXML roundtrip no-RVM/no-emitter boundary failed.');
  console.error(error);
  process.exit(1);
}
