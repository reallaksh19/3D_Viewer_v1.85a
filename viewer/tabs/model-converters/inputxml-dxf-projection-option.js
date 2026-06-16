function findSelectedBranchesInput(root) {
  return root?.querySelector?.('[data-option-key="selectedBranches"]') || null;
}

function findExistingProjectionInput(root) {
  return root?.querySelector?.('[data-option-key="projectionMode"]') || null;
}

function dispatchOptionEvents(input) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertionAnchor(root, selectedBranchesInput) {
  return root?.querySelector?.('[data-option-key="showSymbols"]')?.closest('label, .model-converters-label')
    || selectedBranchesInput.closest('label, .model-converters-label')
    || selectedBranchesInput.parentElement;
}

function mountProjectionOption(root, selectedBranchesInput) {
  if (!selectedBranchesInput || findExistingProjectionInput(root)) return;

  const host = insertionAnchor(root, selectedBranchesInput);
  if (!host?.insertAdjacentElement) return;

  const label = document.createElement('label');
  label.dataset.inputxmlDxfProjectionOption = 'true';
  label.style.cssText = 'display:grid;gap:4px;margin-top:8px;color:#d7e6ff;font-size:12px;';
  label.innerHTML = `
    <span>DXF projection</span>
    <select data-option-key="projectionMode" style="background:#0f172a;color:#d7e6ff;border:1px solid #31436b;border-radius:6px;padding:6px;">
      <option value="iso-2.5d" selected>Isometric 2.5D / fitted drawing</option>
      <option value="top">Top / plan (X-Y)</option>
      <option value="elevation-xz">Elevation X-Z</option>
      <option value="elevation-yz">Elevation Y-Z</option>
      <option value="3d">3D model coordinates</option>
    </select>
  `;

  host.insertAdjacentElement('afterend', label);
  const input = label.querySelector('[data-option-key="projectionMode"]');
  input?.addEventListener('change', () => dispatchOptionEvents(input));
}

function refresh(root) {
  const selectedBranchesInput = findSelectedBranchesInput(root);
  if (!selectedBranchesInput) return;
  mountProjectionOption(root, selectedBranchesInput);
}

export function installInputXmlDxfProjectionOption(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  refresh(root);
  if (typeof MutationObserver !== 'function') return () => {};
  const observer = new MutationObserver(() => refresh(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
