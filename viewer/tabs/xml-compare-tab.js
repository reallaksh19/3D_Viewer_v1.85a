import { parse } from '../parser/caesar-parser.js';
import { buildXmlGraphData } from '../parser/xml-graph-builder.js';
import { buildXmlSupportComponents } from '../parser/xml-support-builder.js';

export const XML_COMPARE_SCHEMA = 'xml-compare/v1';

export const XML_COMPARE_BLOCK_CODES = Object.freeze({
  SUPPORT_ATTACHMENT_MISSING: 'SUPPORT-ATTACHMENT-MISSING',
  TEE_BRANCH_CONNECTIVITY_CHANGED: 'TEE-BRANCH-CONNECTIVITY-CHANGED',
  OLET_BRANCH_CONNECTIVITY_CHANGED: 'OLET-BRANCH-CONNECTIVITY-CHANGED',
  TOPOLOGY_COORDINATE_MISMATCH: 'TOPOLOGY-COORDINATE-MISMATCH',
  TOPOLOGY_TYPE_MISMATCH: 'TOPOLOGY-TYPE-MISMATCH',
  TOPOLOGY_MISSING_COMPONENT: 'TOPOLOGY-MISSING-COMPONENT',
});

export const DEFAULT_XML_COMPARE_FILTERS = Object.freeze({
  severity: 'ALL',
  code: 'ALL',
  datasetId: 'ALL',
  search: '',
});

function clean(value) {
  return String(value ?? '').trim();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function point(value) {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 3) {
    return {
      x: number(value[0]),
      y: number(value[1]),
      z: number(value[2]),
    };
  }

  if (typeof value === 'string') {
    const parts = value.split(/[\s,]+/).map((item) => Number(item)).filter((item) => Number.isFinite(item));
    if (parts.length >= 3) {
      return { x: parts[0], y: parts[1], z: parts[2] };
    }
    return null;
  }

  if (typeof value === 'object') {
    const x = value.x ?? value.X;
    const y = value.y ?? value.Y;
    const z = value.z ?? value.Z;
    if ([x, y, z].every((item) => Number.isFinite(Number(item)))) {
      return { x: number(x), y: number(y), z: number(z) };
    }
  }

  return null;
}

function pointDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = number(a.x) - number(b.x);
  const dy = number(a.y) - number(b.y);
  const dz = number(a.z) - number(b.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pointSignature(value) {
  const p = point(value);
  if (!p) return '';
  return `${p.x.toFixed(3)}:${p.y.toFixed(3)}:${p.z.toFixed(3)}`;
}

function componentKey(component) {
  return clean(
    component?.id ||
    component?.source?.id ||
    component?.attributes?.['COMPONENT-ATTRIBUTE97'] ||
    component?.attributes?.SKEY ||
    component?.attributes?.['PIPELINE-REFERENCE'] ||
    `${component?.type || 'COMPONENT'}:${component?.rowNo || ''}`
  );
}

function componentLabel(component) {
  return clean(
    component?.label ||
    component?.name ||
    component?.attributes?.SKEY ||
    component?.id ||
    component?.type ||
    'COMPONENT'
  );
}

function normalizeComponent(component, datasetId, index) {
  const points = [component?.points?.[0], component?.points?.[1]]
    .map(point)
    .filter(Boolean);

  return {
    id: componentKey(component) || `${datasetId}-${index + 1}`,
    type: clean(component?.type || 'UNKNOWN').toUpperCase(),
    datasetId,
    pipelineRef: clean(
      component?.pipelineRef ||
      component?.attributes?.['PIPELINE-REFERENCE'] ||
      component?.source?.lineNo ||
      ''
    ),
    label: componentLabel(component),
    points,
    centrePoint: point(component?.centrePoint),
    branch1Point: point(component?.branch1Point),
    coOrds: point(component?.coOrds),
    supportKind: clean(component?.supportKind || component?.attributes?.SUPPORT_KIND || ''),
    supportDirection: clean(component?.supportDirection || component?.attributes?.SUPPORT_DIRECTION || ''),
    raw: component,
  };
}

function buildSyntheticSupportIssue(component, datasetId) {
  if (component.type !== 'SUPPORT') return null;

  if (!component.coOrds && !component.points.length) {
    return {
      code: XML_COMPARE_BLOCK_CODES.SUPPORT_ATTACHMENT_MISSING,
      severity: 'ERROR',
      datasetId,
      componentId: component.id,
      component: {
        componentId: component.id,
        type: component.type,
        pipeline: component.pipelineRef,
        label: component.label,
      },
      message: `Support component ${component.label} is missing attachment coordinates.`,
    };
  }

  return null;
}

function buildBranchIssue(component, datasetId) {
  if (component.type !== 'TEE' && component.type !== 'OLET') return null;

  const hasBranch = !!component.branch1Point;
  const hasCentre = !!component.centrePoint;
  if (hasBranch && hasCentre) {
    const branchDistance = pointDistance(component.branch1Point, component.centrePoint);
    if (branchDistance > 0.5) return null;
  }

  return {
    code: component.type === 'TEE'
      ? XML_COMPARE_BLOCK_CODES.TEE_BRANCH_CONNECTIVITY_CHANGED
      : XML_COMPARE_BLOCK_CODES.OLET_BRANCH_CONNECTIVITY_CHANGED,
    severity: 'ERROR',
    datasetId,
    componentId: component.id,
    component: {
      componentId: component.id,
      type: component.type,
      pipeline: component.pipelineRef,
      label: component.label,
    },
    message: `${component.type} branch connectivity could not be confirmed for ${component.label}.`,
  };
}

function buildDataset(fileName, text, datasetId) {
  const parsed = parse(text || '', fileName || `${datasetId}.xml`);
  const graph = buildXmlGraphData(parsed, fileName || `${datasetId}.xml`, {
    syntheticGapMm: 3000,
  });
  const supports = buildXmlSupportComponents(parsed, {
    nodePositions: graph.solvedNodePositions || {},
    defaultBore: 100,
    verticalAxis: 'Y',
  });

  const components = [
    ...(graph.components || []).map((component, index) => normalizeComponent(component, datasetId, index)),
    ...supports.map((component, index) => normalizeComponent(component, datasetId, (graph.components || []).length + index)),
  ];

  return {
    datasetId,
    fileName: fileName || '',
    parsed,
    graph,
    components,
    diagnostics: [
      ...(graph.diagnostics?.nodeConflicts || []),
    ],
  };
}

const buildXmlDataset = buildDataset;

function componentDistanceIssue(componentA, componentB, toleranceMm) {
  const aPoints = componentA.points;
  const bPoints = componentB.points;

  if (aPoints.length < 2 || bPoints.length < 2) return null;

  const direct = pointDistance(aPoints[0], bPoints[0]) + pointDistance(aPoints[1], bPoints[1]);
  const reverse = pointDistance(aPoints[0], bPoints[1]) + pointDistance(aPoints[1], bPoints[0]);
  const best = Math.min(direct, reverse);
  const distanceMm = best / 2;

  if (distanceMm <= toleranceMm) return null;

  return {
    code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_COORDINATE_MISMATCH,
    severity: 'WARNING',
    datasetId: componentA.datasetId,
    componentId: componentA.id,
    component: {
      componentId: componentA.id,
      type: componentA.type,
      pipeline: componentA.pipelineRef,
      label: componentA.label,
    },
    nearestComponent: {
      componentId: componentB.id,
      type: componentB.type,
      pipeline: componentB.pipelineRef,
      label: componentB.label,
    },
    distanceMm,
    toleranceMm,
    message: `Component ${componentA.label} moved by ${distanceMm.toFixed(1)} mm relative to ${componentB.label}.`,
  };
}

function buildIssuesFromDatasets(datasetA, datasetB, toleranceMm) {
  const issues = [];
  const mapA = new Map(datasetA.components.map((component) => [component.id, component]));
  const mapB = new Map(datasetB.components.map((component) => [component.id, component]));

  for (const componentA of datasetA.components) {
    const counterpart = mapB.get(componentA.id);

    if (!counterpart) {
      issues.push({
        code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_MISSING_COMPONENT,
        severity: 'WARNING',
        datasetId: datasetA.datasetId,
        componentId: componentA.id,
        component: {
          componentId: componentA.id,
          type: componentA.type,
          pipeline: componentA.pipelineRef,
          label: componentA.label,
        },
        message: `Component ${componentA.label} exists in ${datasetA.datasetId} but not in ${datasetB.datasetId}.`,
      });
      continue;
    }

    if (componentA.type !== counterpart.type) {
      issues.push({
        code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_TYPE_MISMATCH,
        severity: 'ERROR',
        datasetId: datasetA.datasetId,
        componentId: componentA.id,
        component: {
          componentId: componentA.id,
          type: componentA.type,
          pipeline: componentA.pipelineRef,
          label: componentA.label,
        },
        nearestComponent: {
          componentId: counterpart.id,
          type: counterpart.type,
          pipeline: counterpart.pipelineRef,
          label: counterpart.label,
        },
        message: `Component ${componentA.label} changed type from ${componentA.type} to ${counterpart.type}.`,
      });
    }

    const distanceIssue = componentDistanceIssue(componentA, counterpart, toleranceMm);
    if (distanceIssue) issues.push(distanceIssue);

    const supportIssue = buildSyntheticSupportIssue(componentA, datasetA.datasetId);
    if (supportIssue) issues.push(supportIssue);

    const branchIssue = buildBranchIssue(componentA, datasetA.datasetId);
    if (branchIssue) issues.push(branchIssue);
  }

  for (const componentB of datasetB.components) {
    if (!mapA.has(componentB.id)) {
      issues.push({
        code: XML_COMPARE_BLOCK_CODES.TOPOLOGY_MISSING_COMPONENT,
        severity: 'WARNING',
        datasetId: datasetB.datasetId,
        componentId: componentB.id,
        component: {
          componentId: componentB.id,
          type: componentB.type,
          pipeline: componentB.pipelineRef,
          label: componentB.label,
        },
        message: `Component ${componentB.label} exists in ${datasetB.datasetId} but not in ${datasetA.datasetId}.`,
      });
    }
  }

  return issues;
}

export function topologyIssuePassesFilters(issue, filters = DEFAULT_XML_COMPARE_FILTERS) {
  if (!issue) return false;
  const active = {
    severity: filters.severity || 'ALL',
    code: filters.code || 'ALL',
    datasetId: filters.datasetId || 'ALL',
    search: clean(filters.search || '').toLowerCase(),
  };

  if (active.severity !== 'ALL' && issue.severity !== active.severity) return false;
  if (active.code !== 'ALL' && issue.code !== active.code) return false;
  if (active.datasetId !== 'ALL' && issue.datasetId !== active.datasetId) return false;

  if (active.search) {
    const haystack = [
      issue.code,
      issue.severity,
      issue.datasetId,
      issue.componentId,
      issue.component?.type,
      issue.component?.pipeline,
      issue.component?.label,
      issue.nearestComponent?.componentId,
      issue.nearestComponent?.type,
      issue.nearestComponent?.label,
      issue.message,
    ].map((value) => clean(value).toLowerCase()).join(' ');

    if (!haystack.includes(active.search)) return false;
  }

  return true;
}

export function filterTopologyIssues(issues = [], filters = DEFAULT_XML_COMPARE_FILTERS) {
  return (Array.isArray(issues) ? issues : []).filter((issue) => topologyIssuePassesFilters(issue, filters));
}

export function topologyIssueComponentIds(issues = []) {
  return [...new Set((Array.isArray(issues) ? issues : []).map((issue) => issue?.componentId).filter(Boolean))];
}

export function buildTopologyIssuesCsv(issues = []) {
  const rows = [
    ['Code', 'Severity', 'Dataset', 'Component Id', 'Type', 'Pipeline', 'Label', 'Nearest Component Id', 'Distance mm', 'Tolerance mm', 'Message'],
  ];

  for (const issue of issues || []) {
    rows.push([
      issue.code || '',
      issue.severity || '',
      issue.datasetId || '',
      issue.componentId || '',
      issue.component?.type || '',
      issue.component?.pipeline || '',
      issue.component?.label || '',
      issue.nearestComponent?.componentId || '',
      issue.distanceMm != null ? number(issue.distanceMm).toFixed(1) : '',
      issue.toleranceMm != null ? number(issue.toleranceMm).toFixed(1) : '',
      issue.message || '',
    ]);
  }

  return rows
    .map((row) => row
      .map((value) => {
        const text = clean(value);
        return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      })
      .join(',')
    )
    .join('\n') + '\n';
}

export function compareXmlDatasets(datasetA, datasetB, options = {}) {
  const toleranceMm = number(options.toleranceMm, 6);
  const issues = buildIssuesFromDatasets(datasetA || { components: [], datasetId: 'A' }, datasetB || { components: [], datasetId: 'B' }, toleranceMm);
  const filtered = issues.filter(Boolean);
  const bySeverity = filtered.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    schema: XML_COMPARE_SCHEMA,
    ok: (bySeverity.ERROR || 0) === 0,
    toleranceMm,
    datasets: {
      A: {
        datasetId: datasetA?.datasetId || 'A',
        fileName: datasetA?.fileName || '',
        componentCount: datasetA?.components?.length || 0,
      },
      B: {
        datasetId: datasetB?.datasetId || 'B',
        fileName: datasetB?.fileName || '',
        componentCount: datasetB?.components?.length || 0,
      },
    },
    topologyIssues: {
      issues: filtered,
      summary: {
        issueCount: filtered.length,
        fixableCount: filtered.filter((issue) => issue.severity !== 'ERROR').length,
        fatalCount: filtered.filter((issue) => issue.severity === 'ERROR').length,
        severityCounts: bySeverity,
        issueCodes: [...new Set(filtered.map((issue) => issue.code))].sort(),
      },
    },
  };
}

