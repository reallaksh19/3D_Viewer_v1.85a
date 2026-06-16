import { EditablePreviewTable } from '../../shared/EditablePreviewTable.js';
import { deriveLineKeyFromBranchName, tokenAtPosition } from '../../../../converters/xml-cii2019-core/regex-line-key.js';
import { xmlCiiRigidWeightOverrideKey, isXmlCiiWeightReviewNode, xmlCiiNumberText } from '../../../../converters/xml-cii2019-core/weight-match-model.js';
import { rankXmlCiiWeightCandidates, formatValveHint } from '../../../../converters/xml-cii2019-core/weight-valve-hints.js';
import { buildPipingClassIndex } from '../../../../converters/xml-cii2019-core/piping-class-resolver.js';
import { resolveBranchProcessData } from '../../../../converters/xml-cii2019-core/branch-process-resolver.js';
import { buildStagedDtxrIndex, resolveXmlCiiNodeDtxr } from '../../../../converters/xml-cii2019-core/dtxr-resolver.js';
import { resolveLineListDensity } from '../../../../converters/xml-cii2019-core/line-density-resolver.js';
import {
  applyPreviewOverrideFillDown,
  applyPreviewProcessFillDown,
  markPreviewOverrideManual,
  markPreviewProcessManual,
} from '../../shared/preview-filldown.js';

