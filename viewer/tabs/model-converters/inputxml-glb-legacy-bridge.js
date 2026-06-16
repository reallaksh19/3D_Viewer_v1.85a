import { run as runInputXmlToGlb } from './converters/inputxml-to-glb.js';
import { downloadOutput } from './core/output-utils.js';

const CONVERTER_ID = 'inputxml_to_glb';
const CONVERTER_LABEL = 'InputXML→GLB Rich 3D Model';

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

function appendConverterOption(root) {
  const select = root?.querySelector?.('#model-converters-select');
  if (!select || select.querySelector(`option[value="${CONVERTER_ID}"]`)) return select;
  const option = document.createElement('option');
  option.value = CONVERTER_ID;
  option.textContent = CONVERTER_LABEL;
  const anchor = select.querySelector('option[value="inputxml_to_dxf"]') ||
    select.querySelector('option[value="inputxml_to_cii2019"]');
  if (anchor?.nextSibling) select.insertBefore(option, anchor.nextSibling);
  else if (anchor) anchor.insertAdjacentElement('afterend', option);
  else select.appendChild(option);
  return select;
}

function setStatus(root, message, tone = '') {
  const status = root.querySelector('#model-converters-status');
  if (!status) return;
  status.textContent = message;
  status.className = `model-converters-status ${tone}`.trim();
}

function setLogs(root, lines) {
  const logs = root.querySelector('#model-converters-logs');
  if (!logs) return;
  const normalized = Array.isArray(lines) ? lines.map(text).filter(Boolean) : [];
  logs.textContent = normalized.length ? normalized.join('\n') : '(no logs)';
}

function resetOutput(root) {
  const output = root.querySelector('#model-converters-output');
  if (output) output.innerHTML = '<span class="model-converters-muted">No output generated yet.</span>';
  const diag = root.querySelector('#model-converters-diagnostics-table');
  if (diag) {
    diag.style.display = 'none';
    diag.innerHTML = '';
  }
  const previewMeta = root.querySelector('#model-converters-preview-meta');
  if (previewMeta) previewMeta.textContent = 'GLB output is download-only here; open it in the GLB viewer tab for rich 3D review.';
  setLogs(root, []);
}

function renderOutputs(root, outputs) {
  const output = root.querySelector('#model-converters-output');
  if (!output) return;
  const normalized = Array.isArray(outputs) ? outputs.filter((entry) => entry?.name) : [];
  if (!normalized.length) {
    output.innerHTML = '<span class="model-converters-muted">No output generated.</span>';
    return;
  }
  output.innerHTML = normalized.map((entry, index) => `
    <div class="model-converters-output-row">
      <strong>${esc(entry.name)}</strong>
      <button type="button" class="model-converters-download-btn" data-inputxml-glb-output="${index}">Download</button>
    </div>
  `).join('');
  for (const button of output.querySelectorAll('[data-inputxml-glb-output]')) {
    const idx = Number(button.getAttribute('data-inputxml-glb-output'));
    button.addEventListener('click', () => {
      const selected = normalized[idx];
      if (selected) downloadOutput(selected);
    });
  }
}

function renderAdvancedFields(root) {
  const fields = root.querySelector('#model-converters-advanced-fields');
  if (!fields) return;
  fields.innerHTML = `
    <label class="model-converters-label">
      <span>Branches to include (comma-separated; empty = all)</span>
      <input type="text" data-option-key="selectedBranches" value="">
    </label>
    <label style="display:flex;align-items:center;gap:8px;color:#d7e6ff;font-size:12px;">
      <input type="checkbox" data-option-key="includeSidecarJson" checked>
      <span>Export sidecar JSON</span>
    </label>
  `;
}

