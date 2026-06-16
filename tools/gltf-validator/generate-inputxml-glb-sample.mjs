import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runInputXmlToGlb } from '../../viewer/converters/inputxml-glb/inputxml-to-glb-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultInput = path.join(repoRoot, 'Benchmarks', 'INPUT XML to CII 2019', '1001', '1001-P - COPY_INPUT.XML');
const defaultOutputDir = path.join(repoRoot, 'artifacts', 'inputxml-glb');

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const inputPath = path.resolve(argValue('--input', defaultInput));
const outputDir = path.resolve(argValue('--out-dir', defaultOutputDir));
const outputName = argValue('--name', 'sample-inputxml.glb');

const xmlText = await readFile(inputPath, 'utf8');
const result = await runInputXmlToGlb({
  inputFiles: [{
    role: 'primary',
    name: path.basename(inputPath),
    text: xmlText,
  }],
  options: { includeSidecarJson: true },
  setStatus() {},
});

if (!result?.ok) {
  console.error(JSON.stringify(result?.logs || {}, null, 2));
  throw new Error(result?.diagnostics?.[0]?.message || 'InputXML→GLB sample generation failed.');
}

const glbOutput = result.outputs.find((output) => output.mime === 'model/gltf-binary' || output.name.endsWith('.glb'));
if (!glbOutput?.base64) {
  throw new Error('InputXML→GLB runner did not return a base64 GLB output.');
}

await mkdir(outputDir, { recursive: true });
const glbPath = path.join(outputDir, outputName);
await writeFile(glbPath, Buffer.from(glbOutput.base64, 'base64'));

const sidecar = result.outputs.find((output) => output.name.endsWith('.json'));
if (sidecar?.text) {
  await writeFile(`${glbPath}.sidecar.json`, sidecar.text);
}

await writeFile(`${glbPath}.logs.json`, JSON.stringify(result.logs || {}, null, 2));
console.log(JSON.stringify({ ok: true, glbPath, sizeBytes: Buffer.byteLength(glbOutput.base64, 'base64') }, null, 2));
