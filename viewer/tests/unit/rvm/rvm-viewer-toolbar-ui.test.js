import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-viewer-toolbar-ui.test.js ---');

  const js = read('viewer/tabs/viewer3d-rvm-tab.js');
  const css = read('viewer/tabs/viewer3d-rvm-tab.css');
  const pcfJs = read('viewer/tabs/viewer3d-tab.js');
  const pcfCss = read('viewer/styles/viewer3d.css');
  const sharedTokens = read('viewer/styles/shared-viewer-tokens.css');

  const iconOnlyActions = [
    'NAV_PLAN_X',
    'NAV_ROTATE_Y',
    'NAV_ROTATE_Z',
    'SNAP_ISO_NW',
    'SNAP_ISO_NE',
    'SNAP_ISO_SW',
    'SNAP_ISO_SE',
  ];

  for (const action of iconOnlyActions) {
    assert.ok(js.includes(action), `missing action ${action}`);
  }

  assert.ok(
    js.includes('ICON_ONLY_ACTIONS'),
    'viewer3d-rvm-tab.js must define ICON_ONLY_ACTIONS'
  );

  assert.ok(
    js.includes('_renderToolButton(id, icon)'),
    'viewer3d-rvm-tab.js must render tool buttons through _renderToolButton'
  );

  assert.ok(
    js.includes('aria-label="${escapeHtml(label)}"'),
    'icon-only buttons must keep aria-label'
  );

  assert.ok(
    js.includes('title="${escapeHtml(label)}"'),
    'icon-only buttons must keep tooltip title'
  );

  assert.ok(
    js.includes('_bindToolbarClickedState(container)'),
    'toolbar clicked-state binder must be called'
  );

  assert.ok(
    js.includes('rvm-theme-select'),
    'viewer3d-rvm-tab.js must render a theme selector'
  );

  assert.ok(
    js.includes('id="rvm-tree-filter"') &&
    js.includes('function _bindRvmHierarchyFilter(container)'),
    'RVM viewer must render and bind the hierarchy filter'
  );

  assert.ok(
    js.includes('rvm-panel-control-btn') &&
    css.includes('.rvm-panel-control-btn'),
    'RVM hierarchy controls must use class-based styling'
  );

  assert.ok(
    js.includes('rvm-context-menu') &&
    js.includes('function _bindRvmContextMenu(container)'),
    'RVM viewer must render and bind the context menu'
  );

  assert.ok(
    js.includes("value: 'NavisDark'") && js.includes("value: 'HighContrast'") && js.includes("value: 'DrawLight'") && js.includes("value: 'SteelNeutral'"),
    'viewer3d-rvm-tab.js must offer the shared theme options'
  );

  assert.ok(
    js.includes('_applyRvmTheme(container, newTheme)') && js.includes('_viewer?.setThemePreset?.(newTheme)'),
    'RVM theme selector must update the root theme class and canvas theme hook'
  );

  assert.ok(
    pcfJs.includes('viewer3d-theme-select'),
    'PCF viewer must keep its theme selector'
  );

  assert.ok(
    pcfJs.includes('viewer-local-samples-group') &&
    pcfJs.includes('viewer3d-load-mock1') &&
    pcfJs.includes('viewer3d-load-mock2') &&
    pcfJs.includes('viewer3d-load-mock-xml'),
    'PCF viewer must render visible localhost sample controls'
  );

  assert.ok(
    js.includes("window.addEventListener('keydown', _shortcutHandler, true)"),
    'ESC shortcut must be capture-phase universal listener'
  );

  assert.ok(
    js.includes("_viewer?.setNavMode?.('orbit')"),
    'ESC must reset viewer to orbit mode'
  );

  assert.ok(
    css.includes('.rvm-tool-btn.is-icon-only'),
    'CSS must include icon-only tool button styling'
  );

  assert.ok(
    css.includes('.rvm-tool-btn.is-active'),
    'CSS must include active toolbar button styling'
  );

  assert.ok(
    css.includes('.rvm-tab-root.geo-theme-highcontrast .rvm-tool-btn.is-active') &&
    css.includes('color: #000000 !important'),
    'HighContrast active toolbar state must not render white text on a white accent'
  );

  assert.ok(
    css.includes('background: var(--geo-accent, #4a9eff) !important'),
    'active/clicked state must use consistent blue'
  );

  assert.ok(
    css.includes('.rvm-theme-select'),
    'CSS must include theme selector styling'
  );

  assert.ok(
    js.includes('RVM_TOOL_GROUPS') &&
    js.includes("label: 'Navigate'") &&
    js.includes("label: 'View'") &&
    js.includes("label: 'Section'") &&
    js.includes("label: 'Orient'"),
    'RVM toolbar must split navigation tools into labeled reference-style groups'
  );

  assert.ok(
    js.indexOf('rvm-ribbon-file') < js.indexOf('RVM_TOOL_GROUPS.map(_renderToolbarGroup)') &&
    js.indexOf('RVM_TOOL_GROUPS.map(_renderToolbarGroup)') < js.indexOf('rvm-ribbon-search') &&
    js.indexOf('rvm-ribbon-search') < js.indexOf('rvm-ribbon-actions') &&
    js.indexOf('rvm-ribbon-actions') < js.indexOf('rvm-ribbon-theme'),
    'RVM toolbar must prioritize import, tool groups, search, output, then theme'
  );

  assert.ok(
    css.includes('.rvm-tab-root .rvm-ribbon-file') &&
    css.includes('.rvm-tab-root .rvm-ribbon-view') &&
    css.includes('.rvm-tab-root .rvm-ribbon-sectioning') &&
    css.includes('.rvm-tab-root .rvm-ribbon-orient') &&
    css.includes('.rvm-tab-root .rvm-ribbon-actions') &&
    css.includes('.rvm-tab-root .rvm-ribbon-theme'),
    'RVM CSS must style all major toolbar groups'
  );

  assert.ok(
    css.includes('.rvm-tab-root .rvm-ribbon-label') &&
    css.includes('overflow-x: auto') &&
    js.includes('<span>Extract PCF</span>'),
    'RVM toolbar must include group labels, horizontal overflow, and compact output label'
  );

  assert.ok(
    pcfCss.includes('.viewer-local-samples-group') &&
    !pcfCss.includes('.geo-theme-navisdark #viewer3d-load-mock1'),
    'PCF CSS must style sample controls without hiding mock buttons'
  );

  assert.ok(
    css.includes('shared-viewer-tokens.css'),
    'RVM CSS must import the shared viewer tokens'
  );

  assert.ok(
    sharedTokens.includes('.geo-theme-highcontrast') && sharedTokens.includes('.geo-theme-drawlight') && sharedTokens.includes('.geo-theme-steelneutral'),
    'shared tokens must define all selectable theme classes'
  );

  assert.ok(
    sharedTokens.includes('--vc-shell-bg: #000000') &&
    sharedTokens.includes('--vc-shell-bg: #f1f5f9') &&
    sharedTokens.includes('--geo-bg: var(--vc-shell-bg)'),
    'shared tokens must theme-scope both --vc-* and --geo-* aliases'
  );

  console.log('[PASS] RVM viewer toolbar icon-only / active-state / ESC smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM viewer toolbar UI smoke failed.');
  console.error(error);
  process.exit(1);
}
