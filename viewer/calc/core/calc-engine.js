import { createResultEnvelope, buildCalcResult } from './calc-types.js';
import { addLog, CATEGORY, SEVERITY } from '../../core/logger.js';

export function runCalculation(calcModule, rawInputs, unitMode = 'Native') {
  const t0 = performance.now();
  const envelope = createResultEnvelope();
  envelope.metadata.id = calcModule.id || 'unknown';
  envelope.metadata.name = calcModule.name || 'Unknown Calc';
  envelope.metadata.method = calcModule.method || 'Unknown Method';
  envelope.metadata.unitMode = unitMode;

  envelope.inputs = { ...rawInputs };
  // Normalization logic: defer to calc module's declared inputs or passthrough
  envelope.normalizedInputs = { ...rawInputs };

  if (calcModule.normalize) {
    envelope.normalizedInputs = calcModule.normalize(rawInputs, unitMode, envelope.steps);
  }

  try {
    if (calcModule.run) {

      // Central numeric validation of incoming normalized inputs
      for (const [key, val] of Object.entries(envelope.normalizedInputs)) {
          if (typeof val === 'number' && !Number.isFinite(val)) {
              throw new Error(`Input parameter '${key}' is invalid (${val}). Ensure valid numeric input.`);
          }
      }

      calcModule.run(envelope);

      // Central numeric validation of outgoing results
      for (const [key, val] of Object.entries(envelope.outputs)) {
          if (typeof val === 'number' && !Number.isFinite(val)) {
              throw new Error(`Output parameter '${key}' is invalid (${val}). Calculation failed.`);
          }
      }

    } else {
      throw new Error(`Calculator ${calcModule.id} has no run method.`);
    }
  } catch (err) {
    envelope.errors.push(err.message);
    envelope.pass = false;
    addLog({
      severity: SEVERITY.ERROR,
      category: CATEGORY.UI,
      message: `Calc Engine Error (${calcModule.name}): ${err.message}`,
    });
  }

  // Generate warnings to log
  envelope.warnings.forEach(w => {
    addLog({
      severity: SEVERITY.WARNING,
      category: CATEGORY.UI,
      message: `Calc Warning (${calcModule.name}): ${w}`
    });
  });

    const t1 = performance.now();
  return buildCalcResult({
      name: envelope.metadata.name,
      inputs: { ...envelope.inputs, unitMode: envelope.metadata.unitMode },
      outputs: envelope.outputs,
      warnings: envelope.warnings || [],
      steps: envelope.steps || [],
      benchmark: { durationMs: t1 - t0 }
  });
}
