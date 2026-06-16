import { RuntimeEvents } from '../contracts/runtime-events.js';
import { state, updateRvmPcfExtractState } from '../core/state.js';
import { on, off, emit } from '../core/event-bus.js';
import { mountRvmPcfLegacyMasterPanel } from '../rvm-pcf-master-tabs/RvmPcfLegacyMasterPanel.js';
import { normalizeRvmJsonPcfRequestPayload } from './rvm-json-pcf-trigger-helpers.js';

import {
  DEFAULT_RVM_PCF_TOPOLOGY_MODE,
  RVM_PCF_TOPOLOGY_MODES,
  isUxmlTopologyMode,
  normalizeRvmPcfTopologyMode,
  topologyModeLabel,
} from '../rvm-pcf-extract/RvmPcfTopologyModes.js';
import {
  renderRvmUxmlTopologyDiagnosticsHtml,
} from '../rvm-pcf-extract/RvmUxmlTopologyDiagnosticsPanel.js';
import {
  assertRvmPcfExportAllowed,
  evaluateRvmPcfExportGuard,
  formatRvmPcfExportGuardMessage,
} from '../rvm-pcf-extract/RvmPcfExportGuard.js';

let _offExtractRequested = null;
let _offStateChanged = null;

function _uniqueUrls(urls) {
  const out = [];
  const seen = new Set();

  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

function _repoBaseUrl() {
  const base = document.baseURI || window.location.href;
  return base.endsWith('/') ? base : `${base.replace(/[^/]*$/, '')}`;
}

function _rvmPcfModuleCandidates(fileName) {
  const cleanFile = String(fileName || '').replace(/^\/+/, '');

  return _uniqueUrls([
    // Normal source layout when this module is served from /viewer/tabs.
    new URL(`../rvm-pcf-extract/${cleanFile}`, import.meta.url).href,

    // GitHub Pages flattened layout when /viewer contents are published at repo root.
    new URL(`rvm-pcf-extract/${cleanFile}`, _repoBaseUrl()).href,

    // GitHub Pages non-flattened layout.
    new URL(`viewer/rvm-pcf-extract/${cleanFile}`, _repoBaseUrl()).href,
  ]);
}

async function _importRvmPcfModule(fileName) {
  const candidates = _rvmPcfModuleCandidates(fileName);
  const errors = [];

  for (const url of candidates) {
    try {
      return await import(url);
    } catch (err) {
      errors.push({
        url,
        message: err?.message || String(err),
      });
    }
  }

  const detail = errors
    .map(e => `- ${e.url}\n  ${e.message}`)
    .join('\n');

  throw new Error(
    `Failed to dynamically import RVM PCF module "${fileName}". Tried:\n${detail}`
  );
}

function _esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Header ────────────────────────────────────────────────────────────────────

function _updateHeader(container) {
  const sourceLabel = container.querySelector('.rvm-pcf-extract-source-label');
  const scopeLabel  = container.querySelector('.rvm-pcf-extract-scope-label');
  const nodeCount   = container.querySelector('.rvm-pcf-extract-node-count');

  const s   = state.rvmPcfExtract;
  const ids = s.selectedCanonicalIds || [];
  const isSelected = s.scope === 'selected' || ids.length > 0;

  if (sourceLabel) {
    const label = state.rvm?.index?.nodes?.length
      ? `${state.rvm.index.nodes.length} node(s) in model`
      : '(no model loaded)';
    sourceLabel.textContent = `Source: ${label}`;
  }

  if (isSelected) {
    if (scopeLabel) scopeLabel.textContent = `Scope: selected (${ids.length} nodes)`;
    if (nodeCount)  nodeCount.textContent  = `${ids.length} node(s) selected`;
  } else {
    if (scopeLabel) scopeLabel.textContent = 'Scope: full model';
    if (nodeCount)  nodeCount.textContent  = '';
  }
}

function _auditSummaryHtml(report) {
  if (!report) return '<div class="rvm-pcf-extract-status">Run PCF Audit to build the audit summary.</div>';
  const s = report.summary || {};
  const sev = report.bySeverity || {};
  const continuity = state.rvmPcfExtract?.continuityReport || null;
  const kv = [
    ['Topology mode', topologyModeLabel(state.rvmPcfExtract?.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE)],
    ['Audit pass', report.pass ? 'YES' : 'NO'],
    ['Errors', sev.ERROR || 0],
    ['Warnings', sev.WARNING || 0],
    ['Rows', s.rowCount || 0],
    ['Included rows', s.includedRows || 0],
    ['Excluded rows', s.excludedRows || 0],
    ['Missing coordinate rows', s.missingCoordinateRows || 0],
    ['Source CA21 rows', s.rowsWithCa21 || 0],
    ['Rows with converted bore', s.rowsWithConvertedBore || 0],
    ['Line-key bore candidates', s.rowsWithLineKeyBoreCandidate || 0],
    ['PCF pipelines', s.pcfPipelineCount || 0],
    ['Expected download mode', s.expectedDownloadMode || 'single-file'],
    ['Generated origin coordinate lines', s.generatedOriginCoordinateLines || 0],
    ['Generated component attribute lines', s.generatedComponentAttributeLines || 0],
  ];
  if (continuity) {
    kv.push(
      ['Continuity ok', continuity.ok ? 'YES' : 'NO'],
      ['Continuity tolerance (mm)', continuity.toleranceMm || 0],
      ['Continuity max deviation (mm)', continuity.maxDeviationMm || 0],
      ['Continuity fixable', continuity.fixableCount || 0],
      ['Continuity fatal', continuity.fatalCount || 0],
      ['Continuity adjustments', (continuity.adjustments || []).length || 0],
    );
  }
  return `
    <div class="rvm-pcf-extract-status-card">
      ${kv.map(([k, v]) => `<div class="rvm-pcf-status-row"><span class="rvm-pcf-label">${_esc(k)}</span><span>${_esc(v)}</span></div>`).join('')}
    </div>
  `;
}

function _uxmlTopologyDiagnosticsSummaryHtml() {
  const extractState = state.rvmPcfExtract || {};
  const topologyMode = extractState.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE;
  const uxmlTopology = extractState.uxmlTopology || null;
  const readinessGate = extractState.readinessGate || null;
  const diagnostics = extractState.diagnostics || [];

  return renderRvmUxmlTopologyDiagnosticsHtml({
    topologyMode,
    uxmlTopology,
    readinessGate,
    diagnostics,
  });
}

function _topologyModeSettingsHtml(topologyMode) {
  const mode = normalizeRvmPcfTopologyMode(topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE);

  return `
    <div class="rvm-pcf-extract-status-card" style="margin-top:12px;">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Topology mode</span>
        <select data-topology-mode style="max-width:220px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:6px 8px;">
          <option value="${RVM_PCF_TOPOLOGY_MODES.LEGACY}" ${mode === RVM_PCF_TOPOLOGY_MODES.LEGACY ? 'selected' : ''}>
            Legacy — present logic
          </option>
          <option value="${RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY}" ${mode === RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY ? 'selected' : ''}>
            UXML topology — topology only
          </option>
        </select>
      </div>
      <div class="rvm-pcf-extract-status" style="margin-top:6px;">
        UXML mode routes rows/json to UXML only for topology generation/checking.
        Masters and PCF export continue through existing legacy routing.
      </div>
    </div>
  `;
}

function _bindTopologyModeSettings(container) {
  const control = container.querySelector('[data-topology-mode]');
  if (!control) return;

  control.addEventListener('change', () => {
    const topologyMode = normalizeRvmPcfTopologyMode(control.value);

    try { localStorage.setItem('rvm_pcf_topology_mode', topologyMode); } catch {}

    updateRvmPcfExtractState({
      topologyMode,
    }, 'topology-mode-settings');

    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
      action: 'TOPOLOGY_MODE_CHANGED',
      topologyMode,
    });
  });
}

