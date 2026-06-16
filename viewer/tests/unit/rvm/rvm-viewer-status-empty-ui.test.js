import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-viewer-status-empty-ui.test.js ---');

  const js = read('viewer/tabs/viewer3d-rvm-tab.js');
  const css = read('viewer/tabs/viewer3d-rvm-tab.css');

  const requiredJsMarkers = [
    '_ensureRvmStatusStrip',
    '_updateRvmStatusStrip',
    '_ensureRvmEmptyStates',
    '_refreshRvmEmptyStates',
    '_ensureRvmTagPanelActions',
    '_bindRvmTagPanelActions',
    '_bindRvmUiStatusEvents',
    '_refreshRvmUiStatus',
    'data-rvm-status-chip="objects"',
    'data-rvm-status-chip="visible"',
    'data-rvm-status-chip="selected"',
    'data-rvm-status-chip="tags"',
    'data-rvm-status-chip="unresolved"',
    'id="rvm-statusbar"',
    'id="rvm-mode-chip"',
    'id="rsx"',
    'id="rsy"',
    'id="rsz"',
    'id="rvm-sel-count"',
    'id="rvm-sb-msg"',
    'id="rvm-fps"',
    '_updateRvmBottomStatus',
    '_setRvmStatusCoords',
    'id="rvm-hierarchy-empty"',
    'id="rvm-attributes-empty"',
    'id="rvm-tags-empty"',
    'id="rvm-search-empty"',
    'Import XML',
    'Export XML',
    'rvm-review-tags.xml',
    'RvmTagXmlStore',
  ];

  for (const marker of requiredJsMarkers) {
    assert.ok(
      js.includes(marker),
      `viewer3d-rvm-tab.js missing marker: ${marker}`
    );
  }

  const requiredCssMarkers = [
    '.rvm-status-strip',
    '.rvm-status-chip',
    '.rvm-status-chip.is-active',
    '.rvm-status-chip.is-warn',
    '#rvm-statusbar',
    '.sc-coords',
    '.sc-ax',
    '.sc-v',
    '.rvm-empty-state',
    '.rvm-empty-state[hidden]',
    '.rvm-tag-panel-actions',
    '.rvm-tag-panel-buttons',
    '.rvm-tag-panel-btn',
  ];

  for (const marker of requiredCssMarkers) {
    assert.ok(
      css.includes(marker),
      `viewer3d-rvm-tab.css missing marker: ${marker}`
    );
  }

  assert.ok(
    js.includes('RuntimeEvents.RVM_TAG_CREATED') &&
    js.includes('RuntimeEvents.RVM_TAG_DELETED'),
    'tag create/delete events must refresh status strip'
  );

  assert.ok(
    js.includes('RuntimeEvents.RVM_MODEL_LOADED') ||
    js.includes('RuntimeEvents.MODEL_LOADED'),
    'model-load events must refresh status strip'
  );

  console.log('[PASS] RVM viewer status / empty-state UI smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM viewer status / empty-state UI smoke failed.');
  console.error(error);
  process.exit(1);
}
