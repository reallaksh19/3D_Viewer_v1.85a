// Emergency disabled: 2026-06-09
// Reason: PSNM popup hang/no-response while overlay modules are globally imported by app.js.
// Core PSNM v6 matcher remains active; UI enhancements will be reintroduced natively in v7.

export function PSNM_P2_isInstalled() {
  return false;
}

if (typeof window !== 'undefined') {
  window.PSNM_P2_DISABLED = true;
}
