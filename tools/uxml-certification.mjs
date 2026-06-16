/**
 * UXML certification gate.
 *
 * Purpose:
 * - Provide a deterministic required-file certification before Vitest runs.
 * - Fail GitHub Actions if any required Agent 00–07 file is missing.
 *
 * This script intentionally does not mutate files.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const REQUIRED_BENCHMARKS = Object.freeze([
  'Benchmarks/RVM JSON to PCF UXML Topology/README.md',
  'Benchmarks/RVM JSON to PCF UXML Topology/broken-topology-50-rows.json',
  'Benchmarks/RVM JSON to PCF UXML Topology/expected-uxml-topology-outcome.json',
]);

const REQUIRED_MODULES = Object.freeze([
  'viewer/uxml/UxmlConstants.js',
  'viewer/uxml/UxmlTypes.js',
  'viewer/uxml/UxmlProfileDetector.js',
  'viewer/uxml/UxmlInputXmlSchemaMapper.js',
  'viewer/uxml/UxmlStandardXmlSchemaMapper.js',
  'viewer/uxml/UxmlPcfStandardXmlBridge.js',
  'viewer/uxml/UxmlSourceIntakeBridge.js',
  'viewer/uxml/UxmlNormalizer.js',
  'viewer/uxml/UxmlValidationGate.js',
  'viewer/uxml/UxmlFaceModelBuilder.js',
  'viewer/uxml/UxmlUniversalTopoGraphBuilder.js',
  'viewer/uxml/UxmlRayTopoGraphBuilder.js',
    'viewer/uxml/UxmlTopoGraphComparator.js',
  'viewer/rvm-pcf-extract/RvmPcfTopologyModes.js',
  'viewer/rvm-pcf-extract/RvmRowsToUxmlAdapter.js',
  'viewer/rvm-pcf-extract/RvmUxmlTopologyBridge.js',
  'viewer/uxml/UxmlTopologyDecisionGate.js',
  'viewer/rvm-pcf-extract/RvmUxmlTopologyDiagnosticsPanel.js',
  'viewer/rvm-pcf-extract/RvmPcfExportGuard.js',
  'viewer/rvm-pcf-extract/RvmPcfAcceptedTopologyHandoff.js',
  'viewer/uxml/UxmlRouteHandoffPolicy.js',
  'viewer/uxml/UxmlCl1RoutePackage.js',
  'viewer/uxml/UxmlCl1PackageSnapshot.js',
  'viewer/uxml/UxmlCl1SnapshotReplayValidator.js',
  'viewer/uxml/UxmlCl1WorkbenchSummary.js',
]);

const REQUIRED_TESTS = Object.freeze([
  'viewer/tests/uxml-contracts.test.js',
  'viewer/tests/uxml-profile-detector.test.js',
  'viewer/tests/uxml-normalizer.test.js',
  'viewer/tests/uxml-inputxml-schema-mapper.test.js',
  'viewer/tests/uxml-standard-xml-schema-mapper.test.js',
  'viewer/tests/uxml-validation-gate.test.js',
  'viewer/tests/uxml-face-model-builder.test.js',
  'viewer/tests/uxml-universal-topo-graph-builder.test.js',
  'viewer/tests/uxml-ray-topo-graph-builder.test.js',
    'viewer/tests/uxml-topo-graph-comparator.test.js',
  'viewer/tests/uxml-inputxml-1001-schema-extension.test.js',
  'viewer/tests/uxml-inputxml-1001-real-file-smoke.test.js',
  'viewer/tests/uxml-inputxml-1001-real-topology-workbench-smoke.test.js',
  'viewer/tests/uxml-pcf-standardxml-bridge.test.js',
  'viewer/tests/uxml-source-intake-bridge-pcf-pdf.test.js',
  'viewer/tests/universal-xml-converter-tab-source-intake.test.js',
  'viewer/tests/universal-xml-converter-tab.test.js',
  'viewer/tests/rvm-pcf-uxml-topology-bridge.test.js',
  'viewer/tests/uxml-topology-decision-gate.test.js',
  'viewer/tests/rvm-pcf-uxml-topology-diagnostics-panel.test.js',
  'viewer/tests/rvm-pcf-uxml-topology-benchmark.test.js',
  'viewer/tests/rvm-pcf-export-guard.test.js',
  'viewer/tests/rvm-pcf-accepted-topology-handoff.test.js',
  'viewer/tests/rvm-pcf-uxml-mode-e2e-smoke.test.js',
  'viewer/tests/rvm-pcf-uxml-roundtrip-contract.test.js',
  'viewer/tests/rvm-pcf-generate-button-uxml-contract.test.js',
  'viewer/tests/rvm-pcf-text-output-ownership-smoke.test.js',
  'viewer/tests/rvm-pcf-generate-button-dom-smoke.test.js',
  'viewer/tests/uxml-route-handoff-policy.test.js',
  'viewer/tests/uxml-cl1-route-package.test.js',
  'viewer/tests/uxml-cl1-package-snapshot.test.js',
  'viewer/tests/uxml-cl1-snapshot-replay-validator.test.js',
  'viewer/tests/uxml-cl1-workbench-summary.test.js',
  'viewer/tests/uxml-cl1-workbench-e2e.test.js',
]);

const REQUIRED_EXPORT_MARKERS = Object.freeze([
  {
    file: 'viewer/uxml/UxmlProfileDetector.js',
    markers: ['detectUxmlProfile', 'detectXmlProfile'],
  },
  {
    file: 'viewer/uxml/UxmlInputXmlSchemaMapper.js',
    markers: [
      'mapInputXmlToUxml',
      'mapInputXmlSchemaToUxml',
      'UXML_INPUTXML_SCHEMA_MAPPER_SCHEMA',
      'UXML_INPUTXML_1001_EXPECTED_METRICS',
      'UXML_INPUTXML_1001_COPY_SCHEMA_EXTENSION_SCHEMA',
    ],
  },
  {
    file: 'viewer/uxml/UxmlStandardXmlSchemaMapper.js',
    markers: [
      'mapStandardXmlToUxml',
      'mapGenericXmlToUxml',
      'UXML_STANDARD_XML_SCHEMA_MAPPER_SCHEMA',
    ],
  },
  {
    file: 'viewer/uxml/UxmlPcfStandardXmlBridge.js',
    markers: [
      'convertPcfTextToStandardXml',
      'UXML_PCF_STANDARD_XML_BRIDGE_SCHEMA',
    ],
  },
  {
    file: 'viewer/uxml/UxmlSourceIntakeBridge.js',
    markers: [
      'runUxmlSourceIntakeBridge',
      'resolveUxmlSourceIntakeRoute',
      'UXML_SOURCE_INTAKE_ROUTES',
    ],
  },
  {
    file: 'viewer/tabs/universal-xml-converter-tab.js',
    markers: [
      'runPipelineActionAsync',
      'runUniversalXmlPipelineFromTextAsync',
      'setUniversalXmlConverterExecutor',
      'run-source-intake-bridge',
    ],
  },
  {
    file: 'viewer/uxml/UxmlNormalizer.js',
    markers: ['normalizeXmlToUxml', 'normalizeToUxml'],
  },
  {
    file: 'viewer/uxml/UxmlValidationGate.js',
    markers: ['validateUxmlDocument', 'runUxmlValidationGate'],
  },
  {
    file: 'viewer/uxml/UxmlFaceModelBuilder.js',
    markers: ['buildUxmlFaceModel', 'createUxmlFaceModel'],
  },
  {
    file: 'viewer/uxml/UxmlUniversalTopoGraphBuilder.js',
    markers: ['buildUxmlUniversalTopoGraph', 'createUxmlUniversalTopoGraph'],
  },
  {
    file: 'viewer/uxml/UxmlRayTopoGraphBuilder.js',
    markers: ['buildUxmlRayTopoGraph', 'createUxmlRayTopoGraph'],
  },
  {
    file: 'viewer/uxml/UxmlTopoGraphComparator.js',
    markers: [
      'compareUxmlTopoGraphs',
      'compareUxmlTopologyGraphs',
      'buildUxmlTopoGraphComparison',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmPcfTopologyModes.js',
    markers: [
      'RVM_PCF_TOPOLOGY_MODES',
      'normalizeRvmPcfTopologyMode',
      'isUxmlTopologyMode',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmRowsToUxmlAdapter.js',
    markers: [
      'adaptRvmRowsToUxml',
      'convertRvmRowsToUxml',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmUxmlTopologyBridge.js',
    markers: [
      'runUxmlTopologyForRvmRows',
      'pushUxmlTopologyBackToLegacyRows',
      'buildRvmPcfUxmlTopology',
    ],
  },
  {
    file: 'viewer/uxml/UxmlTopologyDecisionGate.js',
    markers: [
      'decideUxmlTopologyAcceptance',
      'runUxmlTopologyDecisionGate',
      'buildUxmlAcceptedTopology',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmUxmlTopologyDiagnosticsPanel.js',
    markers: [
      'buildRvmUxmlTopologyDiagnosticsViewModel',
      'renderRvmUxmlTopologyDiagnosticsHtml',
      'createRvmUxmlTopologyDiagnosticsViewModel',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmPcfExportGuard.js',
    markers: [
      'evaluateRvmPcfExportGuard',
      'assertRvmPcfExportAllowed',
      'formatRvmPcfExportGuardMessage',
    ],
  },
  {
    file: 'viewer/rvm-pcf-extract/RvmPcfAcceptedTopologyHandoff.js',
    markers: [
      'buildRvmPcfAcceptedTopologyHandoff',
      'annotateRowsWithAcceptedTopologyHandoff',
      'createRvmPcfAcceptedTopologyHandoff',
    ],
  },
  {
    file: 'viewer/uxml/UxmlRouteHandoffPolicy.js',
    markers: [
      'evaluateUxmlRouteHandoffPolicy',
      'createUxmlRouteHandoffPayload',
      'summarizeUxmlRouteHandoff',
    ],
  },
  {
    file: 'viewer/uxml/UxmlCl1RoutePackage.js',
    markers: [
      'createUxmlCl1RoutePackage',
      'assertUxmlCl1RoutePackageAllowed',
      'summarizeUxmlCl1RoutePackage',
    ],
  },
  {
    file: 'viewer/uxml/UxmlCl1PackageSnapshot.js',
    markers: [
      'buildUxmlCl1PackageSnapshot',
      'createUxmlCl1SnapshotDownload',
      'serializeUxmlCl1PackageSnapshot',
    ],
  },
  {
    file: 'viewer/uxml/UxmlCl1SnapshotReplayValidator.js',
    markers: [
      'validateUxmlCl1SnapshotReplay',
      'assertUxmlCl1SnapshotReplayReady',
      'summarizeUxmlCl1SnapshotReplay',
    ],
  },
  {
    file: 'viewer/uxml/UxmlCl1WorkbenchSummary.js',
    markers: [
      'buildUxmlCl1WorkbenchSummary',
      'summarizeUxmlCl1WorkbenchSummary',
      'createUxmlCl1WorkbenchSummary',
    ],
  },
]);

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function checkFiles(label, files) {
  const missing = [];

  for (const file of files) {
    if (!exists(file)) {
      missing.push(file);
    }
  }

  return {
    label,
    total: files.length,
    passed: files.length - missing.length,
    missing,
  };
}

function checkExportMarkers() {
  const failures = [];

  for (const item of REQUIRED_EXPORT_MARKERS) {
    if (!exists(item.file)) {
      failures.push({
        file: item.file,
        missingMarkers: item.markers,
        reason: 'file-missing',
      });
      continue;
    }

    const content = read(item.file);
    const missingMarkers = item.markers.filter(marker => !content.includes(marker));

    if (missingMarkers.length) {
      failures.push({
        file: item.file,
        missingMarkers,
        reason: 'marker-missing',
      });
    }
  }

  return failures;
}

function printResult(result) {
  const icon = result.missing.length ? '❌' : '✅';

  console.log(`${icon} ${result.label}: ${result.passed} / ${result.total}`);

  for (const file of result.missing) {
    console.log(`  - missing: ${file}`);
  }
}

function main() {
  console.log('UXML Certification');
  console.log('==================');

  const moduleCheck = checkFiles('Required modules', REQUIRED_MODULES);
  const testCheck = checkFiles('Required tests', REQUIRED_TESTS);
  const benchmarkCheck = checkFiles('Required benchmarks', REQUIRED_BENCHMARKS);
  const markerFailures = checkExportMarkers();

  printResult(moduleCheck);
  printResult(testCheck);
  printResult(benchmarkCheck);

  if (markerFailures.length) {
    console.log('❌ Required export markers: FAIL');

    for (const failure of markerFailures) {
      console.log(`  - ${failure.file}`);
      console.log(`    reason: ${failure.reason}`);
      console.log(`    missing markers: ${failure.missingMarkers.join(', ')}`);
    }
  } else {
    console.log(`✅ Required export markers: ${REQUIRED_EXPORT_MARKERS.length} / ${REQUIRED_EXPORT_MARKERS.length}`);
  }

  const failed =
    moduleCheck.missing.length > 0 ||
    testCheck.missing.length > 0 ||
    benchmarkCheck.missing.length > 0 ||
    markerFailures.length > 0;

  console.log('');
  console.log('Summary');
  console.log(failed ? 'Certification: ❌ FAIL' : 'Certification: ✅ PASS');
  console.log(`Required modules: ${moduleCheck.missing.length ? '❌' : '✅'} ${moduleCheck.passed} / ${moduleCheck.total}`);
  console.log(`Required tests: ${testCheck.missing.length ? '❌' : '✅'} ${testCheck.passed} / ${testCheck.total}`);
  console.log(`Required benchmarks: ${benchmarkCheck.missing.length ? '❌' : '✅'} ${benchmarkCheck.passed} / ${benchmarkCheck.total}`);
  console.log(`Required export markers: ${markerFailures.length ? '❌' : '✅'} ${REQUIRED_EXPORT_MARKERS.length - markerFailures.length} / ${REQUIRED_EXPORT_MARKERS.length}`);

  if (failed) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

main();
