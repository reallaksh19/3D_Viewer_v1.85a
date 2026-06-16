import assert from 'assert/strict';

import {
  buildSupportSpecs,
} from '../interchange/support/support-builder.js';

function run() {
  console.log('--- interchange-support-builder-resolver.test.js ---');

  const nodes = [
    { id: 'N1', position: { x: 0, y: 0, z: 0 } },
    { id: 'N2', position: { x: 100, y: 0, z: 0 } },
    { id: 'N3', position: { x: 200, y: 0, z: 0 } },
  ];

  const result = buildSupportSpecs({
    format: 'XML',
    assemblyId: 'ASM-1',
    nodes,
    projectDiagnostics: null,
    supportCandidates: [
      {
        id: 'SRC-1',
        type: 'SUPPORT',
        supportCoord: { x: 0, y: 0, z: 0 },
        rawAttributes: { SKEY: 'CA100', SUPPORT_DIRECTION: 'EAST' },
      },
      {
        id: 'SRC-2',
        type: 'SUPPORT',
        supportCoord: { x: 100, y: 0, z: 0 },
        rawAttributes: { SKEY: 'CA150', SUPPORT_DIRECTION: 'UP' },
      },
      {
        id: 'SRC-3',
        type: 'SUPPORT',
        supportCoord: { x: 200, y: 0, z: 0 },
        rawAttributes: { SKEY: 'STOPPER', SUPPORT_DIRECTION: 'EAST' },
      },
    ],
  });

  assert.equal(result.supports.length, 3, 'all support candidates are built');
  assert.equal(result.supports[0].normalized.supportCode, 'CA100', 'raw CA100 code is preserved');
  assert.equal(result.supports[0].normalized.supportKind, 'GUIDE', 'CA100 resolves to GUIDE');
  assert.equal(result.supports[1].normalized.supportCode, 'CA150', 'raw CA150 code is preserved');
  assert.equal(result.supports[1].normalized.supportKind, 'REST', 'CA150 resolves to REST');
  assert.equal(result.supports[2].normalized.supportCode, 'STOPPER', 'raw STOPPER code is preserved');
  assert.equal(result.supports[2].normalized.supportKind, 'LINESTOP', 'STOPPER resolves to LINESTOP');

  console.log('[PASS] Interchange support builder resolver passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Interchange support builder resolver failed.');
  console.error(error);
  process.exit(1);
}
