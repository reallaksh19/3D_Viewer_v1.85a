import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function readIfExists(file) {
  const full = path.resolve(file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
}

function run() {
  console.log('--- inputxml-routing-final-boundary.test.js ---');

  const files = [
    'viewer/xml-compare/InputXmlImportRoutes.js',
    'viewer/js/pcf2glb/import/NativeXmlDirectBuilder.js',
    'viewer/xml-compare/InputXmlUxmlToViewerComponents.js',
    'viewer/xml-compare/InputXmlUxmlRoundTripRoute.js',
    'viewer/xml-compare/InputXmlImportRouter.js',
    'viewer/xml-compare/InputXmlRouteReport.js',
    'viewer/tabs/viewer3d-xml-compare-panel.js',
    'viewer/tabs/viewer3d-tab.js',
    'viewer/styles/viewer3d.css',
  ];

  const rvmForbidden = /viewer3d-rvm-tab|rvm-viewer|rvm-pcf-extract|viewer\/rvm\/|RvmPcf|RvmSupport|RvmTag/i;
  const emitterForbidden = /buildPcfFromContinuity|pcfxDocumentFromPcfText|PcfEmitter|CII/i;
  const emitterScopedFiles = new Set([
    'viewer/xml-compare/InputXmlImportRoutes.js',
    'viewer/js/pcf2glb/import/NativeXmlDirectBuilder.js',
    'viewer/xml-compare/InputXmlUxmlToViewerComponents.js',
    'viewer/xml-compare/InputXmlUxmlRoundTripRoute.js',
    'viewer/xml-compare/InputXmlImportRouter.js',
    'viewer/xml-compare/InputXmlRouteReport.js',
    'viewer/tabs/viewer3d-xml-compare-panel.js',
    'viewer/styles/viewer3d.css',
  ]);

  for (const file of files) {
    const text = readIfExists(file);

    assert.ok(text, `expected file to exist: ${file}`);

    assert.ok(
      !rvmForbidden.test(text),
      `${file} must not import or reference RVM-specific modules`
    );

    if (emitterScopedFiles.has(file)) {
      assert.ok(
        !emitterForbidden.test(text),
        `${file} must not emit PCF/CII`
      );
    }
  }

  const rvmTab = readIfExists('viewer/tabs/viewer3d-rvm-tab.js');
  assert.ok(rvmTab, '3D RVM Viewer tab must still exist');

  const normalTab = readIfExists('viewer/tabs/viewer3d-tab.js');
  assert.ok(
    normalTab.includes('viewer3d-xml-compare-panel.js'),
    'normal 3D Viewer must mount XML Compare panel'
  );

  assert.ok(
    normalTab.includes('data-viewer3d-side-tab="xml-diff"') ||
    normalTab.includes("data-viewer3d-side-tab='xml-diff'"),
    'normal 3D Viewer must contain XML Diff side-tab marker'
  );

  console.log('[PASS] InputXML routing final boundary passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] InputXML routing final boundary failed.');
  console.error(error);
  process.exit(1);
}
