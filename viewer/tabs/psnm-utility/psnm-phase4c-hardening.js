// Emergency disabled: 2026-06-09
// Reason: PSNM popup hang/no-response traced to overlay MutationObserver/enhancement path.
// Core PSNM v6 matcher remains active via viewer/tabs/psnm-utility-tab-v6.js.

export function PSNM_phase4cHardeningInstalled() {
  return false;
}

if (typeof window !== 'undefined') {
  window.PSNM_PHASE4C_DISABLED = true;
}
