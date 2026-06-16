import assert from 'assert/strict';
import { beforeAll, describe, it, vi } from 'vitest';

vi.mock('three', () => ({
  default: {},
  Vector3: class {},
  Group: class {},
  Mesh: class {},
  MeshStandardMaterial: class {},
  SphereGeometry: class {},
  CylinderGeometry: class {},
  BoxGeometry: class {},
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {},
}));

let parsePcfText;
let normalizePcfModel;
let pcfxDocumentFromPcfText;
let pcfTextFromCanonicalItems;
let viewerComponentFromCanonicalItem;

beforeAll(async () => {
  ({ parsePcfText } = await import('../../../js/pcf2glb/pcf/parsePcfText.js'));
  ({ normalizePcfModel } = await import('../../../js/pcf2glb/pcf/normalizePcfModel.js'));
  ({ pcfxDocumentFromPcfText, pcfTextFromCanonicalItems } = await import('../../../pcfx/Pcfx_PcfAdapter.js'));
  ({ viewerComponentFromCanonicalItem } = await import('../../../pcfx/Pcfx_GlbAdapter.js'));
});

function findCanonicalItem(doc, refNo) {
  return doc.canonical.items.find((item) => item.refNo === refNo);
}

describe('PCF -> JSON TEE/OLET branch geometry', () => {
  it('preserves the third port through normalization, canonical conversion, and viewer mapping', () => {
    const pcfText = [
      'PIPELINE-REFERENCE TEST-LINE',
      '',
      'TEE',
      '    END-POINT  0 0 0 200',
      '    END-POINT  1000 0 0 200',
      '    END-POINT  500 500 0 100',
      '    COMPONENT-IDENTIFIER  TEE-001',
      '    COMPONENT-ATTRIBUTE98  10',
      '    SKEY  TEBW',
      '',
      'OLET',
      '    CENTRE-POINT  2500 0 0',
      '    END-POINT  2000 0 0 250',
      '    END-POINT  3000 0 0 250',
      '    END-POINT  2500 400 0 80',
      '    COMPONENT-IDENTIFIER  OLET-001',
      '    COMPONENT-ATTRIBUTE98  20',
      '    SKEY  OLWL',
      '',
    ].join('\n');

    const parsed = parsePcfText(pcfText, null);
    const normalized = normalizePcfModel(parsed, null);
    const teeModel = normalized.components.find((item) => item.type === 'TEE' && item.attributes['COMPONENT-IDENTIFIER'] === 'TEE-001');
    const oletModel = normalized.components.find((item) => item.type === 'OLET' && item.attributes['COMPONENT-IDENTIFIER'] === 'OLET-001');

    assert.ok(teeModel, 'TEE model must be present');
    assert.ok(oletModel, 'OLET model must be present');

    assert.deepEqual(teeModel.ep1, { x: 0, y: 0, z: 0, bore: 200 });
    assert.deepEqual(teeModel.ep2, { x: 1000, y: 0, z: 0, bore: 200 });
    assert.deepEqual(teeModel.bp, { x: 500, y: 500, z: 0, bore: 100 });

    assert.deepEqual(oletModel.ep1, { x: 2000, y: 0, z: 0, bore: 250 });
    assert.deepEqual(oletModel.ep2, { x: 3000, y: 0, z: 0, bore: 250 });
    assert.deepEqual(oletModel.bp, { x: 2500, y: 400, z: 0, bore: 80 });

    const doc = pcfxDocumentFromPcfText(pcfText, 'tee-olet.pcf', {}, null);
    const teeItem = findCanonicalItem(doc, 'TEE-001');
    const oletItem = findCanonicalItem(doc, 'OLET-001');

    assert.ok(teeItem, 'TEE canonical item must be present');
    assert.ok(oletItem, 'OLET canonical item must be present');
    assert.deepEqual(teeItem.bp, { x: 500, y: 500, z: 0, bore: 100 });
    assert.deepEqual(teeItem.branchPoint, { x: 500, y: 500, z: 0, bore: 100 });
    assert.deepEqual(oletItem.bp, { x: 2500, y: 400, z: 0, bore: 80 });
    assert.deepEqual(oletItem.branchPoint, { x: 2500, y: 400, z: 0, bore: 80 });

    const teeViewer = viewerComponentFromCanonicalItem(teeItem);
    const oletViewer = viewerComponentFromCanonicalItem(oletItem);

    assert.equal(teeViewer.points.length, 3, 'TEE viewer component must keep the third port');
    assert.equal(oletViewer.points.length, 3, 'OLET viewer component must keep the third port');
    assert.deepEqual(teeViewer.branch1Point, { x: 500, y: 500, z: 0, bore: 100 });
    assert.deepEqual(teeViewer.branchPoint, { x: 500, y: 500, z: 0, bore: 100 });
    assert.deepEqual(oletViewer.branch1Point, { x: 2500, y: 400, z: 0, bore: 80 });
    assert.deepEqual(oletViewer.branchPoint, { x: 2500, y: 400, z: 0, bore: 80 });

    const roundTrip = pcfTextFromCanonicalItems(doc.canonical.items, {
      metadata: doc.metadata,
      defaults: {},
    });

    assert.ok(roundTrip.includes('BRANCH1-POINT'), 'Round-tripped PCF must emit BRANCH1-POINT');
  });
});
