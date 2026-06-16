/**
 * Wave 5 – RvmPipingClassMapper unit tests
 * Plain Node ESM, no jsdom / three.js.
 */

import { RvmPipingClassMapper } from '../../../rvm-pcf-extract/RvmPipingClassMapper.js';

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
    console.error(`  FAIL  ${message}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ─── T1: Direct attribute SPEC ───────────────────────────────────────────────

console.log('\nT1: Direct class attr SPEC → pipingClass=CS150, source=DIRECT');
{
  const mapper = new RvmPipingClassMapper();
  const result = mapper.mapRow({
    attributes:    { SPEC: 'CS150' },
    pipelineRef:   null,
    convertedBore: null,
    type:          'PIPE',
  });
  assertEqual(result.pipingClass,        'CS150',   'pipingClass = CS150');
  assertEqual(result.classMappingSource, 'DIRECT',  'source = DIRECT');
}

// ─── T2: Linelist master match ────────────────────────────────────────────────

console.log('\nT2: Linelist master match by pipelineRef');
{
  const masters = {
    linelist: [
      { pipelineRef: '100-CS-150', pipingClass: 'A1A', rating: '150', material: 'CS' },
    ],
  };
  const mapper = new RvmPipingClassMapper(masters);
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   '100-CS-150',
    convertedBore: null,
    type:          'PIPE',
  });
  assertEqual(result.pipingClass,        'A1A',      'pipingClass from linelist');
  assertEqual(result.rating,             '150',      'rating from linelist');
  assertEqual(result.classMappingSource, 'LINELIST', 'source = LINELIST');
}

// ─── T3: Parse from pipelineRef ───────────────────────────────────────────────

console.log('\nT3: Parse from pipelineRef LINE-CS150-4IN');
{
  const mapper = new RvmPipingClassMapper();
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   'LINE-CS150-4IN',
    convertedBore: null,
    type:          'PIPE',
  });
  assertEqual(result.classMappingSource, 'PIPELINE-REF-PARSE', 'source = PIPELINE-REF-PARSE');
  assert(result.material === 'CS' || result.rating != null, 'material=CS or rating token found');
}

// ─── T4: Class master score ≥70 → auto-apply ──────────────────────────────────

console.log('\nT4: Class master score ≥70 → source=CLASS-MASTER-AUTO');
{
  // bore match (+30) + type exact match (+20) + rating match (+15) + material match (+10) = 75
  const masters = {
    pipingClassMaster: [
      {
        pipingClass:        'B2B',
        convertedBore:      '100',
        componentType:      'PIPE',
        rating:             '300',
        material:           'SS',
        schedule:           '40',
        wallThickness:      '7.11',
        corrosionAllowance: '1.5',
        endCondition:       'BW',
        facing:             'RF',
      },
    ],
  };
  const mapper = new RvmPipingClassMapper(masters);
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   'LINE-SS300-4IN',
    convertedBore: '100',
    type:          'PIPE',
  });
  assertEqual(result.classMappingSource, 'CLASS-MASTER-AUTO', 'source = CLASS-MASTER-AUTO');
  assertEqual(result.pipingClass,        'B2B',               'pipingClass from master');
  assert(result.classMatchScore >= 70, `score=${result.classMatchScore} >= 70`);
}

// ─── T5: Class master score 50–69 → warning ───────────────────────────────────

console.log('\nT5: Class master score 50–69 → source=CLASS-MASTER-WARNING');
{
  // bore match (+30) + material match (+10) + type wildcard (+5) = 45 — need to adjust
  // bore (+30) + type exact (+20) = 50 exactly
  const masters = {
    pipingClassMaster: [
      {
        pipingClass:   'C3C',
        convertedBore: '50',
        componentType: 'PIPE',
        rating:        null,
        material:      null,
      },
    ],
  };
  const mapper = new RvmPipingClassMapper(masters);
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   null,
    convertedBore: '50',
    type:          'PIPE',
  });
  // score = bore(+30) + type exact(+20) = 50 → WARNING
  assertEqual(result.classMappingSource, 'CLASS-MASTER-WARNING', 'source = CLASS-MASTER-WARNING');
  assert(result.classMatchScore >= 50 && result.classMatchScore < 70, `score=${result.classMatchScore} in [50,69]`);
}

// ─── T6: Class master score <50 → not applied ─────────────────────────────────

console.log('\nT6: Class master score <50 → pipingClass stays null');
{
  // type wildcard only = +5 → < 50
  const masters = {
    pipingClassMaster: [
      {
        pipingClass:   'D4D',
        convertedBore: '200',   // mismatch with row bore 50 → -30
        componentType: '*',     // wildcard → +5
        rating:        null,
        material:      null,
      },
    ],
  };
  const mapper = new RvmPipingClassMapper(masters);
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   null,
    convertedBore: '50',
    type:          'PIPE',
  });
  // score = bore mismatch(-30) + wildcard(+5) = -25 → skip
  assert(result.pipingClass === null,          'pipingClass stays null (not applied)');
  assert(result.classMappingSource !== 'CLASS-MASTER-AUTO' &&
         result.classMappingSource !== 'CLASS-MASTER-WARNING',
         'source not CLASS-MASTER');
}

// ─── T7: Inspector fields always present ──────────────────────────────────────

console.log('\nT7: Inspector fields present');
{
  const mapper = new RvmPipingClassMapper();
  const result = mapper.mapRow({
    attributes:    {},
    pipelineRef:   null,
    convertedBore: null,
    type:          'PIPE',
  });
  assert('classMatchScore'     in result, 'classMatchScore present');
  assert('classMappingSource'  in result, 'classMappingSource present');
  assert('classMappingRuleId'  in result, 'classMappingRuleId present');
  assert('pipingClassMapping'  in result, 'pipingClassMapping present');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
