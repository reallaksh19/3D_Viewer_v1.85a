import assert from 'assert/strict';
import { validateBundleManifest, parseBundleManifest, normalizeBundleManifest } from '../../../rvm/RvmBundleManifest.js';

const VALID = {
  schemaVersion: 'rvm-bundle/v1',
  bundleId: 'sample-plant-001',
  source: { format: 'RVM', files: [{ name: 'sample.rvm', sha256: 'abc123' }] },
  converter: { name: 'rvmparser', version: '1.0', mode: 'static-preconverted', warnings: [] },
  runtime: { units: 'mm', upAxis: 'Y', originOffset: [0, 0, 0], scale: 1 },
  artifacts: { glb: 'sample.glb', index: 'sample.index.json', tags: 'sample.review.xml' },
  coverage: { attributes: true, tree: true, supports: false, reviewTags: true },
  modelClass: 'single-bundle',
};

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exit(1);
  }
}

// ✅ valid manifest passes schema validation
test('valid manifest passes schema validation', () => {
  const result = validateBundleManifest(VALID);
  assert.equal(result.ok, true);
});

// ✅ missing schemaVersion is rejected
test('missing schemaVersion is rejected', () => {
  const bad = { ...VALID, schemaVersion: 'wrong/v99' };
  const result = validateBundleManifest(bad);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('schemaVersion'));
});

// ✅ missing artifacts.glb is rejected
test('missing artifacts.glb is rejected', () => {
  const bad = { ...VALID, artifacts: { index: 'sample.index.json' } };
  const result = validateBundleManifest(bad);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('artifacts.glb'));
});

// ✅ modelClass defaults to "single-bundle" when absent
test('modelClass defaults to "single-bundle" when absent', () => {
  const { modelClass: _, ...noClass } = VALID;
  const normalized = normalizeBundleManifest(noClass);
  assert.equal(normalized.modelClass, 'single-bundle');
});

// ✅ sha256 field preserved as-is
test('sha256 field preserved as-is (not validated in browser)', () => {
  const manifest = parseBundleManifest(JSON.stringify(VALID));
  assert.equal(manifest.source.files[0].sha256, 'abc123');
});

console.log('✅ rvm-bundle-manifest unit tests passed.');
