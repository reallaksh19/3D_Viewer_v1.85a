import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * summary-tab.js — Cover page with scope toggles.
 */

import { META, SCOPE_ITEMS, REFERENCES, ASSUMPTIONS, NOTES, SPECIAL_SUPPORTS, NOZZLE_LOADS } from '../data/report-data.js';
import { state } from '../core/state.js';
import { emit } from '../core/event-bus.js';
import { computeOperatingConditions, computeMaxValues } from '../utils/max-finder.js';
import { renderTableToggles } from '../utils/table-toggle.js';
import { fmtUnit, prettyUnit, unitSuffix } from '../utils/formatter.js';

export function renderSummary(container) {
  const opCond = computeOperatingConditions(state.parsed);
  const maxVals = computeMaxValues(state.parsed);
  const units = state.parsed?.units ?? {};
  const tempUnit = prettyUnit(units.temperature);
  const pressureUnit = prettyUnit(units.pressure);
  
  const sysLabel = state.parsed?.meta?.jobName || META.system;
  
  // Render editable lists or fallback
  const renderList = (key, defaultArr, isEditable) => {
    const list = state.sticky[key] && state.sticky[key].length > 0 ? state.sticky[key] : defaultArr;
    return list.map((item, i) => `
      <li ${isEditable ? 'contenteditable="true" class="editable-field list-edit"' : ''} data-key="${key}" data-idx="${i}">
        ${typeof item === 'object' && item.title ? `<span class="mono">${item.docNo}</span> - ${item.title}` : item}
      </li>
    `).join('');
  };

  container.innerHTML = `
    <div class="report-section" id="section-summary">
      <div class="report-header-block">
        <div class="report-header-left">
          <div class="report-title">${META.title.toUpperCase()}</div>
          <div class="report-subtitle editable-field" contenteditable="true" spellcheck="false" data-key="project">${state.sticky.project || META.project}</div>
          <div class="report-subtitle editable-field" contenteditable="true" spellcheck="false" data-key="facility">${state.sticky.facility || META.facility}</div>
        </div>
        <div class="report-header-right">
          <table class="meta-table">
            <tr><td>Doc No.</td><td><span class="editable-field docno-field ${state.sticky.docNoInitialized ? '' : 'uninitialized'}" contenteditable="true" spellcheck="false" data-key="docNo">${state.sticky.docNo || META.docNumber}</span></td></tr>
            <tr><td>Revision</td><td><span class="editable-field" contenteditable="true" spellcheck="false" data-key="revision">${state.sticky.revision || META.revision}</span></td></tr>
            <tr><td>Proj No.</td><td><span class="editable-field" contenteditable="true" spellcheck="false" data-key="projNumber">${state.sticky.projNumber || META.projNumber}</span></td></tr>
            <tr><td>System</td><td><span class="editable-field" contenteditable="true" spellcheck="false" data-key="system">${state.sticky.system || sysLabel}</span></td></tr>
            <tr><td>Code</td><td>${state.sticky.code || META.designCode}</td></tr>
            <tr><td>Software</td><td>${META.software}</td></tr>
          </table>
        </div>
      </div>

      <h3 class="section-heading">Basis — Maximum Values</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <table class="data-table params-table">
          <thead><tr><th>Param</th><th>Value</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td class="param-key">T1</td><td class="editable-field" contenteditable="true">${opCond && opCond.T1 !== undefined ? fmtUnit(opCond.T1, tempUnit, 1) : '—'}</td><td>Max Design Temperature</td></tr>
            <tr><td class="param-key">T2</td><td class="editable-field" contenteditable="true">${opCond && opCond.T2 !== undefined ? fmtUnit(opCond.T2, tempUnit, 1) : '—'}</td><td>Normal Operating Temperature</td></tr>
            <tr><td class="param-key">T3</td><td class="editable-field" contenteditable="true">${opCond && opCond.T3 !== undefined ? fmtUnit(opCond.T3, tempUnit, 1) : '—'}</td><td>Min Design Temperature</td></tr>
            ${[4,5,6,7,8,9].map(i => opCond && opCond[`T${i}`] !== undefined ? `<tr><td class="param-key">T${i}</td><td class="editable-field" contenteditable="true">${fmtUnit(opCond[`T${i}`], tempUnit, 1)}</td><td>Temperature ${i}</td></tr>` : '').join('')}
            <tr><td class="param-key">P1</td><td class="editable-field" contenteditable="true">${opCond && opCond.P1 !== undefined ? fmtUnit(opCond.P1, pressureUnit, 2) : '—'}</td><td>Design Pressure</td></tr>
            <tr><td class="param-key">P2</td><td class="editable-field" contenteditable="true">${opCond && opCond.P2 !== undefined ? fmtUnit(opCond.P2, pressureUnit, 2) : '—'}</td><td>Operating Pressure</td></tr>
            ${[3,4,5,6,7,8,9].map(i => opCond && opCond[`P${i}`] !== undefined ? `<tr><td class="param-key">P${i}</td><td class="editable-field" contenteditable="true">${fmtUnit(opCond[`P${i}`], pressureUnit, 2)}</td><td>Pressure ${i}</td></tr>` : '').join('')}
            <tr><td class="param-key">Phyd</td><td class="editable-field" contenteditable="true">${opCond && opCond.P_hydro !== undefined ? fmtUnit(opCond.P_hydro, pressureUnit, 2) : '—'}</td><td>Hydro Test Pressure</td></tr>
          </tbody>
        </table>

        <table class="data-table params-table">
          <thead><tr><th>Property</th><th>Value</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td class="param-key">maxStress</td><td class="editable-field" contenteditable="true">${maxVals?.maxStress ? `${Number(maxVals.maxStress.value).toFixed(2)} ${maxVals.maxStress.unit}` : '—'}</td><td>Max Computed Stress</td></tr>
            <tr><td class="param-key">maxDisplacement</td><td class="editable-field" contenteditable="true">${maxVals?.maxDisplacement ? `${Number(maxVals.maxDisplacement.value).toFixed(2)} ${maxVals.maxDisplacement.unit}` : '—'}</td><td>Max Displacement</td></tr>
            <tr><td class="param-key">plantLife</td><td class="editable-field" contenteditable="true">25 years</td><td>Plant Life</td></tr>
            <tr><td class="param-key">operatingHrs</td><td class="editable-field" contenteditable="true">7000 hrs</td><td>Operating Hours</td></tr>
            <tr><td class="param-key">maxDeflect</td><td class="editable-field" contenteditable="true">10 mm</td><td>Max Sustained Vertical Mid-span Deflection</td></tr>
          </tbody>
        </table>
      </div>

      <h3 class="section-heading">Scope</h3>
      <div class="scope-list" id="scope-list">
        ${SCOPE_ITEMS.map(item => _scopeRow(item, state.scopeToggles[item.id])).join('')}
      </div>

      <h3 class="section-heading" style="margin-top:2rem">Reference Documents <span class="add-row-btn" data-target="references" style="cursor:pointer; color:var(--color-primary); font-size:16px;" title="Add row">＋</span></h3>
      <ul class="conclusion-list" id="references-list">
        ${renderList('references', REFERENCES, true)}
      </ul>

      <h3 class="section-heading" style="margin-top:2rem">Assumptions & Notes <span class="add-row-btn" data-target="assumptions" style="cursor:pointer; color:var(--color-primary); font-size:16px;" title="Add row">＋</span></h3>
      <ol class="assumption-list note-field ${state.sticky.notesInitialized ? '' : 'uninitialized'}" id="notes-list">
        ${renderList('assumptions', [...ASSUMPTIONS, ...NOTES], true)}
      </ol>

      <h3 class="section-heading" style="margin-top:2rem">Special Support List <span class="add-row-btn" data-target="specialSupports" style="cursor:pointer; color:var(--color-primary); font-size:16px;" title="Add row">＋</span></h3>
      <table class="data-table" id="table-special-supports">
        <thead><tr><th>Node</th><th>Tag</th><th>Type</th><th>Qty</th></tr></thead>
        <tbody>
          ${(state.sticky.specialSupports || SPECIAL_SUPPORTS).map((s, idx) => `<tr>
            <td contenteditable="true" class="editable-field center ss-edit" data-idx="${idx}" data-field="node">${s.node || '—'}</td>
            <td contenteditable="true" class="editable-field ss-edit" data-idx="${idx}" data-field="tag">${s.tag || ''}</td>
            <td contenteditable="true" class="editable-field ss-edit" data-idx="${idx}" data-field="type">${s.type || ''}</td>
            <td class="center editable-field ss-edit" contenteditable="true" data-idx="${idx}" data-field="qty">${s.qty || ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Wire toggle events
  container.querySelectorAll('.scope-toggle').forEach(btn => {
    btn.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      state.scopeToggles[id] = e.target.checked;
      const row = container.querySelector(`.scope-row[data-id="${id}"]`);
      _updateScopeRow(row, e.target.checked);
      emit(RuntimeEvents.SCOPE_CHANGED, { id, value: e.target.checked });
    });
  });

  // Wire simple text edits
  container.querySelectorAll('.editable-field').forEach(f => {
    f.addEventListener('blur', () => {
      const key = f.dataset.key;
      if (key) {
        state.sticky[key] = f.textContent.trim();
        if (key === 'docNo') {
          state.sticky.docNoInitialized = true;
          f.classList.remove('uninitialized');
          emit(RuntimeEvents.DOCNO_CHANGED, state.sticky.docNo);
        }
        import('../core/state.js').then(m => m.saveStickyState());
      }
    });
  });
  
  // Notes color logic
  const notesList = container.querySelector('#notes-list');
  if (notesList) {
    notesList.addEventListener('input', () => {
       if (!state.sticky.notesInitialized) {
         state.sticky.notesInitialized = true;
         notesList.classList.remove('uninitialized');
         import('../core/state.js').then(m => m.saveStickyState());
       }
    });
  }

  // List edits
  container.querySelectorAll('.list-edit').forEach(li => {
    li.addEventListener('blur', () => {
      const key = li.dataset.key;
      const idx = li.dataset.idx;
      if (key && idx !== undefined) {
         if (!state.sticky[key] || state.sticky[key].length === 0) {
            // copy defaults if this is the first edit
            const defaults = key === 'references' ? REFERENCES : [...ASSUMPTIONS, ...NOTES];
            state.sticky[key] = defaults.map(d => typeof d === 'object'? `<span class="mono">${d.docNo}</span> - ${d.title}` : d);
         }
         state.sticky[key][idx] = li.innerHTML.trim();
         import('../core/state.js').then(m => m.saveStickyState());
      }
    });
  });

  // Special Support edits
  container.querySelectorAll('.ss-edit').forEach(td => {
    td.addEventListener('blur', () => {
      const idx = td.dataset.idx;
      const field = td.dataset.field;
      if (idx !== undefined && field) {
        if (!state.sticky.specialSupports) {
          state.sticky.specialSupports = JSON.parse(JSON.stringify(SPECIAL_SUPPORTS));
        }
        state.sticky.specialSupports[idx][field] = td.textContent.trim();
        import('../core/state.js').then(m => m.saveStickyState());
      }
    });
  });

  // Add row buttons
  container.querySelectorAll('.add-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target === 'specialSupports') {
         if (!state.sticky.specialSupports) {
             state.sticky.specialSupports = JSON.parse(JSON.stringify(SPECIAL_SUPPORTS));
         }
         state.sticky.specialSupports.push({ node: '', tag: '', type: '', qty: '' });
      } else {
         if (!state.sticky[target]) {
             const defaults = target === 'references' ? REFERENCES : [...ASSUMPTIONS, ...NOTES];
             state.sticky[target] = defaults.map(d => typeof d === 'object'? `<span class="mono">${d.docNo}</span> - ${d.title}` : d);
         }
         state.sticky[target].push('New item...');
      }
      import('../core/state.js').then(m => m.saveStickyState());
      // Re-render tab
      import('../core/app.js').then(m => m.goToTab('summary'));
    });
  });

  renderTableToggles(container);
}

