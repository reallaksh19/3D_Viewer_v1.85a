import { UnitSystem } from '../units/unit-system.js';

export const NemaSm23Calc = {
  id: 'mc-nema',
  name: 'NEMA SM23 Check',
  method: 'NEMA SM23 Nozzle Load Limits',
  normalize: (raw, mode, steps) => {
    steps.push(`Normalize inputs to SI base units (excluding De which remains in imperial inches per NEMA code)`);
    return {
      fx: UnitSystem.normalize(raw.fx, 'N', 'force'),
      fy: UnitSystem.normalize(raw.fy, 'N', 'force'),
      fz: UnitSystem.normalize(raw.fz, 'N', 'force'),
      mx: UnitSystem.normalize(raw.mx || 0, 'N-m', 'moment'),
      my: UnitSystem.normalize(raw.my || 0, 'N-m', 'moment'),
      mz: UnitSystem.normalize(raw.mz || 0, 'N-m', 'moment'),
      de: raw.de // Do not normalize De, NEMA standard uses raw inches
    };
  },
  run: (envelope) => {
    const { fx, fy, fz, mx, my, mz, de } = envelope.normalizedInputs;

    if (de <= 0 || !Number.isFinite(de)) throw new Error("Equivalent Diameter (De) must be > 0");

    envelope.steps.push(`Convert force components from internal base (N) to Imperial (lbf) for NEMA code`);
    const fx_lbf = UnitSystem.convert(Math.abs(fx), 'N', 'lbf', 'force');
    const fy_lbf = UnitSystem.convert(Math.abs(fy), 'N', 'lbf', 'force');
    const fz_lbf = UnitSystem.convert(Math.abs(fz), 'N', 'lbf', 'force');

    envelope.steps.push(`Calculate Resultant Force (Fr) = sqrt(Fx^2 + Fy^2 + Fz^2) in lbf`);
    const fr_lbf = Math.sqrt(fx_lbf**2 + fy_lbf**2 + fz_lbf**2);

    envelope.steps.push(`Convert moment components from internal base (N-m) to Imperial (lbf-ft)`);
    const mx_lbf_ft = UnitSystem.convert(Math.abs(mx), 'N-m', 'lbf-ft', 'moment');
    const my_lbf_ft = UnitSystem.convert(Math.abs(my), 'N-m', 'lbf-ft', 'moment');
    const mz_lbf_ft = UnitSystem.convert(Math.abs(mz), 'N-m', 'lbf-ft', 'moment');

    envelope.steps.push(`Calculate Resultant Moment (Mr) = sqrt(Mx^2 + My^2 + Mz^2) in lbf-ft`);
    const mr_lbf_ft = Math.sqrt(mx_lbf_ft**2 + my_lbf_ft**2 + mz_lbf_ft**2);

    envelope.steps.push(`Apply NEMA Combined Equation: 3*Fr + Mr`);
    const combined_load = (3 * fr_lbf) + mr_lbf_ft;

    envelope.steps.push(`Calculate Allowable Limit: 500 * De`);
    const allowable = 500 * de;

    envelope.steps.push(`Evaluate Pass/Fail Ratio`);
    const ratio = (combined_load / allowable) * 100;
    const pass = ratio <= 100;

    envelope.outputs = {
      fx_lbf,
      fy_lbf,
      fz_lbf,
      fr_lbf,
      mr_lbf_ft,
      combined_load,
      allowable,
      ratio,
      pass
    };

    if (!pass) envelope.pass = false;
  }
};
