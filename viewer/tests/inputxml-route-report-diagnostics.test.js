import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-route-report-diagnostics.test.js ---');

  const {
    summarizeInputXmlDiagnostics,
  } = await import('../xml-compare/InputXmlRouteReport.js');

  const summary = summarizeInputXmlDiagnostics([
    { severity: 'ERROR', code: 'A' },
    { severity: 'ERR', code: 'A' },
    { severity: 'WARNING', code: 'B' },
    { level: 'WARN', code: 'B' },
    { severity: 'INFO', code: 'C' },
    { code: 'NO_SEV' },
  ]);

  assert.equal(summary.total, 6);
  assert.equal(summary.error, 2);
  assert.equal(summary.warning, 2);
  assert.equal(summary.info, 2);
  assert.equal(summary.byCode.A, 2);
  assert.equal(summary.byCode.B, 2);
  assert.equal(summary.byCode.C, 1);
  assert.equal(summary.byCode.NO_SEV, 1);

  console.log('[PASS] InputXML route report diagnostics passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML route report diagnostics failed.');
  console.error(error);
  process.exit(1);
});
