/**
 * viewer3d-xml-compare-panel.js
 *
 * XML Diff side panel for the normal 3D Viewer. The panel lets a user choose
 * the InputXML import route, load two XML files, align / transform XML B
 * relative to XML A, and inspect route reports.
 */

import {
  DEFAULT_INPUTXML_IMPORT_ROUTE,
  INPUTXML_IMPORT_ROUTES,
  INPUTXML_IMPORT_ROUTE_STORAGE_KEY,
  inputXmlImportRouteLabel,
  normalizeInputXmlImportRoute,
  persistInputXmlImportRoute,
} from '../xml-compare/InputXmlImportRoutes.js';
import { importInputXmlByRoute } from '../xml-compare/InputXmlImportRouter.js';
import {
  buildInputXmlRouteReport,
  formatInputXmlRouteReportLines,
} from '../xml-compare/InputXmlRouteReport.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── Geometry / transform helpers ───────────────────────────────────────────

function computeBounds(components) {
  const pts = [];
  for (const comp of asArray(components)) {
    for (const pt of asArray(comp?.points)) {
      if (pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.z ?? pt.y))) {
        pts.push(pt);
      }
    }
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => Number(p.x));
  const ys = pts.map((p) => Number(p.y ?? 0));
  const zs = pts.map((p) => Number(p.z ?? p.y ?? 0));
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
    minZ: Math.min(...zs), maxZ: Math.max(...zs),
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    cz: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}

/**
 * Apply transform to a single 3-D point.
 * Order: rotate around centroid (Y axis), then translate.
 */
function applyTransformToPoint(pt, transform, centroid) {
  if (!pt) return pt;
  const { tx, ty, tz, ry } = transform;
  const rad = (ry * Math.PI) / 180;
  const cosY = Math.cos(rad);
  const sinY = Math.sin(rad);
  const cx = numOr(centroid?.cx);
  const cz = numOr(centroid?.cz);

  const dx = numOr(pt.x) - cx;
  const dz = numOr(pt.z ?? pt.y) - cz;

  return {
    x: cx + dx * cosY + dz * sinY + tx,
    y: numOr(pt.y) + ty,
    z: cz - dx * sinY + dz * cosY + tz,
  };
}

function applyTransformToComponents(components, transform, centroid) {
  const identity =
    transform.tx === 0 && transform.ty === 0 &&
    transform.tz === 0 && transform.ry === 0;
  if (identity) return asArray(components);

  return asArray(components).map((comp) => ({
    ...comp,
    points: asArray(comp?.points).map((pt) => applyTransformToPoint(pt, transform, centroid)),
    centrePoint: applyTransformToPoint(comp?.centrePoint, transform, centroid),
    branch1Point: applyTransformToPoint(comp?.branch1Point, transform, centroid),
    coOrds: applyTransformToPoint(comp?.coOrds, transform, centroid),
  }));
}

// ── SVG geometry overlay ───────────────────────────────────────────────────

