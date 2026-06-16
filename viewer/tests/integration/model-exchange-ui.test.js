import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runTests() {
  let passed = true;

  const uiPath = path.join(__dirname, '../../tabs/model-exchange-tab.js');
  const uiContent = fs.readFileSync(uiPath, 'utf8');

  if (uiContent.includes('alert(')) {
    console.error('Failed: Found alert() in model-exchange-tab.js');
    passed = false;
  }
  if (!uiContent.includes('notify({')) {
    console.error('Failed: No notify() usage found in model-exchange-tab.js');
    passed = false;
  }
  if (!uiContent.includes('ModelexhPreviewRenderer')) {
    console.error('Failed: ModelexhPreviewRenderer is not wired in model-exchange-tab.js');
    passed = false;
  }
  if (!uiContent.includes('data-role="modelexh-preview"')) {
    console.error('Failed: Modelexh preview canvas host missing in model-exchange-tab.js');
    passed = false;
  }
  if (!uiContent.includes('open-support-config')) {
    console.error('Failed: Support settings entry point missing in model-exchange-tab.js');
    passed = false;
  }

  const outDir = path.join(__dirname, '../../../artifacts/A6/pass');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  if (passed) {
    console.log('\u2705 A6 UI Surface integration tests passed.');
    fs.writeFileSync(path.join(outDir, 'e2e.txt'), '\u2705 A6 UI Surface integration tests passed.');
  } else {
    process.exit(1);
  }
}

runTests();
