import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-support-symbol-scale-settings.test.js ---');

  const symbolJs = read('viewer/rvm-viewer/RvmSupportSymbols.js');
  const tabJs = read('viewer/tabs/viewer3d-rvm-tab.js');
  const css = read('viewer/tabs/viewer3d-rvm-tab.css');

  const symbolMarkers = [
    'SUPPORT_SYMBOL_SETTINGS_STORAGE_KEY',
    'scaleMultiplier',
    'normalizeRvmSupportSymbolScale',
    'getRvmSupportSymbolSettings',
    'saveRvmSupportSymbolSettings',
    'applyRvmSupportSymbolSettings',
    'setSupportSymbolOptions',
    'const rawScale = diag * opts.symbolScaleFactor;',
    'const baseScale = Math.max(opts.minScale, Math.min(opts.maxScale, rawScale));',
    'const scale = baseScale * opts.scaleMultiplier;',
    'scaleMultiplier: 3.0'
  ];

  for (const marker of symbolMarkers) {
    if (marker === 'scaleMultiplier: 3.0') {
        assert.ok(
          symbolJs.includes('scaleMultiplier: 3.0') || symbolJs.includes('scaleMultiplier: 3.0'),
          `RvmSupportSymbols.js missing marker: ${marker}`
        );
    } else {
        assert.ok(
          symbolJs.includes(marker),
          `RvmSupportSymbols.js missing marker: ${marker}`
        );
    }
  }

  const tabMarkers = [
    'getRvmSupportSymbolSettings',
    'saveRvmSupportSymbolSettings',
    'applyRvmSupportSymbolSettings',
    '_ensureRvmSupportSymbolSettings',
    '_bindRvmSupportSymbolSettings',
    '_applyRvmSupportScale',
    '_ensureRvmSupportSettings',
    '_rvmUiEsc(scale)',
    'data-rvm-support-symbol-scale',
    'data-rvm-support-symbol-scale-number',
    'data-rvm-support-symbol-scale-reset',
    'Support symbol scale',
  ];

  for (const marker of tabMarkers) {
    assert.ok(
      tabJs.includes(marker),
      `viewer3d-rvm-tab.js missing marker: ${marker}`
    );
  }

  const cssMarkers = [
    '.rvm-support-settings-card',
    '.rvm-support-settings-title',
    '.rvm-support-scale-controls',
    '.rvm-support-scale-reset',
    '.rvm-support-scale-hint',
  ];

  for (const marker of cssMarkers) {
    assert.ok(
      css.includes(marker),
      `viewer3d-rvm-tab.css missing marker: ${marker}`
    );
  }


  assert.ok(
    !tabJs.includes('_esc('),
    'viewer3d-rvm-tab.js must not use undefined _esc helper'
  );

assert.ok(
  !tabJs.includes('RuntimeEvents.RVM_TOOL_CHANGED'),
  'support scale must not emit unregistered RuntimeEvents.RVM_TOOL_CHANGED'
);

  assert.ok(
    tabJs.includes('RuntimeEvents.RVM_CONFIG_CHANGED'),
    'support scale must emit registered RuntimeEvents.RVM_CONFIG_CHANGED'
  );


  assert.ok(
    tabJs.includes('notifyUser: true'),
    'slider change/reset must show only final notification'
  );

  assert.ok(
    tabJs.includes("container.addEventListener('input'") &&
    tabJs.includes("container.addEventListener('change'"),
    'support scale must separate live input from final change'
  );

  assert.ok(
    tabJs.includes('_previewRvmSupportScaleControls'),
    'slider input must preview scale without rebuilding symbols continuously'
  );

  assert.ok(
    tabJs.includes("'support-scale-change'"),
    'support symbols must rebuild on change/release'
  );

  assert.ok(
    !tabJs.includes("'support-scale-input'"),
    'support symbols must not rebuild continuously on input'
  );

  console.log('[PASS] RVM support symbol scale settings smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM support symbol scale settings smoke failed.');
  console.error(error);
  process.exit(1);
}
