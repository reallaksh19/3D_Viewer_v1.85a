import assert from 'node:assert/strict';

export function assertJsonSerializable(value) {
  const restored = JSON.parse(JSON.stringify(value));
  assert.deepEqual(restored, value, 'value must JSON stringify/parse exactly');
}
