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

const modulePath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-model-data-nesting.js';
const tabPath = 'viewer/tabs/model-converters-tab.js';
const moduleText = read(modulePath);
const tabText = read(tabPath);

assert(fs.existsSync(path.join(root, modulePath)), 'model-data nesting module must exist');
assert(tabText.includes('installXmlCiiConversionWorkflowModelDataNesting'), 'model-converters-tab must import/install model-data nesting module');
assert(moduleText.includes('[data-xml-cii-popup-panel="sideload"]'), 'nesting module must target the existing popup sideload portal');
assert(moduleText.includes('data-xml-cii-model-data-nesting'), 'nesting module must insert a dedicated model-data shortcuts panel');
assert(moduleText.includes('data-sideload-tab-target'), 'nesting module must route shortcuts to existing sideload sub-tabs');
assert(moduleText.includes('xmlCii2019.sideload.activeSubtab'), 'nesting module must preserve existing sideload active subtab storage');
assert(!moduleText.includes('runJob({'), 'model-data nesting must not call converter runtime directly');

for (const label of [
  'Input XML / JSON Import',
  'Resolver Index',
  'JSON Config',
  'JSON Resolved Data',
  'PS → Node',
  'POS → Node',
  'Manual Restraints',
  'Diagnostics',
]) {
  assert(moduleText.includes(label), `model-data nesting must include step: ${label}`);
}

for (const sideloadTab of [
  'resolver',
  'json-config',
  'json-data',
  'ps',
  'pos',
  'restraints',
  'diagnostics',
]) {
  assert(moduleText.includes(`sideloadTab: '${sideloadTab}'`), `model-data nesting must route to sideload tab: ${sideloadTab}`);
}

console.log('✅ XML CII workflow model-data nesting static test passed', {
  steps: 8,
  sideloadRoutes: 7,
  converterRuntimeChanged: false,
});