export function normalizeXmlCompareDatasetFromText(fileName, text, datasetId) {
  try {
    return {
      ok: true,
      ...buildXmlDataset(fileName, text, datasetId),
    };
  } catch (error) {
    return {
      ok: false,
      datasetId,
      fileName: fileName || '',
      error: error?.message || String(error),
      parsed: null,
      graph: null,
      components: [],
      diagnostics: [],
    };
  }
}

export function buildXmlCompareReport({
  fileNameA = 'xml-a.xml',
  textA = '',
  fileNameB = 'xml-b.xml',
  textB = '',
  toleranceMm = 6,
} = {}) {
  const datasetA = normalizeXmlCompareDatasetFromText(fileNameA, textA, 'A');
  const datasetB = normalizeXmlCompareDatasetFromText(fileNameB, textB, 'B');

  if (!datasetA.ok || !datasetB.ok) {
    return {
      schema: XML_COMPARE_SCHEMA,
      ok: false,
      toleranceMm,
      datasets: { A: datasetA, B: datasetB },
      topologyIssues: {
        issues: [],
        summary: {
          issueCount: 0,
          fixableCount: 0,
          fatalCount: 0,
          severityCounts: {},
          issueCodes: [],
        },
      },
      parseErrors: [datasetA.error, datasetB.error].filter(Boolean),
    };
  }

  const report = compareXmlDatasets(datasetA, datasetB, { toleranceMm });

  return {
    ...report,
    datasets: { A: datasetA, B: datasetB },
    parseErrors: [],
  };
}

