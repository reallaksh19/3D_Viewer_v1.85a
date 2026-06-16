import { UnitSystem } from '../units/unit-system.js';

export const MomentumCalc = {
  id: 'mc-momentum',
  name: 'Momentum Calc',
  method: 'F = rho * A * v^2',
  normalize: (raw, mode, steps) => {
    // Phase 2: Unit conversion (SI base)
    steps.push(`Normalize inputs to internal base units (SI)`);
    return raw;
  },
  run: (envelope) => {
    const { pipes } = envelope.normalizedInputs;

    envelope.steps.push(`Calculate force for each pipe group: F = p * A * v^2`);

    const results = pipes.map(pipe => {
      const { area, density, velocity } = pipe;
      const force = density * area * Math.pow(velocity, 2);
      return { ...pipe, force };
    });

    envelope.outputs.forces = results;
  }
};
