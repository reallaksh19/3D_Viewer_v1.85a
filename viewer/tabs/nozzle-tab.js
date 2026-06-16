/**
 * nozzle-tab.js — Equipment nozzle load compliance.
 */

import { NOZZLE_LOADS } from '../data/report-data.js';
import { state } from '../core/state.js';
import { renderTableToggles } from '../utils/table-toggle.js';

export function renderNozzle(container) {
  const flanges = state.parsed?.flanges || [];
  const nozzles = state.sticky.nozzleLoads || NOZZLE_LOADS;
  
  container.innerHTML = `
    <div class="report-section" id="section-nozzle">
      ${state.scopeToggles.nozzle ? `
      <h3 class="section-heading">Equipment Nozzle Load Compliance <span class="add-row-btn" data-target="nozzleLoads" style="cursor:pointer; color:var(--color-primary); font-size:16px;" title="Add row">＋</span></h3>
      <p class="tab-note">Method: Equivalent Pressure Method per vendor allowables.</p>
      <table class="data-table">
        <thead>
          <tr>
            <th>Equipment Tag</th>
            <th>Description</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${nozzles.map((row, idx) => `
            <tr>
              <td class="mono editable-field nz-edit" contenteditable="true" data-idx="${idx}" data-field="equipment">${row.equipment || ''}</td>
              <td class="editable-field nz-edit" contenteditable="true" data-idx="${idx}" data-field="description">${row.description || ''}</td>
              <td class="editable-field nz-edit" contenteditable="true" data-idx="${idx}" data-field="status"><span class="badge-${row.status === 'PASS' ? 'pass' : 'fail'}">${row.status === 'PASS' ? '✓ OK' : (row.status ? '✗ FAIL' : '')}</span></td>
              <td class="editable-field nz-edit" contenteditable="true" data-idx="${idx}" data-field="note">${row.note || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : ''}

      ${state.scopeToggles.flange ? `
      <h3 class="section-heading" style="margin-top: 2rem;">Flange Leakage Checks</h3>
      <p class="tab-note">Extracted ${flanges.length} flange checks from CAESAR II OUTPUT_FLANGE.</p>
      ${flanges.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr>
            <th>Location</th>
            <th>Method</th>
            <th>Status</th>
            <th>Max %</th>
          </tr>
        </thead>
        <tbody>
          ${flanges.map(f => `
            <tr>
              <td class="mono">${f.location}</td>
              <td>${f.method}</td>
              <td><span class="badge-${f.status === 'PASS' ? 'pass' : 'fail'}">${f.status === 'PASS' ? '✓ OK' : '✗ FAIL'}</span></td>
              <td>${f.maxPct}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p class="muted">No flange leakage data found in this ACCDB file.</p>'}
      ` : ''}
    </div>
  `;

  // Nozzle Load edits
  container.querySelectorAll('.nz-edit').forEach(td => {
    td.addEventListener('blur', () => {
      const idx = td.dataset.idx;
      const field = td.dataset.field;
      if (idx !== undefined && field) {
        if (!state.sticky.nozzleLoads) {
          state.sticky.nozzleLoads = JSON.parse(JSON.stringify(NOZZLE_LOADS));
        }
        state.sticky.nozzleLoads[idx][field] = td.textContent.trim();
        import('../core/state.js').then(m => m.saveStickyState());
      }
    });
  });

  // Add row button
  container.querySelector('.add-row-btn')?.addEventListener('click', () => {
      if (!state.sticky.nozzleLoads) {
          state.sticky.nozzleLoads = JSON.parse(JSON.stringify(NOZZLE_LOADS));
      }
      state.sticky.nozzleLoads.push({ equipment: '', description: '', status: '', note: '' });
      import('../core/state.js').then(m => m.saveStickyState());
      import('../core/app.js').then(m => m.goToTab('nozzle'));
  });

  renderTableToggles(container);
}
