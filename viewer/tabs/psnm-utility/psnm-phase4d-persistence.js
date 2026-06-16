// Emergency disabled: 2026-06-09
// Reason: PSNM popup hang/no-response while overlay modules are globally imported by app.js.
// Source/setup persistence will be reintroduced natively in v7 after popup stability is confirmed.

export function PSNM_phase4dPersistenceInstalled() {
  return false;
}

if (typeof window !== 'undefined') {
  window.PSNM_PHASE4D_DISABLED = true;
}
