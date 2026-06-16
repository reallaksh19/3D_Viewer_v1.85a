/**
 * Piping-class master: class+bore lookup must fetch wall thickness, corrosion,
 * material, rating and schedule for the matched size (not just class+rating),
 * and must report NO_MASTER only when the master is absent.
 *
 * Plain Node ESM.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}
import { readFileSync } from 'node:fs';
import { RvmMasterResolutionWorkflow } from '../../../rvm-pcf-extract/RvmMasterResolutionWorkflow.js';

let passed = 0, failed = 0;
function assertEqual(a, e, msg) {
  if (String(a) === String(e)) { console.log(`  PASS  ${msg}`); passed++; }
  else { console.error(`  FAIL  ${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(e)})`); failed++; }
}

const master = JSON.parse(readFileSync(new URL('../../../../docs/Masters/Piping_class_master.json', import.meta.url), 'utf8'));
const sample = master.find(r => r['Piping Class'] === '13421' && r.convertedBore === 150) || master.find(r => r.convertedBore === 150);
const cls = sample['Piping Class'];
const pipelineRef = `/ASIM-1885-6"-A8010125-${cls}/B1`;

// NO master -> NO_MASTER
{
  const wf = new RvmMasterResolutionWorkflow({ masters: {} });
  const row = { type: 'PIPE', rowNo: 1, pipelineRef, convertedBore: sample.convertedBore };
  const requests = [];
  wf._resolvePipingClass(row, requests, []);
  assertEqual(requests.map(r => r.reason).join(','), 'NO_MASTER', 'NO_MASTER when master absent');
  assertEqual(row.wallThickness ?? 'undef', 'undef', 'no wall thickness without master');
}

// master loaded -> class+bore fetches wall/corr/material/schedule
{
  const wf = new RvmMasterResolutionWorkflow({ masters: { pipingClass: { rows: master } } });
  const row = { type: 'PIPE', rowNo: 1, pipelineRef, convertedBore: sample.convertedBore };
  const requests = [];
  wf._resolvePipingClass(row, requests, []);
  assertEqual(row.pipingClass, cls, 'piping class resolved');
  assertEqual(row.wallThickness, sample['Wall thickness'], 'wall thickness fetched by class+bore');
  assertEqual(String(row.corrosionAllowance), String(Number(sample.Corrosion)), 'corrosion fetched');
  assertEqual(row.material, sample.Material_Name, 'material fetched');
  assertEqual(row.schedule, sample.SCH, 'schedule fetched');
  assertEqual(requests.length, 0, 'no unresolved request when matched');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
