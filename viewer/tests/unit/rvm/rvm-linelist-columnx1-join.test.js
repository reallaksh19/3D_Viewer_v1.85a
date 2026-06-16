/**
 * Regression: linelist join must prefer ColumnX1 (LineNo Key) over a partial
 * `lineNo`, so PCF rows whose pipeline reference extracts to the composite key
 * (e.g. "A8010125") match the master row and receive CA attributes
 * (piping class / rating) instead of MASTER-LINELIST-NO_MASTER.
 *
 * Plain Node ESM (no jsdom / three.js).
 */
// Minimal localStorage stub (the workflow reads regex config from it in-browser).
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

import { RvmMasterResolutionWorkflow } from '../../../rvm-pcf-extract/RvmMasterResolutionWorkflow.js';

let passed = 0;
let failed = 0;
function assertEqual(actual, expected, msg) {
  if (actual === expected) { console.log(`  PASS  ${msg}`); passed++; }
  else { console.error(`  FAIL  ${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`); failed++; }
}

const PIPELINE_REF = '/ASIM-1885-2"-A8010125-13421/B1';

function makeWorkflow(masterRow) {
  return new RvmMasterResolutionWorkflow({
    masters: { linelist: { rows: [masterRow] } },
  });
}

// Case 1: master row has a partial lineNo but the correct ColumnX1.
{
  const wf = makeWorkflow({
    lineNo: '8010125',          // partial — must NOT win
    ColumnX1: 'A8010125',       // composite LineNo Key — must win
    rating: '300',
  });
  const row = { pipelineRef: PIPELINE_REF };
  const requests = [];
  wf._resolveLineList(row, requests, []);
  assertEqual(row.rating, '300', 'rating applied via ColumnX1 join (master value)');
  assertEqual(requests.length, 0, 'no NO_MASTER request raised');
}

// Case 2: ColumnX1 only present on the preserved _raw payload.
{
  const wf = makeWorkflow({
    lineNo: '8010125',
    _raw: { ColumnX1: 'A8010125' },
    rating: '600',
  });
  const row = { pipelineRef: PIPELINE_REF };
  const requests = [];
  wf._resolveLineList(row, requests, []);
  assertEqual(row.rating, '600', 'rating applied via _raw.ColumnX1 join');
  assertEqual(requests.length, 0, 'no NO_MASTER request raised (_raw.ColumnX1)');
}

// Case 3: legacy behaviour preserved — lineNo IS the full key, no ColumnX1.
{
  const wf = makeWorkflow({ lineNo: 'A8010125', rating: '150' });
  const row = { pipelineRef: PIPELINE_REF };
  const requests = [];
  wf._resolveLineList(row, requests, []);
  assertEqual(row.rating, '150', 'rating applied via lineNo when it is the full key');
  assertEqual(requests.length, 0, 'no NO_MASTER request raised (legacy lineNo)');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
