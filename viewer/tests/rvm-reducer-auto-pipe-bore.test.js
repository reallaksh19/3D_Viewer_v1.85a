import assert from 'node:assert/strict';
import { parseRmssAttributes } from '../converters/rmss-attribute-parser.js';

const attText = `
NEW BRAN /ASIM-1885-6"-S88112-91261M7-HC/B1
:TYPE := BRAN
:NAME := /ASIM-1885-6"-S88112-91261M7-HC/B1
:OWNER := /ASIM-1885-6"-S88112-91261M7-HC
:HBOR := 150mm
:TBOR := 80mm
END
NEW REDU =R1
:TYPE := REDU
:NAME := =R1
:OWNER := /ASIM-1885-6"-S88112-91261M7-HC/B1
:SPRE := /91261M7r01-AMF1/REDU-150X80
:DTXR := REDUCER CONC 150x80
:ABORE := 150mm
:LBORE := 80mm
:APOS := E 0mm N 0mm U 0mm
:LPOS := E 100mm N 0mm U 0mm
END
NEW ELBO =E2
:TYPE := ELBO
:NAME := =E2
:OWNER := /ASIM-1885-6"-S88112-91261M7-HC/B1
:ABORE := 80mm
:LBORE := 80mm
:APOS := E 300mm N 0mm U 0mm
:LPOS := E 400mm N 0mm U 0mm
END
`;

const [branch] = parseRmssAttributes(attText, { topologyMethod: 'topology_legacy' });
const autoPipe = branch.children.find((child) => String(child.name || '').includes('PIPE AUTO'));

assert.ok(autoPipe, 'expected an auto pipe after reducer');
assert.equal(autoPipe.attributes.LBORE, '80mm', 'downstream auto pipe should inherit reducer outlet nominal bore');
assert.equal(autoPipe.attributes.NOMINAL_BORE_SOURCE, undefined, 'staged JSON should not add OD-normalized nominal source metadata');
assert.match(autoPipe.attributes.BORE_SOURCE, /LBORE/, 'bore should come from reducer downstream LBORE side');

console.log('✅ rvm-reducer-auto-pipe-bore test passed.');
