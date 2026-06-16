import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { installInputXmlDxfLegacyBridge } from '../tabs/model-converters/inputxml-dxf-legacy-bridge.js';

const bridgeSource = await fs.readFile(
  new URL('../tabs/model-converters/inputxml-dxf-legacy-bridge.js', import.meta.url),
  'utf8',
);
const tabSource = await fs.readFile(
  new URL('../tabs/model-converters-tab.js', import.meta.url),
  'utf8',
);

assert.equal(typeof installInputXmlDxfLegacyBridge, 'function', 'legacy bridge installer is exported');
assert.equal(typeof installInputXmlDxfLegacyBridge(null), 'function', 'installer is a safe no-op without DOM root');
assert.ok(bridgeSource.includes("value = CONVERTER_ID"), 'bridge appends converter option with InputXML DXF id');
assert.ok(bridgeSource.includes('InputXML→DXF'), 'bridge exposes InputXML→DXF label');
assert.ok(bridgeSource.includes("#model-converters-select"), 'bridge targets visible legacy converter select');
assert.ok(bridgeSource.includes('stopImmediatePropagation'), 'bridge intercepts legacy event path only for InputXML DXF');
assert.ok(bridgeSource.includes('runInputXmlToDxf'), 'bridge calls the JS InputXML DXF runner directly');
assert.ok(bridgeSource.includes('data-option-key="selectedBranches"'), 'bridge renders selectedBranches option for branch picker');
assert.ok(bridgeSource.includes('downloadOutput'), 'bridge renders downloadable outputs');
assert.ok(!bridgeSource.toLowerCase().includes('three'), 'bridge has no Three.js dependency');
assert.ok(tabSource.includes("./model-converters/inputxml-dxf-legacy-bridge.js"), 'Model Converters tab imports the bridge');
assert.ok(tabSource.includes('installInputXmlDxfLegacyBridge(container)'), 'Model Converters tab installs the bridge');

console.log('inputxml-dxf-legacy-bridge tests passed');
