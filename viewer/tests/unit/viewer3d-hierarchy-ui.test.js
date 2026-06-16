import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- viewer3d-hierarchy-ui.test.js ---');

  const tabJs = read('viewer/tabs/viewer3d-tab.js');
  const viewerJs = read('viewer/viewer-3d.js');
  const css = read('viewer/styles/viewer3d.css');
  const appJs = read('viewer/core/app.js');
  const indexHtml = read('viewer/index.html');

  assert.ok(tabJs.includes('v3d-panel-hierarchy'), 'PCF viewer must render a hierarchy side-panel tab');
  assert.ok(tabJs.includes('v3d-hierarchy-filter'), 'PCF hierarchy must expose a filter input');
  assert.ok(tabJs.includes('v3d-hierarchy-tree'), 'PCF hierarchy must expose a tree root');
  assert.ok(tabJs.includes('function _buildPcfHierarchyModel(components)'), 'PCF hierarchy builder must be explicit and testable by source');
  assert.ok(
    tabJs.includes("'PIPELINE-REFERENCE'") && tabJs.includes('Unassigned Line') && tabJs.includes('component.type'),
    'PCF hierarchy must group rendered components by pipeline and type'
  );
  assert.ok(
    tabJs.includes('_viewer?.selectComponent?.(component)') && tabJs.includes("_activateSidePanel(container, 'v3d-panel-component')"),
    'PCF hierarchy row clicks must select the component and open properties'
  );
  assert.ok(viewerJs.includes('selectComponent(componentOrId)'), 'PcfViewer3D must expose selectComponent for UI rows/search');
  assert.ok(viewerJs.includes('clearSelection()'), 'PcfViewer3D must expose clearSelection for context menu');
  assert.ok(css.includes('.v3d-tree-root') && css.includes('.v3d-tree-row.is-selected'), 'PCF hierarchy CSS must style tree rows and selection');
  assert.ok(tabJs.includes('id="v3d-sx"') && tabJs.includes('id="v3d-sy"') && tabJs.includes('id="v3d-sz"'), 'PCF status bar must expose coordinate fields');
  assert.ok(tabJs.includes('id="v3d-fps-tri"'), 'PCF status bar must expose the performance/triangle field');
  assert.ok(css.includes('.v3d-status-coords') && css.includes('.v3d-fps-readout'), 'PCF status bar coordinate/perf CSS must be present');
  assert.ok(appJs.includes('viewer3d-tab.js?v=20260518-statusbar-theme-12'), 'app.js must cache-bust the touched PCF tab module');
  assert.ok(indexHtml.includes('styles/viewer3d.css?v=20260518-statusbar-theme-12'), 'index.html must cache-bust touched PCF CSS');

  console.log('[PASS] PCF hierarchy UI smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] PCF hierarchy UI smoke failed.');
  console.error(error);
  process.exit(1);
}
