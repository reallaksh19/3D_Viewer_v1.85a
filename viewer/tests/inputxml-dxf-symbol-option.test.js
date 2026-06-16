import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { installInputXmlDxfSymbolOption } from '../tabs/model-converters/inputxml-dxf-symbol-option.js';

const optionSource = await fs.readFile(
  new URL('../tabs/model-converters/inputxml-dxf-symbol-option.js', import.meta.url),
  'utf8',
);
const tabSource = await fs.readFile(
  new URL('../tabs/model-converters-tab.js', import.meta.url),
  'utf8',
);
const writerSource = await fs.readFile(
  new URL('../converters/inputxml-dxf/InputXmlToDxfWriter.js', import.meta.url),
  'utf8',
);

assert.equal(typeof installInputXmlDxfSymbolOption, 'function', 'symbol option installer is exported');
assert.equal(typeof installInputXmlDxfSymbolOption(null), 'function', 'installer is a safe no-op without DOM root');
assert.ok(optionSource.includes('[data-option-key="selectedBranches"]'), 'symbol option only activates for InputXML DXF options');
assert.ok(optionSource.includes('data-option-key="showSymbols"'), 'symbol option injects showSymbols option key');
assert.ok(optionSource.includes('Show valve/flange/support symbols'), 'symbol option label is user-facing');
assert.ok(optionSource.includes('checked'), 'symbol option defaults to checked/on');
assert.ok(!optionSource.toLowerCase().includes('three'), 'symbol option has no Three.js dependency');
assert.ok(tabSource.includes("./model-converters/inputxml-dxf-symbol-option.js"), 'Model Converters tab imports the InputXML DXF symbol option');
assert.ok(tabSource.includes('installInputXmlDxfSymbolOption(container)'), 'Model Converters tab installs the InputXML DXF symbol option');
assert.ok(writerSource.includes('showSymbols: false') || writerSource.includes('showSymbols !== false'), 'writer supports showSymbols=false guard');

console.log('inputxml-dxf-symbol-option tests passed');