function _continuitySettingsHtml(continuity) {
  return `
    <div class="rvm-pcf-extract-status-card" style="margin-top:12px;">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Continuity tolerance (mm)</span>
        <input type="number" step="0.001" min="0" data-continuity-key="continuityMismatchToleranceMm" value="${_esc(continuity?.continuityMismatchToleranceMm ?? 6)}" style="max-width:140px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:6px 8px;">
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Auto adjust small gaps</span>
        <input type="checkbox" data-continuity-key="continuityAutoAdjustEnabled" ${continuity?.continuityAutoAdjustEnabled === false ? '' : 'checked'}>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Move priority</span>
        <input type="text" data-continuity-key="continuityMovePriority" value="${_esc(continuity?.continuityMovePriority || 'PIPE, FLANGE, VALVE, BEND, TEE')}" style="width:100%;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:6px 8px;">
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Prefer upstream component</span>
        <input type="checkbox" data-continuity-key="preferUpstreamComponent" ${continuity?.preferUpstreamComponent === false ? '' : 'checked'}>
      </div>
    </div>
  `;
}

function _bindContinuitySettings(container) {
  const controls = Array.from(container.querySelectorAll('[data-continuity-key]'));
  if (!controls.length) return;
  controls.forEach((control) => {
    const update = () => {
      const continuity = { ...(state.rvmPcfExtract.continuity || {}) };
      for (const input of controls) {
        const key = input.getAttribute('data-continuity-key');
        if (!key) continue;
        if (input.type === 'checkbox') {
          continuity[key] = !!input.checked;
        } else if (input.type === 'number') {
          continuity[key] = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
        } else {
          continuity[key] = String(input.value ?? '');
        }
      }
      updateRvmPcfExtractState({ continuity }, 'continuity-settings');
    };
    control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', update);
  });
}

function _exportSettingsHtml(singlePcfForMultiLineSelection) {
  return `
    <div class="rvm-pcf-extract-status-card" style="margin-top:12px;">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Single PCF for multi-line selection</span>
        <input type="checkbox" data-export-key="singlePcfForMultiLineSelection" ${singlePcfForMultiLineSelection === false ? '' : 'checked'}>
      </div>
      <div class="rvm-pcf-extract-status" style="margin-top:6px;">
        When selected scope spans multiple lines, collapse rows into one PCF so Tee/Olet continuity stays in one file.
      </div>
    </div>
  `;
}

function _bindExportSettings(container) {
  const control = container.querySelector('[data-export-key="singlePcfForMultiLineSelection"]');
  if (!control) return;
  control.addEventListener('change', () => {
    updateRvmPcfExtractState({
      singlePcfForMultiLineSelection: !!control.checked,
    }, 'export-settings');
  });
}

