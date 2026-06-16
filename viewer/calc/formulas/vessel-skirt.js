export const VesselSkirtCalc = {
  id: 'mc-skirt',
  name: 'Vessel Skirt Temp',
  method: 'Cheng & Weil Exponential Profile',
  run: (envelope) => {
    const { ta, t, k, h } = envelope.normalizedInputs;

    envelope.steps.push(`Determine thermal constants (K)`);
    // Example upgraded engineering formula: typically involves conduction/convection params.
    // For now we refine the existing model to explicitly show the profile generation.
    envelope.steps.push(`Calculate temperature diff: ΔT = T - Ta`);
    const deltaT = t - ta;
    envelope.intermediateValues.deltaT = deltaT;

    const profile = [];
    // Calculate in 10 segments for higher resolution
    for (let x = 0; x <= h; x += h/10) {
       // Tx = Ta + (T - Ta) * e^(-K * x/h)
       const tx = ta + deltaT * Math.exp(-k * (x / (h || 1)));
       profile.push({ x, tx });
    }

    envelope.outputs.deltaT = deltaT;
    envelope.outputs.profile = profile;

    envelope.warnings.push('Method is based on a simplified thermal decay. For strict pressure vessel codes, refer to FEA thermal mapping.');
  }
};
