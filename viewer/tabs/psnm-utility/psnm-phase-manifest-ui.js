import { PSNM_getPhaseManifest } from './psnm-phase-manifest.js';

const STYLE_ID = 'psnm-phase-manifest-style';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-4f-btn{background:#334155!important}.psnm-4f-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.psnm-4f-table th,.psnm-4f-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left;vertical-align:top}.psnm-4f-badge{display:inline-block;border-radius:999px;background:rgba(59,130,246,.18);color:#93c5fd;font-weight:800;padding:2px 7px}.psnm-4f-files{font-family:ui-monospace,Consolas,monospace;color:#cbd5e1;white-space:pre-line}.psnm-4f-note{border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.55);border-radius:10px;padding:9px 10px;color:#cbd5e1;font-size:12px;line-height:1.45}`;
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
  if (!actions || actions.querySelector('[data-psnm-4f-action="manifest"]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'psnm-btn psnm-btn-secondary psnm-4f-btn';
  btn.dataset.psnm4fAction = 'manifest';
  btn.textContent = 'Phase Manifest';
  actions.appendChild(btn);
}

function showManifest(modal) {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let panel = modal.querySelector('[data-psnm-4f-manifest]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'psnm-card';
    panel.dataset.psnm4fManifest = '1';
    body.appendChild(panel);
  }
  const phases = PSNM_getPhaseManifest();
  panel.innerHTML = `<div class="psnm-card-head"><b>PSNM Phase Manifest / Self Audit</b><span class="psnm-4f-badge">${phases.length} phases</span></div><div class="psnm-card-body"><div class="psnm-4f-note">This panel lists the implemented master-table phases and the contract each phase is expected to preserve.</div><table class="psnm-4f-table"><thead><tr><th>Phase</th><th>Name</th><th>Contract</th><th>Files</th></tr></thead><tbody>${phases.map((phase) => `<tr><td><span class="psnm-4f-badge">${h(phase.id)}</span></td><td>${h(phase.name)}</td><td>${h(phase.contract)}</td><td class="psnm-4f-files">${h(phase.files.join('\n'))}</td></tr>`).join('')}</tbody></table></div>`;
}

document.addEventListener('click', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  const action = event.target.closest('[data-psnm-4f-action]')?.dataset?.psnm4fAction;
  if (action !== 'manifest') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showManifest(modal);
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton), 0);

export function PSNM_phaseManifestUiInstalled() {
  return true;
}
