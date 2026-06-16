import { annulusMetalMassKg, contentsMassKg, DEFAULT_GRAVITY_M_S2, round } from './geometryMath.js';

export function segmentMass(component, lengthMm, options = {}) {
  const dimensions = component.derived?.dimensions || {};
  const fluidDensityKgM3 = Number(options.fluidDensityKgM3 ?? 1000);
  const gravityM_S2 = Number(options.gravityM_S2 ?? DEFAULT_GRAVITY_M_S2);
  const metalMassKg = pipeMetalMass(dimensions, lengthMm);
  const fillMassKg = contentsMassKg({
    boreMm: Number(dimensions.boreMm ?? component.bore),
    lengthMm,
    densityKgM3: fluidDensityKgM3,
  });
  const componentWeightKg = Number(dimensions.weightKg ?? 0);
  const totalMassKg = metalMassKg + fillMassKg + componentWeightKg;

  return {
    metalMass_kg: round(metalMassKg),
    contentsMass_kg: round(fillMassKg),
    componentWeight_kg: round(componentWeightKg),
    totalMass_kg: round(totalMassKg),
    totalWeight_N: round(totalMassKg * gravityM_S2),
  };
}

function pipeMetalMass(dimensions, lengthMm) {
  const weightKgPerM = Number(dimensions.weightKgPerM);
  if (Number.isFinite(weightKgPerM) && Number.isFinite(lengthMm)) {
    return weightKgPerM * lengthMm / 1000;
  }
  return annulusMetalMassKg({
    odMm: Number(dimensions.odMm),
    wallMm: Number(dimensions.wallMm),
    lengthMm,
    densityKgM3: Number(dimensions.materialDensityKgM3),
  });
}
