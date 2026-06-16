import assert from 'node:assert/strict';
import fs from 'node:fs';

import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { applyInputXmlBendMetadata } from '../converters/inputxml-glb/InputXmlBendMetadata.js';
import { applyInputXmlCaesarSupportMetadata } from '../converters/inputxml-glb/InputXmlCaesarSupportMetadata.js';
import { appendInputXmlGlbNodeLabels } from '../converters/inputxml-glb/InputXmlGlbNodeLabels.js';
import { adaptUxmlToGlbModel } from '../converters/inputxml-glb/UxmlToGlbModelAdapter.js';
import {
  CAESAR_SUPPORT_MAPPING_TABLE,
  classifyCaesarRestraint,
} from '../converters/inputxml-glb/CaesarRestraintClassifier.js';
import { summarizeGlbLabels, collectGlbLabelAnchors } from '../js/pcf2glb/advanced/glbLabelOverlay.js';
import { applyEngineeringPalette } from '../js/pcf2glb/glb/applyEngineeringPalette.js';
import { buildComponentObject } from '../js/pcf2glb/glb/buildComponentObject.js';
import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';
import { buildNodeLabelObject } from '../js/pcf2glb/glb/buildNodeLabelObject.js';

const fixtureUrl = new URL('../../Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML', import.meta.url);
const xmlText = fs.readFileSync(fixtureUrl, 'utf8');

const extracted = extractInputXmlBranches(xmlText, {
  sourceId: 'inputxml-glb-test',
  fileName: 'benchmark.xml',
});

assert.equal(extracted.ok, true);
assert.ok(extracted.doc.components.length > 0);
assert.ok(extracted.doc.segments.length > 0);

applyInputXmlBendMetadata(xmlText, extracted.doc);
const caesarSupportStats = applyInputXmlCaesarSupportMetadata(xmlText, extracted.doc, { sourceId: 'inputxml-glb-test' });
const { model, stats, diagnostics } = adaptUxmlToGlbModel(extracted.doc);
const nodeLabelStats = appendInputXmlGlbNodeLabels(model, extracted.doc, stats);
assert.equal(model.schema, 'inputxml-glb-model/v1');
assert.ok(model.components.length > 0);
assert.equal(stats.componentCount, model.components.length);
assert.ok(stats.typeCounts.PIPE > 0);
assert.ok(caesarSupportStats.supportTagCount > 0);
assert.ok(caesarSupportStats.expandedSupportCount > 0);
assert.ok(nodeLabelStats.nodeLabelCount > 0);
assert.equal(stats.typeCounts.NODE_LABEL, nodeLabelStats.nodeLabelCount);

const pipe = model.components.find((component) => component.type === 'PIPE');
assert.ok(pipe);
assert.ok(Number.isFinite(pipe.ep1.x));
assert.ok(Number.isFinite(pipe.ep2.x));
assert.ok(pipe.bore > 0);
assert.ok(pipe.attributes.uxmlSegmentId);

const supports = model.components.filter((component) => component.type === 'SUPPORT');
assert.ok(supports.length > 0);
assert.ok(supports.every((support) => support.coOrds));
assert.ok(supports.every((support) => support.supportKind));
assert.ok(Object.keys(stats.supportKindCounts).length > 0);

const nodeLabels = model.components.filter((component) => component.type === 'NODE_LABEL');
assert.ok(nodeLabels.length > 0, 'InputXML GLB model should include node label anchors');
assert.ok(nodeLabels.every((component) => component.coOrds && component.label));
assert.ok(nodeLabels.every((component) => !/EP[12]|SUPPORT_POINT|IX-A/i.test(component.label)), 'node labels should use clean real node numbers');

const filtered = adaptUxmlToGlbModel(extracted.doc, {
  selectedBranches: extracted.branches[0]?.id || '',
});
assert.ok(filtered.model.components.length <= model.components.length);
assert.deepEqual(diagnostics.filter((item) => item.severity === 'ERROR'), []);

