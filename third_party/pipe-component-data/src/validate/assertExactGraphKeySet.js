import assert from 'node:assert/strict';
import { ADAPTER_GRAPH_KEYS } from '../graph/adapterGraphKeys.js';

export function assertExactGraphKeySet(graph) {
  assert.ok(graph && typeof graph === 'object', 'graph must be an object');
  assert.deepEqual(
    Object.keys(graph).sort(),
    [...ADAPTER_GRAPH_KEYS].sort(),
    'AdapterGraph top-level key set mismatch'
  );
}
