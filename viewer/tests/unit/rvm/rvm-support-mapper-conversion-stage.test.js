import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function run() {
  console.log('--- rvm-support-mapper-conversion-stage.test.js ---');

  const converterJs = read('viewer/tabs/model-converters-tab.js');
  const rvmTabJs = read('viewer/tabs/viewer3d-rvm-tab.js');
  const defaultsJs = read('viewer/viewer-3d-defaults.js');
  const viewerJs = read('viewer/viewer-3d.js');
  const previewJs = read('viewer/converters/view/model-conv-preview-renderer.js');
  const rvmViewerJs = read('viewer/rvm-viewer/RvmViewer3D.js');
  const sharedTokens = read('viewer/styles/shared-viewer-tokens.css');
  const appJs = read('viewer/core/app.js');
  const indexHtml = read('viewer/index.html');
  const mapperJs   = read('viewer/rvm-viewer/RvmSupportMapper.js');
  const resolverJs = read('viewer/support/SupportKindResolver.js');

  assert.ok(
    converterJs.includes("RvmSupportMapper.js?v=20260518-support-mapper-11") &&
    converterJs.includes('renderSupportMapperPanel') &&
    converterJs.includes('model-converters-support-mapper'),
    'model converter must import the cache-busted support mapper used by conversion'
  );

  assert.ok(
    !rvmTabJs.includes('renderSupportMapperPanel') &&
    !rvmTabJs.includes('Support Type Mapper</summary>'),
    '3D RVM viewer must not render the support mapper editor; mapper editing belongs to Model Converters'
  );

  assert.ok(
    mapperJs.includes('CMPSUPTYPE, MDSSUPPTYPE, SPRE') &&
    mapperJs.includes('splitRuleTerms') &&
    mapperJs.includes('collectMapperFieldValues') &&
    mapperJs.includes('updateBuiltinRule') &&
    mapperJs.includes('data-rule-field') &&
    mapperJs.includes('data-rule-match') &&
    mapperJs.includes('data-rule-pattern'),
    'support mapper must support editable field/match/keyword columns'
  );

  // Rule ordering and CA built-ins now live in SupportKindResolver.js (no duplication in mapper).
  assert.ok(
    mapperJs.includes('BUILTIN_RULES = DEFAULT_RULES'),
    'mapper BUILTIN_RULES must be derived from pure resolver DEFAULT_RULES (no duplication)'
  );
  assert.ok(
    resolverJs.indexOf("id: 'builtin-gt5-mds'") < resolverJs.indexOf("id: 'builtin-gt'"),
    'GT5 REST rules must precede generic GT GUIDE rule in SupportKindResolver DEFAULT_RULES'
  );
  assert.ok(
    resolverJs.includes("id: 'builtin-ca150'") &&
    resolverJs.includes("id: 'builtin-ca250'") &&
    resolverJs.includes("id: 'builtin-ca100'"),
    'SupportKindResolver DEFAULT_RULES must include CA150, CA250, CA100 built-in rules'
  );

  assert.ok(
    converterJs.includes('function _applySupportMapperToAttributes(attrs)') &&
    converterJs.includes('attrs.SUPPORT_TYPE = kind;') &&
    converterJs.includes('attrs.SUPPORT_KIND = kind;') &&
    converterJs.includes('attrs.SUPPORT_MAPPER_KIND = kind;'),
    'conversion stage must write mapped support kind into managed-stage attributes'
  );

  assert.ok(
    converterJs.includes('User rules intentionally override raw CMPSUPTYPE/SUPPORT_TYPE values') &&
    converterJs.includes('const supportMapperStats = _enrichHierarchyWithMapperKinds(normalizedHierarchy);'),
    'conversion mapper pass must run before XML/STP outputs and must override raw support codes'
  );

  assert.ok(
    converterJs.includes('connectionType: supportKind') &&
    converterJs.includes('Support mapper conversion pass: scanned='),
    'converted XML/logs must expose support mapper conversion results'
  );

  assert.ok(
    rvmTabJs.includes('attrs.SUPPORT_TYPE = kind;') &&
    rvmTabJs.includes('attrs.SUPPORT_KIND = kind;') &&
    rvmTabJs.includes('attrs.SUPPORT_MAPPER_KIND = kind;'),
    'RVM tab managed JSON enrichment must use the same mapped support fields'
  );

  assert.ok(
    defaultsJs.includes('symbolScale: 3') &&
    defaultsJs.includes("SUPPORT:  '#60c864'") &&
    defaultsJs.includes("ANCI:     '#60c864'"),
    '3D viewer defaults must use 3x support scale and unified support/ANCI green'
  );

  assert.ok(
    sharedTokens.includes('--vg-support: #60c864') &&
    sharedTokens.includes('--vg-anci: #60c864'),
    'shared viewer tokens must use unified green for support and ANCI'
  );

  assert.ok(
    viewerJs.includes('SUPPORT: 0x60c864') &&
    viewerJs.includes('ANCI: 0x60c864') &&
    previewJs.includes('color: 0x60c864') &&
    rvmViewerJs.includes('color: 0x60c864'),
    'PCF/RVM/converter preview support colors must be unified green'
  );

  assert.ok(
    appJs.includes('model-converters-tab.js?v=20260518-support-mapper-11') &&
    appJs.includes('viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12') &&
    indexHtml.includes('core/app.js?v=20260518-statusbar-theme-12'),
    'cache-busting must reload touched conversion and viewer modules'
  );

  console.log('[PASS] support mapper conversion-stage smoke passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] support mapper conversion-stage smoke failed.');
  console.error(error);
  process.exit(1);
}
