/**
 * Wave 2 tab shell tests - plain Node ESM, no jsdom/three
 */

// Stub globals before dynamic imports
global.localStorage = { getItem: () => null, setItem: () => {} };

// Stub document to satisfy any tab imports
if (!global.document) {
  global.document = {
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }),
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild() {} },
  };
}

const { state } = await import('../../../core/state.js');
const { RuntimeEvents } = await import('../../../contracts/runtime-events.js');
const { on, emit } = await import('../../../core/event-bus.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

// T1: state.rvmPcfExtract initializes with correct shape
{
  const s = state.rvmPcfExtract;
  assert(s !== undefined, 'T1: rvmPcfExtract exists');
  assert(s.source === null, 'T1: source is null');
  assert(s.scope === 'full', 'T1: scope is "full"');
  assert(Array.isArray(s.rows) && s.rows.length === 0, 'T1: rows is empty array');
  assert(Array.isArray(s.selectedCanonicalIds) && s.selectedCanonicalIds.length === 0, 'T1: selectedCanonicalIds is empty array');
  assert(s.sourceStatus === 'idle', 'T1: sourceStatus is "idle"');
  assert(s.lastRequestedAt === null, 'T1: lastRequestedAt is null');
  assert(s.lastBuiltAt === null, 'T1: lastBuiltAt is null');
  assert(typeof s.pipelineGroups === 'object', 'T1: pipelineGroups is object');
  assert(typeof s.masters === 'object', 'T1: masters is object');
}

// T2: RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED is a registered string
assert(
  typeof RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED === 'string' && RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED.length > 0,
  'T2: RVM_EXTRACT_PCF_REQUESTED is a non-empty string'
);

// T3: RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED is a registered string
assert(
  typeof RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED === 'string' && RuntimeEvents.RVM_PCF_EXTRACT_STATE_CHANGED.length > 0,
  'T3: RVM_PCF_EXTRACT_STATE_CHANGED is a non-empty string'
);

// T4: After emitting RVM_EXTRACT_PCF_REQUESTED, a listener receives scope and selectedCanonicalIds
{
  let received = null;
  const handler = (payload) => { received = payload; };
  on(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, handler);
  const payload = { scope: 'selected', selectedCanonicalIds: ['id1', 'id2'] };
  emit(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, payload);
  // no off needed for test isolation
  assert(received !== null, 'T4: listener received event');
  assert(received.scope === 'selected', 'T4: received correct scope');
  assert(Array.isArray(received.selectedCanonicalIds) && received.selectedCanonicalIds.length === 2, 'T4: received correct selectedCanonicalIds');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
