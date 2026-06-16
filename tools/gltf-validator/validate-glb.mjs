import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { validateBytes } from 'gltf-validator';

function countIssues(report = {}) {
  const messages = report?.issues?.messages || [];
  return messages.reduce((acc, issue) => {
    const severity = String(issue?.severity || '').toUpperCase();
    if (severity === 'ERROR') acc.errorCount += 1;
    else if (severity === 'WARNING') acc.warningCount += 1;
    else if (severity === 'INFO') acc.infoCount += 1;
    else if (severity === 'HINT') acc.hintCount += 1;
    return acc;
  }, {
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hintCount: 0,
  });
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node tools/gltf-validator/validate-glb.mjs <file.glb>');
  process.exit(2);
}

const bytes = await readFile(inputPath);
const report = await validateBytes(new Uint8Array(bytes), {
  uri: path.basename(inputPath),
  maxIssues: 500,
});

const counts = countIssues(report);
const summary = {
  schema: 'glb-validation-summary/v1',
  file: inputPath,
  valid: counts.errorCount === 0,
  ...counts,
  asset: report?.info || {},
  report,
};

await writeFile(`${inputPath}.validation.json`, JSON.stringify(summary, null, 2));

console.log(JSON.stringify({
  file: inputPath,
  valid: summary.valid,
  errorCount: summary.errorCount,
  warningCount: summary.warningCount,
  infoCount: summary.infoCount,
  hintCount: summary.hintCount,
}, null, 2));

if (!summary.valid) process.exit(1);
