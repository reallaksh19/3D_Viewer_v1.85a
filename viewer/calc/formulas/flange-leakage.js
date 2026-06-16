export const FlangeLeakageCalc = {
  id: 'mc-flange',
  name: 'Flange Leakage',
  method: 'Equivalent Pressure Method (Kellogg)',
  normalize: (raw, mode, steps) => {
      // Allow fallback calculation if single input provided instead of array
      if (raw.manual) {
          steps.push(`Normalize manual flange inputs`);
          return {
              manual: true,
              rating: raw.rating,
              p: raw.p,
              f_axial: raw.f_axial,
              m_bend: raw.m_bend,
              g_dia: raw.g_dia
          };
      }
      return raw;
  },
  run: (envelope) => {
    const { flanges, manual, rating, p, f_axial, m_bend, g_dia } = envelope.normalizedInputs;

    if (manual) {
        envelope.steps.push(`Calculate Equivalent Pressure Pe = (16 * M / (pi * G^3)) + (4 * F / (pi * G^2))`);
        // Assumes coherent units (e.g. M in in-lb, F in lbf, G in inches) for a generic check
        const pe_mom = (16 * m_bend) / (Math.PI * Math.pow(g_dia, 3));
        const pe_axial = (4 * f_axial) / (Math.PI * Math.pow(g_dia, 2));
        const pe_total = pe_mom + pe_axial;
        const p_eq = p + pe_total;

        envelope.steps.push(`Evaluate Ratio against rating`);
        const ratio = p_eq / rating;

        envelope.outputs = {
            pe_mom,
            pe_axial,
            pe_total,
            p_eq,
            ratio,
            pass: ratio <= 1
        };
        envelope.pass = ratio <= 1;
    } else {
        envelope.steps.push(`Process flange extraction data`);
        envelope.outputs.flanges = flanges || [];
        envelope.warnings.push('Displaying extracted data only. Provide manual inputs to evaluate specific flange.');
    }
  }
};
