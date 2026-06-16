#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const modulePath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-process-nesting.js';
const popupPath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js';
const tabPath = 'viewer/tabs/model-converters-tab.js';
const moduleText = read(modulePath);
const popupText = read(popupPath);
const tabText = read(tabPath);

assert(fs.existsSync(path.join(root, modulePath)), 'process enrichment nesting module must exist');
assert(tabText.includes('installXmlCiiConversionWorkflowProcessNesting'), 'model-converters-tab must import/install process nesting module');
assert(popupText.includes('Process / Piping Class / Wt. Enrichment'), 'workflow popup must keep the process enrichment top-level tab');
assert(moduleText.includes('data-xml-cii-process-enrichment-nesting'), 'process nesting module must insert a dedicated nested panel');
assert(moduleText.includes('data-existing-phase-target'), 'process nesting module must route buttons to existing XML→CII workflow phases');
assert(moduleText.includes('xmlCii2019.processEnrichment.activeStep.v1'), 'process nesting module must persist active nested step');
assert(!moduleText.includes('runJob({'), 'process nesting must not call converter runtime directly');
assert(!moduleText.includes('xml_to_cii2019_direction.py'), 'process nesting must not call Python converter directly');

for (const label of [
  'Regex / Line Key Matching',
  'Process Data Mapping',
  'Piping Class Mapping',
  'Material Map',
  'Weight Enrichment',
  'Valve / CA8 Mapping',
  'Rating / Bore / Class Review',
  'Support Mapping',
  'Enrichment Preview',
  'Diagnostics Dry Run',
  'Config JSON',
  'Existing Run Step',
]) {
  assert(moduleText.includes(label), `process nesting must include step: ${label}`);
}

for (const phase of [
  'regex',
  'import-masters',
  'weight-match',
  'support-mapper',
  'preview',
  'diagnostics',
  'config',
  'run',
]) {
  assert(moduleText.includes(`phase: '${phase}'`) || moduleText.includes(`phase: "${phase}"`), `process nesting must route to existing phase: ${phase}`);
}

console.log('✅ XML CII workflow process enrichment nesting static test passed', {
  groups: 3,
  steps: 12,
  existingPhases: 8,
  converterRuntimeChanged: false,
});
