import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-import-router-uxml.test.js ---');

  const {
    importInputXmlByRoute,
  } = await import('../xml-compare/InputXmlImportRouter.js');

  const xmlText = `
    <InputXML>
      <Components>
        <Component id="P1" type="PIPE" pipelineRef="LINE-1" refNo="10" seqNo="1" ep1="0 0 0" ep2="100 0 0" bore="100" />
      </Components>
    </InputXML>
  `;

  const result = importInputXmlByRoute(xmlText, {
    route: 'UXML_ROUND_TRIP',
    fileName: 'uxml-input.xml',
    allowPartialImport: true,
  });

  assert.equal(result.schema, 'inputxml-import-router/v1');
  assert.equal(result.route, 'UXML_ROUND_TRIP');
  assert.equal(result.routeLabel, 'UXML Round Trip');
  assert.equal(result.fileName, 'uxml-input.xml');
  assert.ok(result.directPcfData, 'UXML route must return directPcfData wrapper');
  assert.ok(result.uxmlRoundTrip, 'UXML route must include uxmlRoundTrip payload');
  assert.ok(Array.isArray(result.components), 'UXML route components must be array');
  assert.ok(Array.isArray(result.diagnostics), 'UXML route diagnostics must be array');
  assert.ok(result.summary.uxmlRoundTrip, 'UXML route summary must identify round trip');

  console.log('[PASS] InputXML import router UXML route passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML import router UXML route failed.');
  console.error(error);
  process.exit(1);
});
