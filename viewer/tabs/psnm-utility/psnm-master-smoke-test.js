import {
  PSNM_buildMatchTable,
  PSNM_createRunLogger,
  PSNM_deriveTransformFromAnchor,
} from './psnm-match-engine.js';
import { PSNM_resolveMasterPsTable } from './psnm-master-resolver.js';
import {
  PSNM_applyMasterNodeTransform,
  PSNM_resolveMasterNodeTable,
} from './psnm-master-node-resolver.js';
import {
  PSNM_masterMandatoryNodeRows,
  PSNM_masterNodeCoverageRows,
  PSNM_masterNodeToMatchRows,
  PSNM_masterPsCoverageRows,
  PSNM_masterPsToMatchRows,
} from './psnm-master-adapter.js';

const SMOKE_TABLE1 = `PS NAME\tPosition\tp1bore\tMandatory
PS-12231/DATUM\tE 438023.221mm S 1140070.762mm U 1184.15mm\t150\tYES
PS-20015/DATUM\tE 462?INVALID\t250\t
PS-30000/DATUM\tE 438100.000mm S 1140100.000mm U 1200.000mm\t125\t`;

const SMOKE_TABLE4A = `PS NAME\tMandatory\tp1bore override\tPosition override\tRemarks
PS-12231/DATUM\tYES\t150\t\tanchor mandatory
PS-MISSING/DATUM\tYES\t80\t\tmissing test`;

const SMOKE_TABLE2 = `Node\tX\tY\tZ\tBore\tMandatory
22140\t-724492.312 mm.\t998.952 mm.\t-110590.633 mm.\t150\tYES
22140\t-724490.000 mm.\t999.000 mm.\t-110590.000 mm.\t150\t
20015\t-724468.312 mm.\t998.952 mm.\t-110566.633 mm.\t\t
30000\t-724415.533 mm.\t1014.802 mm.\t-110561.395 mm.\t80\t`;

const SMOKE_TABLE3 = `Node\tDia(mm)
22140\t168.3
20015\t273
30000\t114.3`;

const SMOKE_TABLE4B = `Node\tMandatory\tBore override\tOccurrence ID\tRemarks
22140\tYES\t\t22140#001\tanchor node mandatory
30000\tYES\t125\t30000#001\toverride wins
99999\tYES\t50\t\tmissing node`;

function check(name, pass, details = '') {
  return { name, pass: Boolean(pass), details: String(details || '') };
}

export function PSNM_runMasterSmokeTest() {
  const logger = PSNM_createRunLogger();
  const masterPs = PSNM_resolveMasterPsTable({
    table1Text: SMOKE_TABLE1,
    table4AText: SMOKE_TABLE4A,
    logger,
  });
  const masterNode = PSNM_resolveMasterNodeTable({
    table2Text: SMOKE_TABLE2,
    table3Text: SMOKE_TABLE3,
    table4BText: SMOKE_TABLE4B,
    logger,
  });

  const anchorPs = masterPs.rows.find((row) => row.psName === 'PS-12231/DATUM');
  const anchorNode = masterNode.rows.find((row) => row.occurrenceId === '22140#001');
  const anchor = {
    psName: anchorPs.psName,
    psPosition: anchorPs.positionRaw,
    node: anchorNode.node,
    nodePosition: `${anchorNode.rawX}, ${anchorNode.rawY}, ${anchorNode.rawZ}`,
  };
  const transform = PSNM_deriveTransformFromAnchor(anchor);
  PSNM_applyMasterNodeTransform(masterNode.rows, transform, 0);

  const matchResult = PSNM_buildMatchTable({
    logger,
    anchor,
    psRows: PSNM_masterPsToMatchRows(masterPs.rows),
    nodeRows: PSNM_masterNodeToMatchRows(masterNode.rows),
    nodeDiaRows: [],
    mandatoryNodeRows: PSNM_masterMandatoryNodeRows(masterNode.rows),
    boreMode: 'prefer',
    coordinateDecimals: 0,
    enableApprox1: true,
    enableApprox2: true,
    enableApprox3: true,
    approx1: { xMm: 25, yMm: 25, zMm: 25 },
    approx2: { xMm: 50, yMm: 25, zMm: 50 },
    approx3: { xMm: 50, yMm: 25, zMm: 50 },
  });
  matchResult.mandatoryPsCoverageRows = PSNM_masterPsCoverageRows(masterPs.rows, matchResult.rows);
  matchResult.mandatoryCoverageRows = PSNM_masterNodeCoverageRows(masterNode.rows, matchResult.rows);

  const missingPs = masterPs.rows.find((row) => row.psName === 'PS-MISSING/DATUM');
  const duplicateNodeRows = masterNode.rows.filter((row) => row.node === '22140');
  const derivedBoreNode = masterNode.rows.find((row) => row.node === '20015');
  const overrideNode = masterNode.rows.find((row) => row.node === '30000');
  const missingNode = masterNode.rows.find((row) => row.node === '99999');

  const checks = [
    check('Table 4A missing PS creates visible master row', missingPs?.status === 'MISSING_FROM_TABLE1', missingPs?.status),
    check('Duplicate Table 2 nodes create separate occurrences', duplicateNodeRows.length === 2 && duplicateNodeRows.some((row) => row.occurrenceId === '22140#001') && duplicateNodeRows.some((row) => row.occurrenceId === '22140#002'), duplicateNodeRows.map((row) => row.occurrenceId).join(', ')),
    check('Table 3 OD-derived bore fills blank Table 2 bore', derivedBoreNode?.table2Bore == null && derivedBoreNode?.table3DerivedBore != null && derivedBoreNode?.finalNodeBore === derivedBoreNode?.table3DerivedBore, `derived=${derivedBoreNode?.table3DerivedBore}, final=${derivedBoreNode?.finalNodeBore}`),
    check('Table 4B bore override wins over Table 2 and Table 3', overrideNode?.finalNodeBore === 125 && overrideNode?.boreSource === 'TABLE4B_OVERRIDE', `${overrideNode?.boreSource}:${overrideNode?.finalNodeBore}`),
    check('Table 4B missing node creates visible master row', missingNode?.status === 'MISSING_FROM_TABLE2', missingNode?.status),
    check('Matcher receives master-derived rows and returns result rows', matchResult.rows.length > 0, `${matchResult.rows.length} rows`),
    check('Mandatory PS coverage is master-derived', matchResult.mandatoryPsCoverageRows.some((row) => row.status === 'MISSING_FROM_TABLE1'), JSON.stringify(matchResult.mandatoryPsCoverageRows)),
    check('Mandatory Node coverage is master-derived', matchResult.mandatoryCoverageRows.some((row) => row.status === 'MISSING_FROM_TABLE2'), JSON.stringify(matchResult.mandatoryCoverageRows)),
  ];

  return {
    ok: checks.every((item) => item.pass),
    checks,
    counts: {
      masterPs: masterPs.rows.length,
      masterNode: masterNode.rows.length,
      matchRows: matchResult.rows.length,
      userLog: logger.userLog.length,
      debugLog: logger.debugLog.length,
    },
    masterPsIssues: masterPs.issues,
    masterNodeIssues: masterNode.issues,
    userLog: logger.userLog,
  };
}

if (typeof window !== 'undefined') {
  window.PSNM_runMasterSmokeTest = PSNM_runMasterSmokeTest;
}
