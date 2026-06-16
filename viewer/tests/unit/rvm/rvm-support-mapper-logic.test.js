import assert from 'assert/strict';
import path from 'path';
import { pathToFileURL } from 'url';

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

async function loadMapper() {
  const mapperPath = path.resolve('viewer/rvm-viewer/RvmSupportMapper.js');
  return import(`${pathToFileURL(mapperPath).href}?test=${Date.now()}`);
}

async function run() {
  console.log('--- rvm-support-mapper-logic.test.js ---');

  const mapper = await loadMapper();

  assert.equal(
    mapper.resolveKindFromAttrs({ MDSSUPPTYPE: 'GT573' }),
    'REST',
    'GT5-series MDSSUPPTYPE values must map to REST before generic GT GUIDE'
  );

  assert.equal(
    mapper.resolveKindFromAttrs({ SPRE: '/MDS/GT576-250-PMP' }),
    'REST',
    'GT5-series SPRE text must map to REST during conversion'
  );

  assert.equal(
    mapper.resolveKindFromAttrs({ MDSSUPPTYPE: 'GT999' }),
    'GUIDE',
    'non-GT5 generic GT values should keep the existing GUIDE fallback'
  );

  assert.equal(
    mapper.resolveKindFromAttrs({ attributes: { '<CMPSUPTYPE>': 'BP-A1-10' } }),
    'REST',
    'normalized nested ATT keys must be resolved'
  );

  mapper.addUserRule({
    field: 'CMPSUPTYPE, MDSSUPPTYPE, SPRE',
    match: 'contains',
    pattern: 'GT7, CUSTOM-ANCHOR',
    kind: 'ANCHOR',
  });

  assert.equal(
    mapper.resolveKindFromAttrs({ SPRE: '/MDS/GT777-250-PMP' }),
    'ANCHOR',
    'user rules must support comma-separated fields and keywords'
  );

  mapper.addUserRule({
    field: '*',
    match: 'contains',
    pattern: 'SPECIAL-REST',
    kind: 'REST',
  });

  assert.equal(
    mapper.resolveKindFromAttrs({ DESCRIPTION: 'vendor SPECIAL-REST code' }),
    'REST',
    'field "*" must scan all available attribute values'
  );

  mapper.updateBuiltinRule('builtin-gt', {
    field: 'SPRE',
    match: 'contains',
    pattern: 'CUSTOM-GUIDE',
    kind: 'ANCHOR',
  });

  assert.equal(
    mapper.resolveKindFromAttrs({ SPRE: '/MDS/CUSTOM-GUIDE-250-PMP' }),
    'ANCHOR',
    'built-in rule field/match/pattern/kind overrides must be persisted and used'
  );

  mapper.resetBuiltinRule('builtin-gt');

  assert.equal(
    mapper.resolveKindFromAttrs({ MDSSUPPTYPE: 'GT999' }),
    'GUIDE',
    'resetting a built-in override must restore the default rule'
  );

  console.log('[PASS] support mapper logic smoke passed.');
}

try {
  await run();
} catch (error) {
  console.error('[FAIL] support mapper logic smoke failed.');
  console.error(error);
  process.exit(1);
}
