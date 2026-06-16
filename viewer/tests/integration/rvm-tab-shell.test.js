import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const tabJs = read('tabs/viewer3d-rvm-tab.js');
const tabCss = read('tabs/viewer3d-rvm-tab.css');
const appJs = read('core/app.js');
const stateJs = read('core/state.js');
const tabVis = read('opt/tab-visibility.json');
const indexHtml = read('index.html');

// ✅ app.js imports renderViewer3DRvm from the rvm tab
assert.ok(
  appJs.includes('renderViewer3DRvm'),
  'app.js must import renderViewer3DRvm'
);

// ✅ TABS array contains the "viewer3d-rvm" id entry
assert.ok(
  appJs.includes("id: 'viewer3d-rvm'") || appJs.includes('id:"viewer3d-rvm"'),
  'app.js TABS must include viewer3d-rvm entry'
);

// ✅ tab label is "3D RVM Viewer"
assert.ok(
  appJs.includes('3D RVM Viewer'),
  'app.js must include "3D RVM Viewer" tab label'
);

// ✅ tab-visibility.json enables viewer3d-rvm
const tabVisJson = JSON.parse(tabVis.replace(/^\uFEFF/, ""));
assert.equal(tabVisJson['viewer3d-rvm'], 1, 'tab-visibility.json must have "viewer3d-rvm": 1');

// ✅ index.html links viewer3d-rvm-tab.css
assert.ok(
  indexHtml.includes('viewer3d-rvm-tab.css'),
  'index.html must link viewer3d-rvm-tab.css'
);

// ✅ .rvm-viewport element is rendered in the tab HTML
assert.ok(
  tabJs.includes('rvm-viewport'),
  'tab must render .rvm-viewport'
);

// ✅ canvas.rvm-canvas element present
assert.ok(
  tabJs.includes('rvm-canvas'),
  'tab must include rvm-canvas element'
);

// ✅ #rvm-hierarchy-tree element present
assert.ok(
  tabJs.includes('rvm-hierarchy-tree'),
  'tab must include #rvm-hierarchy-tree element'
);

assert.ok(
  tabJs.includes('rvm-tree-filter'),
  'tab must include #rvm-tree-filter hierarchy filter'
);

// ✅ #rvm-attributes-content element present
assert.ok(
  tabJs.includes('rvm-attributes-content'),
  'tab must include #rvm-attributes-content element'
);

assert.ok(
  tabJs.includes('rvm-context-menu') && tabJs.includes('rvm-selection-hud'),
  'tab must include RVM context menu and selection HUD'
);

// ✅ _disposeRvmViewer cleans up event listener (_shortcutHandler = null)
assert.ok(
  tabJs.includes('_shortcutHandler = null'),
  'dispose must null _shortcutHandler to prevent listener accumulation'
);

// ✅ renderViewer3DRvm returns _disposeRvmViewer (destroyFn)
assert.ok(
  tabJs.includes('return _disposeRvmViewer'),
  'renderViewer3DRvm must return destroyFn'
);

// ✅ static mode: raw RVM file input is conditionally rendered (not always present)
assert.ok(
  tabJs.includes('isStaticMode') || tabJs.includes('rawRvmImport'),
  'static mode should conditionally hide raw RVM file input'
);

// ✅ state.rvm slice exists with asyncLoad field
assert.ok(
  stateJs.includes('asyncLoad'),
  'state.js must define state.rvm.asyncLoad'
);

// ✅ state.rvm persisted to localStorage key 'viewer3d_rvm_v1'
assert.ok(
  stateJs.includes("'viewer3d_rvm_v1'") || stateJs.includes('"viewer3d_rvm_v1"'),
  "state.js must persist state.rvm under key 'viewer3d_rvm_v1'"
);

// ✅ CSS includes .rvm-placeholder for pre-load state
assert.ok(
  tabCss.includes('rvm-placeholder'),
  'CSS must define .rvm-placeholder style'
);

// ✅ CSS includes .rvm-tag-label for 3D overlay labels
assert.ok(
  tabCss.includes('rvm-tag-label'),
  'CSS must define .rvm-tag-label for CSS2D tag labels'
);

// ✅ RVM events are registered in runtime-events.js
const runtimeEvents = read('contracts/runtime-events.js');
assert.ok(runtimeEvents.includes('RVM_MODEL_LOADED'), 'runtime-events must include RVM_MODEL_LOADED');
assert.ok(runtimeEvents.includes('RVM_NODE_SELECTED'), 'runtime-events must include RVM_NODE_SELECTED');
assert.ok(runtimeEvents.includes('RVM_TAG_CREATED'), 'runtime-events must include RVM_TAG_CREATED');

console.log('✅ rvm-tab-shell integration tests passed.');
