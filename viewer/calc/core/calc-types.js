/**
 * Types and structures for calculation envelopes.
 */

export function createResultEnvelope() {
  return {
    metadata: {
      id: '',
      name: '',
      method: '',
      unitMode: 'Native'
    },
    inputs: {},
    normalizedInputs: {},
    steps: [],
    intermediateValues: {},
    outputs: {},
    checks: [],
    warnings: [],
    errors: [],
    pass: true
  };
}

export function buildCalcResult({ name, inputs, outputs, warnings, steps, benchmark }) {
  return {
    ok: true,
    metadata: { name, unitMode: inputs?.unitMode || 'unknown' },
    inputs: inputs || {},
    outputs: outputs || {},
    warnings: warnings || [],
    steps: steps || [],
    benchmark: benchmark || null,
    ts: new Date().toISOString(),
  };
}
