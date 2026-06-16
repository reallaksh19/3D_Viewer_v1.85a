import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup mock state first before importing debug-tab
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { getElementById: () => null };

import { exportDebugSnapshot } from '../../../tabs/debug-tab.js';
import { state } from '../../../core/state.js';
import { calcHistory } from '../../../calc/core/calc-session.js';
import { runCalculation } from '../../../calc/core/calc-engine.js';
import { SlugLoadsCalc } from '../../../calc/formulas/slug-loads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runTests() {
  state.parsed = { mock: 'data' };

  const mockInputs = {
    resolutionLog: [],
    basis: {},
    assumptions: [],
    resolved: {
      od: 200, wall: 10, id: 180, area: 0.025, runLength: 10, bendAngle: 90,
      fluidDensity: 1000, velocity: 10, slugLength: 5, daf: 2
    }
  };

  const result = runCalculation(SlugLoadsCalc, mockInputs);
  calcHistory.push(result);

  const snapshot = exportDebugSnapshot();

  let passed = true;
  if (!snapshot.parsed) { console.log('Failed: missing parsed data'); passed = false; }
  if (!snapshot.calcHistory || snapshot.calcHistory.length === 0) { console.log('Failed: missing calc history'); passed = false; }
  if (snapshot.calcHistory[0].metadata.name !== 'Slug Loads') { console.log('Failed: calc history corrupted'); passed = false; }

  const outDir = path.join(__dirname, '../../../../artifacts/A7/diagnostics');
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outDir, 'calc-benchmark.json'), JSON.stringify(snapshot, null, 2));

  if (passed) console.log('\u2705 Debug snapshot integration passed.');
  else process.exit(1);
}

runTests();
