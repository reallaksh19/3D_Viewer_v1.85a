import { PIPE_OD_TO_DN } from '../../pcf-legacy/services/bore-converter.js';
import {
  psnmMakeAxisTransform,
  psnmNumber,
  psnmParsePsPositionAny,
  psnmText,
  psnmTransformNodeToPs,
  psnmTransformPsToNode,
} from './psnm-axis-transform-core.js';

const PSNM_DEFAULT_COORD_DECIMALS = 2;
const PSNM_EXACT_EPS_MM = 0.01;
const PSNM_EPS = 1e-9;
const PSNM_TIE_EPS_MM = 1e-6;
const PSNM_TRUE_VALUES = new Set(['yes', 'y', 'true', '1', 'm', 'mandatory', 'required', 'req', 'must']);

function PSNM_safeString(value) { return String(value ?? '').trim(); }
function PSNM_number(value) { return psnmNumber(value); }
function PSNM_roundCoord(value, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const factor = 10 ** Number(decimals || PSNM_DEFAULT_COORD_DECIMALS);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
function PSNM_assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`[PSNM] Invalid numeric value for ${label}: ${value}`);
}
function PSNM_bool(value) { return PSNM_TRUE_VALUES.has(PSNM_safeString(value).toLowerCase()); }
function PSNM_normalizeBoreMode(value) {
  const mode = PSNM_safeString(value).toLowerCase().replace(/[\s_-]+/g, '_');
  if (mode === 'strict' || mode === 'strict_bore') return 'strict';
  if (mode === 'ignore' || mode === 'ignore_bore' || mode === 'coordinate_only' || mode === 'coord_only') return 'ignore';
  return 'prefer';
}
function PSNM_firstFiniteNumber(...values) {
  for (const value of values) {
    const n = PSNM_number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}
function PSNM_directBoreFromRow(row) {
  return PSNM_firstFiniteNumber(row.bore, row.nb, row.dn, row['bore mm'], row['bore(mm)'], row['nominal bore'], row['p1bore'], row.p1bore);
}
function PSNM_mandatoryFromRow(row) {
  return PSNM_bool(row.mandatory || row.required || row['is mandatory'] || row['must match'] || row.req || row.mand || row.m);
}
function PSNM_normalizeHeader(header) {
  return PSNM_safeString(header).toLowerCase().replace(/\s+/g, ' ').replace(/[_.-]+/g, ' ').trim();
}
function PSNM_splitTableLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((value) => value.trim());
  return raw.split(/ {2,}/).map((value) => value.trim()).filter(Boolean);
}
function PSNM_parseTableRows(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  if (!lines.length) return [];
  const headers = PSNM_splitTableLine(lines[0]).map(PSNM_normalizeHeader);
  return lines.slice(1).map((line, index) => {
    const cells = PSNM_splitTableLine(line);
    const row = { __raw: line, __rowIndex: index + 1 };
    headers.forEach((header, cellIndex) => { row[header] = cells[cellIndex] ?? ''; });
    return row;
  });
}

export function PSNM_roundUp1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.ceil((n - PSNM_EPS) * 10) / 10 : null;
}
const PSNM_OD_TO_BORE = new Map(PIPE_OD_TO_DN.map((row) => [PSNM_roundUp1(row.od).toFixed(1), row.dn]));
export function PSNM_boreFromOdMm(odMm) {
  const rounded = PSNM_roundUp1(odMm);
  if (rounded == null) return null;
  const strict = PSNM_OD_TO_BORE.get(rounded.toFixed(1));
  if (strict != null) return strict;
  let best = null;
  let bestErr = Infinity;
  for (const row of PIPE_OD_TO_DN) {
    const err = Math.abs(Number(row.od) - Number(odMm));
    if (err < bestErr) { bestErr = err; best = row; }
  }
  return best && bestErr <= Math.max(2, Math.abs(Number(best.od)) * 0.008) ? best.dn : null;
}

export function PSNM_createRunLogger() {
  const userLog = [];
  const debugLog = [];
  let sequence = 0;
  function debug(level, code, message, data = {}) {
    debugLog.push({ sequence: ++sequence, timestamp: new Date().toISOString(), level: String(level || 'INFO').toUpperCase(), code: String(code || 'TRACE'), message: String(message || ''), data });
  }
  function user(level, category, source, item, reason, suggestedAction, data = {}) {
    const entry = { level: String(level || 'INFO').toUpperCase(), category: String(category || ''), source: String(source || ''), item: String(item || ''), reason: String(reason || ''), suggestedAction: String(suggestedAction || ''), data };
    userLog.push(entry);
    debug(entry.level, `USER_${entry.category.toUpperCase().replace(/\s+/g, '_')}`, entry.reason, { source: entry.source, item: entry.item, suggestedAction: entry.suggestedAction, ...data });
  }
  return { userLog, debugLog, debug, user };
}

