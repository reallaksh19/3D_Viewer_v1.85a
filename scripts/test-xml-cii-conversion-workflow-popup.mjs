#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(condition, message) { if (!condition) { console.error(`❌ ${message}`); process.exit(1); } }

const popup = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');
const directPanels = read('viewer/tabs/model-converters/xml-cii-conversion-workflow-direct-panels.js');
const tab = read('viewer/tabs/model-converters-tab.js');

assert(fs.existsSync(path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js')), 'workflow popup module must exist');
assert(fs.existsSync(path.join(root, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-direct-panels.js')), 'workflow direct panels module must exist');
assert(popup.includes("import { WorkflowModal } from './shared/WorkflowModal.js'"), 'popup must reuse existing WorkflowModal');
assert(tab.includes('installXmlCiiConversionWorkflowPopup'), 'model-converters-tab must install workflow popup');

assert(popup.includes('XML - Model Data'), 'popup must include XML - Model Data as a main tab');
assert(popup.includes('Process / Piping Class / Wt. Enrichment'), 'popup must include Process / Piping Class / Wt. Enrichment as a main tab');
assert(!popup.includes("{ id: 'matched-audit'"), 'Matched Audit must not be a top-level workflow tab');
assert(!popup.includes("{ id: 'output-run'"), 'Output / Run Conversion must not be a top-level workflow tab');

for (const name of ['Json', 'Manual Restraints', 'Sideload JSON Config', 'Resolved Data', 'Output / Run Conversion', 'Matched Audit']) {
  assert(directPanels.includes(name), `XML - Model Data must render subtab: ${name}`);
}
assert(directPanels.includes('data-model-subtab'), 'XML - Model Data must render subtab buttons');
assert(directPanels.includes('data-model-subtab-body'), 'XML - Model Data must render a subtab body');

for (const oldPhase of ['1 Regex', '2 Import Masters', '3 Preview', '4 Diagnostics', '4A Weight Match', '5 Run', '6 Support Types', '7 Config']) {
  assert(directPanels.includes(oldPhase), `second tab must replicate old workflow phase: ${oldPhase}`);
}
for (const oldConcept of ['Old XML→CII workflow popup', 'XML->CII(2019) workflow', 'Regex Tester', 'Masters', 'Diagnostics Log', 'Support Type Mapper', 'Line List', 'Piping Class', 'Material Map', 'Weights / Valve CA8']) {
  assert(directPanels.includes(oldConcept), `second tab must include old workflow concept: ${oldConcept}`);
}
assert(directPanels.includes('OLD_XML_CII_WORKFLOW_PHASES'), 'second tab must use old workflow phase registry');
assert(directPanels.includes('data-old-xml-cii-phase'), 'second tab must render old workflow phase buttons');
assert(directPanels.includes('data-old-xml-cii-phase-body'), 'second tab must render old workflow detail body');

for (const fn of ['renderXmlCiiWorkflowModelDataPanel', 'renderXmlCiiWorkflowProcessEnrichmentPanel', 'renderXmlCiiWorkflowMatchedAuditPanel', 'renderXmlCiiWorkflowOutputRunPanel']) {
  assert(directPanels.includes(`export function ${fn}`), `direct panels module must export: ${fn}`);
}
assert(directPanels.includes('mc-preview-node-table'), 'direct panels must contain real table markup');
assert(directPanels.includes('data-direct-preview-filter'), 'matched audit must contain filter input');
assert(directPanels.includes('data-direct-diagnostics-file'), 'matched audit must allow diagnostics JSON import');
assert(!popup.includes('mountExistingPanel'), 'popup must not move live DOM panels by portal');
assert(!directPanels.includes('mountExistingPanel'), 'direct panels must not move live DOM panels by portal');
assert(!popup.includes('new MutationObserver'), 'popup must not install MutationObserver');
assert(!directPanels.includes('new MutationObserver'), 'direct panels must not install MutationObserver');

console.log('✅ XML CII two-tab conversion workflow popup static test passed', {
  topLevelTabs: 2,
  xmlModelDataSubtabs: 6,
  oldWorkflowPhases: 8,
});
