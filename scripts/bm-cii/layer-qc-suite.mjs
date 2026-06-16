#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUITE_SCHEMA = 'bm-cii-layer-qc-suite/report-v1';
const DEFAULT_GLB_PATTERNS = Object.freeze([
  { variant: 'engineering_inputxml', supportSource: 'inputxml', match: /engineering.*inputxml.*\.glb$/i },
  { variant: 'engineering_isonote', supportSource: 'isonote', match: /engineering.*isonote.*\.glb$/i },
  { variant: 'temp1_inputxml', supportSource: 'inputxml', match: /temp1.*inputxml.*\.glb$/i },
  { variant: 'temp1_isonote', supportSource: 'isonote', match: /temp1.*isonote.*\.glb$/i },
]);

function usage() {
  return `Usage:
  node scripts/bm-cii/layer-qc-suite.mjs --dir <glb-dir> [--out suite.json] [--report-dir <dir>] [--strict]

Purpose:
  Run the BM_CII layer metadata QC gate against all expected GLB variants.
  This is the pre-viewer-toggle release gate after GLBs are regenerated with
  bmCiiLayer / bmCiiLayerManifest metadata.

Expected GLB variants by filename:
  engineering + inputxml
  engineering + isonote
  temp1 + inputxml
  temp1 + isonote
`;
}

function parseArgs(argv) {
  const args = { strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dir') args.dir = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--report-dir') args.reportDir = argv[++i];
    else if (arg === '--strict') args.strict = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.help && !args.dir) throw new Error('Missing --dir.');
  return args;
}

async function listGlbs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.glb'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function findVariantFile(files, pattern) {
  const matches = files.filter((file) => pattern.match.test(path.basename(file)));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return null;
  throw new Error(`Ambiguous GLB match for ${pattern.variant}: ${matches.map((m) => path.basename(m)).join(', ')}`);
}

function repoRootFromScript() {
  const scriptPath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(scriptPath), '../..');
}

async function runNode(command, args, { cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [command, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function ensureDir(dir) {
  if (dir) await fs.mkdir(dir, { recursive: true });
}

async function runSuite(args) {
  const glbDir = path.resolve(args.dir);
  const files = await listGlbs(glbDir);
  const repoRoot = repoRootFromScript();
  const layerQcScript = path.join(repoRoot, 'scripts/bm-cii/layer-qc.mjs');
  const reportDir = path.resolve(args.reportDir || path.join(glbDir, 'layer-qc-reports'));
  await ensureDir(reportDir);

  const reports = [];
  const missing = [];
  for (const pattern of DEFAULT_GLB_PATTERNS) {
    const glb = findVariantFile(files, pattern);
    if (!glb) {
      missing.push(pattern.variant);
      continue;
    }

    const out = path.join(reportDir, `${pattern.variant}.layer-qc.json`);
    const result = await runNode(layerQcScript, [
      '--glb', glb,
      '--support-source', pattern.supportSource,
      '--out', out,
      '--pretty',
      '--strict',
    ], { cwd: repoRoot });

    const parsed = await readJson(out).catch(() => null);
    reports.push({
      variant: pattern.variant,
      supportSource: pattern.supportSource,
      glb: path.basename(glb),
      report: out,
      ok: result.code === 0 && parsed?.ok === true,
      exitCode: result.code,
      failedGates: parsed?.gates ? Object.entries(parsed.gates).filter(([, ok]) => !ok).map(([gate]) => gate) : ['report-not-readable'],
      byCategory: parsed?.byCategory || {},
      manifest: parsed?.manifest || null,
      stderr: result.stderr.trim(),
    });
  }

  const suite = {
    schema: SUITE_SCHEMA,
    createdAtUtc: new Date().toISOString(),
    glbDir,
    reportDir,
    missingVariants: missing,
    ok: missing.length === 0 && reports.every((report) => report.ok),
    reports,
  };

  if (args.out) {
    await ensureDir(path.dirname(path.resolve(args.out)));
    await fs.writeFile(path.resolve(args.out), `${JSON.stringify(suite, null, 2)}\n`, 'utf8');
  }
  return suite;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      return;
    }
    const suite = await runSuite(args);
    process.stdout.write(`${JSON.stringify(suite, null, 2)}\n`);
    if (args.strict && !suite.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error?.stack || error?.message || String(error)}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) await main();

export {
  DEFAULT_GLB_PATTERNS,
  SUITE_SCHEMA,
  parseArgs,
  runSuite,
};
