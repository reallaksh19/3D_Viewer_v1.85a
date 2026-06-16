import assert from 'assert/strict';

async function run() {
  console.log('--- inputxml-uxml-roundtrip-diagnostics.test.js ---');

  const {
    flattenInputXmlUxmlDiagnostics,
  } = await import('../xml-compare/InputXmlUxmlRoundTripRoute.js');

  const diagnostics = flattenInputXmlUxmlDiagnostics({
    validation: {
      diagnostics: [
        { severity: 'ERROR', code: 'VAL-1', message: 'Validation issue' },
      ],
    },
    faceModel: {
      diagnostics: [
        { level: 'WARN', code: 'FACE-1', message: 'Face issue' },
      ],
    },
    universalGraph: {
      diagnostics: [
        { severity: 'INFO', code: 'GRAPH-1', message: 'Graph issue' },
      ],
    },
  });

  assert.equal(diagnostics.length, 3);
  assert.equal(diagnostics[0]._source, 'validation');
  assert.equal(diagnostics[1]._source, 'faceModel');
  assert.equal(diagnostics[1].severity, 'WARNING');
  assert.equal(diagnostics[2]._source, 'universalGraph');

  console.log('[PASS] InputXML UXML roundtrip diagnostics passed.');
}

run().catch((error) => {
  console.error('[FAIL] InputXML UXML roundtrip diagnostics failed.');
  console.error(error);
  process.exit(1);
});
