/**
 * pcfx-converter-tab.js
 * Dedicated UI for three-way conversion between PCF, PCFX, and GLB with persistent defaults.
 * Inputs are user-selected files and sticky default values. Outputs are downloadable files and GLB previews.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLogger } from '../js/pcf2glb/debug/logger.js';
import { exportSceneToGLB } from '../js/pcf2glb/glb/exportSceneToGLB.js';
import { createPcfxDocument, parsePcfxText, stringifyPcfxDocument } from '../pcfx/Pcfx_Core.js';
import { downloadBlob, downloadPcfxDocument, downloadText, readArrayBufferFile, readTextFile } from '../pcfx/Pcfx_FileIO.js';
import { pcfxDocumentFromPcfText, pcfTextFromCanonicalItems } from '../pcfx/Pcfx_PcfAdapter.js';
import { buildGlbSceneFromCanonicalItems, loadGlbSceneFromBlob, pcfxDocumentFromGlbScene } from '../pcfx/Pcfx_GlbAdapter.js';
import { saveStickyState, state } from '../core/state.js';

const ACCEPT_BY_SOURCE = {
  PCF: '.pcf',
  PCFX: '.pcfx,.json',
  GLB: '.glb',
};

const PALETTES = [
  0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0xe9c46a,
  0x8d99ae, 0xd62828, 0x3a86ff, 0x8338ec, 0xff006e,
  0x588157, 0x6d597a, 0x1d3557, 0xc1121f, 0x7f5539,
];

function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function buildOutputFileName(sourceFileName, extension) {
  const rawName = toText(sourceFileName || 'converter-output');
  const baseName = rawName.replace(/\.[^/.]+$/, '') || 'converter-output';
  return `${baseName}${extension}`;
}

function getCurrentDefaults() {
  return state.sticky && state.sticky.pcfxDefaults ? state.sticky.pcfxDefaults : {};
}

function createPreviewController(elements) {
  const viewport = elements.viewport;
  const colorSelect = elements.colorSelect;
  const legend = elements.legend;
  const legendContent = elements.legendContent;
  const fitButton = elements.fitButton;
  const isoButton = elements.isoButton;
  const topButton = elements.topButton;
  const frontButton = elements.frontButton;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151a22);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(100, 150, 80);
  scene.add(ambientLight);
  scene.add(directionalLight);

  const axesHelper = new THREE.AxesHelper(100);
  scene.add(axesHelper);

  viewport.appendChild(renderer.domElement);

  let loadedObject = null;
  let frameHandle = 0;
  let currentCenter = new THREE.Vector3(0, 0, 0);
  let currentDistance = 1000;
  const originalMaterials = new Map();

  function resize() {
    const width = Math.max(viewport.clientWidth, 1);
    const height = Math.max(viewport.clientHeight, 1);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function clearLegend() {
    legend.style.display = 'none';
    legendContent.innerHTML = '';
  }

  function restoreMaterials() {
    if (!loadedObject) return;
    loadedObject.traverse((child) => {
      if (child.isMesh && originalMaterials.has(child.uuid)) {
        child.material = originalMaterials.get(child.uuid);
      }
    });
    clearLegend();
  }

  function fitAll() {
    if (!loadedObject) return;
    const box = new THREE.Box3().setFromObject(loadedObject);
    if (box.isEmpty()) return;

    currentCenter = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    currentDistance = maxDim * 2.2;

    axesHelper.position.copy(currentCenter);
    axesHelper.scale.setScalar(Math.max(maxDim / 4, 1));

    camera.position.copy(currentCenter).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(currentDistance));
    camera.up.set(0, 1, 0);
    camera.lookAt(currentCenter);
    controls.target.copy(currentCenter);
    controls.maxDistance = currentDistance * 10;
    controls.update();
  }

  function setView(direction, upVector) {
    if (!loadedObject) return;
    camera.position.copy(currentCenter).add(direction.clone().normalize().multiplyScalar(currentDistance));
    camera.up.copy(upVector);
    camera.lookAt(currentCenter);
    controls.target.copy(currentCenter);
    controls.update();
  }

  function buildColorOptions() {
    const keys = new Set();

    if (!loadedObject) {
      colorSelect.innerHTML = '<option value="default">Default</option>';
      colorSelect.disabled = true;
      return;
    }

    loadedObject.traverse((child) => {
      if (!child.isMesh || !child.userData) return;
      Object.keys(child.userData).forEach((key) => {
        if (key === 'pcfId' || key === 'pcfType' || key === 'pcfxDocument') return;
        keys.add(key);
      });
    });

    const options = ['<option value="default">Default</option>'];
    Array.from(keys).sort().forEach((key) => options.push(`<option value="${key}">${key}</option>`));
    colorSelect.innerHTML = options.join('');
    colorSelect.disabled = keys.size === 0;
  }

  function applyHeatmap(property) {
    if (!loadedObject) return;

    if (property === 'default') {
      restoreMaterials();
      return;
    }

    const values = new Set();
    loadedObject.traverse((child) => {
      if (child.isMesh && child.userData && child.userData[property] !== undefined) {
        values.add(String(child.userData[property]));
      }
    });

    const sortedValues = Array.from(values).sort();
    const colorMap = new Map();
    sortedValues.forEach((value, index) => {
      colorMap.set(value, PALETTES[index % PALETTES.length]);
    });

    loadedObject.traverse((child) => {
      if (!child.isMesh) return;
      if (!originalMaterials.has(child.uuid)) originalMaterials.set(child.uuid, child.material);
      const value = child.userData && child.userData[property] !== undefined ? String(child.userData[property]) : null;
      if (!value || !colorMap.has(value)) {
        child.material = new THREE.MeshStandardMaterial({ color: 0x8b8f98, transparent: true, opacity: 0.3 });
        return;
      }
      child.material = new THREE.MeshStandardMaterial({ color: colorMap.get(value) });
    });

    legendContent.innerHTML = sortedValues.map((value) => {
      const colorHex = `#${colorMap.get(value).toString(16).padStart(6, '0')}`;
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="width:12px;height:12px;border-radius:3px;background:${colorHex};display:inline-block;"></span>
          <span>${value}</span>
        </div>
      `;
    }).join('');
    legend.style.display = sortedValues.length > 0 ? 'block' : 'none';
  }

  async function loadBlob(blob) {
    const loadedScene = await loadGlbSceneFromBlob(blob);

    if (loadedObject) scene.remove(loadedObject);
    loadedObject = loadedScene;
    scene.add(loadedObject);
    originalMaterials.clear();
    clearLegend();
    buildColorOptions();
    fitAll();
  }

  function clear() {
    if (loadedObject) scene.remove(loadedObject);
    loadedObject = null;
    colorSelect.innerHTML = '<option value="default">Default</option>';
    colorSelect.disabled = true;
    originalMaterials.clear();
    clearLegend();
  }

  function tick() {
    frameHandle = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();

  colorSelect.addEventListener('change', (event) => applyHeatmap(event.target.value));
  fitButton.addEventListener('click', fitAll);
  isoButton.addEventListener('click', () => setView(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0)));
  topButton.addEventListener('click', () => setView(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)));
  frontButton.addEventListener('click', () => setView(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)));

  return {
    clear,
    loadBlob,
    resize,
    destroy: () => {
      cancelAnimationFrame(frameHandle);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      viewport.innerHTML = '';
    },
  };
}

function renderSettingsTab(panel) {
  const defaults = getCurrentDefaults();
  const groups = [
    {
      title: 'Producer',
      fields: [
        { key: 'producerApp', label: 'Producer App', type: 'text' },
        { key: 'producerVersion', label: 'Producer Version', type: 'text' },
      ],
    },
    {
      title: 'Metadata',
      fields: [
        { key: 'metadataProject', label: 'Project', type: 'text' },
        { key: 'metadataFacility', label: 'Facility', type: 'text' },
        { key: 'metadataDocumentNo', label: 'Document No', type: 'text' },
        { key: 'metadataRevision', label: 'Revision', type: 'text' },
        { key: 'metadataCode', label: 'Code', type: 'text' },
        { key: 'metadataUnitsBore', label: 'Units Bore', type: 'text' },
        { key: 'metadataUnitsCoords', label: 'Units Coords', type: 'text' },
      ],
    },
    {
      title: 'Conversion Defaults',
      fields: [
        { key: 'defaultPipelineRef', label: 'Default Pipeline Ref', type: 'text' },
        { key: 'defaultLineNoKey', label: 'Default Line Key', type: 'text' },
        { key: 'defaultMaterial', label: 'Default Material', type: 'text' },
        { key: 'defaultPipingClass', label: 'Default Piping Class', type: 'text' },
        { key: 'defaultRating', label: 'Default Rating', type: 'text' },
        { key: 'refPrefix', label: 'Generated Ref Prefix', type: 'text' },
        { key: 'seqStart', label: 'Generated Seq Start', type: 'number' },
        { key: 'seqStep', label: 'Generated Seq Step', type: 'number' },
      ],
    },
    {
      title: 'Support Defaults',
      fields: [
        { key: 'supportKind', label: 'Support Kind', type: 'text' },
        { key: 'supportName', label: 'Support Name', type: 'text' },
        { key: 'supportDescription', label: 'Support Description', type: 'text' },
        { key: 'supportFriction', label: 'Support Friction', type: 'number' },
        { key: 'supportGap', label: 'Support Gap', type: 'text' },
      ],
    },
  ];

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;padding:20px;">
      ${groups.map((group) => `
        <section style="background:#ffffff;border:1px solid #d6deea;border-radius:16px;padding:18px;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
          <h3 style="margin:0 0 14px 0;color:#16324f;font-size:18px;">${group.title}</h3>
          <div style="display:grid;gap:12px;">
            ${group.fields.map((field) => `
              <label style="display:grid;gap:6px;font-size:12px;color:#4f6478;">
                <span>${field.label}</span>
                <input
                  data-pcfx-default="${field.key}"
                  type="${field.type}"
                  value="${toText(defaults[field.key])}"
                  style="border:1px solid #c6d3e1;border-radius:10px;padding:10px 12px;font-size:14px;color:#16324f;background:#f8fbff;"
                >
              </label>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;

  panel.querySelectorAll('[data-pcfx-default]').forEach((input) => {
    const key = input.getAttribute('data-pcfx-default');
    const writeValue = () => {
      if (!state.sticky.pcfxDefaults) state.sticky.pcfxDefaults = {};
      state.sticky.pcfxDefaults[key] = input.type === 'number' ? Number(input.value) : input.value;
      saveStickyState();
    };
    input.addEventListener('input', writeValue);
    input.addEventListener('change', writeValue);
  });
}

/**
 * Render the converter tab. This UI is isolated from the existing viewer tabs.
 * @param {HTMLElement} container
 * @returns {() => void}
 */
