import assert from 'assert/strict';
import { PcfExportAdapter } from '../../interchange/export/pcf/PcfExportAdapter.js';
import { PcfxExportAdapter } from '../../interchange/export/pcfx/PcfxExportAdapter.js';
import { XmlExportAdapter } from '../../interchange/export/xml/XmlExportAdapter.js';

const project = {
  id: 'proj-1',
  name: 'Smoke Project',
  metadata: { format: 'PCF' },
  assemblies: [{ id: 'asm-1', name: 'Assembly 1' }],
  segments: [{
    id: 'seg-1',
    fromNodeId: '10',
    toNodeId: '20',
    lineRef: 'LINE-100',
    normalized: { lineNoKey: 'LINE-100', sKey: 'PIPE' },
    rawAttributes: { SKEY: 'PIPE' },
  }],
  supports: [{
    id: 'sup-1',
    hostRef: '10',
    hostRefType: 'NODE',
    normalized: { supportKind: 'GUIDE' },
  }],
  annotations: [{
    id: 'ann-1',
    annotationType: 'MESSAGE-SQUARE',
    anchorRef: '10',
    text: 'LINE-100',
  }],
  diagnostics: { messages: [] },
};

const pcf = new PcfExportAdapter().export(project);
const pcfx = new PcfxExportAdapter().export(project);
const xml = new XmlExportAdapter().export(project);

assert.ok(pcf.ok && pcf.text.includes('PIPE'), 'PCF export should produce PIPE content');
assert.ok(pcfx.ok && pcfx.text.includes('"pcfx": true'), 'PCFX export should produce envelope');
assert.ok(xml.ok && xml.text.includes('<Project'), 'XML export should produce XML project envelope');

console.log('✅ interchange export smoke tests passed.');
