import assert from 'node:assert/strict';
import * as THREE from 'three';

import { applyGlbSupportSymbols } from '../js/pcf2glb/advanced/applyGlbSupportSymbols.js';
import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';

function support(id, kind, axis = { x: 1, y: 0, z: 0 }, extra = {}) {
  const { component = {}, attributes = {} } = extra;
  return {
    id,
    type: 'SUPPORT',
    bore: component.bore ?? 20,
    coOrds: { x: 0, y: 0, z: 0 },
    ep1: { x: 0, y: 0, z: 0 },
    refNo: id,
    supportKind: kind,
    attributes: {
      COMPONENT_IDENTIFIER: id,
      SUPPORT_TAG: id,
      SUPPORT_KIND: kind,
      CAESAR_SUPPORT_KIND: kind,
      caesarXCosine: String(axis.x),
      caesarYCosine: String(axis.y),
      caesarZCosine: String(axis.z),
      ...attributes,
    },
    raw: {
      caesarSupportKind: kind,
      caesarXCosine: String(axis.x),
      caesarYCosine: String(axis.y),
      caesarZCosine: String(axis.z),
    },
    ...component,
  };
}

function supportObject(component) {
  const scene = buildExportScene({ components: [component] });
  const object = scene.getObjectByName(component.id);
  assert.ok(object, `${component.id} should be present in GLB scene`);
  assert.equal(object.userData.directionalSupportEnhanced, true);
  assert.equal(object.userData.supportReferenceStyle, true);
  assert.ok(object.userData.directionalSupportSymbolCount > 0);
  assert.ok(object.userData.supportSymbolScale >= 22, `${component.id} should use visible engineering scale`);
  return object;
}

function child(object, name) {
  const found = object.getObjectByName(name);
  assert.ok(found, `${object.name} should contain ${name}`);
  return found;
}

function noChild(object, name) {
  const found = object.getObjectByName(name);
  assert.equal(found, undefined, `${object.name} should not contain ${name}`);
}

function collectRuntimeRoleMeshes(root, role) {
  const meshes = [];
  root.traverse((object) => {
    if (object.userData?.glbSupportSymbolRole !== role) return;
    object.traverse((childObject) => {
      if (childObject.isMesh) meshes.push(childObject);
    });
  });
  return meshes;
}

function referenceBase(object, id) {
  child(object, `${id}-directional-symbols`);
  child(object, `${id}-reference-base-pad`);
}

const guide = supportObject(support('GUIDE-X', 'GUIDE', { x: 1, y: 0, z: 0 }));
referenceBase(guide, 'GUIDE-X');
child(guide, 'GUIDE-X-guide-base');
child(guide, 'GUIDE-X-guide-reference-post');
child(guide, 'GUIDE-X-guide-bar-positive');
child(guide, 'GUIDE-X-guide-bar-negative');
child(guide, 'GUIDE-X-guide-axis-positive');
child(guide, 'GUIDE-X-guide-axis-positive-shaft');
child(guide, 'GUIDE-X-guide-axis-negative');
noChild(guide, 'GUIDE-X-rest-axis');
noChild(guide, 'GUIDE-X-guide-rest-axis');
assert.equal(guide.userData.supportKind, 'GUIDE');
assert.deepEqual(guide.userData.supportAxis, { x: 1, y: 0, z: 0 });

const guideY = supportObject(support('GUIDE-Y', 'GUIDE', { x: 0, y: 1, z: 0 }));
const guideYPositiveShaft = child(guideY, 'GUIDE-Y-guide-axis-positive-shaft');
assert.ok(
  Math.abs(guideYPositiveShaft.position.x) > Math.abs(guideYPositiveShaft.position.z),
  'export GUIDE with vertical source axis should fall back to lateral X, not axial Z',
);
noChild(guideY, 'GUIDE-Y-rest-axis');

