import { RuntimeEvents } from '../contracts/runtime-events.js';
/**
 * debug-tab.js — Rich parser log, report population summary, computation details,
 *                validation errors, and raw parsed JSON viewer.
 */

import { state } from '../core/state.js';
import { on } from '../core/event-bus.js';
import { prettyUnit, unitSuffix } from '../utils/formatter.js';
import { buildUniversalCSV, normalizeToPCF, buildPcfFromContinuity } from '../utils/accdb-to-pcf.js';
import { calcHistory } from '../calc/core/calc-session.js';

let _listenersRegistered = false;

export function renderDebug(container) {
  if (!_listenersRegistered) {
    on('parse-complete', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'debug' && c) _render(c);
    });
    on('file-loaded', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'debug' && c) _render(c);
    });
    _listenersRegistered = true;
  }
  _render(container);
}

function _render(container) {
  const log    = state.log    ?? [];
  const errors = state.errors ?? [];
  const parsed = state.parsed;
  const units = parsed?.units ?? {};
  const lenUnit = prettyUnit(units.length);
  const tempUnit = prettyUnit(units.temperature);
  const pressUnit = prettyUnit(units.pressure);
  const stressUnit = prettyUnit(units.stress);
  const dispUnit = prettyUnit(units.displacement);
  const forceUnit = prettyUnit(units.force);
  const momentUnit = prettyUnit(units.moment);
  const densityUnit = prettyUnit(units.density);

  let csvRows = [];
  let pcfSegments = [];
  if (parsed) {
      csvRows = buildUniversalCSV(parsed, { supportMappings: state.sticky?.supportMappings || [] });
      pcfSegments = normalizeToPCF(csvRows, { method: 'ContEngineMethod' });
  }
  const stage1Columns = _orderedStage1Columns(csvRows);
  const stage1Initial = _renderTableRows(csvRows, stage1Columns);
  const stage2Rows = _buildStage2DebugRows(pcfSegments);
  const stage2Columns = _orderedStage2Columns(stage2Rows);
  const stage2Initial = _renderStage2Rows(stage2Rows, stage2Columns, { component: 'ALL', query: '' });
  const pcfText = pcfSegments.length ? buildPcfFromContinuity(pcfSegments, { sourceName: state.fileName || 'export' }) : '';

  container.innerHTML = `
    <div class="report-section debug-tab" id="section-debug">
      <h3 class="section-heading">Debug — Parser &amp; Report Population</h3>

      ${parsed ? _reportSummaryCard(parsed) : _noFileCard()}
      ${parsed ? _staleApprovalCard(parsed) : ''}

      <!-- Parser Log -->
      <div class="debug-section-header">
        <h4 class="sub-heading" style="margin:0">Parser Log
          <span class="badge badge-neutral">${log.length} entries</span>
        </h4>
        <label class="debug-filter-label">Filter:
          <select id="log-filter">
            <option value="ALL">ALL</option>
            <option value="OK">OK</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </label>
      </div>
      <div class="log-box" id="log-box">
        ${log.length
          ? log.map(e => `<div class="log-entry log-${(e.level||'INFO').toLowerCase()}">
              <span class="log-level">[${e.level ?? 'INFO'}]</span>
              <span class="log-msg">${_esc(e.msg ?? '')}</span>
            </div>`).join('')
          : '<div class="log-entry log-info"><span class="log-level">[INFO]</span><span class="log-msg">No file loaded yet.</span></div>'
        }
      </div>

      <!-- Validation Errors -->
      <h4 class="sub-heading" style="margin-top:1.5rem">Validation Errors / Warnings
        <span class="badge ${errors.length ? 'badge-error' : 'badge-ok'}">${errors.length || 'none'}</span>
      </h4>
      <div class="log-box">
        ${errors.length
          ? errors.map(e => `<div class="log-entry log-${(e.level||'ERROR').toLowerCase()}">
              <span class="log-level">[${e.level ?? 'ERROR'}]</span>
              <span class="log-msg">${_esc(e.msg ?? '')}</span>
            </div>`).join('')
          : '<div class="log-entry log-ok"><span class="log-level">[OK]</span><span class="log-msg">No validation errors or warnings — file parsed cleanly.</span></div>'
        }
      </div>

      <!-- Calc History (Misc Calc/Slug) -->
      <h4 class="sub-heading" style="margin-top:1.5rem">Calculation Trace History
        <span class="badge badge-neutral">${calcHistory.length} runs</span>
      </h4>
      <div class="table-scroll">
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th>Timestamp</th><th>Calculator</th><th>Mode</th><th>Status</th><th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            ${calcHistory.length ? calcHistory.map((h, idx) => {
              const runIdx = calcHistory.length - 1 - idx;
              return `<tr style="cursor:pointer;" class="calc-history-row" data-idx="${runIdx}">
                <td>${h.ts.toLocaleTimeString()}</td>
                <td>${h.metadata.name}</td>
                <td>${h.metadata.unitMode}</td>
                <td><span style="color:${h.pass ? 'green' : 'red'}">${h.pass ? 'PASS' : 'FAIL'}</span></td>
                <td>${h.warnings.length}</td>
              </tr>
              <tr id="calc-history-detail-${runIdx}" style="display:none; background:#0d1117;">
                <td colspan="5">
                  <div style="padding:10px; font-family:monospace; font-size:11px;">
                    ${h.inputResolution ? `<strong style="color:#ce9178;">[Input Resolution]</strong><pre style="margin:0; color:#9cdcfe;">${JSON.stringify(h.inputResolution, null, 2)}</pre>` : ''}
                    <strong style="color:#ce9178;">[Equation Trace]</strong>
                    ${h.steps.map((s, i) => `<div>${i+1}. ${s}</div>`).join('')}
                    <strong style="color:#ce9178; display:block; margin-top:5px;">[Intermediate Values]</strong><pre style="margin:0; color:#9cdcfe;">${JSON.stringify(h.intermediateValues, null, 2)}</pre>
                    <strong style="color:#ce9178;">[Outputs]</strong><pre style="margin:0; color:#9cdcfe;">${JSON.stringify(h.outputs, null, 2)}</pre>
                    ${h.benchmark ? `<strong style="color:#ce9178;">[Benchmark]</strong><pre style="margin:0; color:#9cdcfe;">${JSON.stringify(h.benchmark, null, 2)}</pre>` : ''}
                    ${h.sourceSnapshot ? `<strong style="color:#ce9178;">[Source Snapshot]</strong><pre style="margin:0; color:#9cdcfe;">${JSON.stringify(h.sourceSnapshot, null, 2)}</pre>` : ''}
                  </div>
                </td>
              </tr>`;
            }).reverse().join('') : '<tr><td colspan="5" class="center muted">No calculations executed.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Computation Details -->
      ${parsed ? _computationDetails(parsed, units) : ''}

      <!-- Elements Data Table (Stage 0) -->
      ${parsed ? `
        <div class="debug-controls" style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:flex-end;">
          <h4 class="sub-heading" style="margin:0;">Stage 0: Raw Elements Datatable (${parsed.elements?.length ?? 0} rows)</h4>
          <button id="dt-update-btn" class="btn-primary">Sync Geometry & Update State</button>
        </div>
        <div style="overflow-x:auto; margin-top:10px; max-height:400px; overflow-y:auto;">
          <table class="data-table" id="debug-elements-table" style="min-width: 1200px; font-size: 11px;">
            <thead>
              <tr>
                <th>Index</th>
                <th>From</th>
                <th>To</th>
                <th>DX (${dispUnit})</th>
                <th>DY (${lenUnit})</th>
                <th>DZ (${lenUnit})</th>
                <th>OD (${lenUnit})</th>
                <th>Wall (${lenUnit})</th>
                <th>T1${unitSuffix(units.temperature)}</th>
                <th>T2${unitSuffix(units.temperature)}</th>
                <th>P1${unitSuffix(units.pressure)}</th>
                <th>Material</th>
              </tr>
            </thead>
            <tbody>
              ${(parsed.elements || []).map((el, i) => `
                <tr data-index="${i}">
                  <td class="mono muted">${i}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="from">${el.from ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="to">${el.to ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="dx">${el.dx ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="dy">${el.dy ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="dz">${el.dz ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="od">${el.od ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="wall">${el.wall ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="T1">${el.T1 ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="T2">${el.T2 ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="P1">${el.P1 ?? ''}</td>
                  <td contenteditable="true" class="editable-field mono" data-col="material">${el.material ?? ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h4 class="sub-heading" style="margin-top:2rem;">Stage 1: Universal CSV Data (${csvRows.length} rows)</h4>
        <div style="overflow-x:auto; margin-top:10px; max-height:400px; overflow-y:auto;">
          <table class="data-table" style="min-width: 2000px; font-size: 11px;">
            <thead>
              <tr>
                ${stage1Columns.map(k => `<th>${k}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${stage1Initial}
            </tbody>
          </table>
        </div>

        <h4 class="sub-heading" style="margin-top:2rem;">Stage 2: Final PCF Data Table (${pcfSegments.length} rows)</h4>
        <div class="debug-controls" style="margin-top:0.5rem; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <label class="debug-filter-label">Component:
            <select id="stage2-component-filter">
              <option value="ALL">ALL</option>
              <option value="SUPPORT">SUPPORT</option>
            </select>
          </label>
          <label class="debug-filter-label">Find:
            <input id="stage2-search" type="text" placeholder="SUPPORT_NAME / SUPPORT_TAG / REF_NO">
          </label>
          <span class="badge badge-neutral" id="stage2-row-count">${stage2Initial.count} / ${stage2Rows.length}</span>
        </div>
        <div style="overflow-x:auto; margin-top:10px; max-height:400px; overflow-y:auto;">
          <table class="data-table" id="debug-stage2-table" style="min-width: 2200px; font-size: 11px;">
            <thead>
              <tr>
                ${stage2Columns.map(k => `<th>${k}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="debug-stage2-body">
              ${stage2Initial.html}
            </tbody>
          </table>
        </div>

        <h4 class="sub-heading" style="margin-top:2rem;">Stage 3: ContEngineMethod PCF (CRLF)</h4>
        <textarea class="mono" style="width:100%;min-height:220px;">${_esc(pcfText)}</textarea>
      ` : '<p class="tab-note">Load a file to see parsed datatable.</p>'}

    </div>
  `;

  // Wire log filter
  container.querySelector('#log-filter')?.addEventListener('change', e => {
    const filter = e.target.value;
    container.querySelectorAll('#log-box .log-entry').forEach(el => {
      const level = [...el.classList].find(c => c.startsWith('log-'))?.replace('log-', '').toUpperCase();
      el.style.display = (filter === 'ALL' || level === filter) ? '' : 'none';
    });
  });

  // Wire Data Table Update button
  container.querySelector('#dt-update-btn')?.addEventListener('click', () => {
    if (!parsed || !parsed.elements) return;

    const rows = container.querySelectorAll('#debug-elements-table tbody tr');
    let hasChanges = false;

    rows.forEach(tr => {
      const idx = parseInt(tr.dataset.index, 10);
      const el = parsed.elements[idx];
      if (!el) return;

      tr.querySelectorAll('td[data-col]').forEach(td => {
        const col = td.dataset.col;
        const valStr = td.textContent.trim();

        if (col === 'material' || col === 'from' || col === 'to') {
            const parsedVal = valStr === '' ? undefined : (col === 'material' ? valStr : parseInt(valStr, 10));
            if (el[col] !== parsedVal) {
                el[col] = parsedVal;
                hasChanges = true;
            }
        } else {
            const num = parseFloat(valStr);
            const parsedVal = isNaN(num) ? undefined : num;
            if (el[col] !== parsedVal) {
                el[col] = parsedVal;
                hasChanges = true;
            }
        }
      });
    });

    // Flash success
    const btn = container.querySelector('#dt-update-btn');
    const oldText = btn.textContent;
    btn.textContent = '✓ Saved & Synced';
    btn.style.background = 'var(--color-pass)';
    setTimeout(() => {
      btn.textContent = oldText;
      btn.style.background = '';
    }, 1500);

    // Trigger re-renders if elements changed
    if (hasChanges) {
        import('../core/event-bus.js').then(({ emit }) => {
          emit(RuntimeEvents.PARSE_COMPLETE, parsed);
        });
    }
  });

  // Wire Calc History expanding rows
  container.querySelectorAll('.calc-history-row').forEach(row => {
      row.addEventListener('click', () => {
          const idx = row.getAttribute('data-idx');
          const detailRow = container.querySelector(`#calc-history-detail-${idx}`);
          if (detailRow) {
              detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
          }
      });
  });

  // Wire Stage 2 filters
  const stage2Comp = container.querySelector('#stage2-component-filter');
  const stage2Search = container.querySelector('#stage2-search');
  const stage2Body = container.querySelector('#debug-stage2-body');
  const stage2Count = container.querySelector('#stage2-row-count');

  const applyStage2Filters = () => {
    if (!stage2Body || !stage2Count) return;
    const component = stage2Comp?.value || 'ALL';
    const query = stage2Search?.value || '';
    const result = _renderStage2Rows(stage2Rows, stage2Columns, { component, query });
    stage2Body.innerHTML = result.html;
    stage2Count.textContent = `${result.count} / ${stage2Rows.length}`;
  };

  stage2Comp?.addEventListener('change', applyStage2Filters);
  stage2Search?.addEventListener('input', applyStage2Filters);
}

