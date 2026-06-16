/**
 * Wave 4 - RvmPipelineRefResolver + RvmBoreConverter unit tests
 * Plain Node ESM, no jsdom / three.js.
 */

import { RvmPipelineRefResolver } from '../../../rvm-pcf-extract/RvmPipelineRefResolver.js';
import { RvmBoreConverter } from '../../../rvm-pcf-extract/RvmBoreConverter.js';
import { RvmFinal2dCsvBuilder } from '../../../rvm-pcf-extract/RvmFinal2dCsvBuilder.js';

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

console.log('\nWave 4 - RvmPipelineRefResolver + RvmBoreConverter\n');

{
  const resolver = new RvmPipelineRefResolver({ nodes: [] });
  const node = { canonicalObjectId: 'N1', attributes: { PIPELINE_REF: 'LINE-100' } };
  const result = resolver.resolve(node, []);
  assertEqual(result.source, 'PIPELINE-REF-DIRECT', 'T1: source=PIPELINE-REF-DIRECT');
  assertEqual(result.pipelineRef, 'LINE-100', 'T1: pipelineRef=LINE-100');
}

{
  const parentNode = { canonicalObjectId: 'P1', name: 'MainPipe', kind: 'PIPE', attributes: {} };
  const rvmIndex = { nodes: [parentNode] };
  const resolver = new RvmPipelineRefResolver(rvmIndex);
  const node = { canonicalObjectId: 'N2', attributes: {} };
  const result = resolver.resolve(node, [parentNode]);
  assertEqual(result.source, 'PIPELINE-REF-PARENT-PIPE', 'T2: source=PIPELINE-REF-PARENT-PIPE');
  assertEqual(result.pipelineRef, 'MainPipe', 'T2: pipelineRef=MainPipe');
}

{
  const resolver = new RvmPipelineRefResolver({ nodes: [] });
  const node = { canonicalObjectId: 'N3', attributes: {} };
  const result = resolver.resolve(node, []);
  assertEqual(result.source, 'PIPELINE-REF-FALLBACK', 'T3: source=PIPELINE-REF-FALLBACK');
  assertEqual(result.pipelineRef, 'RVM-EXTRACT', 'T3: pipelineRef=RVM-EXTRACT');
}

{
  const rootNode = { canonicalObjectId: 'ROOT1', name: 'RootLine-A', kind: 'MISC', attributes: {} };
  const rvmIndex = { nodes: [rootNode] };
  const resolver = new RvmPipelineRefResolver(rvmIndex, { selectedRootIds: ['ROOT1'] });
  const node = { canonicalObjectId: 'N4', attributes: {} };
  const result = resolver.resolve(node, [rootNode]);
  assertEqual(result.source, 'PIPELINE-REF-SELECTED-ROOT', 'T4: source=PIPELINE-REF-SELECTED-ROOT');
  assertEqual(result.pipelineRef, 'RootLine-A', 'T4: pipelineRef=RootLine-A');
}

const bc = new RvmBoreConverter();

{
  const r = bc.convertBore('4"');
  assertEqual(r.convertedBore, 100, 'T5: 4" -> convertedBore=100');
  assertEqual(r.convertedBoreSource, 'NPS-INCH', 'T5: source=NPS-INCH');
}

{
  const r = bc.convertBore('1-1/2"');
  assertEqual(r.convertedBore, 40, 'T6: 1-1/2" -> convertedBore=40');
  assertEqual(r.convertedBoreSource, 'NPS-INCH', 'T6: source=NPS-INCH');
}

{
  const r = bc.convertBore('1/2"');
  assertEqual(r.convertedBore, 15, 'T7: 1/2" -> convertedBore=15');
  assertEqual(r.convertedBoreSource, 'NPS-INCH', 'T7: source=NPS-INCH');
}

{
  const r = bc.convertBore(114.3);
  assertEqual(r.convertedBore, 100, 'T8: 114.3 -> convertedBore=100');
  assertEqual(r.convertedBoreSource, 'OD-MM', 'T8: source=OD-MM');
}

{
  const r = bc.convertBore('DN100');
  assertEqual(r.convertedBore, 100, 'T9: DN100 -> convertedBore=100');
  assertEqual(r.convertedBoreSource, 'DN-STRING', 'T9: source=DN-STRING');
}

{
  const r = bc.convertBore(100);
  assertEqual(r.convertedBore, 100, 'T10: 100 -> convertedBore=100');
  assertEqual(r.convertedBoreSource, 'DN-PASSTHROUGH', 'T10: source=DN-PASSTHROUGH');
}

{
  const r = bc.convertBore('250mm');
  assertEqual(r.convertedBore, 250, 'T11: 250mm -> convertedBore=250');
  assertEqual(r.convertedBoreSource, 'DN-MM', 'T11: source=DN-MM');
}

{
  const parsed = bc.parseLineKeyBoreMm('/BTRM-1000-10"-P1710011-66620M0-01/B1');
  assertEqual(parsed, 250, 'T12: line-key with 10" resolves to DN250');
}

{
  const mockIndex = {
    nodes: [
      {
        canonicalObjectId: 'ROOT1',
        parentCanonicalObjectId: null,
        name: 'RootLine-A',
        kind: 'MISC',
        path: 'Root/RootLine-A',
        attributes: {},
      },
      {
        canonicalObjectId: 'N1',
        parentCanonicalObjectId: 'ROOT1',
        name: 'Line-200',
        kind: 'PIPE',
        path: 'Root/RootLine-A/Line-200',
        attributes: {
          APOS: '{"x":0,"y":0,"z":0}',
          LPOS: 'E 1000mm N 0mm U 0mm',
          BORE: '250mm',
        },
      },
    ],
  };

  const builder = new RvmFinal2dCsvBuilder(mockIndex, {
    selectedCanonicalIds: ['N1'],
    selectedRootIds: ['ROOT1'],
  });
  const { rows } = builder.build();
  const row = rows[0];

  assert(row != null, 'T13: row exists');
  assert('pipelineRef' in row, 'T13: row has pipelineRef field');
  assert('convertedBore' in row, 'T13: row has convertedBore field');
  assertEqual(row.pipelineRef, 'RootLine-A', 'T13: pipelineRef from selected root');
  assertEqual(row.convertedBore, 250, 'T13: convertedBore=250 (from 250mm)');
  assertEqual(row.ep1, { x: 0, y: 0, z: 0 }, 'T13: ep1 parsed from JSON string');
  assertEqual(row.ep2, { x: 1000, y: 0, z: 0 }, 'T13: ep2 parsed from AVEVA text');
  assert('pipelineRefSource' in row, 'T13: row has pipelineRefSource field');
  assert('convertedBoreSource' in row, 'T13: row has convertedBoreSource field');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
