// Legacy manual-anchor guard disabled.
//
// This module previously installed a capture-phase Run Match blocker and reset
// anchor dropdowns to blank unless a legacy local-storage snapshot existed.
// That conflicted with the production Auto Anchor + anchor persistence flow,
// where a selected Auto Anchor pair is restored from psnm.anchorSelection.v1.
//
// Keep the module as a no-op compatibility shim because older import chains
// still import psnm-anchor-selection.js -> psnm-manual-anchor-policy.js.

export function PSNM_manualAnchorPolicyInstalled() {
  return true;
}
