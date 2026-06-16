export const SlugLoadsCalc = {
  id: 'mc-slug',
  name: 'Slug Loads',
  method: 'Momentum / DAF Evaluation',
  normalize: (raw, mode, steps) => {
    steps.push(`Normalize inputs. Note: Slug inputs are pre-resolved via slug-input-resolver.`);
    return raw; // Inputs come pre-resolved from resolver
  },
  run: (envelope) => {
    const resPayload = envelope.normalizedInputs;

    // We attach the resolved bundle to the envelope for UI consumption
    envelope.inputResolution = resPayload.resolutionLog;
    envelope.sourceSnapshot = resPayload.basis;
    envelope.assumptions = resPayload.assumptions;

    const {
        od, wall, id, area, runLength, bendAngle,
        fluidDensity, velocity, slugLength, daf
    } = resPayload.resolved;

    envelope.steps.push(`Calculate Internal Diameter: ID = OD - 2*wall = ${od} - 2*${wall} = ${id.toFixed(3)} mm`);
    envelope.steps.push(`Calculate Area: A = pi/4 * ID^2 = pi/4 * (${id/1000})^2 = ${area.toFixed(5)} m2`);

    const slugMass = fluidDensity * area * slugLength;
    envelope.steps.push(`Calculate Slug Mass: m_slug = rho * A * L_slug = ${fluidDensity} * ${area.toFixed(5)} * ${slugLength} = ${slugMass.toFixed(2)} kg`);

    const steadyForce = fluidDensity * area * Math.pow(velocity, 2);
    envelope.steps.push(`Calculate Steady Flow Force: F = rho * A * v^2 = ${fluidDensity} * ${area.toFixed(5)} * ${velocity}^2 = ${steadyForce.toFixed(2)} N`);

    let f_bend = 0;
    if (resPayload.basis.bendNode || bendAngle > 0) {
        const rads = bendAngle * (Math.PI / 180);
        f_bend = 2 * steadyForce * Math.sin(rads / 2);
        envelope.steps.push(`Calculate Bend Force: F_bend = 2 * F * sin(theta/2) = 2 * ${steadyForce.toFixed(2)} * sin(${bendAngle}/2) = ${f_bend.toFixed(2)} N`);
    }

    const baseForce = f_bend > 0 ? f_bend : steadyForce;
    const f_amp = daf * baseForce;
    envelope.steps.push(`Calculate Amplified Force: F_amp = DAF * BaseForce = ${daf} * ${baseForce.toFixed(2)} = ${f_amp.toFixed(2)} N`);

    envelope.intermediateValues = { id, area, slugMass, steadyForce, f_bend, baseForce };
    envelope.outputs = {
        f_amp,
        baseForce,
        steadyForce,
        slugMass
    };

    envelope.benchmark = {
        source: "ITHACA - Slug Loads.XLS",
        caseId: "PENDING_SOURCE_EXTRACTION",
        expected: "N/A",
        actual: f_amp,
        status: "PENDING"
    };

    if (resPayload.assumptions.length > 0) {
        resPayload.assumptions.forEach(a => envelope.warnings.push(a));
    }
  }
};
