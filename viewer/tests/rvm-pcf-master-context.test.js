/**
 * Shared XML→CII master-context scaffold test.
 *
 * This validates that JSON/RVM→PCF can consume the same XML→CII master context
 * contract without duplicating line list, material map, piping-class, or weight
 * loader logic. It does not validate final JSON/RVM→PCF execution.
 */

import fs from 'node:fs/promises';

const {
  DEFAULT_PIPING_CLASS_MASTER_URLS,
  DEFAULT_MATERIAL_MAP_URLS,
  DEFAULT_WEIGHT_MASTER_URLS,
  loadXmlCiiMaterialMap,
  loadXmlCiiMasterRows,
  loadXmlCiiWeightMasterRows,
  prepareXmlCiiMasterContext,
} = await import('../converters/xml-cii2019-core/master-context.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

const masterContextSource = await fs.readFile(
  new URL('../converters/xml-cii2019-core/master-context.js', import.meta.url),
  'utf8'
);

const enrichmentCoreSource = await fs.readFile(
  new URL('../tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js', import.meta.url),
  'utf8'
);

assert(!masterContextSource.includes('tabs/model-converters'), 'B1: master-context does not import tabs/model-converters');
assert(!masterContextSource.includes('xmltocii2019_helper'), 'B1: master-context does not import xmltocii2019_helper');
assert(!masterContextSource.includes('RvmPcfEmitter'), 'B1: master-context does not import RvmPcfEmitter');
assert(!/uxml|Uxml|UXML/.test(masterContextSource), 'B1: master-context does not import or reference UXML modules');
assert(masterContextSource.includes('export async function loadXmlCiiWeightMasterRows'), 'B2: core owns weight master loader implementation');
assert(masterContextSource.includes('export async function loadXmlCiiMasterRows'), 'B2: core owns generic master loader implementation');
assert(masterContextSource.includes('export async function loadXmlCiiMaterialMap'), 'B2: core owns material map loader implementation');
assert(
  enrichmentCoreSource.includes('xml-cii2019-core/master-context.js'),
  'B3: enrichment-core imports core master-context'
);
assert(
  !/function\s+loadXmlCiiWeightMasterRows\s*\(/.test(enrichmentCoreSource),
  'B3: enrichment-core must not own weight loader implementation'
);
assert(
  !/function\s+loadXmlCiiMasterRows\s*\(/.test(enrichmentCoreSource),
  'B3: enrichment-core must not own generic master loader implementation'
);
assert(
  !/function\s+loadXmlCiiMaterialMap\s*\(/.test(enrichmentCoreSource),
  'B3: enrichment-core must not own material map loader implementation'
);

const previousFetch = globalThis.fetch;
let fetchCalled = false;
globalThis.fetch = async () => {
  fetchCalled = true;
  throw new Error('fetch should not be called when all master rows are inline');
};

const diagnostics = [];
const context = await prepareXmlCiiMasterContext({
  rawConfig: {
    linelist: {
      masterRows: [
        { lineNoKey: '88', pipingClass: 'A1A', rating: '150', material: 'CS' },
      ],
    },
    material: {
      mapRows: [
        { code: '1', material: 'Carbon Steel' },
      ],
    },
    pipingClass: {
      masterRows: [
        { pipingClass: 'A1A', boreMm: 100, rating: '150', wallThicknessMm: 7.11 },
      ],
    },
    weight: {
      masterRows: [
        { boreMm: 100, rating: '150', lengthMm: 326.7, weight: 214.35, typeDesc: 'Gate Valve' },
      ],
    },
  },
  diagnostics,
});

globalThis.fetch = previousFetch;

assert(typeof prepareXmlCiiMasterContext === 'function', 'T1: prepareXmlCiiMasterContext is exported');
assert(typeof loadXmlCiiMaterialMap === 'function', 'T1: material-map loader is exported from core');
assert(typeof loadXmlCiiMasterRows === 'function', 'T1: generic master loader is exported from core');
assert(typeof loadXmlCiiWeightMasterRows === 'function', 'T1: weight loader is exported from core');
assert(Array.isArray(DEFAULT_PIPING_CLASS_MASTER_URLS), 'T1: default piping-class URL list is exported');
assert(Array.isArray(DEFAULT_MATERIAL_MAP_URLS), 'T1: default material-map URL list is exported');
assert(Array.isArray(DEFAULT_WEIGHT_MASTER_URLS), 'T1: default weight-master URL list is exported');

assert(fetchCalled === false, 'T2: inline masters do not fetch external files');
assert(context?.config && typeof context.config === 'object', 'T3: context includes normalized config');
assert(context.lineRows.length === 1, 'T3: context exposes lineRows');
assert(context.materialMapRows.length === 1, 'T3: context exposes materialMapRows');
assert(context.pipingClassRows.length === 1, 'T3: context exposes pipingClassRows');
assert(context.weightMasterRows.length === 1, 'T3: context exposes weightMasterRows');
assert(context.pipingClassIndex && typeof context.pipingClassIndex === 'object', 'T3: context exposes pipingClassIndex');
assert(context.config.material.mapRows === context.materialMapRows, 'T4: normalized config reuses context material map rows');
assert(context.config.pipingClass.masterRows === context.pipingClassRows, 'T4: normalized config reuses context piping class rows');
assert(Array.isArray(context.diagnostics), 'T5: context returns diagnostics array');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
