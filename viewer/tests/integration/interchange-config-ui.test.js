import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiContent = fs.readFileSync(path.join(__dirname, '../../tabs/interchange-config-tab.js'), 'utf8');
const modelExchangeContent = fs.readFileSync(path.join(__dirname, '../../tabs/model-exchange-tab.js'), 'utf8');
const debugContent = fs.readFileSync(path.join(__dirname, '../../debug/dev-debug-window.js'), 'utf8');

assert.ok(uiContent.includes('replaceConversionConfig'), 'config tab must apply config');
assert.ok(uiContent.includes('downloadConversionConfig'), 'config tab must export config');
assert.ok(modelExchangeContent.includes('export-pcf'), 'model exchange must expose export buttons');
assert.ok(modelExchangeContent.includes('import-file'), 'model exchange must expose import input');
assert.ok(modelExchangeContent.includes('renderIcon'), 'model exchange should use icons');
assert.ok(debugContent.includes('conversion-config-changed'), 'debug drawer should listen to config events');

console.log('✅ interchange UI integration tests passed.');