function PSNM_auditAction(status, label) {
  if (status === 'AUDIT_REQUIRED_PS_NAME_MISSING') return 'Add PS NAME for this mandatory PS audit row.';
  if (status === 'AUDIT_REQUIRED_PS_POSITION_MISSING') return `Add/verify Position or E/N/U for mandatory PS ${label || 'row'}.`;
  if (status === 'AUDIT_REQUIRED_PS_BORE_MISSING') return `Add/verify p1bore for mandatory PS ${label || 'row'}.`;
  if (status === 'AUDIT_REQUIRED_NODE_NAME_MISSING') return 'Add Node number for this mandatory node audit row.';
  if (status === 'AUDIT_REQUIRED_NODE_COORDINATE_MISSING') return `Add/verify X/Y/Z or Position for mandatory Node ${label || 'row'}.`;
  return 'Review mandatory audit row.';
}
function PSNM_logMandatoryAudit(logger, source, item, status, action, row) {
  logger?.user?.('ERROR', 'Mandatory Audit', source, item || row?.__raw || '', status, action, row || {});
}

export function PSNM_parsePsPosition(positionText) {
  const result = psnmParsePsPositionAny(positionText);
  PSNM_assertFinite(result.e, 'PS position E/W');
  PSNM_assertFinite(result.s, 'PS position S/N');
  PSNM_assertFinite(result.u, 'PS position U/D');
  return result;
}
export function PSNM_parseNodePosition(positionText) {
  const parts = String(positionText || '').split(',').map((value) => PSNM_number(value));
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) throw new Error(`[PSNM] Invalid transformed node position: ${positionText}`);
  return { x: parts[0], y: parts[1], z: parts[2] };
}
function PSNM_globalAxisTransform(anchor) {
  const t = typeof window !== 'undefined' ? window.__PSNM_AXIS_TRANSFORM : null;
  if (!t?.axisMode) return null;
  const anchorNode = PSNM_safeString(anchor?.node);
  const anchorPsName = PSNM_safeString(anchor?.psName);
  if (t.anchorNode && anchorNode && String(t.anchorNode) !== anchorNode) return null;
  if (t.anchorPsName && anchorPsName && String(t.anchorPsName) !== anchorPsName) return null;
  return t;
}
export function PSNM_deriveTransformFromAnchor(anchor) {
  const globalTransform = PSNM_globalAxisTransform(anchor);
  if (globalTransform) return globalTransform;
  const ps = PSNM_parsePsPosition(anchor.psPosition);
  const node = PSNM_parseNodePosition(anchor.nodePosition);
  return psnmMakeAxisTransform(ps, node, ['x', 'y', 'z'], { e: 1, u: 1, s: 1 });
}
export function PSNM_transformPsPosition(positionText, transform, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const node = psnmTransformPsToNode(PSNM_parsePsPosition(positionText), transform);
  return { x: PSNM_roundCoord(node.x, decimals), y: PSNM_roundCoord(node.y, decimals), z: PSNM_roundCoord(node.z, decimals) };
}
export function PSNM_transformNodeToPsPosition(nodeCoord, transform, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  const ps = psnmTransformNodeToPs(nodeCoord, transform);
  return { e: PSNM_roundCoord(ps.e, decimals), u: PSNM_roundCoord(ps.u, decimals), s: PSNM_roundCoord(ps.s, decimals) };
}
function PSNM_psKey(psCoord, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return [PSNM_roundCoord(psCoord.e, decimals).toFixed(decimals), PSNM_roundCoord(psCoord.u, decimals).toFixed(decimals), PSNM_roundCoord(psCoord.s, decimals).toFixed(decimals)].join('|');
}
function PSNM_nodeKey(nodeCoord, decimals = PSNM_DEFAULT_COORD_DECIMALS) {
  return [PSNM_roundCoord(nodeCoord.x, decimals).toFixed(decimals), PSNM_roundCoord(nodeCoord.y, decimals).toFixed(decimals), PSNM_roundCoord(nodeCoord.z, decimals).toFixed(decimals)].join('|');
}

