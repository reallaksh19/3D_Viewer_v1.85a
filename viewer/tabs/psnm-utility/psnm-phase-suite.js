// Emergency disabled: 2026-06-09
// Reason: PSNM popup hang/no-response. All popup overlay modules are disabled pending native v7 consolidation.

export const PSNM_PHASE_SUITE_VERSION = '20260609-phase-suite-disabled';

export function PSNM_phaseSuiteInstalled() {
  return false;
}

if (typeof window !== 'undefined') {
  window.PSNM_PHASE_SUITE_VERSION = PSNM_PHASE_SUITE_VERSION;
  window.PSNM_PHASE_SUITE_DISABLED = true;
  window.PSNM_phaseSuiteInstalled = PSNM_phaseSuiteInstalled;
}
