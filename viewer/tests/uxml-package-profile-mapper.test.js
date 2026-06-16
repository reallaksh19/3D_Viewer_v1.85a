import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromCsv,
  enrichWithPipeData,
  resolveConnectivity,
  toUxmlXml,
} from '../../third_party/pipe-component-data/src/index.js';
import { isPackageUxmlDialect } from '../uxml/UxmlPackageProfileMapper.js';
import { normalizeXmlToUxml } from '../uxml/UxmlNormalizer.js';

const CSV = [
  'id,type,subtype,nps,schedule,class,face,x1,y1,z1,x2,y2,z2,x,y,z',
  'P1,PIPE,,4,40,,,0,0,0,1000,0,0,,,',
  'F1,FLANGE,WN,4,,300,RF,1000,0,0,1090,0,0,,,',
].join('\n');

function buildPackageUxml() {
  const graph = resolveConnectivity(enrichWithPipeData(fromCsv(CSV, { now: '2026-01-01T00:00:00.000Z' })));
  return { graph, xml: toUxmlXml(graph) };
}

test('package dialect detection', () => {
  const { xml } = buildPackageUxml();
  assert.equal(isPackageUxmlDialect(xml), true);
  assert.equal(isPackageUxmlDialect('<UXML schemaVersion="uxml-topology-v1"><Components/></UXML>'), false,
    'plain-attribute UXML keeps the existing passthrough path');
});

test('package UXML normalizes into viewer doc with dimensions preserved', () => {
  const { graph, xml } = buildPackageUxml();
  const result = normalizeXmlToUxml(xml);
  const doc = result.uxml || result.doc || result;

  assert.equal(doc.components.length, graph.components.length, 'component count preserved');
  assert.equal(doc.anchors.length, graph.anchors.length, 'anchor count preserved');
  assert.ok(doc.ports.length > 0, 'ports mapped');
  assert.ok(doc.segments.length > 0, 'segments mapped');

  const flange = doc.components.find((component) => component.type === 'FLANGE');
  assert.ok(flange, 'flange component present');
  assert.equal(flange.derived?.dimensions?.flangeOdMm, 255, '4" CL300 WN OD survives normalization');
  assert.ok(doc.diagnostics.some((d) => d.code === 'UXML-PACKAGE-DIALECT-PARSED'));
});
