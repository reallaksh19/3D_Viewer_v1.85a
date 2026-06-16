import { getAllCalculators } from '../core/calc-registry.js';
import { runCalculation } from '../core/calc-engine.js';

export function runBenchmarks(cases) {
  const results = {
    total: cases.length,
    passed: 0,
    failed: 0,
    errors: 0,
    mismatches: [],
    details: []
  };

  const calculators = {};
  for (const calc of getAllCalculators()) {
    calculators[calc.id] = calc;
  }

  for (const c of cases) {
    const calc = calculators[c.calcId];
    if (!calc) {
      results.errors++;
      results.mismatches.push({ caseId: c.id, reason: 'Calculator not found' });
      continue;
    }

    try {
      const envelope = runCalculation(calc, c.inputs, c.unitMode || 'Native');

      let casePassed = envelope.pass;
      const mismatchReasons = [];

      // Check outputs
      if (c.expectedOutputs) {
        for (const [key, expected] of Object.entries(c.expectedOutputs)) {
          const actual = envelope.outputs[key];
          if (typeof expected === 'number' && typeof actual === 'number') {
            const tol = c.tolerance || 0.01;
            if (Math.abs(expected - actual) > tol) {
              casePassed = false;
              mismatchReasons.push(`Output ${key} mismatch: expected ${expected}, got ${actual}`);
            }
          } else if (expected !== actual) {
             casePassed = false;
             mismatchReasons.push(`Output ${key} mismatch: expected ${expected}, got ${actual}`);
          }
        }
      }

      // Check for NaN or Inf
      const checkNaN = (obj) => {
         for (const key in obj) {
             if (typeof obj[key] === 'number' && !Number.isFinite(obj[key])) {
                 casePassed = false;
                 mismatchReasons.push(`Output ${key} is not finite: ${obj[key]}`);
             } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                 checkNaN(obj[key]);
             }
         }
      }
      checkNaN(envelope.outputs);

      if (casePassed) {
        results.passed++;
      } else {
        results.failed++;
        results.mismatches.push({ caseId: c.id, reasons: mismatchReasons });
      }

      results.details.push({
        caseId: c.id,
        envelope,
        passed: casePassed
      });

    } catch (e) {
      results.errors++;
      results.mismatches.push({ caseId: c.id, reason: `Runtime error: ${e.message}` });
    }
  }

  return results;
}
