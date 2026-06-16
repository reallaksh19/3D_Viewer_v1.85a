import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  const viewer = read('viewer/viewer-3d.js');
  const tab = read('viewer/tabs/viewer3d-tab.js');

  assert.ok(
    viewer.includes('refreshLengthLabels(components = null)'),
    'PcfViewer3D must expose a public refreshLengthLabels() hook'
  );

  assert.ok(
    viewer.includes('this._rebuildLengthLabels(source);'),
    'refreshLengthLabels() must rebuild the cached length labels'
  );

  assert.ok(
    viewer.includes('OVERLAY_LAYER_IDS.LENGTH'),
    'refreshLengthLabels() must keep the LENGTH overlay layer in sync'
  );

  assert.ok(
    viewer.includes("this._emitTrace('length-labels-refresh'"),
    'refreshLengthLabels() must emit a trace for debugging'
  );

  for (const marker of [
    "'length-labels-toggled'",
    "'length-labels-gap'",
    "'verification-mode'",
  ]) {
    assert.ok(
      tab.includes(marker),
      `viewer3d-tab.js must treat ${marker} as an overlay-only length update`
    );
  }

  assert.ok(
    tab.includes('typeof _viewer.refreshLengthLabels === \'function\''),
    'viewer3d-tab.js must guard the refresh hook and fall back safely'
  );

  assert.ok(
    tab.includes('_updateSettingsPanelSection(container);'),
    'viewer3d-tab.js must refresh the settings panel after length updates'
  );

  console.log('[PASS] Viewer3D length label refresh wiring passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Viewer3D length label refresh wiring failed.');
  console.error(error);
  process.exit(1);
}
