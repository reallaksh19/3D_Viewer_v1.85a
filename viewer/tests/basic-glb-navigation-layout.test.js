import assert from 'node:assert/strict';
import fs from 'node:fs';

const basicPanelSource = fs.readFileSync(
  new URL('../js/pcf2glb/ui/BasicGlbPcfPanel.js', import.meta.url),
  'utf8',
);
const viewerAppSource = fs.readFileSync(
  new URL('../js/pcf2glb/advanced/createViewerApp.js', import.meta.url),
  'utf8',
);
const selectionSource = fs.readFileSync(
  new URL('../js/pcf2glb/advanced/createSelection.js', import.meta.url),
  'utf8',
);
const marqueeSource = fs.readFileSync(
  new URL('../js/pcf2glb/advanced/createMarqueeZoom.js', import.meta.url),
  'utf8',
);
const cameraSource = fs.readFileSync(
  new URL('../js/pcf2glb/advanced/createCameraController.js', import.meta.url),
  'utf8',
);
const labelOverlaySource = fs.readFileSync(
  new URL('../js/pcf2glb/advanced/glbLabelOverlayFinal.js', import.meta.url),
  'utf8',
);

assert.match(basicPanelSource, /basic-glb-sidebar-collapsed-v1/);
assert.match(basicPanelSource, /id="basic-glb-sidebar"/);
assert.match(basicPanelSource, /id="basic-glb-sidebar-toggle"/);
assert.match(basicPanelSource, /window\.localStorage\.setItem\(BASIC_GLB_SIDEBAR_COLLAPSED_KEY/);
assert.match(basicPanelSource, /viewerApp\.resize\?\.\(\)/);
assert.match(basicPanelSource, /window\.setTimeout\(resizeViewer, 220\)/);
assert.match(basicPanelSource, /id="adv-right-dock"/);
assert.match(basicPanelSource, /id="adv-label-panel-host"/);
assert.match(basicPanelSource, /labelPanelHost/);
assert.match(basicPanelSource, /id="adv-nav-strip"/);
assert.match(basicPanelSource, /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(basicPanelSource, /data-adv-nav="ZOOM_SELECTED"/);
assert.match(basicPanelSource, /viewerApp\.zoomSelected\(\)/);
assert.doesNotMatch(basicPanelSource, /right:334px/);
assert.doesNotMatch(basicPanelSource, /top:348px/);

assert.match(viewerAppSource, /zoomSelected:\s*\(\)\s*=>/);
assert.match(viewerAppSource, /selectedItem\s*=\s*item/);
assert.match(viewerAppSource, /panelHost:\s*options\.labelPanelHost/);
assert.match(viewerAppSource, /ResizeObserver/);
assert.match(viewerAppSource, /resizeViewport/);
assert.doesNotMatch(viewerAppSource, /controller\.setTarget\(center\)/);
assert.doesNotMatch(viewerAppSource, /No auto-fit on selection/);

assert.match(selectionSource, /pointerup/);
assert.match(selectionSource, /distance > 4/);
assert.match(selectionSource, /onPointerDown/);
assert.match(selectionSource, /onSelect/);

assert.match(cameraSource, /fitBox\(box\)/);
assert.match(marqueeSource, /controller\.fitBox\?\.\(box\)/);
assert.doesNotMatch(marqueeSource, /fitObject\(box\)/);

assert.match(labelOverlaySource, /panelHost/);
assert.match(labelOverlaySource, /defaultPanelStyle\(Boolean\(host\)\)/);

console.log('basic-glb-navigation-layout.test.js passed');
