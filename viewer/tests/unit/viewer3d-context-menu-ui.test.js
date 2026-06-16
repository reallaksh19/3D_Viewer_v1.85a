import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- viewer3d-context-menu-ui.test.js ---');

  const pcfJs = read('viewer/tabs/viewer3d-tab.js');
  const rvmJs = read('viewer/tabs/viewer3d-rvm-tab.js');
  const pcfCss = read('viewer/styles/viewer3d.css');

  assert.ok(pcfJs.includes('v3d-context-menu'), 'PCF viewer must render a context menu container');
  assert.ok(rvmJs.includes('rvm-context-menu'), 'RVM viewer must render a context menu container');
  assert.ok(pcfJs.includes('function _bindViewerContextMenu(container, options)'), 'PCF context menu binder must be explicit');
  assert.ok(rvmJs.includes('function _bindRvmContextMenu(container)'), 'RVM context menu binder must be explicit');

  for (const action of ['fitSelection', 'properties', 'copyCoordinates', 'clearSelection']) {
    assert.ok(pcfJs.includes(action), `PCF context menu missing ${action}`);
  }

  for (const action of ['fitSelection', 'isolate', 'showAll', 'attributes', 'tag', 'copyCoordinates']) {
    assert.ok(rvmJs.includes(action), `RVM context menu missing ${action}`);
  }

  assert.ok(
    pcfJs.includes("action === 'showAll' || !!selection") && rvmJs.includes("action !== 'showAll' && !hasSelection"),
    'context menus must disable selection-dependent actions when no selection exists'
  );
  assert.ok(
    pcfCss.includes('.viewer-context-menu') && pcfCss.includes('.viewer-context-menu-item:disabled'),
    'shared CSS must style context menu and disabled actions'
  );
  assert.ok(
    pcfJs.includes('v3d-selection-hud') && rvmJs.includes('rvm-selection-hud'),
    'both viewers must render a selection HUD'
  );

  console.log('[PASS] Viewer context menu UI smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Viewer context menu UI smoke failed.');
  console.error(error);
  process.exit(1);
}
