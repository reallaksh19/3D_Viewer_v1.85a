import { runCalculation } from '../../../calc/core/calc-engine.js';
import { SlugLoadsCalc } from '../../../calc/formulas/slug-loads.js';

function runTests() {
  let passed = true;

  // Basic mock resolving for slug input
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

  if (!result.ok) { console.error('Failed: Result not ok'); passed = false; }
  if (result.metadata.name !== 'Slug Loads') { console.error('Failed: Wrong name'); passed = false; }
  if (typeof result.benchmark.durationMs !== 'number') { console.error('Failed: Missing benchmark'); passed = false; }
  if (result.outputs.f_amp === undefined) { console.error('Failed: Missing f_amp output'); passed = false; }
  if (!Array.isArray(result.warnings)) { console.error('Failed: Missing warnings array'); passed = false; }

  if (passed) console.log('\u2705 Calc envelope unit tests passed.');
  else process.exit(1);
}
runTests();