function _scopeRow(item, checked) {
  const parsed = state.parsed;
  let dynamicConclusion = item.conclusion;
  let statusBadge = '<span class="badge-pass" contenteditable="false">✓</span>';
  let isComputed = false;

  if (parsed && checked) {
    if (item.id === 'code') {
      if (parsed.stresses?.length) {
        isComputed = true;
        const failedStresses = parsed.stresses.filter(s => s.status === 'FAIL' && !s.loadCase.toUpperCase().includes('HYD'));
        if (failedStresses.length > 0) {
          dynamicConclusion = `CODE STRESS EXCEEDED AT ${failedStresses.length} NODE(S)`;
          statusBadge = '<span class="badge-fail" contenteditable="false">✗</span>';
        } else {
          dynamicConclusion = 'STRESSES WITHIN CODE ALLOWABLE LIMITS';
        }
      } else {
        dynamicConclusion = '';
        statusBadge = '';
      }
    } else if (item.id === 'hydro') {
      if (parsed.stresses?.length) {
        isComputed = true;
        const hydroStresses = parsed.stresses.filter(s => s.loadCase.toUpperCase().includes('HYD'));
        if (hydroStresses.length === 0) {
          dynamicConclusion = 'NO HYDRO TEST CASES FOUND';
          statusBadge = '<span class="badge-warn" contenteditable="false">!</span>';
        } else {
           const failedHydro = hydroStresses.filter(s => s.status === 'FAIL');
           if (failedHydro.length > 0) {
              dynamicConclusion = `HYDRO TEST STRESS EXCEEDED AT ${failedHydro.length} NODE(S)`;
              statusBadge = '<span class="badge-fail" contenteditable="false">✗</span>';
           } else {
              dynamicConclusion = 'HYDRO TEST STRESS WITHIN LIMITS';
           }
        }
      } else {
        dynamicConclusion = '';
        statusBadge = '';
      }
    } else if (item.id === 'flange') {
       if (parsed.flanges?.length) {
         isComputed = true;
         const failedFlanges = parsed.flanges.filter(f => f.status === 'FAIL');
         if (failedFlanges.length > 0) {
             dynamicConclusion = `FLANGE LEAKAGE CHECK FAILED AT ${failedFlanges.length} NODE(S)`;
             statusBadge = '<span class="badge-fail" contenteditable="false">✗</span>';
         } else {
             dynamicConclusion = 'FLANGE LEAKAGE CHECK PASSED';
         }
       } else {
         dynamicConclusion = '';
         statusBadge = '';
       }
    } else if (item.id === 'support') {
       if (parsed.displacements?.length) {
         isComputed = true;
         const limit = 10; // 10mm hard limit for now
         const overDeflected = parsed.displacements.filter(d => Math.abs(d.dy || 0) > limit || Math.abs(d.dx || 0) > limit || Math.abs(d.dz || 0) > limit);
         if (overDeflected.length > 0) {
             dynamicConclusion = `DEFLECTIONS EXCEED ${limit}MM LIMIT`;
             statusBadge = '<span class="badge-warn" contenteditable="false">!</span>';
         } else {
             dynamicConclusion = 'SUSTAINED SAG WITHIN THE LIMIT';
         }
       } else {
         dynamicConclusion = '';
         statusBadge = '';
       }
    }
  }

  const finalConclusion = state.sticky['scope_'+item.id] !== undefined ? state.sticky['scope_'+item.id] : dynamicConclusion;

  // Don't show the arrow if conclusion is empty
  const arrow = finalConclusion ? '&rarr;' : '';

  return `
    <div class="scope-row" data-id="${item.id}">
      <label class="toggle-label">
        <input type="checkbox" class="scope-toggle" data-id="${item.id}" ${checked ? 'checked' : ''}>
        <span class="toggle-track"></span>
      </label>
      <span class="scope-label">${item.label} ${isComputed ? '<span class="badge badge-ok" style="font-size:0.6em; padding:1px 4px; margin-left:4px;">COMPUTED</span>' : ''}</span>
      <span class="scope-conclusion editable-field ${checked ? 'visible' : 'hidden'}" contenteditable="true" spellcheck="false" data-key="scope_${item.id}">
        ${arrow} ${finalConclusion} ${statusBadge}
      </span>
    </div>
  `;
}

function _updateScopeRow(row, checked) {
  const conc = row.querySelector('.scope-conclusion');
  if (checked) {
    conc.classList.remove('hidden');
    conc.classList.add('visible');
  } else {
    conc.classList.remove('visible');
    conc.classList.add('hidden');
  }
}
