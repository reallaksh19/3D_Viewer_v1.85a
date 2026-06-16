/**
 * stress-tab.js — Stress compliance and displacement summary.
 */

import { STRESS_TABLE, DISPLACEMENT_TABLE } from '../data/report-data.js';
import { fmt, fmtPct, fmtSigned, fmtNode, prettyUnit, unitSuffix } from '../utils/formatter.js?v=20260610-format-1';
import { renderTableToggles } from '../utils/table-toggle.js';
import { state } from '../core/state.js';

export function renderStress(container) {
  const parsed = state.parsed;

  const stressRows = _getStressSummary(parsed);
  const displacementRows = _getDisplacementSummary(parsed);
  const stressUnit = prettyUnit(parsed?.units?.stress);
  const dispUnit = prettyUnit(parsed?.units?.displacement);

  container.innerHTML = `
    <div class="report-section" id="section-stress">
      <h3 class="section-heading">Stress Compliance Summary</h3>
      <table class="data-table stress-table">
        <thead>
          <tr>
            <th>Load Case</th>
            <th>Critical Node</th>
            <th>Calculated${unitSuffix(parsed?.units?.stress)}</th>
            <th>Allowable${unitSuffix(parsed?.units?.stress)}</th>
            <th>Ratio</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${stressRows.length ? stressRows.map(row => `
            <tr>
              <td>${row.loadCase}</td>
              <td class="mono">${fmtNode(row.node)}</td>
              <td class="mono">${fmt(row.calc, 2)}</td>
              <td class="mono">${row.allow !== null ? fmt(row.allow, 2) : 'N/A'}</td>
              <td>
                <div class="ratio-wrap">
                  <div class="ratio-bar" style="--ratio:${row.ratio}%"></div>
                  <span class="ratio-text">${fmtPct(row.ratio)}</span>
                </div>
              </td>
              <td><span class="badge-${row.status === 'PASS' ? 'pass' : 'fail'}">${row.status === 'PASS' ? '✓ OK' : '✗ FAIL'}</span></td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="muted">No stress summary available.</td></tr>'}
        </tbody>
      </table>

      <h3 class="section-heading" style="margin-top:2rem">Displacement Summary</h3>
      <table class="data-table disp-table">
        <thead>
          <tr>
            <th>Load Case</th>
            <th>Critical Node</th>
            <th>Peak Component</th>
            <th>Peak Value${unitSuffix(parsed?.units?.displacement)}</th>
            <th>DX${unitSuffix(parsed?.units?.displacement)}</th>
            <th>DY${unitSuffix(parsed?.units?.displacement)}</th>
            <th>DZ${unitSuffix(parsed?.units?.displacement)}</th>
          </tr>
        </thead>
        <tbody>
          ${displacementRows.length ? displacementRows.map(row => `
            <tr>
              <td>${row.loadCase}</td>
              <td class="mono">${fmtNode(row.node)}</td>
              <td class="mono">${row.component || '—'}</td>
              <td class="mono">${fmt(row.magnitude, 2)}</td>
              <td class="mono">${fmtSigned(row.dx, 2)}</td>
              <td class="mono">${fmtSigned(row.dy, 2)}</td>
              <td class="mono">${fmtSigned(row.dz, 2)}</td>
            </tr>
          `).join('') : '<tr><td colspan="7" class="muted">No displacement summary available.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  renderTableToggles(container);
}

function _getStressSummary(parsed) {
  const rows = parsed?.stresses ?? [];
  if (!rows.length) return STRESS_TABLE;
  if (parsed?.stressDetails?.length) return rows;
  const byCase = new Map();
  for (const row of rows) {
    const key = String(row.loadCase ?? 'Case').trim();
    const current = byCase.get(key);
    if (!current || (row.ratio ?? -Infinity) >= (current.ratio ?? -Infinity)) {
      byCase.set(key, { ...row });
    }
  }
  return [...byCase.values()].sort((a, b) => b.ratio - a.ratio);
}

function _getDisplacementSummary(parsed) {
  const rows = parsed?.displacements ?? [];
  if (!rows.length) return DISPLACEMENT_TABLE.map(row => ({
    ...row,
    magnitude: Math.max(Math.abs(row.dx || 0), Math.abs(row.dy || 0), Math.abs(row.dz || 0)),
    component: Math.abs(row.dy || 0) >= Math.abs(row.dx || 0) && Math.abs(row.dy || 0) >= Math.abs(row.dz || 0)
      ? 'DY'
      : Math.abs(row.dx || 0) >= Math.abs(row.dz || 0)
        ? 'DX'
        : 'DZ',
  }));
  if (parsed?.displacementDetails?.length) return rows;
  const byCase = new Map();
  for (const row of rows) {
    const key = String(row.loadCase ?? 'Case').trim();
    const mag = Math.max(Math.abs(row.dx || 0), Math.abs(row.dy || 0), Math.abs(row.dz || 0));
    const current = byCase.get(key);
    if (!current || mag >= (current.magnitude ?? -Infinity)) {
      byCase.set(key, {
        ...row,
        magnitude: mag,
        component: Math.abs(row.dy || 0) >= Math.abs(row.dx || 0) && Math.abs(row.dy || 0) >= Math.abs(row.dz || 0)
          ? 'DY'
          : Math.abs(row.dx || 0) >= Math.abs(row.dz || 0)
            ? 'DX'
            : 'DZ',
      });
    }
  }
  return [...byCase.values()].sort((a, b) => b.magnitude - a.magnitude);
}