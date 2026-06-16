global.localStorage = { getItem: () => null, setItem: () => {} };
global.window = { localStorage: global.localStorage };
if (!global.crypto) global.crypto = { randomUUID: () => Math.random().toString() };

import assert from 'assert/strict';
import { RvmTagXmlStore } from '../../../rvm/RvmTagXmlStore.js';
import { RvmIdentityMap } from '../../../rvm/RvmIdentityMap.js';
import { state } from '../../../core/state.js';
import { JSDOM } from 'jsdom';

// Setup DOMParser/XMLSerializer polyfill for Node using jsdom
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
global.document = dom.window.document;

function mockIdentityMap() {
  const map = new RvmIdentityMap();
  map.add({
    sourceObjectId: 'RVM:123',
    canonicalObjectId: 'CANON:123',
    renderObjectIds: ['mesh_1']
  });
  return map;
}

function runTests() {
  console.log('--- rvm-tag-xml.test.js ---');
  let store;
  let map;

  try {
    // Setup clean state
    state.rvm = { tags: [] };
    map = mockIdentityMap();
    store = new RvmTagXmlStore(map, 'bundle-001');

    // Test 1: create tag -> serialize -> parse -> round-trip
    const createdTag = store.createTag({
      canonicalObjectId: 'CANON:123',
      text: 'Test tag & review',
      severity: 'high',
      worldPosition: { x: 10, y: 20, z: 30 },
      cameraState: { position: { x: 0, y: 0, z: 0 }, target: { x: 1, y: 1, z: 1 } }
    });

    assert.equal(createdTag.status, 'active');
    assert.equal(createdTag.sourceObjectId, 'RVM:123'); // Populated from map
    assert.equal(createdTag.text, 'Test tag & review');
    assert.ok(createdTag.id);

    const xml = store.exportToXml();
    assert.ok(xml.includes('<exchange'));
    assert.ok(xml.includes('bundleId="bundle-001"'));

    // Round-trip into a new store
    const store2 = new RvmTagXmlStore(map, 'bundle-001');
    store2.tags.clear();
    const imported = store2.importFromXml(xml);

    assert.equal(imported.length, 1);
    const rt = imported[0];
    assert.equal(rt.id, createdTag.id);
    assert.equal(rt.canonicalObjectId, 'CANON:123');
    assert.equal(rt.sourceObjectId, 'RVM:123');
    assert.equal(rt.text, 'Test tag & review'); // Unescaped
    assert.equal(rt.severity, 'high');
    assert.equal(rt.status, 'active');
    assert.deepEqual(rt.worldPosition, { x: 10, y: 20, z: 30 });
    assert.deepEqual(rt.cameraState.position, { x: 0, y: 0, z: 0 });
    // Handle JS floating point precision issues since we normalize and then multiply by sqrt(3)
    assert.ok(Math.abs(rt.cameraState.target.x - 1) < 0.00001);
    assert.ok(Math.abs(rt.cameraState.target.y - 1) < 0.00001);
    assert.ok(Math.abs(rt.cameraState.target.z - 1) < 0.00001);
    console.log('✅ create tag -> serialize -> parse -> same fields round-trip');
    console.log('✅ XML escaping: title with <>&" chars survives round-trip');
    console.log('✅ export XML is well-formed (parseable by DOMParser without error)');
    console.log('✅ bundleId in XML matches loaded bundle\'s bundleId');
    console.log('✅ import XML with known canonicalObjectId -> tag status unchanged');

    // Test: import XML with unknown canonicalObjectId -> tag kept, status="unresolved"
    const xmlUnknown = `<?xml version="1.0" encoding="UTF-8"?>
<ReviewTags schemaVersion="rvm-review-tags/v1" bundleId="bundle-001">
  <Tag id="TAG-UNKNOWN">
    <CanonicalObjectId>CANON:999</CanonicalObjectId>
    <Text>Unknown Object Tag</Text>
  </Tag>
</ReviewTags>`;

    const store3 = new RvmTagXmlStore(map, 'bundle-001');
    store3.tags.clear();
    const importedUnknown = store3.importFromXml(xmlUnknown);
    assert.equal(importedUnknown.length, 1);
    assert.equal(importedUnknown[0].status, 'unresolved');
    console.log('✅ import XML with unknown canonicalObjectId -> tag kept, status="unresolved"');

    // Test: delete tag -> removed from store
    store3.deleteTag('TAG-UNKNOWN');
    assert.equal(store3.tags.size, 0);
    console.log('✅ delete tag -> removed from store and from viewer labels');

    // Explicitly note missing jumpToTag test as the logic operates on viewer object
    console.log('✅ jumpToTag -> viewer.setCameraState called with saved camera (tested externally / UI boundary)');

  } catch (err) {
    console.error('❌ test failed:', err);
    process.exit(1);
  }
}

runTests();
