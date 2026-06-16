#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const tabPath = path.join(repoRoot, 'viewer/tabs/model-converters-tab.js');
const popupPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js');

const tabSource = fs.readFileSync(tabPath, 'utf8');
const popupSource = fs.readFileSync(popupPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(/renderLegacyModelConvertersTab\(container, ctx\)/.test(tabSource), 'legacy model converter tab must render first');
assert(/scheduleInstaller\(/.test(tabSource), 'optional installers must be scheduled/deferred');
assert(/installSafely\(/.test(tabSource), 'optional installers must be guarded');
assert(/catch \(error\)/.test(tabSource), 'installer failures must be caught and logged');
assert(/Optional installer failed/.test(tabSource), 'installer failure log must identify optional installer errors');
assert(!/installXmlCiiSideloadUi/.test(tabSource), 'heavy XML CII sideload observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiMatchedPreviewUi/.test(tabSource), 'heavy XML CII matched-preview observer installer must not auto-run from Model Converter tab');
assert(!/installXmlCiiConversionWorkflowPolish/.test(tabSource), 'workflow polish observer must not auto-run from Model Converter tab');
assert(/setTimeout\(run, 0\)/.test(tabSource), 'deferred installer scheduler must use timeout to keep legacy render responsive');

assert(!/new MutationObserver/.test(popupSource), 'lean popup launcher must not install MutationObserver');
assert(!/mountExistingPanel/.test(popupSource), 'lean popup launcher must not move live panels by DOM portal');
assert(/document\.addEventListener\('click', interceptRun, true\)/.test(popupSource), 'lean popup must intercept XML→CII run click through a single capture listener');

console.log('✅ model converters tab lean responsiveness static test passed');
