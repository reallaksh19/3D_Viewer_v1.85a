import assert from 'node:assert/strict';

import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { applyInputXmlCaesarSupportMetadata } from '../converters/inputxml-glb/InputXmlCaesarSupportMetadata.js';
import { appendInputXmlGlbNodeLabels } from '../converters/inputxml-glb/InputXmlGlbNodeLabels.js';
import { adaptUxmlToGlbModel } from '../converters/inputxml-glb/UxmlToGlbModelAdapter.js';
import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';

const xmlText = [
  '<CAESARII>',
  '<PIPINGMODEL LineNo="L-200-A">',
  '<PIPINGELEMENT FROM_NODE="200" TO_NODE="205" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20">',
  '<RESTRAINT NODE="205" TYPE="1" XCOSINE="0" YCOSINE="1" ZCOSINE="0"/>',
  '</PIPINGELEMENT>',
  '</PIPINGMODEL>',
  '</CAESARII>',
].join('');

const extracted = extractInputXmlBranches(xmlText, {
  sourceId: 'line-no-node-label-test',
  fileName: 'line-no.xml',
});

assert.equal(extracted.ok, true);
assert.equal(extracted.branches[0]?.lineNo, 'L-200-A');

applyInputXmlCaesarSupportMetadata(xmlText, extracted.doc, { sourceId: 'line-no-node-label-test' });
const { model, stats } = adaptUxmlToGlbModel(extracted.doc);
const nodeLabelStats = appendInputXmlGlbNodeLabels(model, extracted.doc, stats);

assert.equal(model.lineNo, 'L-200-A');
assert.deepEqual(model.lineNos, ['L-200-A']);
assert.equal(stats.lineNo, 'L-200-A');
assert.deepEqual(stats.lineNos, ['L-200-A']);

const nodeNumbers = [...new Set(extracted.doc.anchors.map((anchor) => anchor.nodeNumber).filter(Boolean))].sort();
assert.deepEqual(nodeNumbers, ['200', '205']);
assert.equal(nodeLabelStats.nodeLabelCount, 2);

const nodeLabels = model.components
  .filter((component) => component.type === 'NODE_LABEL')
  .map((component) => component.label)
  .sort();
assert.deepEqual(nodeLabels, ['200', '205']);
assert.ok(nodeLabels.every((label) => !/EP[12]|SUPPORT_POINT|IX-A/i.test(label)));

const pipe = model.components.find((component) => component.type === 'PIPE');
assert.ok(pipe);
assert.equal(pipe.lineNo, 'L-200-A');
assert.equal(pipe.attributes.lineNo, 'L-200-A');

const scene = buildExportScene(model);
const root = scene.getObjectByName('PCF_EXPORT_ROOT');
assert.ok(root);
assert.equal(root.userData.lineNo, 'L-200-A');
assert.deepEqual(root.userData.lineNos, ['L-200-A']);

const pipeObject = scene.getObjectByName(pipe.id);
assert.ok(pipeObject);
assert.equal(pipeObject.userData.lineNo, 'L-200-A');

const caesarJobPathXml = [
  '<CAESARII>',
  '<PIPINGMODEL JOBNAME="C:\\PROGRAMDATA\\INTERGRAPH CAS\\CAESAR II\\11.00\\EXAMPLES\\BM_CII._A">',
  '<PIPINGELEMENT FROM_NODE="200" TO_NODE="205" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20"/>',
  '</PIPINGMODEL>',
  '</CAESARII>',
].join('');

const jobPathExtracted = extractInputXmlBranches(caesarJobPathXml, {
  sourceId: 'job-path-line-no-test',
  fileName: 'BM_CII.xml',
});
assert.equal(jobPathExtracted.ok, true);
assert.equal(jobPathExtracted.branches[0]?.lineNo, '');

const jobPathAdapted = adaptUxmlToGlbModel(jobPathExtracted.doc);
assert.equal(jobPathAdapted.model.lineNo, '');
assert.deepEqual(jobPathAdapted.model.lineNos, []);
const jobPathPipe = jobPathAdapted.model.components.find((component) => component.type === 'PIPE');
assert.ok(jobPathPipe);
assert.equal(jobPathPipe.lineNo, '');
assert.equal(jobPathPipe.attributes.lineNo, '');

const jobPathScene = buildExportScene(jobPathAdapted.model);
const jobPathRoot = jobPathScene.getObjectByName('PCF_EXPORT_ROOT');
assert.equal(jobPathRoot.userData.lineNo, '');
assert.deepEqual(jobPathRoot.userData.lineNos, []);

const branchNameXml = [
  '<CAESARII>',
  '<PIPINGMODEL JOBNAME="C:\\TEMP\\IGNORED_JOB" BranchName="/ASIM-1885-10-S8810101-91261M7-HC/B1">',
  '<PIPINGELEMENT FROM_NODE="300" TO_NODE="305" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20"/>',
  '</PIPINGMODEL>',
  '</CAESARII>',
].join('');
const branchNameExtracted = extractInputXmlBranches(branchNameXml, {
  sourceId: 'branch-name-line-no-test',
  fileName: 'branch.xml',
});
assert.equal(branchNameExtracted.branches[0]?.lineNo, '/ASIM-1885-10-S8810101-91261M7-HC/B1');
const branchNameAdapted = adaptUxmlToGlbModel(branchNameExtracted.doc);
assert.equal(branchNameAdapted.model.lineNo, '/ASIM-1885-10-S8810101-91261M7-HC/B1');
const branchNameScene = buildExportScene(branchNameAdapted.model);
const branchNameRoot = branchNameScene.getObjectByName('PCF_EXPORT_ROOT');
assert.equal(branchNameRoot.userData.lineNo, '/ASIM-1885-10-S8810101-91261M7-HC/B1');
assert.deepEqual(branchNameRoot.userData.lineNos, ['/ASIM-1885-10-S8810101-91261M7-HC/B1']);

const branchOnlyScene = buildExportScene({
  components: [{
    id: 'BRANCH-ONLY-PIPE',
    type: 'PIPE',
    bore: 20,
    ep1: { x: 0, y: 0, z: 0 },
    ep2: { x: 100, y: 0, z: 0 },
    attributes: { BranchName: '/ASIM-1885-10-S8810101-91261M7-HC/B2' },
  }],
});
const branchOnlyRoot = branchOnlyScene.getObjectByName('PCF_EXPORT_ROOT');
assert.equal(branchOnlyRoot.userData.lineNo, '/ASIM-1885-10-S8810101-91261M7-HC/B2');
assert.deepEqual(branchOnlyRoot.userData.lineNos, ['/ASIM-1885-10-S8810101-91261M7-HC/B2']);

console.log('inputxml-glb-line-no-metadata.test.js passed');