function sampleComponent(type, id = type, extra = {}) {
  return {
    id,
    type,
    bore: 20,
    ep1: { x: 0, y: 0, z: 0, bore: 20 },
    ep2: { x: 100, y: 0, z: 0, bore: 20 },
    centrePoint: { x: 50, y: 0, z: 0 },
    branch1Point: { x: 50, y: 60, z: 0, bore: 15 },
    refNo: id,
    attributes: { COMPONENT_IDENTIFIER: id },
    ...extra,
  };
}

const nodeLabelObject = buildNodeLabelObject({
  id: 'node-label-205',
  type: 'NODE_LABEL',
  coOrds: { x: 10, y: 20, z: 30 },
  label: '205',
  attributes: { NODE_LABEL: '205' },
});
assert.equal(nodeLabelObject.userData.labelText, '205');
assert.equal(nodeLabelObject.userData.labelKind, 'node');
assert.equal(nodeLabelObject.userData.glbShape, 'node-label-anchor');
assert.deepEqual(collectGlbLabelAnchors(nodeLabelObject).map((label) => label.kind), ['node']);
assert.deepEqual(collectGlbLabelAnchors(nodeLabelObject).map((label) => label.text), ['205']);
assert.deepEqual(summarizeGlbLabels(collectGlbLabelAnchors(nodeLabelObject)), {
  total: 1,
  node: 1,
  support: 0,
  valve: 0,
  flange: 0,
  tee: 0,
  terminal: 0,
  component: 0,
});

const nodeScene = buildExportScene({ components: [{
  id: 'node-label-210',
  type: 'NODE_LABEL',
  coOrds: { x: 1, y: 2, z: 3 },
  label: '210',
}] });
assert.ok(nodeScene.getObjectByName('node-label:210'));
assert.deepEqual(collectGlbLabelAnchors(nodeScene).map((label) => label.text), ['210']);
assert.equal(nodeScene.getObjectByName('PCF_EXPORT_ROOT').userData.engineeringPaletteApplied, true);
assert.ok(nodeScene.getObjectByName('PCF_EXPORT_ROOT').userData.engineeringPaletteMeshCount > 0);

const debugScene = buildExportScene({ components: [sampleComponent('PIPE', 'PIPE-DEBUG')] }, null, { colorMode: 'debug' });
assert.equal(debugScene.getObjectByName('PCF_EXPORT_ROOT').userData.colorMode, 'debug');

const elbowObject = buildComponentObject(sampleComponent('ELBOW', 'ELBOW-TEST'));
assert.equal(elbowObject.userData.glbShape, 'rounded-elbow-tube');
assert.equal(elbowObject.geometry?.type, 'TubeGeometry');

const radiusElbowObject = buildComponentObject(sampleComponent('ELBOW', 'ELBOW-RADIUS-TEST', {
  bendRadius: 150,
  bendAngleDeg: 90,
  bendMetadataSource: 'PIPINGELEMENT.BEND',
}));
assert.equal(radiusElbowObject.userData.glbShape, 'rounded-elbow-tube-radius');
assert.equal(radiusElbowObject.userData.bendRadius, 150);
assert.equal(radiusElbowObject.userData.bendAngleDeg, 90);
assert.equal(radiusElbowObject.userData.bendMetadataSource, 'PIPINGELEMENT.BEND');
assert.ok(radiusElbowObject.userData.bendLift > 0);

const syntheticBendXml = '<CAESARII><PIPINGMODEL JOBNAME="BEND-TEST"><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20"><BEND RADIUS="300" ANGLE="90"/></PIPINGELEMENT></PIPINGMODEL></CAESARII>';
const synthetic = extractInputXmlBranches(syntheticBendXml, { sourceId: 'synthetic-bend', fileName: 'synthetic.xml' });
const syntheticBendStats = applyInputXmlBendMetadata(syntheticBendXml, synthetic.doc);
const syntheticAdapted = adaptUxmlToGlbModel(synthetic.doc);
const syntheticElbow = syntheticAdapted.model.components.find((component) => component.type === 'BEND' || component.type === 'ELBOW');
assert.equal(syntheticBendStats.bendTagCount, 1);
assert.equal(syntheticBendStats.radiusCount, 1);
assert.ok(syntheticElbow);
assert.equal(syntheticElbow.bendRadius, 300);
assert.equal(syntheticElbow.bendAngleDeg, 90);
assert.equal(syntheticAdapted.stats.bendRadiusCount, 1);

