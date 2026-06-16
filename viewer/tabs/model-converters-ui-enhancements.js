const RESTRAINT_MODE_STORAGE_KEY = 'xmlCii.useRestraintTypeBasedOnJson';
const SPLIT_CONDENSED_STORAGE_KEY = 'xmlCii.splitCondensedValveFlange';
const LINELIST_STORAGE_KEY = 'xmlCii.lastLinelist.masterRows.v2';
const WORKER_PATCH_FLAG = '__xmlCiiRestraintModeWorkerPatchInstalled';
const STYLE_ID = 'model-converters-ui-enhancements-style';
const NO_AUTO_WEIGHT_TYPES = new Set(['TEE', 'REDU', 'REE', 'BEND', 'ELBO']);
const NEGATIVE_RENUMBER_TYPES = new Set(['FLAN', 'RIGID']);
const MASTER_SPECS = Object.freeze({
  pipingClass: { rowsKey: 'masterRows', files: ['docs/Masters/Piping_class_master.json'], parse: 'json' },
  material: { rowsKey: 'mapRows', files: ['docs/Masters/PCF_MAT_MAP.TXT'], parse: 'material' },
  weight: { rowsKey: 'masterRows', files: ['docs/Masters/wtValveweights.json'], parse: 'json' },
});

let _lastFinalizedXmlText = '';
let _autoloadPromise = null;
let _autoloadWarned = false;

