import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- viewer3d-xml-compare-route-selector.test.js ---');

  const tab = read('viewer/tabs/viewer3d-tab.js');
  const panel = read('viewer/tabs/viewer3d-xml-compare-panel.js');

  assert.ok(tab.includes('mountXmlComparePanel'), 'viewer3d-tab.js must mount the XML compare panel');
  assert.ok(tab.includes('data-viewer3d-side-tab="xml-diff"'), 'viewer3d-tab.js must expose the XML Diff side tab marker');
  assert.ok(tab.includes('data-viewer3d-side-panel="xml-diff"'), 'viewer3d-tab.js must expose the XML Diff side panel marker');
  assert.ok(tab.includes('xmlDiffPanel?.destroy?.()'), 'viewer3d-tab.js must destroy the XML compare panel before rerendering');

  assert.ok(panel.includes('InputXML Route'), 'viewer3d-xml-compare-panel.js must render the route selector label');
  assert.ok(panel.includes('data-v3d-xc-inputxml-route'), 'viewer3d-xml-compare-panel.js must render the route selector control');
  assert.ok(panel.includes('persistInputXmlImportRoute'), 'viewer3d-xml-compare-panel.js must persist the selected route');
  assert.ok(panel.includes('DEFAULT_INPUTXML_IMPORT_ROUTE'), 'viewer3d-xml-compare-panel.js must seed the selector from the default route');
  assert.ok(panel.includes('Load XML A') && panel.includes('Load XML B'), 'viewer3d-xml-compare-panel.js must render both load controls');
  assert.ok(panel.includes('v3d-xc-report-grid'), 'viewer3d-xml-compare-panel.js must render the route report grid');

  console.log('[PASS] viewer3d XML compare route selector passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] viewer3d XML compare route selector failed.');
  console.error(error);
  process.exit(1);
}
