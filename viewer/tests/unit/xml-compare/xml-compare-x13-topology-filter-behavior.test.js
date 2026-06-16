import assert from 'node:assert/strict';
import {
  filterTopologyIssues,
  topologyIssueComponentIds,
  topologyIssuePassesFilters,
} from '../../../tabs/xml-compare-tab.js';

function run() {
  const issues = [
    {
      code: 'SUPPORT-ATTACHMENT-MISSING',
      severity: 'WARNING',
      datasetId: 'A',
      componentId: 'SUP-1',
      component: { type: 'SUPPORT', pipeline: 'LINE-A', label: 'SUP-1' },
      message: 'Support missing attachment',
    },
    {
      code: 'TEE-BRANCH-CONNECTIVITY-CHANGED',
      severity: 'ERROR',
      datasetId: 'B',
      componentId: 'TEE-1',
      component: { type: 'TEE', pipeline: 'LINE-B', label: 'TEE-1' },
      message: 'Tee branch changed',
    },
  ];

  assert.equal(topologyIssuePassesFilters(issues[0], { severity: 'WARNING', code: 'ALL', datasetId: 'ALL', search: '' }), true);
  assert.equal(topologyIssuePassesFilters(issues[0], { severity: 'ERROR', code: 'ALL', datasetId: 'ALL', search: '' }), false);
  assert.equal(topologyIssuePassesFilters(issues[0], { severity: 'ALL', code: 'SUPPORT-ATTACHMENT-MISSING', datasetId: 'ALL', search: '' }), true);
  assert.equal(topologyIssuePassesFilters(issues[1], { severity: 'ALL', code: 'ALL', datasetId: 'B', search: 'line-b' }), true);
  assert.equal(topologyIssuePassesFilters(issues[1], { severity: 'ALL', code: 'ALL', datasetId: 'A', search: '' }), false);

  const filtered = filterTopologyIssues(issues, {
    severity: 'ALL',
    code: 'ALL',
    datasetId: 'ALL',
    search: 'support',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].componentId, 'SUP-1');
  assert.deepEqual(topologyIssueComponentIds(filtered), ['SUP-1']);

  console.log('[PASS] XML Compare X13 topology filter behavior passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] XML Compare X13 topology filter behavior failed.');
  console.error(error);
  process.exit(1);
}
