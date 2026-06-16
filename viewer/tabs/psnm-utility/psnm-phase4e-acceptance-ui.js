import { PSNM_runMasterAcceptanceSuite } from './psnm-master-acceptance-suite.js';

const STYLE_ID = 'psnm-phase4e-acceptance-style';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-4e-btn{background:#7c2d12!important}.psnm-4e-pass{color:#86efac;font-weight:800}.psnm-4e-fail{color:#fca5a5;font-weight:800}.psnm-4e-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.psnm-4e-table th,.psnm-4e-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:6px 8px;text-align:left;vertical-align:top}.psnm-4e-summary{border:1px solid rgba(251,191,36,.35);background:rgba(120,53,15,.20);color:#fde68a;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.45}`;
  document.head.appendChild(style);
}

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function findModal(target) {
  return target?.closest?.('[data-psnm="modal"]') || document.querySelector('[data-psnm="modal"]');
}

function ensureButton(modal) {
  installStyle();
  const actions = modal.querySelector('.psnm-statusbar .psnm-actions');
  if (!actions || actions.querySelector('[data-psnm-4e-action="acceptance"]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'psnm-btn psnm-btn-secondary psnm-4e-btn';
  btn.dataset.psnm4eAction = 'acceptance';
  btn.textContent = 'Run Acceptance Suite';
  actions.appendChild(btn);
}

function showResult(modal, result) {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let panel = modal.querySelector('[data-psnm-4e-result]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'psnm-card';
    panel.dataset.psnm4eResult = '1';
    body.appendChild(panel);
  }
  const failed = result.checks.filter((item) => !item.pass).length;
  panel.innerHTML = `<div class="psnm-card-head"><b>Phase 4E Acceptance Suite</b><span class="${result.ok ? 'psnm-4e-pass' : 'psnm-4e-fail'}">${result.ok ? 'PASS' : 'FAIL'}</span></div><div class="psnm-card-body"><div class="psnm-4e-summary">Checks: ${result.checks.length} | Failed: ${failed} | Master PS: ${result.counts.masterPs} | Master Node: ${result.counts.masterNode} | Match Rows: ${result.counts.matchRows}</div><table class="psnm-4e-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>${result.checks.map((item) => `<tr><td>${h(item.name)}</td><td class="${item.pass ? 'psnm-4e-pass' : 'psnm-4e-fail'}">${item.pass ? 'PASS' : 'FAIL'}</td><td>${h(item.details)}</td></tr>`).join('')}</tbody></table></div>`;
}

document.addEventListener('click', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  const action = event.target.closest('[data-psnm-4e-action]')?.dataset?.psnm4eAction;
  if (action !== 'acceptance') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showResult(modal, PSNM_runMasterAcceptanceSuite());
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton), 0);

export function PSNM_phase4eAcceptanceUiInstalled() {
  return true;
}
