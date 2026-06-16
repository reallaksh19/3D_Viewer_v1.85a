import { extractInputXmlBranches } from '../../converters/inputxml-dxf/InputXmlBranchExtractor.js';

function text(value) {
  return String(value ?? '').trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findSelectedBranchesInput(root) {
  return root?.querySelector?.('[data-option-key="selectedBranches"]') || null;
}

function findPrimaryXmlFile(root) {
  const inputs = [...(root?.querySelectorAll?.('input[type="file"]') || [])];
  const preferred = inputs.find((input) => {
    const accept = text(input.getAttribute('accept')).toLowerCase();
    const fileName = text(input.files?.[0]?.name).toLowerCase();
    return input.files?.[0] && (accept.includes('.xml') || fileName.endsWith('.xml'));
  });
  return preferred?.files?.[0] || null;
}

async function fileText(file) {
  if (!file) throw new Error('Select the Input XML file first.');
  if (typeof file.text === 'function') return file.text();
  throw new Error('This browser cannot read the selected XML file.');
}

function branchAliases(branch) {
  return [...new Set([
    branch?.id,
    branch?.pipelineRef,
    branch?.lineKey,
    branch?.lineNo,
    ...(branch?.aliases || []),
  ].map(text).filter(Boolean))];
}

function selectedSet(value) {
  return new Set(text(value).split(',').map((item) => item.trim()).filter(Boolean));
}

function branchChecked(branch, selected) {
  if (!selected.size) return true;
  return branchAliases(branch).some((alias) => selected.has(alias));
}

function branchSearchText(branch) {
  return [branch?.id, branch?.label, branch?.pipelineRef, branch?.lineKey, branch?.lineNo, ...(branch?.aliases || [])]
    .map(text)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function setSelectedBranches(input, ids) {
  input.value = ids.join(', ');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setOptionCheckbox(panel, key, checked) {
  const existing = panel.querySelector(`[data-option-key="${key}"]`);
  if (existing) {
    existing.checked = checked;
    return existing;
  }
  return null;
}

function renderExportOptions() {
  return `
    <fieldset style="border:1px solid rgba(120,140,170,.28);border-radius:8px;padding:8px 10px;margin:0;display:grid;gap:6px;">
      <legend style="padding:0 4px;color:#d7e6ff;font-weight:700;">Export text/options</legend>
      <label style="display:flex;gap:8px;align-items:center;color:#cbd5e1;font-size:12px;">
        <input type="checkbox" data-option-key="exportNodeLabels" checked>
        <span>Export node labels</span>
      </label>
      <label style="display:flex;gap:8px;align-items:center;color:#cbd5e1;font-size:12px;">
        <input type="checkbox" data-option-key="exportLengthText">
        <span>Export length / segment text</span>
      </label>
      <label style="display:flex;gap:8px;align-items:center;color:#cbd5e1;font-size:12px;">
        <input type="checkbox" data-option-key="showSupportLabels" checked>
        <span>Export restraint / support text</span>
      </label>
      <label style="display:flex;gap:8px;align-items:center;color:#cbd5e1;font-size:12px;">
        <input type="checkbox" data-option-key="showComponentLabels" checked>
        <span>Export fitting / component text</span>
      </label>
    </fieldset>
  `;
}

function renderBranchTree(branches, selectedValue, filterValue = '') {
  const selected = selectedSet(selectedValue);
  const filter = text(filterValue).toLowerCase();
  const visible = branches.filter((branch) => !filter || branchSearchText(branch).includes(filter));
  if (!visible.length) return '<div style="color:#9aa8ba;font-size:12px;padding:6px 0;">No branches match the current filter.</div>';

  return visible.map((branch) => {
    const aliases = branchAliases(branch);
    const checked = branchChecked(branch, selected);
    const branchId = text(branch.id);
    const title = text(branch.label || branch.id || 'Branch');
    const group = text(branch.lineNo || branch.lineKey || branch.pipelineRef || branch.id || 'UNASSIGNED');
    return `
      <details open data-inputxml-branch-tree-node data-search="${esc(branchSearchText(branch))}" style="border-bottom:1px solid rgba(120,140,170,.18);padding:5px 0;">
        <summary style="cursor:pointer;color:#d7e6ff;">
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" data-inputxml-dxf-branch-id="${esc(branchId)}" ${checked ? 'checked' : ''}>
            <strong>${esc(group)}</strong>
            <span style="color:#9aa8ba;">${esc(title)} · components=${Number(branch.componentCount || 0)}</span>
          </label>
        </summary>
        <div style="margin:5px 0 2px 30px;color:#8aa0ba;font-size:12px;line-height:1.35;">
          <div><b>id:</b> ${esc(branchId)}</div>
          ${branch.pipelineRef ? `<div><b>pipelineRef:</b> ${esc(branch.pipelineRef)}</div>` : ''}
          ${branch.lineKey ? `<div><b>lineKey:</b> ${esc(branch.lineKey)}</div>` : ''}
          ${branch.lineNo ? `<div><b>lineNo:</b> ${esc(branch.lineNo)}</div>` : ''}
          ${aliases.length ? `<div><b>aliases:</b> ${esc(aliases.join(' | '))}</div>` : ''}
        </div>
      </details>
    `;
  }).join('');
}

function checkedBranchIds(panel) {
  return [...panel.querySelectorAll('[data-inputxml-dxf-branch-id]:checked')]
    .map((checkbox) => text(checkbox.getAttribute('data-inputxml-dxf-branch-id')))
    .filter(Boolean);
}

function setAllVisible(panel, checked) {
  for (const checkbox of panel.querySelectorAll('[data-inputxml-dxf-branch-id]')) checkbox.checked = checked;
}

function invertVisible(panel) {
  for (const checkbox of panel.querySelectorAll('[data-inputxml-dxf-branch-id]')) checkbox.checked = !checkbox.checked;
}

function mountPicker(root, input) {
  if (!input || input.dataset.inputxmlDxfBranchPicker === 'mounted') return;
  input.dataset.inputxmlDxfBranchPicker = 'mounted';

  const panel = document.createElement('div');
  panel.dataset.inputxmlTreeSelectorPanel = 'true';
  panel.dataset.inputxmlDxfBranchPickerPanel = 'true';
  panel.style.cssText = 'margin-top:8px;padding:10px;border:1px solid #31455f;border-radius:8px;background:#111b29;display:flex;flex-direction:column;gap:8px;';
  panel.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button type="button" class="model-converters-download-btn" data-inputxml-dxf-list-branches>Read XML branch tree</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-dxf-use-checked disabled>Use checked branches</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-tree-select-all disabled>Select all</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-tree-clear disabled>Clear</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-tree-invert disabled>Invert</button>
    </div>
    <input type="search" data-inputxml-tree-filter placeholder="Filter branch id / line key / alias" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;border:1px solid #31455f;background:#0b1220;color:#d7e6ff;">
    <small style="color:#9aa8ba;">Branch-level multi-select. Empty selectedBranches means export all branches. Check branches, then click “Use checked branches”.</small>
    ${renderExportOptions()}
    <div data-inputxml-dxf-branch-status style="color:#9aa8ba;font-size:12px;"></div>
    <div data-inputxml-dxf-branch-list style="max-height:320px;overflow:auto;border-top:1px solid rgba(120,140,170,.18);"></div>
  `;

  const host = input.closest('label, .model-converters-label') || input.parentElement;
  host?.insertAdjacentElement?.('afterend', panel);

  const status = panel.querySelector('[data-inputxml-dxf-branch-status]');
  const list = panel.querySelector('[data-inputxml-dxf-branch-list]');
  const filter = panel.querySelector('[data-inputxml-tree-filter]');
  const useChecked = panel.querySelector('[data-inputxml-dxf-use-checked]');
  const selectAll = panel.querySelector('[data-inputxml-tree-select-all]');
  const clear = panel.querySelector('[data-inputxml-tree-clear]');
  const invert = panel.querySelector('[data-inputxml-tree-invert]');
  let branches = [];

  const setControlsEnabled = (enabled) => {
    useChecked.disabled = !enabled;
    selectAll.disabled = !enabled;
    clear.disabled = !enabled;
    invert.disabled = !enabled;
  };

  const rerender = () => {
    list.innerHTML = renderBranchTree(branches, input.value, filter.value);
  };

  panel.querySelector('[data-inputxml-dxf-list-branches]')?.addEventListener('click', async () => {
    try {
      status.textContent = 'Reading selected Input XML…';
      list.innerHTML = '';
      const xmlText = await fileText(findPrimaryXmlFile(root));
      const extraction = extractInputXmlBranches(xmlText, { sourceId: 'inputxml-tree-selector' });
      branches = Array.isArray(extraction.branches) ? extraction.branches : [];
      if (!extraction.ok || !branches.length) {
        status.textContent = 'No branches found in selected Input XML.';
        setControlsEnabled(false);
        return;
      }
      rerender();
      status.textContent = `Found ${branches.length} branch(es).`;
      setControlsEnabled(true);
    } catch (error) {
      status.textContent = error?.message || String(error);
      setControlsEnabled(false);
    }
  });

  filter?.addEventListener('input', rerender);

  useChecked?.addEventListener('click', () => {
    const ids = checkedBranchIds(panel);
    setSelectedBranches(input, ids);
    status.textContent = ids.length ? `Selected ${ids.length} branch id(s).` : 'No branches checked; selectedBranches cleared to export all.';
  });

  selectAll?.addEventListener('click', () => {
    setAllVisible(panel, true);
    status.textContent = 'All visible branches checked.';
  });

  clear?.addEventListener('click', () => {
    setAllVisible(panel, false);
    status.textContent = 'Visible branches cleared. Click “Use checked branches” to apply.';
  });

  invert?.addEventListener('click', () => {
    invertVisible(panel);
    status.textContent = 'Visible branch selection inverted. Click “Use checked branches” to apply.';
  });

  setOptionCheckbox(panel, 'exportNodeLabels', true);
  setOptionCheckbox(panel, 'showSupportLabels', true);
  setOptionCheckbox(panel, 'showComponentLabels', true);
}

function refresh(root) {
  const input = findSelectedBranchesInput(root);
  if (!input) return;
  mountPicker(root, input);
}

export function installInputXmlDxfBranchPicker(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  refresh(root);
  if (typeof MutationObserver !== 'function') return () => {};
  const observer = new MutationObserver(() => refresh(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
