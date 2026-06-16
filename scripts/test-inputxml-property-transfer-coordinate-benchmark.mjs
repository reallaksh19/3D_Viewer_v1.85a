#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  applyInputXmlPropertyTransfer,
  runInputXmlPropertyTransferPreview,
} from '../viewer/tabs/inputxml-property-transfer/index.js';

const root = process.cwd();
const benchmarkDir = path.join(root, 'Benchmarks', 'InputXML Property Transfer', 'coordinate-tolerance');
const sourceXmlPath = path.join(benchmarkDir, 'source_property_master.xml');
const targetXmlPath = path.join(benchmarkDir, 'target_geometry.xml');
const expectedCsvPath = path.join(benchmarkDir, 'expected_transfer_report.csv');

const CONFIG = Object.freeze({
  coordinateToleranceMm: 1.0,
  coordinateDecimals: 3,
  diameterMode: 'strict',
  diameterToleranceMm: 0.5,
  lineFamilyMode: 'strict',
  sourceLineFamilyRegex: '([A-Z]\\d{7})',
  targetLineFamilyRegex: '([A-Z]\\d{7})',
  componentTypeMode: 'ignore',
  copySourceSentinels: false,
  sentinelValues: ['-100000', '-100000.0'],
  selectedNodeProperties: [
    'WallThickness',
    'CorrosionAllowance',
    'InsulationThickness',
    'OutsideDiameter',
    'Weight',
    'MaterialCode',
  ],
  selectedBranchProperties: ['Temperature1', 'Temperature2', 'Pressure1', 'Pressure2'],
});

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing benchmark file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function textBetween(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function nodeXmlByName(xml, nodeName) {
  const nodeRe = /<Node\b[^>]*>[\s\S]*?<\/Node>/gi;
  let match;
  while ((match = nodeRe.exec(xml))) {
    if (textBetween(match[0], 'NodeName') === nodeName) return match[0];
  }
  return '';
}

function main() {
  const sourceXmlText = readRequired(sourceXmlPath);
  const targetXmlText = readRequired(targetXmlPath);
  const expected = new Map(parseCsv(readRequired(expectedCsvPath)).map((row) => [row.targetNode, row]));

  const result = runInputXmlPropertyTransferPreview({ sourceXmlText, targetXmlText, options: CONFIG });
  const writerResult = applyInputXmlPropertyTransfer({ sourceXmlText, targetXmlText, options: CONFIG, previewResult: result });
  const report = result.rows.map((row) => ({
    targetNode: row.targetNode,
    targetNodeNumber: row.targetNodeNumber,
    component: row.targetComponentType,
    decision: row.decision,
    sourceNode: row.sourceNode,
    sourceNodeNumber: row.sourceNodeNumber,
    lineFamily: row.targetLineFamily,
    candidateCount: row.candidateCount,
    propertyChanges: row.propertyChanges,
    changedProperties: row.changedProperties,
    retainedTargetValues: row.retainedTargetValues,
  }));

  const failures = [];
  for (const row of report) {
    const exp = expected.get(row.targetNode);
    if (!exp) {
      failures.push(`${row.targetNode}: missing expected row`);
      continue;
    }
    if (row.decision !== exp.expectedDecision) {
      failures.push(`${row.targetNode}: decision ${row.decision}, expected ${exp.expectedDecision}`);
    }
    if (row.sourceNode !== exp.expectedSourceNode) {
      failures.push(`${row.targetNode}: source ${row.sourceNode || '(none)'}, expected ${exp.expectedSourceNode || '(none)'}`);
    }
    if (row.decision !== 'TRANSFERRED' && row.propertyChanges !== 0) {
      failures.push(`${row.targetNode}: blocked/unmatched row has property changes`);
    }
  }

  const transferredRows = result.rows.filter((row) => row.decision === 'TRANSFERRED');
  const expectedWrittenChanges = transferredRows.reduce((sum, row) => sum + row.propertyChanges, 0);
  if (!writerResult.xmlChanged) failures.push('writer: updated XML was not changed for transferred rows');
  if (writerResult.writerSummary.written !== expectedWrittenChanges) {
    failures.push(`writer: wrote ${writerResult.writerSummary.written} properties, expected ${expectedWrittenChanges}`);
  }

  const pipe01 = nodeXmlByName(writerResult.updatedXmlText, 'TGT-PIPE-01');
  if (textBetween(pipe01, 'WallThickness') !== '11.13') failures.push('writer: TGT-PIPE-01 WallThickness not transferred');
  if (textBetween(pipe01, 'Weight') !== '12.1') failures.push('writer: TGT-PIPE-01 Weight not transferred');
  if (textBetween(pipe01, 'MaterialCode') !== 'A333-6') failures.push('writer: TGT-PIPE-01 MaterialCode not transferred');

  const noMatchPipe = nodeXmlByName(writerResult.updatedXmlText, 'TGT-PIPE-04');
  if (textBetween(noMatchPipe, 'WallThickness') !== '0') failures.push('writer: no-coordinate TGT-PIPE-04 was modified');
  if (textBetween(noMatchPipe, 'MaterialCode') !== 'TARGET-KEEP') failures.push('writer: no-coordinate TGT-PIPE-04 MaterialCode changed');

  const diaBlockedFlange = nodeXmlByName(writerResult.updatedXmlText, 'TGT-FLANGE-10');
  if (textBetween(diaBlockedFlange, 'Weight') !== '0') failures.push('writer: diameter-blocked TGT-FLANGE-10 Weight changed');

  const lineBlockedValve = nodeXmlByName(writerResult.updatedXmlText, 'TGT-VALVE-17');
  if (textBetween(lineBlockedValve, 'Weight') !== '0') failures.push('writer: line-family-blocked TGT-VALVE-17 Weight changed');

  const ambiguousValve = nodeXmlByName(writerResult.updatedXmlText, 'TGT-VALVE-24');
  if (textBetween(ambiguousValve, 'Weight') !== '0') failures.push('writer: ambiguous TGT-VALVE-24 Weight changed');

  if (writerResult.updatedXmlText.includes('<NodeNumber>10</NodeNumber>')) failures.push('writer: target NodeNumber appears overwritten by source NodeNumber');
  if (!writerResult.updatedXmlText.includes('<NodeNumber>1010</NodeNumber>')) failures.push('writer: original target NodeNumber 1010 missing');

  const { summary } = result;
  console.log('InputXML property transfer coordinate benchmark');
  console.log(`  Source nodes: ${summary.sourceNodes}`);
  console.log(`  Target nodes/elements: ${summary.targetNodes}`);
  console.log(`  Coordinate tolerance: ${summary.coordinateToleranceMm} mm`);
  console.log(`  Diameter strict tolerance: ${summary.diameterToleranceMm} mm`);
  console.log(`  Line family mode: ${summary.lineFamilyMode}`);
  console.log(`  Transferred: ${summary.transferred}`);
  console.log(`  No coordinate match: ${summary.noCoordinateMatch}`);
  console.log(`  Diameter blocked: ${summary.diameterBlocked}`);
  console.log(`  Line family blocked: ${summary.lineFamilyBlocked}`);
  console.log(`  Ambiguous: ${summary.ambiguous}`);
  console.log(`  XML writer changed: ${writerResult.xmlChanged ? 'YES' : 'NO'}`);
  console.log(`  XML properties written: ${writerResult.writerSummary.written}`);

  const sampleRows = report.filter((row) => ['TGT-PIPE-01', 'TGT-PIPE-04', 'TGT-FLANGE-10', 'TGT-VALVE-17', 'TGT-VALVE-24'].includes(row.targetNode));
  console.log('\nSample decisions:');
  for (const row of sampleRows) {
    console.log(`  ${row.targetNode}: ${row.decision}${row.sourceNode ? ` from ${row.sourceNode}` : ''}; changes=${row.propertyChanges}; retained=${row.retainedTargetValues || 'NO'}`);
  }

  if (failures.length) {
    console.error('\n❌ Benchmark failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('\n✅ InputXML property transfer coordinate benchmark passed.');
}

main();
