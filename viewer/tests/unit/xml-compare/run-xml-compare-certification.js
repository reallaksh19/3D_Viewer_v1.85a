import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const TESTS = [
  'viewer/tests/unit/xml-compare/xml-compare-x12-topology-issues-behavior.test.js',
  'viewer/tests/unit/xml-compare/xml-compare-x12-topology-issues-ui-markers.test.js',
  'viewer/tests/unit/xml-compare/xml-compare-x13-topology-filter-behavior.test.js',
  'viewer/tests/unit/xml-compare/xml-compare-x13-topology-filter-ui-markers.test.js',
];

for (const relativePath of TESTS) {
  const abs = path.resolve(relativePath);
  const result = spawnSync(process.execPath, [abs], { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('[PASS] XML Compare certification passed.');
