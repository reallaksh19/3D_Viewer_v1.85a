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
    'data-xml-compare-topology-filter="severity"',
    'data-xml-compare-topology-filter="datasetId"',
    'data-xml-compare-topology-filter="code"',
    'data-xml-compare-topology-filter="search"',
    'data-xml-compare-topology-action="hide-filtered"',
    'data-xml-compare-topology-action="isolate-filtered"',
    'data-xml-compare-topology-action="show-all"',
    'data-xml-compare-topology-action="export-filtered-csv"',
    'buildTopologyIssuesCsv',
  ]) {
    assert.equal(tab.includes(marker), true, `Missing X13 marker: ${marker}`);
  }

  for (const marker of [
    '.xml-compare-topology-filters',
    '.xml-compare-topology-actions',
    '.xml-compare-topology-filter-summary',
  ]) {
    assert.equal(css.includes(marker), true, `Missing CSS marker: ${marker}`);
  }

  assert.equal(/RvmPcf|viewer3d-rvm|rvm-pcf/i.test(`${tab}\n${css}`), false, 'XML compare tab must remain independent from RVM modules.');

  console.log('[PASS] XML Compare X13 topology filter UI markers passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] XML Compare X13 topology filter UI markers failed.');
  console.error(error);
  process.exit(1);
}
