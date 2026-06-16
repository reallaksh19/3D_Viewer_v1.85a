import { createViewerApp } from '../advanced/createViewerApp.js';
// import { loadMockPcfToGlbUrl, loadMockGlbUrl, loadPcfTextToGlbUrl } from '../pro-editor/core/mockLoader.js';
import { parsePcfText } from '../pcf/parsePcfText.js';
import { normalizePcfModel } from '../pcf/normalizePcfModel.js';

const MOCK_BUTTON_LABELS = {
  pcf: 'PCF Mock',
  glb: 'GLB Mock',
};

function setBusy(button, label, isBusy) {
  button.disabled = isBusy;
  button.textContent = isBusy ? 'Loading...' : label;
}

export function renderAdvancedGlbViewerPanel(container) {
  container.innerHTML = `
    <div style="display:flex; height:calc(100vh - 46px); background:linear-gradient(135deg, #cfd8e3 0%, #e8edf4 24%, #0f1723 24%, #0f1723 100%);">
      <aside style="width:320px; padding:22px 20px; background:linear-gradient(180deg, #eef3f8 0%, #dfe7f0 100%); border-right:1px solid rgba(15,23,35,0.12); display:flex; flex-direction:column; gap:18px; box-shadow:inset -1px 0 0 rgba(255,255,255,0.45);">
        <div>
          <div style="font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#35506f; margin-bottom:8px;">Advanced Workspace</div>
          <h3 style="font-size:2rem; line-height:1.05; color:#102033; margin:0 0 8px;">Advanced GLB Viewer</h3>
          <p style="font-size:13px; line-height:1.45; color:#4e627b; margin:0;">Stronger contrast and direct mock loading for the advanced vanilla JS viewer.</p>
        </div>

        <section style="padding:16px; border-radius:16px; background:#ffffff; border:1px solid rgba(16,32,51,0.08); box-shadow:0 10px 30px rgba(16,32,51,0.08);">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#53708c; margin-bottom:10px;">Load GLB or PCF</div>
          <input type="file" id="adv-file-input" accept=".glb,.gltf,.pcf,.PCF" style="width:100%; margin-bottom:12px; color:#17314d;">
          <button id="btn-adv-load" class="btn-primary" style="width:100%; justify-content:center; padding:10px 14px; border-radius:12px; background:linear-gradient(135deg, #1866c7 0%, #0f4fa5 100%); box-shadow:0 8px 20px rgba(24,102,199,0.28);" disabled>Load Selected File</button>
          <div style="margin-top:10px; font-size:11px; color:#60738b;">Drop a <span class="mono">.glb</span>, <span class="mono">.gltf</span>, or <span class="mono">.pcf</span> file directly onto the viewport as well.</div>
        </section>

        <section style="padding:16px; border-radius:16px; background:#142338; color:#eef5ff; border:1px solid rgba(255,255,255,0.08); box-shadow:0 14px 34px rgba(6,12,22,0.28);">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#90acd0; margin-bottom:10px;">Quick Mocks</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button id="btn-adv-mock-pcf" class="btn-secondary" title="Load mock piping PCF and convert to GLB" style="justify-content:center; padding:10px 12px; border-radius:12px; background:#1b3350; color:#dce9fb; border:1px solid rgba(144,172,208,0.35);">PCF Mock</button>
            <button id="btn-adv-mock-glb" class="btn-secondary" title="Load generated mock GLB geometry" style="justify-content:center; padding:10px 12px; border-radius:12px; background:#1b3350; color:#dce9fb; border:1px solid rgba(144,172,208,0.35);">GLB Mock</button>
          </div>
        </section>

        <section style="padding:16px; border-radius:16px; background:rgba(255,255,255,0.74); border:1px solid rgba(16,32,51,0.08);">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#53708c; margin-bottom:10px;">Controls</div>
          <div style="display:grid; gap:8px; font-size:12px; color:#52657d;">
            <div><strong style="color:#102033;">Orbit:</strong> drag with left mouse button</div>
            <div><strong style="color:#102033;">Pan:</strong> right mouse button or trackpad secondary drag</div>
            <div><strong style="color:#102033;">Zoom:</strong> wheel or pinch</div>
            <div><strong style="color:#102033;">Views:</strong> use the top toolbar for ISO, Top, Front, Side, Fit, and Clip</div>
            <div><strong style="color:#102033;">Marquee:</strong> hold <span class="mono">Shift</span> and drag for focus zoom</div>
          </div>
        </section>
      </aside>

      <section style="flex:1; display:flex; flex-direction:column; position:relative; min-width:0;">
        <div style="background:linear-gradient(90deg, #16263b 0%, #1f3551 54%, #29466d 100%); color:#f6fbff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:16px; border-bottom:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 30px rgba(5,10,18,0.18);">
          <div>
            <div style="font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#9db7d8; margin-bottom:2px;">Scene</div>
            <span style="font-size:28px; font-weight:700; letter-spacing:0.02em;">Advanced 3D Viewer</span>
          </div>
          <div id="adv-toolbar"></div>
        </div>

        <div id="adv-preview-container" style="flex:1; background:radial-gradient(circle at top, #2a2a30 0%, #1d1d21 38%, #15171b 100%); position:relative; overflow:hidden;"></div>
        <div id="adv-nav-strip" style="position:absolute; right:18px; top:112px; z-index:12; display:flex; flex-direction:column; gap:10px;">
          <button data-adv-nav="ISO" title="ISO View" style="${_navButtonStyle()}">ISO</button>
          <button data-adv-nav="TOP" title="Top View" style="${_navButtonStyle()}">TOP</button>
          <button data-adv-nav="FRONT" title="Front View" style="${_navButtonStyle()}">FRT</button>
          <button data-adv-nav="SIDE" title="Side View" style="${_navButtonStyle()}">SIDE</button>
          <button data-adv-nav="FIT" title="Fit All" style="${_navButtonStyle()}">FIT</button>
          <button data-adv-nav="MEASURE" title="Measure Selection" style="${_navButtonStyle()}">MSR</button>
        </div>
        <div id="adv-measure-chip" style="position:absolute; right:18px; bottom:80px; z-index:11; min-width:220px; max-width:280px; padding:12px 14px; border-radius:14px; border:1px solid rgba(131,191,255,0.18); background:rgba(16,30,47,0.88); color:#e8f3ff; font-size:12px; line-height:1.45; box-shadow:0 12px 28px rgba(0,0,0,0.28);">Measure tool is off.</div>

        <button id="btn-adv-debug-toggle" style="position:absolute; right:18px; bottom:18px; z-index:10; padding:10px 14px; border-radius:12px; border:1px solid rgba(119,196,255,0.25); background:rgba(20,36,56,0.92); color:#d8ecff; cursor:pointer; box-shadow:0 12px 24px rgba(4,10,18,0.28);">Debug</button>
        <div id="adv-debug-panel" style="position:absolute; right:18px; bottom:18px; width:420px; max-height:70vh; overflow:hidden; z-index:20; border-radius:16px; border:1px solid rgba(255,255,255,0.08); background:#11151b; color:#ddd; box-shadow:0 10px 40px rgba(0,0,0,0.35); display:none;">
          <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid rgba(255,255,255,0.08);">
            <strong>Debug</strong>
            <button id="btn-adv-debug-close" style="background:none; border:none; color:white; cursor:pointer;">Close</button>
          </div>
          <div style="padding:12px; max-height:52vh; overflow:auto; font-family:monospace; font-size:11px;">
            Active Logs:<br>
            <div id="adv-debug-logs"></div>
          </div>
        </div>

        <div id="adv-property-panel" style="position:absolute; top:76px; right:20px; width:300px; background:rgba(19,34,53,0.94); color:white; padding:15px; border-radius:14px; box-shadow:0 14px 40px rgba(0,0,0,0.35); display:none; z-index:10; border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.14); padding-bottom:8px; margin-bottom:10px;">
            <strong style="font-size:14px;">Component Properties</strong>
            <button id="btn-adv-close-props" style="background:none; border:none; color:white; cursor:pointer; font-weight:bold;">X</button>
          </div>
          <div id="adv-property-content" style="max-height:400px; overflow-y:auto; font-size:12px; font-family:monospace;"></div>
        </div>
      </section>
    </div>
  `;

  const fileInput = container.querySelector('#adv-file-input');
  const btnLoad = container.querySelector('#btn-adv-load');
  const previewContainer = container.querySelector('#adv-preview-container');
  const toolbarContainer = container.querySelector('#adv-toolbar');
  const propPanel = container.querySelector('#adv-property-panel');
  const propContent = container.querySelector('#adv-property-content');
  const btnCloseProps = container.querySelector('#btn-adv-close-props');
  const debugToggle = container.querySelector('#btn-adv-debug-toggle');
  const debugPanel = container.querySelector('#adv-debug-panel');
  const debugClose = container.querySelector('#btn-adv-debug-close');
  const debugLogs = container.querySelector('#adv-debug-logs');
  const btnMockPcf = container.querySelector('#btn-adv-mock-pcf');
  const btnMockGlb = container.querySelector('#btn-adv-mock-glb');
  const measureChip = container.querySelector('#adv-measure-chip');
  const measureStripButton = container.querySelector('[data-adv-nav="MEASURE"]');

  debugToggle.addEventListener('click', () => {
    debugPanel.style.display = 'block';
    debugToggle.style.display = 'none';
  });
  debugClose.addEventListener('click', () => {
    debugPanel.style.display = 'none';
    debugToggle.style.display = 'block';
  });

  let currentFile = null;
  let measureEnabled = false;

  fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
      currentFile = event.target.files[0];
      btnLoad.disabled = false;
    } else {
      currentFile = null;
      btnLoad.disabled = true;
    }
  });

  const viewerApp = createViewerApp(previewContainer, toolbarContainer, propPanel, propContent, debugLogs);
  viewerApp.setMeasureStateListener((enabled) => {
    measureEnabled = !!enabled;
    if (measureStripButton) {
      measureStripButton.style.background = measureEnabled ? 'rgba(44,116,86,0.52)' : 'rgba(19,36,57,0.42)';
      measureStripButton.style.borderColor = measureEnabled ? 'rgba(122,231,183,0.42)' : 'rgba(175,214,255,0.18)';
    }
    measureChip.innerHTML = _renderMeasureText(null, measureEnabled);
  });
  viewerApp.setMeasurementListener((info) => {
    measureChip.innerHTML = _renderMeasureText(info, measureEnabled);
  });

  btnLoad.addEventListener('click', async () => {
    if (!currentFile) return;
    await _loadSelectedFile(currentFile, viewerApp);
  });

  previewContainer.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  previewContainer.addEventListener('drop', async (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length <= 0) return;
    const file = event.dataTransfer.files[0];
    if (!/\.(glb|gltf|pcf)$/i.test(file.name)) return;
    await _loadSelectedFile(file, viewerApp);
  });

  btnMockPcf.addEventListener('click', async () => {
    setBusy(btnMockPcf, MOCK_BUTTON_LABELS.pcf, true);
    try {
      const url = ""; // await loadMockPcfToGlbUrl();
      await viewerApp.loadGLB(url);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(btnMockPcf, MOCK_BUTTON_LABELS.pcf, false);
    }
  });

  btnMockGlb.addEventListener('click', async () => {
    setBusy(btnMockGlb, MOCK_BUTTON_LABELS.glb, true);
    try {
      const url = ""; // await loadMockGlbUrl();
      await viewerApp.loadGLB(url);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(btnMockGlb, MOCK_BUTTON_LABELS.glb, false);
    }
  });

  btnCloseProps.addEventListener('click', () => {
    propPanel.style.display = 'none';
  });

  container.querySelectorAll('[data-adv-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-adv-nav');
      if (action === 'FIT') {
        viewerApp.fitAll();
        return;
      }
      if (action === 'MEASURE') {
        measureEnabled = !measureEnabled;
        viewerApp.setMeasureEnabled(measureEnabled);
        return;
      }
      viewerApp.setPresetView(action);
    });
  });
}

