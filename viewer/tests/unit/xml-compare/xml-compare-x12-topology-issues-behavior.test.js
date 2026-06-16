import assert from 'node:assert/strict';
import {
  XML_COMPARE_BLOCK_CODES,
  buildTopologyIssuesCsv,
  compareXmlDatasets,
  normalizeXmlCompareDatasetFromText,
} from '../../../tabs/xml-compare-tab.js';

function run() {
  const datasetA = {
    datasetId: 'A',
    fileName: 'dataset-a.xml',
    components: [
      {
        id: 'SUP-1',
        type: 'SUPPORT',
        pipelineRef: 'LINE-A',
        label: 'SUP-1',
        coOrds: null,
        points: [],
      },
      {
        id: 'TEE-1',
        type: 'TEE',
        pipelineRef: 'LINE-A',
        label: 'TEE-1',
        centrePoint: { x: 0, y: 0, z: 0 },
        branch1Point: { x: 0, y: 0, z: 0 },
        points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }],
      },
      {
        id: 'OLET-1',
        type: 'OLET',
        pipelineRef: 'LINE-A',
        label: 'OLET-1',
        centrePoint: { x: 200, y: 0, z: 0 },
        branch1Point: { x: 200, y: 0, z: 0 },
        points: [{ x: 200, y: 0, z: 0 }, { x: 200, y: 50, z: 0 }],
      },
    ],
  };

  const datasetB = {
    datasetId: 'B',
    fileName: 'dataset-b.xml',
    components: [
      {
        id: 'SUP-1',
        type: 'SUPPORT',
        pipelineRef: 'LINE-A',
        label: 'SUP-1',
        coOrds: { x: 1, y: 0, z: 0 },
        points: [{ x: 1, y: 0, z: 0 }],
      },
      {
        id: 'TEE-1',
        type: 'BEND',
        pipelineRef: 'LINE-A',
        label: 'TEE-1',
        centrePoint: { x: 10, y: 0, z: 0 },
        branch1Point: { x: 10, y: 0, z: 0 },
        points: [{ x: 10, y: 0, z: 0 }, { x: 110, y: 0, z: 0 }],
      },
      {
        id: 'OLET-1',
        type: 'OLET',
        pipelineRef: 'LINE-A',
        label: 'OLET-1',
        centrePoint: { x: 200, y: 0, z: 0 },
        branch1Point: { x: 200, y: 20, z: 0 },
        points: [{ x: 200, y: 0, z: 0 }, { x: 200, y: 50, z: 0 }],
      },
      {
        id: 'PIPE-EXTRA',
        type: 'PIPE',
        pipelineRef: 'LINE-B',
        label: 'PIPE-EXTRA',
        points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    ],
  };

  const report = compareXmlDatasets(datasetA, datasetB, { toleranceMm: 6 });

  assert.equal(report.schema, 'xml-compare/v1');
  assert.equal(report.datasets.A.componentCount, 3);
  assert.equal(report.datasets.B.componentCount, 4);
  assert.equal(report.topologyIssues.summary.fatalCount > 0, true);
  assert.equal(report.topologyIssues.summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.SUPPORT_ATTACHMENT_MISSING), true);
  assert.equal(report.topologyIssues.summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.TEE_BRANCH_CONNECTIVITY_CHANGED), true);
  assert.equal(report.topologyIssues.summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.OLET_BRANCH_CONNECTIVITY_CHANGED), true);
  assert.equal(report.topologyIssues.summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.TOPOLOGY_TYPE_MISMATCH), true);
  assert.equal(report.topologyIssues.summary.issueCodes.includes(XML_COMPARE_BLOCK_CODES.TOPOLOGY_MISSING_COMPONENT), true);

  const csv = buildTopologyIssuesCsv(report.topologyIssues.issues);
  assert.equal(csv.includes('SUPPORT-ATTACHMENT-MISSING'), true);
  assert.equal(csv.includes('OLET-BRANCH-CONNECTIVITY-CHANGED'), true);

  const parsed = normalizeXmlCompareDatasetFromText('sample.xml', '<CAESARII/>', 'A');
  assert.equal(typeof parsed.ok, 'boolean', true);

  console.log('[PASS] XML Compare X12 topology issues behavior passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] XML Compare X12 topology issues behavior failed.');
  console.error(error);
  process.exit(1);
}
