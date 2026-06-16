import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * input-tab.js — Input Data: Pipe Properties table + node-wise Applied Loads picker.
 *
 * Fixes:
 *  - Event listeners registered ONCE (module-level flag), not on every tab switch.
 *  - "Prepare Stress Report" button navigates to Summary after validation.
 */

import { state } from '../core/state.js';
import { emit, on } from '../core/event-bus.js';
import { fmt, fmtNode, materialFromDensity, prettyUnit, unitSuffix } from '../utils/formatter.js';
import { computeMaxValues } from '../utils/max-finder.js';
import { renderTableToggles } from '../utils/table-toggle.js';

let _pinnedLoads = [];
let _listenersRegistered = false; // prevent duplicate on() calls

export function renderInput(container) {
  // Register parse/file listeners only once
  if (!_listenersRegistered) {
    on('parse-complete', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'input' && c) _render(c);
    });
    on('file-loaded', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'input' && c) _render(c);
    });
    _listenersRegistered = true;
  }
  _render(container);
}

function _render(container) {
  const parsed   = state.parsed;
  const elements = parsed?.elements ?? [];
  const forces   = parsed?.forces   ?? [];
  const valState = _validationBanner();
  const format   = parsed?.format ?? '—';
  const units    = parsed?.units ?? {};
  const lenUnit  = prettyUnit(units.length);
  const lenSuffix = unitSuffix(units.length || 'mm');
  const tempUnit = prettyUnit(units.temperature);
  const pressUnit = prettyUnit(units.pressure);
  const densUnit = prettyUnit(units.density);
  const forceUnit = prettyUnit(units.force);
  const momentUnit = prettyUnit(units.moment);

  // Group elements for Pipe Properties Picker
  const { pipeGroups, classGroups } = _buildGroups(elements);

  container.innerHTML = `
    <div class="report-section" id="section-input">

      <!-- File load controls + Prepare button -->
      <div class="file-controls">
        <label class="btn-secondary file-label hide-on-print">
          <input type="file" id="accdb-file-input" accept=".accdb,.ACCDB,.xml,.XML,.pdf,.PDF" style="display:none">
          📂 Load .ACCDB, .XML, or .PDF File
        </label>
        <button class="btn-primary hide-on-print" id="prepare-report-btn" ${!elements.length ? 'disabled' : ''}>
          📋 Prepare Stress Report
        </button>
        <span class="validation-banner banner-${valState.status.toLowerCase()} hide-on-print" id="val-banner">
          ${valState.icon} ${valState.summary}
        </span>
      </div>

      ${parsed ? `<p class="tab-note" style="margin-bottom:0">
        Format: <strong>${format}</strong> &nbsp;|&nbsp;
        File: <strong>${state.fileName ?? '—'}</strong> &nbsp;|&nbsp;
        ${elements.length} elements &nbsp;|&nbsp; ${Object.keys(parsed.nodes ?? {}).length} nodes
      </p>` : ''}

      <!-- Pipe Properties Extract -->
      <h3 class="section-heading" style="margin-top:2rem">Pipe Properties</h3>
      
      <div class="hide-on-print picker-block">
        <p class="tab-note">Select groups below to include in the exported report.</p>
        ${pipeGroups.length 
          ? `<div class="table-scroll"><table class="data-table pipe-table">
              <thead><tr><th style="width:40px">Sel</th><th>OD${lenSuffix}</th><th>Insul${lenSuffix}</th><th>T1${unitSuffix(units.temperature)}</th><th>P1${unitSuffix(units.pressure)}</th><th>Density${unitSuffix(units.density)}</th><th>Material</th></tr></thead>
              <tbody>
                ${pipeGroups.map(g => `<tr>
                  <td><input type="checkbox" class="prop-chk" data-hash="${g.hash}" ${state.inputToggles.props.includes(g.hash) ? 'checked' : ''}></td>
                  <td class="mono">${fmt(g.od, 2)}</td><td class="mono">${fmt(g.insul, 1)}</td>
                  <td class="mono">${g.T1 !== undefined && g.T1 !== null ? fmt(g.T1, 0) : 'N/A'}</td><td class="mono">${g.P1 !== undefined && g.P1 !== null ? fmt(g.P1, 2) : 'N/A'}</td>
                  <td class="mono">${g.density !== undefined && g.density !== null ? fmt(g.density, 0) : 'N/A'}</td><td>${g.material}</td>
                </tr>`).join('')}
              </tbody>
            </table></div>`
          : '<p class="muted">No pipe elements found.</p>'
        }
      </div>

      <div id="prop-display-wrap" style="${state.inputToggles.props.length ? '' : 'display:none'}">
        <h4 class="sub-heading">Pipe Properties (Display)</h4>
        <table class="data-table pipe-table" id="prop-display-table">
          <thead><tr><th>OD${lenSuffix}</th><th>Insul${lenSuffix}</th><th>T1${unitSuffix(units.temperature)}</th><th>P1${unitSuffix(units.pressure)}</th><th>Density${unitSuffix(units.density)}</th><th>Material</th></tr></thead>
          <tbody id="prop-display-body">
            ${_renderPropRows(pipeGroups)}
          </tbody>
        </table>
      </div>

      <!-- Piping Class Info -->
      <h3 class="section-heading" style="margin-top:2rem">Piping Class Info</h3>
      <div class="hide-on-print picker-block">
        ${classGroups.length
          ? `<div class="table-scroll"><table class="data-table pipe-table">
               <thead><tr><th style="width:40px">Sel</th><th>Piping Class</th><th>OD${lenSuffix}</th><th>Wall${lenSuffix}</th><th>Corrosion (mm)</th><th>Material</th></tr></thead>
               <tbody>
                 ${classGroups.map(g => `<tr>
                    <td><input type="checkbox" class="class-chk" data-hash="${g.hash}" ${state.inputToggles.classes.includes(g.hash) ? 'checked' : ''}></td>
                    <td class="editable-field" contenteditable="true"></td>
                    <td class="mono">${fmt(g.od, 2)}</td><td class="mono">${fmt(g.wall, 2)}</td>
                    <td class="mono">${g.corrosion !== undefined ? fmt(g.corrosion, 2) : '—'}</td><td>${g.material}</td>
                 </tr>`).join('')}
               </tbody>
             </table></div>`
          : '<p class="muted">No piping class elements extracted.</p>'
        }
      </div>

      <div id="class-display-wrap" style="${state.inputToggles.classes.length ? '' : 'display:none'}">
        <h4 class="sub-heading">Piping Class Info (Display)</h4>
        <table class="data-table pipe-table" id="class-display-table">
          <thead><tr><th>Piping Class</th><th>OD${lenSuffix}</th><th>Wall${lenSuffix}</th><th>Corrosion (mm)</th><th>Material</th></tr></thead>
          <tbody id="class-display-body">
            ${_renderClassRows(classGroups)}
          </tbody>
        </table>
      </div>

      <!-- Applied Loads picker -->
      <h3 class="section-heading" style="margin-top:2rem">Applied Loads</h3>
      <div class="loads-picker">
        <select id="load-node-select" ${forces.length === 0 ? 'disabled' : ''}>
          <option value="">— select node —</option>
          ${forces.map(f => `<option value="${f.node}">Node ${f.node}</option>`).join('')}
        </select>
        <button class="btn-primary" id="pin-load-btn" disabled>＋ Add to table</button>
      </div>
      ${!forces.length ? '<p class="tab-note">No applied loads found in this file.</p>' : ''}
      <div id="load-preview" class="load-preview"></div>

      <!-- Pinned loads table -->
      <div id="pinned-loads-wrap" style="${_pinnedLoads.length ? '' : 'display:none'}">
        <h4 class="sub-heading">Pinned Loads</h4>
        <table class="data-table pinned-table" id="pinned-loads-table">
          <thead>
            <tr><th>Node</th><th>Fx${unitSuffix(units.force)}</th><th>Fy${unitSuffix(units.force)}</th><th>Fz${unitSuffix(units.force)}</th><th>Mx (N·m)</th><th>My (N·m)</th><th>Mz (N·m)</th><th></th></tr>
          </thead>
          <tbody id="pinned-loads-body">
            ${_pinnedLoads.map((f, i) => _pinnedRow(f, i)).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;

  _wireEvents(container, forces, pipeGroups, classGroups);
  renderTableToggles(container);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _buildGroups(elements) {
  const pipeMap = new Map();
  const classMap = new Map();

  for (const el of elements) {
    if (el.od <= 0) continue;
    
    // Density scaling: ACCDB density usually kg/cm³ e.g. 7.85e-6 in db, scaled inside parser
    // Ensure display unit is fundamentally kg/m³
    const densityVal = (el.density && el.density < 0.1) ? el.density * 1e6 : (el.density || 0);
    const material = el.material || materialFromDensity(el.density);

    // Pipe grouping: OD, Insul, T1, P1, Density, Material
    const propHash = `${fmt(el.od,2)}|${fmt(el.insul,1)}|${fmt(el.T1,0)}|${fmt(el.P1,2)}|${fmt(densityVal,0)}|${material}`;
    if (!pipeMap.has(propHash)) {
      pipeMap.set(propHash, { hash: propHash, od: el.od, insul: el.insul, T1: el.T1, P1: el.P1, density: densityVal, material });
    }

    // Class grouping: OD, Wall, Corrosion, Material
    const classHash = `${fmt(el.od,2)}|${fmt(el.wall,2)}|${fmt(el.corrosion||0,2)}|${material}`;
    if (!classMap.has(classHash)) {
      classMap.set(classHash, { hash: classHash, od: el.od, wall: el.wall, corrosion: el.corrosion||0, material });
    }
  }

  const sortByOD = (a, b) => b.od - a.od;
  return {
    pipeGroups: Array.from(pipeMap.values()).sort(sortByOD),
    classGroups: Array.from(classMap.values()).sort(sortByOD)
  };
}

function _renderPropRows(groups) {
  return groups
    .filter(g => state.inputToggles.props.includes(g.hash))
    .map(g => `<tr>
      <td class="mono">${fmt(g.od, 2)}</td><td class="mono">${fmt(g.insul, 1)}</td>
      <td class="mono">${g.T1 !== undefined && g.T1 !== null ? fmt(g.T1, 0) : 'N/A'}</td><td class="mono">${g.P1 !== undefined && g.P1 !== null ? fmt(g.P1, 2) : 'N/A'}</td>
      <td class="mono">${g.density !== undefined && g.density !== null ? fmt(g.density, 0) : 'N/A'}</td><td>${g.material}</td>
    </tr>`).join('');
}

function _renderClassRows(groups) {
  return groups
    .filter(g => state.inputToggles.classes.includes(g.hash))
    .map(g => {
      // Look up piping class from state or default to empty
      const pipingClass = state.inputToggles.classNames && state.inputToggles.classNames[g.hash] ? state.inputToggles.classNames[g.hash] : '';
      return `<tr>
        <td>${pipingClass}</td>
        <td class="mono">${fmt(g.od, 2)}</td><td class="mono">${fmt(g.wall, 2)}</td>
        <td class="mono">${g.corrosion !== undefined ? fmt(g.corrosion, 2) : '—'}</td><td>${g.material}</td>
      </tr>`;
    }).join('');
}



function _pinnedRow(f, idx) {
  return `<tr data-pin-idx="${idx}">
    <td class="mono">${f.node}</td>
    <td class="mono">${fmt(f.fx, 0)}</td><td class="mono">${fmt(f.fy, 0)}</td>
    <td class="mono">${fmt(f.fz, 0)}</td><td class="mono">${fmt(f.mx, 0)}</td>
    <td class="mono">${fmt(f.my, 0)}</td><td class="mono">${fmt(f.mz, 0)}</td>
    <td><button class="btn-remove" data-pin-idx="${idx}">×</button></td>
  </tr>`;
}

function _validationBanner() {
  if (!state.parsed) return { status: 'INFO', icon: 'ℹ', summary: 'No file loaded — drag & drop .ACCDB or use buttons above' };
  const v = state.parsed.validation;
  if (!v) return { status: 'INFO', icon: 'ℹ', summary: 'Parsed (no validation data)' };
  const icons = { OK: '✓', WARN: '⚠', ERROR: '✗', INFO: 'ℹ' };
  return { status: v.status, icon: icons[v.status] ?? 'ℹ', summary: v.summary };
}

function _wireEvents(container, forces, pipeGroups, classGroups) {
  const forceMap = new Map(forces.map(f => [String(f.node), f]));
  const select   = container.querySelector('#load-node-select');
  const pinBtn   = container.querySelector('#pin-load-btn');
  const preview  = container.querySelector('#load-preview');

  // Prepare Stress Report
  container.querySelector('#prepare-report-btn')?.addEventListener('click', () => {
    import('../core/app.js').then(m => m.prepareReport());
  });

  // Node load picker
  select?.addEventListener('change', () => {
    const f = forceMap.get(select.value);
    if (!f) { preview.innerHTML = ''; pinBtn.disabled = true; return; }
    pinBtn.disabled = false;
    preview.innerHTML = `
      <table class="data-table preview-table">
        <thead><tr><th>Node</th><th>Fx${unitSuffix(units.force)}</th><th>Fy${unitSuffix(units.force)}</th><th>Fz${unitSuffix(units.force)}</th><th>Mx (N·m)</th><th>My (N·m)</th><th>Mz (N·m)</th></tr></thead>
        <tbody><tr>
          <td class="mono">${f.node}</td>
          <td class="mono">${fmt(f.fx,0)}</td><td class="mono">${fmt(f.fy,0)}</td>
          <td class="mono">${fmt(f.fz,0)}</td><td class="mono">${fmt(f.mx,0)}</td>
          <td class="mono">${fmt(f.my,0)}</td><td class="mono">${fmt(f.mz,0)}</td>
        </tr></tbody>
      </table>`;
  });

  // Pin to table
  pinBtn?.addEventListener('click', () => {
    const f = forceMap.get(select?.value ?? '');
    if (!f || _pinnedLoads.some(p => p.node === f.node)) return;
    _pinnedLoads.push({ ...f });
    state.pinnedLoadNodes = [..._pinnedLoads];
    emit(RuntimeEvents.LOAD_PINNED, state.pinnedLoadNodes);
    _refreshPinnedTable(container);
  });

  // Remove pinned row
  container.querySelector('#pinned-loads-body')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove');
    if (!btn) return;
    _pinnedLoads.splice(Number(btn.dataset.pinIdx), 1);
    state.pinnedLoadNodes = [..._pinnedLoads];
    emit(RuntimeEvents.LOAD_PINNED, state.pinnedLoadNodes);
    _refreshPinnedTable(container);
  });

  // File input
  container.querySelector('#accdb-file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) emit(RuntimeEvents.FILE_DROPPED, file);
  });

  // Pickers listeners
  container.querySelectorAll('.prop-chk').forEach(btn => {
    btn.addEventListener('change', (e) => {
      const h = e.target.dataset.hash;
      if (e.target.checked) state.inputToggles.props.push(h);
      else state.inputToggles.props = state.inputToggles.props.filter(x => x !== h);
      
      const wrap = container.querySelector('#prop-display-wrap');
      const body = container.querySelector('#prop-display-body');
      body.innerHTML = _renderPropRows(pipeGroups);
      wrap.style.display = state.inputToggles.props.length ? '' : 'none';
    });
  });

  // Ensure we have a place to store piping class names
  if (!state.inputToggles.classNames) state.inputToggles.classNames = {};

  // Attach blur event listener to editable Piping Class fields to sync with display table
  container.querySelectorAll('.picker-block .editable-field').forEach(field => {
    const row = field.closest('tr');
    if (!row) return;
    const chk = row.querySelector('.class-chk');
    if (!chk) return;

    // Set initial text from state if it exists
    const h = chk.dataset.hash;
    if (state.inputToggles.classNames[h]) {
      field.textContent = state.inputToggles.classNames[h];
    }

    field.addEventListener('blur', () => {
      state.inputToggles.classNames[h] = field.textContent.trim();
      const body = container.querySelector('#class-display-body');
      if (body) body.innerHTML = _renderClassRows(classGroups);
    });
  });

  container.querySelectorAll('.class-chk').forEach(btn => {
    btn.addEventListener('change', (e) => {
      const h = e.target.dataset.hash;
      if (e.target.checked) state.inputToggles.classes.push(h);
      else state.inputToggles.classes = state.inputToggles.classes.filter(x => x !== h);
      
      const wrap = container.querySelector('#class-display-wrap');
      const body = container.querySelector('#class-display-body');
      if (body) body.innerHTML = _renderClassRows(classGroups);
      if (wrap) wrap.style.display = state.inputToggles.classes.length ? '' : 'none';
    });
  });
}

function _refreshPinnedTable(container) {
  const tbody = container.querySelector('#pinned-loads-body');
  const wrap  = container.querySelector('#pinned-loads-wrap');
  if (tbody) tbody.innerHTML = _pinnedLoads.map((p, i) => _pinnedRow(p, i)).join('');
  if (wrap)  wrap.style.display = _pinnedLoads.length ? '' : 'none';
}