const lineStop = supportObject(support('LS-Z', 'LINESTOP', { x: 0, y: 0, z: 1 }));
child(lineStop, 'LS-Z-linestop-plate-positive');
child(lineStop, 'LS-Z-linestop-plate-negative');
child(lineStop, 'LS-Z-linestop-axis-positive');
child(lineStop, 'LS-Z-linestop-axis-negative');
const lineStopPositiveShaft = child(lineStop, 'LS-Z-linestop-axis-positive-shaft');
assert.ok(
  Math.abs(lineStopPositiveShaft.position.x) > 0.1,
  'export LINESTOP should be offset from the pipe centerline',
);
assert.equal(lineStop.userData.supportKind, 'LINESTOP');

const lineStopX = supportObject(support('LS-X', 'LINESTOP', { x: 1, y: 0, z: 0 }));
child(lineStopX, 'LS-X-linestop-plate-positive');
child(lineStopX, 'LS-X-linestop-plate-negative');
const lineStopXPositiveShaft = child(lineStopX, 'LS-X-linestop-axis-positive-shaft');
assert.ok(
  Math.abs(lineStopXPositiveShaft.position.z) > 0.1,
  'export LINESTOP-X should be offset from the pipe centerline',
);
assert.ok(
  Math.abs(lineStopXPositiveShaft.position.x) > Math.abs(lineStopXPositiveShaft.position.z),
  'export LINESTOP-X should remain axial in X while offset in Z',
);

const limit = supportObject(support('LIMIT-X', 'LIMIT', { x: -1, y: 0, z: 0 }));
referenceBase(limit, 'LIMIT-X');
child(limit, 'LIMIT-X-reference-post');
child(limit, 'LIMIT-X-limit-stop-plate');
child(limit, 'LIMIT-X-limit-axis');
assert.equal(limit.userData.supportKind, 'LIMIT');
assert.deepEqual(limit.userData.supportAxis, { x: -1, y: 0, z: 0 });

const anchor = supportObject(support('ANCHOR', 'ANCHOR'));
referenceBase(anchor, 'ANCHOR');
child(anchor, 'ANCHOR-anchor-block');
for (let index = 1; index <= 6; index += 1) child(anchor, `ANCHOR-anchor-axis-${index}`);
assert.equal(anchor.userData.supportKind, 'ANCHOR');

const hanger = supportObject(support('HANGER', 'HANGER', { x: 0, y: 1, z: 0 }));
child(hanger, 'HANGER-hanger-rod');
child(hanger, 'HANGER-hanger-ring');
child(hanger, 'HANGER-hanger-load-axis');
assert.equal(hanger.userData.supportKind, 'HANGER');

const spring = supportObject(support('SPRING', 'SPRING', { x: 0, y: 1, z: 0 }));
child(spring, 'SPRING-hanger-rod');
child(spring, 'SPRING-hanger-ring');
assert.equal(spring.userData.supportKind, 'SPRING');

const rest = supportObject(support('REST-Y', 'REST', { x: 0, y: 1, z: 0 }));
referenceBase(rest, 'REST-Y');
child(rest, 'REST-Y-reference-post');
child(rest, 'REST-Y-rest-base');
child(rest, 'REST-Y-rest-axis');
assert.equal(rest.userData.supportKind, 'REST');

const largeGuide = supportObject(support('GUIDE-LARGE', 'GUIDE', { x: 1, y: 0, z: 0 }, { component: { bore: 300 } }));
assert.ok(largeGuide.userData.supportSymbolScale > guide.userData.supportSymbolScale);
child(largeGuide, 'GUIDE-LARGE-reference-base-pad');
noChild(largeGuide, 'GUIDE-LARGE-rest-axis');

const runtimeRoot = new THREE.Group();
const runtimeGuide = new THREE.Object3D();
runtimeGuide.name = 'RUNTIME-GUIDE';
runtimeGuide.userData = {
  supportKind: 'GUIDE',
  supportAxis: { x: 0, y: 1, z: 0 },
};
runtimeRoot.add(runtimeGuide);
const runtimeLineStop = new THREE.Object3D();
runtimeLineStop.name = 'RUNTIME-LINESTOP';
runtimeLineStop.position.set(100, 0, 0);
runtimeLineStop.userData = {
  supportKind: 'LINESTOP',
  supportAxis: { x: 0, y: 0, z: 1 },
};
runtimeRoot.add(runtimeLineStop);
const runtimeLineStopX = new THREE.Object3D();
runtimeLineStopX.name = 'RUNTIME-LINESTOP-X';
runtimeLineStopX.position.set(200, 0, 0);
runtimeLineStopX.userData = {
  supportKind: 'LINESTOP',
  supportAxis: { x: 1, y: 0, z: 0 },
};
runtimeRoot.add(runtimeLineStopX);
const runtimeScene = new THREE.Scene();
runtimeScene.add(runtimeRoot);
const runtimeStats = applyGlbSupportSymbols(runtimeRoot, runtimeScene, { scaleMultiplier: 1 });
assert.equal(runtimeStats.created, 3);

