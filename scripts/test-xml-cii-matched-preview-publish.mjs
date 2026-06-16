import { readFileSync } from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const runnerPath = 'viewer/tabs/model-converters/converters/xmltocii2019_runner.js';
const previewUiPath = 'viewer/tabs/model-converters/xml-cii-matched-preview-ui.js';

const runner = readRepoFile(runnerPath);
const previewUi = readRepoFile(previewUiPath);

const eventName = 'xml-cii-matched-preview:diagnostics';
const storageKey = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';

assert(runner.includes(eventName), `${runnerPath} must publish the Matched Preview diagnostics event.`);
assert(previewUi.includes(eventName), `${previewUiPath} must listen to the Matched Preview diagnostics event.`);
assert(runner.includes(storageKey), `${runnerPath} must write the Matched Preview latest-run storage key.`);
assert(previewUi.includes(storageKey), `${previewUiPath} must read the Matched Preview latest-run storage key.`);

assert(
  runner.includes('publishMatchedPreviewDiagnostics(diagnosticPayload)'),
  `${runnerPath} must publish the same diagnostics payload it writes to the output JSON.`,
);
assert(
  runner.includes("source: 'latest-run'"),
  `${runnerPath} diagnostics payload must identify auto-loaded data as latest-run.`,
);
assert(
  runner.includes('matchedFacts: enriched.matchedFacts || []') && runner.includes('rejectedFacts: enriched.rejectedFacts || []'),
  `${runnerPath} diagnostics payload must include matchedFacts and rejectedFacts.`,
);
assert(
  previewUi.includes("fact?.status === 'MATCHED'"),
  `${previewUiPath} must keep Matched Preview matched-only.`,
);
assert(
  previewUi.includes('Refresh Latest Run'),
  `${previewUiPath} must expose a manual latest-run refresh fallback.`,
);

console.log('PASS: XML→CII Matched Preview publish/listen contract is wired.');