const longCaesarBendXml = '<CAESARII><PIPINGMODEL JOBNAME="LONG-BEND-TEST"><PIPINGELEMENT FROM_NODE="150" TO_NODE="160" DELTA_X="783" DELTA_Y="0" DELTA_Z="0" DIAMETER="152.4"><BEND RADIUS="152.399994" ANGLE1="45.000000" NODE1="160"/></PIPINGELEMENT></PIPINGMODEL></CAESARII>';
const longCaesar = extractInputXmlBranches(longCaesarBendXml, { sourceId: 'long-caesar-bend', fileName: 'long.xml' });
const longCaesarBendStats = applyInputXmlBendMetadata(longCaesarBendXml, longCaesar.doc);
const longCaesarAdapted = adaptUxmlToGlbModel(longCaesar.doc);
const longCaesarPipe = longCaesarAdapted.model.components.find((component) => component.attributes?.CAESAR_BEND_SUPPRESSED_FULL_CURVE === 'true');
assert.equal(longCaesarBendStats.angleCount, 1);
assert.ok(longCaesarPipe);
assert.equal(longCaesarPipe.type, 'PIPE');
assert.equal(longCaesarPipe.bendAngleDeg, 45);
assert.equal(longCaesarAdapted.stats.suppressedFullBendCurveCount, 1);

const longCaesarScene = buildExportScene(longCaesarAdapted.model);
const longCaesarBendObject = longCaesarScene.getObjectByName(longCaesarPipe.id);
assert.equal(longCaesarBendObject.userData.localizedBendProxy, true);
assert.ok(longCaesarBendObject.getObjectByName(`${longCaesarPipe.id}-localized-bend-marker`));
assert.ok(longCaesarBendObject.getObjectByName(`${longCaesarPipe.id}-localized-bend-arc`));
const longCaesarBendLabels = collectGlbLabelAnchors(longCaesarBendObject).map((label) => label.text);
assert.ok(longCaesarBendLabels.some((label) => /BEND/.test(label) && /R152/.test(label) && /A45/.test(label)));

const caesarRestraintXml = '<CAESARII><PIPINGMODEL JOBNAME="REST-TEST"><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20"><RESTRAINT NODE="20" TYPE="17" XCOSINE="0" YCOSINE="1" ZCOSINE="0"/><RESTRAINT NODE="20" TYPE="1" XCOSINE="1" YCOSINE="0" ZCOSINE="0"/></PIPINGELEMENT></PIPINGMODEL></CAESARII>';
const caesarRestraint = extractInputXmlBranches(caesarRestraintXml, { sourceId: 'restraint-test', fileName: 'rest.xml' });
const restraintStats = applyInputXmlCaesarSupportMetadata(caesarRestraintXml, caesarRestraint.doc, { sourceId: 'restraint-test' });
const restraintAdapted = adaptUxmlToGlbModel(caesarRestraint.doc);
const restraintKinds = restraintAdapted.model.components.filter((component) => component.type === 'SUPPORT').map((component) => component.supportKind).sort();
assert.equal(restraintStats.supportTagCount, 2);
assert.equal(restraintStats.expandedSupportCount, 2);
assert.deepEqual(restraintKinds, ['GUIDE', 'REST']);

assert.deepEqual(CAESAR_SUPPORT_MAPPING_TABLE.REST, [
  'REST',
  'SHOE',
  'BP',
  'BEARING PLATE',
  'WP',
  'WEAR PAD',
  'ANCI',
]);

