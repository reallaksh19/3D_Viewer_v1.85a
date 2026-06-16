import { PSNM_buildMatchTable, PSNM_createRunLogger, PSNM_deriveTransformFromAnchor } from './psnm-match-engine.js';
import { PSNM_resolveMasterPsTable } from './psnm-master-resolver.js';
import { PSNM_applyMasterNodeTransform, PSNM_resolveMasterNodeTable } from './psnm-master-node-resolver.js';
import { PSNM_masterMandatoryNodeRows, PSNM_masterNodeCoverageRows, PSNM_masterNodeToMatchRows, PSNM_masterPsCoverageRows, PSNM_masterPsToMatchRows } from './psnm-master-adapter.js';

const TABLE1 = `PS NAME\tPosition\tp1bore\tMandatory
PS-ANCHOR/DATUM\tE 438023.221mm S 1140070.762mm U 1184.15mm\t150\tYES
PS-DERIVED/DATUM\tE 438047.221mm S 1140094.762mm U 1184.15mm\t250\t
PS-OVERRIDE/DATUM\tE 438100.000mm S 1140100.000mm U 1200.000mm\t125\t`;
const TABLE4A = `PS NAME\tMandatory\tp1bore override\tPosition override\tRemarks
PS-ANCHOR/DATUM\tYES\t150\t\tanchor mandatory
PS-MISSING/DATUM\tYES\t80\t\tmissing PS`;
const TABLE2 = `Node\tX\tY\tZ\tBore\tMandatory
100\t-724492.312 mm.\t998.952 mm.\t-110590.633 mm.\t150\tYES
100\t-724491.312 mm.\t998.952 mm.\t-110590.633 mm.\t150\t
200\t-724468.312 mm.\t998.952 mm.\t-110566.633 mm.\t\t
300\t-724415.533 mm.\t1014.802 mm.\t-110561.395 mm.\t80\t`;
const TABLE3 = `Node\tDia(mm)
100\t168.3
200\t273
300\t114.3`;
const TABLE4B = `Node\tMandatory\tBore override\tOccurrence ID\tRemarks
100\tYES\t\t100#001\tmandatory duplicate occurrence
300\tYES\t125\t300#001\toverride wins
999\tYES\t50\t\tmissing node`;

function check(name, pass, details = '') {
  return { name, pass: Boolean(pass), details: String(details || '') };
}

function runFixture() {
  const logger = PSNM_createRunLogger();
  const masterPs = PSNM_resolveMasterPsTable({ table1Text: TABLE1, table4AText: TABLE4A, logger });
  const masterNode = PSNM_resolveMasterNodeTable({ table2Text: TABLE2, table3Text: TABLE3, table4BText: TABLE4B, logger });
  const anchorPs = masterPs.rows.find((row) => row.psName === 'PS-ANCHOR/DATUM');
  const anchorNode = masterNode.rows.find((row) => row.occurrenceId === '100#001');
  const anchor = { psName: anchorPs.psName, psPosition: anchorPs.positionRaw, node: anchorNode.node, nodePosition: `${anchorNode.rawX}, ${anchorNode.rawY}, ${anchorNode.rawZ}` };
  const transform = PSNM_deriveTransformFromAnchor(anchor);
  PSNM_applyMasterNodeTransform(masterNode.rows, transform, 0);
  const psRows = PSNM_masterPsToMatchRows(masterPs.rows);
  const nodeRows = PSNM_masterNodeToMatchRows(masterNode.rows);
  const mandatoryNodeRows = PSNM_masterMandatoryNodeRows(masterNode.rows);
  const matchResult = PSNM_buildMatchTable({ logger, anchor, psRows, nodeRows, nodeDiaRows: [], mandatoryNodeRows, boreMode: 'prefer', coordinateDecimals: 0, enableApprox1: true, enableApprox2: true, enableApprox3: true, approx1: { xMm: 25, yMm: 25, zMm: 25 }, approx2: { xMm: 50, yMm: 25, zMm: 50 }, approx3: { xMm: 50, yMm: 25, zMm: 50 } });
  matchResult.mandatoryPsCoverageRows = PSNM_masterPsCoverageRows(masterPs.rows, matchResult.rows);
  matchResult.mandatoryCoverageRows = PSNM_masterNodeCoverageRows(masterNode.rows, matchResult.rows);
  return { logger, masterPs, masterNode, anchor, psRows, nodeRows, matchResult };
}

