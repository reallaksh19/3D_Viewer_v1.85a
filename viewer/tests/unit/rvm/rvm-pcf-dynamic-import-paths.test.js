import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-pcf-dynamic-import-paths.test.js ---');

  const js = read('viewer/tabs/rvm-json-pcf-extract-tab.js');

  const requiredMarkers = [
    '_rvmPcfModuleCandidates',
    '_importRvmPcfModule',
    'rvm-pcf-extract/${cleanFile}',
    'viewer/rvm-pcf-extract/${cleanFile}',
    "_importRvmPcfModule('RvmFinal2dCsvBuilder.js')",
    "_importRvmPcfModule('RvmExtractHardening.js')",
    "_importRvmPcfModule('RvmMasterResolutionWorkflow.js')",
  ];

  for (const marker of requiredMarkers) {
    assert.ok(
      js.includes(marker),
      `rvm-json-pcf-extract-tab.js missing marker: ${marker}`
    );
  }

  assert.ok(
    !js.includes("import('../rvm-pcf-extract/RvmMasterResolutionWorkflow.js')"),
    'direct dynamic import of RvmMasterResolutionWorkflow.js must be replaced'
  );

  console.log('[PASS] RVM PCF dynamic import path fallback smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM PCF dynamic import path fallback smoke failed.');
  console.error(error);
  process.exit(1);
}
