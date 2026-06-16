const PHASE_LABELS = {
  regex: '1 Regex',
  'import-masters': '2 Import Masters',
  preview: '3 Preview',
  diagnostics: '4 Diagnostics',
  'weight-match': '5 Weight Match',
  run: '6 Run',
  'support-mapper': '7 Support Mapping',
  config: '8 Config',
};

let installed = false;

function textOf(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function patchPhaseButtons(root = document) {
  root.querySelectorAll?.('[data-xml-cii-phase]').forEach((button) => {
    const id = button.getAttribute('data-xml-cii-phase') || '';
    const label = PHASE_LABELS[id];
    if (!label) return;
    const span = button.querySelector('span');
    if (span) span.textContent = label;
    else button.textContent = label;
  });
}

function hideDuplicateTitles(root = document) {
  const labels = new Set([
    '1 Regex', '2 Import Masters', '3 Preview', '4 Diagnostics',
    '4A Weight Match', '5 Weight Match', '5 Run', '6 Run',
    '6 Support Types', '6 Support Mapping', '7 Support Mapping',
    '7 Config', '8 Config',
  ]);
  root.querySelectorAll?.('.model-converters-workflow-detail-title').forEach((title) => {
    const value = textOf(title).replace(/ i$/i, '').trim();
    if (!labels.has(value)) return;
    title.style.display = 'none';
    title.dataset.xmlCiiHiddenDuplicateTitle = 'true';
  });
}

function patchRunPhase(root = document) {
  const reviewButton = root.querySelector?.('[data-xml-cii-run-from-workflow]');
  if (!reviewButton) return;
  reviewButton.textContent = '▶ Review Weight Matches';
  const note = reviewButton.parentElement?.querySelector('.model-converters-workflow-detail-note');
  if (note) note.innerHTML = 'Opens <strong>5 Weight Match</strong> to review approximate weights. Use <strong>Finalize and Run</strong> here to generate CII.';
  if (root.querySelector('[data-xml-cii-finalize-run]')) return;
  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.className = 'model-converters-run-btn';
  runButton.dataset.xmlCiiFinalizeRun = 'true';
  runButton.style.cssText = 'width:100%;padding:12px;margin:0 0 8px 0;';
  runButton.textContent = '✓ Finalize and Run';
  runButton.addEventListener('click', () => {
    document.querySelector('#model-converters-run')?.click();
  });
  reviewButton.parentElement?.insertBefore(runButton, reviewButton);
}

function removeWeightMatchFinalize(root = document) {
  root.querySelectorAll?.('#mc-wm-finalize').forEach((button) => {
    const wrapper = button.closest('div');
    if (wrapper) wrapper.remove();
    else button.remove();
  });
}

function patchNpsBoreHighlight() {
  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.('button,a,[role="tab"],[data-tab],[data-tab-id]');
    if (!trigger || !/NPS\s*\/\s*Bore\s*Master/i.test(textOf(trigger))) return;
    setTimeout(() => {
      const parent = trigger.parentElement;
      parent?.querySelectorAll('button,a,[role="tab"],[data-tab],[data-tab-id]').forEach((candidate) => {
        if (candidate !== trigger) candidate.classList.remove('is-active', 'active', 'selected');
      });
      trigger.classList.add('is-active', 'active', 'selected');
      trigger.setAttribute('aria-selected', 'true');
    }, 0);
  }, true);
}

function preventOutsidePopupClose() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const knownOverlay = target.matches('.model-converters-workflow-popup-overlay, .mc-rigid-review-overlay');
    const inlineOverlay = target.style?.position === 'fixed' && (target.style?.inset === '0px' || target.style?.inset === '0');
    if (!knownOverlay && !inlineOverlay) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function injectCss() {
  if (document.getElementById('xml-cii-workflow-ui-fixes-css')) return;
  const style = document.createElement('style');
  style.id = 'xml-cii-workflow-ui-fixes-css';
  style.textContent = `
    .xml-cii-support-mapping-table thead th { color: #fff !important; }
    .model-converters-workflow-phase.is-active span,
    .model-converters-workflow-master-tab.is-active span { color: #fff !important; }
    .model-converters-workflow-popup-actions { display:flex; gap:8px; align-items:center; flex:0 0 auto; }
    .model-converters-workflow-popup.is-fullscreen { width:calc(100vw - 24px) !important; height:calc(100vh - 24px) !important; border-radius:6px !important; }
  `;
  document.head.appendChild(style);
}

function patch(root = document) {
  patchPhaseButtons(root);
  hideDuplicateTitles(root);
  patchRunPhase(root);
  removeWeightMatchFinalize(root);
  injectCss();
}

export function installXmlCiiWorkflowUiFixes() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  preventOutsidePopupClose();
  patchNpsBoreHighlight();
  patch(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node instanceof HTMLElement) patch(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
