function findSelectedBranchesInput(root) {
  return root?.querySelector?.('[data-option-key="selectedBranches"]') || null;
}

function findExistingSymbolInput(root) {
  return root?.querySelector?.('[data-option-key="showSymbols"]') || null;
}

function dispatchOptionEvents(input) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function mountSymbolOption(root, anchorInput) {
  if (!anchorInput || findExistingSymbolInput(root)) return;

  const host = anchorInput.closest('label, .model-converters-label') || anchorInput.parentElement;
  if (!host?.insertAdjacentElement) return;

  const label = document.createElement('label');
  label.dataset.inputxmlDxfSymbolOption = 'true';
  label.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;color:#d7e6ff;font-size:12px;';
  label.innerHTML = `
    <input type="checkbox" data-option-key="showSymbols" checked>
    <span>Show valve/flange/support symbols</span>
  `;

  host.insertAdjacentElement('afterend', label);
  const input = label.querySelector('[data-option-key="showSymbols"]');
  input?.addEventListener('change', () => dispatchOptionEvents(input));
}

function refresh(root) {
  const selectedBranchesInput = findSelectedBranchesInput(root);
  if (!selectedBranchesInput) return;
  mountSymbolOption(root, selectedBranchesInput);
}

export function installInputXmlDxfSymbolOption(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  refresh(root);
  if (typeof MutationObserver !== 'function') return () => {};
  const observer = new MutationObserver(() => refresh(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
