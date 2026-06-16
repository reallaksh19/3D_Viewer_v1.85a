import { runCalculation } from '../../../calc/core/calc-engine.js';
import { SlugLoadsCalc } from '../../../calc/formulas/slug-loads.js';

function runTests() {
  const mockInputs = {
    resolutionLog: [],
    basis: {},
    assumptions: [],
    resolved: {
      od: 200, wall: 10, id: 180, area: 0.025, runLength: 10, bendAngle: 90,
      fluidDensity: 1000, velocity: 10, slugLength: 5, daf: 2
    }
  };

  const runs = [];
  for (let i = 0; i < 5; i++) {
      const result = runCalculation(SlugLoadsCalc, mockInputs);
      runs.push(result.benchmark.durationMs);
  }

  const max = Math.max(...runs);
  const min = Math.min(...runs);
  const variance = max - min;

  if (variance > 50) { // Tolerance of 50ms for basic JS math
      console.log(`Failed: Variance too high. Max: ${max}, Min: ${min}, Variance: ${variance}`);
      process.exit(1);
  }

  console.log(`\u2705 Benchmark variance within tolerance. Max: ${max.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);
}
runTests();