export function PSNM_parsePsRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const psName = row['ps name'] || row.psname || row['ps no'] || row['ps number'] || row.ps || row.name || '';
    const positionDirect = row.position || row['ps position'] || row['position raw'] || row.coordinates || row.coord || row.coordinate || '';
    let position = PSNM_safeString(positionDirect);
    const e = PSNM_firstFiniteNumber(row.e, row['ps e'], row.east, row.easting);
    const nOrS = PSNM_firstFiniteNumber(row.s, row['ps s'], row.south, row.southing, row.n, row['ps n'], row.north, row.northing);
    const u = PSNM_firstFiniteNumber(row.u, row['ps u'], row.up, row.elevation, row.el, row.z);
    if (!position && [e, nOrS, u].every(Number.isFinite)) position = `E ${e}mm S ${nOrS}mm U ${u}mm`;
    const p1bore = PSNM_number(row.p1bore || row['p1 bore'] || row.bore || row.nb || row.dn || row['bore mm'] || row['bore(mm)']);
    const isMandatoryPs = PSNM_mandatoryFromRow(row);
    if (!psName || !position) {
      if (isMandatoryPs) {
        const status = !psName ? 'AUDIT_REQUIRED_PS_NAME_MISSING' : 'AUDIT_REQUIRED_PS_POSITION_MISSING';
        const action = PSNM_auditAction(status, psName);
        PSNM_logMandatoryAudit(logger, 'PS Table', psName || row.__raw, status, action, row);
        parsed.push({ psName: PSNM_safeString(psName), position: PSNM_safeString(position), p1bore, isMandatoryPs: true, mandatorySource: 'PS_TABLE', rowIndex: row.__rowIndex, auditStatus: status, auditSeverity: 'ERROR', auditAction: action, rawAuditRow: row.__raw });
      } else logger?.user?.('ERROR', 'Parse Failed', 'PS Table', row.__raw, 'PS row must contain PS NAME and Position or separate E/N/U columns.', 'Paste PS table with columns: PS NAME, Position, p1bore or PS NAME, E, N, U, p1bore.', { row });
      continue;
    }
    const auditStatus = isMandatoryPs && !Number.isFinite(p1bore) ? 'AUDIT_REQUIRED_PS_BORE_MISSING' : '';
    const auditAction = auditStatus ? PSNM_auditAction(auditStatus, psName) : '';
    if (auditStatus) PSNM_logMandatoryAudit(logger, 'PS Table', psName, auditStatus, auditAction, row);
    parsed.push({ psName: PSNM_safeString(psName).replace(/\.$/, ''), position, p1bore, isMandatoryPs, mandatorySource: isMandatoryPs ? 'PS_TABLE' : '', rowIndex: row.__rowIndex, auditStatus, auditSeverity: auditStatus ? 'ERROR' : '', auditAction, rawAuditRow: auditStatus ? row.__raw : '' });
  }
  return parsed;
}
export function PSNM_parseNodeRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const node = row.node || row['node no'] || row['node number'] || '';
    const position = row['position(x,y,z) transformed'] || row['position(x,y,z)'] || row.position || row['transformed position'] || '';
    const x = PSNM_number(row.x);
    const y = PSNM_number(row.y);
    const z = PSNM_number(row.z);
    const directBoreMm = PSNM_directBoreFromRow(row);
    const hasDirectBore = Number.isFinite(directBoreMm);
    const isMandatoryNode = PSNM_mandatoryFromRow(row);
    if (!node) {
      if (isMandatoryNode) {
        const status = 'AUDIT_REQUIRED_NODE_NAME_MISSING';
        const action = PSNM_auditAction(status, node);
        PSNM_logMandatoryAudit(logger, 'Node XYZ Table', row.__raw, status, action, row);
        parsed.push({ node: '', directBoreMm: hasDirectBore ? directBoreMm : null, isMandatoryNode: true, rowMandatorySource: 'NODE_TABLE', rowIndex: row.__rowIndex, auditStatus: status, auditSeverity: 'ERROR', auditAction: action, rawAuditRow: row.__raw });
      } else logger?.user?.('ERROR', 'Parse Failed', 'Node XYZ Table', row.__raw, 'Node row must contain Node.', 'Paste Node table with columns: Node, X, Y, Z.', { row });
      continue;
    }
    const base = { node: PSNM_safeString(node), directBoreMm: hasDirectBore ? directBoreMm : null, isMandatoryNode, rowMandatorySource: isMandatoryNode ? 'NODE_TABLE' : '', rowIndex: row.__rowIndex };
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) parsed.push({ ...base, x, y, z, position: `${x}, ${y}, ${z}` });
    else if (position) parsed.push({ ...base, position: PSNM_safeString(position) });
    else if (isMandatoryNode) {
      const status = 'AUDIT_REQUIRED_NODE_COORDINATE_MISSING';
      const action = PSNM_auditAction(status, node);
      PSNM_logMandatoryAudit(logger, 'Node XYZ Table', node, status, action, row);
      parsed.push({ ...base, auditStatus: status, auditSeverity: 'ERROR', auditAction: action, rawAuditRow: row.__raw });
    } else logger?.user?.('ERROR', 'Parse Failed', 'Node XYZ Table', row.__raw, 'Node row must contain X/Y/Z or Position.', 'Paste Node table as Node, X, Y, Z or legacy Node, Position.', { row });
  }
  return parsed;
}
export function PSNM_parseNodeDiaRows(text, logger = null) {
  const parsed = [];
  for (const row of PSNM_parseTableRows(text)) {
    const node = row.node || row['node no'] || row['node number'] || '';
    const odMm = PSNM_number(row['dia(mm)'] || row['dia mm'] || row.dia || row.odmm || row['od mm'] || row.od);
    if (!node || !Number.isFinite(odMm)) {
      logger?.user?.('ERROR', 'Parse Failed', 'Node Dia Table', row.__raw, 'Node dia row must contain Node and Dia(mm).', 'Paste Node Dia table with columns: Node, Dia(mm).', { row });
      continue;
    }
    parsed.push({ node: PSNM_safeString(node), odMm, rowIndex: row.__rowIndex });
  }
  return parsed;
}
export function PSNM_parseMandatoryNodeRows(text, logger = null) {
  const nodes = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^-{3,}$/.test(line));
  for (const line of lines) {
    if (/mandatory|node/i.test(line) && !/-?\d+/.test(line)) continue;
    const match = line.match(/-?\d+/);
    if (!match) continue;
    const node = match[0];
    if (seen.has(node)) {
      logger?.user?.('WARNING', 'Duplicate Mandatory Node', 'Mandatory Node List', node, 'Mandatory node appears more than once.', 'Remove duplicate entry from mandatory node list.', { line });
      continue;
    }
    seen.add(node);
    nodes.push({ node, rowIndex: nodes.length + 1, mandatorySource: 'MANDATORY_NODE_LIST' });
  }
  return nodes;
}

