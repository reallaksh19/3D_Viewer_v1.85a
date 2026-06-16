import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-master-resolution-datasheet-ui.test.js ---');

  const file = 'viewer/rvm-pcf-extract/RvmMasterResolutionWorkflow.js';
  const js = read(file);

  const requiredMarkers = [
    'RATING_REGEX_STORAGE_KEY',
    'extractRatingFromPipelineRef',
    'renderRegexHeader',

    'Save Regex',
    'renderGroupedDataSheet',
    'rvm-master-sheet-table',
    'masterResolutionPipePropertyKey',
    'masterResolutionGroupKey',
    '_samePipePropertyGroup',
    'Do not split line-list / piping-class resolution by component type',
    'requestBoreLabel',
    'Converted Bore is not required as manual input',
    'derivedPipingClass',
    'derivedRating',
    'boreMm',
    'showRvmMasterResolutionDialog',
    'Master Resolution Data Sheet',
    'Apply to all rows with same Pipeline Ref + Bore',
    'extractPipingClassTokenFromPipelineRef',
    'choosePipingClassFromPipelineRef',
    'PCF-CLASS-CHILD-VALUE-OVERRIDDEN',
    'PIPELINE-REF-TOKEN',
    'Pipe properties /',
    '<th>Kind</th>',
    'MASTER_APPLY_SCOPES',
    'normalizeMasterApplyScope',
    '_samePipelineGroup',
    'name="applyScope"',
    'value="PIPELINE_BORE"',
    'value="PIPELINE"',
    'value="FULL_DATASET"',
    'Apply to all rows with same Pipeline Ref',
    'Apply to all rows for full data set',
    'rvm-master-apply-scope',
    'rvm-master-apply-buttons',
    'RATING_PRIORITY_TOKENS',
    'HIGH_PRESSURE_RATING_TOKENS',
    'ASME_CLASS_RATING_TOKENS',
    'extractRatingTokenFromPipelineRef',
    'normalizeResolvedRating',
    'pipePropertyCacheKey',
    'bestRatingForGroup',
    '_applyPipePropertyCache',
    'PIPELINE-REF-RATING-GROUP',
    'RATING-GROUP-OVERRIDE',
    'PIPELINE-REF-TOKEN-GROUP',
    'pipelinePropertyCacheKey',
    'RATING-INHERITED-FROM-PIPELINE',
    'PIPELINE-BORE-RATING-GROUP',
    'Pipeline Reference Reader',
    'Advanced extraction settings',
    'The app reads <b>66620M0</b>'
  ];

  for (const marker of requiredMarkers) {
    assert.ok(
      js.includes(marker),
      `RvmMasterResolutionWorkflow.js missing marker: ${marker}`
    );
  }

  assert.ok(
    !js.includes('name="manualConvertedBore"'),
    'manual converted bore input must not be present'
  );

assert.ok(
    !js.includes('name="applyAll"'),
    'old applyAll checkbox must be removed; apply scope must be radio-only'
  );

  assert.ok(
    js.includes('localStorage.setItem(PIPING_CLASS_REGEX_STORAGE_KEY') &&
    js.includes('localStorage.setItem(RATING_REGEX_STORAGE_KEY'),
    'regex settings must be persisted'
  );

  assert.ok(
    js.includes('row.ratingDerived = derivedRating') ||
    js.includes('row.rating = derivedRating'),
    'derived rating must be applied to row'
  );

  assert.ok(
    js.includes('row.pipingClassDerived = derived') ||
    js.includes('row.pipingClass = derived'),
    'derived piping class must be applied to row'
  );

  assert.ok(
    !js.includes('\nconst applyScope = normalizeMasterApplyScope(payload.applyScope);'),
    'applyScope line must be indented inside applyRequestResolution'
  );

  assert.ok(
    !js.includes('\nconst values = {\n            pipingClass: clean(payload.pipingClass),'),
    'LINELIST manual values block must be indented'
  );

  assert.ok(
    !js.includes('\n_resolvePipingClass(row, requests, diagnostics) {'),
    '_resolvePipingClass must be indented as a class method'
  );

  assert.ok(
    !js.includes('\n_samePipelineGroup(row, request) {'),
    '_samePipelineGroup must be indented as a class method'
  );

  console.log('[PASS] RVM master resolution data-sheet UI smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] RVM master resolution data-sheet UI smoke failed.');
  console.error(error);
  process.exit(1);
}
