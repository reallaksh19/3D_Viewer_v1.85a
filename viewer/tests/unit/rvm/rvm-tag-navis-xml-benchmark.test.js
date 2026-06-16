global.localStorage = { getItem: () => null, setItem: () => {} };
global.window = { localStorage: global.localStorage };

if (!global.crypto) {
  global.crypto = { randomUUID: () => 'test-random-uuid' };
}

import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

import { RvmTagXmlStore } from '../../../rvm/RvmTagXmlStore.js';
import { state } from '../../../core/state.js';

const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
global.document = dom.window.document;

function parseXml(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError) {
    throw new Error(parseError.textContent);
  }

  return doc;
}

function count(xml, rx) {
  return (xml.match(rx) || []).length;
}

function run() {
  console.log('--- rvm-tag-navis-xml-benchmark.test.js ---');

  state.rvm = { tags: [] };

  const benchmarkPath = path.resolve(
    'Benchmarks',
    'Navis XML',
    'Benchmark Tag xml file.xml'
  );

  assert.ok(fs.existsSync(benchmarkPath), `Missing benchmark: ${benchmarkPath}`);

  const xml = fs.readFileSync(benchmarkPath, 'utf-8');
  const expectedViewCount = count(xml, /<view\b/g);
  const expectedRltagCount = count(xml, /<rltag\b/g);
  const expectedCommentCount = count(xml, /<comment\b/g);

  assert.ok(expectedViewCount > 0, 'benchmark should contain Navis view nodes');
  assert.ok(expectedRltagCount > 0, 'benchmark should contain Navis rltag nodes');
  assert.ok(expectedCommentCount > 0, 'benchmark should contain comments');

  const store = new RvmTagXmlStore(null, 'bundle-navis-test');
  const imported = store.importFromXml(xml);

  assert.equal(imported.length, expectedRltagCount, 'must import one tag per Navis rltag');
  assert.equal(store.getAllTags().length, expectedRltagCount);

  const first = imported[0];

  assert.ok(first.id, 'imported tag must have id');
  assert.equal(first.anchorType, 'navis-redline-tag');
  assert.equal(first.status, 'active');
  assert.equal(first.text, 'Model monofl ball valve (typ)');
  assert.deepEqual(first.worldPosition, {
    x: 151.7639234984,
    y: 125.0518443733,
    z: 101.6344626546,
  });

  assert.ok(first.cameraState, 'camera state should be imported');
  assert.deepEqual(first.cameraState.position, {
    x: 152.1668779015,
    y: 127.1326354411,
    z: 102.176108292,
  });

  assert.deepEqual(first.cameraState.rotationQuaternion, {
    a: 0.1280697311,
    b: 0.5955538475,
    c: 0.7753167319,
    d: 0.1667264946,
  });

  assert.ok(first.navis, 'Navis metadata should be preserved');
  assert.equal(first.navis.rootAttrs.units, 'm');
  assert.equal(first.navis.comment.user, 'muc5407');
  assert.equal(first.navis.comment.id, '1');
  assert.equal(first.navis.redline.attrs.thickness, '3');
  assert.equal(first.navis.redline.attrs.pattern, '65535');
  assert.deepEqual(first.navis.redline.colour, {
    red: 1,
    green: 0,
    blue: 0,
  });
  assert.ok(first.navis.redline.bounds, 'rltag bounds should be preserved');

  const exported = store.exportToXml();
  const exportedDoc = parseXml(exported);

  assert.equal(exportedDoc.documentElement.tagName, 'exchange');
  assert.equal(exportedDoc.documentElement.getAttribute('units'), 'm');
  assert.equal(exportedDoc.querySelectorAll('view').length, expectedRltagCount);
  assert.equal(exportedDoc.querySelectorAll('rltag').length, expectedRltagCount);
  assert.equal(exportedDoc.querySelectorAll('comments comment').length, expectedRltagCount);

  const firstExportedBody = exportedDoc.querySelector('comments comment body')?.textContent;
  assert.equal(firstExportedBody, 'Model monofl ball valve (typ)');

  const firstExportedPos3d = exportedDoc.querySelector('redlines rltag pos3d pos3f');
  assert.equal(firstExportedPos3d.getAttribute('x'), '151.7639234984');
  assert.equal(firstExportedPos3d.getAttribute('y'), '125.0518443733');
  assert.equal(firstExportedPos3d.getAttribute('z'), '101.6344626546');

  const firstExportedQuat = exportedDoc.querySelector('viewpoint camera rotation quaternion');
  assert.equal(firstExportedQuat.getAttribute('a'), '0.1280697311');
  assert.equal(firstExportedQuat.getAttribute('b'), '0.5955538475');
  assert.equal(firstExportedQuat.getAttribute('c'), '0.7753167319');
  assert.equal(firstExportedQuat.getAttribute('d'), '0.1667264946');

  const store2 = new RvmTagXmlStore(null, 'bundle-navis-test');
  store2.tags.clear();

  const importedAgain = store2.importFromXml(exported);

  assert.equal(importedAgain.length, expectedRltagCount);
  assert.equal(importedAgain[0].text, 'Model monofl ball valve (typ)');
  assert.deepEqual(importedAgain[0].worldPosition, first.worldPosition);
  assert.deepEqual(
    importedAgain[0].cameraState.rotationQuaternion,
    first.cameraState.rotationQuaternion
  );

  console.log('[PASS] Navis XML benchmark import/export passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Navis XML benchmark import/export failed.');
  console.error(error);
  process.exit(1);
}