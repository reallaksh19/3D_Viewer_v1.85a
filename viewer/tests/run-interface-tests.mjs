import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tests = [
  './unit/interchange/conversion-config.test.js',
  './unit/interchange/stp-support-parser.test.js',
  './unit/interchange/converter-worker-contract.test.js',
  './unit/interchange/adapter-registry.test.js',
  './unit/interchange/support-mapping-config.test.js',
  './integration/interchange-config-ui.test.js',
  './integration/interchange-export-smoke.test.js',
  './integration/model-exchange-ui.test.js',
  './integration/export-roundtrip.test.js',
  './integration/rvm-viewer-commands.test.js',
  './unit/rvm/rvm-wave1-multiselect.test.js',
  './unit/rvm/rvm-wave2-tab-shell.test.js',
  './unit/rvm/rvm-wave3-csv-builder.test.js',
  './unit/rvm/rvm-wave4-pipeline-bore.test.js',
  './unit/rvm/rvm-wave5-piping-class.test.js',
  './unit/rvm/rvm-wave6-valve-weight.test.js',
  './unit/rvm/rvm-wave7-remaining-masters.test.js',
  './unit/rvm/rvm-wave8-pcf-emitter.test.js',
  './unit/rvm/rvm-wave9-hardening.test.js',
  './unit/rvm/rvm-pcf-topology-roi2.test.js',
  'unit/rvm/rvm-pcf-readiness-roi2-3d-gap-overlap-benchmark.test.js',
  './unit/rvm/rvm-search.test.js',
  './unit/rvm/rvm-bundle-manifest.test.js',
  './unit/rvm/rvm-identity-map.test.js',
  './unit/rvm/rvm-capabilities.test.js',
  './integration/rvm-tab-shell.test.js',
  './integration/rvm-load-pipeline.test.js',
  './unit/xml-compare/xml-compare-x12-topology-issues-behavior.test.js',
  './unit/xml-compare/xml-compare-x12-topology-issues-ui-markers.test.js',
  './unit/xml-compare/xml-compare-x13-topology-filter-behavior.test.js',
  './unit/xml-compare/xml-compare-x13-topology-filter-ui-markers.test.js',
  './unit/rvm/rvm-tag-xml.test.js',
  './unit/rvm/rvm-saved-views.test.js',
  './unit/rvm/rvm-assisted.test.js',
];

for (const rel of tests) {
  const abs = path.join(__dirname, rel);
  const importUrl = pathToFileURL(abs).href;
  const runnerScript = `
    global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null };
    global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null };
    global.window = { localStorage: global.localStorage, sessionStorage: global.sessionStorage };
    if (!global.crypto) global.crypto = { randomUUID: () => Math.random().toString() };
    import(${JSON.stringify(importUrl)});
  `;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', runnerScript],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('âœ… interface test suite passed.');
