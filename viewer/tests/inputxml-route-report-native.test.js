import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-route-report-native.test.js ---');

  const {
    buildInputXmlRouteReport,
    formatInputXmlRouteReportLines,
  } = await import('../xml-compare/InputXmlRouteReport.js');

  const report = buildInputXmlRouteReport({
    ok: true,
    route: 'NATIVE_XML_BUILDER',
    fileName: 'native.xml',
    components: [
      { id: 'P1', type: 'PIPE' },
      { id: 'S1', type: 'SUPPORT' },
    ],
    native: {
      parsedFormat: 'XML',
    },
    diagnostics: [
      { severity: 'INFO', code: 'NATIVE-1', message: 'ok' },
    ],
  });

  assert.equal(report.schema, 'inputxml-route-report/v1');
  assert.equal(report.route, 'NATIVE_XML_BUILDER');
  assert.equal(report.routeLabel, 'Native XML Builder');
  assert.equal(report.mode, 'native');
  assert.equal(report.ok, true);
  assert.equal(report.componentCount, 2);
  assert.equal(report.native.nativeBuilder, true);
  assert.equal(report.native.supportCount, 1);
  assert.equal(report.topology.nativeBuilder, true);
  assert.equal(report.topology.universalNodeCount, null);
  assert.equal(report.diagnosticsSummary.info, 1);

  const lines = formatInputXmlRouteReportLines(report);
  assert.ok(lines.some((line) => line.includes('Route: Native XML Builder')));
  assert.ok(lines.some((line) => line.includes('Native Builder: yes')));

  console.log('[PASS] InputXML route report native passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML route report native failed.');
  console.error(error);
  process.exit(1);
});
