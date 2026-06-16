import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * config-tab.js - Dedicated UI for viewer3DConfig.
 */

import { state, saveStickyState } from '../core/state.js';
import { emit, on } from '../core/event-bus.js';
import { DEFAULT_VIEWER3D_CONFIG, VIEWER_ACTION_IDS } from '../viewer-3d-defaults.js';
import { getPcfMapping, savePcfMapping, getCaesarMatchAttribute, saveCaesarMatchAttribute, getSupportKindMap, saveSupportKindMap } from '../core/settings.js';
import { updateViewer3DConfig } from '../viewer-3d-config.js';
import { notify } from '../diagnostics/notification-center.js';

let _listenersRegistered = false;

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function _normalizeMockData(rawMockData) {
  const defaults = DEFAULT_VIEWER3D_CONFIG.mockData || {};
  const source = rawMockData && typeof rawMockData === 'object' ? rawMockData : {};
  const mock1 = source.mock1 && typeof source.mock1 === 'object' ? source.mock1 : {};
  const mock2 = source.mock2 && typeof source.mock2 === 'object' ? source.mock2 : {};
  const defaultMock1 = defaults.mock1 || {};
  const defaultMock2 = defaults.mock2 || {};
  return {
    enabledOnLocalhostOnly: source.enabledOnLocalhostOnly !== false,
    mock1: {
      label: String(mock1.label || defaultMock1.label || 'Mock 1'),
      fileName: String(mock1.fileName || defaultMock1.fileName || ''),
      pcfText: String(mock1.pcfText || ''),
    },
    mock2: {
      label: String(mock2.label || defaultMock2.label || 'Mock 2'),
      fileName: String(mock2.fileName || defaultMock2.fileName || ''),
      pcfText: String(mock2.pcfText || ''),
    },
  };
}