function _toText(val) { return val === null || val === undefined ? '' : String(val); }
function _toFiniteNumber(value, fallback) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function _esc(value) { return _toText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function _xmlLocalName(node) { return _toText(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function _xmlChildrenByName(parent, localName) { return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && _xmlLocalName(child) === localName); }
function _xmlFirstChild(parent, localName) { return _xmlChildrenByName(parent, localName)[0] || null; }
function _xmlText(parent, localName) { return _toText(_xmlFirstChild(parent, localName)?.textContent).trim(); }
function _normalizePoint(point) {
  if (point === undefined || point === null || point === '') return null;
  if (Array.isArray(point) && point.length >= 3) {
    const x = Number(point[0]), y = Number(point[1]), z = Number(point[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  if (typeof point === 'object') {
    const x = Number(point.x ?? point.X), y = Number(point.y ?? point.Y), z = Number(point.z ?? point.Z);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  const values = _toText(point).match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null;
}
function _pointDistanceMm(a, b) { const pa = _normalizePoint(a), pb = _normalizePoint(b); return pa && pb ? Math.sqrt(((pa.x - pb.x) ** 2) + ((pa.y - pb.y) ** 2) + ((pa.z - pb.z) ** 2)) : null; }
function _regexGroup(text, pattern, groupIndex = 1) { const source = _toText(text), patternText = _toText(pattern).trim(); if (!source || !patternText) return ''; try { const match = new RegExp(patternText, 'i').exec(source); return _toText(match?.[Math.max(0, Number(groupIndex || 0))] || '').trim(); } catch { return ''; } }
function _rowText(row, keys) { if (!row || typeof row !== 'object') return ''; for (const k of keys) { const value = row[k] ?? row._raw?.[k]; if (value !== undefined && value !== null && _toText(value).trim()) return _toText(value).trim(); } return ''; }
function _rowNumber(row, keys) { const text = _rowText(row, keys); const match = text.match(/[-+]?\d*\.?\d+/); const num = match ? Number(match[0]) : Number(text); return Number.isFinite(num) ? num : null; }
function _xmlCiiLineKeyRegexValue(value, pattern, groupIndex) { const text = _toText(value).trim(); const patternText = _toText(pattern).trim(); if (!text || !patternText) return text; return _regexGroup(text, patternText, groupIndex || 1) || text; }
function _xmlCiiNormalizeLineKey(value) { return _toText(value).trim().toUpperCase().replace(/\s+/g, ''); }
function _xmlCiiFindLineListRow(branchLineKey, config) { const rows = Array.isArray(config.linelist?.masterRows) ? config.linelist.masterRows : []; const lookupKey = _xmlCiiNormalizeLineKey(branchLineKey); const columnRegex = config.linelist?.linelistColumnRegex || ''; const columnGroup = config.linelist?.linelistColumnGroup || 1; for (const row of rows) { const rawKey = _rowText(row, ['lineNoKey', 'lineNo', 'lineKey', 'LineNo', 'Line No', 'Line Number', 'PipelineReference']); const cleanKey = _xmlCiiNormalizeLineKey(_xmlCiiLineKeyRegexValue(rawKey, columnRegex, columnGroup)); if (cleanKey && cleanKey === lookupKey) return row; } return null; }
function _processDefaultValue(config, fieldKey) { const defaults = config?.processDefaults && typeof config.processDefaults === 'object' ? config.processDefaults : {}; return _toText(defaults[fieldKey]).trim(); }
function _xmlCiiProcessValue(pdOverride, row, overrideKey, rowKeys, config) { if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) return _toText(pdOverride[overrideKey]).trim(); const rowVal = _rowText(row, rowKeys); if (rowVal) return rowVal; return _processDefaultValue(config, overrideKey); }
function _xmlCiiProcessSource(pdOverride, row, overrideKey, rowKeys, config) { if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) return 'override'; if (_rowText(row, rowKeys)) return 'linelist'; return _processDefaultValue(config, overrideKey) ? 'default' : 'none'; }
function _derivePipingClassFromBranchName(branchName, config) { return _regexGroup(branchName, config.rating?.pipingClassRegex, config.rating?.pipingClassGroup || 1) || tokenAtPosition(branchName, config.rating?.tokenDelimiter || '-', config.rating?.pipingClassTokenIndex || 5); }
function _deriveRatingFromPipingClass(pipingClass, config) { const text = _toText(pipingClass).trim().toUpperCase(); const sequence = Array.isArray(config.rating?.ratingSequence) ? config.rating.ratingSequence : []; for (const pair of sequence) { if (Array.isArray(pair) && pair.length >= 2 && text.startsWith(_toText(pair[0]).toUpperCase())) return _toText(pair[1]); } return ''; }
function _nominalDnFromNps(inches, config) { if (!Number.isFinite(inches)) return null; const map = config.weight?.npsToDn && typeof config.weight.npsToDn === 'object' ? config.weight.npsToDn : {}; const key = String(Number(inches)); const mapped = Number(map[key] ?? map[inches] ?? map[inches.toFixed(3)]); return Number.isFinite(mapped) ? mapped : inches * _toFiniteNumber(config.weight?.inchToMm, 25.4); }
function _deriveBoreFromBranchName(branchName, config) { const raw = _regexGroup(branchName, config.weight?.boreRegex, config.weight?.boreGroup || 1) || tokenAtPosition(branchName, config.weight?.tokenDelimiter || '-', config.weight?.boreTokenIndex || 3); return _nominalDnFromNps(Number(_toText(raw).replace(/[^0-9.+-]/g, '')), config); }
function _fieldOverrideKey(editType, derivedKey) { return _toText(derivedKey).trim(); }
function _hasOwn(obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }
function _overrideSource(overrides, bucket, key) { return _hasOwn(overrides?.[bucket], key) ? 'override' : 'auto'; }
function _isDefaultSource(source) { return source === 'default' || source === 'config-default' || source === 'default-zero'; }
function _percentText(confidence) { const numeric = Number(confidence); return Number.isFinite(numeric) ? `${Math.max(0, Math.min(100, Math.round(numeric * 100)))}%` : ''; }

export function xmlCiiRenderPreviewPhase(xmlFile, config) {
  const llRows = Array.isArray(config.linelist?.masterRows) ? config.linelist.masterRows.length : 0;
  const pcRows = Array.isArray(config.pipingClass?.masterRows) ? config.pipingClass.masterRows.length : 0;
  if (!xmlFile) return `<div class="model-converters-workflow-detail-title">4 Preview</div><div class="model-converters-workflow-detail-note">⚠ Load an XML file in the sidebar first, then return here to preview enrichment.</div>`;
  if (!llRows && !pcRows) return `<div class="model-converters-workflow-detail-title">4 Preview</div><div class="model-converters-workflow-detail-note">⚠ Import at least one master in 2 Import Masters, then return here.</div>`;
  return `<div class="model-converters-workflow-detail-title">4 Preview</div><div class="model-converters-workflow-detail-text">Dry-run enrichment preview per branch — inspect and override approximate matches.</div><div id="mc-preview-table-host"><div class="model-converters-workflow-detail-note" style="text-align:center;padding:18px;">Loading preview...</div></div>`;
}

export function xmlCiiDryRunPreview(xmlText, config, stagedJsonText) {
  if (typeof DOMParser === 'undefined') return { branchRows: [], nodeRows: [] };
  let document;
  try { document = new DOMParser().parseFromString(_toText(xmlText), 'application/xml'); if (document.getElementsByTagName('parsererror').length) return { branchRows: [], nodeRows: [] }; } catch { return { branchRows: [], nodeRows: [] }; }
  const branchRows = [];
  const nodeRows = [];
  const pipingClassIndex = buildPipingClassIndex(config.pipingClass?.masterRows || []);
  const stagedIndex = buildStagedDtxrIndex(stagedJsonText || '', config);
  const materialMap = config.material?.mapRows || [];
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = _xmlText(branch, 'Branchname');
    const lineKey = deriveLineKeyFromBranchName(branchName, config);
    const lineListMatch = lineKey ? _xmlCiiFindLineListRow(lineKey, config) : null;
    const lineListClass = _rowText(lineListMatch, ['pipingClass', 'Piping Class', 'PIPING_CLASS']);
    const branchClass = _derivePipingClassFromBranchName(branchName, config);
    const derivedClassRaw = lineListClass || branchClass;
    const boreMm = _deriveBoreFromBranchName(branchName, config) || _rowNumber(lineListMatch, ['convertedBore', 'Bore', 'DN', 'NB']);
    const resolverLineRow = { ...(lineListMatch || {}), pipingClass: derivedClassRaw };
    const resolved = resolveBranchProcessData({ branchName, lineKey, lineRow: resolverLineRow, boreMm, componentType: 'PIPE', rating: _rowText(lineListMatch, ['rating', 'Rating', 'RATING']) || _deriveRatingFromPipingClass(derivedClassRaw, config), materialMap, pipingClassIndex, overrides: config.overrides || {}, xmlNode: null, xmlBranch: branch, config });
    const branchRating = resolved.rating || _deriveRatingFromPipingClass(resolved.pipingClass, config) || _rowText(lineListMatch, ['rating', 'Rating']);
    const pdOverride = (lineKey && config?.overrides?.processData?.[lineKey]) || {};
    const p1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 'p1', ['p1'], config);
    const t1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't1', ['t1'], config);
    const t2 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't2', ['t2'], config);
    const t3 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't3', ['t3'], config);
    const densityInfo = resolveLineListDensity(lineListMatch, pdOverride);
    const density = densityInfo.value || _processDefaultValue(config, 'density');
    const densitySource = densityInfo.value ? densityInfo.source : (_processDefaultValue(config, 'density') ? 'default' : 'none');
    const wallThickness = resolved.wallThicknessMm != null ? Number(resolved.wallThicknessMm.toPrecision(6)).toString() : '';
    const corrosion = resolved.corrosionAllowanceMm != null ? String(resolved.corrosionAllowanceMm) : '';
    let matMethod = 'none';
    if (resolved.materialSource === 'override' || resolved.materialSource === 'override-material-map') matMethod = 'override';
    else if (resolved.materialSource === 'line-list-material-map' || resolved.materialSource === 'piping-class-material-map') matMethod = 'exact';
    else if (resolved.materialSource === 'xml-fallback') matMethod = 'xml-fallback';
    branchRows.push({ branchName, lineKey, lineMiss: !lineListMatch, size: boreMm != null ? `${boreMm}mm` : '', sizeMm: boreMm, pipingClass: resolved.pipingClass || '', pipingClassDerived: derivedClassRaw || '', pipingClassMethod: resolved.pipingClassMatchMethod, pipingClassConfidence: resolved.pipingClassConfidence, pipingClassScore: resolved.pipingClassScore, pipingClassRowScore: resolved.pipingClassRowScore, pipingClassRowReasons: resolved.pipingClassRowReasons || [], pipingClassNeedsReview: resolved.pipingClassNeedsReview, pipingClassCandidates: resolved.pipingClassCandidates || [], material: resolved.material || '', materialSource: resolved.materialSource || _overrideSource(config.overrides, 'material', lineKey), materialCode: resolved.materialCode || '', materialCodeMethod: matMethod, materialCodeNeedsReview: !resolved.materialCode, rating: branchRating || '', ratingSource: _overrideSource(config.overrides, 'rating', lineKey), p1, t1, t2, t3, density, p1Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 'p1', ['p1'], config), t1Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't1', ['t1'], config), t2Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't2', ['t2'], config), t3Source: _xmlCiiProcessSource(pdOverride, lineListMatch, 't3', ['t3'], config), densitySource, wallThickness, wallThicknessSource: resolved.wallThicknessSource || _overrideSource(config.overrides, 'wallThickness', lineKey), corrosion, corrosionSource: resolved.corrosionSource || _overrideSource(config.overrides, 'corrosion', lineKey) });
    let previousPosition = null;
    for (const node of _xmlChildrenByName(branch, 'Node')) {
      const positionText = _xmlText(node, 'Position');
      const computedLengthMm = previousPosition ? _pointDistanceMm(previousPosition, positionText) : null;
      const explicitLengthMm = xmlCiiNumberText(_xmlText(node, 'ElementLengthMm'));
      const lengthMm = explicitLengthMm !== null ? explicitLengthMm : computedLengthMm;
      const nodeNumber = _xmlText(node, 'NodeNumber');
      const componentType = _xmlText(node, 'ComponentType');
      const nodeNoNum = Number(nodeNumber);
      const weightEligible = isXmlCiiWeightReviewNode(node);
      const dtxrRes = weightEligible ? resolveXmlCiiNodeDtxr(node, stagedIndex, config) : { value: '', source: 'not-weight-eligible', matchedKey: '' };
      const ranking = (weightEligible && boreMm != null && branchRating && lengthMm != null)
        ? rankXmlCiiWeightCandidates({
          boreMm,
          rating: branchRating,
          lengthMm,
          nodeName: _xmlText(node, 'NodeName'),
          componentType,
          componentRefNo: _xmlText(node, 'ComponentRefNo'),
          dtxr: dtxrRes.value || '',
        }, config, { includeRejected: true })
        : { nodeHint: null, candidates: [], rejectedCandidates: [], best: null };
      const candidates = ranking.candidates.slice(0, 5);
      const weightKey = xmlCiiRigidWeightOverrideKey(branchName, nodeNumber);
      const overrideWeight = Number(config?.overrides?.rigidWeight?.[weightKey]);
      const selectedWeight = Number.isFinite(overrideWeight) && overrideWeight > 0 ? overrideWeight : null;
      const selectedMatch = selectedWeight != null ? { ...(candidates[0] || {}), selectedWeight, suggestedWeight: selectedWeight, weight: selectedWeight, selectedOverride: true } : (ranking.best || null);
      if (nodeNoNum > 0 && weightEligible && (candidates.length || ranking.rejectedCandidates.length)) {
        nodeRows.push({
          key: weightKey,
          branchName,
          nodeNumber,
          componentType,
          boreMm,
          rating: branchRating,
          resolvedPipingClass: resolved.pipingClass,
          lengthMm,
          dtxr: dtxrRes.value || '',
          dtxrSource: dtxrRes.source || 'none',
          dtxrMatchedKey: dtxrRes.matchedKey || '',
          valveHint: formatValveHint(ranking.nodeHint),
          weightMatch: selectedMatch,
          weightCandidates: candidates,
          rejectedWeightCandidates: ranking.rejectedCandidates.slice(0, 3),
        });
      }
      previousPosition = positionText || previousPosition;
    }
  }
  return { branchRows, nodeRows };
}

