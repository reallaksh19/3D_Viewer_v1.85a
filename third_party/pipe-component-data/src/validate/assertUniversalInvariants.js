import assert from 'node:assert/strict';
import { assertExactGraphKeySet } from './assertExactGraphKeySet.js';
import { assertJsonSerializable } from './assertJsonSerializable.js';

export function assertUniversalInvariants(graph) {
  assertExactGraphKeySet(graph);
  assertJsonSerializable(graph);
  assertNoNaNOrInfinity(graph);
  assertLossContractArray(graph);
}

function assertLossContractArray(graph) {
  assert.ok(Array.isArray(graph.lossContract), 'lossContract must be an array');
}

function assertNoNaNOrInfinity(value, path = 'graph') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assertNoNaNOrInfinity(child, `${path}.${key}`);
  }
}
