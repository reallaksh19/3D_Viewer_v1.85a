import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const AUDIT_JSON = 'Benchmarks\\InputXML Schema Audit\\1001-P-COPY-inputxml-audit.json';
const AUDIT_PLAN = 'Benchmarks\\InputXML Schema Audit\\1001-P-COPY-inputxml-mapping-plan.md';
const BENCHMARK_REPORT = 'Benchmarks\\INPUT XML to CII 2019\\_autotest_outputs\\cii_syntax_benchmark_1001-P - COPY[BenchMark].report.json';
const BENCHMARK_XML = 'Benchmarks\\INPUT XML to CII 2019\\1001\\1001-P - COPY_INPUT.XML';
const BENCHMARK_CII = 'Benchmarks\\INPUT XML to CII 2019\\1001\\1001-P - COPY[BenchMark].CII';

describe('real InputXML schema audit snapshot', () => {
  it('is read-only and matches the benchmark signature', () => {
    expect(fs.existsSync(AUDIT_JSON)).toBe(true);
    expect(fs.existsSync(AUDIT_PLAN)).toBe(true);
    expect(fs.existsSync(BENCHMARK_REPORT)).toBe(true);
    expect(fs.existsSync(BENCHMARK_XML)).toBe(true);
    expect(fs.existsSync(BENCHMARK_CII)).toBe(true);

    const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
    const benchmark = JSON.parse(fs.readFileSync(BENCHMARK_REPORT, 'utf8'));
    const plan = fs.readFileSync(AUDIT_PLAN, 'utf8');

    expect(audit.ok).toBe(true);
    expect(audit.profile).toBe('cii2019');
    expect(audit.inputXmlFile).toBe(BENCHMARK_XML);
    expect(audit.benchmarkCiiFile).toBe(BENCHMARK_CII);
    expect(audit.sectionsFound).toEqual(benchmark.sectionsFound);
    expect(audit.metrics).toEqual(benchmark.metrics);
    expect(audit.derivedBlockCounts).toEqual(benchmark.derivedBlockCounts);
    expect(audit.errors).toEqual([]);
    expect(audit.warnings).toEqual(benchmark.warnings);
    expect(plan).toContain('1001-P-COPY');
    expect(plan).toContain('InputXML -> CII 2019');
    expect(plan).toContain('MISCEL_1');
    expect(plan).toContain('NODENAME');
  });
});