function _uniquePipelineRefs(rows) {
  const refs = [];
  const seen = new Set();
  for (const row of rows || []) {
    const ref = String(row?.pipelineRef ?? '').trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

function _collapseRowsToSinglePcf(rows) {
  const refs = _uniquePipelineRefs(rows);
  if (refs.length <= 1) {
    return {
      rows,
      collapsed: false,
      pipelineRef: refs[0] || 'RVM-EXTRACT',
      sourcePipelineRefs: refs,
    };
  }

  const pipelineRef = refs[0] || 'RVM-EXTRACT';
  return {
    rows: (rows || []).map(row => ({ ...row, pipelineRef })),
    collapsed: true,
    pipelineRef,
    sourcePipelineRefs: refs,
  };
}

// ── Panel renderer ────────────────────────────────────────────────────────────

function _showPanel(container, panelId) {
  const host = container.querySelector('#rvm-pcf-extract-panel-host');
  if (!host) return;

  container.querySelectorAll('[data-panel]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.panel === panelId);
  });

  if (panelId === 'masters') {
    mountRvmPcfLegacyMasterPanel(host);
    return;
  }

  if (panelId === 'scope') {
    const s   = state.rvmPcfExtract;
    const ids = s.selectedCanonicalIds || [];
    const indexNodes = state.rvm?.index?.nodes?.length ?? 0;
    const isSelected = s.scope === 'selected' || ids.length > 0;
    const continuity = s.continuity || {};
    const singlePcfForMultiLineSelection = s.singlePcfForMultiLineSelection;
    host.innerHTML = `
      <div class="rvm-pcf-extract-status-card">
        <div class="rvm-pcf-status-row"><span class="rvm-pcf-label">Model nodes</span><span>${indexNodes}</span></div>
        <div class="rvm-pcf-status-row"><span class="rvm-pcf-label">Scope</span><span>${isSelected ? `selected (${ids.length} nodes)` : 'full model'}</span></div>
        <div class="rvm-pcf-status-row"><span class="rvm-pcf-label">Last extracted</span><span>${s.lastBuiltAt ? new Date(s.lastBuiltAt).toLocaleString() : 'Never'}</span></div>
        <div class="rvm-pcf-status-row"><span class="rvm-pcf-label">2D CSV rows</span><span>${(s.rows || []).length}</span></div>
        <div class="rvm-pcf-status-row"><span class="rvm-pcf-label">PCF pipelines</span><span>${Object.keys(s.pcfTextByPipelineRef || {}).length}</span></div>
      </div>
      ${_topologyModeSettingsHtml(s.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE)}
      ${_continuitySettingsHtml(continuity)}
      ${_exportSettingsHtml(singlePcfForMultiLineSelection)}
    `;
    _bindTopologyModeSettings(host);
    _bindContinuitySettings(host);
    _bindExportSettings(host);
    return;
  }

  if (panelId === 'table') {
    const rows = state.rvmPcfExtract?.rows || [];
    if (!rows.length) {
      host.innerHTML = '<div class="rvm-pcf-extract-status">No rows yet — click "Rebuild 2D CSV" to build.</div>';
      return;
    }
    const COLS = ['rowNo','type','pipelineRef','name','convertedBore','include','_epFallback','convertedBoreStatus','pipelineRefSource'];
    const visibleCols = COLS.filter(c => rows.some(r => r[c] != null));
    host.innerHTML = `
      <div style="padding:8px;font-size:11px;color:#9aa9bd;">${rows.length} row(s)</div>
      <div class="rvm-pcf-table-wrap">
        <table class="rvm-pcf-table">
          <thead><tr>${visibleCols.map(c => `<th>${_esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows.slice(0, 500).map(r =>
            `<tr class="${r.include === false ? 'row-excluded' : ''}">${visibleCols.map(c => `<td>${_esc(r[c])}</td>`).join('')}</tr>`
          ).join('')}</tbody>
        </table>
        ${rows.length > 500 ? `<div class="rvm-pcf-extract-status">Showing 500 of ${rows.length} rows.</div>` : ''}
      </div>
    `;
    return;
  }

function _masterResolutionSummaryHtml() {
  const requests = state.rvmPcfExtract?.pendingMasterResolutionRequests || [];

  if (!requests.length) {
    return `
      <div class="rvm-pcf-extract-status-card">
        <div class="rvm-pcf-status-row">
          <span class="rvm-pcf-label">Master resolution</span>
          <span>Complete</span>
        </div>
      </div>
    `;
  }

  const byKind = requests.reduce((acc, req) => {
    acc[req.kind] = (acc[req.kind] || 0) + 1;
    return acc;
  }, {});

  return `
    <div class="rvm-pcf-extract-status-card">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Master resolution pending</span>
        <span>${requests.length}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Piping class</span>
        <span>${byKind.PIPING_CLASS || 0}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Line list</span>
        <span>${byKind.LINELIST || 0}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Weight</span>
        <span>${byKind.WEIGHT || 0}</span>
      </div>
    </div>
  `;
}

function _pcfExportGuardSummaryHtml() {
  const guard = state.rvmPcfExtract?.exportGuard || _getCurrentPcfExportGuard();

  if (!guard) return '';

  const pill = guard.allowed
    ? '<span style="color:#7ddc9a;font-weight:800;">ALLOWED</span>'
    : '<span style="color:#facc15;font-weight:800;">BLOCKED</span>';

  const reasonHtml = guard.reason
    ? `<div class="rvm-pcf-extract-status" style="margin-top:8px;">${_esc(guard.reason)}</div>`
    : '';

  return `
    <div class="rvm-pcf-extract-status-card" style="margin-bottom:12px;">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">PCF export guard</span>
        <span>${pill}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Topology mode</span>
        <span>${_esc(guard.topologyModeLabel)}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Output bridge ready</span>
        <span>${guard.outputBridgeReady ? 'YES' : 'NO'}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Decision export allowed</span>
        <span>${guard.exportAllowedByDecision ? 'YES' : 'NO'}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Readiness export allowed</span>
        <span>${guard.exportAllowedByReadiness ? 'YES' : 'NO'}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Accepted topology</span>
        <span>${_esc(guard.acceptedConnectionCount)}</span>
      </div>
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">Manual / rejected / unresolved</span>
        <span>${_esc(guard.manualReviewCount)} / ${_esc(guard.rejectedCount)} / ${_esc(guard.unresolvedCount)}</span>
      </div>
      ${reasonHtml}
    </div>
  `;
}

function _getCurrentPcfExportGuard() {
  const extractState = state.rvmPcfExtract || {};
  const topologyMode = extractState.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE;

  return evaluateRvmPcfExportGuard({
    topologyMode,
    rows: extractState.rows || [],
    readinessGate: extractState.readinessGate || null,
    allowPartialExport: extractState.allowPartialExport === true,
  });
}

function _assertPcfExportAllowedOrShow(container) {
  const extractState = state.rvmPcfExtract || {};
  const topologyMode = extractState.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE;

  try {
    const guard = assertRvmPcfExportAllowed({
      topologyMode,
      rows: extractState.rows || [],
      readinessGate: extractState.readinessGate || null,
      allowPartialExport: extractState.allowPartialExport === true,
    });

    _setStatus(container, formatRvmPcfExportGuardMessage(guard), false);
    return guard;
  } catch (err) {
    const guard = err.guard || _getCurrentPcfExportGuard();

    updateRvmPcfExtractState({
      exportGuard: guard,
    }, 'pcf-export-guard-blocked');

    _setStatus(container, formatRvmPcfExportGuardMessage(guard), true);
    _showPanel(container, 'diagnostics');

    return null;
  }
}

function _pcfReadinessAuditHierarchyHtml() {
  const readinessGate = state.rvmPcfExtract?.readinessGate;

  if (readinessGate?.report) {
    const { generateReadinessHtml } = _syncImportReadinessReport();
    if (generateReadinessHtml) {
      return generateReadinessHtml(readinessGate.report) + _raySecondPassSummaryHtml();
    }
  }

  return `
    <div class="rvm-pcf-extract-status-card">
      <div class="rvm-pcf-status-row">
        <span class="rvm-pcf-label">PCF readiness</span>
        <span>Not checked. Click "Run Readiness Check".</span>
      </div>
    </div>
  `;
}

function _raySecondPassSummaryHtml() {
  const rsp = state.rvmPcfExtract?.raySecondPass;
  if (!rsp) return '';

  const rs = rsp.rayResult?.summary || {};
  const fs = rsp.fixPlan?.summary || {};
  const tx = rsp.transactionReport || {};

  const rows = [
    ['Disconnected branch ports', rs.disconnectedBranchPortCount || 0],
    ['Ray candidates', rs.rayCandidateCount || 0],
    ['Safe candidates', rs.safeCandidateCount || 0],
    ['Blocked candidates', rs.blockedCandidateCount || 0],
    ['High-confidence candidates', rs.highConfidenceCandidateCount || 0],
    ['Medium-confidence candidates', rs.mediumConfidenceCandidateCount || 0],
    ['Fix plans', fs.planCount || 0],
    ['Safe fix plans', fs.safePlanCount || 0],
    ['Applied fixes', tx.appliedFixCount || 0],
    ['High-confidence applied', tx.highConfidenceAppliedCount || 0],
    ['Medium-confidence applied', tx.mediumConfidenceAppliedCount || 0],
    ['Committed', tx.committed ? 'YES' : 'NO'],
    ['Ray max mm', rs.maxRayLengthMm || tx.maxRayLengthMm || 500],
    ['Ray miss mm', rs.perpendicularToleranceMm || tx.perpendicularToleranceMm || 12],
    ['Allow TEE midpoint fallback', rs.allowMediumConfidenceAutoFix ? 'YES' : 'NO'],
  ];

  return `
    <div class="rvm-pcf-extract-status-card" style="margin-top:12px;">
      <div style="font-size:11px;font-weight:600;margin-bottom:8px;color:#dbeafe;text-transform:uppercase;">Ray 2nd Pass Fix Summary</div>
      ${rows.map(([label, val]) => `
        <div class="rvm-pcf-status-row" style="padding:2px 0;">
          <span class="rvm-pcf-label">${label}</span>
          <span style="font-family:monospace;color:#7ddc9a;">${val}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function _syncImportReadinessReport() {
  return window._rvmPcfReadinessReportModule || {};
}

function _groupDiagnosticsForDisplay(diags = []) {
  const groups = new Map();

  for (const diag of diags) {
    const key = [
      diag.severity || diag.level || 'INFO',
      diag.code || diag.severity || 'INFO',
      diag.message || JSON.stringify(diag),
      diag.type || diag.componentType || '',
      diag.pipelineRef || '',
      diag.portRole || '',
      diag.pointKey || '',
      diag.refNo || '',
      diag.seqNo || '',
      diag.lineNo || '',
    ].join('||');

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...diag,
        count: 1,
        rowNos: diag.rowNo != null ? [diag.rowNo] : [],
      });
      continue;
    }

    existing.count += 1;
    if (diag.rowNo != null && !existing.rowNos.includes(diag.rowNo)) {
      existing.rowNos.push(diag.rowNo);
    }
  }

  return [...groups.values()];
}

  if (panelId === 'diagnostics') {
    const groupDiagnosticsForDisplay = (diags = []) => {
      const groups = new Map();

      for (const diag of diags) {
        const key = [
          diag.severity || diag.level || 'INFO',
          diag.code || diag.severity || 'INFO',
          diag.message || JSON.stringify(diag),
          diag.type || diag.componentType || '',
          diag.pipelineRef || '',
          diag.portRole || '',
          diag.pointKey || '',
          diag.refNo || '',
          diag.seqNo || '',
          diag.lineNo || '',
        ].join('||');

        const existing = groups.get(key);
        if (!existing) {
          groups.set(key, {
            ...diag,
            count: 1,
            rowNos: diag.rowNo != null ? [diag.rowNo] : [],
          });
          continue;
        }

        existing.count += 1;
        if (diag.rowNo != null && !existing.rowNos.includes(diag.rowNo)) {
          existing.rowNos.push(diag.rowNo);
        }
      }

      return [...groups.values()];
    };
    const diags = groupDiagnosticsForDisplay(state.rvmPcfExtract?.diagnostics || []);
    const sevClass = (s, d = {}) => {
      if (d.skipApplied) return 'diag-warn';
      return s === 'ERROR' ? 'diag-error' : s === 'WARNING' ? 'diag-warn' : 'diag-info';
    };
    host.innerHTML = `
      ${_uxmlTopologyDiagnosticsSummaryHtml()}
      ${_pcfReadinessAuditHierarchyHtml()}
      <div style="padding:8px;font-size:11px;color:#9aa9bd;">${diags.length} diagnostic(s)</div>
      <div class="rvm-pcf-diag-list">
        ${diags.length ? diags.map(d => `
          <div class="rvm-pcf-diag ${sevClass(d.severity || d.level || 'INFO', d)}">
            <span class="rvm-pcf-diag-code">${_esc(d.code || d.severity || 'INFO')}</span>
            <span>
              ${d.count > 1 ? `<b style="color:#7ddc9a;">x${d.count}</b> ` : ''}
              ${_esc(d.message || JSON.stringify(d))}
              ${
                d.refNo || d.seqNo || d.lineNo || d.pipelineRef || d.portRole || d.point
                  ? `
                    <div style="margin-top:4px;font-size:11px;color:#9aa9bd;line-height:1.35;">
                      ${d.refNo ? `<b>Ref:</b> ${_esc(d.refNo)} ` : ''}
                      ${d.seqNo ? `<b>Seq:</b> ${_esc(d.seqNo)} ` : ''}
                      ${d.lineNo ? `<b>Line:</b> ${_esc(d.lineNo)} ` : ''}
                      ${d.pipelineRef ? `<b>Pipeline:</b> ${_esc(d.pipelineRef)} ` : ''}
                      ${d.portRole ? `<b>Port:</b> ${_esc(d.portRole)} ` : ''}
                      ${d.pointKey ? `<b>Point:</b> ${_esc(d.pointKey)} ` : ''}
                      ${d.rowNos?.length ? `<b>Rows:</b> ${_esc(d.rowNos.join(', '))} ` : ''}
                      ${
                        d.point
                          ? `<b>XYZ:</b> ${_esc(`${d.point.x}, ${d.point.y}, ${d.point.z}`)}`
                          : ''
                      }
                    </div>
                  `
                  : ''
              }
            </span>
          </div>
        `).join('') : '<div class="rvm-pcf-extract-status">No diagnostics yet.</div>'}
      </div>
    `;
    return;
  }

  if (panelId === 'pcf') {
    const byRef = state.rvmPcfExtract?.pcfTextByPipelineRef || {};
    const refs  = Object.keys(byRef);
    if (!refs.length) {
      host.innerHTML = '<div class="rvm-pcf-extract-status">No PCF yet — click "Generate PCF" to build.</div>';
      return;
    }
    host.innerHTML = refs.map(ref => `
      <div class="rvm-pcf-ref-block">
        <button class="rvm-pcf-copy-btn" data-copy-pcf="${_esc(ref)}" title="Copy PCF to clipboard">⎘</button>
        <div class="rvm-pcf-ref-title">${_esc(ref)}</div>
        <pre class="rvm-pcf-extract-pre">${_esc(byRef[ref])}</pre>
      </div>
    `).join('');
    host.querySelectorAll('.rvm-pcf-copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ref = btn.dataset.copyPcf;
        const text = (state.rvmPcfExtract?.pcfTextByPipelineRef || {})[ref] || '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = '✓';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1800);
        } catch {
          btn.title = 'Copy failed — try selecting and Ctrl+C';
        }
      });
    });
    return;
  }
}

function _setStatus(container, msg, isError = false) {
  const el = container.querySelector('.rvm-pcf-extract-run-status');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#ff7171' : '#7ddc9a';
  }
}

async function _runRebuildCsv(container) {
  const indexJson = state.rvm?.index;

  if (!indexJson?.nodes?.length) {
    _setStatus(container, 'No model loaded. Load an RVM bundle in the 3D viewer first.', true);
    return false;
  }

  _setStatus(container, 'Building 2D CSV…');

  try {
    const [
      { RvmFinal2dCsvBuilder },
      { RvmExtractHardening },
      {
        RvmMasterResolutionWorkflow,
        showRvmMasterResolutionDialog
      }
    ] = await Promise.all([
      _importRvmPcfModule('RvmFinal2dCsvBuilder.js'),
      _importRvmPcfModule('RvmExtractHardening.js'),
      _importRvmPcfModule('RvmMasterResolutionWorkflow.js')
    ]);

    const selectedCanonicalIds = state.rvmPcfExtract.selectedCanonicalIds || [];
    const masters = state.rvmPcfExtract.masters || {};

    const builder = new RvmFinal2dCsvBuilder(indexJson, {
      selectedCanonicalIds,
      masters
    });

    const { rows, diagnostics: buildDiags } = builder.build();

    const hardening = new RvmExtractHardening();
    hardening.sortRows(rows);

    const resolver = new RvmMasterResolutionWorkflow({
      masters,
      options: {
        pipingClassRegex: localStorage.getItem('rvm_pcf_piping_class_regex') || undefined,
        pipingClassRegexGroup: Number(localStorage.getItem('rvm_pcf_piping_class_regex_group') || 1)
      }
    });

    const resolution = resolver.processRows(rows);

    const allDiagnostics = [
      ...(state.rvmPcfExtract.diagnostics || []).filter(d => d._source !== 'master-resolution'),
      ...(buildDiags || []),
      ...(resolution.diagnostics || []).map(d => ({
        ...d,
        _source: 'master-resolution'
      })),
      ...(resolution.requests || []).map(req => ({
        severity: req.reason === 'NO_MATCH' || req.reason === 'NO_MASTER' ? 'WARNING' : 'WARNING',
        code: `MASTER-${req.kind}-${req.reason}`,
        message: `${req.kind} requires user resolution: ${req.reason}`,
        rowNo: req.rowNo,
        type: req.componentType,
        pipelineRef: req.pipelineRef,
        requestId: req.id,
        _source: 'master-resolution'
      }))
    ];

    updateRvmPcfExtractState({
      rows,
      diagnostics: allDiagnostics,
      pendingMasterResolutionRequests: resolution.requests || [],
      lastBuiltAt: new Date().toISOString()
    }, 'rebuild-csv');

    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
      action: 'REBUILD_CSV'
    });

    if (resolution.requests?.length) {
      _setStatus(
        container,
        `Built ${rows.length} row(s). ${resolution.requests.length} master resolution request(s) need review.`,
        true
      );

      showRvmMasterResolutionDialog({
        requests: resolution.requests,
        rows,
        resolver,
        onApplied: result => {
          const current = state.rvmPcfExtract || {};
          const existingDiagnostics = current.diagnostics || [];

          updateRvmPcfExtractState({
            rows,
            diagnostics: [
              ...existingDiagnostics,
              ...(result.diagnostics || []).map(d => ({
                ...d,
                _source: 'master-resolution'
              }))
            ],
            pendingMasterResolutionRequests: []
          }, 'master-resolution-applied');

          emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
            action: 'MASTER_RESOLUTION_APPLIED'
          });

          _setStatus(container, `Master resolution applied to ${result.applied || 0} row(s).`);
          _showPanel(container, 'table');
        }
      });
    } else {
      _setStatus(container, `Built ${rows.length} row(s). Master resolution complete.`);
    }

    // Auto-run UXML topology immediately after CSV build when mode is set
    const _currentTopologyMode = normalizeRvmPcfTopologyMode(
      state.rvmPcfExtract?.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE
    );
    if (isUxmlTopologyMode(_currentTopologyMode)) {
      await _runUxmlTopologyReadinessGate(container);
    }

    return true;
  } catch (err) {
    _setStatus(container, `Build failed: ${err.message}`, true);
    return false;
  }
}

function _getPipeFixToleranceMm(container) {
  const input = container.querySelector('[data-pipe-fix-tolerance-mm]');
  const raw = Number(input?.value ?? 25);

  if (!Number.isFinite(raw)) return 25;

  return Math.max(0, Math.min(100, raw));
}

function _getReadinessSkipOptions(container) {
  return {
    skipReadinessErrors: !!container.querySelector('[data-readiness-skip-all-errors]')?.checked,
  };
}

function _getRaySecondPassMaxLengthMm(container) {
  const input = container.querySelector('[data-ray-second-pass-max-mm]');
  const raw = Number(input?.value ?? 500);

  if (!Number.isFinite(raw)) return 500;

  return Math.max(1, Math.min(5000, raw));
}

function _getRaySecondPassToleranceMm(container) {
  const input = container.querySelector('[data-ray-second-pass-miss-mm]');
  const raw = Number(input?.value ?? 12);

  if (!Number.isFinite(raw)) return 12;

  return Math.max(0, Math.min(100, raw));
}

function _getRaySecondPassOptions(container) {
  return {
    connectToleranceMm: 6,
    fixToleranceMm: _getTopoFixToleranceMm(container),
    maxRayLengthMm: _getRaySecondPassMaxLengthMm(container),
    perpendicularToleranceMm: _getRaySecondPassToleranceMm(container),
    allowMediumConfidenceAutoFix:
      container.querySelector('[data-ray-second-pass-allow-medium]')?.checked !== false,
  };
}

function _getTopoFixToleranceMm(container) {
  const input = container.querySelector('[data-topo-fix-tolerance-mm]');
  const raw = Number(input?.value ?? 25);

  if (!Number.isFinite(raw)) return 25;

  return Math.max(0, Math.min(100, raw));
}

async function _runUxmlTopologyReadinessGate(container) {
  const rows = state.rvmPcfExtract?.rows || [];

  if (!rows.length) {
    _setStatus(container, 'No rows to check — rebuild CSV first.', true);
    _showPanel(container, 'diagnostics');
    return false;
  }

  try {
    const { runUxmlTopologyForRvmRows } = await _importRvmPcfModule('RvmUxmlTopologyBridge.js');

    const result = runUxmlTopologyForRvmRows(rows, {
      connectToleranceMm: 6,
      fixToleranceMm: _getTopoFixToleranceMm(container),
      maxRayLengthMm: _getRaySecondPassMaxLengthMm(container),
      tubeToleranceMm: _getRaySecondPassToleranceMm(container),
      allowPartialExport: true,
      name: 'rvm-json-pcf-extract-rows',
    });

    const existing = (state.rvmPcfExtract.diagnostics || []).filter(
      d =>
        d._source !== 'uxml-topology' &&
        d._source !== 'pcf-readiness-gate'
    );

    updateRvmPcfExtractState({
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
      uxmlTopology: result,
      rows: result.legacyRows,
      readinessGate: result.readinessGate,
      diagnostics: [
        ...existing,
        ...(result.diagnostics || []).map(d => ({
          ...d,
          _source: 'uxml-topology',
        })),
      ],
    }, 'uxml-topology-readiness-gate');

    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
      action: 'UXML_TOPOLOGY_READINESS_GATE',
      topologyMode: RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY,
    });

    _setStatus(
      container,
      result.readinessGate.pass
        ? `UXML topology passed. Legacy routing continues for masters/PCF. Edges=${result.readinessGate.summary.universalEdgeCount}.`
        : `UXML topology needs review. Legacy routing retained. Disconnected=${result.readinessGate.summary.disconnectedCount}, manual=${result.readinessGate.summary.manualReviewCount}.`,
      !result.readinessGate.pass
    );

    _showPanel(container, 'diagnostics');
    return result.readinessGate.pass;
  } catch (err) {
    _setStatus(container, `UXML topology readiness failed: ${err.message}`, true);
    return false;
  }
}

async function _runPcfReadinessGate(container) {
  const topologyMode = normalizeRvmPcfTopologyMode(
    state.rvmPcfExtract?.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE
  );

  if (isUxmlTopologyMode(topologyMode)) {
    return _runUxmlTopologyReadinessGate(container);
  }

  const rows = state.rvmPcfExtract?.rows || [];

  if (!rows.length) {
    _setStatus(container, 'No rows to check — rebuild CSV first.', true);
    _showPanel(container, 'diagnostics');
    return false;
  }

  try {
    const { runPcfReadinessGate, assertPcfExportAllowed } = await _importRvmPcfModule('RvmPcfReadinessGate.js');
    const { generateReadinessHtml } = await _importRvmPcfModule('RvmPcfReadinessReport.js');

    // Save to global for synchronous HTML rendering without awaiting
    window._rvmPcfReadinessReportModule = { generateReadinessHtml };

    const result = runPcfReadinessGate(rows, {
      connectToleranceMm: 6,
      fixToleranceMm: _getTopoFixToleranceMm(container),
      ..._getReadinessSkipOptions(container),
    });

    const exportCheck = assertPcfExportAllowed(result, { allowPartialExport: true });

    // Append the report to the result payload directly
    result.report = {
      allowPcfExport: exportCheck.ok,
      exportBlockReason: exportCheck.reason,
      summary: result.summary,
    };

    const existing = (state.rvmPcfExtract.diagnostics || []).filter(
      d => d._source !== 'pcf-readiness-gate'
    );

    updateRvmPcfExtractState({
      readinessGate: result,
      diagnostics: [
        ...existing,
        ...(result.diagnostics || []).map(d => ({
          ...d,
          _source: 'pcf-readiness-gate',
        })),
      ],
    }, 'pcf-readiness-gate');

    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
      action: 'PCF_READINESS_GATE',
    });

    _setStatus(
      container,
      result.pass
        ? 'PCF readiness passed.'
        : `PCF readiness failed: ${result.summary.blockedRows} blocked row(s), ${result.summary.safeFixPlanCount} safe fix plan(s).`,
      !result.pass
    );

    _showPanel(container, 'diagnostics');
    return result.pass;
  } catch (err) {
    _setStatus(container, `PCF readiness check failed: ${err.message}`, true);
    return false;
  }
}

async function _dryRunReadinessGapOverlap(container) {
  const rows = state.rvmPcfExtract?.rows || [];

  if (!rows.length) {
    _setStatus(container, 'No rows to check — rebuild CSV first.', true);
    return false;
  }

  const { runPcfReadinessGate } = await _importRvmPcfModule('RvmPcfReadinessGate.js');

  const result = runPcfReadinessGate(rows, {
    connectToleranceMm: 6,
    fixToleranceMm: _getTopoFixToleranceMm(container),
    ..._getReadinessSkipOptions(container),
  });

  updateRvmPcfExtractState({
    readinessGate: result,
  }, 'dry-run-gap-overlap');

  _setStatus(
    container,
    `Dry run complete: ${result.summary.safeFixPlanCount} safe fix plan(s), ${result.summary.blockedFixPlanCount} blocked plan(s).`,
    result.summary.blockedFixPlanCount > 0
  );

  _showPanel(container, 'diagnostics');
  return true;
}

async function _applyRaySecondPass(container) {
  const rows = state.rvmPcfExtract?.rows || [];

  if (!rows.length) {
    _setStatus(container, 'No rows to check — rebuild CSV first.', true);
    _showPanel(container, 'diagnostics');
    return false;
  }

  try {
    const { runPcfReadinessGate } = await _importRvmPcfModule('RvmPcfReadinessGate.js');
    const {
      buildRaySecondPassCandidates,
      createRaySecondPassFixPlan,
      applyRaySecondPassTransaction,
    } = await import('../rvm-pcf-topology/RvmPcfRaySecondPass.js');

    const options = _getRaySecondPassOptions(container);

    const readiness = state.rvmPcfExtract?.readinessGate?.graph
      ? state.rvmPcfExtract.readinessGate
      : runPcfReadinessGate(rows, options);

    const graph = readiness.graph;

    const rayResult = buildRaySecondPassCandidates(rows, graph, options);
    const fixPlan = createRaySecondPassFixPlan(rows, graph, rayResult, options);
    const tx = applyRaySecondPassTransaction(rows, graph, fixPlan, options);

    const recheck = tx.transactionReport.committed
      ? runPcfReadinessGate(tx.rows, {
          ...options,
          ..._getReadinessSkipOptions(container),
        })
      : readiness;

    const diagnostics = [
      ...(state.rvmPcfExtract.diagnostics || []).filter(d =>
        d._source !== 'ray-second-pass' &&
        d._source !== 'pcf-readiness-gate'
      ),
      ...(rayResult.diagnostics || []),
      ...((rayResult.candidates || []).map(c => ({
        severity: c.safeForAutoApply ? 'INFO' : 'WARNING',
        code: c.safeForAutoApply
          ? 'RAY2-SAFE-BRANCH-CANDIDATE'
          : 'RAY2-BLOCKED-BRANCH-CANDIDATE',
        message:
          `Ray 2nd pass ${c.safeForAutoApply ? 'safe' : 'blocked'} candidate: ` +
          `${c.sourceType} row ${c.sourceRowNo} ${c.sourceRole} → ` +
          `${c.targetType} row ${c.targetRowNo} ${c.targetRole}; ` +
          `method=${c.rayMethod}, confidence=${c.rayConfidence}, ` +
          `ray=${c.distanceAlongRayMm}mm, miss=${c.perpendicularMissMm}mm.`,
        rowNo: c.sourceRowNo,
        type: c.sourceType,
        refNo: c.sourceRefNo,
        seqNo: c.sourceSeqNo,
        lineNo: c.sourceLineNo,
        pipelineRef: c.pipelineRef,
        portRole: c.sourceRole,
        point: c.sourcePoint,
        rayMethod: c.rayMethod,
        rayConfidence: c.rayConfidence,
        rayOrigin: c.rayOrigin,
        rayDirection: c.rayDirection,
        rayReferencePoint: c.rayReferencePoint,
        candidate: c,
        _source: 'ray-second-pass',
      }))),
      {
        severity: tx.transactionReport.committed ? 'INFO' : 'ERROR',
        code: tx.transactionReport.committed
          ? 'RAY2-TRANSACTION-COMMITTED'
          : 'RAY2-TRANSACTION-REJECTED',
        message: tx.transactionReport.committed
          ? `Ray 2nd pass applied ${tx.transactionReport.appliedFixCount} pipe-endpoint branch fix(es).`
          : `Ray 2nd pass rejected: ${tx.transactionReport.rejectReasons.join(', ')}`,
        _source: 'ray-second-pass',
        report: tx.transactionReport,
      },
      ...(recheck.diagnostics || []).map(d => ({
        ...d,
        _source: 'pcf-readiness-gate',
      })),
    ];

    updateRvmPcfExtractState({
      rows: tx.rows,
      diagnostics,
      readinessGate: recheck,
      raySecondPass: {
        rayResult,
        fixPlan,
        transactionReport: tx.transactionReport,
      },
      pcfTextByPipelineRef: {},
    }, 'apply-ray-second-pass');

    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
      action: 'APPLY_RAY_SECOND_PASS',
    });

    _setStatus(
      container,
      tx.transactionReport.committed
        ? `Ray 2nd pass applied ${tx.transactionReport.appliedFixCount} pipe-endpoint fix(es).`
        : `Ray 2nd pass rejected: ${tx.transactionReport.rejectReasons.join(', ')}`,
      !tx.transactionReport.committed
    );

    _showPanel(container, 'diagnostics');
    return tx.transactionReport.committed;
  } catch (err) {
    _setStatus(container, `Ray 2nd pass failed: ${err.message}`, true);
    _showPanel(container, 'diagnostics');
    return false;
  }
}

async function _applySafeReadinessGapOverlapFix(container) {
  const rows = state.rvmPcfExtract?.rows || [];
  const readiness = state.rvmPcfExtract?.readinessGate;

  if (!rows.length || !readiness?.graph || !readiness?.fixPlan) {
    _setStatus(container, 'Run readiness/dry-run before applying fixes.', true);
    return false;
  }

  const { applySafeGapOverlapFixTransaction } = await import('../rvm-pcf-topology/RvmPcfGapOverlapResolver.js');

  const result = applySafeGapOverlapFixTransaction(
    rows,
    readiness.graph,
    readiness.fixPlan,
    {
      connectToleranceMm: 6,
      fixToleranceMm: _getTopoFixToleranceMm(container),
    }
  );

  const diagnostics = [
    ...(state.rvmPcfExtract.diagnostics || []).filter(d => d._source !== 'pcf-topology-transaction'),
    {
      severity: result.transactionReport.committed ? 'INFO' : 'ERROR',
      code: result.transactionReport.committed ? 'TOPO-FIX-TRANSACTION-COMMITTED' : 'TOPO-FIX-TRANSACTION-REJECTED',
      message: result.transactionReport.committed
        ? `Applied ${result.transactionReport.appliedFixCount} pipe-only topology fix(es).`
        : `Topology fix rejected: ${result.transactionReport.rejectReasons.join(', ')}`,
      _source: 'pcf-topology-transaction',
      report: result.transactionReport,
    },
  ];

  updateRvmPcfExtractState({
    rows: result.rows,
    diagnostics,
      readinessTransactionReport: result.transactionReport,
    pcfTextByPipelineRef: {},
  }, 'apply-safe-gap-overlap-fix');

  emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, {
    action: 'APPLY_SAFE_GAP_OVERLAP_FIX',
  });

  _setStatus(
    container,
    result.transactionReport.committed
      ? `Applied ${result.transactionReport.appliedFixCount} safe pipe-only fix(es).`
      : `Safe fix rejected: ${result.transactionReport.rejectReasons.join(', ')}`,
    !result.transactionReport.committed
  );

  _showPanel(container, 'diagnostics');
  return result.transactionReport.committed;
}

async function _runValidate(container) {
  const rows = state.rvmPcfExtract?.rows || [];
  if (!rows.length) {
    _setStatus(container, 'No rows to validate — rebuild CSV first.', true);
    _showPanel(container, 'diagnostics');
    return;
  }
  _setStatus(container, 'Validating…');
  try {
    const { RvmExtractHardening } = await _importRvmPcfModule('RvmExtractHardening.js');
    const hardening = new RvmExtractHardening();
    const register  = hardening.buildValidationRegister(rows);
    const groupDiagnosticsForDisplay = (diags = []) => {
      const groups = new Map();

      for (const diag of diags) {
        const key = [
          diag.severity || diag.level || 'INFO',
          diag.code || diag.severity || 'INFO',
          diag.message || JSON.stringify(diag),
          diag.type || diag.componentType || '',
          diag.pipelineRef || '',
          diag.portRole || '',
          diag.pointKey || '',
          diag.refNo || '',
          diag.seqNo || '',
          diag.lineNo || '',
        ].join('||');

        const existing = groups.get(key);
        if (!existing) {
          groups.set(key, {
            ...diag,
            count: 1,
            rowNos: diag.rowNo != null ? [diag.rowNo] : [],
          });
          continue;
        }

        existing.count += 1;
        if (diag.rowNo != null && !existing.rowNos.includes(diag.rowNo)) {
          existing.rowNos.push(diag.rowNo);
        }
      }

      return [...groups.values()];
    };
    const groupedRegister = groupDiagnosticsForDisplay(register);
    const existing = (state.rvmPcfExtract.diagnostics || []).filter(d => d._source !== 'validate');
    updateRvmPcfExtractState({ diagnostics: [...existing, ...groupedRegister.map(d => ({ ...d, _source: 'validate' }))] }, 'validate');
    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, { action: 'VALIDATE' });
    _setStatus(container, `${groupedRegister.length} grouped diagnostic(s).`);
    _showPanel(container, 'diagnostics');
  } catch (err) {
    _setStatus(container, `Validate failed: ${err.message}`, true);
  }
}

async function _exportReadinessReport(container, format = 'json') {
  const readinessGate = state.rvmPcfExtract?.readinessGate;

  if (!readinessGate?.report) {
    _setStatus(container, 'Run Readiness Check first to generate a report.', true);
    return;
  }

  try {
    const { generateReadinessMarkdown } = await _importRvmPcfModule('RvmPcfReadinessReport.js');

    let content, mimeType, filename;

    if (format === 'md') {
      content = generateReadinessMarkdown(readinessGate.report);
      mimeType = 'text/markdown';
      filename = `pcf-readiness-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    } else {
      content = JSON.stringify(readinessGate.report, null, 2);
      mimeType = 'application/json';
      filename = `pcf-readiness-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    }

    const { downloadText } = await import('../pcfx/Pcfx_FileIO.js');
    downloadText(content, filename, mimeType);

    _setStatus(container, `Exported readiness report as ${format.toUpperCase()}.`, false);
  } catch (err) {
    _setStatus(container, `Failed to export report: ${err.message}`, true);
  }
}

async function _ensureReadinessBeforePcfExport(container) {
  const _topMode = normalizeRvmPcfTopologyMode(
    state.rvmPcfExtract?.topologyMode || DEFAULT_RVM_PCF_TOPOLOGY_MODE
  );

  let readinessGate = state.rvmPcfExtract?.readinessGate;

  if (!readinessGate?.report) {
    _setStatus(container, 'Run Readiness Check before generating PCF.', true);
    _showPanel(container, 'diagnostics');
    return false;
  }

  if (readinessGate?.report && !readinessGate.report.allowPcfExport) {
    _setStatus(container, 'PCF Generation blocked by Readiness Gate. Check Diagnostics tab.', true);
    _showPanel(container, 'diagnostics');
    return false;
  }

  return true;
}

// ── Units auto-assign ─────────────────────────────────────────────────────────
// CA1 = design pressure (kPa), CA2 = design temperature (°C),
// CA5 = insulation thickness (mm), CA10 = hydro test pressure (kPa)
const _DEFAULT_UNITS = {
  'COMPONENT-ATTRIBUTE1':  'kPa',
  'COMPONENT-ATTRIBUTE2':  'DegC',
  'COMPONENT-ATTRIBUTE5':  'mm',
  'COMPONENT-ATTRIBUTE10': 'kPa',
};

function _applyDefaultUnits(pcfTextByPipelineRef) {
  const applied = new Set();
  const result = {};
  for (const [ref, text] of Object.entries(pcfTextByPipelineRef)) {
    result[ref] = text.replace(
      /^(COMPONENT-ATTRIBUTE(?:1|2|5|10))\s+(\S+)\s*$/gm,
      (match, key, val) => {
        // Only patch if value is purely numeric (no letters/units already)
        if (/^-?\d+(\.\d+)?$/.test(val) && _DEFAULT_UNITS[key]) {
          applied.add(`${key} → ${_DEFAULT_UNITS[key]}`);
          return `${key}    ${val} ${_DEFAULT_UNITS[key]}`;
        }
        return match;
      }
    );
  }
  if (applied.size) _showUnitsToast([...applied]);
  return result;
}

function _showUnitsToast(lines) {
  const existing = document.getElementById('rvm-units-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'rvm-units-toast';
  toast.className = 'rvm-units-toast';
  toast.innerHTML = `
    <button class="rvm-units-toast-close" title="Dismiss">×</button>
    <div class="rvm-units-toast-title">Default units applied</div>
    <div>No units found — assigned defaults:<br>${lines.map(l => `&nbsp;• ${l}`).join('<br>')}</div>
  `;
  toast.querySelector('.rvm-units-toast-close').addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 8000);
}

async function _runGeneratePcf(container) {
  let rows = state.rvmPcfExtract?.rows || [];
  if (!rows.length) {
    const ok = await _runRebuildCsv(container);
    if (!ok) return false;
    rows = state.rvmPcfExtract?.rows || [];
  }

  const ok = await _ensureReadinessBeforePcfExport(container);
  if (!ok) return false;
  _setStatus(container, 'Generating PCF…');
  try {
    const { RvmPcfContinuityChecker } = await _importRvmPcfModule('RvmPcfContinuityChecker.js');
    const { RvmPcfEmitter } = await _importRvmPcfModule('RvmPcfEmitter.js');
    const continuityChecker = new RvmPcfContinuityChecker();
    const continuitySettings = state.rvmPcfExtract.continuity || {};
    const singlePcfForMultiLineSelection = state.rvmPcfExtract.singlePcfForMultiLineSelection !== false;
    const collapseResult = singlePcfForMultiLineSelection
      ? _collapseRowsToSinglePcf(rows)
      : { rows, collapsed: false, pipelineRef: null, sourcePipelineRefs: _uniquePipelineRefs(rows) };
    rows = collapseResult.rows;
    const continuityAutoAdjustEnabled =
      continuitySettings.continuityAutoAdjustEnabled ??
      continuitySettings.autoAdjustEnabled;
    const continuityResult = continuityAutoAdjustEnabled !== false
      ? continuityChecker.applyAutoBalanceComponents(rows, continuitySettings)
      : {
          components: rows,
          report: continuityChecker.analyzeComponents(rows, continuitySettings),
        };
    rows = continuityResult.components || rows;
    const continuityReport = continuityResult.report || null;
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    let { pcfTextByPipelineRef, errors, warnings } = emitter.emit(rows);
    pcfTextByPipelineRef = _applyDefaultUnits(pcfTextByPipelineRef);
    const continuityDiag = continuityReport
      ? [{
          severity: continuityReport.ok ? 'INFO' : 'WARNING',
          _source: 'pcf-continuity',
          code: 'PCF-CONTINUITY',
          message: `Continuity ${continuityReport.ok ? 'OK' : 'issues found'}: ${continuityReport.fixableCount || 0} fixable, ${continuityReport.fatalCount || 0} fatal, max deviation ${continuityReport.maxDeviationMm || 0} mm.`,
          report: continuityReport,
        }]
      : [];
    const collapseDiag = collapseResult.collapsed
      ? [{
          severity: 'INFO',
          _source: 'pcf-collapse',
          code: 'PCF-SINGLE-PCF-MULTI-LINE',
          message: `Collapsed ${collapseResult.sourcePipelineRefs.length} selected pipeline refs into one PCF to preserve cross-line continuity.`,
          sourcePipelineRefs: collapseResult.sourcePipelineRefs,
          pipelineRef: collapseResult.pipelineRef,
        }]
      : [];
    updateRvmPcfExtractState({
      rows,
      continuityReport,
      pcfTextByPipelineRef,
      diagnostics: [
        ...(state.rvmPcfExtract.diagnostics || []),
        ...continuityDiag,
        ...collapseDiag,
        ...errors.map(e => ({ severity: 'ERROR', _source: 'pcf-emit', ...e })),
        ...warnings.map(w => ({ severity: 'WARNING', _source: 'pcf-emit', ...w })),
      ],
    }, 'generate-pcf');
    emit(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, { action: 'GENERATE_PCF' });
    const pipelineCount = Object.keys(pcfTextByPipelineRef).length;
    _setStatus(container, `Generated PCF for ${pipelineCount} pipeline(s).${continuityReport ? ` Continuity: ${continuityReport.fixableCount || 0} fixable, ${continuityReport.fatalCount || 0} fatal.` : ''}`);
    await _runPcfReadinessGate(container);
    _showPanel(container, 'pcf');
    return true;
  } catch (err) {
    _setStatus(container, `PCF generation failed: ${err.message}`, true);
    return false;
  }
}

async function _runDownloadCsv(container) {
  let rows = state.rvmPcfExtract?.rows || [];
  if (!rows.length) {
    _setStatus(container, 'No rows yet — rebuilding CSV…');
    const ok = await _runRebuildCsv(container);
    if (!ok) return;
    rows = state.rvmPcfExtract?.rows || [];
    if (!rows.length) { _setStatus(container, 'No rows to download.', true); return; }
  }
  const { downloadCsv } = await _importRvmPcfModule('RvmPcfDownload.js');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadCsv(`rvm-pcf-extract-${ts}.csv`, rows);
  _setStatus(container, 'CSV downloaded.');
}

async function _runDownloadPcf(container) {
  const exportGuard = _assertPcfExportAllowedOrShow(container);
  if (!exportGuard) return;

  const byRef = state.rvmPcfExtract?.pcfTextByPipelineRef || {};
  if (!Object.keys(byRef).length) {
    const ok = await _runGeneratePcf(container);
    if (!ok) return;
  }
  const { RvmExtractHardening } = await _importRvmPcfModule('RvmExtractHardening.js');
  const hardening = new RvmExtractHardening();
  const files = hardening.downloadAllPcf(state.rvmPcfExtract.pcfTextByPipelineRef || {});
  _setStatus(container, `Downloaded ${files.length} PCF file(s).`);
}

export function mount(container) {
  container.innerHTML = `
<div class="rvm-pcf-extract-tab">
  <div class="rvm-pcf-extract-header">
    <span class="rvm-pcf-extract-source-label">Source: (none)</span>
    <span class="rvm-pcf-extract-scope-label">Scope: full</span>
    <span class="rvm-pcf-extract-node-count"></span>
    <span class="rvm-pcf-extract-run-status" style="margin-left:auto;font-size:11px;color:#7ddc9a;"></span>
  </div>
  <div class="rvm-pcf-extract-toolbar">

    <!-- Step 1: Data preparation -->
    <div class="rvm-pcf-tb-group">
      <div class="rvm-pcf-tb-group-label">1 · Data</div>
      <div class="rvm-pcf-tb-group-row">
        <button data-action="RELOAD_SCOPE">Reload Scope</button>
        <button data-action="REBUILD_CSV">Rebuild 2D CSV</button>
        <button data-action="VALIDATE">Validate</button>
      </div>
    </div>

    <div class="rvm-pcf-tb-sep"></div>

    <!-- Step 2: Readiness check -->
    <div class="rvm-pcf-tb-group">
      <div class="rvm-pcf-tb-group-label">2 · Readiness Check</div>
      <div class="rvm-pcf-tb-group-row">
        <button data-action="RUN_PCF_READINESS">Run Readiness Check</button>
        <button data-action="EXPORT_READINESS_JSON" class="rvm-pcf-tb-btn-secondary" title="Download readiness report as JSON">Export JSON</button>
        <button data-action="EXPORT_READINESS_MD" class="rvm-pcf-tb-btn-secondary" title="Download readiness report as Markdown">Export MD</button>
      </div>
    </div>

    <div class="rvm-pcf-tb-sep"></div>

    <!-- Step 3a: Gap/Overlap topology fix -->
    <div class="rvm-pcf-tb-group">
      <div class="rvm-pcf-tb-group-label">3a · Gap / Overlap Fix</div>
      <div class="rvm-pcf-tb-group-row">
        <label class="rvm-pcf-tb-input-label" title="Maximum gap or overlap length in mm that will be auto-fixed">
          Fix mm
          <input data-topo-fix-tolerance-mm type="number" min="0" max="100" step="1" value="25" class="rvm-pcf-tb-numbox">
        </label>
        <button data-action="DRY_RUN_GAP_OVERLAP" title="Preview which gaps/overlaps would be fixed — does not modify data">Dry Run</button>
        <button data-action="APPLY_SAFE_GAP_OVERLAP" title="Apply only the gap/overlap fixes that are unambiguously safe">Apply Safe Fix</button>
      </div>
    </div>

    <div class="rvm-pcf-tb-sep"></div>

    <!-- Step 3b: Ray second pass (alternative topology fix) -->
    <div class="rvm-pcf-tb-group">
      <div class="rvm-pcf-tb-group-label">3b · Ray 2nd Pass</div>
      <div class="rvm-pcf-tb-group-row">
        <label class="rvm-pcf-tb-input-label" title="Maximum pipe segment length (mm) that the ray will travel">
          Max mm
          <input data-ray-second-pass-max-mm type="number" min="1" max="5000" step="1" value="500" class="rvm-pcf-tb-numbox" style="width:64px;">
        </label>
        <label class="rvm-pcf-tb-input-label" title="Allowable miss distance (mm) when the ray narrowly misses an endpoint">
          Miss mm
          <input data-ray-second-pass-miss-mm type="number" min="0" max="100" step="1" value="12" class="rvm-pcf-tb-numbox">
        </label>
        <label class="rvm-pcf-tb-check" title="Also accept TEE midpoint connections when no direct endpoint is found">
          <input data-ray-second-pass-allow-medium type="checkbox" checked>
          TEE fallback
        </label>
        <button data-action="APPLY_RAY_SECOND_PASS">Apply Ray 2nd Pass</button>
      </div>
    </div>

    <div class="rvm-pcf-tb-sep"></div>

    <!-- Step 4: Output — Skip all Errors is here so it comes after all topology fixes -->
    <div class="rvm-pcf-tb-group">
      <div class="rvm-pcf-tb-group-label">4 · Output</div>
      <div class="rvm-pcf-tb-group-row">
        <label class="rvm-pcf-tb-check" title="Downgrade all remaining readiness errors to warnings so PCF export is not blocked. Run Readiness Check again after checking this.">
          <input data-readiness-skip-all-errors type="checkbox">
          Skip all Errors
        </label>
        <button data-action="GENERATE_PCF" class="rvm-pcf-tb-btn-primary">Generate PCF</button>
        <button data-action="DOWNLOAD_CSV" class="rvm-pcf-tb-btn-secondary">Download CSV</button>
        <button data-action="DOWNLOAD_PCF" class="rvm-pcf-tb-btn-secondary">Download PCF</button>
      </div>
    </div>

  </div>
  <div class="rvm-pcf-extract-body"><div class="rvm-pcf-extract-layout"><aside class="rvm-pcf-extract-rail">
    <button data-panel="scope" class="is-active">Scope</button><button data-panel="masters">Masters</button><button data-panel="table">2D CSV</button><button data-panel="diagnostics">Diagnostics</button><button data-panel="pcf">PCF</button>
  </aside><section class="rvm-pcf-extract-main"><div id="rvm-pcf-extract-panel-host"><div class="rvm-pcf-extract-status">Ready. Load an RVM bundle in the 3D viewer, then click "Rebuild 2D CSV".</div></div></section></div></div>
</div>`;
  container.querySelectorAll('[data-panel]').forEach(btn => btn.addEventListener('click', () => _showPanel(container, btn.dataset.panel)));
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        switch (btn.dataset.action) {
          case 'RELOAD_SCOPE': _updateHeader(container); _showPanel(container, 'scope'); break;
          case 'REBUILD_CSV': await _runRebuildCsv(container); _showPanel(container, 'table'); break;
          case 'VALIDATE': await _runValidate(container); break;
          case 'RUN_PCF_READINESS':
          case 'RUN_AUDIT':
          case 'CHECK_CONTINUITY': await _runPcfReadinessGate(container); break;
          case 'DRY_RUN_GAP_OVERLAP': await _dryRunReadinessGapOverlap(container); break;
          case 'APPLY_SAFE_GAP_OVERLAP':
          case 'AUTO_FIX_25MM': await _applySafeReadinessGapOverlapFix(container); break;
          case 'APPLY_RAY_SECOND_PASS': await _applyRaySecondPass(container); break;
          case 'EXPORT_READINESS_JSON': await _exportReadinessReport(container, 'json'); break;
          case 'EXPORT_READINESS_MD': await _exportReadinessReport(container, 'md'); break;
          case 'GENERATE_PCF': await _runGeneratePcf(container); break;
          case 'DOWNLOAD_CSV': await _runDownloadCsv(container); break;
          case 'DOWNLOAD_PCF': await _runDownloadPcf(container); break;
        }
      } finally { btn.disabled = false; }
    });
  });

  _offExtractRequested = on(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, async (payload = {}) => {
    const next = normalizeRvmJsonPcfRequestPayload({
      payload,
      appState: state,
    });

    updateRvmPcfExtractState({
      workflowMode: next.workflowMode,
      workflowAdapterId: next.workflowAdapterId,
      sourceKind: next.sourceKind,
      scope: next.scope,
      selectedCanonicalIds: next.selectedCanonicalIds,
      activeWorkflowPhase: next.activeWorkflowPhase,
      requestedPanel: next.requestedPanel,
    }, 'json-rvm-pcf-requested');

    _updateHeader(container);

    if (next.openWorkflow) {
      await _runRebuildCsv(container);
      _showPanel(container, next.requestedPanel === 'workflow' ? 'table' : next.requestedPanel);
    }
  });

  _offStateChanged = on(RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED, () => { _updateHeader(container); });
  _updateHeader(container); _showPanel(container, 'scope');
}

export function dispose() {
  if (_offExtractRequested) { _offExtractRequested(); _offExtractRequested = null; }
  if (_offStateChanged)     { _offStateChanged();     _offStateChanged     = null; }
}

export default mount;