for (const label of ['REST', 'SHOE', 'BP', 'BEARING PLATE', 'WP', 'WEAR PAD', 'ANCI']) {
  assert.equal(
    classifyCaesarRestraint({ DESCRIPTION: label }),
    'REST',
    `${label} should classify as REST`,
  );
}

assert.equal(
  classifyCaesarRestraint({ DESCRIPTION: 'ANCI' }),
  'REST',
  'ANCI must be treated as REST',
);

assert.equal(
  classifyCaesarRestraint({ DESCRIPTION: 'ANCHOR' }),
  'ANCHOR',
  'ANCHOR must remain ANCHOR',
);

const teeObject = buildComponentObject(sampleComponent('TEE', 'TEE-TEST'));
assert.equal(teeObject.userData.glbShape, 'tee-branch-collar');
assert.ok(teeObject.getObjectByName('TEE-TEST-main-run'));
assert.ok(teeObject.getObjectByName('TEE-TEST-branch'));
assert.ok(teeObject.getObjectByName('TEE-TEST-tee-collar'));
assert.ok(collectGlbLabelAnchors(teeObject).some((label) => label.text === 'TEE-TEST'));

const teeScene = buildExportScene({ components: [sampleComponent('TEE', 'TEE-SCENE')] });
const teeSceneObject = teeScene.getObjectByName('TEE-SCENE');
assert.equal(teeSceneObject.userData.glbShape, 'tee-body-union-proxy');
assert.equal(teeSceneObject.userData.teeProxy, true);
assert.ok(teeSceneObject.getObjectByName('TEE-SCENE-tee-body-hub'));
assert.ok(teeSceneObject.getObjectByName('TEE-SCENE-tee-main-saddle'));
assert.ok(teeSceneObject.getObjectByName('TEE-SCENE-tee-branch-saddle'));

const flangeObject = buildComponentObject(sampleComponent('FLANGE', 'FLANGE-TEST'));
assert.equal(flangeObject.userData.glbShape, 'flange-ring-pair');
assert.ok(flangeObject.getObjectByName('FLANGE-TEST-flange-ring-1'));
assert.ok(flangeObject.getObjectByName('FLANGE-TEST-flange-ring-2'));

const valveObject = buildComponentObject(sampleComponent('VALVE', 'VALVE-TEST'));
assert.equal(valveObject.userData.glbShape, 'valve-body-handwheel');
assert.ok(valveObject.getObjectByName('VALVE-TEST-valve-body'));
assert.ok(valveObject.getObjectByName('VALVE-TEST-valve-handwheel'));
assert.match(valveObject.getObjectByName('label:VALVE-TEST')?.name || '', /label:/);
assert.deepEqual([...new Set(collectGlbLabelAnchors(valveObject).map((label) => label.text))], ['VALVE-TEST']);

const tabSource = fs.readFileSync(new URL('../tabs/model-converters-tab.js', import.meta.url), 'utf8');
assert.match(tabSource, /installInputXmlGlbLegacyBridge/);

const viewerSource = fs.readFileSync(new URL('../js/pcf2glb/advanced/createViewerApp.js', import.meta.url), 'utf8');
assert.match(viewerSource, /installGlbLabelOverlay/);

const runnerSource = fs.readFileSync(new URL('../converters/inputxml-glb/inputxml-to-glb-runner.js', import.meta.url), 'utf8');
assert.match(runnerSource, /applyInputXmlBendMetadata/);
assert.match(runnerSource, /applyInputXmlCaesarSupportMetadata/);
assert.match(runnerSource, /appendInputXmlGlbNodeLabels/);
assert.match(runnerSource, /buildExportScene/);
assert.match(runnerSource, /exportSceneToGLB/);

const bridgeSource = fs.readFileSync(new URL('../tabs/model-converters/inputxml-glb-legacy-bridge.js', import.meta.url), 'utf8');
assert.match(bridgeSource, /InputXML.*GLB Rich 3D Model/);
assert.match(bridgeSource, /data-inputxml-glb-output/);

console.log('inputxml-glb-rich-model.test.js passed');
