#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function read(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) throw new Error(`Missing expected file: ${relPath}`);
  return fs.readFileSync(abs, 'utf8');
}

function assertContains(fileLabel, content, needle, message = '') {
  if (!content.includes(needle)) {
    throw new Error(`${fileLabel} missing ${JSON.stringify(needle)}${message ? `: ${message}` : ''}`);
  }
}

function assertRegex(fileLabel, content, regex, message = '') {
  if (!regex.test(content)) {
    throw new Error(`${fileLabel} failed ${regex}${message ? `: ${message}` : ''}`);
  }
}

const files = {
  shell: read('viewer/tabs/psnm-utility-tab.js'),
  phaseD: read('viewer/tabs/psnm-utility-tab-coordinate-audit-ui.js'),
  phaseC: read('viewer/tabs/psnm-utility-tab-coordinate-review-ui.js'),
  phaseB: read('viewer/tabs/psnm-utility-tab-coordinate-occurrence-ui.js'),
  phaseA: read('viewer/tabs/psnm-utility-tab-coordinate-first-ui.js'),
  adapter: read('viewer/tabs/psnm-utility/psnm-source-master-adapter.js'),
  resolver: read('viewer/tabs/psnm-utility/psnm-master-resolver.js'),
  benchmark: read('scripts/test-psnm-axis-auto-anchor-defaults.mjs'),
};

assertContains('psnm shell', files.shell, 'psnm-utility-tab-coordinate-audit-ui.js', 'active shell must route through Phase D audit wrapper');
assertContains('Phase D audit UI', files.phaseD, 'psnm-utility-tab-coordinate-review-ui.js', 'Phase D must wrap Phase C');
assertContains('Phase C review UI', files.phaseC, 'psnm-utility-tab-coordinate-occurrence-ui.js', 'Phase C must wrap Phase B');
assertContains('Phase B occurrence UI', files.phaseB, 'psnm-utility-tab-coordinate-first-ui.js', 'Phase B must wrap Phase A');

assertContains('Phase A coordinate-first UI', files.phaseA, 'coordinate-first', 'coordinate-first guidance should be present');
assertContains('Phase A coordinate-first UI', files.phaseA, 'PS Coord Key', 'Master PS coordinate key column should be injected');
assertContains('Phase A coordinate-first UI', files.phaseA, 'Node Coord Key', 'Master Node coordinate key column should be injected');
assertContains('Phase A coordinate-first UI', files.phaseA, 'Decision Basis', 'Match Results should expose a decision-basis column');
assertContains('Phase A coordinate-first UI', files.phaseA, 'DUPLICATE_COORDINATE', 'duplicate-coordinate warning should be visible');

assertContains('Phase B occurrence UI', files.phaseB, 'PS Occurrence', 'Master PS should show occurrence identity');
assertContains('Phase B occurrence UI', files.phaseB, 'Identity Warning', 'Master PS should show identity warnings');
assertContains('Phase B occurrence UI', files.phaseB, 'coordinate-occurrence aware', 'Phase B note should explain coordinate occurrence identity');

assertContains('Phase C review UI', files.phaseC, 'Coordinate Transform Playground', 'Setup tab should include transform playground');
assertContains('Phase C review UI', files.phaseC, 'Manual Review Queue', 'Coverage tab should include review queue');
assertContains('Phase C review UI', files.phaseC, 'Copy Queue CSV', 'Review queue must be exportable');
assertContains('Phase C review UI', files.phaseC, 'Coordinate class', 'Playground must classify coordinate tolerance');

assertContains('Phase D audit UI', files.phaseD, 'Manual Override + Audit Export', 'Coverage tab should include override/audit card');
assertContains('Phase D audit UI', files.phaseD, 'psnm.manualOverrides.v1', 'manual overrides must persist locally');
assertContains('Phase D audit UI', files.phaseD, 'Copy Overrides CSV', 'override CSV export should be available');
assertContains('Phase D audit UI', files.phaseD, 'Copy Full Audit CSV', 'full audit CSV export should be available');
assertContains('Phase D audit UI', files.phaseD, 'Overrides are stored locally as an audit layer only', 'UI must warn overrides do not mutate source/master/match data');

assertRegex('Master resolver', files.resolver, /psOccurrenceId|coordinateIdentityKey|psCoordKey/, 'Phase B coordinate occurrence fields must be present');
assertRegex('Source/master adapter', files.adapter, /psOccurrenceId|masterPsRowId|psCoordKey/, 'adapter must carry occurrence metadata into matching/coverage');

assertContains('Default benchmark', files.benchmark, 'PS-02', 'benchmark should retain default anchor PS case');
assertContains('Default benchmark', files.benchmark, "['PS-02', { node: '50'", 'benchmark should validate PS-02 to Node 50');
assertContains('Default benchmark', files.benchmark, '✅ PSNM axis auto-anchor default benchmark passed.', 'benchmark must fail closed and pass with explicit success message');

console.log('✅ PSNM UI source smoke test passed.');
console.log('  Active route: shell → Phase D → Phase C → Phase B → Phase A.');
console.log('  Verified: coordinate keys, occurrence identity, playground, review queue, manual override/audit export, default benchmark tokens.');
