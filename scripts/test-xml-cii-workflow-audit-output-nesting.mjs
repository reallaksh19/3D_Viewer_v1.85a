import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditOutputPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-audit-output-nesting.js');
const installerPath = path.join(root, 'viewer/tabs/model-converters-tab.js');
const popupPath = path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const auditOutput = read(auditOutputPath);
const installer = read(installerPath);
const popup = read(popupPath);

assert(auditOutput.includes('MATCHED_AUDIT_STEPS'), 'Matched Audit nesting steps are missing.');
assert(auditOutput.includes('OUTPUT_CHECKLIST'), 'Output / Run Conversion checklist is missing.');
assert(auditOutput.includes('xmlCii2019.matchedPreview.lastDiagnostics.v1'), 'Matched Preview diagnostics storage contract is missing.');
assert(auditOutput.includes('xml-cii-matched-preview:diagnostics'), 'Matched Preview event contract is missing.');
assert(auditOutput.includes('data-xml-cii-matched-audit-nesting'), 'Matched Audit injected panel marker is missing.');
assert(auditOutput.includes('data-xml-cii-output-run-nesting'), 'Output / Run injected panel marker is missing.');
assert(auditOutput.includes('open-manual-restraints'), 'Manual restraints handoff is missing.');
assert(auditOutput.includes('open-sideload-diagnostics'), 'Diagnostics handoff is missing.');
assert(auditOutput.includes('Run Existing Conversion'), 'Existing run handoff is missing.');
assert(auditOutput.includes('Converter runtime') && auditOutput.includes('Unchanged'), 'Runtime unchanged marker is missing.');

assert(installer.includes('installXmlCiiConversionWorkflowAuditOutputNesting'), 'Installer does not register audit/output nesting.');
assert(installer.indexOf('installXmlCiiConversionWorkflowProcessNesting') < installer.indexOf('installXmlCiiConversionWorkflowAuditOutputNesting'), 'Audit/output nesting should install after popup/process nesting.');

assert(popup.includes("{ id: 'matched-audit'"), 'Popup Matched Audit tab is missing.');
assert(popup.includes("{ id: 'output-run'"), 'Popup Output / Run Conversion tab is missing.');
assert(!auditOutput.includes('xml_to_cii2019_direction.py'), 'Audit/output nesting must not call the Python converter directly.');
assert(!auditOutput.includes('applyManualMatchedFactsToEnrichedXml'), 'Audit/output nesting must not mutate enriched XML.');

console.log('✅ XML CII workflow audit/output nesting static test passed', {
  auditSteps: (auditOutput.match(/data-xml-cii-audit-action/g) || []).length,
  checklistItems: (auditOutput.match(/data-xml-cii-output-check/g) || []).length,
  converterRuntimeChanged: false,
});
