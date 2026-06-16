const STORAGE_KEY = 'psnm.anchorSelection.v1';

function text(value) { return String(value ?? '').trim(); }
function html(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
function writeSaved(snapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, version: 1, savedAt: new Date().toISOString() }));
  } catch {}
}
function setupPanel(modal) { return modal?.querySelector?.('[data-psnm-panel="setup"]'); }
function setupCard(modal) { return setupPanel(modal)?.querySelector?.('.psnm-card'); }
function firstSetupBanner(modal) { return setupCard(modal)?.querySelector?.('.psnm-card-body > .psnm-banner'); }
function optionText(select) { return text(select?.selectedOptions?.[0]?.textContent || ''); }
function nodeFromOptionText(value) {
  const src = text(value);
  const match = src.match(/^([^\s(]+)/);
  return match ? match[1] : src;
}
function findPsOption(select, saved = {}) {
  const options = Array.from(select?.options || []);
  if (!options.length) return null;
  const byValue = options.find((option) => text(option.value) && text(option.value) === text(saved.psRowId));
  if (byValue) return byValue;
  const psName = text(saved.psName).toLowerCase();
  if (!psName) return null;
  return options.find((option) => text(option.textContent).toLowerCase() === psName)
    || options.find((option) => text(option.textContent).toLowerCase().startsWith(psName));
}
function findNodeOption(select, saved = {}) {
  const options = Array.from(select?.options || []);
  if (!options.length) return null;
  const byValue = options.find((option) => text(option.value) && text(option.value) === text(saved.nodeRowId));
  if (byValue) return byValue;
  const node = text(saved.node).toLowerCase();
  if (!node) return null;
  return options.find((option) => nodeFromOptionText(option.textContent).toLowerCase() === node)
    || options.find((option) => text(option.textContent).toLowerCase().startsWith(node));
}
function selectedSnapshot(modal) {
  const psSelect = modal?.querySelector?.('[data-setup="anchorPsRowId"]');
  const nodeSelect = modal?.querySelector?.('[data-setup="anchorNodeRowId"]');
  if (!psSelect || !nodeSelect || !psSelect.value || !nodeSelect.value) return null;
  const psName = optionText(psSelect);
  const nodeText = optionText(nodeSelect);
  const node = nodeFromOptionText(nodeText);
  const axisTransform = window.__PSNM_AXIS_TRANSFORM;
  const axisMatches = axisTransform?.axisMode
    && (!axisTransform.anchorPsName || text(axisTransform.anchorPsName) === psName)
    && (!axisTransform.anchorNode || text(axisTransform.anchorNode) === node);
  return {
    psRowId: psSelect.value,
    nodeRowId: nodeSelect.value,
    psName,
    node,
    nodeLabel: nodeText,
    axisTransform: axisMatches ? axisTransform : null,
  };
}
function saveCurrent(modal) {
  const snapshot = selectedSnapshot(modal);
  if (!snapshot) return;
  writeSaved(snapshot);
}
function renderAnchorStatus(modal) {
  const banner = firstSetupBanner(modal);
  if (!banner) return;
  const snapshot = selectedSnapshot(modal);
  if (!snapshot) {
    banner.innerHTML = '<b>Anchor PS and Anchor Node are fetched from Master Tables only.</b>';
    return;
  }
  const axis = snapshot.axisTransform?.axisFormula ? ` <span class="psnm-sub">${html(snapshot.axisTransform.axisFormula)}</span>` : '';
  banner.innerHTML = `<b>Selected anchor pair from Master Tables:</b> ${html(snapshot.psName)} ⇄ Node ${html(snapshot.node)}.${axis}`;
}
function restoreIntoModal(modal, { dispatch = true } = {}) {
  const saved = readSaved();
  if (!modal || !saved) { renderAnchorStatus(modal); return false; }
  const psSelect = modal.querySelector('[data-setup="anchorPsRowId"]');
  const nodeSelect = modal.querySelector('[data-setup="anchorNodeRowId"]');
  const psOption = findPsOption(psSelect, saved);
  const nodeOption = findNodeOption(nodeSelect, saved);
  let changed = false;
  if (psSelect && psOption && psSelect.value !== psOption.value) {
    psSelect.value = psOption.value;
    changed = true;
  }
  if (nodeSelect && nodeOption && nodeSelect.value !== nodeOption.value) {
    nodeSelect.value = nodeOption.value;
    changed = true;
  }
  if (saved.axisTransform?.axisMode && psOption && nodeOption) {
    window.__PSNM_AXIS_TRANSFORM = saved.axisTransform;
  }
  if (changed && dispatch) {
    psSelect?.dispatchEvent(new Event('input', { bubbles: true }));
    nodeSelect?.dispatchEvent(new Event('input', { bubbles: true }));
  }
  renderAnchorStatus(modal);
  return changed;
}
function schedule(container, delay = 0) {
  window.setTimeout(() => {
    const modal = container.querySelector('[data-psnm="modal"]');
    if (modal) restoreIntoModal(modal);
  }, delay);
}

export function installPsnmAnchorPersistenceAddon(container, ctx = {}) {
  function onClick(event) {
    const action = event.target?.closest?.('[data-psnm-action]')?.dataset?.psnmAction;
    const tab = event.target?.closest?.('[data-psnm-tab]')?.dataset?.psnmTab;
    if (action === 'open' || action === 'resolveMasters' || action === 'useAutoAnchor' || tab === 'setup') {
      schedule(container, 0);
      schedule(container, 80);
    }
  }
  function onInput(event) {
    const setup = event.target?.closest?.('[data-setup]');
    if (!setup) return;
    const key = setup.dataset.setup;
    if (key !== 'anchorPsRowId' && key !== 'anchorNodeRowId') return;
    const modal = container.querySelector('[data-psnm="modal"]');
    if (!modal) return;
    saveCurrent(modal);
    renderAnchorStatus(modal);
  }
  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onInput);
  schedule(container, 0);
  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('input', onInput);
    container.removeEventListener('change', onInput);
  };
}