function PSNM_distancePs(a, b) {
  const dx = Math.abs(a.e - b.e);
  const dy = Math.abs(a.u - b.u);
  const dz = Math.abs(a.s - b.s);
  return { dx, dy, dz, maxAxisDeltaMm: Math.max(dx, dy, dz), euclideanDeltaMm: Math.sqrt(dx * dx + dy * dy + dz * dz) };
}
function PSNM_within(delta, tolerance) { return delta.dx <= tolerance.xMm && delta.dy <= tolerance.yMm && delta.dz <= tolerance.zMm; }
function PSNM_classifyCoordinate({ psKey, nodePsKey, delta, cfg }) {
  if (psKey === nodePsKey && delta.maxAxisDeltaMm <= PSNM_EXACT_EPS_MM) return 'EXACT';
  if (cfg.enableApprox1 && PSNM_within(delta, cfg.approx1)) return 'APPROX_1';
  if (cfg.enableApprox2 && PSNM_within(delta, cfg.approx2)) return 'APPROX_2';
  if (cfg.enableApprox3 && PSNM_within(delta, cfg.approx3)) return 'APPROX_3';
  return 'NO_MATCH';
}
function PSNM_coordMatchType(type) { return type === 'NO_MATCH' ? 'NO_MATCH' : `COORD_${type}`; }
function PSNM_boreStatus({ boreMode, boreMatch, psBore, nodeBoreMm, boreConflict }) {
  const missing = !Number.isFinite(psBore) || nodeBoreMm == null;
  if (boreMode === 'ignore') {
    if (boreConflict) return 'CONFLICT_IGNORED';
    if (missing) return 'MISSING_IGNORED';
    return 'NOT_CHECKED';
  }
  if (boreMatch) return 'PASS';
  if (boreConflict) return 'CONFLICT';
  if (missing) return 'MISSING';
  return 'FAIL';
}
function PSNM_effectiveMatchType(coordType, boreStatus, boreMode) {
  if (coordType === 'NO_MATCH') return 'NO_MATCH';
  if (boreMode === 'strict') return boreStatus === 'PASS' ? coordType : 'NO_MATCH';
  if (boreMode === 'ignore') return PSNM_coordMatchType(coordType);
  return boreStatus === 'PASS' ? coordType : PSNM_coordMatchType(coordType);
}
function PSNM_rankMatchType(type) {
  if (type === 'EXACT' || type === 'COORD_EXACT') return 1;
  if (type === 'APPROX_1' || type === 'COORD_APPROX_1') return 2;
  if (type === 'APPROX_2' || type === 'COORD_APPROX_2') return 3;
  if (type === 'APPROX_3' || type === 'COORD_APPROX_3') return 4;
  return 99;
}
function PSNM_boreRank(status) {
  if (status === 'PASS') return 0;
  if (status === 'NOT_CHECKED' || status === 'MISSING_IGNORED' || status === 'CONFLICT_IGNORED') return 1;
  if (status === 'MISSING') return 2;
  if (status === 'CONFLICT') return 3;
  return 4;
}
function PSNM_mandatoryPairRank(candidate) {
  if (candidate.isMandatoryPs && candidate.isMandatoryNode) return 0;
  if (candidate.isMandatoryPs && !candidate.isMandatoryNode) return 1;
  if (!candidate.isMandatoryPs && candidate.isMandatoryNode) return 2;
  return 3;
}
function PSNM_candidateCompare(a, b) {
  return PSNM_rankMatchType(a.matchType) - PSNM_rankMatchType(b.matchType)
    || PSNM_mandatoryPairRank(a) - PSNM_mandatoryPairRank(b)
    || PSNM_boreRank(a.boreStatus) - PSNM_boreRank(b.boreStatus)
    || a.maxAxisDeltaMm - b.maxAxisDeltaMm
    || a.euclideanDeltaMm - b.euclideanDeltaMm
    || Number(a.isTerminal) - Number(b.isTerminal)
    || a.rowIndex - b.rowIndex
    || String(a.matchingNode).localeCompare(String(b.matchingNode), undefined, { numeric: true });
}
function PSNM_isAmbiguousTie(a, b) {
  if (!a || !b) return false;
  return a.matchType === b.matchType && PSNM_mandatoryPairRank(a) === PSNM_mandatoryPairRank(b) && a.boreStatus === b.boreStatus && a.isTerminal === b.isTerminal && Math.abs(a.maxAxisDeltaMm - b.maxAxisDeltaMm) <= PSNM_TIE_EPS_MM && Math.abs(a.euclideanDeltaMm - b.euclideanDeltaMm) <= PSNM_TIE_EPS_MM;
}
function PSNM_makeOccurrenceId(node, count) { return `${node}#${String(count).padStart(3, '0')}`; }
function PSNM_finalStatus(selected, boreMode) {
  if (boreMode === 'ignore') return 'MATCHED_COORD_ONLY';
  if (selected.boreStatus !== 'PASS') return 'MATCHED_WITH_WARNING';
  return selected.matchType?.startsWith('COORD_') ? 'MATCHED_COORD_ONLY' : 'MATCHED';
}
function PSNM_nodeBoreModel({ row, node, odMm, roundedOdMm, odDerivedBoreMm, logger }) {
  const directBoreMm = Number.isFinite(row.directBoreMm) ? row.directBoreMm : null;
  const hasDirect = directBoreMm != null;
  const hasDerived = odDerivedBoreMm != null;
  const conflict = hasDirect && hasDerived && Math.abs(directBoreMm - odDerivedBoreMm) > 1e-6;
  let nodeBoreMm = null;
  let nodeBoreSource = 'MISSING';
  if (hasDirect) { nodeBoreMm = directBoreMm; nodeBoreSource = conflict ? 'TABLE2_BORE_CONFLICT_PRIMARY' : 'TABLE2_BORE'; }
  else if (hasDerived) { nodeBoreMm = odDerivedBoreMm; nodeBoreSource = 'NODE_DIA_OD_MAP'; }
  if (conflict) logger.user('WARNING', 'Bore Conflict', 'Node XYZ + Node Dia', node, `Table 2 bore ${directBoreMm} differs from OD-derived bore ${odDerivedBoreMm}.`, 'Table 2 direct bore is used as primary; verify Node Dia table.', { node, directBoreMm, odMm, odDerivedBoreMm });
  return { directBoreMm, odDerivedBoreMm, nodeBoreMm, nodeBoreSource, boreConflict: conflict };
}

