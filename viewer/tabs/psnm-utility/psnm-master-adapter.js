import { PSNM_isAuditStatus } from './psnm-master-types.js';

export function PSNM_masterPsToMatchRows(masterPsRows = []) {
  return masterPsRows
    .filter((row) => row && row.enabled !== false)
    .filter((row) => row.status === 'OK' || row.status === 'WARNING' || row.status === 'BORE_CONFLICT' || row.status === 'MISSING_BORE')
    .filter((row) => row.positionRaw)
    .map((row, index) => ({
      psName: row.psName,
      position: row.positionRaw,
      p1bore: row.p1bore,
      isMandatoryPs: row.isMandatoryPs === true,
      mandatorySource: row.mandatorySource || '',
      rowIndex: row.sourceRow ?? index + 1,
      masterPsRowId: row.rowId,
      psOccurrenceId: row.psOccurrenceId || '',
      psOccurrenceIndex: row.psOccurrenceIndex || 1,
      psCoordKey: row.psCoordKey || '',
      sourceTable: row.sourceTable,
    }));
}

export function PSNM_masterNodeToMatchRows(masterNodeRows = []) {
  return masterNodeRows
    .filter((row) => row && row.enabled !== false)
    .filter((row) => row.status !== 'MISSING_FROM_TABLE2' && row.status !== 'INVALID_COORDINATE' && row.status !== 'DISABLED')
    .filter((row) => Number.isFinite(row.rawX) && Number.isFinite(row.rawY) && Number.isFinite(row.rawZ))
    .map((row, index) => ({
      node: row.node,
      x: Number(row.rawX),
      y: Number(row.rawY),
      z: Number(row.rawZ),
      position: `${row.rawX}, ${row.rawY}, ${row.rawZ}`,
      directBoreMm: row.finalNodeBore,
      isMandatoryNode: row.isMandatoryNode === true,
      rowMandatorySource: row.mandatorySource || '',
      occurrenceId: row.occurrenceId,
      rowIndex: row.sourceRow ?? index + 1,
      masterNodeRowId: row.rowId,
      sourceTable: row.sourceTable,
    }));
}

export function PSNM_masterMandatoryNodeRows(masterNodeRows = []) {
  return masterNodeRows
    .filter((row) => row && row.enabled !== false && row.isMandatoryNode === true)
    .map((row, index) => ({
      node: row.node,
      rowIndex: row.sourceRow ?? index + 1,
      mandatorySource: row.mandatorySource || 'MASTER_NODE',
      occurrenceId: row.occurrenceId,
      masterNodeRowId: row.rowId,
    }));
}

function matchForMasterPsRow(row, index, matchRows = []) {
  const byMasterId = matchRows.find((item) => item.masterPsRowId === row.rowId);
  if (byMasterId) return byMasterId;

  // The core engine returns one result row for each PS input row in order. Use
  // row-order fallback before PS-name fallback so duplicate PS labels remain
  // occurrence-aware even if the engine output does not yet expose row ids.
  const byIndex = matchRows[index];
  if (byIndex && byIndex.psName === row.psName) return byIndex;

  return matchRows.find((item) => item.psName === row.psName);
}

export function PSNM_masterPsCoverageRows(masterPsRows = [], matchRows = []) {
  return masterPsRows
    .filter((row) => row && row.enabled !== false && row.isMandatoryPs === true)
    .map((row, index) => {
      const match = matchForMasterPsRow(row, index, matchRows);
      const auditStatus = row.auditStatus || (PSNM_isAuditStatus(row.status) ? row.status : '');
      if (auditStatus) {
        return {
          psName: row.psName,
          psOccurrenceId: row.psOccurrenceId || '',
          mandatorySource: row.mandatorySource || 'TABLE1',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: auditStatus,
          severity: row.auditSeverity || 'ERROR',
          action: row.auditAction || row.remarks || 'Review mandatory PS audit row.',
          masterRowId: row.rowId,
        };
      }
      if (row.status === 'MISSING_FROM_TABLE1') {
        return {
          psName: row.psName,
          psOccurrenceId: row.psOccurrenceId || '',
          mandatorySource: row.mandatorySource || 'TABLE4A',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'MISSING_FROM_TABLE1',
          masterRowId: row.rowId,
        };
      }
      if (!match || match.finalStatus === 'UNMAPPED') {
        return {
          psName: row.psName,
          psOccurrenceId: row.psOccurrenceId || '',
          mandatorySource: row.mandatorySource || '',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'UNMAPPED',
          masterRowId: row.rowId,
        };
      }
      if (match.finalStatus === 'USER_REVIEW_REQUIRED' || match.matchType === 'AMBIGUOUS') {
        return {
          psName: row.psName,
          psOccurrenceId: row.psOccurrenceId || '',
          mandatorySource: row.mandatorySource || '',
          matchedNode: '',
          occurrenceId: '',
          nodeMandatory: false,
          status: 'AMBIGUOUS',
          masterRowId: row.rowId,
        };
      }
      return {
        psName: row.psName,
        psOccurrenceId: row.psOccurrenceId || '',
        mandatorySource: row.mandatorySource || '',
        matchedNode: match.matchingNode || '',
        occurrenceId: match.occurrenceId || '',
        nodeMandatory: match.isMandatoryNode === true,
        status: 'COVERED',
        masterRowId: row.rowId,
      };
    });
}

export function PSNM_masterNodeCoverageRows(masterNodeRows = [], matchRows = []) {
  return masterNodeRows
    .filter((row) => row && row.enabled !== false && row.isMandatoryNode === true)
    .map((row) => {
      const auditStatus = row.auditStatus || (PSNM_isAuditStatus(row.status) ? row.status : '');
      if (auditStatus) {
        return {
          node: row.node,
          occurrenceId: row.occurrenceId,
          mandatorySource: row.mandatorySource || 'TABLE2',
          inMasterNode: true,
          matchedPs: '',
          status: auditStatus,
          severity: row.auditSeverity || 'ERROR',
          action: row.auditAction || row.remarks || 'Review mandatory Node audit row.',
          masterRowId: row.rowId,
        };
      }
      if (row.status === 'MISSING_FROM_TABLE2') {
        return {
          node: row.node,
          occurrenceId: row.occurrenceId,
          mandatorySource: row.mandatorySource || 'TABLE4B',
          inMasterNode: false,
          matchedPs: '',
          status: 'MISSING_FROM_TABLE2',
          masterRowId: row.rowId,
        };
      }
      const match = matchRows.find((item) => item.occurrenceId === row.occurrenceId || item.matchingNode === row.node);
      if (!match || !String(match.finalStatus || '').startsWith('MATCHED')) {
        return {
          node: row.node,
          occurrenceId: row.occurrenceId,
          mandatorySource: row.mandatorySource || '',
          inMasterNode: true,
          matchedPs: '',
          status: 'UNCOVERED',
          masterRowId: row.rowId,
        };
      }
      return {
        node: row.node,
        occurrenceId: row.occurrenceId,
        mandatorySource: row.mandatorySource || '',
        inMasterNode: true,
        matchedPs: match.psName || '',
        status: 'COVERED',
        masterRowId: row.rowId,
      };
    });
}
