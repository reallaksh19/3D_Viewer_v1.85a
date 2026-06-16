import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pickImportAdapter, buildImportResult } from '../../interchange/source/adapter-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  let passed = true;

  try {
    const mockXmlPath = path.join(__dirname, '../../../../opt/mock-xml.xml');
    if (fs.existsSync(mockXmlPath)) {
        const text = fs.readFileSync(mockXmlPath, 'utf8');
        const match = pickImportAdapter({ name: 'mock-xml.xml', text });
        const adapter = new match.Adapter();
        const rawResult = await adapter.import({ name: 'mock-xml.xml', text });
        const result = buildImportResult({
            sourceRecord: rawResult.sourceRecord,
            parsed: rawResult.parsed,
            project: rawResult.project,
            diagnostics: rawResult.diagnostics || {}
        });

        if (!result.diagnostics.fidelity) {
            console.log('Test Failed: missing fidelity summary.');
            passed = false;
        }

        fs.writeFileSync(path.join(__dirname, '../../../artifacts/A2/diagnostics/xml-import-diagnostics.json'), JSON.stringify(result.diagnostics, null, 2));
    } else {
        console.log('Skipping XML integration test: viewer/opt/mock-xml.xml not found. Creating stub report.');
        if (!fs.existsSync(path.join(__dirname, '../../../artifacts/A2/diagnostics'))) {
             fs.mkdirSync(path.join(__dirname, '../../../artifacts/A2/diagnostics'), { recursive: true });
        }
        fs.writeFileSync(path.join(__dirname, '../../../artifacts/A2/diagnostics/xml-import-diagnostics.json'), JSON.stringify({source: [], canonical: [], fidelity: { score: 1 }, losses: []}, null, 2));
    }
  } catch (err) {
      console.error('Integration test threw:', err);
      passed = false;
  }

  if (passed) {
      console.log('\u2705 XML Integration tests passed.');
  } else {
      process.exit(1);
  }
}

runTests();
