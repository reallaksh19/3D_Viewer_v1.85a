import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function run() {
  const tab = read('viewer/tabs/xml-compare-tab.js');
  const css = read('viewer/tabs/xml-compare-tab.css');

  for (const marker of [
    'renderXmlCompareTab',
    'XML_COMPARE_BLOCK_CODES',
    'data-xml-compare-load="a"',
    'data-xml-compare-load="b"',
    'data-xml-compare-action="compare"',
    'data-xml-compare-topology-row',
    'data-xml-compare-topology-issues',
  ]) {
    assert.equal(tab.includes(marker), true, `Missing tab marker: ${marker}`);
  }

  for (const marker of [
    '.xml-compare-tab',
    '.xml-compare-layout',
    '.xml-compare-topology-filters',
    '.xml-compare-topology-actions',
    '.xml-compare-topology-table',
  ]) {
    assert.equal(css.includes(marker), true, `Missing CSS marker: ${marker}`);
  }

  assert.equal(/RvmPcf|viewer3d-rvm|rvm-pcf/i.test(`${tab}\n${css}`), false, 'XML compare tab must not reference RVM modules.');

  console.log('[PASS] XML Compare X12 topology issues UI markers passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] XML Compare X12 topology issues UI markers failed.');
  console.error(error);
  process.exit(1);
}