export function PSNM_buildMatchTable(options) {
  const logger = options.logger || PSNM_createRunLogger();
  const coordinateDecimals = Number(options.coordinateDecimals ?? PSNM_DEFAULT_COORD_DECIMALS);
  const boreMode = PSNM_normalizeBoreMode(options.boreMode);
  const cfg = { enableApprox1: options.enableApprox1 !== false, enableApprox2: options.enableApprox2 !== false, enableApprox3: options.enableApprox3 !== false, approx1: options.approx1 || { xMm: 25, yMm: 25, zMm: 25 }, approx2: options.approx2 || { xMm: 50, yMm: 25, zMm: 50 }, approx3: options.approx3 || options.approx2 || { xMm: 50, yMm: 25, zMm: 50 } };
  const psRows = options.psRows || [];
  const nodeRows = options.nodeRows || [];
  const nodeDiaRows = options.nodeDiaRows || [];
  const mandatoryNodeRows = options.mandatoryNodeRows || [];
  const mandatorySet = new Set(mandatoryNodeRows.map((row) => PSNM_safeString(row.node)).filter(Boolean));
  logger.debug('INFO', 'INIT', 'PSNM run started.', { psRows: psRows.length, nodeRows: nodeRows.length, nodeDiaRows: nodeDiaRows.length, mandatoryNodes: mandatorySet.size, coordinateDecimals, boreMode, cfg });
  const transform = PSNM_deriveTransformFromAnchor(options.anchor);
  logger.debug('INFO', 'BASE_TRANSFORM', 'Derived base transform. Node XYZ rows are transformed to PS E/U/S before matching.', { anchor: options.anchor, transform });
  const diaByNode = new Map();
  for (const row of nodeDiaRows) {
    const node = PSNM_safeString(row.node);
    const od = Number(row.odMm);
    if (!node || !Number.isFinite(od)) continue;
    if (!diaByNode.has(node)) diaByNode.set(node, od);
  }
  const nodeCandidates = [];
  const occurrenceCounter = new Map();
  const occurrencesByNode = new Map();
  for (const row of nodeRows) {
    try {
      const node = PSNM_safeString(row.node);
      const count = (occurrenceCounter.get(node) || 0) + 1;
      occurrenceCounter.set(node, count);
      const nodeXyz = Number.isFinite(row.x) && Number.isFinite(row.y) && Number.isFinite(row.z) ? { x: row.x, y: row.y, z: row.z } : PSNM_parseNodePosition(row.position);
      const nodePs = PSNM_transformNodeToPsPosition(nodeXyz, transform, coordinateDecimals);
      const odMm = diaByNode.get(node) ?? null;
      const roundedOdMm = odMm == null ? null : PSNM_roundUp1(odMm);
      const odDerivedBoreMm = odMm == null ? null : PSNM_boreFromOdMm(odMm);
      const boreModel = PSNM_nodeBoreModel({ row, node, odMm, roundedOdMm, odDerivedBoreMm, logger });
      const nodeMandatorySources = [];
      if (row.isMandatoryNode) nodeMandatorySources.push('NODE_TABLE');
      if (mandatorySet.has(node)) nodeMandatorySources.push('MANDATORY_NODE_LIST');
      const isMandatoryNode = nodeMandatorySources.length > 0;
      const nodeEntry = { node, occurrenceId: PSNM_makeOccurrenceId(node, count), rowIndex: row.rowIndex ?? count, coord: nodeXyz, nodePs, nodeKey: PSNM_nodeKey(nodeXyz, coordinateDecimals), nodePsKey: PSNM_psKey(nodePs, coordinateDecimals), odMm, roundedOdMm, boreMm: boreModel.nodeBoreMm, nodeBoreMm: boreModel.nodeBoreMm, directBoreMm: boreModel.directBoreMm, odDerivedBoreMm: boreModel.odDerivedBoreMm, nodeBoreSource: boreModel.nodeBoreSource, boreConflict: boreModel.boreConflict, isMandatory: isMandatoryNode, isMandatoryNode, mandatorySource: nodeMandatorySources.join(';'), isTerminal: node === '-1', selected: false };
      nodeCandidates.push(nodeEntry);
      if (!occurrencesByNode.has(node)) occurrencesByNode.set(node, []);
      occurrencesByNode.get(node).push(nodeEntry);
    } catch (error) {
      logger.user('ERROR', 'Parse Failed', 'Node XYZ Table', row.node || row.position, error.message || String(error), 'Correct node coordinate format: Node, X, Y, Z.', { row });
    }
  }
  const rows = [];
  const candidateRows = [];
  for (const psRow of psRows) {
    const psName = PSNM_safeString(psRow.psName).replace(/\.$/, '');
    try {
      const psCoord = PSNM_parsePsPosition(psRow.position);
      const psRounded = { e: PSNM_roundCoord(psCoord.e, coordinateDecimals), u: PSNM_roundCoord(psCoord.u, coordinateDecimals), s: PSNM_roundCoord(psCoord.s, coordinateDecimals) };
      const psNodeSpace = PSNM_transformPsPosition(psRow.position, transform, coordinateDecimals);
      const psKey = PSNM_psKey(psRounded, coordinateDecimals);
      const psBore = Number(psRow.p1bore);
      const isMandatoryPs = psRow.isMandatoryPs === true;
      const candidates = [];
      for (const nodeRow of nodeCandidates) {
        const delta = PSNM_distancePs(psRounded, nodeRow.nodePs);
        const coordType = PSNM_classifyCoordinate({ psKey, nodePsKey: nodeRow.nodePsKey, delta, cfg });
        const boreMatch = Number.isFinite(psBore) && nodeRow.nodeBoreMm != null && Math.abs(psBore - nodeRow.nodeBoreMm) <= 1e-6;
        const boreStatus = PSNM_boreStatus({ boreMode, boreMatch, psBore, nodeBoreMm: nodeRow.nodeBoreMm, boreConflict: nodeRow.boreConflict });
        const matchType = PSNM_effectiveMatchType(coordType, boreStatus, boreMode);
        const candidate = { psName, position: psRow.position, isMandatoryPs, psMandatorySource: isMandatoryPs ? (psRow.mandatorySource || 'PS_TABLE') : '', psE: psRounded.e, psU: psRounded.u, psS: psRounded.s, transformedX: psNodeSpace.x, transformedY: psNodeSpace.y, transformedZ: psNodeSpace.z, matchingNode: nodeRow.node, occurrenceId: nodeRow.occurrenceId, isMandatory: nodeRow.isMandatoryNode, isMandatoryNode: nodeRow.isMandatoryNode, nodeMandatorySource: nodeRow.mandatorySource, mandatoryPairRank: null, isTerminal: nodeRow.isTerminal, rowIndex: nodeRow.rowIndex, nodeX: nodeRow.coord.x, nodeY: nodeRow.coord.y, nodeZ: nodeRow.coord.z, nodeE: nodeRow.nodePs.e, nodeU: nodeRow.nodePs.u, nodeS: nodeRow.nodePs.s, coordMatchType: coordType, matchType, boreMode, psBore: Number.isFinite(psBore) ? psBore : null, nodeOdMm: nodeRow.odMm, nodeRoundedOdMm: nodeRow.roundedOdMm, nodeBoreMm: nodeRow.nodeBoreMm, directBoreMm: nodeRow.directBoreMm, odDerivedBoreMm: nodeRow.odDerivedBoreMm, nodeBoreSource: nodeRow.nodeBoreSource, boreConflict: nodeRow.boreConflict, boreStatus, dxMm: delta.dx, dyMm: delta.dy, dzMm: delta.dz, maxAxisDeltaMm: delta.maxAxisDeltaMm, euclideanDeltaMm: delta.euclideanDeltaMm, decision: 'REJECTED_NO_MATCH', reason: coordType === 'NO_MATCH' ? 'Outside enabled coordinate tolerance.' : 'Rejected by bore policy or ranking.' };
        candidate.mandatoryPairRank = PSNM_mandatoryPairRank(candidate);
        if (matchType !== 'NO_MATCH') candidates.push(candidate);
      }
      candidates.sort(PSNM_candidateCompare);
      if (!candidates.length) {
        logger.user(isMandatoryPs ? 'WARNING' : 'INFO', isMandatoryPs ? 'Mandatory PS Unmapped' : 'Optional PS Unmapped', 'PS Table', psName, 'No transformed Node XYZ row found within enabled tolerance and bore policy.', 'Check auto-anchor axis transform, bore mode, node table, or tolerance.', { psName, psCoord: psRounded, psBore, isMandatoryPs, boreMode, transform });
        rows.push({ psName, position: psRow.position, isMandatoryPs, psMandatorySource: psRow.mandatorySource || '', psE: psRounded.e, psU: psRounded.u, psS: psRounded.s, transformedX: psNodeSpace.x, transformedY: psNodeSpace.y, transformedZ: psNodeSpace.z, matchingNode: '', occurrenceId: '', isMandatory: false, isMandatoryNode: false, matchType: 'NO_MATCH', coordMatchType: 'NO_MATCH', finalStatus: 'UNMAPPED', boreMode, psBore: Number.isFinite(psBore) ? psBore : null, nodeOdMm: null, nodeRoundedOdMm: null, nodeBoreMm: null, nodeBoreSource: 'MISSING', boreConflict: false, boreStatus: 'N/A', dxMm: null, dyMm: null, dzMm: null, maxAxisDeltaMm: null, euclideanDeltaMm: null });
        continue;
      }
      const top = candidates[0];
      const ambiguous = candidates.length > 1 && PSNM_isAmbiguousTie(candidates[0], candidates[1]);
      if (ambiguous) {
        const tied = candidates.filter((candidate) => PSNM_isAmbiguousTie(top, candidate));
        tied.forEach((candidate) => { candidate.decision = 'AMBIGUOUS'; candidate.reason = 'Equivalent top-ranked candidate. Manual review required.'; candidateRows.push(candidate); });
        candidates.filter((candidate) => !tied.includes(candidate)).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'Lower ranked than ambiguous top candidate set.'; candidateRows.push(candidate); });
        rows.push({ ...top, matchingNode: '', occurrenceId: '', matchType: 'AMBIGUOUS', finalStatus: 'USER_REVIEW_REQUIRED', candidateCount: tied.length });
        continue;
      }
      const selected = top;
      selected.decision = 'SELECTED';
      selected.reason = selected.isMandatoryPs && selected.isMandatoryNode ? 'Selected as best-ranked mandatory PS to mandatory Node candidate.' : selected.isMandatoryNode ? 'Selected as best-ranked candidate; mandatory node priority applied.' : 'Selected as best-ranked candidate by coordinate, mandatory pairing, bore policy, and delta.';
      candidates.slice(1).forEach((candidate) => { candidate.decision = 'REJECTED_BY_RANK'; candidate.reason = 'A higher ranked candidate was selected.'; });
      candidateRows.push(...candidates);
      const selectedNode = nodeCandidates.find((node) => node.occurrenceId === selected.occurrenceId);
      if (selectedNode) selectedNode.selected = true;
      const finalStatus = PSNM_finalStatus(selected, boreMode);
      rows.push({ ...selected, finalStatus });
    } catch (error) {
      logger.user('ERROR', 'Parse Failed', 'PS Table', psName || psRow.position, error.message || String(error), 'Correct PS position format: E ...mm S/N ...mm U/D ...mm.', { psRow });
    }
  }
  const mandatoryCoverageRows = [];
  for (const mandatory of mandatoryNodeRows) {
    const node = PSNM_safeString(mandatory.node);
    if (!node) continue;
    const occurrences = occurrencesByNode.get(node) || [];
    const coveredOccurrences = occurrences.filter((occurrence) => occurrence.selected);
    const status = occurrences.length === 0 ? 'MISSING_FROM_NODE_TABLE' : coveredOccurrences.length > 0 ? 'COVERED' : 'UNCOVERED';
    mandatoryCoverageRows.push({ node, mandatorySource: 'MANDATORY_NODE_LIST', inNodeTable: occurrences.length > 0, occurrences: occurrences.length, coveredOccurrences: coveredOccurrences.length, status, occurrenceIds: occurrences.map((item) => item.occurrenceId), matchedPsNames: rows.filter((match) => match.matchingNode === node && match.finalStatus?.startsWith('MATCHED')).map((match) => match.psName) });
  }
  for (const nodeRow of nodeCandidates) {
    if (!nodeRow.selected && nodeRow.isMandatoryNode === true && !mandatorySet.has(nodeRow.node)) {
      mandatoryCoverageRows.push({ node: nodeRow.node, mandatorySource: nodeRow.mandatorySource || 'NODE_TABLE', inNodeTable: true, occurrences: 1, coveredOccurrences: 0, status: 'UNCOVERED', occurrenceIds: [nodeRow.occurrenceId], matchedPsNames: [] });
    }
  }
  const mandatoryPsCoverageRows = psRows.filter((psRow) => psRow.isMandatoryPs === true).map((psRow) => {
    const match = rows.find((row) => row.psName === psRow.psName);
    const status = !match || match.finalStatus === 'UNMAPPED' ? 'UNMAPPED' : match.finalStatus === 'USER_REVIEW_REQUIRED' ? 'AMBIGUOUS' : 'COVERED';
    return { psName: psRow.psName, mandatorySource: psRow.mandatorySource || 'PS_TABLE', matchedNode: match?.matchingNode || '', occurrenceId: match?.occurrenceId || '', nodeMandatory: match?.isMandatoryNode === true, status };
  });
  return { transform, boreMode, rows, candidateRows, mandatoryCoverageRows, mandatoryPsCoverageRows, userLog: logger.userLog, debugLog: logger.debugLog };
}
