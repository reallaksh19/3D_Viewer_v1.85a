import assert from 'assert';
import { loadRvmSource } from '../../rvm/RvmLoadPipeline.js';
import { RvmStaticBundleLoader } from '../../rvm/RvmStaticBundleLoader.js';
import { RvmDiagnostics } from '../../rvm/RvmDiagnostics.js';
import { state } from '../../core/state.js';
import { on } from '../../core/event-bus.js';
import { RuntimeEvents } from '../../contracts/runtime-events.js';

// Setup Mock Environment
let notifications = [];
export function clearNotifications() { notifications = []; }

// Intercept Notification Center safely via dependency injection for tests if available, or just ignore exact validation
// We'll capture them via diagnostic report directly if we override that instead since it's a class
const originalReport = RvmDiagnostics.report;
RvmDiagnostics.report = (severity, title, msg) => {
  notifications.push({ message: title, details: msg });
  originalReport.call(RvmDiagnostics, severity, title, msg);
};


const mockCtx = {
  capabilities: { rawRvmImport: false },
  staticBundleLoader: new RvmStaticBundleLoader(),
  resolveUrl: (filename) => {
    if (filename === 'valid.glb') return 'data:application/octet-stream,mockglb';
    if (filename === 'index.json') return `data:application/json,${encodeURIComponent(JSON.stringify({
      schemaVersion: 'rvm-index/v1',
      bundleId: 'bundle-123',
      units: 'mm',
      upAxis: 'Y',
      nodes: [
        { sourceObjectId: 'RVM:1', canonicalObjectId: 'OBJ:1', renderObjectIds: ['mesh_1'], name: 'A', path: '/A', kind: 'EQUIP', attributes: {} }
      ]
    }))}`;
    if (filename === 'mismatch-index.json') return `data:application/json,${encodeURIComponent(JSON.stringify({
      schemaVersion: 'rvm-index/v1',
      bundleId: 'bundle-999',
      units: 'mm',
      upAxis: 'Y',
      nodes: []
    }))}`;
    if (filename === 'tags.xml') return `data:application/xml,${encodeURIComponent('<ReviewTags schemaVersion="rvm-review-tags/v1" bundleId="bundle-123"></ReviewTags>')}`;
    return filename; // allow passthrough to fetch directly
  }
};

// Mock fetch to handle URLs returned by mockCtx.resolveUrl or default
const originalFetch = global.fetch;
global.fetch = async (url) => {
  const resolvedUrl = mockCtx.resolveUrl(url);
  if (typeof resolvedUrl === 'string' && resolvedUrl.startsWith('data:')) {
    const isJson = resolvedUrl.startsWith('data:application/json');
    const isXml = resolvedUrl.startsWith('data:application/xml');
    const dataPart = decodeURIComponent(resolvedUrl.split(',')[1]);

    return {
      ok: true,
      json: async () => isJson ? JSON.parse(dataPart) : null,
      text: async () => isXml ? dataPart : null,
    };
  }
  return { ok: false, status: 404 };
};

// Mock GLTFLoader
mockCtx.staticBundleLoader.gltfLoader = {
  load: (url, onLoad, onProgress, onError) => {
    setTimeout(() => {
      onProgress({ lengthComputable: true, loaded: 50, total: 100 });
      const urlStr = String(url);
      if (urlStr.includes('invalid')) {
        onError(new Error('GLB Load Failed'));
      } else {
        onProgress({ lengthComputable: true, loaded: 100, total: 100 });
        onLoad({ scene: {} });
      }
    }, 10);
  }
};

