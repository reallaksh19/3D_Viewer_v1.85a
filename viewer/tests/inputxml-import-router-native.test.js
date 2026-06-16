import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-import-router-native.test.js ---');

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
    route: 'NATIVE_XML_BUILDER',
    fileName: 'native-input.xml',
    allowPartialImport: true,
  });

  assert.equal(result.schema, 'inputxml-import-router/v1');
  assert.equal(result.route, 'NATIVE_XML_BUILDER');
  assert.equal(result.routeLabel, 'Native XML Builder');
  assert.equal(result.fileName, 'native-input.xml');
  assert.ok(result.directPcfData, 'native route must return directPcfData');
  assert.ok(Array.isArray(result.components), 'native route components must be array');
  assert.ok(Array.isArray(result.diagnostics), 'native route diagnostics must be array');
  assert.ok(result.summary.nativeBuilder, 'native route summary must identify native builder');

  console.log('[PASS] InputXML import router native route passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML import router native route failed.');
  console.error(error);
  process.exit(1);
});
