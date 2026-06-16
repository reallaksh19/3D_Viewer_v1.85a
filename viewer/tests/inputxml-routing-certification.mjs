import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TESTS = [
  'viewer/tests/inputxml-import-routes.test.js',
  'viewer/tests/native-xml-direct-builder-smoke.test.js',
  'viewer/tests/import-from-raw-parser-native-route-regression.test.js',
  'viewer/tests/inputxml-routing-no-rvm-import.test.js',
  'viewer/tests/inputxml-uxml-to-viewer-components.test.js',
  'viewer/tests/inputxml-uxml-roundtrip-route.test.js',
  'viewer/tests/inputxml-uxml-roundtrip-diagnostics.test.js',
  'viewer/tests/inputxml-uxml-roundtrip-no-rvm-import.test.js',
  'viewer/tests/inputxml-import-router-native.test.js',
  'viewer/tests/inputxml-import-router-uxml.test.js',
  'viewer/tests/inputxml-import-router-schema.test.js',
  'viewer/tests/inputxml-import-router-no-rvm-import.test.js',
  'viewer/tests/inputxml-route-report-native.test.js',
  'viewer/tests/inputxml-route-report-uxml.test.js',
  'viewer/tests/inputxml-route-report-diagnostics.test.js',
  'viewer/tests/inputxml-route-report-no-rvm-import.test.js',
  'viewer/tests/viewer3d-xml-compare-route-selector.test.js',
  'viewer/tests/viewer3d-xml-compare-panel-mount.test.js',
  'viewer/tests/viewer3d-xml-compare-route-report-ui.test.js',
  'viewer/tests/viewer3d-xml-compare-ui-no-rvm-import.test.js',
  'viewer/tests/inputxml-routing-final-boundary.test.js',
  'viewer/tests/inputxml-routing-final-integration.test.js',
];

function exists(file) {
  return fs.existsSync(path.resolve(file));
}

function run() {
  console.log('--- InputXML routing certification runner ---');

  const missing = TESTS.filter((test) => !exists(test));

  if (missing.length) {
    console.error('\n[FAIL] Missing certification test file(s):');
    for (const file of missing) {
      console.error(` - ${file}`);
    }
    process.exit(1);
  }

  const failures = [];

  for (const test of TESTS) {
    console.log(`\n[RUN] ${test}`);

    const result = spawnSync(process.execPath, [path.resolve(test)], {
      stdio: 'inherit',
      env: process.env,
    });

    if (result.status !== 0) {
      failures.push(test);
    }
  }

  if (failures.length) {
    console.error('\n[FAIL] InputXML routing certification failed.');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log('\n[PASS] InputXML routing certification passed.');
}

run();
