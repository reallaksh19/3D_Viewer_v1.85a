import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-import-router-schema.test.js ---');

  const {
    normalizeInputXmlImportResult,
    inputXmlRouteDiagnostics,
  } = await import('../xml-compare/InputXmlImportRouter.js');

  const normalized = normalizeInputXmlImportResult({
    ok: true,
    route: 'BAD_VALUE',
    fileName: 'schema.xml',
    components: [{ id: 'C1', type: 'PIPE' }],
    diagnostics: [{ severity: 'WARNING', code: 'TEST', message: 'Test warning' }],
  });

  assert.equal(normalized.schema, 'inputxml-import-router/v1');
  assert.equal(normalized.route, 'UXML_ROUND_TRIP', 'bad route must normalize to UXML');
  assert.equal(normalized.routeLabel, 'UXML Round Trip');
  assert.equal(normalized.fileName, 'schema.xml');
  assert.equal(normalized.components.length, 1);
  assert.ok(normalized.directPcfData, 'normalized result must have directPcfData wrapper');
  assert.ok(Array.isArray(normalized.diagnostics));
  assert.equal(normalized.diagnostics[0].code, 'INPUTXML-ROUTE-UXML_ROUND_TRIP');

  const diagnostics = inputXmlRouteDiagnostics('NATIVE_XML_BUILDER', [
    { severity: 'INFO', code: 'X', message: 'Y' },
  ]);

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].code, 'INPUTXML-ROUTE-NATIVE_XML_BUILDER');
  assert.equal(diagnostics[1].code, 'X');

  console.log('[PASS] InputXML import router schema passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML import router schema failed.');
  console.error(error);
  process.exit(1);
});
