import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

const scripts = [
  'scripts/test-xml-cii-json-config.mjs',
  'scripts/test-xml-cii-sideload-benchmark.mjs',
  'scripts/test-xml-cii-matched-preview-publish.mjs',
  'scripts/test-xml-cii-sideload-preview-chain.mjs',
  'scripts/test-xml-cii-conversion-workflow-popup.mjs',
  'scripts/test-model-converters-tab-responsive.mjs',
];

const missing = scripts.filter((script) => !fs.existsSync(path.join(repoRoot, script)));
if (missing.length) {
  console.error('❌ Missing XML CII test script(s):');
  for (const script of missing) console.error(`  - ${script}`);
  process.exit(1);
}

const results = [];
for (const script of scripts) {
  console.log(`\n▶ ${script}`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, script)], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  results.push({ script, status: result.status ?? 1 });
  if (result.error) {
    console.error(`❌ ${script} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`❌ ${script} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✅ XML CII aggregate test runner passed', {
  scripts: results.length,
  workflowMode: 'lean-popup',
});
