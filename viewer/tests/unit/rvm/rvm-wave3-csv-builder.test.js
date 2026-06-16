/**
 * Wave 3 – RvmFinal2dCsvBuilder unit tests
 * Plain Node ESM, no jsdom / three.js.
 */

import { RvmFinal2dCsvBuilder } from '../../../rvm-pcf-extract/RvmFinal2dCsvBuilder.js';

// ─── Mock index ──────────────────────────────────────────────────────────────

const mockIndex = {
  nodes: [
    {
      canonicalObjectId: 'N1',
      parentCanonicalObjectId: null,
      name: 'Root-Line',
      kind: 'PIPE',
      path: 'Root/Root-Line',
      attributes: { APOS: [0, 0, 0], LPOS: [1000, 0, 0] },
    },
    {
      canonicalObjectId: 'N2',
      parentCanonicalObjectId: 'N1',
      name: 'Elbow-1',
      kind: 'ELBO',
      path: 'Root/Root-Line/Elbow-1',
      attributes: { CPOS: { x: 500, y: 100, z: 0 } },
      bbox: { min: [490, 90, -10], max: [510, 110, 10] },
    },
    {
      canonicalObjectId: 'N3',
      parentCanonicalObjectId: null,
      name: 'Gasket-1',
      kind: 'GASK',
      path: 'Root/Gasket-1',
      attributes: {},
    },
    {
      canonicalObjectId: 'N4',
      parentCanonicalObjectId: null,
      name: 'Misc-1',
      kind: 'MISC',
      path: 'Root/Misc-1',
      attributes: {},
    },
  ],
};

// ─── Tiny assertion helper ───────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS  ${message}`);
    passed++;
  } else {
    console.error(`  FAIL  ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${message}`);
    passed++;
  } else {
    console.error(`  FAIL  ${message}  |  expected=${JSON.stringify(expected)}  actual=${JSON.stringify(actual)}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\nWave 3 – RvmFinal2dCsvBuilder\n');

// T1: No selection → all nodes extracted
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  assert(rows.length === 4, 'T1: No selection → 4 rows (all nodes)');
}

// T2: Selection extracts only selected subtree (N1 + its child N2)
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, { selectedCanonicalIds: ['N1'] });
  const { rows } = builder.build();
  assert(rows.length === 2, 'T2: Selecting N1 yields N1 + N2 (2 rows)');
  assert(rows.some(r => r.sourceCanonicalId === 'N1'), 'T2: N1 present');
  assert(rows.some(r => r.sourceCanonicalId === 'N2'), 'T2: N2 (child) present');
}

// T3: GASK appears but include=false
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  const gask = rows.find(r => r.sourceCanonicalId === 'N3');
  assert(gask != null, 'T3: GASK row present');
  assert(gask.include === false, 'T3: GASK include=false');
}

// T4: PIPE row has type='PIPE'
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  const pipe = rows.find(r => r.sourceCanonicalId === 'N1');
  assertEqual(pipe.type, 'PIPE', 'T4: PIPE row type=PIPE');
  assert(pipe.include === true, 'T4: PIPE include=true');
}

// T5: Coordinates parsed from attributes (APOS → ep1, LPOS → ep2)
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  const pipe = rows.find(r => r.sourceCanonicalId === 'N1');
  assertEqual(pipe.ep1, { x: 0, y: 0, z: 0 }, 'T5: ep1 from APOS');
  assertEqual(pipe.ep2, { x: 1000, y: 0, z: 0 }, 'T5: ep2 from LPOS');
}

// T6: Bbox fallback used when no APOS/LPOS, marked _epFallback=true
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  const elbow = rows.find(r => r.sourceCanonicalId === 'N2');
  assert(elbow._epFallback === true, 'T6: elbow _epFallback=true');
  assert(elbow.diagnostics.includes('EP1-BBOX-FALLBACK'), 'T6: EP1-BBOX-FALLBACK diagnostic');
  assert(elbow.diagnostics.includes('EP2-BBOX-FALLBACK'), 'T6: EP2-BBOX-FALLBACK diagnostic');
  assertEqual(elbow.ep1, { x: 490, y: 90, z: -10 }, 'T6: ep1 = bbox.min');
  assertEqual(elbow.ep2, { x: 510, y: 110, z: 10 }, 'T6: ep2 = bbox.max');
}

// T7: Row order is sorted; rowNo assigned correctly (10, 20, 30…)
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  // All rowNos should be multiples of 10 starting at 10
  const rowNos = rows.map(r => r.rowNo);
  assert(rowNos[0] === 10, 'T7: first rowNo = 10');
  assert(rowNos[1] === 20, 'T7: second rowNo = 20');
  assert(rowNos[2] === 30, 'T7: third rowNo = 30');
  // Sorted by path: Root/Gasket-1 < Root/Misc-1 < Root/Root-Line < Root/Root-Line/Elbow-1
  assert(rows[0].sourceCanonicalId === 'N3', 'T7: first row = N3 (Root/Gasket-1)');
  assert(rows[1].sourceCanonicalId === 'N4', 'T7: second row = N4 (Root/Misc-1)');
}

// T8: UNKNOWN type appears with include=false
{
  const builder = new RvmFinal2dCsvBuilder(mockIndex, {});
  const { rows } = builder.build();
  const misc = rows.find(r => r.sourceCanonicalId === 'N4');
  assertEqual(misc.type, 'UNKNOWN', 'T8: MISC maps to UNKNOWN');
  assert(misc.include === false, 'T8: UNKNOWN include=false');
  assert(misc.diagnostics.includes('TYPE-UNKNOWN'), 'T8: TYPE-UNKNOWN diagnostic');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
