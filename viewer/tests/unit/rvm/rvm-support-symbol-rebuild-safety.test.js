import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-support-symbol-rebuild-safety.test.js ---');

  const js = read('viewer/rvm-viewer/RvmSupportSymbols.js');
  const borePatchJs = read('viewer/rvm-viewer/RvmSupportBoreAnchorPatch.js');
  const sourcePatchJs = read('viewer/rvm-viewer/RvmSupportSourceOverlayPatch.js');
  const mapperJs = read('viewer/rvm-viewer/RvmSupportMapper.js');
  const rvmTabJs = read('viewer/tabs/viewer3d-rvm-tab.js');

  assert.ok(
    js.includes('REBUILD_FOUND_ZERO_SUPPORTS_KEPT_EXISTING'),
    'support rebuild must preserve existing symbols if rescan finds zero supports'
  );

  assert.ok(
    js.includes('preservedExisting: true'),
    'support rebuild diagnostics must report preservedExisting=true'
  );

  assert.ok(
    js.includes('disposeObject(symbolRoot);'),
    'unused newly-built empty symbol root must be disposed'
  );

  assert.ok(
    js.includes('if (created > 0)') &&
    js.includes('viewer.scene.remove(existing)'),
    'existing support symbols should only be removed after new symbols are created'
  );

  assert.ok(
    js.includes("import { resolveKindFromAttrs } from './RvmSupportMapper.js") &&
    js.includes('function resolveSupportKind(obj, attrs)') &&
    js.includes('resolveKindFromAttrs(attrs) || normalizeSupportKind'),
    'main support renderer must use user mapper rules before hard-coded kind detection'
  );

  assert.ok(
    js.includes('resolveKindFromAttrs(attrs) ||') &&
    js.includes('const kind = resolveSupportKind(obj, attrs);'),
    'main support renderer must let user rules make supports visible'
  );

  assert.ok(
    borePatchJs.includes('const k = resolveKindFromAttrs(a) || kindFrom(text(o, a));') &&
    borePatchJs.includes('!(resolveKindFromAttrs(a) ||'),
    'bore-anchor patch must let user rules override built-in kind guesses and support detection'
  );

  assert.ok(
    sourcePatchJs.includes('const mappedKind = resolveKindFromAttrs(a);') &&
    sourcePatchJs.includes('const k = mappedKind || kind(t)'),
    'source overlay patch must let user rules override built-in kind guesses and support detection'
  );

  assert.ok(
    mapperJs.includes("new CustomEvent('rvm-support-mapper-rules-changed')") &&
    rvmTabJs.includes('_bindSupportMapperRuleChanges(container)') &&
    rvmTabJs.includes('support-mapper-rule-change'),
    'RVM tab must rebuild visible support symbols when mapper rules change'
  );

  assert.ok(
    rvmTabJs.includes('RvmViewer3D.js?v=20260518-statusbar-theme-12') &&
    js.includes('RvmViewer3D.js?v=20260518-statusbar-theme-12') &&
    borePatchJs.includes('RvmViewer3D.js?v=20260518-statusbar-theme-12') &&
    sourcePatchJs.includes('RvmViewer3D.js?v=20260518-statusbar-theme-12'),
    'RVM tab and support patches must import the same RvmViewer3D module URL'
  );

  assert.ok(
    js.includes('const SUPPORT_SYMBOL_COLOR = 0x60c864') &&
    borePatchJs.includes('const SUPPORT_SYMBOL_COLOR = 0x60c864') &&
    sourcePatchJs.includes('const SUPPORT_SYMBOL_COLOR = 0x60c864'),
    'all RVM support symbol renderers must use the unified green support color'
  );

  console.log('[PASS] RVM support symbol rebuild safety passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM support symbol rebuild safety failed.');
  console.error(error);
  process.exit(1);
}
