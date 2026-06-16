import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VENDOR_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../third_party/pipe-component-data');
const manifest = JSON.parse(readFileSync(join(VENDOR_DIR, 'VENDOR-MANIFEST.json'), 'utf8'));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test('vendored pipe-component-data matches manifest hashes (drift guard)', () => {
  const files = walk(join(VENDOR_DIR, 'src'));
  const tree = createHash('sha256');
  const seen = {};
  for (const p of files) {
    const rel = relative(VENDOR_DIR, p);
    const bytes = readFileSync(p);
    seen[rel] = createHash('sha256').update(bytes).digest('hex');
    tree.update(rel).update('\0').update(bytes);
  }
  assert.deepEqual(seen, manifest.fileHashes, 'vendored file set or contents drifted from manifest');
  assert.equal(tree.digest('hex'), manifest.treeSha256, 'treeSha256 drifted');
});

test('fromUxmlXml plain-attribute patch is present in vendored snapshot', () => {
  const text = readFileSync(join(VENDOR_DIR, 'src/parse/fromUxmlXml.js'), 'utf8');
  assert.ok(text.includes('readPlainAttributes'), 'patch missing: readPlainAttributes not found');
});

test('vendored core has no three/DOM/localStorage/zustand imports (purity guard)', () => {
  const forbidden = [/from ['"]three['"]/, /\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /from ['"]zustand['"]/];
  for (const p of walk(join(VENDOR_DIR, 'src'))) {
    const text = readFileSync(p, 'utf8');
    for (const re of forbidden) {
      assert.ok(!re.test(text), `${relative(VENDOR_DIR, p)} matches forbidden pattern ${re}`);
    }
  }
});

test('vendored package exports the sentinel API surface', async () => {
  const pcd = await import(join(VENDOR_DIR, 'src/index.js'));
  for (const name of [
    'createPipeDataDb', 'enrichWithPipeData', 'toCeg', 'fromCeg',
    'toUxmlXml', 'fromUxmlXml', 'toCanonicalGeometry', 'namespaceImportedIds',
    'createWorkbenchModel', 'toSolid3dSpecs', 'resolveConnectivity',
  ]) {
    assert.equal(typeof pcd[name], 'function', `missing export: ${name}`);
  }
});
