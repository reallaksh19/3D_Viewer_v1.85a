import assert from 'node:assert/strict';

import {
  formatGlbValidationSummary,
  summarizeGlbValidationReport,
  validationTone,
} from '../validators/glb-validation-report.js';

const report = {
  issues: {
    messages: [
      { severity: 'ERROR', code: 'ACCESSOR_INVALID' },
      { severity: 'WARNING', code: 'UNUSED_OBJECT' },
      { severity: 'INFO', code: 'ASSET_INFO' },
      { severity: 'HINT', code: 'NODE_HINT' },
    ],
  },
};

const summary = summarizeGlbValidationReport(report);
assert.equal(summary.valid, false);
assert.equal(summary.errorCount, 1);
assert.equal(summary.warningCount, 1);
assert.equal(summary.infoCount, 1);
assert.equal(summary.hintCount, 1);
assert.equal(validationTone(summary), 'error');
assert.equal(formatGlbValidationSummary(summary), 'GLB validation: FAIL | errors=1 warnings=1 info=1 hints=1');

const passSummary = summarizeGlbValidationReport({ warningCount: 2 });
assert.equal(passSummary.valid, true);
assert.equal(passSummary.warningCount, 2);
assert.equal(validationTone(passSummary), 'warning');
assert.equal(formatGlbValidationSummary(passSummary), 'GLB validation: PASS | errors=0 warnings=2 info=0 hints=0');

console.log('glb-validation-report.test.js passed');