export function PSNM_runMasterAcceptanceSuite() {
  const fx = runFixture();
  const missingPs = fx.masterPs.rows.find((row) => row.psName === 'PS-MISSING/DATUM');
  const duplicateNodeRows = fx.masterNode.rows.filter((row) => row.node === '100');
  const derivedNode = fx.masterNode.rows.find((row) => row.node === '200');
  const overrideNode = fx.masterNode.rows.find((row) => row.node === '300');
  const missingNode = fx.masterNode.rows.find((row) => row.node === '999');
  const checks = [
    check('4A mandatory PS appears in Master PS No', fx.masterPs.rows.some((row) => row.psName === 'PS-ANCHOR/DATUM' && row.isMandatoryPs)),
    check('4A missing PS remains visible', missingPs?.status === 'MISSING_FROM_TABLE1', missingPs?.status),
    check('Duplicate Table 2 nodes become occurrences', duplicateNodeRows.length === 2 && duplicateNodeRows.some((row) => row.occurrenceId === '100#001') && duplicateNodeRows.some((row) => row.occurrenceId === '100#002'), duplicateNodeRows.map((row) => row.occurrenceId).join(', ')),
    check('Table 3 OD-derived bore fills blank Table 2 bore', derivedNode?.table2Bore == null && derivedNode?.table3DerivedBore != null && derivedNode?.finalNodeBore === derivedNode?.table3DerivedBore, `${derivedNode?.table3DerivedBore}:${derivedNode?.finalNodeBore}`),
    check('Table 2 direct bore beats Table 3 derived bore', duplicateNodeRows[0]?.finalNodeBore === duplicateNodeRows[0]?.table2Bore && duplicateNodeRows[0]?.boreSource?.startsWith('TABLE2_BORE'), `${duplicateNodeRows[0]?.boreSource}:${duplicateNodeRows[0]?.finalNodeBore}`),
    check('Table 4B override wins', overrideNode?.finalNodeBore === 125 && overrideNode?.boreSource === 'TABLE4B_OVERRIDE', `${overrideNode?.boreSource}:${overrideNode?.finalNodeBore}`),
    check('4B missing node remains visible', missingNode?.status === 'MISSING_FROM_TABLE2', missingNode?.status),
    check('Anchor selected from master rows', fx.anchor.psName === 'PS-ANCHOR/DATUM' && fx.anchor.node === '100'),
    check('PS rows passed to matcher contain master IDs', fx.psRows.every((row) => row.masterPsRowId), `${fx.psRows.length}`),
    check('Node rows passed to matcher contain master IDs', fx.nodeRows.every((row) => row.masterNodeRowId), `${fx.nodeRows.length}`),
    check('Mandatory PS coverage is master-derived', fx.matchResult.mandatoryPsCoverageRows.some((row) => row.status === 'MISSING_FROM_TABLE1')),
    check('Mandatory Node coverage is master-derived', fx.matchResult.mandatoryCoverageRows.some((row) => row.status === 'MISSING_FROM_TABLE2')),
    check('Match result produced', fx.matchResult.rows.length > 0, `${fx.matchResult.rows.length} rows`),
  ];
  return { ok: checks.every((item) => item.pass), checks, counts: { masterPs: fx.masterPs.rows.length, masterNode: fx.masterNode.rows.length, matchRows: fx.matchResult.rows.length, userLog: fx.logger.userLog.length, debugLog: fx.logger.debugLog.length }, userLog: fx.logger.userLog, masterPsIssues: fx.masterPs.issues, masterNodeIssues: fx.masterNode.issues };
}

if (typeof window !== 'undefined') window.PSNM_runMasterAcceptanceSuite = PSNM_runMasterAcceptanceSuite;
