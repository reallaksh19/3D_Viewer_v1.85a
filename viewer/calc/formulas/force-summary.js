export const ForceSummaryCalc = {
  id: 'mc-force',
  name: 'Force Summary',
  method: 'Resultant Load Display',
  run: (envelope) => {
    const { forces } = envelope.normalizedInputs;

    envelope.steps.push(`Calculate Resultant Forces (Fr) and Moments (Mr) for extracted nodes`);

    const results = (forces || []).map(f => {
      const magnitude = Math.sqrt(f.fx**2 + f.fy**2 + f.fz**2);
      const mx = f.mx || 0; const my = f.my || 0; const mz = f.mz || 0;
      const moment_magnitude = Math.sqrt(mx**2 + my**2 + mz**2);
      return { ...f, magnitude, moment_magnitude };
    });

    envelope.outputs.forces = results;
  }
};