export async function xmlCiiBuildAndRenderPreview(rootEl, xmlText, config, options = {}) {
  const { onSaveConfig, openOverridePopup, ensureOverrides, stagedJsonText } = options;
  const host = rootEl?.querySelector('#mc-preview-table-host');
  if (!host) return;
  const refreshPreview = () => { host.innerHTML = '<div class="model-converters-workflow-detail-note" style="text-align:center;padding:18px;">Refreshing preview...</div>'; setTimeout(() => xmlCiiBuildAndRenderPreview(rootEl, xmlText, config, options), 0); };
  const { branchRows, nodeRows } = xmlCiiDryRunPreview(xmlText, config, stagedJsonText);
  if (!branchRows.length) { host.innerHTML = '<div class="model-converters-workflow-detail-note">No branches found in XML.</div>'; return; }
  const nodesByBranch = {};
  for (const nr of nodeRows) (nodesByBranch[nr.branchName] = nodesByBranch[nr.branchName] || []).push(nr);
  const table = new EditablePreviewTable({
    branchRows, nodesByBranch,
    matchBadgeHtmlRenderer: (method, confidence, needsReview, value, derived) => {
      const valEsc = _esc(value || '—'), derivedEsc = _esc(derived || ''), pctText = _percentText(confidence);
      if (method === 'override') return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge exact" title="Manual override${pctText ? ` · ${pctText}` : ''}">✓ override${pctText ? ` ${pctText}` : ''}</span>`;
      if (method === 'exact') return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge exact">✓ exact ${pctText || '100%'}</span>`;
      if (['startsWith', 'leading-numeric-base', 'prefix-base', 'leading-numeric-exact'].includes(method)) return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge amber" title="Approximate match ${pctText || ''} from ${derivedEsc}">approx${pctText ? ` ${pctText}` : ''}</span>`;
      if (['fuzzy', 'fuzzy-ratio', 'numeric-near'].includes(method)) return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge ${needsReview ? 'orange' : 'amber'}" title="Approximate match ${pctText || ''} to ${derivedEsc}">fuzzy${pctText ? ` ${pctText}` : ''}</span>`;
      if (method === 'ambiguous' || method === 'ambiguous-approximate') return `<span class="mc-preview-editable-val">—</span> <span class="mc-preview-badge bad" title="Ambiguous match for ${derivedEsc}">ambiguous${pctText ? ` ${pctText}` : ''}</span>`;
      if (needsReview) return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge bad" title="Review ${derivedEsc}">review${pctText ? ` ${pctText}` : ''}</span>`;
      return `<span class="mc-preview-editable-val">${valEsc}</span>`;
    },
    processInputHtmlRenderer: (fieldKey, lineKey, val, src, ri) => {
      const cls = src === 'override' ? 'mc-preview-pd-cell mc-preview-pd-override' : (src === 'linelist' || src.startsWith('linelist-density') ? 'mc-preview-pd-cell mc-preview-pd-linelist' : (src === 'default' ? 'mc-preview-pd-cell mc-preview-pd-default' : 'mc-preview-pd-cell mc-preview-pd-empty'));
      const inputStyle = src === 'default' ? ' style="color:#7f1d1d;font-weight:600;font-style:italic;" title="Config default value"' : '';
      return `<div class="${cls}"><input type="text" class="mc-preview-pd-input" value="${_esc(val)}" placeholder="${fieldKey}" data-mc-pd-field="${_esc(fieldKey)}" data-mc-pd-linekey="${_esc(lineKey)}" data-mc-pd-row="${ri}"${inputStyle}><button type="button" class="mc-preview-filldown-btn mc-pd-filldown" data-mc-fill-field="${_esc(fieldKey)}" data-mc-fill-from="${ri}" title="Group-wise fill down: blanks/auto-filled cells only, stop at next manual value">↓</button></div>`;
    },
    onWeightCandidateSelect: ({ key, weight }) => {
      const numeric = Number(weight);
      if (!key || !Number.isFinite(numeric) || numeric <= 0) return;
      const overrides = ensureOverrides(config);
      overrides.rigidWeight = { ...(overrides.rigidWeight || {}), [key]: numeric };
      onSaveConfig(config);
    },
    onCellEditClick: ({ editType, derivedKey, currentVal, td }) => openOverridePopup({ editType, derivedKey, currentVal, config, onSave: (newVal) => { const overrides = ensureOverrides(config); if (!overrides[editType] || typeof overrides[editType] !== 'object') overrides[editType] = {}; if (editType === 'pipingClass') overrides.pipingClass = { ...overrides.pipingClass, [derivedKey]: newVal }; else if (editType === 'materialCode') overrides.materialCode = { ...overrides.materialCode, [derivedKey]: newVal }; else if (editType === 'material') overrides.material = { ...overrides.material, [derivedKey]: newVal }; else if (editType === 'rating') overrides.rating = { ...overrides.rating, [derivedKey]: newVal }; else if (editType === 'wallThickness') overrides.wallThickness = { ...overrides.wallThickness, [derivedKey]: newVal }; else if (editType === 'corrosion') overrides.corrosion = { ...overrides.corrosion, [derivedKey]: newVal }; markPreviewOverrideManual({ config, ensureOverrides, field: editType, key: _fieldOverrideKey(editType, derivedKey), value: newVal }); onSaveConfig(config); td.dataset.mcFillState = 'manual'; refreshPreview(); }}),
    onFillDownClick: ({ field, fromRow, currentVal }) => { const filled = applyPreviewOverrideFillDown({ host, config, ensureOverrides, field, fromRow, currentValue: currentVal }); if (filled > 0) { onSaveConfig(config); refreshPreview(); } },
    onProcessInputChange: ({ field, fieldKey, lineKey, value, input }) => { const overrides = ensureOverrides(config); if (!overrides.processData) overrides.processData = {}; if (!overrides.processData[lineKey]) overrides.processData[lineKey] = {}; const cleanVal = _toText(value).trim(); const actualField = field || fieldKey; if (cleanVal === '') delete overrides.processData[lineKey][actualField]; else overrides.processData[lineKey][actualField] = cleanVal; if (Object.keys(overrides.processData[lineKey]).length === 0) delete overrides.processData[lineKey]; markPreviewProcessManual({ config, ensureOverrides, field: actualField, lineKey, value: cleanVal }); onSaveConfig(config); const cell = input.closest('.mc-preview-pd-cell'); if (cell) cell.className = cleanVal ? 'mc-preview-pd-cell mc-preview-pd-override' : 'mc-preview-pd-cell mc-preview-pd-empty'; },
    onProcessFillDownClick: ({ fieldKey, fromRow, value }) => { const filled = applyPreviewProcessFillDown({ host, config, ensureOverrides, field: fieldKey, fromRow, currentValue: value }); if (filled > 0) onSaveConfig(config); }
  });
  host.innerHTML = table.renderHTML();
  const defaultFields = ['p1', 't1', 't2', 't3', 'density', 'wallThickness', 'corrosion'];
  const defaultRows = branchRows.map((row, ri) => ({ row, ri, fields: defaultFields.filter((field) => _isDefaultSource(row[`${field}Source`])) })).filter((item) => item.fields.length > 0);
  if (defaultRows.length) host.insertAdjacentHTML('afterbegin', `<div class="model-converters-workflow-detail-note" style="margin:0 0 8px;border-color:#7f1d1d;color:#7f1d1d;background:#fff7f7;">${defaultRows.length} line${defaultRows.length === 1 ? '' : 's'} use config defaults. Default values are shown in dark red.</div>`);
  table.bind(host);
}
