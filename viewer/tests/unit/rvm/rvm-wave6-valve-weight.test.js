/**
 * Wave 6 – RvmValveWeightMapper unit tests
 * Plain Node ESM, no jsdom / three.js.
 */

import { RvmValveWeightMapper } from '../../../rvm-pcf-extract/RvmValveWeightMapper.js';

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

// ─── Mock master ─────────────────────────────────────────────────────────────

const mockMaster = [
  { boreMm: 100, ratingClass: '150', lengthMm: 203, valveWeight: 45.0, valveType: 'GATE',  qualityOk: true, sourceRowIndex: 0 },
  { boreMm: 100, ratingClass: '150', lengthMm: 210, valveWeight: 46.5, valveType: 'GLOBE', qualityOk: true, sourceRowIndex: 1 },
  { boreMm: 50,  ratingClass: '300', lengthMm: 140, valveWeight: 12.0, valveType: 'BALL',  qualityOk: true, sourceRowIndex: 2 },
];

const mapper = new RvmValveWeightMapper({ valveWeightMaster: mockMaster });

// ─── T1: Non-VALVE row → skipped ─────────────────────────────────────────────

console.log('\nT1: Non-VALVE row → skipped');
{
  const row = { type: 'PIPE', convertedBore: 100, rating: '150', attributes: { lengthMm: 205 }, diagnostics: [] };
  const result = mapper.mapRow(row);
  assert(result.valveWeightSource === null, 'valveWeightSource is null for PIPE row');
  assert(result.valveWeightLengthMm === null, 'valveWeightLengthMm is null for PIPE row');
  assert(row.ca === undefined, 'ca not set on PIPE row');
}

// ─── T2: VALVE with incomplete key (no bore) → WM-WEIGHT-KEY-INCOMPLETE ───────

console.log('\nT2: VALVE with incomplete key (no bore)');
{
  const row = { type: 'VALVE', convertedBore: null, rating: '150', attributes: { lengthMm: 205 }, diagnostics: [] };
  const result = mapper.mapRow(row);
  assertEqual(result.valveWeightSource, 'WM-WEIGHT-KEY-INCOMPLETE', 'source = WM-WEIGHT-KEY-INCOMPLETE');
  assert(row.diagnostics.includes('WM-WEIGHT-KEY-INCOMPLETE'), 'diagnostic pushed to row');
  assert(row.ca === undefined, 'ca not set');
}

// ─── T3: VALVE bore=100, rating='150', length=205 → one candidate → match ────

console.log('\nT3: VALVE bore=100, rating=150, length=205 → one candidate');
{
  const row = { type: 'VALVE', convertedBore: 100, rating: '150', attributes: { lengthMm: 205 }, diagnostics: [], rowNo: 10 };
  const result = mapper.mapRow(row);
  assertEqual(result.valveWeightSource, 'WM-WEIGHT-CA8-MATCH', 'source = WM-WEIGHT-CA8-MATCH');
  assertEqual(result.valveWeightLengthMm, 205, 'lengthMm resolved correctly');
  assertEqual(row.ca['8'], '45 kg', 'ca["8"] = 45.0 (GATE valve at 203mm)');
}

// ─── T4: VALVE bore=100, rating='150', length=207 → two candidates → ambiguous

console.log('\nT4: VALVE bore=100, rating=150, length=207 → ambiguous');
{
  const row = { type: 'VALVE', convertedBore: 100, rating: '150', attributes: { lengthMm: 207 }, diagnostics: [], rowNo: 20 };
  const result = mapper.mapRow(row);
  assertEqual(result.valveWeightSource, 'WM-WEIGHT-CA8-AMBIGUOUS', 'source = WM-WEIGHT-CA8-AMBIGUOUS');
  assert(result.ambiguousValveWeightRequests.length === 1, 'one ambiguous request');
  assert(result.ambiguousValveWeightRequests[0].candidates.length === 2, 'two candidates');
  assert(row.ca === undefined || row.ca?.['8'] === undefined, 'ca["8"] NOT auto-applied');
  assert(row.diagnostics.includes('WM-WEIGHT-CA8-AMBIGUOUS'), 'diagnostic pushed');
}

// ─── T5: VALVE bore=100, rating='300', length=205 → no match ─────────────────

console.log('\nT5: VALVE bore=100, rating=300, length=205 → no match');
{
  const row = { type: 'VALVE', convertedBore: 100, rating: '300', attributes: { lengthMm: 205 }, diagnostics: [], rowNo: 30 };
  const result = mapper.mapRow(row);
  assertEqual(result.valveWeightSource, 'WM-WEIGHT-CA8-NO-MATCH', 'source = WM-WEIGHT-CA8-NO-MATCH');
  assert(row.ca === undefined || row.ca?.['8'] === undefined, 'ca["8"] not set');
  assert(row.diagnostics.includes('WM-WEIGHT-CA8-NO-MATCH'), 'diagnostic pushed');
}

// ─── T6: Piping class and material NOT used as keys ──────────────────────────

console.log('\nT6: Piping class and material are NOT used as lookup keys');
{
  // Provide pipingClass and material that don't exist in master — should still match via bore/rating/length
  const row = {
    type: 'VALVE',
    convertedBore: 100,
    rating: '150',
    attributes: { lengthMm: 203, pipingClass: 'NONEXISTENT', material: 'UNKNOWN' },
    diagnostics: [],
    rowNo: 40,
  };
  const result = mapper.mapRow(row);
  assertEqual(result.valveWeightSource, 'WM-WEIGHT-CA8-MATCH', 'pipingClass/material ignored, match still found');
  assertEqual(row.ca['8'], '45 kg', 'ca["8"] = 45.0');
}

// ─── T7: SUPPORT row → skipped ───────────────────────────────────────────────

console.log('\nT7: SUPPORT row → skipped');
{
  const row = { type: 'SUPPORT', convertedBore: 100, rating: '150', attributes: { lengthMm: 205 }, diagnostics: [] };
  const result = mapper.mapRow(row);
  assert(result.valveWeightSource === null, 'valveWeightSource is null for SUPPORT row');
  assert(row.ca === undefined, 'ca not set on SUPPORT row');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Wave 6 Valve Weight: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
