import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static wiring test for the RVM JSON/RVM → PCF workflow panel.
 *
 * The first safe wiring pass routes the app tab through a thin wrapper that
 * preserves the existing extract tab and injects the shared workflow panel into
 * the rail.
 */

const repoRoot = process.cwd();

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const appJs = readRepoFile('viewer/core/app.js');
const wrapperJs = readRepoFile('viewer/tabs/rvm-json-pcf-extract-tab-workflow-wired.js');

assert(
  appJs.includes("../tabs/rvm-json-pcf-extract-tab-workflow-wired.js"),
  'app registry must mount the workflow-wired RVM JSON PCF extract tab'
);

assert(
  wrapperJs.includes('mountBaseRvmJsonPcfExtractTab'),
  'wrapper must preserve the existing RVM JSON PCF extract tab mount'
);

assert(
  wrapperJs.includes('button.dataset.panel = WORKFLOW_PANEL_ID'),
  'wrapper must create a Workflow rail button using data-panel=workflow'
);

assert(
  wrapperJs.includes('mountRvmJsonPcfWorkflowPanel'),
  'wrapper must mount the shared JSON/RVM PCF workflow panel'
);

assert(
  wrapperJs.includes('createRvmJsonPcfWorkflowActions'),
  'wrapper must provide shared workflow actions to the workflow panel'
);

assert(
  wrapperJs.includes('requestedPanel === WORKFLOW_PANEL_ID'),
  'wrapper must open the workflow panel when requestedPanel=workflow is already in state'
);

assert(
  wrapperJs.includes('disposeBaseRvmJsonPcfExtractTab'),
  'wrapper must delegate cleanup to the existing extract tab dispose function'
);

console.log('rvm-pcf-workflow-panel-wiring.test.js passed');
