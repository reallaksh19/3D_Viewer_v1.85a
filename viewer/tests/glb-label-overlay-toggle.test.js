import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  collectGlbLabelAnchors,
  DEFAULT_GLB_LABEL_VISIBILITY,
  shouldShowGlbLabelKind,
  summarizeGlbLabels,
} from '../js/pcf2glb/advanced/glbLabelOverlay.js';

// --- shouldShowGlbLabelKind ---

assert.equal(shouldShowGlbLabelKind('node', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('support', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('tee', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('terminal', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('valve', DEFAULT_GLB_LABEL_VISIBILITY), false);
assert.equal(shouldShowGlbLabelKind('flange', DEFAULT_GLB_LABEL_VISIBILITY), false);
assert.equal(shouldShowGlbLabelKind('component', DEFAULT_GLB_LABEL_VISIBILITY), false);

const noNodes = { ...DEFAULT_GLB_LABEL_VISIBILITY, node: false };
assert.equal(shouldShowGlbLabelKind('node', noNodes), false);
assert.equal(shouldShowGlbLabelKind('support', noNodes), true);

const onlyNodes = Object.fromEntries(Object.keys(DEFAULT_GLB_LABEL_VISIBILITY).map((key) => [key, false]));
onlyNodes.node = true;
assert.equal(shouldShowGlbLabelKind('node', onlyNodes), true);
assert.equal(shouldShowGlbLabelKind('support', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('valve', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('unknown-kind', onlyNodes), false);

// --- collectGlbLabelAnchors scene setup ---

const root = new THREE.Group();

// Valve with explicit label anchor - sub-meshes must NOT produce duplicate fallback
const valve = new THREE.Group();
valve.name = 'VALVE-TEST';
valve.userData = {
  pcfId: 'VALVE-TEST',
  glbShape: 'valve-body-handwheel',
  labelText: 'VALVE-TEST',
};

const valveBody = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
valveBody.name = 'VALVE-TEST-valve-body';
valveBody.position.set(1, 0, 0);
valveBody.userData = { ...valve.userData };

const valveWheel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
valveWheel.name = 'VALVE-TEST-valve-handwheel';
valveWheel.position.set(2, 0, 0);
valveWheel.userData = { ...valve.userData };

const valveLabelAnchor = new THREE.Object3D();
valveLabelAnchor.name = 'label:VALVE-TEST';
valveLabelAnchor.position.set(0, 5, 0);
valveLabelAnchor.userData = { ...valve.userData, labelAnchor: true };

valve.add(valveBody, valveWheel, valveLabelAnchor);
root.add(valve);

// Pseudo node label with SUPPORT_POINT - must be rejected
const noisyNode = new THREE.Object3D();
noisyNode.name = 'node-label:IX-A-IX-PE-00001-SUP-1-SUPPORT_POINT';
noisyNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'IX-A-IX-PE-00001-SUP-1-SUPPORT_POINT',
};
root.add(noisyNode);

// Clean explicit node label - must be accepted and cleaned to "205"
const cleanNode = new THREE.Object3D();
cleanNode.name = 'node-label:205';
cleanNode.position.set(3, 0, 0);
cleanNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'NODE 205',
};
root.add(cleanNode);

// Complex node label via full piping reference - must be cleaned to "210"
const complexNode = new THREE.Object3D();
complexNode.name = 'node-label:IX-A-IX-PE-00001-NODE-210';
complexNode.position.set(10, 0, 0);
complexNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'IX-A-IX-PE-00001-NODE-210',
};
root.add(complexNode);

// IX pipe-endpoint format must strip endpoint suffixes and normalize to "1"
const epNode = new THREE.Object3D();
epNode.name = 'node-label:IX-A-IX-PE-00001-EP1';
epNode.position.set(15, 0, 0);
epNode.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'IX-A-IX-PE-00001-EP1',
};
root.add(epNode);

// Nearby matching endpoint label must dedupe by clean text + rounded position cluster.
const epNodeDuplicate = new THREE.Object3D();
epNodeDuplicate.name = 'node-label:IX-A-IX-PE-00001-EP2';
epNodeDuplicate.position.set(16, 0, 0);
epNodeDuplicate.userData = {
  labelAnchor: true,
  labelKind: 'node',
  glbShape: 'node-label-anchor',
  labelText: 'IX-A-IX-PE-00001-EP2',
};
root.add(epNodeDuplicate);

// Non-anchored flange mesh - qualifies for Stage B fallback collection
const nakedFlange = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
nakedFlange.name = 'FLANGE-001';
nakedFlange.userData = {
  pcfId: 'FLANGE-001',
  glbShape: 'flange-ring-pair',
  labelText: 'FLANGE-001',
};
root.add(nakedFlange);

// Non-anchored pipe mesh - must NOT be collected (no known component type)
const pipeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
pipeMesh.name = 'PIPE-SEGMENT';
pipeMesh.userData = {
  glbShape: 'pipe-segment',
  labelText: 'PIPE-SEGMENT',
};
root.add(pipeMesh);

// --- collectGlbLabelAnchors assertions ---

const labels = collectGlbLabelAnchors(root);

// Explicit anchors: VALVE-TEST (from valveLabelAnchor), 205 (cleanNode), 210 (complexNode)
// Stage B fallback: FLANGE-001 (nakedFlange - flange shape qualifies)
// Rejected: noisyNode (SUPPORT_POINT), pipeMesh (plain pipe, no component type)
// Explicit anchors: VALVE-TEST, "205" (from "NODE 205"), "210" (from IX-...-NODE-210),
// "1" (from IX-A-IX-PE-00001-EP1/EP2)
// Stage B fallback: nakedFlange -> "FLANGE-001"
// Rejected: noisyNode (SUPPORT_POINT), pipeMesh (plain pipe, unclassified)
assert.equal(labels.length, 5, 'collector should keep 4 explicit anchors + 1 flange fallback');

const texts = labels.map((l) => l.text).sort();
assert.deepEqual(texts, ['1', '205', '210', 'FLANGE-001', 'VALVE-TEST'].sort());
assert.ok(labels.find((l) => l.text === 'VALVE-TEST'), 'valve label must exist');
assert.ok(labels.find((l) => l.text === '205'), '205 node label must exist');
assert.ok(labels.find((l) => l.text === '210'), '210 node label must exist');
assert.ok(labels.find((l) => l.text === '1'), 'clean endpoint node label must exist');
assert.ok(labels.find((l) => l.text === 'FLANGE-001'), 'flange fallback label must exist');

assert.equal(labels.find((l) => l.text === 'VALVE-TEST')?.kind, 'valve', 'VALVE-TEST must be valve kind');
assert.equal(labels.find((l) => l.text === '205')?.kind, 'node', '205 must be node kind');
assert.equal(labels.find((l) => l.text === '210')?.kind, 'node', '210 must be node kind');
assert.equal(labels.find((l) => l.text === '1')?.kind, 'node', 'clean endpoint label must be node kind');

const nodeLabelCount = labels.filter((l) => l.kind === 'node').length;
assert.equal(nodeLabelCount, 3, 'should have 3 node labels');
const flangeLabelCount = labels.filter((l) => l.kind === 'flange').length;
assert.equal(flangeLabelCount, 1, 'should have 1 flange fallback label');

// --- Valve sub-meshes must dedupe to single label via explicit anchor ---
// (valveBody and valveWheel share pcfId 'VALVE-TEST' - only the explicit anchor should appear)
const valveLabels = labels.filter((l) => l.text === 'VALVE-TEST');
assert.equal(valveLabels.length, 1, 'valve sub-meshes must dedupe to one label');

// --- Default visibility ---
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.node, true);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.support, true);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.tee, true);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.terminal, true);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.valve, false);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.flange, false);
assert.equal(DEFAULT_GLB_LABEL_VISIBILITY.component, false);

console.log('glb-label-overlay-toggle.test.js passed');
