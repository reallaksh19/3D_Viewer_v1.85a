export const UNIT_FAMILIES = {
  length: {
    base: 'mm',
    si: 'm',
    imperial: 'in',
    conversions: {
      mm: 1,
      m: 1000,
      in: 25.4,
      ft: 304.8
    }
  },
  area: {
    base: 'mm2',
    si: 'm2',
    imperial: 'in2',
    conversions: {
      mm2: 1,
      m2: 1000000,
      in2: 645.16
    }
  },
  force: {
    base: 'N',
    si: 'N',
    imperial: 'lbf',
    conversions: {
      N: 1,
      kN: 1000,
      lbf: 4.4482216
    }
  },
  moment: {
    base: 'N-mm',
    si: 'N-m',
    imperial: 'lbf-ft',
    conversions: {
      'N-mm': 1,
      'N-m': 1000,
      'lbf-ft': 1355.81795
    }
  },
  pressure: {
    base: 'MPa',
    si: 'kPa',
    imperial: 'psi',
    conversions: {
      MPa: 1,
      kPa: 0.001,
      Pa: 0.000001,
      psi: 0.00689476
    }
  },
  temperature: {
    base: 'C',
    si: 'C',
    imperial: 'F',
    // Special handling required for temperature
  },
  density: {
    base: 'kg/m3',
    si: 'kg/m3',
    imperial: 'lb/ft3',
    conversions: {
      'kg/m3': 1,
      'lb/ft3': 16.018463
    }
  },
  velocity: {
    base: 'm/s',
    si: 'm/s',
    imperial: 'ft/s',
    conversions: {
      'm/s': 1,
      'ft/s': 0.3048
    }
  },
  mass_flow: {
    base: 'kg/s',
    si: 'kg/s',
    imperial: 'lb/hr',
    conversions: {
      'kg/s': 1,
      'lb/hr': 0.00012599788
    }
  },
  stress: {
    base: 'MPa',
    si: 'MPa',
    imperial: 'psi',
    conversions: {
      MPa: 1,
      psi: 0.00689476
    }
  }
};
