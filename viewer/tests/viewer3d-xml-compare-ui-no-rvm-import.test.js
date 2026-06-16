import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function readIfExists(file) {
  const full = path.resolve(file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
}

function run() {
  console.log('--- viewer3d-xml-compare-ui-no-rvm-import.test.js ---');

  const files = [
    'viewer/tabs/viewer3d-tab.js',
    'viewer/tabs/viewer3d-xml-compare-panel.js',
    'viewer/styles/viewer3d.css',
  ];

  for (const file of files) {
    const text = readIfExists(file);

    assert.ok(text, `expected file to exist: ${file}`);

    assert.ok(
      !/viewer3d-rvm-tab|rvm-viewer|rvm-pcf-extract|viewer\/rvm\/|RvmPcf|RvmSupport|RvmTag/i.test(text),
      `${file} must not import or reference RVM-specific modules`
    );
  }

  console.log('[PASS] viewer3d XML compare UI no-RVM boundary passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] viewer3d XML compare UI no-RVM boundary failed.');
  console.error(error);
  process.exit(1);
}