export function renderConfig(container) {
  if (!_listenersRegistered) {
    on('viewer3d-config-changed', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'config' && c) renderConfig(c);
    });
    _listenersRegistered = true;
  }

  const cfg = state.viewer3DConfig || clone(DEFAULT_VIEWER3D_CONFIG);
  const mockData = _normalizeMockData(cfg.mockData);

  const mapping = getPcfMapping();
  let mappingHtml = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 1rem;">';
  for (const [key, val] of Object.entries(mapping)) {
    mappingHtml += `<label>${key}: <input type="text" class="pcf-mapping-input" data-key="${key}" value="${val}" style="width: 100%; box-sizing: border-box;"/></label>`;
  }
  mappingHtml += `</div>
    <div style="margin-top: 1rem; display: flex; gap: 10px;">
      <button id="save-mapping-btn" class="btn-primary">Save Mapping</button>
      <button id="export-mapping-btn" class="btn-secondary">Export PCF_MAP.xml</button>
    </div>`;

  const matchAttr = getCaesarMatchAttribute();

  container.innerHTML = `
    <div class="report-section" id="section-viewer3d-config">
      <h3 class="section-heading">CAESAR Linelist Match Attribute</h3>
      <p class="tab-note">Attribute on the CAESAR element to match against the linelist (e.g., 'lineNo').</p>
      <input type="text" id="cfg-caesar-match-attr" value="${_esc(matchAttr)}" style="width: 200px; padding: 4px;" />
      <button id="save-match-attr-btn" class="btn-primary" style="margin-left: 8px;">Save Match Attribute</button>

      <hr style="margin: 2rem 0;">
      <h3 class="section-heading">PCF Component Attribute Mapping</h3>
      <p class="tab-note">Map logical process names to <code>COMPONENT-ATTRIBUTEn</code> tags used in your PCF files.
        Standard defaults: T1→CA2, P1→CA1, WALLTHK→CA4, CORRALLW→CA7, WEIGHT→CA8, INSULDENS→CA6, FLUIDDENS→CA9.</p>
      ${mappingHtml}

      <hr style="margin: 2rem 0;">
      <h3 class="section-heading">PCFx / Support Attributes Reference</h3>
      <p class="tab-note">These attributes are read from PCF/PCFx and shown in the <strong>Support</strong> section of the component panel when a support is selected.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 18px;font-size:12px;margin-top:8px;">
        <div><code>SUPPORT-DIRECTION</code><br><span style="color:#64748b">PCF keyword → shown as "Support Dir."</span></div>
        <div><code>SUPPORT-FRICTION</code><br><span style="color:#64748b">Friction coefficient (PCFx)</span></div>
        <div><code>SUPPORT-GAP</code><br><span style="color:#64748b">Support gap distance (PCFx)</span></div>
        <div><code>CORROSION-ALLOWANCE</code><br><span style="color:#64748b">Also: CORRALLW via CA mapping</span></div>
        <div><code>RATING</code><br><span style="color:#64748b">Pressure class rating</span></div>
        <div><code>PIPELINE-REFERENCE</code><br><span style="color:#64748b">Line reference / tag</span></div>
      </div>
      <p class="tab-note" style="margin-top:8px;">Support rendering type is inferred from SKEY/support-name text first. Cardinal <code>SUPPORT-DIRECTION</code> needs pipe-axis context: parallel = LINESTOP, perpendicular = GUIDE. REST = vertical arrow, GUIDE = lateral arrows, ANCHOR = fixed symbol.</p>

      <hr style="margin: 2rem 0;">
      <h3 class="section-heading">Support Kind Map (SKEY → Kind)</h3>
      <p class="tab-note">
        Map PCF <code>SKEY</code> catalog codes to a support kind.
        Checked after explicit <code>SUPPORT-KIND</code> but before direction / name heuristics.
        Kind must be one of: <strong>REST</strong>, <strong>GUIDE</strong>, <strong>ANCHOR</strong>, <strong>SPRING</strong>.
      </p>
      <table id="support-kind-map-table" style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #334155;">SKEY Value</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #334155;">Kind</th>
            <th style="padding:4px 8px;border-bottom:1px solid #334155;"></th>
          </tr>
        </thead>
        <tbody id="support-kind-map-rows">
          ${_renderSupportKindRows(getSupportKindMap())}
        </tbody>
      </table>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button id="skm-add-row" class="btn-secondary">+ Add Row</button>
        <button id="skm-save" class="btn-primary">Save Support Kind Map</button>
        <button id="skm-reset" class="btn-secondary">Reset to Defaults</button>
        <span id="skm-status" style="font-size:12px;color:#22c55e;display:none;">Saved ✓</span>
      </div>

      <hr style="margin: 2rem 0;">
      <h3 class="section-heading">Localhost Mock Data (3D Viewer)</h3>
      <p class="tab-note">Mock buttons are shown only on localhost. The payload below is stored in viewer3DConfig as JSON and loaded when clicking Mock 1 / Mock 2.</p>
      <label style="display:block;margin-bottom:10px;">
        <input type="checkbox" id="cfg-mock-local-only" ${mockData.enabledOnLocalhostOnly ? 'checked' : ''}>
        Enable mock buttons on localhost
      </label>
      <div class="cfg-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
        <label>Mock 1 Label
          <input type="text" id="cfg-mock1-label" value="${_esc(mockData.mock1.label)}">
        </label>
        <label>Mock 1 File Name
          <input type="text" id="cfg-mock1-file" value="${_esc(mockData.mock1.fileName)}">
        </label>
      </div>
      <label style="display:block;margin-top:8px;">Mock 1 PCF Text (JSON string payload)
        <textarea id="cfg-mock1-pcf" class="mono" style="width:100%;min-height:90px;">${_esc(mockData.mock1.pcfText)}</textarea>
      </label>

      <div class="cfg-grid" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
        <label>Mock 2 Label
          <input type="text" id="cfg-mock2-label" value="${_esc(mockData.mock2.label)}">
        </label>
        <label>Mock 2 File Name
          <input type="text" id="cfg-mock2-file" value="${_esc(mockData.mock2.fileName)}">
        </label>
      </div>
      <label style="display:block;margin-top:8px;">Mock 2 PCF Text (JSON string payload)
        <textarea id="cfg-mock2-pcf" class="mono" style="width:100%;min-height:90px;">${_esc(mockData.mock2.pcfText)}</textarea>
      </label>
      <div style="margin-top:8px;">
        <button id="cfg-load-mock-seeds" class="btn-secondary">Load Seed Mock Data from /opt/mock-pcf-data.json</button>
      </div>

      <hr style="margin: 2rem 0;">
      <h3 class="section-heading">3D Viewer Config (Legacy)</h3>
      <p class="tab-note">Dedicated top-level settings for the 3D Viewer tab only.</p>

      <div class="cfg-grid">
        <label><input type="checkbox" id="cfg-disable-all" ${cfg.disableAllSettings ? 'checked' : ''}> Disable all settings (show original viewer3D)</label>
        <label>Vertical Axis
          <select id="cfg-vertical-axis">
            <option value="Z" ${String(cfg.coordinateMap?.verticalAxis) === 'Z' ? 'selected' : ''}>Z-up</option>
            <option value="Y" ${String(cfg.coordinateMap?.verticalAxis) === 'Y' ? 'selected' : ''}>Y-up</option>
          </select>
        </label>
        <label>Legend Mode
          <select id="cfg-legend-mode">
            <option value="none" ${cfg.legend?.mode === 'none' ? 'selected' : ''}>none</option>
            <option value="od" ${cfg.legend?.mode === 'od' ? 'selected' : ''}>od</option>
            <option value="material" ${cfg.legend?.mode === 'material' ? 'selected' : ''}>material</option>
            <option value="supportKind" ${cfg.legend?.mode === 'supportKind' ? 'selected' : ''}>support kind</option>
            <option value="heatmap" ${cfg.legend?.mode === 'heatmap' ? 'selected' : ''}>heatmap</option>
          </select>
        </label>
        <label><input type="checkbox" id="cfg-heatmap-enabled" ${cfg.heatmap?.enabled ? 'checked' : ''}> Heatmap enabled</label>
        <label>Heatmap Metric
          <input id="cfg-heatmap-metric" value="${_esc(cfg.heatmap?.metric || 'T1')}">
        </label>
        <label>Heatmap Buckets
          <input id="cfg-heatmap-buckets" type="number" min="2" max="12" value="${Number(cfg.heatmap?.bucketCount || 5)}">
        </label>
        <label>Overlay Sensitivity
          <input
            id="cfg-overlay-scroll-sensitivity"
            type="number"
            min="0.05"
            max="2.5"
            step="0.05"
            value="${Number(cfg.overlay?.smartScale?.scrollSensitivity ?? 0.2)}">
        </label>
      </div>

      <h4 class="sub-heading" style="margin-top:1rem">Component Panel</h4>
      <div class="cfg-grid">
        <label><input type="checkbox" id="cfg-cp-enabled" ${cfg.componentPanel?.enabled ? 'checked' : ''}> Enable panel</label>
        <label><input type="checkbox" id="cfg-cp-raw" ${cfg.componentPanel?.showRawAttributes ? 'checked' : ''}> Show raw attributes</label>
        <label><input type="checkbox" id="cfg-cp-common" ${cfg.componentPanel?.showCommonSection ? 'checked' : ''}> Show common section</label>
        <label><input type="checkbox" id="cfg-cp-geometry" ${cfg.componentPanel?.showGeometrySection ? 'checked' : ''}> Show geometry section</label>
        <label><input type="checkbox" id="cfg-cp-process" ${cfg.componentPanel?.showProcessSection ? 'checked' : ''}> Show process section</label>
        <label><input type="checkbox" id="cfg-cp-support" ${cfg.componentPanel?.showSupportSection ? 'checked' : ''}> Show support section</label>
      </div>

      <h4 class="sub-heading" style="margin-top:1rem">Toolbar Actions</h4>
      <div class="cfg-actions-grid" id="cfg-actions-grid">
        ${VIEWER_ACTION_IDS.map((id) => {
          const checked = cfg.actions?.[id]?.enabled !== false;
          return `<label><input type="checkbox" data-action-id="${id}" ${checked ? 'checked' : ''}> ${id}</label>`;
        }).join('')}
      </div>

      <h4 class="sub-heading" style="margin-top:1rem">Import / Export</h4>
      <textarea id="cfg-json" class="mono" style="width:100%;min-height:140px">${_esc(JSON.stringify(cfg, null, 2))}</textarea>

      <div class="debug-controls" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-primary" id="cfg-apply">Apply</button>
        <button class="btn-secondary" id="cfg-reset-viewer">Reset Viewer3DConfig Defaults</button>
        <button class="btn-secondary" id="cfg-reset-cam">Reset Camera/Nav Defaults</button>
        <button class="btn-secondary" id="cfg-import-json">Import JSON</button>
      </div>
    </div>
  `;

  container.querySelector('#cfg-apply')?.addEventListener('click', () => {
    _applyForm(container);
  });

  container.querySelector('#cfg-reset-viewer')?.addEventListener('click', () => {
    state.viewer3DConfig = clone(DEFAULT_VIEWER3D_CONFIG);
    saveStickyState();
    emit(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, { source: 'config-tab', reason: 'reset-all' });
  });

  container.querySelector('#cfg-reset-cam')?.addEventListener('click', () => {
    state.viewer3DConfig = updateViewer3DConfig(state.viewer3DConfig, {
      camera: clone(DEFAULT_VIEWER3D_CONFIG.camera),
      controls: clone(DEFAULT_VIEWER3D_CONFIG.controls),
      coordinateMap: clone(DEFAULT_VIEWER3D_CONFIG.coordinateMap),
      presets: clone(DEFAULT_VIEWER3D_CONFIG.presets),
    });
    saveStickyState();
    emit(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, { source: 'config-tab', reason: 'reset-camera-nav' });
  });

  container.querySelector('#cfg-import-json')?.addEventListener('click', () => {
    const txt = container.querySelector('#cfg-json')?.value || '';
    try {
      const parsed = JSON.parse(txt);
      state.viewer3DConfig = updateViewer3DConfig(DEFAULT_VIEWER3D_CONFIG, parsed);
      saveStickyState();
      emit(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, { source: 'config-tab', reason: 'import-json' });
    } catch (e) {
      notify({ level: 'error', title: 'Invalid JSON', message: e.message });
    }
  });

  container.querySelector('#cfg-load-mock-seeds')?.addEventListener('click', async () => {
    try {
      const response = await fetch('./opt/mock-pcf-data.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const mock1 = payload?.mock1 || {};
      const mock2 = payload?.mock2 || {};
      if (container.querySelector('#cfg-mock1-label')) container.querySelector('#cfg-mock1-label').value = String(mock1.label || 'Mock 1');
      if (container.querySelector('#cfg-mock1-file')) container.querySelector('#cfg-mock1-file').value = String(mock1.fileName || '');
      if (container.querySelector('#cfg-mock1-pcf')) container.querySelector('#cfg-mock1-pcf').value = String(mock1.pcfText || '');
      if (container.querySelector('#cfg-mock2-label')) container.querySelector('#cfg-mock2-label').value = String(mock2.label || 'Mock 2');
      if (container.querySelector('#cfg-mock2-file')) container.querySelector('#cfg-mock2-file').value = String(mock2.fileName || '');
      if (container.querySelector('#cfg-mock2-pcf')) container.querySelector('#cfg-mock2-pcf').value = String(mock2.pcfText || '');
    } catch (error) {
      notify({ level: 'error', title: 'Mock Load Error', message: `Failed to load seeded mock data: ${String(error?.message || error)}` });
    }
  });

  // ── Support Kind Map handlers ─────────────────────────────────────
  container.querySelector('#skm-add-row')?.addEventListener('click', () => {
    const tbody = container.querySelector('#support-kind-map-rows');
    if (tbody) tbody.insertAdjacentHTML('beforeend', _renderSupportKindRow('', 'REST'));
  });

  container.querySelector('#skm-save')?.addEventListener('click', () => {
    const map = _readSupportKindMap(container);
    saveSupportKindMap(map);
    const status = container.querySelector('#skm-status');
    if (status) {
      status.style.display = 'inline';
      setTimeout(() => { status.style.display = 'none'; }, 2000);
    }
  });

  container.querySelector('#skm-reset')?.addEventListener('click', () => {
    saveSupportKindMap({});           // clear → getSupportKindMap returns defaults
    const tbody = container.querySelector('#support-kind-map-rows');
    if (tbody) tbody.innerHTML = _renderSupportKindRows(getSupportKindMap());
  });

  container.querySelector('#support-kind-map-rows')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('skm-remove-row')) {
      e.target.closest('tr')?.remove();
    }
  });

  container.querySelector('#save-match-attr-btn')?.addEventListener('click', () => {
    const attr = container.querySelector('#cfg-caesar-match-attr').value.trim();
    if (attr) {
      saveCaesarMatchAttribute(attr);
      notify({ level: 'success', title: 'Saved', message: 'CAESAR Match Attribute saved.' });
    }
  });

  container.querySelector('#save-mapping-btn')?.addEventListener('click', () => {
    const inputs = container.querySelectorAll('.pcf-mapping-input');
    const newMapping = {};
    inputs.forEach(input => {
      newMapping[input.dataset.key] = input.value.trim();
    });
    savePcfMapping(newMapping);
    notify({ level: 'success', title: 'Saved', message: 'PCF Mapping saved successfully.' });
  });

  container.querySelector('#export-mapping-btn')?.addEventListener('click', () => {
    const mapping = getPcfMapping();
    let xml = '<PCF_MAP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n<Items>\n';

    // Explicitly order known keys, otherwise fall back to object keys
    const keys = [
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
      'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9',
      'PHYDRO', 'MATERIAL', 'WALLTHK', 'INSULTHK', 'INSULDENS',
      'CORRALLW', 'WEIGHT', 'FLUIDDENS', 'LINENUM', 'CLADTHK',
      'CLADDENS', 'REFRTHK', 'REFRDENS'
    ];

    // Build unique union of pre-defined keys and any newly mapped keys
    const allKeys = new Set([...keys, ...Object.keys(mapping)]);
    for (const key of allKeys) {
        const val = mapping[key] || '';
        xml += `<Item xsi:type="ComponentItem" Key="${key}" Value="${val}"/>\n`;
    }

    xml += '</Items>\n</PCF_MAP>';

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PCF_MAP.xml';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function _applyForm(container) {
  const actionPatch = {};
  container.querySelectorAll('[data-action-id]').forEach((el) => {
    actionPatch[el.getAttribute('data-action-id')] = {
      enabled: !!el.checked,
    };
  });

  const patch = {
    disableAllSettings: !!container.querySelector('#cfg-disable-all')?.checked,
    coordinateMap: {
      verticalAxis: container.querySelector('#cfg-vertical-axis')?.value || 'Z',
    },
    legend: {
      mode: container.querySelector('#cfg-legend-mode')?.value || 'none',
    },
    heatmap: {
      enabled: !!container.querySelector('#cfg-heatmap-enabled')?.checked,
      metric: container.querySelector('#cfg-heatmap-metric')?.value || 'T1',
      bucketCount: Number(container.querySelector('#cfg-heatmap-buckets')?.value || 5),
    },
    overlay: {
      smartScale: {
        scrollSensitivity: Number(container.querySelector('#cfg-overlay-scroll-sensitivity')?.value || 0.2),
      },
    },
    componentPanel: {
      enabled: !!container.querySelector('#cfg-cp-enabled')?.checked,
      showRawAttributes: !!container.querySelector('#cfg-cp-raw')?.checked,
      showCommonSection: !!container.querySelector('#cfg-cp-common')?.checked,
      showGeometrySection: !!container.querySelector('#cfg-cp-geometry')?.checked,
      showProcessSection: !!container.querySelector('#cfg-cp-process')?.checked,
      showSupportSection: !!container.querySelector('#cfg-cp-support')?.checked,
    },
    mockData: {
      enabledOnLocalhostOnly: !!container.querySelector('#cfg-mock-local-only')?.checked,
      mock1: {
        label: String(container.querySelector('#cfg-mock1-label')?.value || 'Mock 1'),
        fileName: String(container.querySelector('#cfg-mock1-file')?.value || ''),
        pcfText: String(container.querySelector('#cfg-mock1-pcf')?.value || ''),
      },
      mock2: {
        label: String(container.querySelector('#cfg-mock2-label')?.value || 'Mock 2'),
        fileName: String(container.querySelector('#cfg-mock2-file')?.value || ''),
        pcfText: String(container.querySelector('#cfg-mock2-pcf')?.value || ''),
      },
    },
    actions: actionPatch,
  };

  state.viewer3DConfig = updateViewer3DConfig(state.viewer3DConfig, patch);
  saveStickyState();
  emit(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, { source: 'config-tab', reason: 'apply' });
}

// ─── Support Kind Map helpers ─────────────────────────────────────────────────

const _SKM_KINDS = ['REST', 'GUIDE', 'ANCHOR', 'SPRING'];

function _kindOptions(selected) {
  return _SKM_KINDS.map(k =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${k}</option>`
  ).join('');
}

function _renderSupportKindRow(skey, kind) {
  return `
    <tr class="skm-row">
      <td style="padding:4px 8px;">
        <input type="text" class="skm-skey" value="${_esc(skey)}"
          placeholder="e.g. CA150"
          style="width:100%;box-sizing:border-box;font-family:monospace;"/>
      </td>
      <td style="padding:4px 8px;">
        <select class="skm-kind" style="width:100%;">
          ${_kindOptions((kind || 'REST').toUpperCase())}
        </select>
      </td>
      <td style="padding:4px 8px;text-align:center;">
        <button class="skm-remove-row btn-secondary"
          style="padding:2px 8px;font-size:12px;cursor:pointer;"
          title="Remove row">×</button>
      </td>
    </tr>`;
}

function _renderSupportKindRows(map) {
  const entries = Object.entries(map || {});
  if (!entries.length) return _renderSupportKindRow('', 'REST');
  return entries.map(([k, v]) => _renderSupportKindRow(k, v)).join('');
}

function _readSupportKindMap(container) {
  const result = {};
  container.querySelectorAll('#support-kind-map-rows .skm-row').forEach(row => {
    const skey = row.querySelector('.skm-skey')?.value?.trim().toUpperCase();
    const kind = row.querySelector('.skm-kind')?.value?.toUpperCase();
    if (skey && kind) result[skey] = kind;
  });
  return result;
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
