import { VesselSkirtCalc } from '../formulas/vessel-skirt.js';
import { TrunnionCalc } from '../formulas/trunnion.js';
import { ReliefValveCalc } from '../formulas/relief-valve.js';
import { NemaSm23Calc } from '../formulas/nema-sm23.js';
import { MomentumCalc } from '../formulas/momentum.js';

import { registerCalculator } from '../core/calc-registry.js';
import { runBenchmarks } from './benchmark-runner.js';
import { generateBenchmarkReport } from './benchmark-reporter.js';

registerCalculator('mc-skirt', VesselSkirtCalc);
registerCalculator('mc-trunnion', TrunnionCalc);
registerCalculator('mc-rvforce', ReliefValveCalc);
registerCalculator('mc-nema', NemaSm23Calc);
registerCalculator('mc-momentum', MomentumCalc);

const cases = [
    {
        id: 'skirt-01',
        calcId: 'mc-skirt',
        inputs: { ta: 25, t: 80, k: 1, h: 3250 },
        unitMode: 'Native'
    },
    {
        id: 'trun-01',
        calcId: 'mc-trunnion',
        inputs: { od: 219.1, wall: 8.18, fx: 1000, fy: 500, fz: 200, L: 300 },
        unitMode: 'Native'
    },
    {
        id: 'trun-02',
        calcId: 'mc-trunnion',
        inputs: { od: 219.1, wall: 8.18, fx: 1000, fy: 500, fz: 200, L: 300 },
        unitMode: 'Imperial' // Should not cause errors during format output
    },
    {
        id: 'rv-01',
        calcId: 'mc-rvforce',
        inputs: { pset: 262, tf: 335, k: 1.29, mw: 6.52, w: 101663, ae: 78.54, pa: 14.7 },
        unitMode: 'Native'
    },
    {
        id: 'nema-01',
        calcId: 'mc-nema',
        inputs: { fx: 1000, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, de: 13.333 },
        unitMode: 'Native'
    },
    {
        id: 'mom-01',
        calcId: 'mc-momentum',
        inputs: { pipes: [{ area: 0.1, density: 1000, velocity: 2 }] },
        unitMode: 'Native'
    }
];

const results = runBenchmarks(cases);
console.log("Benchmark Results:");
console.log(`Total: ${results.total}, Pass: ${results.passed}, Fail: ${results.failed}, Error: ${results.errors}`);

if (results.mismatches && results.mismatches.length > 0) {
    console.error("Mismatches found:", JSON.stringify(results.mismatches, null, 2));
    process.exit(1);
} else {
    console.log("Zero errors confirmed.");
    process.exit(0);
}