export function renderPcfxConverterTab(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 110px);background:linear-gradient(180deg,#eef4fb 0%,#f7fafc 100%);">
      <div style="display:flex;gap:10px;padding:14px 18px 0 18px;">
        <button data-pcfx-subtab="convert" class="pcfx-subtab active" style="border:none;border-radius:12px 12px 0 0;padding:12px 18px;background:#16324f;color:#fff;font-weight:700;cursor:pointer;">Convert</button>
        <button data-pcfx-subtab="settings" class="pcfx-subtab" style="border:none;border-radius:12px 12px 0 0;padding:12px 18px;background:#cfdceb;color:#16324f;font-weight:700;cursor:pointer;">Settings</button>
      </div>

      <section data-pcfx-panel="convert" style="display:flex;flex:1;min-height:0;border-top:1px solid #d6deea;">
        <aside style="width:350px;display:flex;flex-direction:column;background:#f7fbff;border-right:1px solid #d6deea;padding:20px;gap:16px;">
          <div>
            <h2 style="margin:0;color:#16324f;font-size:28px;">PCF / PCFX / GLB Converter</h2>
            <p style="margin:10px 0 0 0;color:#5a7187;line-height:1.5;">Three-way converter for PCF, canonical PCFX, and app-generated GLB round-trips. Legacy GLBs are imported as best-effort with diagnostics.</p>
          </div>

          <div style="display:grid;gap:12px;">
            <label style="display:grid;gap:6px;font-size:12px;color:#4f6478;">
              <span>Source Format</span>
              <select id="pcfx-source-select" style="border:1px solid #c6d3e1;border-radius:10px;padding:10px 12px;font-size:14px;color:#16324f;background:#fff;">
                <option value="PCF">PCF</option>
                <option value="PCFX">PCFX</option>
                <option value="GLB">GLB</option>
              </select>
            </label>
            <label style="display:grid;gap:6px;font-size:12px;color:#4f6478;">
              <span>Target Format</span>
              <select id="pcfx-target-select" style="border:1px solid #c6d3e1;border-radius:10px;padding:10px 12px;font-size:14px;color:#16324f;background:#fff;">
                <option value="PCFX">PCFX</option>
                <option value="PCF">PCF</option>
                <option value="GLB">GLB</option>
              </select>
            </label>
            <label style="display:grid;gap:6px;font-size:12px;color:#4f6478;">
              <span>Input File</span>
              <input id="pcfx-file-input" type="file" accept=".pcf" style="border:1px solid #c6d3e1;border-radius:10px;padding:10px 12px;font-size:14px;color:#16324f;background:#fff;">
            </label>
          </div>

          <div style="display:flex;gap:10px;">
            <button id="pcfx-run" style="flex:1;border:none;border-radius:12px;padding:12px 14px;background:#1f6feb;color:#fff;font-weight:700;cursor:pointer;">Convert</button>
            <button id="pcfx-download" style="flex:1;border:none;border-radius:12px;padding:12px 14px;background:#16324f;color:#fff;font-weight:700;cursor:pointer;" disabled>Download</button>
          </div>

          <div style="background:#ffffff;border:1px solid #d6deea;border-radius:14px;padding:14px;">
            <div style="font-size:12px;color:#6b7f93;text-transform:uppercase;letter-spacing:0.08em;">Status</div>
            <div id="pcfx-status" style="margin-top:8px;color:#16324f;font-weight:700;">Waiting for input.</div>
            <div id="pcfx-summary" style="margin-top:8px;color:#5a7187;font-size:13px;line-height:1.5;">Source and target conversion details will appear here.</div>
          </div>

          <div style="display:flex;flex-direction:column;flex:1;min-height:0;background:#ffffff;border:1px solid #d6deea;border-radius:14px;padding:14px;">
            <div style="font-size:12px;color:#6b7f93;text-transform:uppercase;letter-spacing:0.08em;">Diagnostics</div>
            <div id="pcfx-logs" style="margin-top:10px;flex:1;overflow:auto;background:#0f1724;color:#d7e2ee;border-radius:12px;padding:12px;font:12px/1.45 Consolas, monospace;"></div>
          </div>
        </aside>

        <main style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#16324f;color:#fff;border-bottom:1px solid rgba(255,255,255,0.12);">
            <div>
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a8c4df;">Output</div>
              <div id="pcfx-output-title" style="font-size:20px;font-weight:700;">Ready</div>
            </div>
            <div id="pcfx-preview-toolbar" style="display:flex;align-items:center;gap:8px;">
              <label style="font-size:12px;color:#c7d8ea;">Color By</label>
              <select id="pcfx-color-select" style="border:none;border-radius:8px;padding:8px 10px;background:#edf4fb;color:#16324f;" disabled>
                <option value="default">Default</option>
              </select>
              <button id="pcfx-view-iso" style="border:none;border-radius:8px;padding:8px 10px;background:#21486c;color:#fff;cursor:pointer;">ISO</button>
              <button id="pcfx-view-top" style="border:none;border-radius:8px;padding:8px 10px;background:#21486c;color:#fff;cursor:pointer;">TOP</button>
              <button id="pcfx-view-front" style="border:none;border-radius:8px;padding:8px 10px;background:#21486c;color:#fff;cursor:pointer;">FRONT</button>
              <button id="pcfx-fit" style="border:none;border-radius:8px;padding:8px 10px;background:#21486c;color:#fff;cursor:pointer;">FIT</button>
            </div>
          </div>

          <div style="position:relative;flex:1;min-height:0;">
            <div id="pcfx-preview-shell" style="position:absolute;inset:0;background:#111722;">
              <div id="pcfx-preview-viewport" style="position:absolute;inset:0;"></div>
              <div id="pcfx-preview-legend" style="display:none;position:absolute;left:18px;bottom:18px;min-width:180px;max-height:220px;overflow:auto;background:rgba(15,23,36,0.88);color:#fff;border-radius:12px;padding:12px;">
                <div style="font-weight:700;margin-bottom:8px;">Legend</div>
                <div id="pcfx-preview-legend-content"></div>
              </div>
            </div>

            <div id="pcfx-text-shell" style="display:none;position:absolute;inset:0;padding:20px;background:#ffffff;">
              <pre id="pcfx-text-output" style="margin:0;width:100%;height:100%;overflow:auto;background:#0f1724;color:#d7e2ee;border-radius:16px;padding:18px;font:13px/1.5 Consolas, monospace;"></pre>
            </div>
          </div>
        </main>
      </section>

      <section data-pcfx-panel="settings" style="display:none;flex:1;min-height:0;border-top:1px solid #d6deea;background:#f7fafc;"></section>
    </div>
  `;

  const convertPanel = container.querySelector('[data-pcfx-panel="convert"]');
  const settingsPanel = container.querySelector('[data-pcfx-panel="settings"]');
  const subtabButtons = Array.from(container.querySelectorAll('[data-pcfx-subtab]'));
  const sourceSelect = container.querySelector('#pcfx-source-select');
  const targetSelect = container.querySelector('#pcfx-target-select');
  const fileInput = container.querySelector('#pcfx-file-input');
  const runButton = container.querySelector('#pcfx-run');
  const downloadButton = container.querySelector('#pcfx-download');
  const statusEl = container.querySelector('#pcfx-status');
  const summaryEl = container.querySelector('#pcfx-summary');
  const logsEl = container.querySelector('#pcfx-logs');
  const outputTitle = container.querySelector('#pcfx-output-title');
  const previewShell = container.querySelector('#pcfx-preview-shell');
  const textShell = container.querySelector('#pcfx-text-shell');
  const textOutput = container.querySelector('#pcfx-text-output');
  const previewToolbar = container.querySelector('#pcfx-preview-toolbar');

  const preview = createPreviewController({
    viewport: container.querySelector('#pcfx-preview-viewport'),
    colorSelect: container.querySelector('#pcfx-color-select'),
    legend: container.querySelector('#pcfx-preview-legend'),
    legendContent: container.querySelector('#pcfx-preview-legend-content'),
    isoButton: container.querySelector('#pcfx-view-iso'),
    topButton: container.querySelector('#pcfx-view-top'),
    frontButton: container.querySelector('#pcfx-view-front'),
    fitButton: container.querySelector('#pcfx-fit'),
  });

  const logger = createLogger();
  let selectedFile = null;
  let currentDownload = null;

  function setStatus(message, summary) {
    statusEl.textContent = message;
    summaryEl.textContent = summary;
  }

  function clearLogs() {
    logsEl.innerHTML = '';
    logger.clear();
  }

  function appendLog(entry) {
    const color = entry.level === 'ERROR' ? '#ff8f8f' : entry.level === 'WARN' ? '#ffd479' : '#93d1ff';
    const line = document.createElement('div');
    line.style.color = color;
    line.style.marginBottom = '6px';
    line.textContent = `[${entry.level}] ${entry.code} ${JSON.stringify(entry.data)}`;
    logsEl.appendChild(line);
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  const unsubscribeLogger = logger.subscribe((entry) => appendLog(entry));

  function syncOutputMode() {
    const isGlbTarget = targetSelect.value === 'GLB';
    previewShell.style.display = isGlbTarget ? 'block' : 'none';
    textShell.style.display = isGlbTarget ? 'none' : 'block';
    previewToolbar.style.display = isGlbTarget ? 'flex' : 'none';
    if (isGlbTarget) preview.resize();
  }

  function resetDownloadState() {
    currentDownload = null;
    downloadButton.disabled = true;
  }

  function setFileAccept() {
    fileInput.accept = ACCEPT_BY_SOURCE[sourceSelect.value] || '*';
  }

  function setSubtab(activeKey) {
    subtabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-pcfx-subtab') === activeKey;
      button.classList.toggle('active', isActive);
      button.style.background = isActive ? '#16324f' : '#cfdceb';
      button.style.color = isActive ? '#fff' : '#16324f';
    });
    convertPanel.style.display = activeKey === 'convert' ? 'flex' : 'none';
    settingsPanel.style.display = activeKey === 'settings' ? 'block' : 'none';
    if (activeKey === 'convert') preview.resize();
  }

  function writeTextOutput(text, title) {
    outputTitle.textContent = title;
    textOutput.textContent = text;
    preview.clear();
    syncOutputMode();
  }

  async function readSourceDocument() {
    if (!selectedFile) throw new Error('Choose an input file first.');

    if (sourceSelect.value === 'PCF') {
      const text = await readTextFile(selectedFile);
      const doc = pcfxDocumentFromPcfText(text, selectedFile.name, getCurrentDefaults(), logger);
      return {
        doc,
        detail: `Imported ${doc.canonical.items.length} canonical item(s) from PCF.`,
      };
    }

    if (sourceSelect.value === 'PCFX') {
      const text = await readTextFile(selectedFile);
      const doc = parsePcfxText(text);
      return {
        doc,
        detail: `Loaded ${doc.canonical.items.length} canonical item(s) from PCFX.`,
      };
    }

    if (sourceSelect.value === 'GLB') {
      const arrayBuffer = await readArrayBufferFile(selectedFile);
      const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
      const scene = await loadGlbSceneFromBlob(blob);
      const result = pcfxDocumentFromGlbScene(scene, selectedFile.name, getCurrentDefaults(), logger);
      return {
        doc: result.doc,
        detail: result.exact
          ? `Imported ${result.doc.canonical.items.length} canonical item(s) from embedded PCFX metadata.`
          : `Imported ${result.doc.canonical.items.length} canonical item(s) from a legacy app GLB using best-effort reconstruction.`,
      };
    }

    throw new Error(`Unsupported source format: ${sourceSelect.value}`);
  }

  function emitDocumentDiagnostics(doc) {
    const diagnostics = Array.isArray(doc && doc.diagnostics) ? doc.diagnostics : [];
    diagnostics.forEach((entry) => {
      const payload = { message: entry.message, ...(entry.context || {}) };
      if (entry.level === 'ERROR') logger.error(entry.code, payload);
      else if (entry.level === 'WARN') logger.warn(entry.code, payload);
      else logger.info(entry.code, payload);
    });
  }

  async function handleConvert() {
    if (!selectedFile) {
      setStatus('No input file selected.', 'Choose a source file that matches the selected source format.');
      return;
    }

    runButton.disabled = true;
    resetDownloadState();
    clearLogs();
    setStatus('Converting...', 'Normalizing input into the canonical PCFX document.');

    try {
      const source = await readSourceDocument();
      const canonicalDoc = createPcfxDocument({
        producer: source.doc.producer,
        metadata: source.doc.metadata,
        items: source.doc.canonical.items,
        sourceSnapshots: source.doc.sourceSnapshots,
        diagnostics: source.doc.diagnostics,
      });

      emitDocumentDiagnostics(canonicalDoc);

      if (targetSelect.value === 'PCFX') {
        const text = stringifyPcfxDocument(canonicalDoc);
        writeTextOutput(text, 'PCFX Output');
        currentDownload = {
          kind: 'pcfx',
          doc: canonicalDoc,
          fileName: buildOutputFileName(selectedFile.name, '.pcfx'),
        };
      } else if (targetSelect.value === 'PCF') {
        const text = pcfTextFromCanonicalItems(canonicalDoc.canonical.items, {
          metadata: canonicalDoc.metadata,
          defaults: getCurrentDefaults(),
        });
        writeTextOutput(text, 'PCF Output');
        currentDownload = {
          kind: 'text',
          text,
          mimeType: 'text/plain',
          fileName: buildOutputFileName(selectedFile.name, '.pcf'),
        };
      } else if (targetSelect.value === 'GLB') {
        const exportScene = buildGlbSceneFromCanonicalItems(canonicalDoc.canonical.items, canonicalDoc, logger);
        const blob = await exportSceneToGLB(exportScene);
        outputTitle.textContent = 'GLB Preview';
        textOutput.textContent = '';
        syncOutputMode();
        await preview.loadBlob(blob);
        currentDownload = {
          kind: 'blob',
          blob,
          fileName: buildOutputFileName(selectedFile.name, '.glb'),
        };
      } else {
        throw new Error(`Unsupported target format: ${targetSelect.value}`);
      }

      downloadButton.disabled = false;
      setStatus('Ready.', source.detail);
      logger.info('CONVERSION_COMPLETE', {
        source: sourceSelect.value,
        target: targetSelect.value,
        items: canonicalDoc.canonical.items.length,
      });
    } catch (error) {
      preview.clear();
      textOutput.textContent = '';
      syncOutputMode();
      resetDownloadState();
      setStatus('Conversion failed.', String(error && error.message ? error.message : error));
      logger.error('CONVERSION_FAILED', {
        source: sourceSelect.value,
        target: targetSelect.value,
        message: String(error && error.message ? error.message : error),
      });
    } finally {
      runButton.disabled = false;
    }
  }

  subtabButtons.forEach((button) => {
    button.addEventListener('click', () => setSubtab(button.getAttribute('data-pcfx-subtab')));
  });

  fileInput.addEventListener('change', (event) => {
    selectedFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    resetDownloadState();
    if (!selectedFile) {
      setStatus('Waiting for input.', 'Choose an input file that matches the selected source format.');
      return;
    }
    setStatus(`Selected ${selectedFile.name}.`, `Ready to convert ${sourceSelect.value} -> ${targetSelect.value}.`);
  });

  sourceSelect.addEventListener('change', () => {
    selectedFile = null;
    fileInput.value = '';
    setFileAccept();
    resetDownloadState();
    setStatus('Waiting for input.', `Choose a ${sourceSelect.value} file for conversion.`);
  });

  targetSelect.addEventListener('change', () => {
    resetDownloadState();
    syncOutputMode();
    setStatus(selectedFile ? `Selected ${selectedFile.name}.` : 'Waiting for input.', `Ready to convert ${sourceSelect.value} -> ${targetSelect.value}.`);
  });

  runButton.addEventListener('click', handleConvert);

  downloadButton.addEventListener('click', () => {
    if (!currentDownload) return;
    if (currentDownload.kind === 'pcfx') {
      downloadPcfxDocument(currentDownload.doc, currentDownload.fileName);
      return;
    }
    if (currentDownload.kind === 'text') {
      downloadText(currentDownload.text, currentDownload.fileName, currentDownload.mimeType);
      return;
    }
    if (currentDownload.kind === 'blob') {
      downloadBlob(currentDownload.blob, currentDownload.fileName);
    }
  });

  renderSettingsTab(settingsPanel);
  setFileAccept();
  syncOutputMode();
  setSubtab('convert');
  setStatus('Waiting for input.', 'Choose a source file and a target format to start the conversion.');

  return () => {
    unsubscribeLogger();
    preview.destroy();
  };
}
