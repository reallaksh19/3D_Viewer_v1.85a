import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { installInputXmlDxfBranchPicker } from '../tabs/model-converters/inputxml-dxf-branch-picker.js';

const pickerSource = await fs.readFile(
  new URL('../tabs/model-converters/inputxml-dxf-branch-picker.js', import.meta.url),
  'utf8',
);
const tabSource = await fs.readFile(
  new URL('../tabs/model-converters-tab.js', import.meta.url),
  'utf8',
);

assert.equal(typeof installInputXmlDxfBranchPicker, 'function', 'branch picker installer is exported');
assert.equal(typeof installInputXmlDxfBranchPicker(null), 'function', 'installer is a safe no-op without DOM root');
assert.ok(pickerSource.includes('extractInputXmlBranches'), 'branch picker reuses the UXML-backed InputXML extractor');
assert.ok(pickerSource.includes('[data-option-key="selectedBranches"]'), 'branch picker targets the selectedBranches option');
assert.ok(pickerSource.includes('input[type="file"]'), 'branch picker discovers the selected primary XML file from file input');
assert.ok(pickerSource.includes('data-inputxml-dxf-branch-id'), 'branch picker renders selectable branch ids');
assert.ok(pickerSource.includes('data-inputxml-branch-tree-node'), 'branch picker renders a branch-level tree');
assert.ok(pickerSource.includes('data-inputxml-tree-filter'), 'branch picker supports branch filtering');
assert.ok(pickerSource.includes('data-inputxml-tree-select-all'), 'branch picker supports select-all');
assert.ok(pickerSource.includes('data-inputxml-tree-invert'), 'branch picker supports invert selection');
assert.ok(pickerSource.includes('exportNodeLabels'), 'branch picker exposes node label export option');
assert.ok(pickerSource.includes('exportLengthText'), 'branch picker exposes length/segment text option');
assert.ok(pickerSource.includes('showSupportLabels'), 'branch picker exposes restraint/support text option');
assert.ok(pickerSource.includes('showComponentLabels'), 'branch picker exposes component text option');
assert.ok(pickerSource.includes('setSelectedBranches'), 'branch picker writes selected ids back to the option input');
assert.ok(!pickerSource.includes('three'), 'branch picker has no Three.js dependency');
assert.ok(tabSource.includes("./model-converters/inputxml-dxf-branch-picker.js"), 'Model Converters tab imports the InputXML branch picker');
assert.ok(tabSource.includes('installInputXmlDxfBranchPicker(container)'), 'Model Converters tab installs the InputXML branch picker');

console.log('inputxml-dxf-branch-picker tests passed');
