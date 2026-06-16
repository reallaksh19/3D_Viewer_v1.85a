/**
 * Line-No-Key extraction must be position-independent so branch-name variants
 * resolve to the same key:
 *   /ASIM-1885-10"-S8810101-91261M7-HC/B1     (standard)
 *   /ASIM-1885-10"-S-8810101-91261M7-HC/B1    (split letter/number)
 *   /ASIM-88-1885-10"-S8810101-91261M7-HC/B1  (extra area prefix -> shifted segments)
 *
 * Plain Node ESM.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}
import { RvmMasterResolutionWorkflow } from '../../../rvm-pcf-extract/RvmMasterResolutionWorkflow.js';

let passed = 0, failed = 0;
function assertEqual(a, e, msg) {
  if (a === e) { console.log(`  PASS  ${msg}`); passed++; }
  else { console.error(`  FAIL  ${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(e)})`); failed++; }
}

const wf = new RvmMasterResolutionWorkflow({ masters: {} });
const key = ref => wf._lineListLookupKey({ pipelineRef: ref });

assertEqual(key('/ASIM-1885-10"-S8810101-91261M7-HC/B1'), 'S8810101', 'standard');
assertEqual(key('/ASIM-1885-10"-S-8810101-91261M7-HC/B1'), 'S8810101', 'split letter/number variant');
assertEqual(key('/ASIM-88-1885-10"-S8810101-91261M7-HC/B1'), 'S8810101', 'extra area prefix variant');
assertEqual(key('/ASIM-1885-2"-A8010125-13421/B1'), 'A8010125', 'A-line standard');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
