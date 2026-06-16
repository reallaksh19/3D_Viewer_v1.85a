#!/usr/bin/env node
/**
 * BM_CII Q3 geometry baseline check.
 *
 * Compares a trace-geometry QC summary against the frozen BM_CII v11 Q3
 * geometry baseline. This gate is intentionally geometry-first: it checks
 * trace coverage, geometry node counts, entity counts, and semantic category
 * counts. It does not gate file bytes or SHA because trace metadata timestamps
 * can legitimately change without changing geometry.
 *
 * Usage:
 *   node scripts/bm-cii/check-q3-geometry-baseline.mjs \
 *     --summary BM_CII_v11_q3_trace_geometry_qc.summary.json \
 *     --baseline benchmarks/bm-cii/BM_CII_v11_Q3_geometry_baseline.json \
 *     --strict
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    baseline: 'benchmarks/bm-cii/BM_CII_v11_Q3_geometry_baseline.json',
    summary: '',
    out: '',
    strict: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--summary') args.summary = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--strict') args.strict = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }

  return args;
}

function usage() {
  return `BM_CII Q3 geometry baseline check\n\nUsage:\n  node scripts/bm-cii/check-q3-geometry-baseline.mjs \\\n    --summary <trace-qc-summary.json> \\\n    [--baseline benchmarks/bm-cii/BM_CII_v11_Q3_geometry_baseline.json] \\\n    [--out report.json] \\\n    [--strict]\n`;
}

function readJson(file) {
  if (!file) throw new Error('Missing JSON file path.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function asReportMap(summary) {
  const rows = Array.isArray(summary.reports) ? summary.reports : [];
  const out = new Map();
  for (const row of rows) {
    if (row && row.variant) out.set(row.variant, row);
  }
  return out;
}

function sameNumber(actual, expected) {
  return Number(actual) === Number(expected);
}

function compareObjectCounts({ actual = {}, expected = {}, pathPrefix, failures }) {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of [...keys].sort()) {
    const a = Number(actual[key] ?? 0);
    const e = Number(expected[key] ?? 0);
    if (a !== e) failures.push(`${pathPrefix}.${key}: expected ${e}, got ${a}`);
  }
}

function compareVariant({ name, expected, actual }) {
  const failures = [];
  if (!actual) {
    failures.push(`${name}: missing from trace QC summary`);
    return failures;
  }

  if (actual.ok !== true) failures.push(`${name}.ok: expected true, got ${actual.ok}`);
  if (actual.supportSource !== expected.supportSource) {
    failures.push(`${name}.supportSource: expected ${expected.supportSource}, got ${actual.supportSource}`);
  }
  if (!sameNumber(actual.geometryNodes, expected.geometryNodes)) {
    failures.push(`${name}.geometryNodes: expected ${expected.geometryNodes}, got ${actual.geometryNodes}`);
  }
  if (!sameNumber(actual.tracedGeometryNodes, expected.tracedGeometryNodes)) {
    failures.push(`${name}.tracedGeometryNodes: expected ${expected.tracedGeometryNodes}, got ${actual.tracedGeometryNodes}`);
  }
  if (!sameNumber(actual.traceCoveragePct, expected.traceCoveragePct)) {
    failures.push(`${name}.traceCoveragePct: expected ${expected.traceCoveragePct}, got ${actual.traceCoveragePct}`);
  }

  const failedGates = Array.isArray(actual.failedGates) ? actual.failedGates : [];
  if (failedGates.length) failures.push(`${name}.failedGates: expected none, got ${failedGates.join(', ')}`);

  compareObjectCounts({
    actual: actual.byEntity,
    expected: expected.byEntity,
    pathPrefix: `${name}.byEntity`,
    failures,
  });
  compareObjectCounts({
    actual: actual.bySemanticCategory,
    expected: expected.bySemanticCategory,
    pathPrefix: `${name}.bySemanticCategory`,
    failures,
  });

  return failures;
}

function runBaselineCheck({ baseline, summary }) {
  const reportMap = asReportMap(summary);
  const failures = [];
  const expectedVariants = baseline.variants || {};

  if (summary.overallOk !== true) failures.push(`summary.overallOk: expected true, got ${summary.overallOk}`);

  for (const [variant, expected] of Object.entries(expectedVariants)) {
    failures.push(...compareVariant({ name: variant, expected, actual: reportMap.get(variant) }));
  }

  for (const variant of reportMap.keys()) {
    if (!Object.hasOwn(expectedVariants, variant)) failures.push(`${variant}: unexpected extra variant in summary`);
  }

  return {
    schema: 'bm-cii-geometry-baseline-check/report-v1',
    ok: failures.length === 0,
    baselineSchema: baseline.schema,
    summarySchema: summary.schema,
    checkedVariants: Object.keys(expectedVariants),
    failures,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.summary) {
    console.log(usage());
    process.exit(args.help ? 0 : 2);
  }

  const baseline = readJson(args.baseline);
  const summary = readJson(args.summary);
  const report = runBaselineCheck({ baseline, summary });

  const output = JSON.stringify(report, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${output}\n`, 'utf8');
  } else {
    console.log(output);
  }

  if (args.strict && !report.ok) process.exit(1);
}

main();
