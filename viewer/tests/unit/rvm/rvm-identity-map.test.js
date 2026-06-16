import assert from 'assert/strict';
import { RvmIdentityMap } from '../../../rvm/RvmIdentityMap.js';

const NODES = [
  {
    sourceObjectId: 'RVM:100',
    canonicalObjectId: 'RVM:100',
    renderObjectIds: ['mesh_0', 'mesh_1'],
    parentCanonicalObjectId: null,
    name: 'PIPE-A',
    path: '/AREA1/PIPE-A',
    kind: 'pipe',
    attributes: { NPD: '6in' },
  },
  {
    sourceObjectId: 'RVM:200',
    canonicalObjectId: 'RVM:200',
    renderObjectIds: ['mesh_2'],
    parentCanonicalObjectId: 'RVM:100',
    name: 'ELBOW-01',
    path: '/AREA1/PIPE-A/ELBOW-01',
    kind: 'fitting',
    attributes: {},
  },
];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exit(1);
  }
}

// ✅ sourceId → canonicalId → renderIds lookup works
test('sourceId → canonicalId → renderIds lookup works', () => {
  const map = RvmIdentityMap.fromNodes(NODES);
  const entry = map.lookupBySource('RVM:100');
  assert.ok(entry);
  assert.equal(entry.canonicalObjectId, 'RVM:100');
  assert.deepEqual(entry.renderObjectIds, ['mesh_0', 'mesh_1']);
});

// ✅ unknown sourceId returns null without throw
test('unknown sourceId returns null without throw', () => {
  const map = RvmIdentityMap.fromNodes(NODES);
  const result = map.lookupBySource('RVM:NONEXISTENT');
  assert.equal(result, null);
});

// ✅ renderIds array may contain multiple entries
test('renderIds array may contain multiple entries', () => {
  const map = RvmIdentityMap.fromNodes(NODES);
  const ids = map.renderIdsFromCanonical('RVM:100');
  assert.equal(ids.length, 2);
  assert.ok(ids.includes('mesh_0'));
  assert.ok(ids.includes('mesh_1'));
});

// ✅ Phase-1 passthrough: canonicalId === sourceId when no remap
test('Phase-1 passthrough: canonicalId === sourceId when no remap', () => {
  const map = RvmIdentityMap.fromNodes(NODES);
  for (const node of NODES) {
    const entry = map.lookupByCanonical(node.canonicalObjectId);
    assert.ok(entry);
    assert.equal(entry.canonicalObjectId, entry.sourceObjectId);
  }
});

// ✅ renderObjectId → canonical resolution
test('renderObjectId resolves to correct canonicalObjectId', () => {
  const map = RvmIdentityMap.fromNodes(NODES);
  assert.equal(map.canonicalFromRender('mesh_2'), 'RVM:200');
  assert.equal(map.canonicalFromRender('mesh_0'), 'RVM:100');
});

console.log('✅ rvm-identity-map unit tests passed.');