function renderInputXmlGlbMode(root) {
  const primaryLabel = root.querySelector('#model-converters-primary-label');
  const primaryInput = root.querySelector('#model-converters-primary-input');
  const primaryName = root.querySelector('#model-converters-primary-name');
  const secondaryWrap = root.querySelector('#model-converters-secondary-wrap');
  const xmlWorkflow = root.querySelector('#model-converters-xml-cii-workflow');
  const supportMapper = root.querySelector('#model-converters-support-mapper');

  if (primaryLabel) primaryLabel.textContent = 'Input XML (CAESAR II) (.xml,.XML)';
  if (primaryInput) primaryInput.setAttribute('accept', '.xml,.XML');
  if (primaryName && !primaryInput?.files?.[0]) primaryName.textContent = 'No file selected.';
  if (secondaryWrap) secondaryWrap.style.display = 'none';
  if (xmlWorkflow) {
    xmlWorkflow.hidden = true;
    xmlWorkflow.open = false;
  }
  if (supportMapper) {
    supportMapper.hidden = true;
    supportMapper.open = false;
  }

  renderAdvancedFields(root);
  setStatus(root, 'Build a rich 3D GLB pipe model from CAESAR II Input XML using the existing GLB pipeline.', '');
  resetOutput(root);
}

function readOptions(root) {
  const options = {};
  for (const input of root.querySelectorAll('[data-option-key]')) {
    const key = input.getAttribute('data-option-key');
    if (!key) continue;
    if (input.type === 'checkbox') options[key] = input.checked;
    else if (input.type === 'number') options[key] = Number(input.value);
    else options[key] = input.value;
  }
  return options;
}

function selectedPrimaryFile(root) {
  return root.querySelector('#model-converters-primary-input')?.files?.[0] || null;
}

async function runInputXmlGlb(root) {
  const file = selectedPrimaryFile(root);
  if (!file) {
    const msg = 'Select a primary Input XML file first.';
    setStatus(root, `Failed: ${msg}`, 'bad');
    setLogs(root, [msg]);
    renderOutputs(root, []);
    return;
  }

  const runButton = root.querySelector('#model-converters-run');
  try {
    if (runButton) runButton.disabled = true;
    setStatus(root, 'Running InputXML→GLB converter...', 'running');
    setLogs(root, []);
    renderOutputs(root, []);
    const response = await runInputXmlToGlb({
      converterId: CONVERTER_ID,
      inputFiles: [{ role: 'primary', name: file.name, file }],
      options: readOptions(root),
      setStatus: (msg, tone) => setStatus(root, msg, tone),
    });
    const logs = []
      .concat(response?.logs?.stdout || [])
      .concat(response?.logs?.stderr || []);
    setLogs(root, logs);
    renderOutputs(root, response?.outputs || []);
    if (!response?.ok) throw new Error(logs.join('\n') || 'InputXML→GLB conversion failed.');
    setStatus(root, `Completed: ${response.outputs?.[0]?.name || 'GLB output'}`, 'ok');
  } catch (error) {
    const message = error?.message || String(error);
    setStatus(root, `Failed: ${message}`, 'bad');
    setLogs(root, [message]);
  } finally {
    if (runButton) runButton.disabled = false;
  }
}

export function installInputXmlGlbLegacyBridge(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  const select = appendConverterOption(root);
  const runButton = root.querySelector('#model-converters-run');
  if (!select || !runButton || root.dataset.inputxmlGlbLegacyBridge === 'mounted') return () => {};
  root.dataset.inputxmlGlbLegacyBridge = 'mounted';

  const onSelectChange = (event) => {
    if (select.value !== CONVERTER_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderInputXmlGlbMode(root);
  };

  const onRun = (event) => {
    if (select.value !== CONVERTER_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runInputXmlGlb(root);
  };

  select.addEventListener('change', onSelectChange, true);
  runButton.addEventListener('click', onRun, true);
  if (select.value === CONVERTER_ID) renderInputXmlGlbMode(root);

  return () => {
    select.removeEventListener('change', onSelectChange, true);
    runButton.removeEventListener('click', onRun, true);
  };
}
