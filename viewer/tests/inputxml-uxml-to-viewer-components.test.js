import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-uxml-to-viewer-components.test.js ---');

  const { uxmlToViewerComponents } = await import('../xml-compare/InputXmlUxmlToViewerComponents.js');

  const uxml = {
    schema: 'uxml/test',
    components: [
      {
        id: 'C1',
        type: 'PIPE',
        anchors: [
          { role: 'EP1', point: { x: 0, y: 0, z: 0 } },
          { role: 'EP2', point: { x: 100, y: 0, z: 0 } },
        ],
        attributes: {
          refNo: '10',
          seqNo: '1',
          pipelineRef: 'LINE-1',
          bore: 100,
        },
      },
      {
        id: 'S1',
        type: 'SUPPORT',
        anchors: [
          { role: 'SUPPORT', point: { x: 50, y: 0, z: -100 } },
        ],
        attributes: {
          supportKind: 'GUIDE',
        },
      },
    ],
  };

  const diagnostics = [];
  const components = uxmlToViewerComponents(uxml, { diagnostics });

  assert.equal(components.length, 2);

  const pipe = components.find((c) => c.id === 'C1');
  assert.ok(pipe);
  assert.equal(pipe.type, 'PIPE');
  assert.equal(pipe.points.length, 2);
  assert.equal(pipe.points[0].x, 0);
  assert.equal(pipe.points[1].x, 100);
  assert.equal(pipe.attributes.refNo, '10');

  const support = components.find((c) => c.id === 'S1');
  assert.ok(support);
  assert.equal(support.type, 'SUPPORT');
  assert.equal(support.coOrds.x, 50);

  console.log('[PASS] InputXML UXML to viewer components passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML UXML to viewer components failed.');
  console.error(error);
  process.exit(1);
});