async function _loadSelectedFile(file, viewerApp) {
  const isPcf = /\.pcf$/i.test(file.name);
  if (isPcf) {
    const text = await file.text();
    // Extract MESSAGE-CIRCLE / MESSAGE-SQUARE nodes before converting to GLB (they don't survive conversion)
    try {
      const parsed = parsePcfText(text, null);
      const model = normalizePcfModel(parsed, null);
      const messageCircleNodes = model.components
        .filter(c => c.type === 'MESSAGE-CIRCLE' && c.circleCoord && c.circleText)
        .map(c => ({ pos: c.circleCoord, text: c.circleText }));
      const messageSquareNodes = model.components
        .filter(c => c.type === 'MESSAGE-SQUARE' && c.squarePos && c.squareText)
        .map(c => ({ pos: c.squarePos, text: c.squareText }));
      const url = ""; // await loadPcfTextToGlbUrl(text);
      await viewerApp.loadGLB(url);
      if (messageCircleNodes.length && typeof viewerApp.loadMessageCircleNodes === 'function') {
        viewerApp.loadMessageCircleNodes(messageCircleNodes);
      }
      if (messageSquareNodes.length && typeof viewerApp.loadMessageSquareNodes === 'function') {
        viewerApp.loadMessageSquareNodes(messageSquareNodes);
      }
    } catch (err) {
      console.error('Advanced GLB Viewer: PCF annotation parse error', err);
      const url = ""; // await loadPcfTextToGlbUrl(text);
      await viewerApp.loadGLB(url);
    }
  } else {
    const url = URL.createObjectURL(file);
    await viewerApp.loadGLB(url);
  }
}

function _renderMeasureText(info, enabled) {
  if (!enabled) return 'Measure tool is off.';
  if (!info) return 'Measure tool is active. Click a component in the scene.';
  return `
    <strong style="display:block; color:#9fd4ff; margin-bottom:4px;">${info.id || 'Selection'}</strong>
    <div>Width ${Number(info.width || 0).toFixed(1)} mm</div>
    <div>Height ${Number(info.height || 0).toFixed(1)} mm</div>
    <div>Depth ${Number(info.depth || 0).toFixed(1)} mm</div>
    <div style="color:#8de0b5;">Diagonal ${Number(info.diagonal || 0).toFixed(1)} mm</div>
  `;
}

function _navButtonStyle() {
  return 'width:56px; padding:10px 0; border-radius:14px; border:1px solid rgba(175,214,255,0.18); background:rgba(19,36,57,0.42); backdrop-filter:blur(12px); color:#e4f0ff; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; box-shadow:0 10px 22px rgba(0,0,0,0.2);';
}
