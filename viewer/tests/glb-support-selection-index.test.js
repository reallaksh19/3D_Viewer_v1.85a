import assert from 'node:assert/strict';
import * as THREE from 'three';

import { resolveInspectableObject } from '../js/pcf2glb/advanced/createSelection.js';
import { buildSceneIndex } from '../js/pcf2glb/advanced/sceneIndex.js';

const root = new THREE.Group();
root.name = 'ROOT';

const support = new THREE.Object3D();
support.name = 'SUP-1';
support.userData = {
  pcfId: 'SUP-1',
  pcfType: 'SUPPORT',
  supportKind: 'GUIDE',
};
root.add(support);

const baked = new THREE.Group();
baked.name = 'SUP-1-directional-symbols';
baked.visible = false;
baked.userData = {
  glbShape: 'support-reference-v2-guide',
  supportKind: 'GUIDE',
};
const bakedChild = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial(),
);
bakedChild.name = 'SUP-1-guide-bar-positive';
baked.add(bakedChild);
root.add(baked);

const runtimeSymbol = new THREE.Group();
runtimeSymbol.name = 'glb-support-guide-SUP-1';
runtimeSymbol.userData = {
  glbSupportSymbol: true,
  glbSupportSymbolKind: 'GUIDE',
  pcfId: 'SUP-1',
  pcfType: 'SUPPORT',
  supportKind: 'GUIDE',
};
const runtimeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial(),
);
runtimeMesh.name = 'runtime-guide-bar';
runtimeMesh.userData = { glbSupportSymbolMesh: true };
runtimeSymbol.add(runtimeMesh);
root.add(runtimeSymbol);

const lineStopSymbol = new THREE.Group();
lineStopSymbol.name = 'glb-support-linestop-SUP-1';
lineStopSymbol.userData = {
  glbSupportSymbol: true,
  glbSupportSymbolKind: 'LINESTOP',
  pcfId: 'SUP-1',
  pcfType: 'SUPPORT',
  supportKind: 'LINESTOP',
};
const lineStopMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial(),
);
lineStopMesh.name = 'runtime-linestop-axis-positive';
lineStopMesh.userData = { glbSupportSymbolMesh: true };
lineStopSymbol.add(lineStopMesh);
root.add(lineStopSymbol);

assert.equal(resolveInspectableObject(runtimeMesh), runtimeSymbol);
assert.equal(resolveInspectableObject(lineStopMesh), lineStopSymbol);
assert.equal(resolveInspectableObject(bakedChild), null);

const index = buildSceneIndex(root);
assert.ok(index.byId.has('SUP-1'), 'semantic support should remain indexed');
assert.equal(index.byId.has('SUP-1-guide-bar-positive'), false, 'hidden baked guide child should not be indexed');
assert.equal(index.byId.has('runtime-guide-bar'), false, 'runtime GUIDE mesh internals should not be indexed');
assert.equal(index.byId.has('runtime-linestop-axis-positive'), false, 'runtime LINESTOP mesh internals should not be indexed');

console.log('glb-support-selection-index.test.js passed');
