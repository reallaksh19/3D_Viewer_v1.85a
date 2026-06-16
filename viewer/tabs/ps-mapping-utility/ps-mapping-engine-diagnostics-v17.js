import {
  DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions,
  runPsMappingResolver as runV16PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v16.js?v=20260614-legacy-reason-presentation-1';
import { supportTypesFromText } from './ps-mapping-support-gap-logic.js?v=20260614-support-parent-gap-1';

export { DEFAULT_OPTIONS, DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, normalizePsMappingOptions, rowsToCsv };

const SUPPORT_ORDER = Object.freeze(['REST', 'GUIDE', 'LINE_STOP']);

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

function labelSupport(type) {
  return type === 'LINE_STOP' ? 'LINE STOP' : clean(type).replace(/_/g, ' ');
}

function formatSupportList(types) {
  const ordered = SUPPORT_ORDER.filter((type) => types?.has?.(type));
  return ordered.map(labelSupport).join(' + ');
}

function table1PsNo(row = {}) {
  return clean(row.table1PsNo || row.mappedTable1PsNo || row.psNo || row['Table-1 PS No'] || '');
}

function baseTable1PsNo(row = {}) {
  return clean(table1PsNo(row).split('|')[0]).replace(/\/DATUM$/i, '');
}

function candidateNode(row = {}) {
  return clean(row.mappedNode || row.candidateNode || row.node || row.table1Node || row.nodeNo || row['Candidate Node'] || '');
}

function lineFamily(row = {}) {
  return clean(row.nodeLineFamily || row.t1LineFamily || row['T1 Line Family'] || '');
}

function derivedDn(row = {}) {
  return clean(row.derivedDn || row.table1Dn || row.dn || row['Derived DN'] || '');
}

function modelPsNo(row = {}) {
  return clean(row.psnoModel || row.modelPsNo || row.rawPsNo || row.basePs || row['PSNO_Model'] || '');
}

function normalizeSupportSource(...values) {
  return values
    .map((value) => String(value ?? '').toUpperCase())
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/[\[\](){}:;,|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supportSet(...values) {
  const source = normalizeSupportSource(...values);
  const out = supportTypesFromText(source);

  // Directional anchor / anchor-on-shoe is a stop support for the matrix.
  // Do not let "shoe" create a false REST contributor.
  if (/\bDIRECTIONAL\s+ANCHOR\b|\bANCHOR\s+ON\s+SHOE\b/.test(source)) {
    out.add('LINE_STOP');
    out.delete('REST');
  }

  return out;
}

function t1Text(row = {}) {
  return [
    row.supportTypesAvailable,
    row.nodeMasterKeywords,
    row.table1SupportTypes,
    row.nodeIsonote,
    row.nodeIsonoteRaw,
    row.isonote,
    row.ISONOTE,
    row['ISONOTE'],
  ].filter(Boolean).join(' ');
}

function t2Text(row = {}) {
  return [
    row.supportTypesRequested,
    row.modelDtxrKeywords,
    row.dtxr,
    row.t2Keywords,
    row.DTXR,
    row['T2 Keywords'],
  ].filter(Boolean).join(' ');
}

function t1Types(row = {}) {
  return supportSet(t1Text(row));
}

function t2Types(row = {}) {
  return supportSet(t2Text(row));
}

function orderedDifference(a, b) {
  return SUPPORT_ORDER.filter((type) => a?.has?.(type) && !b?.has?.(type));
}

function unionInto(target, source) {
  for (const type of SUPPORT_ORDER) {
    if (source?.has?.(type)) target.add(type);
  }
  return target;
}

function sameNumberText(a, b) {
  if (a === '' || a == null || b === '' || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-6;
  return clean(a) === clean(b);
}

function isLineBoreClean(row = {}) {
  const lineBasis = upper(row.lineBasis || row.lineMatch || '');
  const boreBasis = upper(row.boreBasis || row.boreMatch || '');
  if (/CONFLICT|REJECT|MISMATCH/.test(lineBasis) || /CONFLICT|REJECT|MISMATCH/.test(boreBasis)) return false;

  const t1Line = lineFamily(row);
  const t2Line = clean(row.lineFamily || row.t2LineFamily || row['T2 Line Family'] || '');
  if (t1Line && t2Line && t1Line !== t2Line) return false;

  const t1Dn = derivedDn(row);
  const t2Bore = clean(row.modelBore || row.t2Bore || row.bore || row['T2 Bore'] || '');
  if (t1Dn && t2Bore && !sameNumberText(t1Dn, t2Bore)) return false;

  return true;
}

function groupKey(row = {}) {
  const ps = table1PsNo(row);
  if (!ps) return '';
  return [ps, candidateNode(row), lineFamily(row), derivedDn(row)].join('||');
}

function buildGroup(row = {}) {
  return {
    key: groupKey(row),
    table1PsNo: table1PsNo(row),
    basePs: baseTable1PsNo(row),
    node: candidateNode(row),
    line: lineFamily(row),
    dn: derivedDn(row),
    rows: [],
    t1: new Set(),
    t2: new Set(),
    cleanT2: new Set(),
    gapActions: [],
  };
}

function rowGapAction(row = {}) {
  const action = clean(row.psNoWiseAction || '');
  return /^Correct Table-2 .+ GAP to Table-1/i.test(action) ? action : '';
}

function addUnique(list, value) {
  const text = clean(value);
  if (text && !list.includes(text)) list.push(text);
}

function buildGroups(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, buildGroup(row));
    const group = groups.get(key);
    group.rows.push(row);
    unionInto(group.t1, t1Types(row));
    unionInto(group.t2, t2Types(row));
    if (isLineBoreClean(row)) unionInto(group.cleanT2, t2Types(row));
    addUnique(group.gapActions, rowGapAction(row));
  }

  for (const group of groups.values()) {
    if (!group.cleanT2.size) unionInto(group.cleanT2, group.t2);
  }
  return groups;
}

function proposedMissingSupportIds(group) {
  const missing = orderedDifference(group.t1, group.cleanT2);
  const base = group.basePs || group.table1PsNo || 'PS-UNKNOWN';
  const out = [];
  missing.forEach((type, index) => {
    out.push({ type, psNo: `${base}.X${index + 1}` });
  });
  return out;
}

function proposedPsNoText(proposed = []) {
  return proposed.map((item) => `${labelSupport(item.type)}=${item.psNo}`).join('; ');
}

function missingActionText(group, proposed = proposedMissingSupportIds(group)) {
  return proposed.map((item) => {
    const label = labelSupport(item.type);
    return `Table-1 data has ${label} but missing in Table-2 data. Action: Add ${label} as ${item.psNo} as per Table-1 ISONOTE.`;
  });
}

function extraActionText(group) {
  const extras = orderedDifference(group.cleanT2, group.t1);
  return extras.map((type) => {
    const label = labelSupport(type);
    return `Remove or reclassify extra ${label} in Table-2; Table-1 does not require ${label}.`;
  });
}

function groupAction(group) {
  const parts = [
    ...missingActionText(group),
    ...group.gapActions,
    ...extraActionText(group),
  ];
  return parts.length ? parts.join(' ') : 'No Action based on Table-2';
}

function noTable1Action(row = {}) {
  const model = modelPsNo(row);
  return model
    ? `No Table-1 PS No. match for Table-2 PS ${model}. Action: manual review.`
    : 'No Table-1 PS No. match for Table-2 PS. Action: manual review.';
}

function rowSpecificAction(row = {}, group = null) {
  if (!table1PsNo(row)) return 'Manual review: No Match in Table-1';

  const gapAction = rowGapAction(row);
  if (gapAction) return gapAction;

  const t1 = t1Types(row);
  const t2 = t2Types(row);
  const extras = orderedDifference(t2, t1);
  if (extras.length) {
    const label = labelSupport(extras[0]);
    return `Remove or reclassify extra ${label} in Table-2; Table-1 does not require ${label}.`;
  }

  // Missing support is a node/package action, not a correction to this matched row.
  return '';
}

function applyNodeRestraintCoverage(rows) {
  if (!Array.isArray(rows)) return rows;
  const groups = buildGroups(rows);

  return rows.map((row) => {
    const key = groupKey(row);
    const group = key ? groups.get(key) : null;
    if (!group) {
      return {
        ...row,
        t1NodeRestraints: '',
        t2CoveredRestraints: '',
        missingNodeRestraints: '',
        extraTable2Restraints: '',
        proposedMissingSupportPsNo: '',
        psNoWiseAction: table1PsNo(row) ? rowSpecificAction(row, null) : 'Manual review: No Match in Table-1',
        consolidatedNodeWiseAction: table1PsNo(row) ? clean(row.consolidatedNodeWiseAction || '') : noTable1Action(row),
      };
    }

    const missing = new Set(orderedDifference(group.t1, group.cleanT2));
    const extra = new Set(orderedDifference(group.cleanT2, group.t1));
    const proposed = proposedMissingSupportIds(group);
    const action = groupAction(group);

    return {
      ...row,
      t1NodeRestraints: formatSupportList(group.t1),
      t2CoveredRestraints: formatSupportList(group.cleanT2),
      missingNodeRestraints: formatSupportList(missing),
      extraTable2Restraints: formatSupportList(extra),
      proposedMissingSupportPsNo: proposedPsNoText(proposed),
      psNoWiseAction: rowSpecificAction(row, group),
      consolidatedNodeWiseAction: action,
    };
  });
}

export function runPsMappingResolver(input = {}) {
  const result = runV16PsMappingResolver(input);
  return {
    ...result,
    rows: applyNodeRestraintCoverage(result.rows),
    outputRows: applyNodeRestraintCoverage(result.outputRows),
    validatorRows: applyNodeRestraintCoverage(result.validatorRows),
    candidateRows: applyNodeRestraintCoverage(result.candidateRows),
    candidates: applyNodeRestraintCoverage(result.candidates),
    approxConfig: {
      ...(result.approxConfig || {}),
      psMappingPresentationRules: 'Readable v17: node restraint package coverage is shown separately from row-local support matching. Missing support actions use synthetic PS-XYZ.Xn IDs and never reuse existing .1/.2 Table-2 row numbers.',
    },
  };
}
