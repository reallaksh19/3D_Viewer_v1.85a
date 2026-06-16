import assert from 'node:assert/strict';

import {
  buildCaesarAnnotationCoreObject,
  buildCaesarAnnotationSidecar,
  CAESAR_ANNOTATION_CORE_SCHEMA,
  CAESAR_ANNOTATION_SIDECAR_SCHEMA,
  createCaesarAnnotationMarkers,
  prepareCaesarAnnotationCoreModel,
} from '../js/pcf2glb/glb/caesar/CaesarAnnotationCore.js';

function pipe(id, fromNode, toNode, start, end) {
  return {
    id,
    type: 'PIPE',
    fromNode: String(fromNode),
    toNode: String(toNode),
    start,
    end,
    attributes: {
      FROM_NODE: String(fromNode),
      TO_NODE: String(toNode),
    },
    raw: {
      FROM_NODE: String(fromNode),
      TO_NODE: String(toNode),
    },
  };
}

const model = {
  schema: 'bm-cii-sidecar-integrity-fixture/v1',
  nodes: {
    10: { x: 0, y: 0, z: 0 },
    35: { x: 1000, y: 0, z: 0 },
    130: { x: 2000, y: 0, z: 0 },
    205: { x: 1000, y: 750, z: 0 },
    255: { x: 2000, y: 750, z: 0 },
  },
  components: [
    pipe('P-10-35', 10, 35, { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }),
    pipe('P-35-130', 35, 130, { x: 1000, y: 0, z: 0 }, { x: 2000, y: 0, z: 0 }),
    pipe('P-35-205', 35, 205, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 750, z: 0 }),
    pipe('P-205-255', 205, 255, { x: 1000, y: 750, z: 0 }, { x: 2000, y: 750, z: 0 }),
  ],
  isonotes: [
    { node: '35', note: "/PS-NEW SUPPORT :/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(1715kN)'" },
    { node: '130', note: "/PS-NEW SUPPORT :ISONOTE 'REST NOT DEFINED-'" },
    { node: '205', note: "/PS-NEW SUPPORT :/PS-456 :ISONOTE 'REST(10kN), HOLDDOWN,LINE STOP(6kN), Holddown without Guide Can Spring'" },
    { node: '255', note: "/PS-NEW SUPPORT :ISONOTE 'REST(3kN), GUIDE(1kN)'" },
  ],
  supportsInputXml: Array.from({ length: 12 }, (_, i) => ({ id: `XML-SUP-${i + 1}` })),
  supportsIsonote: Array.from({ length: 11 }, (_, i) => ({ id: `ISO-SUP-${i + 1}` })),
};

const options = {
  mode: 'robust-lowpoly-vector',
  nodeLabelMode: 'off',
  maxIsonoteCallouts: 4,
  mergeMarkers: true,
};

const result = createCaesarAnnotationMarkers(model, options);
assert.equal(result.stats.schema, CAESAR_ANNOTATION_CORE_SCHEMA);
assert.equal(result.stats.mode, 'robust-lowpoly-vector');
assert.equal(result.stats.isonoteCalloutCount, 4);
assert.equal(result.stats.nodeLabelCount, 0);
assert.equal(result.sidecar.schema, CAESAR_ANNOTATION_SIDECAR_SCHEMA);
assert.equal(result.sidecar.calloutCount, 4);
assert.deepEqual(result.sidecar.callouts.map((callout) => callout.node), ['35', '130', '205', '255']);
assert.deepEqual(result.sidecar.callouts.map((callout) => callout.no), [1, 2, 3, 4]);
assert.deepEqual(result.sidecar.nodeCalloutMap, {
  35: 1,
  130: 2,
  205: 3,
  255: 4,
});

const callout35 = result.sidecar.callouts.find((callout) => callout.node === '35');
assert.ok(callout35.text.includes('REST(28kN)'));
assert.ok(callout35.supportTokens.some((token) => token.kind === 'REST' && token.load === '28kN'));
assert.ok(callout35.supportTokens.some((token) => token.kind === 'GUIDE' && token.load === '6kN'));
assert.ok(callout35.supportTokens.some((token) => token.kind === 'LINESTOP' && token.load === '1715kN'));

const callout130 = result.sidecar.callouts.find((callout) => callout.node === '130');
assert.ok(callout130.supportTokens.some((token) => token.kind === 'UNKNOWN' && token.warning === 'REST_NOT_DEFINED'));

const object = buildCaesarAnnotationCoreObject(model, options);
assert.equal(object.userData.caesarAnnotationCoreSchema, CAESAR_ANNOTATION_CORE_SCHEMA);
assert.equal(object.userData.caesarAnnotationSidecarSchema, CAESAR_ANNOTATION_SIDECAR_SCHEMA);
assert.equal(object.userData.caesarAnnotationSidecar.calloutCount, 4);
assert.deepEqual(object.userData.caesarAnnotationNodeCalloutMap, {
  35: 1,
  130: 2,
  205: 3,
  255: 4,
});
assert.equal(object.userData.caesarAnnotationCallouts.length, 4);

const sidecar = buildCaesarAnnotationSidecar(result, options);
assert.equal(sidecar.schema, CAESAR_ANNOTATION_SIDECAR_SCHEMA);
assert.equal(sidecar.calloutCount, 4);
assert.equal(sidecar.nodeLabelCount, 0);
assert.equal(sidecar.callouts[0].position.x !== undefined, true);
assert.equal(sidecar.callouts[0].leaderStart.x !== undefined, true);
assert.equal(sidecar.callouts[0].leaderEnd.x !== undefined, true);

const prepared = prepareCaesarAnnotationCoreModel(model, options);
assert.equal(prepared.caesarAnnotationSidecar.schema, CAESAR_ANNOTATION_SIDECAR_SCHEMA);
assert.equal(prepared.caesarAnnotationSidecar.calloutCount, 4);
assert.equal(prepared.caesarAnnotationCallouts.length, 4);
assert.deepEqual(prepared.caesarAnnotationNodeCalloutMap, {
  35: 1,
  130: 2,
  205: 3,
  255: 4,
});
assert.equal(model.supportsInputXml.length, 12);
assert.equal(model.supportsIsonote.length, 11);

const missingNodeResult = createCaesarAnnotationMarkers({
  ...model,
  nodes: { 35: model.nodes[35] },
}, options);
assert.equal(missingNodeResult.sidecar.calloutCount, 1);
assert.ok(missingNodeResult.diagnostics.some((item) => item.code === 'CAESAR_ANNOTATION_NODE_NOT_FOUND'));
