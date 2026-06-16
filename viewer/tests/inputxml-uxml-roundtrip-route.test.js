import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-uxml-roundtrip-route.test.js ---');

  const { runInputXmlUxmlRoundTrip } = await import('../xml-compare/InputXmlUxmlRoundTripRoute.js');

  const xmlText = `
    <InputXML>
      <Components>
        <Component id="P1" type="PIPE" pipelineRef="LINE-1" refNo="10" seqNo="1" ep1="0 0 0" ep2="100 0 0" bore="100" />
      </Components>
    </InputXML>
  `;

  const result = runInputXmlUxmlRoundTrip(xmlText, {
    fileName: 'sample-inputxml.xml',
    allowPartialImport: true,
  });

  assert.equal(result.schema, 'inputxml-uxml-roundtrip-route/v1');
  assert.equal(result.route, 'UXML_ROUND_TRIP');
  assert.ok(result.uxml, 'result must include uxml');
  assert.ok(result.validation, 'result must include validation');
  assert.ok(result.faceModel, 'result must include faceModel');
  assert.ok(result.universalGraph, 'result must include universalGraph');
  assert.ok(result.rayGraph, 'result must include rayGraph');
  assert.ok(result.comparison, 'result must include comparison');
  assert.ok(result.topologyDecision, 'result must include topologyDecision');
  assert.ok(Array.isArray(result.components), 'result.components must be array');
  assert.ok(Array.isArray(result.diagnostics), 'result.diagnostics must be array');
  assert.equal(result.summary.route, 'UXML_ROUND_TRIP');

  console.log('[PASS] InputXML UXML roundtrip route passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML UXML roundtrip route failed.');
  console.error(error);
  process.exit(1);
});
