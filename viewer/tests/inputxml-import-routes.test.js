import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-import-routes.test.js ---');

  const {
    INPUTXML_IMPORT_ROUTES,
    normalizeInputXmlImportRoute,
    inputXmlImportRouteLabel,
    isNativeInputXmlBuilderRoute,
    isUxmlInputXmlRoundTripRoute,
  } = await import('../xml-compare/InputXmlImportRoutes.js');

  assert.equal(
    normalizeInputXmlImportRoute('NATIVE_XML_BUILDER'),
    INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER
  );

  assert.equal(
    normalizeInputXmlImportRoute('UXML_ROUND_TRIP'),
    INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP
  );

  assert.equal(
    normalizeInputXmlImportRoute('bad-value'),
    INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP,
    'invalid route must default to UXML_ROUND_TRIP'
  );

  assert.equal(inputXmlImportRouteLabel('NATIVE_XML_BUILDER'), 'Native XML Builder');
  assert.equal(inputXmlImportRouteLabel('UXML_ROUND_TRIP'), 'UXML Round Trip');

  assert.equal(isNativeInputXmlBuilderRoute('NATIVE_XML_BUILDER'), true);
  assert.equal(isUxmlInputXmlRoundTripRoute('UXML_ROUND_TRIP'), true);

  console.log('[PASS] InputXML import routes passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML import routes failed.');
  console.error(error);
  process.exit(1);
});