const runtimeSymbols = runtimeScene.getObjectByName('__GLB_SUPPORT_SYMBOLS_V3__');
assert.ok(runtimeSymbols, 'runtime support symbols root should be created');
const runtimeRoles = [];
runtimeSymbols.traverse((object) => {
  if (object.userData?.glbSupportSymbolRole) runtimeRoles.push(object.userData.glbSupportSymbolRole);
});
assert.equal(runtimeRoles.filter((role) => role === 'rest-axis').length, 0, 'runtime GUIDE must not emit a REST upward arrow');
assert.equal(runtimeRoles.filter((role) => role === 'guide-axis').length, 2, 'runtime GUIDE should emit two lateral guide arrows');
assert.equal(runtimeRoles.filter((role) => role === 'linestop-axis').length, 4, 'runtime LINESTOP should emit two axial line-stop arrows per line stop');

const runtimeGuideMeshes = collectRuntimeRoleMeshes(runtimeSymbols, 'guide-axis');
assert.ok(
  runtimeGuideMeshes.some((mesh) => Math.abs(mesh.position.x) > Math.abs(mesh.position.z)),
  'runtime GUIDE with vertical source axis should draw laterally instead of axially',
);

const runtimeLineStopMeshes = collectRuntimeRoleMeshes(runtimeSymbols, 'linestop-axis');
assert.ok(
  runtimeLineStopMeshes.some((mesh) => Math.abs(mesh.position.x - runtimeLineStop.position.x) > 0.1),
  'runtime LINESTOP-Z should be offset from the pipe centerline',
);
assert.ok(
  runtimeLineStopMeshes.some((mesh) => Math.abs(mesh.position.z - runtimeLineStopX.position.z) > 0.1),
  'runtime LINESTOP-X should be offset from the pipe centerline',
);

const fallbackScene = buildExportScene({
  components: [
    support('GUIDE-FALLBACK', 'GUIDE', { x: 1, y: 0, z: 0 }),
    support('LINESTOP-FALLBACK', 'LINESTOP', { x: 0, y: 0, z: 1 }),
    support('REST-FALLBACK', 'REST', { x: 0, y: 1, z: 0 }),
  ],
});
const fallbackRoot = fallbackScene.getObjectByName('PCF_EXPORT_ROOT');
const fallbackStats = applyGlbSupportSymbols(fallbackRoot, fallbackScene, { scaleMultiplier: 1 });
assert.equal(fallbackStats.created, 3);

const bakedByKind = new Map();
fallbackRoot.traverse((object) => {
  const shape = String(object.userData?.glbShape || '');
  if (!shape.startsWith('support-reference-v2-')) return;
  bakedByKind.set(shape.replace('support-reference-v2-', '').toUpperCase(), object);
});

assert.equal(bakedByKind.get('GUIDE')?.visible, false, 'GUIDE baked glyph should stay hidden after runtime replacement');
assert.equal(bakedByKind.get('GUIDE')?.userData.glbSupportBakedFallback, false);
assert.equal(bakedByKind.get('LINESTOP')?.visible, false, 'LINESTOP baked glyph should stay hidden after runtime replacement');
assert.equal(bakedByKind.get('LINESTOP')?.userData.glbSupportBakedFallback, false);
assert.equal(bakedByKind.get('REST')?.visible, false, 'REST baked glyph should stay hidden after runtime replacement');

console.log('inputxml-glb-directional-restraints.test.js passed');
