import assert from 'node:assert/strict';
import { run } from '../tabs/model-converters/converters/rvmattr-to-xml.js';

// Minimal RMSS_ATTRIBUTE.TXT fixture in NEW/END block format (PDMS export style).
// Parser expects: NEW <id> / KEY := VALUE / END
// TYPE must be the PDMS component type code (BRAN, VALV, ATTA, etc.), not GROU.
// OWNER must exactly match the branch NAME value.
const attText = `
NEW BRAN PE00001-BRANCH-001
TYPE := BRAN
NAME := PE00001-BRANCH-001
HBOR := 100
HPOS := 1000 0 1000
TPOS := 3000 0 1000
END

NEW VALV V-001
TYPE := VALV
NAME := V-001
OWNER := PE00001-BRANCH-001
BORE := 100
APOS := 1500 0 1000
LPOS := 2500 0 1000
END

NEW ATTA SUP-001
TYPE := ATTA
NAME := SUP-001
OWNER := PE00001-BRANCH-001
CMPSUPTYPE := REST
BORE := 100
APOS := 2000 -60 1000
END
`;

// --- ATT/TXT-only mode (secondary file, no primary RVM) ---

const result = await run({
  inputFiles: [
    {
      role: 'secondary',
      name: 'ATTRIBUTE.TXT',
      text: attText,
    },
  ],
  options: {},
  setStatus() {},
  converterId: 'rvmattr_to_xml',
});

assert.equal(result.ok, true, `ATT-only run must succeed; got: ${JSON.stringify(result?.logs?.stderr)}`);
assert.ok(Array.isArray(result.outputs) && result.outputs.length > 0, 'ATT-only mode should produce at least one output');
assert.ok(
  result.outputs.some((o) => /\.xml$/i.test(o.name) || /xml/i.test(o.mime || '')),
  'ATT-only mode should produce XML output',
);
assert.ok(
  result.outputs.some((o) => /\.json$/i.test(o.name) || /json/i.test(o.mime || '')),
  'ATT-only mode should produce JSON output',
);

// STP must not be silently faked — either absent or a diagnostic message
const stpOutput = result.outputs.find((o) => /\.stp$/i.test(o.name));
if (stpOutput) {
  assert.ok(
    typeof stpOutput.text === 'string' && stpOutput.text.length > 0,
    'If STP is emitted in ATT-only mode it must have content (structural members found)',
  );
}

// --- Same test with .att extension ---

const resultAtt = await run({
  inputFiles: [
    {
      role: 'secondary',
      name: 'RMSS_ATTRIBUTE.ATT',
      text: attText,
    },
  ],
  options: {},
  setStatus() {},
  converterId: 'rvmattr_to_xml',
});

assert.equal(resultAtt.ok, true, '.att extension secondary-only must also succeed');
assert.ok(resultAtt.outputs?.length > 0, '.att secondary-only should produce outputs');

// --- No-file failure ---

const emptyResult = await run({
  inputFiles: [],
  options: {},
  setStatus() {},
  converterId: 'rvmattr_to_xml',
});

assert.equal(emptyResult.ok, false, 'No files → must return ok: false');
assert.ok(
  Array.isArray(emptyResult.logs?.stderr) && emptyResult.logs.stderr.length > 0,
  'No files → must have stderr message',
);
assert.match(
  emptyResult.logs.stderr.join('\n'),
  /RVM file or an ATT\/TXT attribute file/i,
  'No-file error must mention both file types',
);

// --- allowSecondaryOnly flag in converter-registry ---

import { getConverterById } from '../tabs/model-converters/converter-registry.js';

const converterDef = getConverterById('rvmattr_to_xml');
assert.ok(converterDef, 'rvmattr_to_xml must exist in converter registry');
assert.equal(converterDef.allowSecondaryOnly, true, 'rvmattr_to_xml must have allowSecondaryOnly: true');

console.log('att-rvm-secondary-only.test.js passed');
