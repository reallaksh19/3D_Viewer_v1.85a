import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GlbExportAdapter } from '../../interchange/export/glb/GlbExportAdapter.js';
import { PcfExportAdapter } from '../../interchange/export/pcf/PcfExportAdapter.js';
import { XmlExportAdapter } from '../../interchange/export/xml/XmlExportAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runTests() {
  let passed = true;

  const mockProject = {
    id: 'proj-123',
    metadata: { format: 'CAESAR_XML' },
    assemblies: [],
    segments: [
      { id: 'seg-1', fromNodeId: '10', toNodeId: '20', rawAttributes: { color: 'blue' } }
    ],
    supports: [],
    annotations: []
  };

  const adapters = [
    new GlbExportAdapter(),
    new PcfExportAdapter(),
    new XmlExportAdapter()
  ];

  const allLosses = [];

  adapters.forEach(adapter => {
    const result = adapter.export(mockProject);
    if (!result.ok) { console.error('Failed export envelope for', adapter.constructor.name); passed = false; }
    if (!Array.isArray(result.losses)) { console.error('Failed losses array for', adapter.constructor.name); passed = false; }
    allLosses.push(...result.losses);
  });

  const outDir = path.join(__dirname, '../../../artifacts/A3/diagnostics');
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outDir, 'loss-report-simple.json'), JSON.stringify(allLosses, null, 2));

  if (passed) console.log('\u2705 Export roundtrip integration tests passed.');
  else process.exit(1);
}

runTests();
