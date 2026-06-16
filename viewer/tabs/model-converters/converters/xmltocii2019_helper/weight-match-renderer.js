import { collectXmlCiiWeightMatchRows } from '../../../../converters/xml-cii2019-core/weight-match-model.js';
import {
  ensureValveHintConfig,
  formatValveHint,
  rankXmlCiiWeightCandidates,
  valveHintLengthToleranceMm,
  valveHintMappingRows,
} from '../../../../converters/xml-cii2019-core/weight-valve-hints.js';

function t(value) {
  return value === null || value === undefined ? '' : String(value);
}

function esc(value) {
  return t(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function attr(value) {
  return esc(value).replaceAll("'", '&#39;');
}

function nfmt(value, digits = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '';
}

function desc(candidate) {
  return t(candidate?.typeDesc || candidate?.valveType || candidate?.type || 'Unknown').trim() || 'Unknown';
}

function selectedWeight(candidate) {
  return candidate?.selectedWeight ?? candidate?.suggestedWeight ?? candidate?.weight ?? '';
}

function isExtrapolated(candidate) {
  return candidate?.weightMethod === 'length-extrapolated';
}

function convOn(config) {
  return config?.weight?.convertSmallLengthsInToMm === true;
}

function allowedType(value) {
  const type = t(value).trim().toUpperCase();
  return type === 'RIGID' || type.startsWith('FLAN') || ['VALV', 'VALVE', 'VLV'].includes(type);
}

function unsafeDtxr(row) {
  const source = t(row?.dtxrSource).toLowerCase();
  const dtxr = t(row?.dtxr).toUpperCase();
  return /owner|support|ps-tag/.test(source) && /(PIPE REST|SUPPORT|GUIDE|STOP|SHOE|WEAR PLATE|TEE|ELBOW|BEND|REDUCER)/.test(dtxr);
}

function cleanRow(row) {
  if (!allowedType(row?.componentType)) return null;
  return unsafeDtxr(row) ? { ...row, dtxr: '', dtxrSource: 'weight-dtxr-suppressed' } : row;
}

async function stagedText(stagedJsonText) {
  const direct = t(stagedJsonText).trim();
  if (direct) return direct;
  const file = document?.querySelector?.('#model-converters-secondary-input')?.files?.[0];
  return file ? await file.text().catch(() => '') : '';
}

function helpText(config) {
  const tolerance = valveHintLengthToleranceMm(config);
  return [
    'Rows included: only RIGID, FLAN*, VALV / VALVE / VLV.',
    'Rows excluded: ATTA/support, TEE, ELBO/BEND, REDUCER, OLET, PIPE, GASK.',
    `Length rule: master length must be within ±${tolerance} mm of XML ElementLengthMm.`,
    'Valve hint rule: NodeName hints are used only after length passes.',
    'Type/TypeDesc regex can reorder candidates only inside the length-qualified group.',
    'Weight extrapolation: selected accepted candidates may use length-extrapolated weight when enabled.',
    'Rejected candidates are visible for diagnostics but are never auto-filled.',
  ].join('\n');
}

function hintRows(config) {
  return valveHintMappingRows(config).map((row, index) => `
    <tr>
      <td><input type="checkbox" data-hint-i="${index}" data-hint-f="on" ${row.on ? 'checked' : ''}></td>
      <td><input type="number" data-hint-i="${index}" data-hint-f="priority" value="${attr(row.priority)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="code" value="${attr(row.code)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="label" value="${attr(row.label)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="subtype" value="${attr(row.subtype)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="nodeNameRegex" value="${attr(row.nodeNameRegex)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="masterRegex" value="${attr(row.masterRegex)}"></td>
      <td><input data-hint-i="${index}" data-hint-f="notes" value="${attr(row.notes)}"></td>
    </tr>
  `).join('');
}

function hintPanel(config) {
  ensureValveHintConfig(config);
  const on = config.weight.useNodeNameValveHints !== false;
  const extrapolate = config.weight.useWeightExtrapolation !== false;
  const showRejected = config.weight.showLengthRejectedSemanticMatches !== false;
  const tolerance = valveHintLengthToleranceMm(config);

  return `
    <style>
      .mc-wm-rules-card{margin:10px 0;padding:10px;background:#0c1520;border:1px solid #243247;border-radius:8px;}
      .mc-wm-rules-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
      .mc-wm-rules-title{color:#9cc5ff;font-weight:700;font-size:13px;}
      .mc-wm-rules-subtitle{margin-top:3px;color:#9aa8ba;font-size:12px;line-height:1.35;}
      .mc-wm-rules-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:10px;}
      .mc-wm-rules-grid label{display:flex;align-items:center;gap:7px;min-width:0;color:#d7e6ff;font-size:12px;}
      .mc-wm-rules-grid input[type="number"]{width:76px;min-width:0;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:4px 6px;}
      .mc-wm-help-icon{flex:0 0 auto;width:24px;height:24px;border-radius:999px;border:1px solid #31455f;background:#182334;color:#9cc5ff;font-weight:700;cursor:help;}
      .mc-wm-hint-table-wrap{margin-top:10px;overflow:auto;max-height:220px;border:1px solid #243247;border-radius:8px;}
      .mc-wm-hint-table{border-collapse:collapse;font-size:11px;min-width:980px;width:100%;}
      .mc-wm-hint-table th,.mc-wm-hint-table td{padding:4px 5px;border-bottom:1px solid #243247;color:#d7e6ff;white-space:nowrap;}
      .mc-wm-hint-table th{position:sticky;top:0;background:#111c2c;color:#9cc5ff;z-index:1;}
      .mc-wm-hint-table input{box-sizing:border-box;min-width:64px;max-width:210px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:5px;padding:3px 5px;}
      .mc-wm-chip-rejected{opacity:.72;border-style:dashed!important;cursor:not-allowed!important;}
      .mc-wm-rejected-label{font-size:11px;font-weight:700;opacity:.75;color:#f5c96a;align-self:center;}
    </style>
    <section class="mc-wm-rules-card">
      <div class="mc-wm-rules-head">
        <div>
          <div class="mc-wm-rules-title">Valve Hint / TypeDesc Ranking Rules</div>
          <div class="mc-wm-rules-subtitle">Length gate controls candidate eligibility. Accepted candidate weight may be extrapolated when enabled.</div>
        </div>
        <button type="button" class="mc-wm-help-icon" title="${attr(helpText(config))}">?</button>
      </div>
      <div class="mc-wm-rules-grid">
        <label><input type="checkbox" id="mc-wm-use-valve-hints" ${on ? 'checked' : ''}> Use NodeName valve hint</label>
        <label>Length tolerance ± <input type="number" id="mc-wm-valve-tol" min="0" step="0.1" value="${attr(tolerance)}"> mm</label>
        <label><input type="checkbox" id="mc-wm-show-rejected" ${showRejected ? 'checked' : ''}> Show rejected semantic matches</label>
        <label><input type="checkbox" id="mc-wm-use-extrapolation" ${extrapolate ? 'checked' : ''}> Use weight extrapolation</label>
      </div>
      <div class="mc-wm-hint-table-wrap">
        <table class="mc-wm-hint-table">
          <thead><tr><th>On</th><th>Priority</th><th>Code</th><th>Label</th><th>Subtype</th><th>NodeName Regex</th><th>Master Type/TypeDesc Regex</th><th>Notes</th></tr></thead>
          <tbody>${hintRows(config)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function decorate(rows, config) {
  return (rows || []).map((row) => {
    const ranking = rankXmlCiiWeightCandidates({
      boreMm: row.boreMm,
      rating: row.rating,
      lengthMm: row.lengthMm,
      nodeName: row.nodeName,
      componentType: row.componentType,
      componentRefNo: row.componentRefNo,
      dtxr: row.dtxr,
    }, config, { includeRejected: true });

    return {
      ...row,
      valveHint: formatValveHint(ranking.nodeHint),
      nodeHint: ranking.nodeHint,
      candidates: ranking.candidates.slice(0, 5),
      rejectedCandidates: ranking.rejectedCandidates.slice(0, 3),
      ranking,
    };
  });
}

function renderAcceptedChip(candidate, rowIndex, issue) {
  const value = selectedWeight(candidate);
  const label = desc(candidate);
  const extrapolated = isExtrapolated(candidate);
  const title = [
    `Node hint: ${candidate.valveHintLabel || issue.valveHint || '-'}`,
    `Semantic: ${candidate.semanticReason || '-'}`,
    `TypeDesc: ${label}`,
    `Master weight: ${candidate.masterWeight ?? candidate.weight} kg`,
    `Selected weight: ${value} kg`,
    `Weight method: ${candidate.weightMethod || 'master'}`,
    Number.isFinite(Number(candidate.extrapolationRatio)) ? `Ratio: ${Number(candidate.extrapolationRatio).toFixed(3)}` : '',
    `Length: passed, delta ${nfmt(candidate.lengthDelta)} mm <= ±${nfmt(candidate.lengthToleranceMm)} mm`,
    candidate.weightWarning || '',
  ].filter(Boolean).join(' | ');

  return `
    <button type="button"
      class="mc-rigid-review-candidate${candidate.preferred ? ' best' : ''}${extrapolated ? ' is-extrapolated' : ''}"
      data-wm-candidate="${rowIndex}"
      data-wm-weight="${attr(value)}"
      title="${attr(title)}"
      style="font-size:11px;line-height:1.1;padding:3px 6px;border-radius:999px;white-space:nowrap;max-width:330px;overflow:hidden;text-overflow:ellipsis;">
      ${candidate.preferred ? '★ ' : ''}${esc(label)} · ${esc(value)}kg${extrapolated ? ' extrapolated' : ''} · Δ${esc(nfmt(candidate.lengthDelta))}${candidate.semanticTier > 0 ? ` · ${esc(candidate.semanticReason || candidate.valveHintLabel || '')}` : ''}
    </button>`;
}

function renderRejectedChip(candidate) {
  const label = desc(candidate);
  const title = [candidate.semanticReason || '', candidate.rejectedReason || '', 'Not eligible for first suggestion or auto-fill'].filter(Boolean).join(' | ');
  return `
    <span class="mc-rigid-review-candidate mc-wm-chip-rejected"
      title="${attr(title)}"
      style="font-size:11px;line-height:1.1;padding:3px 6px;border-radius:999px;white-space:nowrap;max-width:330px;overflow:hidden;text-overflow:ellipsis;">
      × ${esc(label)} · Δ${esc(nfmt(candidate.lengthDelta))}mm · ${esc(candidate.semanticReason || '')}, length failed
    </span>`;
}

export function xmlCiiRenderWeightMatchPhase() {
  const info = 'Length gate is mandatory. Valve hint / TypeDesc regex only ranks candidates after length passes. Accepted weights may be extrapolated when enabled.';
  return `
    <div class="model-converters-workflow-detail-title">5 Weight Match <span title="${attr(info)}" style="cursor:help;color:#8bb7ff;border:1px solid #406089;border-radius:50%;padding:0 5px;font-size:11px;">i</span></div>
    <div class="model-converters-workflow-detail-text">Approximate component weights from the valve weight master. NodeName valve hints can re-rank Type/TypeDesc matches only inside the mandatory length tolerance.</div>
    <div id="mc-wm-hint-panel"></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;">
      <button type="button" class="model-converters-download-btn" id="mc-wm-refresh">↻ Recompute matches</button>
      <button type="button" class="model-converters-download-btn" id="mc-wm-fill-best">Use all ★ preferred</button>
      <button type="button" class="model-converters-download-btn" id="mc-wm-length-toggle" title="Convert small master lengths (<100) from inch to mm. Default OFF.">⇄ in→mm: OFF</button>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;"><span style="width:12px;height:12px;background:#123c25;border:1px solid #2f9e63;border-radius:3px;"></span>Mapped</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;"><span style="width:12px;height:12px;background:#4a2d12;border:1px solid #d08a22;border-radius:3px;"></span>Unresolved</span>
      <span id="mc-wm-status" class="mc-diag-run-status"></span>
    </div>
    <div id="mc-wm-content"><div class="model-converters-workflow-detail-note">Computing weight matches…</div></div>`;
}

export function bindXmlCiiWeightMatchPhase(detailEl, { xmlFile, stagedJsonText, config, enrichXmlForCii2019, onSaveConfig, ensureOverrides }) {
  if (!detailEl) return;

  const contentEl = detailEl.querySelector('#mc-wm-content');
  const statusEl = detailEl.querySelector('#mc-wm-status');
  const toggleEl = detailEl.querySelector('#mc-wm-length-toggle');
  const panelEl = detailEl.querySelector('#mc-wm-hint-panel');
  if (!contentEl) return;

  let localIssues = [];

  const status = (message, tone) => {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = `mc-diag-run-status ${tone || ''}`.trim();
  };

  const syncToggle = () => {
    if (!toggleEl) return;
    const on = convOn(config);
    toggleEl.textContent = `⇄ in→mm: ${on ? 'ON' : 'OFF'}`;
    toggleEl.style.borderColor = on ? '#2f9e63' : '';
    toggleEl.style.color = on ? '#fff' : '';
    toggleEl.style.background = on ? '#14532d' : '';
  };

  const drawPanel = () => {
    if (panelEl) panelEl.innerHTML = hintPanel(config);
  };

  const drawRows = (issues) => {
    if (!issues.length) {
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No actual RIGID / FLAN* / VALVE nodes with ElementLengthMm &gt; 6 mm were found.</div>';
      return;
    }

    const rows = issues.map((issue, rowIndex) => {
      const best = issue.candidates?.[0];
      const initial = issue.weight && issue.weight > 0 ? issue.weight : (best ? selectedWeight(best) : '');
      const rowStyle = issue.mapped ? 'background:#0f2a1b;border-left:4px solid #2f9e63;' : 'background:#3a240f;border-left:4px solid #d08a22;';
      const accepted = (issue.candidates || []).map((candidate) => renderAcceptedChip(candidate, rowIndex, issue)).join('');
      const rejected = (issue.rejectedCandidates || []).map(renderRejectedChip).join('');
      const rejectedBlock = rejected ? `<span class="mc-wm-rejected-label">Rejected by length</span>${rejected}` : '';
      const chips = accepted || rejectedBlock
        ? `${accepted}${rejectedBlock}`
        : '<span class="model-converters-muted">No suggestion</span>';

      return `<tr style="${rowStyle}">
        <td>${esc(issue.mapped ? `Mapped (${issue.weightSource || 'weight'})` : (best?.preferred ? 'Suggested' : 'Unresolved'))}</td>
        <td title="${attr(issue.branchName)}">${esc(issue.branchName)}</td>
        <td>${esc(issue.componentType || '')}</td>
        <td>${esc(issue.boreMm == null ? '' : `${Number(issue.boreMm).toFixed(0)} mm`)}</td>
        <td>${esc(issue.rating || '')}</td>
        <td>${esc(issue.nodeNumber)}</td>
        <td title="${attr([issue.dtxrSource, issue.dtxrMatchedKey, issue.dtxrSuppressionReason].filter(Boolean).join(' · '))}">${esc(issue.dtxr || 'Not found')}</td>
        <td>${esc(issue.valveHint || '—')}</td>
        <td title="${attr(issue.elementLengthSource || '')}">${esc(issue.lengthMm == null ? '' : `${Number(issue.lengthMm).toFixed(1)} mm`)}</td>
        <td><input type="number" min="0" step="0.001" class="mc-rigid-review-input" data-wm-key="${attr(issue.key)}" value="${attr(initial)}" placeholder="kg" style="width:86px;"></td>
        <td style="max-width:540px;"><div style="display:flex;flex-wrap:wrap;gap:4px;max-height:72px;overflow:auto;align-items:flex-start;">${chips}</div></td>
      </tr>`;
    }).join('');

    contentEl.innerHTML = `
      <div class="model-converters-workflow-detail-note" style="margin-bottom:8px;">
        Candidate length gate is ±${nfmt(valveHintLengthToleranceMm(config))} mm. Valve hint/TypeDesc regex only ranks after length passes. Weight extrapolation is ${config.weight?.useWeightExtrapolation === false ? 'OFF' : 'ON'}. Length conversion is ${convOn(config) ? 'ON' : 'OFF'}.
      </div>
      <div class="mc-rigid-review-table-wrap" style="overflow:auto;max-height:48vh;">
        <table class="mc-rigid-review-table" style="border-collapse:collapse;font-size:12px;">
          <thead><tr><th>Status</th><th>Branch</th><th>Type</th><th>Bore</th><th>Rating</th><th>Node</th><th>DTXR</th><th>Valve Hint</th><th>Length</th><th>Weight (kg)</th><th>Nearest Suggestions (TypeDesc · Weight · ΔLength)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    contentEl.querySelectorAll('[data-wm-candidate]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = contentEl.querySelectorAll('.mc-rigid-review-input')[Number(button.dataset.wmCandidate)];
        if (!input) return;
        input.value = button.dataset.wmWeight || '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  };

  const compute = async () => {
    syncToggle();
    drawPanel();

    if (!xmlFile) {
      localIssues = [];
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No XML source loaded. Import an XML file first.</div>';
      status('No input', 'bad');
      return;
    }

    status('Computing…');

    try {
      const xmlText = await xmlFile.text();
      const jsonText = await stagedText(stagedJsonText);
      const enriched = await enrichXmlForCii2019(xmlText, jsonText, { dryRun: true, skipAutoWeightMatch: true });
      const cfg = enriched.config || config;
      localIssues = decorate(collectXmlCiiWeightMatchRows(xmlText, jsonText, cfg).map(cleanRow).filter(Boolean), cfg);
      const mapped = localIssues.filter((row) => row.mapped).length;
      const suggested = localIssues.filter((row) => row.candidates?.[0]?.preferred).length;
      const unresolved = localIssues.length - mapped - suggested;
      status(`${mapped} mapped · ${suggested} suggested · ${unresolved} unresolved · ${localIssues.length} shown`, unresolved ? 'bad' : 'ok');
      drawRows(localIssues);
    } catch (error) {
      localIssues = [];
      contentEl.innerHTML = `<div class="model-converters-workflow-detail-note">Could not compute weight matches: ${esc(error?.message || error)}</div>`;
      status('Error', 'bad');
    }
  };

  detailEl.querySelector('#mc-wm-refresh')?.addEventListener('click', compute);

  toggleEl?.addEventListener('click', () => {
    if (!config.weight || typeof config.weight !== 'object') config.weight = {};
    config.weight.convertSmallLengthsInToMm = config.weight.convertSmallLengthsInToMm !== true;
    onSaveConfig(config);
    void compute();
  });

  detailEl.querySelector('#mc-wm-fill-best')?.addEventListener('click', () => {
    contentEl.querySelectorAll('.mc-rigid-review-input').forEach((input, index) => {
      const best = localIssues[index]?.candidates?.[0];
      if (!best || best.preferred !== true || best.lengthQualified !== true) return;
      input.value = String(selectedWeight(best));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  panelEl?.addEventListener('change', (event) => {
    ensureValveHintConfig(config);

    const use = event.target.closest?.('#mc-wm-use-valve-hints');
    if (use) config.weight.useNodeNameValveHints = use.checked;

    const tolerance = event.target.closest?.('#mc-wm-valve-tol');
    if (tolerance) config.weight.valveHintLengthToleranceMm = Math.max(0, Number(tolerance.value) || 0);

    const showRejected = event.target.closest?.('#mc-wm-show-rejected');
    if (showRejected) config.weight.showLengthRejectedSemanticMatches = showRejected.checked;

    const extrapolate = event.target.closest?.('#mc-wm-use-extrapolation');
    if (extrapolate) config.weight.useWeightExtrapolation = extrapolate.checked;

    const input = event.target.closest?.('[data-hint-i]');
    if (input) {
      const rows = valveHintMappingRows(config);
      const row = rows[Number(input.dataset.hintI)];
      if (row) {
        const field = input.dataset.hintF;
        if (field === 'on') row.on = input.checked;
        else if (field === 'priority') row.priority = Number(input.value) || row.priority;
        else row[field] = input.value;
        config.weight.valveHintMapping = rows;
      }
    }

    onSaveConfig(config);
    void compute();
  });

  contentEl.addEventListener('change', (event) => {
    const input = event.target.closest?.('.mc-rigid-review-input');
    if (!input) return;

    const key = input.getAttribute('data-wm-key') || '';
    const value = Number(input.value);
    if (!key || !Number.isFinite(value) || value <= 0) return;

    const overrides = ensureOverrides(config);
    overrides.rigidWeight = { ...(overrides.rigidWeight || {}), [key]: value };
    onSaveConfig(config);
  });

  syncToggle();
  drawPanel();
  void compute();
}
