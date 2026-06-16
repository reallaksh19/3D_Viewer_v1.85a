import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('Running Model Converters imports test...');
  const registryPath = path.join(__dirname, '../viewer/tabs/model-converters/converter-registry.js');
  const adapterPath = path.join(__dirname, '../viewer/tabs/model-converters/legacy-adapter.js');
  
  // Use dynamic import since the registry file will be created later
  const moduleUrl = new URL(`file://${registryPath.replace(/\\/g, '/')}`);
  const { CONVERTERS } = await import(moduleUrl.href);

  // Validate all imports in legacy-adapter.js (e.g. preview-renderer.js, weight-match-renderer.js)
  const adapterUrl = new URL(`file://${adapterPath.replace(/\\/g, '/')}`);
  await import(adapterUrl.href);

  assert(Array.isArray(CONVERTERS), 'CONVERTERS must be an array');
  console.log(`Found ${CONVERTERS.length} registered converters.`);

  const ids = new Set();
  for (const converter of CONVERTERS) {
    assert(converter.id, 'Converter must have an ID');
    assert(converter.label, `Converter ${converter.id} must have a label`);
    assert(Array.isArray(converter.inputs), `Converter ${converter.id} must have inputs array`);
    assert(typeof converter.run === 'function', `Converter ${converter.id} must have a run() function`);
    
    assert(!ids.has(converter.id), `Duplicate converter ID: ${converter.id}`);
    ids.add(converter.id);
    console.log(`  - Validated converter: ${converter.id} (${converter.label})`);
  }

  console.log('✅ Imports test passed successfully!');
}

runTest().catch((err) => {
  console.error('❌ Imports test failed:', err);
  process.exit(1);
});
