import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const polishPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-polish.js');
const installerPath = path.join(root, 'viewer/tabs/model-converters-tab.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const polish = read(polishPath);
const installer = read(installerPath);

assert(polish.includes('DIAGNOSTICS_STORAGE_KEY'), 'Diagnostics storage contract is missing.');
assert(polish.includes('xmlCii2019.matchedPreview.lastDiagnostics.v1'), 'Matched Preview localStorage key is missing.');
assert(polish.includes('xml-cii-matched-preview:diagnostics'), 'Matched Preview refresh event is missing.');
assert(polish.includes('data-xml-cii-workflow-polish-exports'), 'Export/counts panel marker is missing.');
assert(polish.includes('data-xml-cii-polish-export="matched"'), 'matchedFacts export action is missing.');
assert(polish.includes('data-xml-cii-polish-export="rejected"'), 'rejectedFacts export action is missing.');
assert(polish.includes('data-xml-cii-polish-export="diagnostics-csv"'), 'diagnostics CSV export action is missing.');
assert(polish.includes('diagnosticsToCsv'), 'diagnostics CSV serializer is missing.');
assert(polish.includes('tab.dataset.xmlCiiWorkflowBadge'), 'workflow tab badge updater is missing.');
assert(polish.includes("M:${stats.matched.length} R:${stats.rejected.length}"), 'Matched Audit tab count badge is missing.');
assert(polish.includes('installXmlCiiConversionWorkflowPolish'), 'polish installer export is missing.');
assert(!polish.includes('xml_to_cii2019_direction.py'), 'polish module must not call the Python converter directly.');
assert(!polish.includes('applyManualMatchedFactsToEnrichedXml'), 'polish module must not mutate enriched XML.');

assert(installer.includes('installXmlCiiConversionWorkflowPolish'), 'model-converters-tab must install popup polish.');
assert(installer.indexOf('installXmlCiiConversionWorkflowAuditOutputNesting') < installer.indexOf('installXmlCiiConversionWorkflowPolish'), 'polish must install after audit/output nesting.');

console.log('✅ XML CII workflow polish static test passed', {
  exports: 3,
  badges: 4,
  converterRuntimeChanged: false,
});
