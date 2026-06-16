import assert from 'assert/strict';
import {
  DEFAULT_CONVERSION_CONFIG,
  validateConversionConfig,
} from '../../../interchange/config/conversion-config.js';
import {
  getConversionConfig,
  loadConversionConfig,
  replaceConversionConfig,
  resetConversionConfig,
} from '../../../interchange/config/conversion-config-store.js';

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

global.window = { localStorage: createStorage() };

const baseValidation = validateConversionConfig(DEFAULT_CONVERSION_CONFIG);
assert.equal(baseValidation.ok, true, 'default config should validate');

assert.throws(() => replaceConversionConfig({
  ...DEFAULT_CONVERSION_CONFIG,
  topology: { ...DEFAULT_CONVERSION_CONFIG.topology, nodeMergeToleranceMm: 0 },
}), /Invalid conversion config/, 'invalid tolerance must be rejected');

replaceConversionConfig({
  ...DEFAULT_CONVERSION_CONFIG,
  exportPolicy: { ...DEFAULT_CONVERSION_CONFIG.exportPolicy, strictMode: true },
}, 'unit-test');
let cfg = getConversionConfig();
assert.equal(cfg.exportPolicy.strictMode, true, 'strict mode should persist');

resetConversionConfig();
cfg = getConversionConfig();
assert.equal(cfg.topology.nodeMergeToleranceMm, 0.5, 'reset should restore default tolerance');

const loaded = loadConversionConfig();
assert.equal(loaded.validation.ok, true, 'load after reset should stay valid');

console.log('✅ conversion-config unit tests passed.');
