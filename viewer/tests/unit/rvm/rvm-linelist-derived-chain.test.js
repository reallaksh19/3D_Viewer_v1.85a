/**
 * Line List end-to-end chain (#7): a component branch name derives the Line No.
 * Key (service+seq, e.g. S8810101); the line list (keyed by that derived key)
 * supplies the piping class + rating; and the piping-class master then supplies
 * wall thickness / corrosion / material by class+bore.
 *
 * Also guards against a pipeline-ref spec/job code (91261M7) being mistaken for
 * the piping class and overriding the line-list value.
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

const pc = JSON.parse(readFileSync(new URL('../../../../docs/Masters/Piping_class_master.json', import.meta.url), 'utf8'));
// A class+bore present in the master for class 13421.
const target = pc.find(r => r['Piping Class'] === '13421' && r.convertedBore === 250) || pc.find(r => r['Piping Class'] === '13421');

const linelist = [{ ColumnX1: 'S8810101', pipingClass: '13421', rating: '150' }];
const wf = new RvmMasterResolutionWorkflow({ masters: { linelist: { rows: linelist }, pipingClass: { rows: pc } } });

const row = { type: 'PIPE', rowNo: 1, pipelineRef: '/ASIM-1885-10"-S8810101-91261M7-HC/B1', convertedBore: target.convertedBore };
wf.processRows([row]);

assertEqual(row.pipingClass, '13421', 'piping class from line list (not the 91261M7 spec code)');
assertEqual(row.rating, '150', 'rating from line list');
assertEqual(Number(row.wallThickness), Number(target['Wall thickness']), 'wall thickness from class+bore master');
assertEqual(String(row.corrosionAllowance), String(Number(target.Corrosion)), 'corrosion from master');
assertEqual(row.material, target.Material_Name, 'material from master');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
