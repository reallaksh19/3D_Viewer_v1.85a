import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const invocation = fs.readFileSync(path.join(root, 'viewer/converters/invocation-builder.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'viewer/converters/py-worker.js'), 'utf8');

const xmlToCiiMatch = invocation.match(/if \(converterId === 'xml_to_cii'\) return \{ script: '([^']+)'/);
assert.ok(xmlToCiiMatch, 'xml_to_cii converter script mapping must exist');

const scriptName = xmlToCiiMatch[1];
assert.strictEqual(scriptName, 'xml_to_cii2019_direction.py');
assert.ok(worker.includes(`'${scriptName}'`), `${scriptName} must be listed in py-worker SCRIPT_FILE_NAMES`);
assert.ok(fs.existsSync(path.join(root, 'viewer/converters/scripts', scriptName)), `${scriptName} must exist in viewer/converters/scripts`);

console.log('✅ converter script packaging regression tests passed');