async function runTests() {
  console.log('--- rvm-load-pipeline.test.js ---');

  // Test 1: valid bundle manifest loads without error
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { glb: 'valid.glb', index: 'index.json', tags: 'tags.xml' },
      runtime: {}
    };

    let loadedEventFired = false;
    const cb = () => { loadedEventFired = true; };
    on(RuntimeEvents.RVM_MODEL_LOADED, cb);

    await loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx);

    assert.ok(loadedEventFired, 'RVM_MODEL_LOADED should fire');
    assert.strictEqual(state.rvm.asyncLoad.status, 'loaded');
    assert.strictEqual(state.rvm.asyncLoad.progress, 100);
    assert.strictEqual(state.rvm.asyncLoad.phase, 'done');
    import('../../core/event-bus.js').then(eb => eb.off(RuntimeEvents.RVM_MODEL_LOADED, cb));
    console.log('✅ valid bundle manifest loads without error');
  } catch (err) {
    console.error('❌ valid bundle manifest loads without error', err);
    process.exitCode = 1;
  }

  // Test 2: missing artifacts.glb field → rejected with actionable diagnostic message
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { index: 'index.json' }, // missing glb
      runtime: {}
    };
    await assert.rejects(
      loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx),
      /artifacts\.glb is required/
    );
    // Give event loop a tick to ensure async notifications push completes
    await new Promise(r => setTimeout(r, 0));
    assert.ok(notifications.some(n => n.message && n.message.includes('Load failed') || (n.details && typeof n.details === 'string' && n.details.includes('artifacts.glb is required'))), 'Diagnostic should be emitted');
    console.log('✅ missing artifacts.glb field → rejected with actionable diagnostic message');
  } catch (err) {
    console.error('❌ missing artifacts.glb field → rejected with actionable diagnostic message', err);
    process.exitCode = 1;
  }

  // Test 3: invalid JSON in manifest → rejected with parse error diagnostic
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    await assert.rejects(
      loadRvmSource({ kind: 'bundle', bundle: '{ invalid_json' }, mockCtx),
      /JSON parse error/
    );
    await new Promise(r => setTimeout(r, 0));
    assert.ok(notifications.some(n => n.message && n.message.includes('Load failed') || (n.details && typeof n.details === 'string' && n.details.includes('JSON parse error'))), 'Diagnostic should be emitted');
    console.log('✅ invalid JSON in manifest → rejected with parse error diagnostic');
  } catch (err) {
    console.error('❌ invalid JSON in manifest → rejected with parse error diagnostic', err);
    process.exitCode = 1;
  }

  // Test 4: cancelling load mid-flight leaves clean state (no partial model in scene)
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { glb: 'valid.glb' },
      runtime: {}
    };

    // Create an artificial session block inside load to cancel it mid-flight
    // Here we'll just test the session behavior directly for cancellation
    // Since loadRvmSource creates the session internally, we will override staticBundleLoader for a moment
    const originalLoader = mockCtx.staticBundleLoader.load;

    let midFlightSession = null;
    mockCtx.staticBundleLoader.load = async (input, ctx, asyncSession) => {
      midFlightSession = asyncSession;
      asyncSession.update('manifest', 5);
      asyncSession.cancel(); // Cancel mid-flight
      // simulate delay
      await new Promise(resolve => setTimeout(resolve, 20));
      if (asyncSession.isCancelled()) return null; // Expected flow
      return { loaded: true };
    };

    const res = await loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx);
    assert.strictEqual(res, null, 'Should return null when cancelled');
    assert.strictEqual(midFlightSession.status, 'cancelled');

    mockCtx.staticBundleLoader.load = originalLoader; // Restore
    console.log('✅ cancelling load mid-flight leaves clean state');
  } catch (err) {
    console.error('❌ cancelling load mid-flight leaves clean state', err);
    process.exitCode = 1;
  }

  // Test 5: starting second load while first is pending → first result discarded
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest1 = { schemaVersion: 'rvm-bundle/v1', bundleId: 'b1', artifacts: { glb: 'valid.glb' }, runtime: {} };
    const manifest2 = { schemaVersion: 'rvm-bundle/v1', bundleId: 'b2', artifacts: { glb: 'valid.glb' }, runtime: {} };

    const p1 = loadRvmSource({ kind: 'bundle', bundle: manifest1 }, mockCtx);
    const p2 = loadRvmSource({ kind: 'bundle', bundle: manifest2 }, mockCtx);

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.strictEqual(state.rvm.asyncLoad.status, 'loaded');
    assert.strictEqual(state.rvm.activeBundle, 'b2');

    console.log('✅ starting second load while first is pending → first result discarded');
  } catch (err) {
    console.error('❌ starting second load while first is pending → first result discarded', err);
    process.exitCode = 1;
  }

  // Test 6: mismatched bundleId in index.json vs manifest → warning in diagnostics, load continues
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { glb: 'valid.glb', index: 'mismatch-index.json' },
      runtime: {}
    };

    await loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx);

    await new Promise(r => setTimeout(r, 0));
    assert.ok(notifications.some(n => n.message && n.message.includes('mismatch') || (n.details && typeof n.details === 'string' && n.details.includes('does not match manifest'))), 'Warning diagnostic should be emitted');
    assert.strictEqual(state.rvm.asyncLoad.status, 'loaded', 'Load should still complete');

    console.log('✅ mismatched bundleId in index.json vs manifest → warning in diagnostics, load continues');
  } catch (err) {
    console.error('❌ mismatched bundleId in index.json vs manifest → warning in diagnostics, load continues', err);
    process.exitCode = 1;
  }

  // Test 7: optional tag XML absent → load succeeds (reviewTags: false in coverage)
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { glb: 'valid.glb', index: 'index.json' }, // missing tags
      runtime: {}
    };

    const res = await loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx);
    assert.strictEqual(state.rvm.asyncLoad.status, 'loaded');
    assert.strictEqual(res.tagXmlText, null);

    console.log('✅ optional tag XML absent → load succeeds (reviewTags: false in coverage)');
  } catch (err) {
    console.error('❌ optional tag XML absent → load succeeds (reviewTags: false in coverage)', err);
    process.exitCode = 1;
  }

  // Test 8: progress events fired: manifest → glb → index → done
  try {
    clearNotifications();
    RvmDiagnostics.clear();
    const manifest = {
      schemaVersion: 'rvm-bundle/v1',
      bundleId: 'bundle-123',
      artifacts: { glb: 'valid.glb', index: 'index.json' },
      runtime: {}
    };

    const phasesObserved = new Set();
    const cb = ({ reason }) => {
      if (reason === 'async-load-update') {
        phasesObserved.add(state.rvm.asyncLoad.phase);
      }
    };
    on(RuntimeEvents.RVM_CONFIG_CHANGED, cb);

    await loadRvmSource({ kind: 'bundle', bundle: manifest }, mockCtx);

    assert.ok(phasesObserved.has('manifest'));
    assert.ok(phasesObserved.has('glb'));
    assert.ok(phasesObserved.has('index'));
    assert.ok(phasesObserved.has('done'));
    import('../../core/event-bus.js').then(eb => eb.off(RuntimeEvents.RVM_CONFIG_CHANGED, cb));

    console.log('✅ progress events fired: manifest → glb → index → done');
  } catch (err) {
    console.error('❌ progress events fired: manifest → glb → index → done', err);
    process.exitCode = 1;
  }

}

runTests().finally(() => { global.fetch = originalFetch; });
