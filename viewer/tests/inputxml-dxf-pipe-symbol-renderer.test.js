import assert from 'node:assert/strict';
import { projectToDxfGeometry } from '../converters/inputxml-dxf/InputXmlToDxfProjector.js';
import { writeInputXmlDxf } from '../converters/inputxml-dxf/InputXmlToDxfWriter.js';

function countEntity(dxf, entityName) {
  const tokens = String(dxf || '').split(/\r?\n/);
  let count = 0;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (tokens[i] === '0' && tokens[i + 1] === entityName) count += 1;
  }
  return count;
}

const doc = {
  components: [
    { id: 'pipe-1', type: 'PIPE', name: 'PIPE', pipelineRef: 'L1' },
    { id: 'tee-1', type: 'TEE', name: '2P 001 TEE', pipelineRef: 'L1' },
    { id: 'red-1', type: 'CONC REDUCER', name: '2 x 1 CONC RED', pipelineRef: 'L1' },
    { id: 'bend-1', type: 'BEND', name: '90 DEG BEND', pipelineRef: 'L1' },
    { id: 'olet-1', type: 'WELDING BOSS', name: 'WELDING BOSS', pipelineRef: 'L1' },
    { id: 'noz-1', type: 'NOZZLE', name: 'NOZZLE P', pipelineRef: 'L1' },
    { id: 'support-guide', type: 'SUPPORT', name: 'SS1 GUIDE', pipelineRef: 'L1' },
    { id: 'support-limit', type: 'SUPPORT', name: 'LS1 LINE STOP', pipelineRef: 'L1' },
  ],
  anchors: [
    { id: 'a0', point: { x: 0, y: 0, z: 0 } },
    { id: 'a1', point: { x: 100, y: 0, z: 0 } },
    { id: 'a2', point: { x: 200, y: 0, z: 0 } },
    { id: 'a3', point: { x: 300, y: 0, z: 0 } },
    { id: 'a4', point: { x: 400, y: 0, z: 0 } },
    { id: 'a5', point: { x: 500, y: 0, z: 0 } },
    { id: 'a6', point: { x: 600, y: 0, z: 0 } },
    { id: 'sg', point: { x: 150, y: 20, z: 0 } },
    { id: 'sl', point: { x: 450, y: 20, z: 0 } },
  ],
  segments: [
    { id: 's-pipe', componentId: 'pipe-1', startAnchorId: 'a0', endAnchorId: 'a1', type: 'PIPE' },
    { id: 's-tee', componentId: 'tee-1', startAnchorId: 'a1', endAnchorId: 'a2', type: 'TEE' },
    { id: 's-red', componentId: 'red-1', startAnchorId: 'a2', endAnchorId: 'a3', type: 'REDUCER' },
    { id: 's-bend', componentId: 'bend-1', startAnchorId: 'a3', endAnchorId: 'a4', type: 'BEND' },
    { id: 's-olet', componentId: 'olet-1', startAnchorId: 'a4', endAnchorId: 'a5', type: 'OLET' },
    { id: 's-noz', componentId: 'noz-1', startAnchorId: 'a5', endAnchorId: 'a6', type: 'NOZZLE' },
  ],
  supports: [
    { id: 'SS1', componentId: 'support-guide', supportAnchorId: 'sg', type: 'GUIDE' },
    { id: 'LS1', componentId: 'support-limit', supportAnchorId: 'sl', type: 'LINE STOP' },
  ],
};

const geometry = projectToDxfGeometry(doc, { selectedBranches: '' });
const layers = geometry.segments.map((segment) => segment.layer);
assert.deepEqual(layers, ['PIPING', 'TEES', 'REDUCERS', 'ELBOWS', 'OLETS', 'NOZZLES'], 'projector classifies pipe components into drafting layers');
assert.deepEqual(geometry.supports.map((support) => support.supportType), ['guide', 'lineStop'], 'projector classifies support restraint types');
assert.ok(geometry.supports[0].label.includes('GUIDE'), 'guide support label includes support type');
assert.ok(geometry.supports[1].label.includes('LINE STOP'), 'line stop support label includes support type');

const drawing = writeInputXmlDxf({ segments: geometry.segments, supports: geometry.supports, branches: [] }, {
  outputMode: 'iso-drawing',
  showLabels: true,
  textHeight: 2.5,
});
assert.equal(drawing.sidecar.pipeBodyMode, 'thick-2d', 'iso drawing defaults to thick pipe body mode');
assert.equal(drawing.sidecar.pipeBodyCount, geometry.segments.length, 'thick pipe body is emitted for each segment');
assert.ok(drawing.sidecar.layers.includes('PIPING_BODY'), 'sidecar exposes PIPING_BODY layer');
assert.ok(drawing.sidecar.layers.includes('SUPPORT_LABELS'), 'sidecar exposes support label layer');
assert.ok(drawing.sidecar.layers.includes('COMPONENT_LABELS'), 'sidecar exposes component label layer');
assert.equal(countEntity(drawing.dxf, 'SOLID'), geometry.segments.length, 'thick pipe body uses SOLID entities');
assert.ok(countEntity(drawing.dxf, 'TEXT') >= geometry.supports.length, 'support/component labels are emitted');
assert.equal(drawing.sidecar.supportTypeCounts.guide, 1, 'sidecar counts guide supports');
assert.equal(drawing.sidecar.supportTypeCounts.lineStop, 1, 'sidecar counts line stop supports');
assert.equal(drawing.sidecar.labelPolicy.segmentLabels, false, 'dense segment labels are off by default in iso drawing mode');

const centerlineOnly = writeInputXmlDxf({ segments: geometry.segments, supports: [], branches: [] }, {
  outputMode: 'geometry',
  pipeBodyMode: 'centerline',
  showLabels: false,
  showSymbols: false,
});
assert.equal(centerlineOnly.sidecar.pipeBodyMode, 'centerline', 'geometry mode can remain centerline-only');
assert.equal(countEntity(centerlineOnly.dxf, 'SOLID'), 0, 'centerline mode emits no SOLID pipe bodies');

console.log('inputxml-dxf-pipe-symbol-renderer tests passed');
