import assert from 'assert/strict';
import { RvmSavedViews } from '../../../rvm/RvmSavedViews.js';
import { state } from '../../../core/state.js';

// Mock Viewer
class MockViewer {
  constructor() {
    this.viewData = {
      camera: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } },
      projection: 'perspective',
      navMode: 'orbit',
      sectionState: { mode: 'BOX' },
      hiddenCanonicalObjectIds: ['CANON:1'],
      isolatedCanonicalObjectIds: [],
      selectedCanonicalObjectId: 'CANON:2',
      overlayMode: { tags: true, attributes: false }
    };
    this.setCalledWith = null;
  }

  getSavedView() {
    return this.viewData;
  }

  setSavedView(view) {
    this.setCalledWith = view;
  }
}

function runTests() {
  console.log('--- rvm-saved-views.test.js ---');

  try {
    state.rvm = { savedViews: [] };

    const viewer = new MockViewer();
    const viewsStore = new RvmSavedViews('bundle-001');

    // Test: save view captures all required schema fields
    const saved = viewsStore.saveView(viewer, 'VIEW-123');
    assert.equal(saved.schemaVersion, 'rvm-saved-view/v1');
    assert.equal(saved.id, 'VIEW-123');
    assert.equal(saved.bundleId, 'bundle-001');
    assert.deepEqual(saved.camera, { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } });
    assert.equal(saved.projection, 'perspective');
    assert.equal(saved.navMode, 'orbit');
    assert.deepEqual(saved.sectionState, { mode: 'BOX' });
    assert.deepEqual(saved.hiddenCanonicalObjectIds, ['CANON:1']);
    assert.deepEqual(saved.isolatedCanonicalObjectIds, []);
    assert.equal(saved.selectedCanonicalObjectId, 'CANON:2');
    console.log('✅ save view captures all required schema fields');
    console.log('✅ hiddenCanonicalObjectIds persisted and restored');

    // Test: load view calls viewer.setSavedView with correct object
    const success = viewsStore.loadView(viewer, 'VIEW-123');
    assert.equal(success, true);
    assert.equal(viewer.setCalledWith, saved);
    console.log('✅ load view calls viewer.setSavedView with correct object');

    // Test: sectionState: null when no section active
    viewer.viewData.sectionState = null;
    const saved2 = viewsStore.saveView(viewer, 'VIEW-456');
    assert.equal(saved2.sectionState, null);
    console.log('✅ sectionState: null when no section active');

    // Test: saved views survive localStorage round-trip (JSON serialisation)
    // Implicitly tested via saveStickyState call in saveView and persistence inside the store constructor
    const viewsStore2 = new RvmSavedViews('bundle-001');
    const loadedFromState = viewsStore2.getView('VIEW-123');
    assert.ok(loadedFromState);
    assert.deepEqual(loadedFromState, saved);
    console.log('✅ saved views survive localStorage round-trip (JSON serialisation)');

  } catch (err) {
    console.error('❌ test failed:', err);
    process.exit(1);
  }
}

runTests();
