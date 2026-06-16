import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * supports-tab.js - Support mapping editor wired to Stage 1 and Stage 2 generation.
 */

import { state, saveStickyState } from '../core/state.js';
import { emit } from '../core/event-bus.js';
import { renderTableToggles } from '../utils/table-toggle.js';

const DEFAULT_ROWS = [
  { supportKind: 'RST', friction: 0.3, gap: 'empty', name: 'CA150', description: 'Rest' },
  { supportKind: 'GDE', friction: 0.15, gap: 'any', name: 'CA100', description: 'Guide' },
];

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function normalizeRow(row) {
  return {
    supportKind: String(row?.supportKind || row?.kind || '').toUpperCase() || 'RST',
    friction: Number.isFinite(Number(row?.friction)) ? Number(row.friction) : 0.3,
    gap: String(row?.gap ?? 'any'),
    name: String(row?.name || '').toUpperCase(),
    description: String(row?.description || ''),
  };
}

function getRows() {
  const src = Array.isArray(state.sticky.supportMappings) ? state.sticky.supportMappings : clone(DEFAULT_ROWS);
  const normalized = src.map(normalizeRow);
  return normalized.length ? normalized : clone(DEFAULT_ROWS);
}

function setRows(rows) {
  state.sticky.supportMappings = rows.map(normalizeRow);
  saveStickyState();
  emit(RuntimeEvents.SUPPORT_MAPPING_CHANGED, state.sticky.supportMappings);
}

export function renderSupports(container) {
  const rows = getRows();

  container.innerHTML = `
    <div class="report-section" id="section-supports">
      <h3 class="section-heading">Support Block Mapping</h3>
      <p class="tab-note">SUPPORT_KIND is authoritative. Name retains CA block identity (for example CA100/CA150/CA250).</p>

      <table class="data-table" id="supports-map-table">
        <thead>
          <tr>
            <th>SUPPORT_KIND</th>
            <th>Friction</th>
            <th>Gap</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => `
            <tr data-idx="${idx}">
              <td contenteditable="true" class="mono editable-field sp-edit" data-field="supportKind">${_esc(row.supportKind)}</td>
              <td contenteditable="true" class="mono editable-field sp-edit" data-field="friction">${_esc(String(row.friction))}</td>
              <td contenteditable="true" class="mono editable-field sp-edit" data-field="gap">${_esc(row.gap)}</td>
              <td contenteditable="true" class="mono editable-field sp-edit" data-field="name">${_esc(row.name)}</td>
              <td contenteditable="true" class="editable-field sp-edit" data-field="description">${_esc(row.description)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="debug-controls" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-secondary" id="sp-add">+ Add Block</button>
        <button class="btn-primary" id="sp-apply">Apply</button>
        <button class="btn-secondary" id="sp-defaults">Defaults</button>
      </div>
    </div>
  `;

  container.querySelector('#sp-add')?.addEventListener('click', () => {
    const next = getRows();
    next.push({ supportKind: 'RST', friction: 0.3, gap: 'any', name: '', description: '' });
    setRows(next);
    renderSupports(container);
  });

  container.querySelector('#sp-apply')?.addEventListener('click', () => {
    const next = [];
    container.querySelectorAll('#supports-map-table tbody tr').forEach((tr) => {
      const row = {
        supportKind: tr.querySelector('[data-field="supportKind"]')?.textContent?.trim() || 'RST',
        friction: Number(tr.querySelector('[data-field="friction"]')?.textContent?.trim() || 0.3),
        gap: tr.querySelector('[data-field="gap"]')?.textContent?.trim() || 'any',
        name: tr.querySelector('[data-field="name"]')?.textContent?.trim() || '',
        description: tr.querySelector('[data-field="description"]')?.textContent?.trim() || '',
      };
      if (row.name) next.push(normalizeRow(row));
    });
    setRows(next.length ? next : clone(DEFAULT_ROWS));
    renderSupports(container);
  });

  container.querySelector('#sp-defaults')?.addEventListener('click', () => {
    setRows(clone(DEFAULT_ROWS));
    renderSupports(container);
  });

  renderTableToggles(container);
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
