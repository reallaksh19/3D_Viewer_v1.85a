import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');
const { resolveMaterialCodeFromLineMaterial } = await import(new URL(`file://${path.join(coreDir, 'branch-process-resolver.js').replace(/\\/g, '/')}`).href);

const materialMap = [
  { code: '106', material: 'A106-B' },
  { code: '102', material: 'A53-B' },
];

const resolved = resolveMaterialCodeFromLineMaterial({
  lineRow: { material: 'ASTM A106-B' },
  materialMap,
  pipingClassRow: null,
  overrides: {},
  overrideKeys: ['S8810101'],
});

assert.strictEqual(resolved.materialCode, '106');
assert.strictEqual(resolved.source, 'line-list-material-map');

const overridden = resolveMaterialCodeFromLineMaterial({
  lineRow: { material: 'ASTM A106-B' },
  materialMap,
  pipingClassRow: null,
  overrides: { materialCode: { 'ASTM A106-B': '999' } },
  overrideKeys: ['S8810101'],
});

assert.strictEqual(overridden.materialCode, '999');
assert.strictEqual(overridden.source, 'override');

console.log('✅ material map resolver regression tests passed');
