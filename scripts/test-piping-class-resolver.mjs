import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');
const resolver = await import(new URL(`file://${path.join(coreDir, 'piping-class-resolver.js').replace(/\\/g, '/')}`).href);

const {
  buildPipingClassIndex,
  resolveApproximatePipingClass,
  findBestPipingClassRow,
} = resolver;

const index = buildPipingClassIndex([
  { 'Piping Class': '91261', convertedBore: 150, Corrosion: 3, 'Wall Thickness': 7.11, Rating: '900', componentType: 'PIPE' },
  { 'Piping Class': '91260', convertedBore: 150, Corrosion: 1.5, 'Wall Thickness': 6.02, Rating: '900', componentType: 'PIPE' },
]);

const approx = resolveApproximatePipingClass({
  requestedClass: '91261M7',
  pipingClassIndex: index,
});

assert.strictEqual(approx.pipingClass, '91261');
assert.strictEqual(approx.method, 'leading-numeric-base');
assert.strictEqual(approx.needsReview, true);
assert.ok(approx.candidates.some((candidate) => candidate.candidate === '91260'));

const redundantOverride = resolveApproximatePipingClass({
  requestedClass: '91261M7',
  pipingClassIndex: index,
  overrides: { pipingClass: { '91261M7': '91261' } },
});

assert.strictEqual(redundantOverride.pipingClass, '91261');
assert.strictEqual(redundantOverride.method, 'leading-numeric-base');
assert.strictEqual(redundantOverride.needsReview, true);
assert.ok(redundantOverride.reasons.includes('redundant-override-same-as-auto'));

const override = resolveApproximatePipingClass({
  requestedClass: '91261M7',
  pipingClassIndex: index,
  overrides: { pipingClass: { '91261M7': '91260' } },
});

assert.strictEqual(override.pipingClass, '91260');
assert.strictEqual(override.method, 'override');
assert.strictEqual(override.needsReview, false);

const rowMatch = findBestPipingClassRow({
  pipingClass: '91261M7',
  boreMm: 150,
  componentType: 'RIGID',
  rating: '900',
  pipingClassIndex: index,
});

assert.strictEqual(rowMatch.classMatch.pipingClass, '91261');
assert.strictEqual(rowMatch.classMatch.needsReview, true);
assert.strictEqual(rowMatch.row.Corrosion, 3);
assert.ok(rowMatch.score >= 1000);

console.log('✅ piping class resolver regression tests passed');
