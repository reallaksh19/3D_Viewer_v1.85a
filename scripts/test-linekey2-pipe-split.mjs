import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');

const mappingModule = await import(new URL(`file://${path.join(coreDir, 'linelist-mapping.js').replace(/\\/g, '/')}`).href);
const {
  buildColumnProbe,
  detectLineListFieldMap,
  pipeSegmentMatchesField,
  splitPipeSegments,
} = mappingModule;

const rows = [
  { Service: 'Service', ColumnX2: 'Line number' },
  { Service: 'S', ColumnX2: '8010125' },
  { Service: 'S', ColumnX2: '8010126' },
];

const probe = buildColumnProbe('ColumnX2', rows);
assert.strictEqual(probe, 'ColumnX2 | Line number | 8010125 | 8010126');
assert.deepStrictEqual(splitPipeSegments(probe), ['ColumnX2', 'Line number', '8010125', '8010126']);
assert.strictEqual(pipeSegmentMatchesField('lineKey2', probe), true);

const fieldMap = detectLineListFieldMap(rows);
assert.strictEqual(fieldMap.lineKey2, 'ColumnX2');

const numericOnlyRows = [
  { Service: 'Service', ColumnX3: '8010125' },
  { Service: 'S', ColumnX3: '8010126' },
];
const numericOnlyFieldMap = detectLineListFieldMap(numericOnlyRows);
assert.notStrictEqual(numericOnlyFieldMap.lineKey2, 'ColumnX3');

console.log('✅ lineKey2 pipe-split mapping test passed');
