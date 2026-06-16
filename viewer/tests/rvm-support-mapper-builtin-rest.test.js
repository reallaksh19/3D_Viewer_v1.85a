import assert from 'assert/strict';

function installLocalStorageStub() {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.window = {
    dispatchEvent() {},
  };
}

async function run() {
  console.log('--- rvm-support-mapper-builtin-rest.test.js ---');

  installLocalStorageStub();
  const mapper = await import('../rvm-viewer/RvmSupportMapper.js');

  mapper.resetBuiltinRules();

  let restRule = mapper.getBuiltinRules().find((rule) => rule.id === 'builtin-user-rest');
  assert.ok(restRule, 'builtin-user-rest rule exists');
  assert.match(restRule.pattern, /ANCI/, 'default REST built-in pattern includes ANCI');
  assert.match(restRule.field, /ComponentType/, 'default REST built-in fields include ComponentType');
  assert.equal(mapper.resolveKindFromAttrs({ CMPSUPTYPE: 'ANCI' }), 'REST', 'ANCI resolves to REST');
  assert.equal(mapper.resolveKindFromAttrs({ ComponentType: 'ANCI' }), 'REST', 'ComponentType ANCI resolves to REST');

  mapper.updateBuiltinRule('builtin-user-rest', {
    field: 'SPRE,SKEY,NAME,DESCRIPTION,DESC,CMPSUPTYPE',
    match: 'contains',
    pattern: 'REST,SHOE,BP,BEARING PLATE,WP,WEAR PAD',
    kind: 'REST',
  });

  restRule = mapper.getBuiltinRules().find((rule) => rule.id === 'builtin-user-rest');
  assert.match(restRule.pattern, /ANCI/, 'legacy localStorage override is upgraded with ANCI');
  assert.match(restRule.field, /ComponentType/, 'legacy localStorage override is upgraded with ComponentType field');
  assert.equal(mapper.resolveKindFromAttrs({ CMPSUPTYPE: 'ANCI' }), 'REST', 'ANCI resolves to REST after override migration');
  assert.equal(mapper.resolveKindFromAttrs({ ComponentType: 'ANCI' }), 'REST', 'ComponentType ANCI resolves to REST after override migration');
  assert.equal(mapper.resolveKindFromAttrs({ CMPSUPTYPE: 'WEAR PAD' }), 'REST', 'WEAR PAD resolves to REST');
  assert.equal(mapper.resolveKindFromAttrs({ CMPSUPTYPE: 'BEARING PLATE' }), 'REST', 'BEARING PLATE resolves to REST');

  mapper.resetBuiltinRules();
  console.log('OK');
}

run();
