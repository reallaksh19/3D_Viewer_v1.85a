import assert from 'assert/strict';
import { detectRvmCapabilities, STATIC_CAPS } from '../../../rvm/RvmCapabilities.js';

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exit(1);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exit(1);
  }
}

// ✅ returns static caps when no probe provided
await asyncTest('returns static caps when no probe provided', async () => {
  const caps = await detectRvmCapabilities(null);
  assert.equal(caps.deploymentMode, 'static');
  assert.equal(caps.preconvertedBundleImport, true);
  assert.equal(caps.helperReachable, false);
});

// ✅ returns static caps when probe throws
await asyncTest('returns static caps when probe throws', async () => {
  const probe = async () => { throw new Error('connection refused'); };
  const caps = await detectRvmCapabilities(probe);
  assert.equal(caps.deploymentMode, 'static');
  assert.equal(caps.helperReachable, false);
});

// ✅ returns assisted caps when probe returns { reachable: true, version: "1.2" }
await asyncTest('returns assisted caps when probe returns { reachable: true, version: "1.2" }', async () => {
  const probe = async () => ({ reachable: true, version: '1.2' });
  const caps = await detectRvmCapabilities(probe);
  assert.equal(caps.deploymentMode, 'assisted');
  assert.equal(caps.helperReachable, true);
  assert.equal(caps.helperVersion, '1.2');
  assert.equal(caps.localConversion, true);
});

// ✅ rawRvmImport is false in static caps
test('rawRvmImport is false in static caps', () => {
  assert.equal(STATIC_CAPS.rawRvmImport, false);
});

// ✅ rawRvmImport is true in assisted caps
await asyncTest('rawRvmImport is true in assisted caps', async () => {
  const probe = async () => ({ reachable: true, version: '2.0' });
  const caps = await detectRvmCapabilities(probe);
  assert.equal(caps.rawRvmImport, true);
});

// ✅ probe returning { reachable: false } falls back to static
await asyncTest('probe returning { reachable: false } falls back to static', async () => {
  const probe = async () => ({ reachable: false });
  const caps = await detectRvmCapabilities(probe);
  assert.equal(caps.deploymentMode, 'static');
  assert.equal(caps.helperReachable, false);
});

console.log('✅ rvm-capabilities unit tests passed.');