function toXZ(point) {
  if (!point) return null;
  const x = Number(point.x ?? point.X);
  const z = Number(point.z ?? point.Z ?? point.y ?? point.Y);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

function collectLines(components) {
  const lines = [];
  for (const comp of asArray(components)) {
    const pts = asArray(comp?.points);
    const p0 = toXZ(pts[0]);
    const p1 = toXZ(pts[1] ?? pts[0]);
    if (p0 && p1) lines.push({ p0, p1 });
  }
  return lines;
}

function renderGeometryOverlaySvg(componentsA, componentsB) {
  const linesA = collectLines(componentsA);
  const linesB = collectLines(componentsB);
  const all = [...linesA, ...linesB];
  if (!all.length) return '';

  const xs = all.flatMap((l) => [l.p0.x, l.p1.x]);
  const zs = all.flatMap((l) => [l.p0.z, l.p1.z]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = 12;
  const W = 320, H = 220;
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const sx = (x) => pad + ((x - minX) / spanX) * (W - pad * 2);
  const sy = (z) => H - pad - ((z - minZ) / spanZ) * (H - pad * 2);

  const pathsA = linesA.map((l) =>
    `<line x1="${sx(l.p0.x).toFixed(1)}" y1="${sy(l.p0.z).toFixed(1)}" x2="${sx(l.p1.x).toFixed(1)}" y2="${sy(l.p1.z).toFixed(1)}" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`
  ).join('');
  const pathsB = linesB.map((l) =>
    `<line x1="${sx(l.p0.x).toFixed(1)}" y1="${sy(l.p0.z).toFixed(1)}" x2="${sx(l.p1.x).toFixed(1)}" y2="${sy(l.p1.z).toFixed(1)}" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`
  ).join('');

  return `
    <div class="v3d-xc-geo-overlay">
      <div class="v3d-xc-geo-legend">
        <span class="v3d-xc-geo-legend-a">— XML A</span>
        <span class="v3d-xc-geo-legend-b">— XML B</span>
        <span class="v3d-xc-geo-legend-note">XZ plan view</span>
      </div>
      <svg class="v3d-xc-geo-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="XML A vs B geometry overlay">
        <rect width="${W}" height="${H}" fill="#060f1e" rx="4"/>
        ${pathsA}
        ${pathsB}
      </svg>
    </div>
  `;
}

// ── Report card ────────────────────────────────────────────────────────────

function renderReportCard(datasetId, report) {
  if (!report) {
    return `
      <div class="v3d-xc-route-card is-empty">
        <b>XML ${esc(datasetId)}</b>
        <span>No file loaded</span>
      </div>
    `;
  }

  const lines = formatInputXmlRouteReportLines(report);
  return `
    <div class="v3d-xc-route-card ${report.ok ? 'is-ok' : 'is-fail'}">
      <b>XML ${esc(datasetId)}</b>
      ${lines.map((line) => `<span>${esc(line)}</span>`).join('')}
    </div>
  `;
}

// ── Transform panel ────────────────────────────────────────────────────────

function renderTransformPanel(transformB, hasA, hasB) {
  if (!hasB) return '';
  const fmt = (n) => Number.isFinite(n) ? Number(n.toFixed(1)) : 0;
  return `
    <div class="v3d-xc-transform">
      <div class="v3d-xc-section-title">Align XML B to A</div>
      <div class="v3d-xc-transform-actions">
        <button type="button" class="v3d-xc-transform-btn" data-v3d-xc-action="fit-origin"
          ${hasA && hasB ? '' : 'disabled'} title="Translate B so its centroid coincides with A">
          ⊕ Fit Origin
        </button>
        <button type="button" class="v3d-xc-transform-btn v3d-xc-transform-btn--ghost"
          data-v3d-xc-action="reset-transform" title="Reset all offsets to zero">
          ↺ Reset
        </button>
      </div>
      <div class="v3d-xc-transform-grid">
        <label class="v3d-xc-transform-field">
          <span>X offset (mm)</span>
          <input type="number" step="100" data-v3d-xc-transform="tx" value="${fmt(transformB.tx)}">
        </label>
        <label class="v3d-xc-transform-field">
          <span>Y offset (mm)</span>
          <input type="number" step="100" data-v3d-xc-transform="ty" value="${fmt(transformB.ty)}">
        </label>
        <label class="v3d-xc-transform-field">
          <span>Z offset (mm)</span>
          <input type="number" step="100" data-v3d-xc-transform="tz" value="${fmt(transformB.tz)}">
        </label>
        <label class="v3d-xc-transform-field">
          <span>Rotate Y (°)</span>
          <input type="number" step="15" min="-360" max="360" data-v3d-xc-transform="ry" value="${fmt(transformB.ry)}">
        </label>
      </div>
    </div>
  `;
}

// ── Compare result ─────────────────────────────────────────────────────────

function buildCompareResult(rA, rB) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const diff = (a, b) => {
    const na = num(a), nb = num(b);
    if (na == null || nb == null) return null;
    return nb - na;
  };
  const fmtDiff = (d) => {
    if (d == null) return '—';
    return d > 0 ? `+${d}` : String(d);
  };

  const rows = [
    { label: 'File A', a: rA.fileName, b: null },
    { label: 'File B', a: null, b: rB.fileName },
    { label: 'Status', a: rA.ok ? 'OK' : 'FAILED', b: rB.ok ? 'OK' : 'FAILED' },
    { label: 'Components', a: rA.componentCount, b: rB.componentCount, numeric: true },
    { label: 'Diagnostics', a: rA.diagnosticsCount ?? rA.diagnosticsSummary?.total, b: rB.diagnosticsCount ?? rB.diagnosticsSummary?.total, numeric: true },
  ];

  if (rA.mode === 'native' || rB.mode === 'native') {
    rows.push({ label: 'Supports', a: rA.native?.supportCount, b: rB.native?.supportCount, numeric: true });
    rows.push({ label: 'Parsed Format', a: rA.native?.parsedFormat, b: rB.native?.parsedFormat });
  }

  if (rA.mode === 'uxml-round-trip' || rB.mode === 'uxml-round-trip') {
    rows.push({ label: 'UXML Components', a: rA.uxml?.componentCount, b: rB.uxml?.componentCount, numeric: true });
    rows.push({ label: 'UXML Anchors', a: rA.uxml?.anchorCount, b: rB.uxml?.anchorCount, numeric: true });
    rows.push({ label: 'Universal Nodes', a: rA.topology?.universalNodeCount, b: rB.topology?.universalNodeCount, numeric: true });
    rows.push({ label: 'Universal Edges', a: rA.topology?.universalEdgeCount, b: rB.topology?.universalEdgeCount, numeric: true });
    rows.push({ label: 'Export Allowed', a: rA.topology?.exportAllowed === true ? 'yes' : 'no', b: rB.topology?.exportAllowed === true ? 'yes' : 'no' });
  }

  const enriched = rows.map((row) => ({
    ...row,
    diff: row.numeric ? fmtDiff(diff(row.a, row.b)) : null,
  }));

  const bothOk = rA.ok && rB.ok;
  const componentDiff = diff(rA.componentCount, rB.componentCount);

  return {
    rows: enriched,
    ok: bothOk,
    summary: bothOk
      ? `Both files OK. Components: ${rA.componentCount} vs ${rB.componentCount} (${fmtDiff(componentDiff)}).`
      : `One or both files failed to parse.`,
  };
}

function renderCompareResult(result, componentsA, componentsB) {
  if (!result) return '';
  const statusClass = result.ok ? 'is-ok' : 'is-fail';
  const rowsHtml = result.rows
    .filter((row) => row.a != null || row.b != null)
    .map((row) => `
      <tr>
        <td class="v3d-xc-diff-label">${esc(row.label)}</td>
        <td class="v3d-xc-diff-a">${esc(String(row.a ?? '—'))}</td>
        <td class="v3d-xc-diff-b">${esc(String(row.b ?? '—'))}</td>
        <td class="v3d-xc-diff-delta ${row.diff && row.diff !== '0' ? 'has-change' : ''}">${esc(row.diff ?? '')}</td>
      </tr>
    `).join('');

  return `
    <div class="v3d-xc-compare-result ${statusClass}">
      <b>Compare Result</b>
      <span class="v3d-xc-compare-summary">${esc(result.summary)}</span>
      ${renderGeometryOverlaySvg(componentsA, componentsB)}
      <table class="v3d-xc-diff-table">
        <thead><tr><th></th><th>A</th><th>B</th><th>Diff</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// ── Mount ──────────────────────────────────────────────────────────────────

export function mountXmlComparePanel(containerEl, callbacks = {}) {
  if (!containerEl) {
    throw new Error('An XML compare panel container is required.');
  }

  const state = {
    inputXmlRoute: normalizeInputXmlImportRoute(DEFAULT_INPUTXML_IMPORT_ROUTE),
    datasets: { A: null, B: null },
    routeReports: { A: null, B: null },
    compareResult: null,
    // Transform applied to XML B before SVG preview and 3D canvas push.
    // Rotation (ry) is around B's centroid on the XZ plane; translation (tx/ty/tz) applied after.
    transformB: { tx: 0, ty: 0, tz: 0, ry: 0 },
    _centroidB: null,
  };

  let disposed = false;

  // ── Derived / transform ──────────────────────────────────────────────────

  function getTransformedComponentsB() {
    return applyTransformToComponents(
      state.datasets.B?.components,
      state.transformB,
      state._centroidB,
    );
  }

  function fitOrigin() {
    const boundsA = computeBounds(state.datasets.A?.components);
    const boundsB = state._centroidB;
    if (!boundsA || !boundsB) return;
    state.transformB.tx = boundsA.cx - boundsB.cx;
    state.transformB.ty = boundsA.cy - boundsB.cy;
    state.transformB.tz = boundsA.cz - boundsB.cz;
    state.compareResult = null;
    render();
  }

  function resetTransform() {
    state.transformB = { tx: 0, ty: 0, tz: 0, ry: 0 };
    state.compareResult = null;
    render();
  }

  // ── Dataset loading ──────────────────────────────────────────────────────

  async function loadDataset(datasetId, file) {
    if (!file || disposed) return;

    const text = await file.text();
    if (disposed) return;

    const result = importInputXmlByRoute(text, {
      route: state.inputXmlRoute,
      fileName: file.name,
      allowPartialImport: true,
    });

    const report = buildInputXmlRouteReport(result, {
      fileName: file.name,
      route: state.inputXmlRoute,
    });

    state.datasets[datasetId] = result;
    state.routeReports[datasetId] = report;
    state.compareResult = null;

    if (datasetId === 'B') {
      // Recompute B centroid and clear stale transform when a new B is loaded
      state._centroidB = computeBounds(result.components);
      state.transformB = { tx: 0, ty: 0, tz: 0, ry: 0 };
    }

    callbacks.onDatasetLoaded?.(datasetId, result);
    render();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function clear() {
    state.datasets.A = null;
    state.datasets.B = null;
    state.routeReports.A = null;
    state.routeReports.B = null;
    state.compareResult = null;
    state.transformB = { tx: 0, ty: 0, tz: 0, ry: 0 };
    state._centroidB = null;
    callbacks.onClear?.();
    render();
  }

  function preview() {
    if (!state.datasets.A || !state.datasets.B) return;
    callbacks.onPreviewOverlay?.(state.datasets.A, state.datasets.B);
  }

  function compare() {
    if (!state.datasets.A || !state.datasets.B) return;
    state.compareResult = buildCompareResult(state.routeReports.A, state.routeReports.B);
    callbacks.onCompare?.(state.routeReports.A, state.routeReports.B);
    render();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    if (disposed) return;

    const hasA = !!state.datasets.A;
    const hasB = !!state.datasets.B;
    const transformedB = hasB ? getTransformedComponentsB() : [];
    const componentsA = asArray(state.datasets.A?.components);

    containerEl.innerHTML = `
      <div class="v3d-xc-panel" data-inputxml-route-storage-key="${esc(INPUTXML_IMPORT_ROUTE_STORAGE_KEY)}">

        <div class="v3d-xc-toolbar">
          <label class="v3d-xc-file">
            Load XML A
            <input type="file" accept=".xml,.XML" data-v3d-xc-load="A" hidden>
          </label>
          <label class="v3d-xc-file">
            Load XML B
            <input type="file" accept=".xml,.XML" data-v3d-xc-load="B" hidden>
          </label>
          <label class="v3d-xc-route">
            InputXML Route
            <select data-v3d-xc-inputxml-route>
              <option value="${INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP}" ${state.inputXmlRoute === INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP ? 'selected' : ''}>UXML Round Trip</option>
              <option value="${INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER}" ${state.inputXmlRoute === INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER ? 'selected' : ''}>Native XML Builder</option>
            </select>
          </label>
          <button type="button" data-v3d-xc-action="preview">Preview</button>
          <button type="button" data-v3d-xc-action="compare">Compare</button>
          <button type="button" data-v3d-xc-action="clear">Clear</button>
        </div>

        <div class="v3d-xc-status">
          <span>Selected route: ${esc(inputXmlImportRouteLabel(state.inputXmlRoute))}</span>
        </div>

        <div class="v3d-xc-report-grid">
          ${renderReportCard('A', state.routeReports.A)}
          ${renderReportCard('B', state.routeReports.B)}
        </div>

        ${renderTransformPanel(state.transformB, hasA, hasB)}

        ${renderCompareResult(state.compareResult, componentsA, transformedB)}

        ${state.compareResult ? `
          <button type="button" class="v3d-xc-push-btn" data-v3d-xc-action="push-to-canvas">
            ⬆ Push to 3D Canvas
          </button>
        ` : ''}

      </div>
    `;
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function onChange(event) {
    // Route selector
    const routeSelect = event.target.closest('[data-v3d-xc-inputxml-route]');
    if (routeSelect && containerEl.contains(routeSelect)) {
      state.inputXmlRoute = persistInputXmlImportRoute(routeSelect.value);
      render();
      return;
    }

    // File inputs
    const fileInput = event.target.closest('[data-v3d-xc-load]');
    if (fileInput && containerEl.contains(fileInput)) {
      const datasetId = fileInput.dataset.v3dXcLoad;
      const file = fileInput.files?.[0] || null;
      fileInput.value = '';
      loadDataset(datasetId, file);
      return;
    }

    // Transform number inputs — live update SVG + 3D canvas
    const transformInput = event.target.closest('[data-v3d-xc-transform]');
    if (transformInput && containerEl.contains(transformInput)) {
      const key = transformInput.dataset.v3dXcTransform;
      const value = Number(transformInput.value);
      if (Number.isFinite(value) && key in state.transformB) {
        state.transformB[key] = value;
        state.compareResult = null;
        // Push updated transform to 3D canvas live if already showing
        callbacks.onPushToCanvas?.(
          state.datasets.A,
          { ...state.datasets.B, components: getTransformedComponentsB() },
        );
        render();
      }
    }
  }

  function onClick(event) {
    const action = event.target.closest('[data-v3d-xc-action]')?.dataset.v3dXcAction;
    if (!action) return;

    if (action === 'preview') { preview(); return; }

    if (action === 'compare') { compare(); return; }

    if (action === 'fit-origin') { fitOrigin(); return; }

    if (action === 'reset-transform') { resetTransform(); return; }

    if (action === 'push-to-canvas') {
      if (state.datasets.A && state.datasets.B) {
        callbacks.onPushToCanvas?.(
          state.datasets.A,
          { ...state.datasets.B, components: getTransformedComponentsB() },
        );
      }
      return;
    }

    if (action === 'clear') { clear(); }
  }

  containerEl.addEventListener('change', onChange);
  containerEl.addEventListener('click', onClick);

  render();

  return {
    destroy() {
      disposed = true;
      containerEl.removeEventListener('change', onChange);
      containerEl.removeEventListener('click', onClick);
      containerEl.innerHTML = '';
    },
    getState() {
      return {
        inputXmlRoute: state.inputXmlRoute,
        routeStorageKey: INPUTXML_IMPORT_ROUTE_STORAGE_KEY,
        hasA: !!state.datasets.A,
        hasB: !!state.datasets.B,
        routeA: state.routeReports.A?.route || '',
        routeB: state.routeReports.B?.route || '',
        transformB: { ...state.transformB },
      };
    },
  };
}