// ── Report population summary card ────────────────────────────────────────────

function _noFileCard() {
  return `
    <div class="debug-summary-card debug-empty">
      <span class="debug-empty-icon">📂</span>
      <span>No file loaded — drag &amp; drop an .ACCDB file or use the <strong>Input Data</strong> tab to load one.</span>
    </div>`;
}

function _reportSummaryCard(parsed) {
  const elCount  = parsed.elements?.length  ?? 0;
  const ndCount  = Object.keys(parsed.nodes ?? {}).length;
  const bdCount  = parsed.bends?.length     ?? 0;
  const rsCount  = parsed.restraints?.length ?? 0;
  const foCount  = parsed.forces?.length    ?? 0;
  const riCount  = parsed.rigids?.length    ?? 0;
  const fmt      = parsed.format ?? '—';
  const fileName = state.fileName ?? '—';
  const valStatus = parsed.validation?.status ?? 'OK';
  const valSummary = parsed.validation?.summary ?? '';
  const hasStressSummary = (parsed.stressDetails?.length ?? 0) > 0;
  const hasDispSummary = (parsed.displacementDetails?.length ?? 0) > 0;

  const rows = [
    { tab: 'Input Data',   section: 'Pipe Properties table',    source: 'PARSED',  count: elCount,  ok: elCount > 0,  detail: `${elCount} element(s) from ${fmt === 'XML' ? '<PIPINGELEMENT>' : '#$ ELEMENTS'} section` },
    { tab: 'Input Data',   section: 'Applied Loads picker',     source: 'PARSED',  count: foCount,  ok: true,         detail: foCount > 0 ? `${foCount} node(s) from ${fmt === 'XML' ? 'XML FORCES' : '#$ FORCMNT'} section` : 'No force/moment loads in file' },
    { tab: 'Input Data',   section: 'Basis — Heaviest Rigid',   source: 'PARSED',  count: riCount,  ok: true,         detail: riCount > 0 ? `${riCount} rigid(s) from ${fmt === 'XML' ? '<RIGID>' : '#$ RIGID'} section` : 'No rigid elements in file' },
    { tab: 'Input Data',   section: 'Basis — Longest Span',     source: 'PARSED',  count: elCount,  ok: elCount > 0,  detail: `Computed as max(√(dx²+dy²+dz²)) across ${elCount} elements` },
    { tab: 'Input Data',   section: 'Basis — Max Stress/Disp',  source: 'STATIC',  count: null,     ok: true,         detail: 'From static PDF report data (report-data.js)' },
    { tab: 'Geometry',     section: '3D Isometric Viewport',    source: 'PARSED',  count: ndCount,  ok: elCount > 0,  detail: `${ndCount} nodes, ${bdCount} bends, ${rsCount} restraint(s) — Three.js OrthographicCamera at (1,1,1)` },
    { tab: 'Stress',       section: 'Stress Compliance table',  source: hasStressSummary ? 'PARSED' : 'STATIC',  count: parsed.stresses?.length ?? 0,     ok: true,         detail: hasStressSummary ? 'Summarized from ACCDB stress output rows' : 'From static PDF report data (STRESS_TABLE in report-data.js)' },
    { tab: 'Stress',       section: 'Displacement table',       source: hasDispSummary ? 'PARSED' : 'STATIC',  count: parsed.displacements?.length ?? 0,     ok: true,         detail: hasDispSummary ? 'Summarized from ACCDB displacement output rows' : 'From static PDF report data (DISPLACEMENT_TABLE in report-data.js)' },
    { tab: 'Supports',     section: 'Special Supports list',    source: 'STATIC',  count: null,     ok: true,         detail: 'From static PDF report data (SPECIAL_SUPPORTS in report-data.js)' },
    { tab: 'Nozzle',       section: 'Nozzle Loads table',       source: 'STATIC',  count: null,     ok: true,         detail: 'From static PDF report data (NOZZLE_LOADS in report-data.js)' },
    { tab: 'Flanges',      section: 'Flange Leakage check',     source: 'STATIC',  count: null,     ok: true,         detail: 'From static PDF report data (FLANGE_DATA in report-data.js)' },
    { tab: 'Summary',      section: 'Scope toggles + conclusions', source: 'STATIC', count: null,   ok: true,         detail: 'From static PDF report data (SCOPE_ITEMS in report-data.js)' },
    { tab: 'Summary',      section: 'Design parameters block',  source: 'STATIC',  count: null,     ok: true,         detail: 'From static PDF report data (DESIGN_PARAMS in report-data.js)' },
  ];

  const statusClass = { OK: 'badge-ok', WARN: 'badge-warn', ERROR: 'badge-error', INFO: 'badge-neutral' }[valStatus] ?? 'badge-neutral';

  return `
    <div class="debug-summary-card">
      <div class="debug-summary-header">
        <div>
          <strong>${_esc(fileName)}</strong>
          <span class="badge badge-neutral" style="margin-left:0.5rem">${fmt}</span>
          <span class="badge ${statusClass}" style="margin-left:0.25rem">${valStatus}: ${_esc(valSummary)}</span>
        </div>
        <div class="debug-summary-counts">
          ${_countBadge(elCount, 'elements')}
          ${_countBadge(ndCount, 'nodes')}
          ${bdCount ? _countBadge(bdCount, 'bends') : ''}
          ${rsCount ? _countBadge(rsCount, 'restraints') : ''}
          ${foCount ? _countBadge(foCount, 'force nodes') : ''}
          ${riCount ? _countBadge(riCount, 'rigids') : ''}
        </div>
      </div>

      <h4 class="sub-heading" style="margin:1rem 0 0.5rem">Report Tab Population</h4>
      <table class="data-table debug-pop-table">
        <thead>
          <tr>
            <th>Tab</th>
            <th>Section</th>
            <th>Source</th>
            <th>Status</th>
            <th>How it was computed / where it came from</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><span class="debug-tab-badge">${r.tab}</span></td>
              <td>${r.section}</td>
              <td><span class="badge ${r.source === 'PARSED' ? 'badge-parsed' : 'badge-static'}">${r.source}</span></td>
              <td>${r.ok
                ? '<span class="status-ok-inline">✓ OK</span>'
                : '<span class="status-warn-inline">⚠ empty</span>'
              }</td>
              <td class="debug-detail">${r.detail}${r.count !== null ? ` <span class="muted">(${r.count})</span>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function _staleApprovalCard(parsed) {
  const stale = parsed.staleValues ?? [];
  if (!stale.length) {
    return `
      <div class="debug-summary-card" style="margin-top:1rem">
        <strong>Stale values / approvals</strong>
        <div class="tab-note" style="margin-top:0.25rem">No inherited or defaulted ACCDB values were detected.</div>
      </div>`;
  }

  return `
    <div class="debug-summary-card" style="margin-top:1rem">
      <div class="debug-summary-header">
        <div><strong>Stale values / approvals</strong></div>
        <div class="debug-summary-counts">
          <span class="badge badge-warn"><strong>${stale.length}</strong> field group(s)</span>
        </div>
      </div>
      <table class="data-table debug-pop-table" style="margin-top:0.75rem">
        <thead>
          <tr>
            <th>Field</th>
            <th>Source</th>
            <th>Count</th>
            <th>Sample</th>
            <th>Value</th>
            <th>Approval</th>
          </tr>
        </thead>
        <tbody>
          ${stale.map(row => `
            <tr>
              <td class="mono">${_esc(row.field)}</td>
              <td>${_esc(row.source)}</td>
              <td class="mono">${row.count}</td>
              <td class="mono">${_esc((row.samples || []).join(', '))}</td>
              <td class="mono">${_esc(String(row.value ?? '?'))}</td>
              <td><span class="badge badge-warn">PENDING</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="tab-note" style="margin-top:0.5rem">Review these inherited/default values before accepting them into the report.</div>
    </div>`;
}

// ── Computation details panel ──────────────────────────────────────────────────

function _computationDetails(parsed, units = {}) {
  const fmt = parsed.format ?? 'NEUTRAL';
  const els = parsed.elements ?? [];
  const lenUnit = prettyUnit(units.length);

  if (!els.length) return '';

  const sample = els[0];
  const sampleProps = fmt === 'XML'
    ? [
        ['FROM_NODE attribute',     sample.from,     'Node number'],
        ['TO_NODE attribute',       sample.to,       'Node number'],
        ['DELTA_X / Y / Z',         `${sample.dx?.toFixed(1)}, ${sample.dy?.toFixed(1)}, ${sample.dz?.toFixed(1)}`, `Run vector (${lenUnit})`],
        ['DIAMETER attribute',      sample.od?.toFixed(3), `Outer diameter${unitSuffix(units.length)}`],
        ['WALL_THICK attribute',    sample.wall?.toFixed(3), `Wall thickness${unitSuffix(units.length)}`],
        ['INSUL_THICK attribute',   sample.insul?.toFixed(1), `Insulation${unitSuffix(units.length)}`],
        ['TEMP_EXP_C1 (T1)',        sample.T1?.toFixed(1), `T1 - operating temperature${unitSuffix(units.temperature)}`],
        ['PRESSURE1 (P1)',          sample.P1?.toFixed(2), `P1${unitSuffix(units.pressure)}`],
        ['PRESSURE2 (P2)',          sample.P2?.toFixed(2), `P2${unitSuffix(units.pressure)}`],
        ['PIPE_DENSITY',            sample.density !== undefined && sample.density !== null ? String(sample.density) : '-', `Density${unitSuffix(units.density)}`],
        ['MATERIAL_NAME',           sample.material || 'CS (default)', ''],
        ['Sentinel ?1.0101',        'if |val ? (?1.0101)| < 0.001', 'treated as not set; fallback used'],
      ]
    : [
        ['Row 1, col 0',    sample.from,     'FROM node ID (integer, 1?99999)'],
        ['Row 1, col 1',    sample.to,       'TO node ID'],
        ['Row 1, cols 2-4', `${sample.dx?.toFixed(1)}, ${sample.dy?.toFixed(1)}, ${sample.dz?.toFixed(1)}`, `DX, DY, DZ${unitSuffix(units.length)}`],
        ['Row 1, col 5',    sample.od?.toFixed(3), `OD${unitSuffix(units.length)} - must be > 10 to pass isElemRow()`],
        ['Row 2, col 0',    sample.wall?.toFixed(3), `Wall thickness${unitSuffix(units.length)}`],
        ['Row 2, col 1',    sample.insul?.toFixed(1), `Insulation${unitSuffix(units.length)}`],
        ['Row 2, col 3',    sample.T1?.toFixed(1), `T1 - operating temperature${unitSuffix(units.temperature)}`],
        ['Row 2, col 4',    sample.T2?.toFixed(1), `T2 - 2nd temperature case${unitSuffix(units.temperature)}`],
        ['Row 4, col 0',    sample.P1?.toFixed(2), `P1 - operating pressure${unitSuffix(units.pressure)}; 9999.99 -> 0`],
        ['Material',        sample.material || 'CS', 'Default CS (A106 Gr. B); neutral file uses material code section, not per-element'],
        ['Density',         sample.density !== undefined && sample.density !== null ? String(sample.density) : '-', `Density${unitSuffix(units.density)}`],
      ];

  const uniqueODs = [...new Set(els.map(e => e.od?.toFixed(1)))].filter(v => parseFloat(v) > 0).sort((a, b) => b - a);
  const T1s = els.map(e => e.T1).filter(Boolean);
  const T2s = els.map(e => e.T2).filter(Boolean);
  const P1s = els.map(e => e.P1).filter(Boolean);
  const P2s = els.map(e => e.P2).filter(Boolean);
  const longestEl = els.reduce((a, b) => (b.length ?? 0) > (a.length ?? 0) ? b : a, els[0]);

  return `
    <h4 class="sub-heading" style="margin-top:1.5rem">Computation Details — First Element (index 0)</h4>
    <p class="tab-note" style="margin-bottom:0.5rem">
      Format: <strong>${fmt}</strong> &nbsp;|&nbsp;
      ${fmt === 'XML'
        ? 'Each <code>&lt;PIPINGELEMENT&gt;</code> XML attribute maps to the fields below.'
        : 'Each element block = Row 1 (geom) + Rows 2–9 (material/temp/press). Rows indexed from <code>props[]</code> array (0-based after Row 1).'}
    </p>
    <table class="data-table debug-prop-table">
      <thead><tr><th>Source field</th><th>Value (element 0)</th><th>Meaning</th></tr></thead>
      <tbody>
        ${sampleProps.map(([src, val, meaning]) => `
          <tr>
            <td class="mono">${_esc(String(src))}</td>
            <td class="mono">${_esc(val === undefined || val === null ? '—' : String(val))}</td>
            <td class="debug-detail">${_esc(meaning)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <h4 class="sub-heading" style="margin-top:1rem">Dataset Summary</h4>
    <table class="data-table debug-prop-table">
      <thead><tr><th>Property</th><th>Values found</th></tr></thead>
      <tbody>
        <tr><td>OD sizes${unitSuffix(units.length)}</td><td class="mono">${uniqueODs.join(', ') || 'NA'}</td></tr>
        <tr><td>T1 range${unitSuffix(units.temperature)}</td><td class="mono">${T1s.length ? Math.min(...T1s).toFixed(0) + ' - ' + Math.max(...T1s).toFixed(0) : 'NA'}</td></tr>
        <tr><td>T2 range${unitSuffix(units.temperature)}</td><td class="mono">${T2s.length ? Math.min(...T2s).toFixed(1) + ' - ' + Math.max(...T2s).toFixed(1) : 'NA'}</td></tr>
        <tr><td>P1 range${unitSuffix(units.pressure)}</td><td class="mono">${P1s.length ? Math.min(...P1s).toFixed(2) + ' - ' + Math.max(...P1s).toFixed(2) : 'NA'}</td></tr>
        <tr><td>P2 range${unitSuffix(units.pressure)}</td><td class="mono">${P2s.length ? Math.min(...P2s).toFixed(2) + ' - ' + Math.max(...P2s).toFixed(2) : 'NA'}</td></tr>
        <tr><td>Longest span</td><td class="mono">${longestEl ? `${longestEl.from} -> ${longestEl.to} = ${longestEl.length?.toFixed(1)}${unitSuffix(units.length)}` : 'NA'}</td></tr>
        <tr><td>Coordinate origin</td><td class="mono">Node ${els[0]?.from ?? '?'} = (0, 0, 0)${unitSuffix(units.length)}</td></tr>
        <tr><td>Node positions</td><td class="mono">Accumulated from cumulative DX/DY/DZ walk</td></tr>
      </tbody>
    </table>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _countBadge(n, label) {
  return `<span class="badge badge-neutral"><strong>${n}</strong> ${label}</span>`;
}

function _buildStage2DebugRows(rows) {
  return (rows || []).map(row => {
    const supportNameInferred = _inferSupportName(row);
    const dbgBlock = _extractBlockCode(row?.SUPPORT_NAME, row?.SUPPORT_TAG) || supportNameInferred || '';
    const dbgExpectedKind = dbgBlock === 'CA100'
      ? 'GDE'
      : (dbgBlock === 'CA150' || dbgBlock === 'CA250')
        ? 'RST'
        : '';
    const actualKind = String(row?.SUPPORT_KIND || '').toUpperCase();
    const dbgKindMatch = dbgExpectedKind
      ? (dbgExpectedKind === actualKind ? 'YES' : 'NO')
      : '';

    return {
      ...row,
      SUPPORT_NAME_INFERRED: supportNameInferred,
      DBG_BLOCK_CODE: dbgBlock,
      DBG_EXPECTED_KIND: dbgExpectedKind,
      DBG_KIND_MATCH: dbgKindMatch,
    };
  });
}

function _orderedStage1Columns(rows) {
  const preferred = [
    'ELEMENTID', 'FROM_NODE', 'TO_NODE',
    'DELTA_X', 'DELTA_Y', 'DELTA_Z',
    'DIAMETER', 'WALL_THICK', 'INSUL_THICK',
    'BEND_PTR', 'REST_PTR', 'RIGID_PTR', 'INT_PTR', 'FLANGE_PTR', 'REDUCER_PTR',
    'RST_NODE_NUM', 'RST_TYPE', 'RST_RAW_TYPE', 'RST_BLOCK', 'RST_KIND', 'RST_DESC', 'RST_FRICTION', 'RST_GAP', 'RST_DOFS', 'RST_AXIS_COSINES',
    'BND_RADIUS', 'BND_ANGLE1', 'BND_NODE1', 'BND_NODE2',
    'T1', 'T2', 'P1', 'P2', 'MATERIAL_NAME',
  ];
  return _orderedColumns(rows, preferred);
}

function _orderedStage2Columns(rows) {
  const compactOrder = [
    'METHOD', 'SEQ_NO', 'COMPONENT_TYPE', 'REF_NO',
    'PIPELINE_REFERENCE', 'FROM_NODE', 'TO_NODE', 'CONTROL_NODE',
    'DELTA_X', 'DELTA_Y', 'DELTA_Z', 'DIAMETER', 'WALL_THICK',
    'MATERIAL', 'T1', 'P1', 'P2',
    'SUPPORT_KIND', 'SUPPORT_NAME_INFERRED', 'SUPPORT_NAME', 'SUPPORT_TAG', 'SUPPORT_DESC',
    'SUPPORT_FRICTION', 'SUPPORT_GAP', 'SUPPORT_DOFS', 'AXIS_COSINES', 'PIPE_AXIS_COSINES',
    'DBG_BLOCK_CODE', 'DBG_EXPECTED_KIND', 'DBG_KIND_MATCH',
  ];
  return _orderedColumns(rows, compactOrder);
}

function _renderStage2Rows(rows, columns, filter = {}) {
  const component = String(filter.component || 'ALL').toUpperCase();
  const query = String(filter.query || '').trim().toUpperCase();

  const filtered = (rows || []).filter(row => {
    if (component === 'SUPPORT' && String(row?.COMPONENT_TYPE || '').toUpperCase() !== 'SUPPORT') return false;
    if (!query) return true;
    const haystack = [row?.SUPPORT_NAME_INFERRED, row?.SUPPORT_NAME, row?.SUPPORT_TAG, row?.REF_NO]
      .map(v => String(v || '').toUpperCase())
      .join(' ');
    return haystack.includes(query);
  });

  if (!filtered.length) {
    return {
      count: 0,
      html: `<tr><td class="center muted" colspan="${columns.length}">No Stage 2 rows match the current filters</td></tr>`,
    };
  }

  const html = filtered.map((row, i) => `
    <tr data-index="${i}">
      ${columns.map(col => `<td class="mono">${_formatStage2Value(row[col])}</td>`).join('')}
    </tr>
  `).join('');

  return { count: filtered.length, html };
}

function _extractBlockCode(name, tag) {
  const merged = `${String(name || '')} ${String(tag || '')}`.toUpperCase();
  const m = merged.match(/\bCA\d+\b/);
  return m ? m[0] : '';
}

function _inferSupportName(row) {
  const name = String(row?.SUPPORT_NAME || '').toUpperCase();
  const tag = String(row?.SUPPORT_TAG || '').toUpperCase();
  const desc = String(row?.SUPPORT_DESC || '').toUpperCase();
  const kind = String(row?.SUPPORT_KIND || '').toUpperCase();
  const block = _extractBlockCode(name, tag);
  if (block) return block;

  const merged = `${name} ${tag} ${desc}`.trim();
  if (kind === 'GDE' || /\bGUI\b|\bGDE\b|GUIDE|SLIDE/.test(merged)) return 'CA100';
  if (kind === 'RST' || /\+Y|REST|ANCHOR/.test(merged)) {
    if (/\bGAP\b|>\s*0/.test(merged)) return 'CA250';
    return 'CA150';
  }
  return '';
}

function _formatStage2Value(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return _esc(JSON.stringify(value));
    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return _esc(`${x}, ${y}, ${z}`);
    }
    return _esc(JSON.stringify(value));
  }
  return _esc(String(value));
}

function _orderedColumns(rows, preferred) {
  const keys = new Set(preferred || []);
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) keys.add(key);
  }
  const ordered = [];
  const seen = new Set();
  for (const key of preferred || []) {
    if (keys.has(key) && !seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  }
  return ordered;
}

function _renderTableRows(rows, columns) {
  return (rows || []).map((row, i) => `
    <tr data-index="${i}">
      ${columns.map(col => `<td class="mono">${_formatStage2Value(row?.[col])}</td>`).join('')}
    </tr>
  `).join('');
}

function _jsonSection(parsed, section) {
  const data = parsed[section];
  if (data === undefined) return '(not available)';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function _esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
