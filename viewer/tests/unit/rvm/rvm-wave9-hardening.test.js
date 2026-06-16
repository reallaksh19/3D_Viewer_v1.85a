import { RvmExtractHardening } from '../../../rvm-pcf-extract/RvmExtractHardening.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

function assertEqual(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

const h = new RvmExtractHardening();

// T1: sortRows — alphabetical by pipelineRef
{
  const rows = [
    { pipelineRef: 'C-LINE', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
    { pipelineRef: 'A-LINE', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
    { pipelineRef: 'B-LINE', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
  ];
  const sorted = h.sortRows(rows);
  assert(sorted[0].pipelineRef === 'A-LINE' && sorted[1].pipelineRef === 'B-LINE' && sorted[2].pipelineRef === 'C-LINE',
    'T1: sortRows alphabetical by pipelineRef');
}

// T2: sortRows — rowNo reassigned as 10, 20, 30
{
  const rows = [
    { pipelineRef: 'Z', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
    { pipelineRef: 'A', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
    { pipelineRef: 'M', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
  ];
  const sorted = h.sortRows(rows);
  assert(sorted[0].rowNo === 10 && sorted[1].rowNo === 20 && sorted[2].rowNo === 30,
    'T2: sortRows rowNo = 10, 20, 30');
}

// T3: CA98 assigned from rowNo when not preset; existing CA98 preserved
{
  const rows = [
    { pipelineRef: 'A', type: 'PIPE', sourcePath: '', sourceCanonicalId: '', ca: { '98': 999 } },
    { pipelineRef: 'B', type: 'PIPE', sourcePath: '', sourceCanonicalId: '' },
  ];
  const sorted = h.sortRows(rows);
  assert(sorted[0].ca['98'] === 999, 'T3: existing CA98 preserved');
  assert(sorted[1].ca['98'] === 20, 'T3: CA98 assigned from rowNo when not preset');
}

// T4: exportMasters
{
  const masters = { bore: { '50': 2 } };
  const result = h.exportMasters(masters);
  assert(result.schema === 'rvm-json-pcf-extract-masters/v1', 'T4: schema field correct');
  assert(typeof result.exportedAt === 'string' && result.exportedAt.length > 0, 'T4: exportedAt present');
  assertEqual(result.masters, masters, 'T4: masters preserved');
}

// T5: importMasters with { masters: { a: 1 } }
{
  const result = h.importMasters({ masters: { a: 1 } });
  assertEqual(result.masters, { a: 1 }, 'T5: masters extracted');
  assertEqual(result.diagnostics, [], 'T5: diagnostics empty');
}

// T6: importMasters with raw { a: 1 }
{
  const result = h.importMasters({ a: 1 });
  assertEqual(result.masters, { a: 1 }, 'T6: raw object returned as masters');
}

// T7: importMasters with bad JSON string
{
  const result = h.importMasters('not valid json {{{');
  assert(result.masters === null, 'T7: masters=null on bad JSON');
  assert(result.diagnostics.includes('MASTERS-IMPORT-FAILED'), 'T7: MASTERS-IMPORT-FAILED in diagnostics');
}

// T8: resolveValveAmbiguity
{
  const rows = [
    {
      rowNo: 10,
      type: 'VALVE',
      ca: {},
      ambiguousValveWeightRequests: [
        { candidates: [{ weight: 5.5 }, { weight: 7.0 }] }
      ],
    }
  ];
  const { resolved, row } = h.resolveValveAmbiguity(rows, 10, 0);
  assert(resolved === true, 'T8: resolved=true');
  assert(row.ca['8'] === 5.5, 'T8: ca[8] set to candidate weight');
  assert(row.ambiguousValveWeightRequests.length === 0, 'T8: ambiguousValveWeightRequests cleared');
  assert(row.valveWeightSource === 'WM-VALVE-CA8-RESOLVED', 'T8: valveWeightSource set');
}

// T9: buildValidationRegister — MISSING-GEOMETRY → severity='ERROR'
{
  const rows = [{ rowNo: 10, type: 'PIPE', name: 'P1', pipelineRef: 'L1', sourceCanonicalId: 'id1', diagnostics: ['MISSING-GEOMETRY'] }];
  const reg = h.buildValidationRegister(rows);
  assert(reg.length === 1 && reg[0].severity === 'ERROR', 'T9: MISSING-GEOMETRY → ERROR');
}

// T10: buildValidationRegister — BRLEN-UNRESOLVED → severity='WARNING'
{
  const rows = [{ rowNo: 10, type: 'PIPE', name: 'P1', pipelineRef: 'L1', sourceCanonicalId: 'id1', diagnostics: ['BRLEN-UNRESOLVED'] }];
  const reg = h.buildValidationRegister(rows);
  assert(reg.length === 1 && reg[0].severity === 'WARNING', 'T10: BRLEN-UNRESOLVED → WARNING');
}

// T11: buildValidationRegister — INFO-LEVEL-CODE → severity='INFO'
{
  const rows = [{ rowNo: 10, type: 'PIPE', name: 'P1', pipelineRef: 'L1', sourceCanonicalId: 'id1', diagnostics: ['INFO-LEVEL-CODE'] }];
  const reg = h.buildValidationRegister(rows);
  assert(reg.length === 1 && reg[0].severity === 'INFO', 'T11: INFO-LEVEL-CODE → INFO');
}

// T12: downloadAllPcf — Node env (no document), returns one ZIP for multiple PCFs
{
  const result = h.downloadAllPcf({ 'LINE-A': 'pcf text A', 'LINE-B': 'pcf text B' });
  assert(Array.isArray(result) && result.length === 1 && result[0].endsWith('.zip'),
    'T12: downloadAllPcf returns one ZIP filename in Node env for multiple PCFs');
}

// T13: deterministic order — same input → same output order
{
  const makeRows = () => [
    { pipelineRef: 'C', type: 'ELBOW', sourcePath: 'p', sourceCanonicalId: 'c3' },
    { pipelineRef: 'A', type: 'PIPE', sourcePath: 'p', sourceCanonicalId: 'c1' },
    { pipelineRef: 'B', type: 'VALVE', sourcePath: 'p', sourceCanonicalId: 'c2' },
  ];
  const r1 = h.sortRows(makeRows()).map(r => r.pipelineRef);
  const r2 = h.sortRows(makeRows()).map(r => r.pipelineRef);
  assertEqual(r1, r2, 'T13: deterministic order same every time');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