function createInitialState() {
  return {
    fileA: null,
    fileB: null,
    textA: '',
    textB: '',
    report: null,
    filters: { ...DEFAULT_XML_COMPARE_FILTERS },
    selectedIssueId: '',
    hiddenComponentIds: new Set(),
    status: { kind: 'info', message: 'Load XML files to compare topology.' },
  };
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderIssueRow(issue, state) {
  const selected = state.selectedIssueId === issue.componentId;
  const hidden = state.hiddenComponentIds.has(issue.componentId);

  return `
    <tr
      data-xml-compare-topology-row
      data-component-id="${esc(issue.componentId)}"
      data-dataset-id="${esc(issue.datasetId)}"
      class="${selected ? 'is-selected' : ''} ${hidden ? 'is-hidden' : ''} severity-${esc(String(issue.severity || '').toLowerCase())}"
    >
      <td>${esc(issue.severity || '')}</td>
      <td>${esc(issue.code || '')}</td>
      <td>${esc(issue.datasetId || '')}</td>
      <td>${esc(issue.component?.label || issue.componentId || '')}</td>
      <td>${issue.distanceMm != null ? esc(number(issue.distanceMm).toFixed(1)) : '—'}</td>
    </tr>
  `;
}

function renderFilters(state) {
  return `
    <div class="xml-compare-topology-filters">
      <select data-xml-compare-topology-filter="severity" title="Filter severity">
        <option value="ALL" ${state.filters.severity === 'ALL' ? 'selected' : ''}>All severities</option>
        <option value="ERROR" ${state.filters.severity === 'ERROR' ? 'selected' : ''}>Errors</option>
        <option value="WARNING" ${state.filters.severity === 'WARNING' ? 'selected' : ''}>Warnings</option>
        <option value="INFO" ${state.filters.severity === 'INFO' ? 'selected' : ''}>Info</option>
      </select>

      <select data-xml-compare-topology-filter="datasetId" title="Filter XML dataset">
        <option value="ALL" ${state.filters.datasetId === 'ALL' ? 'selected' : ''}>XML A+B</option>
        <option value="A" ${state.filters.datasetId === 'A' ? 'selected' : ''}>XML A</option>
        <option value="B" ${state.filters.datasetId === 'B' ? 'selected' : ''}>XML B</option>
      </select>

      <select data-xml-compare-topology-filter="code" title="Filter issue code">
        <option value="ALL">All codes</option>
      </select>

      <input
        data-xml-compare-topology-filter="search"
        type="search"
        placeholder="Search issue/component/pipeline"
        title="Search topology issues"
        value="${esc(state.filters.search)}"
      >
    </div>
  `;
}

function updateCodeFilterOptions(container, report, state) {
  const select = container.querySelector('[data-xml-compare-topology-filter="code"]');
  if (!select) return;

  const codes = [...new Set((report?.topologyIssues?.issues || []).map((issue) => issue.code).filter(Boolean))].sort();
  const current = state.filters.code || 'ALL';

  select.innerHTML = [
    '<option value="ALL">All codes</option>',
    ...codes.map((code) => `<option value="${esc(code)}" ${code === current ? 'selected' : ''}>${esc(code)}</option>`),
  ].join('');

  if (!codes.includes(current)) select.value = 'ALL';
}

function renderSummary(report) {
  if (!report) {
    return '<div class="xml-compare-empty">Load XML files to build a comparison report.</div>';
  }

  const summary = report.topologyIssues.summary;
  return `
    <div class="xml-compare-summary-grid">
      <div><b>Dataset A</b><span>${esc(report.datasets.A.fileName || 'XML A')}</span></div>
      <div><b>Dataset B</b><span>${esc(report.datasets.B.fileName || 'XML B')}</span></div>
      <div><b>Issues</b><span>${summary.issueCount}</span></div>
      <div><b>Errors</b><span>${summary.severityCounts.ERROR || 0}</span></div>
      <div><b>Warnings</b><span>${summary.severityCounts.WARNING || 0}</span></div>
      <div><b>Info</b><span>${summary.severityCounts.INFO || 0}</span></div>
      <div><b>Support attachment issues</b><span>${(summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.SUPPORT_ATTACHMENT_MISSING) ? 'YES' : 'NO')}</span></div>
      <div><b>TEE/OLET branch issues</b><span>${(
        summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.TEE_BRANCH_CONNECTIVITY_CHANGED) ||
        summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.OLET_BRANCH_CONNECTIVITY_CHANGED)
      ) ? 'YES' : 'NO'}</span></div>
    </div>
  `;
}

function filteredIssues(report, state) {
  return filterTopologyIssues(report?.topologyIssues?.issues || [], state.filters)
    .filter((issue) => !state.hiddenComponentIds.has(issue.componentId));
}

function renderIssueDetails(report, state) {
  if (!report) {
    return '<div class="xml-compare-empty">No report yet.</div>';
  }

  const issue = (report.topologyIssues.issues || []).find((item) => item.componentId === state.selectedIssueId) || null;
  if (!issue) {
    return '<div class="xml-compare-empty">Select an issue to inspect it here.</div>';
  }

  return `
    <div class="xml-compare-detail-card">
      <div><b>Code</b><span>${esc(issue.code)}</span></div>
      <div><b>Severity</b><span>${esc(issue.severity)}</span></div>
      <div><b>Dataset</b><span>${esc(issue.datasetId)}</span></div>
      <div><b>Component</b><span>${esc(issue.component?.label || issue.componentId)}</span></div>
      <div><b>Message</b><span>${esc(issue.message || '')}</span></div>
    </div>
  `;
}

function render(container, state) {
  const report = state.report;
  const issues = filteredIssues(report, state);

  container.innerHTML = `
    <div class="xml-compare-tab">
      <header class="xml-compare-header">
        <div>
          <h2>XML Compare</h2>
          <p>Normal 3D Viewer XML comparison workspace. This tab compares two XML datasets, surfaces topology issues, and keeps the output separate from the RVM viewer.</p>
        </div>
      </header>

      <section class="xml-compare-toolbar">
        <label class="xml-compare-file-btn">
          Load XML A
          <input data-xml-compare-load="a" type="file" accept=".xml,.XML">
        </label>
        <label class="xml-compare-file-btn">
          Load XML B
          <input data-xml-compare-load="b" type="file" accept=".xml,.XML">
        </label>
        <button type="button" data-xml-compare-action="compare" ${state.textA && state.textB ? '' : 'disabled'}>Compare XML</button>
        <button type="button" data-xml-compare-action="show-all">Show All</button>
        <button type="button" data-xml-compare-action="hide-filtered">Hide Filtered</button>
        <button type="button" data-xml-compare-action="isolate-filtered">Isolate Filtered</button>
        <button type="button" data-xml-compare-action="export-filtered-csv" ${issues.length ? '' : 'disabled'}>Export Filtered CSV</button>
      </section>

      <div class="xml-compare-status ${state.status.kind}">
        ${esc(state.status.message)}
      </div>

      <main class="xml-compare-layout">
        <section class="xml-compare-panel">
          <div class="xml-compare-panel-title">Comparison Summary</div>
          ${renderSummary(report)}
        </section>

        <section class="xml-compare-panel">
          <div class="xml-compare-panel-title">Topology Issues</div>
          ${renderFilters(state)}
          <div class="xml-compare-topology-actions">
            <button type="button" data-xml-compare-topology-action="hide-filtered">Hide Filtered</button>
            <button type="button" data-xml-compare-topology-action="isolate-filtered">Isolate Filtered</button>
            <button type="button" data-xml-compare-topology-action="show-all">Show All</button>
            <button type="button" data-xml-compare-topology-action="export-filtered-csv">Export Filtered CSV</button>
          </div>
          <div class="xml-compare-topology-filter-summary">${issues.length} shown / ${(report?.topologyIssues?.issues || []).length} total</div>
          <div data-xml-compare-topology-issues>
            ${issues.length ? `
              <table class="xml-compare-topology-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>XML</th>
                    <th>Component</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  ${issues.map((issue) => renderIssueRow(issue, state)).join('')}
                </tbody>
              </table>
            ` : '<div class="xml-compare-empty">No topology issues match the current filters.</div>'}
          </div>
        </section>

        <section class="xml-compare-panel">
          <div class="xml-compare-panel-title">Issue Details</div>
          ${renderIssueDetails(report, state)}
        </section>
      </main>
    </div>
  `;

  updateCodeFilterOptions(container, report, state);
}

function downloadText(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function currentReportCsv(state) {
  const issues = filterTopologyIssues(state.report?.topologyIssues?.issues || [], state.filters);
  return buildTopologyIssuesCsv(issues);
}

function bind(container, state) {
  container.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-xml-compare-load]');
    if (input && container.contains(input)) {
      const file = input.files?.[0] || null;
      if (!file) return;

      const text = await file.text();
      if (input.dataset.xmlCompareLoad === 'a') {
        state.fileA = file;
        state.textA = text;
      } else {
        state.fileB = file;
        state.textB = text;
      }

      state.status = { kind: 'info', message: `Loaded ${file.name}.` };
      render(container, state);
      return;
    }

    const filter = event.target.closest('[data-xml-compare-topology-filter]');
    if (filter && container.contains(filter)) {
      const key = filter.dataset.xmlCompareTopologyFilter;
      state.filters = {
        ...state.filters,
        [key]: key === 'search' ? clean(filter.value) : filter.value,
      };
      render(container, state);
    }
  });

  container.addEventListener('input', (event) => {
    const search = event.target.closest('[data-xml-compare-topology-filter="search"]');
    if (search && container.contains(search)) {
      state.filters = {
        ...state.filters,
        search: clean(search.value),
      };
      render(container, state);
    }
  });

  container.addEventListener('click', (event) => {
    const action = event.target.closest('[data-xml-compare-action]')?.dataset.xmlCompareAction;
    const topologyAction = event.target.closest('[data-xml-compare-topology-action]')?.dataset.xmlCompareTopologyAction;
    const row = event.target.closest('[data-xml-compare-topology-row]');

    if (row && container.contains(row)) {
      state.selectedIssueId = row.dataset.componentId || '';
      render(container, state);
      return;
    }

    if (action === 'compare') {
      state.report = buildXmlCompareReport({
        fileNameA: state.fileA?.name || 'xml-a.xml',
        textA: state.textA,
        fileNameB: state.fileB?.name || 'xml-b.xml',
        textB: state.textB,
        toleranceMm: 6,
      });
      state.status = {
        kind: state.report.ok ? 'ok' : 'warn',
        message: state.report.ok
          ? `Comparison complete. ${state.report.topologyIssues.summary.issueCount} issue(s).`
          : `Comparison complete with ${state.report.topologyIssues.summary.fatalCount} fatal issue(s).`,
      };
      render(container, state);
      return;
    }

    if (action === 'show-all' || topologyAction === 'show-all') {
      state.hiddenComponentIds = new Set();
      render(container, state);
      return;
    }

    if (action === 'hide-filtered' || topologyAction === 'hide-filtered') {
      const ids = topologyIssueComponentIds(filterTopologyIssues(state.report?.topologyIssues?.issues || [], state.filters));
      state.hiddenComponentIds = new Set([...state.hiddenComponentIds, ...ids]);
      render(container, state);
      return;
    }

    if (action === 'isolate-filtered' || topologyAction === 'isolate-filtered') {
      const ids = new Set(topologyIssueComponentIds(filterTopologyIssues(state.report?.topologyIssues?.issues || [], state.filters)));
      const allIds = new Set((state.report?.topologyIssues?.issues || []).map((issue) => issue.componentId));
      state.hiddenComponentIds = new Set([...allIds].filter((id) => !ids.has(id)));
      render(container, state);
      return;
    }

    if (action === 'export-filtered-csv' || topologyAction === 'export-filtered-csv') {
      if (!state.report) return;
      downloadText('xml-compare-filtered-topology-issues.csv', currentReportCsv(state), 'text/csv;charset=utf-8');
      state.status = { kind: 'info', message: `Exported ${filterTopologyIssues(state.report.topologyIssues.issues || [], state.filters).length} filtered issue(s).` };
      render(container, state);
    }
  });
}

export function renderXmlCompareTab(container) {
  const state = createInitialState();
  render(container, state);
  bind(container, state);
  return () => {
    container.innerHTML = '';
  };
}

export const _test = Object.freeze({
  createInitialState,
  normalizeXmlCompareDatasetFromText,
  compareXmlDatasets,
  buildXmlCompareReport,
  topologyIssuePassesFilters,
  filterTopologyIssues,
  topologyIssueComponentIds,
  buildTopologyIssuesCsv,
});
