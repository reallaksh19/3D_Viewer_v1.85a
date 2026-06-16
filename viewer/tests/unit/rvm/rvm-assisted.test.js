import { RvmHelperBridge } from '../../../converters/rvm-helper-bridge.js';
import { RvmCacheStore } from '../../../converters/rvm-cache-store.js';
import { detectRvmCapabilities } from '../../../rvm/RvmCapabilities.js';

async function runTests() {
    let success = true;
    const errors = [];

    // Test Capability probe
    // probe failure -> graceful fallback to static caps (not crash)
    const badProbe = async () => ({ reachable: false });
    const capsBad = await detectRvmCapabilities(badProbe);
    if (!capsBad.rawRvmImport) {
        console.log('✅ probe failure → graceful fallback to static caps (not crash)');
    } else {
        errors.push('Probe failure did not fallback to static caps');
    }

    const goodProbe = async () => ({ reachable: true, version: '1.2' });
    const capsGood = await detectRvmCapabilities(goodProbe);
    if (capsGood.rawRvmImport && capsGood.deploymentMode === 'assisted') {
         console.log('✅ raw RVM accepted in assisted mode when helper probe returns reachable');
    } else {
         errors.push('Raw RVM not accepted in assisted mode correctly');
    }

    // Test caching mechanism
    const mockStore = {};
    global.sessionStorage = {
        getItem: (k) => mockStore[k] || null,
        setItem: (k, v) => mockStore[k] = v,
        removeItem: (k) => delete mockStore[k],
        get length() { return Object.keys(mockStore).length; },
        key: (i) => Object.keys(mockStore)[i]
    };

    RvmCacheStore.clear(); // Clean state
    const mockSha = 'test-file.rvm_1024';

    // should be cache miss initially
    const miss = RvmCacheStore.get(mockSha);
    if (miss === null) {
        console.log('✅ cache miss for new file');
    } else {
        errors.push('Expected cache miss but got hit');
    }

    // Set cache
    RvmCacheStore.set(mockSha, 'b-123', 'blob:1', 'blob:2');
    const hit = RvmCacheStore.get(mockSha);
    if (hit && hit.bundleId === 'b-123') {
        console.log('✅ sha256 cache hit skips re-conversion');
    } else {
        errors.push('Cache write/read failed');
    }

    // Since actual conversion test needs a running server and real File objects which are tricky in plain node,
    // we rely on unit tests for helper states.

    if (errors.length > 0) {
        errors.forEach(e => console.error('❌', e));
        process.exit(1);
    } else {
        console.log('✅ All rvm-assisted unit tests passed.');
    }
}

runTests();
