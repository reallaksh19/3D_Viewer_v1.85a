import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

async function run() {
  console.log('--- inputxml-routing-final-integration.test.js ---');

  const {
    INPUTXML_IMPORT_ROUTES,
    normalizeInputXmlImportRoute,
  } = await import('../xml-compare/InputXmlImportRoutes.js');

  const {
    importInputXmlByRoute,
  } = await import('../xml-compare/InputXmlImportRouter.js');

  const {
    buildInputXmlRouteReport,
    formatInputXmlRouteReportLines,
  } = await import('../xml-compare/InputXmlRouteReport.js');

  assert.equal(
    normalizeInputXmlImportRoute('BAD'),
    INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP,
    'bad route must normalize to UXML_ROUND_TRIP'
  );

  const xmlText = `
    <InputXML>
      <Components>
        <Component id="P1" type="PIPE" pipelineRef="LINE-1" refNo="10" seqNo="1" ep1="0 0 0" ep2="100 0 0" bore="100" />
      </Components>
    </InputXML>
  `;

  const nativeResult = importInputXmlByRoute(xmlText, {
    route: INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER,
    fileName: 'final-native.xml',
    allowPartialImport: true,
  });

  assert.equal(nativeResult.schema, 'inputxml-import-router/v1');
  assert.equal(nativeResult.route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.ok(nativeResult.directPcfData, 'native route must return directPcfData');
  assert.ok(Array.isArray(nativeResult.components), 'native route must return components array');

  const nativeReport = buildInputXmlRouteReport(nativeResult);
  assert.equal(nativeReport.schema, 'inputxml-route-report/v1');
  assert.equal(nativeReport.route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(nativeReport.mode, 'native');
  assert.ok(formatInputXmlRouteReportLines(nativeReport).some((line) => line.includes('Native XML Builder')));

  const uxmlResult = importInputXmlByRoute(xmlText, {
    route: INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP,
    fileName: 'final-uxml.xml',
    allowPartialImport: true,
  });

  assert.equal(uxmlResult.schema, 'inputxml-import-router/v1');
  assert.equal(uxmlResult.route, INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP);
  assert.ok(uxmlResult.directPcfData, 'UXML route must return directPcfData wrapper');
  assert.ok(uxmlResult.uxmlRoundTrip, 'UXML route must include uxmlRoundTrip payload');
  assert.ok(Array.isArray(uxmlResult.components), 'UXML route must return components array');

  const uxmlReport = buildInputXmlRouteReport(uxmlResult);
  assert.equal(uxmlReport.schema, 'inputxml-route-report/v1');
  assert.equal(uxmlReport.route, INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP);
  assert.equal(uxmlReport.mode, 'uxml-round-trip');
  assert.ok(formatInputXmlRouteReportLines(uxmlReport).some((line) => line.includes('UXML Round Trip')));

  const panel = read('viewer/tabs/viewer3d-xml-compare-panel.js');
  assert.ok(panel.includes('importInputXmlByRoute'), 'panel must use common router');
  assert.ok(panel.includes('buildInputXmlRouteReport'), 'panel must build route reports');
  assert.ok(panel.includes('persistInputXmlImportRoute'), 'panel must persist selected route');

  const importer = read('viewer/js/pcf2glb/import/ImportFromRawParser.js');
  assert.ok(
    importer.includes('buildNativeXmlDirectData(parsed, fileName, defaults)'),
    'ImportFromRawParser XML branch must use extracted native builder'
  );

  console.log('[PASS] InputXML routing final integration passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML routing final integration failed.');
  console.error(error);
  process.exit(1);
});