function _toText(value) { return value === undefined || value === null ? '' : String(value); }
function _escapeHtml(value) { return _toText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function _readBool(key, fallback) { try { const v = localStorage.getItem(key); if (v === 'true') return true; if (v === 'false') return false; } catch {} return fallback; }
function _writeBool(key, value) { try { localStorage.setItem(key, value ? 'true' : 'false'); } catch {} }
function _readRestraintMode() { return _readBool(RESTRAINT_MODE_STORAGE_KEY, true); }
function _readSplitCondensedMode() { return _readBool(SPLIT_CONDENSED_STORAGE_KEY, false); }
function _writeRestraintMode(value) { _writeBool(RESTRAINT_MODE_STORAGE_KEY, value); }
function _writeSplitCondensedMode(value) { _writeBool(SPLIT_CONDENSED_STORAGE_KEY, value); }
function _num(value) { const n = Number((_toText(value).match(/-?\d+(?:\.\d+)?/) || [''])[0]); return Number.isFinite(n) ? n : null; }
function _decodeBytes(bytes) { try { return new TextDecoder('utf-8').decode(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes || [])); } catch { return ''; } }
function _encodeText(text) { return new TextEncoder().encode(_toText(text)).buffer; }
function _headerKey(value) { return _toText(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function _supportConfigInput(panel) { return panel.querySelector('[data-option-key="supportConfigJson"]'); }
function _readSavedLineListRows() { try { const rows = JSON.parse(localStorage.getItem(LINELIST_STORAGE_KEY) || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; } }
function _saveLineListRows(rows) { try { if (Array.isArray(rows) && rows.length) localStorage.setItem(LINELIST_STORAGE_KEY, JSON.stringify(rows)); } catch {} }

function _semanticScore(header, labels, field) {
  const joined = [header, ...(labels || [])].map(_headerKey).filter(Boolean).join(' ');
  const compact = joined.replace(/\s+/g, '');
  if (!joined) return 0;
  const hasTemp = /\b(temp|temperature)\b/i.test(joined) || compact.includes('temperature') || compact.includes('temp');
  const hasPressure = /\b(press|pressure|kpa|bar|psig?)\b/i.test(joined);
  const hasTest = /\b(test|hydro|hydrostatic)\b/i.test(joined) || compact.includes('testpressure') || compact.includes('hydropressure');
  const hasMax = /\b(max|maximum)\b/i.test(joined) || compact.includes('tempmax') || compact.includes('temperaturemax');
  const hasMin = /\b(min|minimum)\b/i.test(joined) || compact.includes('tempmin') || compact.includes('temperaturemin');
  const hasIns = /\b(ins|insulation)\b/i.test(joined);
  const hasThk = /\b(thickness|thk|mm)\b/i.test(joined) || joined.includes('[mm]');
  const hasType = /\btype\b/i.test(joined);
  const hasDensity = /\bdensity\b/i.test(joined) || /\bkg\b.*\bm\b/.test(joined) || /kg\s*\/?\s*m/.test(joined);
  const hasGas = /\bgas\b/i.test(joined);
  const hasMixed = /\bmixed\b/i.test(joined);
  const hasLiquid = /\b(liquid|liq)\b/i.test(joined);
  if (field === 't1') return hasTemp && hasMax && !hasPressure ? 100 : 0;
  if (field === 't2') return hasTemp && !hasMax && !hasMin && !hasPressure ? 95 : 0;
  if (field === 't3') return hasTemp && hasMin && !hasPressure ? 100 : 0;
  if (field === 'hydroPressure') return hasPressure && hasTest ? 100 : 0;
  if (field === 'insThk') return hasIns && hasThk && !hasType ? 100 : 0;
  if (field === 'densityMixed') return hasMixed && hasDensity ? 100 : 0;
  if (field === 'densityGas') return hasGas && hasDensity ? 100 : 0;
  if (field === 'densityLiquid') return hasLiquid && hasDensity ? 100 : 0;
  return 0;
}

function _rowValue(row, header) { if (!row || !header) return ''; if (_toText(row[header]).trim()) return _toText(row[header]).trim(); if (row._raw && _toText(row._raw[header]).trim()) return _toText(row._raw[header]).trim(); return ''; }
function _candidateHeadersFromRows(rows) { const out = []; const seen = new Set(); for (const row of Array.isArray(rows) ? rows : []) { if (!row || typeof row !== 'object') continue; for (const key of Object.keys(row)) { if (key === '_raw' && row._raw && typeof row._raw === 'object') { for (const rawKey of Object.keys(row._raw)) if (!seen.has(rawKey)) { seen.add(rawKey); out.push(rawKey); } } else if (!seen.has(key)) { seen.add(key); out.push(key); } } } return out; }
function _sampleLabels(rows, header, limit = 4) { const labels = [header]; for (const row of (Array.isArray(rows) ? rows : []).slice(0, limit)) { const v = _rowValue(row, header); if (v && !labels.includes(v)) labels.push(v); } return labels; }
function _labelForColumn(rows, header) { const samples = _sampleLabels(rows, header, 3).filter(Boolean); return [header, ...samples.filter((v) => v !== header)].slice(0, 4).join(' | '); }

function _restoreLineList(config) {
  const linelist = config.linelist && typeof config.linelist === 'object' ? config.linelist : (config.linelist = {});
  if (Array.isArray(linelist.masterRows) && linelist.masterRows.length) { _saveLineListRows(linelist.masterRows); return false; }
  const saved = _readSavedLineListRows();
  if (!saved.length) return false;
  linelist.masterRows = saved;
  linelist.restoredFromLocalStorage = true;
  return true;
}

function _normalizeFieldMapInConfig(config) {
  if (!config || typeof config !== 'object') return false;
  let changed = _restoreLineList(config);
  const linelist = config.linelist && typeof config.linelist === 'object' ? config.linelist : (config.linelist = {});
  const rows = Array.isArray(linelist.masterRows) ? linelist.masterRows : [];
  const fieldMap = linelist.fieldMap && typeof linelist.fieldMap === 'object' ? linelist.fieldMap : (linelist.fieldMap = {});
  for (const field of ['t1', 't2', 't3', 'hydroPressure', 'insThk', 'densityMixed', 'densityGas', 'densityLiquid']) {
    let bestHeader = '';
    let bestScore = 0;
    for (const header of _candidateHeadersFromRows(rows)) {
      const score = _semanticScore(header, _sampleLabels(rows, header), field);
      if (score > bestScore) { bestScore = score; bestHeader = header; }
    }
    if (bestHeader && bestScore >= 90 && fieldMap[field] !== bestHeader) { fieldMap[field] = bestHeader; changed = true; }
  }
  if (config.insulationDensityDefault === undefined || config.insulationDensityDefault === null || config.insulationDensityDefault === '') { config.insulationDensityDefault = 210; changed = true; }
  if (config.splitCondensedValveFlange === undefined || config.splitCondensedValveFlange === null) { config.splitCondensedValveFlange = _readSplitCondensedMode(); changed = true; }
  config.supportKindToXmlType = { ...(config.supportKindToXmlType || {}), REST: '+Y', SHOE: '+Y' };
  return changed;
}

function _normalizeSupportConfigJson(text) {
  if (!_toText(text).trim()) { const config = {}; _normalizeFieldMapInConfig(config); return { text: JSON.stringify(config, null, 2), changed: true, config }; }
  try { const config = JSON.parse(text); const changed = _normalizeFieldMapInConfig(config); return { text: changed ? JSON.stringify(config, null, 2) : text, changed, config }; } catch { return { text, changed: false, config: null }; }
}
function _readSupportConfig(panel) { return _normalizeSupportConfigJson(_supportConfigInput(panel)?.value || '').config || {}; }
function _writeSupportConfig(panel, config) { const input = _supportConfigInput(panel); if (!input) return; if (Array.isArray(config?.linelist?.masterRows)) _saveLineListRows(config.linelist.masterRows); input.value = JSON.stringify(config || {}, null, 2); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }

function _candidateMasterUrls(filePath) { const candidates = []; const add = (url) => { const text = String(url); if (!candidates.includes(text)) candidates.push(text); }; try { add(new URL(`../../${filePath}`, import.meta.url)); } catch {} try { add(new URL(`../${filePath}`, import.meta.url)); } catch {} try { add(new URL(`./${filePath}`, window.location.href)); } catch {} try { const marker = '/viewer/'; const href = window.location.href; const idx = href.indexOf(marker); if (idx >= 0) add(`${href.slice(0, idx + 1)}${filePath}`); } catch {} return candidates; }
async function _fetchTextAny(paths) { const errors = []; for (const filePath of paths) { for (const url of _candidateMasterUrls(filePath)) { try { const response = await fetch(url, { cache: 'no-store' }); if (response.ok) return response.text(); errors.push(`${url}: HTTP ${response.status}`); } catch (error) { errors.push(`${url}: ${error?.message || error}`); } } } throw new Error(errors.slice(-3).join(' | ') || 'No candidate URL loaded'); }
function _parseMaterialMapText(text) { const rows = []; for (const line of _toText(text).replace(/^\uFEFF/, '').split(/\r?\n/)) { const m = line.match(/^\s*(\d+)\s+(.+?)\s*$/); if (m) rows.push({ code: m[1], material: m[2] }); } return rows; }
async function _loadMasterRows(spec) { const text = await _fetchTextAny(spec.files); return spec.parse === 'material' ? _parseMaterialMapText(text) : JSON.parse(text); }
function _syncMasterCardCounts(root, config) {
  const counts = {
    linelist: config?.linelist?.masterRows?.length || 0,
    pipingClass: config?.pipingClass?.masterRows?.length || 0,
    material: config?.material?.mapRows?.length || 0,
    weight: config?.weight?.masterRows?.length || 0
  };
  // Update Phase 2 master cards
  for (const card of root.querySelectorAll('.model-converters-workflow-master-card')) {
    if (card.querySelector('.mc-regex-extract-table')) continue;
    if (card.querySelector('.model-converters-workflow-run-status-row')) continue;
    const text = card.textContent || '';
    const nameMap = {
      'Line List': counts.linelist,
      'Piping Class': counts.pipingClass,
      'Material Map': counts.material,
      'Weights / Valve': counts.weight
    };
    const entry = Object.entries(nameMap).find(([label]) => text.includes(label));
    if (entry) {
      const countEl = card.querySelector('.model-converters-workflow-count');
      if (countEl) countEl.textContent = `${entry[1]} saved row(s)`;
    }
  }
  // Update Phase 5 Run status rows
  const labelToCount = {
    'Line List': counts.linelist,
    'Piping Class Master': counts.pipingClass,
    'Material Map': counts.material,
    'Valve Weights': counts.weight
  };
  for (const row of root.querySelectorAll('.model-converters-workflow-run-status-row')) {
    const labelEl = row.querySelector('span:not(.model-converters-workflow-run-status-icon)');
    const label = labelEl?.textContent?.trim();
    if (label && labelToCount[label] !== undefined) {
      const count = labelToCount[label];
      const iconEl = row.querySelector('.model-converters-workflow-run-status-icon');
      if (iconEl) {
        iconEl.className = `model-converters-workflow-run-status-icon ${count > 0 ? 'ok' : 'warn'}`;
        iconEl.textContent = count > 0 ? '✓' : '⚠';
      }
      const strong = row.querySelector('strong');
      if (strong) {
        strong.textContent = count > 0 ? `${count} row(s)` : 'not loaded';
      }
    }
  }
}
async function _loadDefaultMastersIntoConfig(panel) { const input = _supportConfigInput(panel); if (!input) return; if (_autoloadPromise) return _autoloadPromise; _autoloadPromise = (async () => { const config = _readSupportConfig(panel); let changed = false; const failures = []; for (const [sectionKey, spec] of Object.entries(MASTER_SPECS)) { const section = config[sectionKey] && typeof config[sectionKey] === 'object' ? config[sectionKey] : (config[sectionKey] = {}); if (Array.isArray(section[spec.rowsKey]) && section[spec.rowsKey].length) continue; try { section[spec.rowsKey] = await _loadMasterRows(spec); section.masterAutoloaded = true; changed = true; } catch (error) { section.masterAutoloadIssue = String(error?.message || error); failures.push(`${sectionKey}: ${section.masterAutoloadIssue}`); } } if (changed) _writeSupportConfig(panel, config); _syncMasterCardCounts(document, config); if (failures.length && !_autoloadWarned) { _autoloadWarned = true; console.warn('[xml-cii] default master autoload skipped for some masters:', failures.join(' || ')); } })().catch((error) => { if (!_autoloadWarned) console.warn('[xml-cii] default master autoload skipped:', error?.message || error); _autoloadWarned = true; }); return _autoloadPromise; }
function _normalizeSupportConfigInput(panel) { const input = _supportConfigInput(panel); if (!input || input.dataset.mcNormalizing === 'true') return null; const n = _normalizeSupportConfigJson(input.value); if (!n.changed) return n.config; input.dataset.mcNormalizing = 'true'; input.value = n.text; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); input.dataset.mcNormalizing = 'false'; return n.config; }

function _xmlText(el, name) { return Array.from(el?.children || []).find((child) => child.localName === name || child.tagName === name)?.textContent?.trim() || ''; }
function _xmlEnsure(doc, parent, name) { let child = Array.from(parent.children || []).find((c) => c.localName === name || c.tagName === name); if (!child) { child = doc.createElement(name); parent.appendChild(child); } return child; }
function _xmlSet(doc, parent, name, value) { _xmlEnsure(doc, parent, name).textContent = _toText(value); }
function _rowLineKey(row, config) { const map = config?.linelist?.fieldMap || {}; for (const key of [map.lineSeqNo, map.lineKey1, 'lineNo', 'lineKey', 'lineSeqNo', 'Line No', 'Line Number', 'ColumnX1']) { const value = _rowValue(row, key); if (value) return value.toUpperCase().replace(/\s+/g, ''); } return ''; }
function _branchLineKey(branchName, config) { const linelist = config?.linelist || {}; const cleaned = _toText(branchName).replace(/^\/+/, '').split('/')[0]; const parts = cleaned.split(_toText(linelist.tokenDelimiter || '-')).map((p) => p.trim()).filter(Boolean); const positions = _toText(linelist.lineKeyTokenPositions || '4').split(/[,+]/).map((p) => Number(p.trim()) - 1).filter(Number.isFinite); return positions.map((idx) => parts[idx]).filter(Boolean).join('').toUpperCase().replace(/\s+/g, ''); }
function _matchingLineRows(lineKey, config) { const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : []; const wanted = _toText(lineKey).toUpperCase().replace(/\s+/g, ''); return rows.filter((row) => _rowLineKey(row, config) === wanted); }
function _numericTokens(values) { return values.map((v) => (_toText(v).match(/-?\d+(?:\.\d+)?/) || [''])[0]).filter(Boolean); }
function _mappedProcessValue(lineKey, config, field, fallbacks = []) { const map = config?.linelist?.fieldMap || {}; const keys = [map[field], field, field.toUpperCase(), ...fallbacks].filter(Boolean); const values = []; for (const row of _matchingLineRows(lineKey, config)) { for (const key of keys) { const value = _rowValue(row, key); if (value) { values.push(value); break; } } } const nums = _numericTokens(values); if (!nums.length) return values[0] || ''; return (field === 't3' || field === 'densityMixed') ? nums[nums.length - 1] : nums[0]; }

function _dtxrRestraintTypes(text) { const upper = _toText(text).toUpperCase(); if (!upper.trim()) return []; const out = []; const add = (type) => { if (type && !out.includes(type)) out.push(type); }; if (/\b(REST|SHOE|SADDLE)\b|\bWEAR\s+PLATE\b|\bPAD\b/.test(upper)) add('+Y'); if (/\b(LINE\s*STOP|LINESTOP|LIMIT\s*STOP|LIMIT|LIM|DIRECTIONAL\s+ANCHOR|XST\d+)\b/.test(upper)) add('LIM'); if (/\b(GUIDE|GUI|PDO-TYPE-603)\b/.test(upper)) add('GUI'); if (!out.length && /\bANCHOR\b/.test(upper)) add('ANC'); return out; }
function _applyDtxrRestraints(doc, node, config) { const types = _dtxrRestraintTypes(`${_xmlText(node, 'DTXR_POS')}|${_xmlText(node, 'DTXR_PS')}`, config); if (!types.length) return; const useDtxrOnly = _readRestraintMode(); const existing = Array.from(node.children || []).filter((child) => child.localName === 'Restraint' || child.tagName === 'Restraint'); const keepTypes = []; if (!useDtxrOnly) for (const restraint of existing) { const type = _xmlText(restraint, 'Type'); if (type && !keepTypes.includes(type) && !types.includes(type)) keepTypes.push(type); } for (const restraint of existing) restraint.remove(); for (const type of [...keepTypes, ...types]) { const restraint = doc.createElement('Restraint'); _xmlSet(doc, restraint, 'Type', type); _xmlSet(doc, restraint, 'Stiffness', config?.defaultStiffness || '1.751270E+12'); _xmlSet(doc, restraint, 'Gap', config?.defaultGap ?? '0'); _xmlSet(doc, restraint, 'Friction', config?.defaultFriction ?? '0.3'); node.appendChild(restraint); } }
function _renumberNegativeNodes(doc, branchNodesList) { const allNodes = branchNodesList.flat(); const original = new Map(allNodes.map((node) => [node, Math.round(_num(_xmlText(node, 'NodeNumber')) || 0)])); const used = new Set(Array.from(original.values()).filter((n) => n > 0)); let fallback = 10000; for (const nodes of branchNodesList) nodes.forEach((node, index) => { const n = original.get(node) || 0; const type = _xmlText(node, 'ComponentType').toUpperCase(); const len = _num(_xmlText(node, 'ElementLengthMm')) || 0; if (n >= 0 || !NEGATIVE_RENUMBER_TYPES.has(type) || len <= 0) return; const prev = [...nodes.slice(0, index)].reverse().map((x) => original.get(x) || -1).find((x) => x > 0); const next = nodes.slice(index + 1).map((x) => original.get(x) || -1).find((x) => x > 0); const candidates = [next ? next - 1 : null, prev ? prev + 1 : null].filter((x) => x && x > 0); let assigned = candidates.find((x) => !used.has(x)); while (!assigned || used.has(assigned)) { assigned = fallback; fallback += 10; } _xmlSet(doc, node, 'NodeNumber', assigned); used.add(assigned); }); }

function _transformXml(xmlText, config) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return xmlText;
  const doc = new DOMParser().parseFromString(_toText(xmlText), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return xmlText;
  const defaultInsDensity = Number(config.insulationDensityDefault ?? 210) || 210;
  const branchNodesList = [];
  for (const branch of Array.from(doc.getElementsByTagName('Branch'))) {
    const lineKey = _branchLineKey(_xmlText(branch, 'Branchname'), config);
    if (_matchingLineRows(lineKey, config).length) {
      const pressure = _xmlEnsure(doc, branch, 'Pressure');
      const temp = _xmlEnsure(doc, branch, 'Temperature');
      const p1 = _mappedProcessValue(lineKey, config, 'p1', ['P1']);
      const t1 = _mappedProcessValue(lineKey, config, 't1', ['T1', 'Temp Max', 'Temperature Max']);
      const t2 = _mappedProcessValue(lineKey, config, 't2', ['T2', 'Temp', 'Temperature']);
      const t3 = _mappedProcessValue(lineKey, config, 't3', ['T3', 'Temp Min', 'Temperature Min']);
      const hydro = _mappedProcessValue(lineKey, config, 'hydroPressure', ['HydroPressure', 'Hydro Pressure', 'Hydro Test Pressure', 'Test Pressure']);
      const density = _mappedProcessValue(lineKey, config, 'densityMixed', ['Mixed kg/m³', 'Mixed kg/m3']) || _mappedProcessValue(lineKey, config, 'densityGas', ['Gas kg/m³', 'Gas kg/m3']) || _mappedProcessValue(lineKey, config, 'densityLiquid', ['Liquid kg/m³', 'Liquid kg/m3']);
      if (p1) _xmlSet(doc, pressure, 'Pressure1', p1); if (t1) _xmlSet(doc, temp, 'Temperature1', t1); if (t2) _xmlSet(doc, temp, 'Temperature2', t2); if (t3) _xmlSet(doc, temp, 'Temperature3', t3); if (hydro) _xmlSet(doc, pressure, 'HydroPressure', hydro); if (density) _xmlSet(doc, branch, 'FluidDensity', density);
    }
    let maxIns = _num(_xmlText(branch, 'InsulationThickness')) || 0;
    const nodes = Array.from(branch.children || []).filter((node) => node.localName === 'Node' || node.tagName === 'Node');
    branchNodesList.push(nodes);
    for (const node of nodes) { maxIns = Math.max(maxIns, _num(_xmlText(node, 'InsulationThickness')) || 0); if (NO_AUTO_WEIGHT_TYPES.has(_xmlText(node, 'ComponentType').toUpperCase())) _xmlSet(doc, node, 'Weight', '0'); _applyDtxrRestraints(doc, node, config); }
    _xmlSet(doc, branch, 'InsulationDensity', maxIns >= 50 ? defaultInsDensity : 0);
  }
  if (config?.splitCondensedValveFlange === true) _renumberNegativeNodes(doc, branchNodesList);
  return new XMLSerializer().serializeToString(doc);
}

function _isXmlToCiiWorkerMessage(message) { return message && message.type === 'run' && message.converterId === 'xml_to_cii'; }
function _installWorkerOptionPatch() { if (window[WORKER_PATCH_FLAG] || !window.Worker?.prototype?.postMessage) return; const originalPostMessage = window.Worker.prototype.postMessage; window.Worker.prototype.postMessage = function patchedPostMessage(message, transfer) { if (_isXmlToCiiWorkerMessage(message)) { const options = { ...(message.options || {}) }; const normalized = _normalizeSupportConfigJson(options.supportConfigJson || ''); const config = normalized.config || {}; config.splitCondensedValveFlange = _readSplitCondensedMode(); options.supportConfigJson = JSON.stringify(config, null, 2); options.useRestraintTypeBasedOnJson = _readRestraintMode(); const inputFiles = Array.isArray(message.inputFiles) ? message.inputFiles.map((file) => { if (file?.role !== 'primary' || !/\.xml$/i.test(file.name || '')) return file; const transformed = _transformXml(_decodeBytes(file.bytes), config); _lastFinalizedXmlText = transformed; return { ...file, bytes: _encodeText(transformed) }; }) : message.inputFiles; return originalPostMessage.call(this, { ...message, inputFiles, options }, transfer); } return originalPostMessage.call(this, message, transfer); }; window[WORKER_PATCH_FLAG] = true; }

function _injectStyle() { if (document.getElementById(STYLE_ID)) return; const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = `.model-converters-workflow-popup{width:min(98vw,calc(100vw - 12px))!important;min-width:min(1320px,calc(100vw - 12px));height:min(96vh,calc(100vh - 12px))!important;min-height:min(840px,calc(100vh - 12px))}.model-converters-workflow-popup select,.model-converters-workflow-popup option,[data-popup-panel] select,[data-popup-panel] option{font-size:11px!important;line-height:1.15!important}.model-converters-workflow-popup select,[data-popup-panel] select{max-width:100%;min-width:0}.mc-xml-cii-global-options{display:flex;flex-direction:column;gap:8px;margin:8px 0 10px 0}.mc-xml-cii-restraint-mode-option,.mc-xml-cii-ins-density-option{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;border:1px solid rgba(102,163,255,.28);border-radius:8px;background:rgba(58,113,193,.10);color:#d7e6ff;font-size:11px;line-height:1.3}.mc-xml-cii-restraint-mode-option strong,.mc-xml-cii-ins-density-option strong{color:#9cc5ff}.mc-xml-cii-restraint-mode-help{color:#93a9c6;font-size:10.5px;display:block;margin-top:2px}.mc-xml-cii-ins-density-option input{width:84px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:4px;padding:3px 6px;font-size:11px}.mc-enhanced-resizable-table th,.mc-enhanced-resizable-table td{white-space:nowrap}.mc-xml-cii-hydro-map{display:flex;align-items:center;gap:6px;margin:4px 0}.mc-xml-cii-hydro-map span{font-weight:600}.mc-xml-cii-hydro-map select{font-size:11px;min-width:260px}`; document.head.appendChild(style); }
function _selectedConverter(panel) { const select = panel.querySelector('select'); return select && Array.from(select.options || []).some((opt) => opt.value === 'xml_to_cii') ? select.value : ''; }
function _configTargets(panel) { const targets = []; for (const overlay of document.querySelectorAll('.model-converters-workflow-popup-overlay')) { const popupConfig = overlay.querySelector('[data-popup-panel="config"]'); if (popupConfig) targets.push(popupConfig.querySelector('[data-popup-config-status]')?.parentElement || popupConfig); const title = overlay.querySelector('.model-converters-workflow-detail-title')?.textContent || ''; if (/\bconfig\b/i.test(title)) targets.push(overlay.querySelector('.model-converters-workflow-detail-title')?.parentElement); } const panelTitle = panel.querySelector('.model-converters-workflow-detail-title')?.textContent || ''; if (/\bconfig\b/i.test(panelTitle)) targets.push(panel.querySelector('.model-converters-workflow-detail-title')?.parentElement); return targets.filter(Boolean); }
function _insertOptionControls(panel) { document.querySelectorAll('[data-mc-global-options]').forEach((el) => { if (!el.closest('[data-popup-panel="config"]') && !/\bconfig\b/i.test(el.parentElement?.querySelector?.('.model-converters-workflow-detail-title')?.textContent || '')) el.remove(); }); if (_selectedConverter(panel) !== 'xml_to_cii') return; for (const target of _configTargets(panel)) { if (target.querySelector('[data-mc-global-options]')) continue; const cfg = _readSupportConfig(panel); const value = Number(cfg.insulationDensityDefault ?? 210) || 210; target.insertAdjacentHTML('afterbegin', `<div class="mc-xml-cii-global-options" data-mc-global-options><label class="mc-xml-cii-restraint-mode-option"><input type="checkbox" data-mc-restraint-mode-checkbox ${_readRestraintMode() ? 'checked' : ''}><span><strong>Use Restraint type based on Json</strong><span class="mc-xml-cii-restraint-mode-help">ON: ignore XML &lt;Restraint&gt; and derive REST/GUIDE/LIMIT/LINESTOP/ANCHOR from DTXR_PS / DTXR_POS. OFF: merge XML restraints with DTXR-derived restraints.</span></span></label><label class="mc-xml-cii-restraint-mode-option"><input type="checkbox" data-mc-split-condensed-checkbox ${_readSplitCondensedMode() ? 'checked' : ''}><span><strong>Split Condensed Valve/Flange</strong><span class="mc-xml-cii-restraint-mode-help">Default OFF. ON: renumber negative valve/flange NodeNumber values (-1, -2, ...) into a global positive sequence. OFF: keep negative nodes untouched and skip this split attempt.</span></span></label><label class="mc-xml-cii-ins-density-option"><span><strong>Insulation density</strong><span class="mc-xml-cii-restraint-mode-help">Used only when insulation thickness ≥ 50 mm.</span></span><input type="number" min="0" step="1" data-mc-ins-density value="${_escapeHtml(value)}"><span>kg/m³</span></label></div>`); }
  document.querySelectorAll('[data-mc-restraint-mode-checkbox]').forEach((input) => { if (input.dataset.mcBound === 'true') return; input.addEventListener('change', () => { _writeRestraintMode(input.checked); document.querySelectorAll('[data-mc-restraint-mode-checkbox]').forEach((other) => { other.checked = input.checked; }); }); input.dataset.mcBound = 'true'; });
  document.querySelectorAll('[data-mc-split-condensed-checkbox]').forEach((input) => { if (input.dataset.mcBound === 'true') return; input.addEventListener('change', () => { _writeSplitCondensedMode(input.checked); const cfg = _readSupportConfig(panel); cfg.splitCondensedValveFlange = !!input.checked; _writeSupportConfig(panel, cfg); document.querySelectorAll('[data-mc-split-condensed-checkbox]').forEach((other) => { other.checked = input.checked; }); }); input.dataset.mcBound = 'true'; });
  document.querySelectorAll('[data-mc-ins-density]').forEach((input) => { if (input.dataset.mcBound === 'true') return; input.addEventListener('change', () => { const cfg = _readSupportConfig(panel); cfg.insulationDensityDefault = Number(input.value) || 210; _writeSupportConfig(panel, cfg); }); input.dataset.mcBound = 'true'; });
}
function _interceptFinalizedEnrichedXmlDownload(root) { root.querySelectorAll('.model-converters-output-row button[data-output-index]').forEach((button) => { if (button.dataset.mcFinalizedDownload === 'true') return; const name = button.parentElement?.querySelector('strong')?.textContent || ''; if (!/_enriched\.xml$/i.test(name)) return; button.dataset.mcFinalizedDownload = 'true'; button.addEventListener('click', (event) => { if (!_lastFinalizedXmlText) return; event.preventDefault(); event.stopImmediatePropagation(); const blob = new Blob([_lastFinalizedXmlText], { type: 'text/xml;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }, true); }); }
function _runEnhancements(panel) { _normalizeSupportConfigInput(panel); _loadDefaultMastersIntoConfig(panel); _insertOptionControls(panel); _syncMasterCardCounts(document, _readSupportConfig(panel)); _interceptFinalizedEnrichedXmlDownload(panel); document.querySelectorAll('.model-converters-workflow-popup-overlay').forEach(_interceptFinalizedEnrichedXmlDownload); }

export function enhanceModelConvertersTab(panel) { if (!panel) return () => {}; _installWorkerOptionPatch(); _injectStyle(); let raf = 0; const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => _runEnhancements(panel)); }; schedule(); const observer = new MutationObserver(schedule); observer.observe(panel, { childList: true, subtree: true }); observer.observe(document.body, { childList: true, subtree: true }); panel.addEventListener('change', (event) => { if (event.target?.matches?.('input[type="file"]')) _lastFinalizedXmlText = ''; }, true); return () => { cancelAnimationFrame(raf); observer.disconnect(); }; }
