import assert from 'assert/strict';

import {
  buildXmlSupportComponents,
} from '../parser/xml-support-builder.js';

function findByName(components, name) {
  return components.find((component) => component?.attributes?.SUPPORT_NAME === name);
}

function run() {
  console.log('--- native-xml-support-mapper-resolver.test.js ---');

  const parsed = {
    nodes: {
      10: { x: 0, y: 0, z: 0, bore: 100 },
      20: { x: 100, y: 0, z: 0, bore: 100 },
      30: { x: 200, y: 0, z: 0, bore: 100 },
      40: { x: 300, y: 0, z: 0, bore: 100 },
      50: { x: 400, y: 0, z: 0, bore: 100 },
      60: { x: 500, y: 0, z: 0, bore: 100 },
      61: { x: 600, y: 0, z: 0, bore: 100 },
      70: { x: 700, y: 0, z: 0, bore: 100 },
      71: { x: 800, y: 0, z: 0, bore: 100 },
    },
    elements: [
      { from: 60, to: 61, dx: 100, dy: 0, dz: 0 },
      { from: 70, to: 71, dx: 100, dy: 0, dz: 0 },
    ],
    restraints: [
      { node: 10, supportBlock: 'CA100', rawType: 'CA100', axisCosines: { x: 0, y: 1, z: 0 } },
      { node: 20, supportBlock: 'CA150', rawType: 'CA150', axisCosines: { x: 0, y: 1, z: 0 } },
      { node: 30, supportBlock: '', rawType: 'STOPPER', axisCosines: { x: 1, y: 0, z: 0 } },
      { node: 40, supportBlock: '', rawType: 'HANGER', axisCosines: { x: 0, y: 1, z: 0 } },
      { node: 50, supportBlock: 'CA300', rawType: 'CA300', axisCosines: { x: 0, y: 1, z: 0 } },
      { node: 60, supportBlock: '', rawType: 'EAST', axisCosines: { x: 1, y: 0, z: 0 } },
      { node: 70, supportBlock: '', rawType: 'NORTH', axisCosines: { x: 0, y: 0, z: -1 } },
    ],
  };

  const components = buildXmlSupportComponents(parsed, {
    nodePositions: parsed.nodes,
    verticalAxis: 'Y',
    worldNorth: { x: 0, y: 0, z: -1 },
    defaultBore: 100,
  });

  assert.equal(findByName(components, 'CA100')?.attributes?.SUPPORT_KIND, 'GDE', 'CA100 resolves to legacy GUIDE token');
  assert.equal(findByName(components, 'CA150')?.attributes?.SUPPORT_KIND, 'RST', 'CA150 resolves to legacy REST token');
  assert.equal(findByName(components, 'STP')?.attributes?.SUPPORT_KIND, 'STP', 'STOPPER resolves to legacy line-stop token');
  assert.equal(findByName(components, 'SPR')?.attributes?.SUPPORT_KIND, 'SPR', 'HANGER resolves to legacy spring token');
  assert.equal(findByName(components, 'CA300')?.attributes?.SUPPORT_KIND, 'ANC', 'CA300 legacy anchor mapping is preserved');
  assert.equal(findByName(components, 'STP')?.attributes?.SUPPORT_KIND, 'STP', 'direction parallel to pipe axis resolves as line stop');
  assert.ok(
    components.some((component) => component?.attributes?.SUPPORT_NAME === 'GDE' && component?.attributes?.NODE_ID === '70'),
    'direction perpendicular to pipe axis resolves as guide'
  );

  console.log('[PASS] Native XML support mapper resolver passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Native XML support mapper resolver failed.');
  console.error(error);
  process.exit(1);
}
