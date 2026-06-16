/**
 * Tests for Tee and Olet handling in the JSON→PCF topo builder pipeline.
 *
 * Covers:
 *   - json-topo-parser: OLET with only cp/bp (no ep1/ep2) must not be dropped
 *   - topo-builder: TEE registers a third topology node for the branch (bp)
 *   - topo-builder: OLET uses cp as the header-tap node and bp as the branch node
 *   - topo-builder: anchor cpNodeId/bpNodeId populated correctly
 *   - topo-builder: missing TEE bp emits a diagnostic warning
 */

import assert from 'assert/strict';

// Minimal localStorage mock required by the config stores.
const mockStorage = (() => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
})();
global.window = { localStorage: mockStorage };

import { parseJsonToTopoInput } from '../../../interchange/source/json/json-topo-parser.js';
import { buildCanonicalProjectFromTopoSource } from '../../../interchange/topo/topo-builder.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pt(x, y, z) {
  return { x, y, z };
}

function buildProject(segments) {
  const topoInput = {
    format: 'JSON',
    segments,
    supports: [],
    annotations: [],
    messages: [],
  };
  return buildCanonicalProjectFromTopoSource({
    sourceRecord: { id: 'test', name: 'Test' },
    topoInput,
    format: 'JSON',
  });
}

function posKey(node) {
  const p = node.position;
  return `${p.x}|${p.y}|${p.z}`;
}

// ---------------------------------------------------------------------------
// json-topo-parser: OLET with cp/bp only (no ep1/ep2)
// ---------------------------------------------------------------------------

{
  const json = JSON.stringify({
    components: [
      {
        type: 'WELDOLET',
        cp: pt(0, 0, 0),
        bp: pt(0, 100, 0),
      },
    ],
  });

  const result = parseJsonToTopoInput(json);
  const olet = result.segments.find((s) => s.type === 'WELDOLET');

  assert.ok(olet, 'WELDOLET with cp/bp-only must be parsed (not dropped)');
  assert.deepEqual(olet.ep1, pt(0, 0, 0), 'ep1 should fall back to cp');
  assert.deepEqual(olet.ep2, pt(0, 100, 0), 'ep2 should fall back to bp');
  assert.deepEqual(olet.cp, pt(0, 0, 0), 'cp should be preserved');
  assert.deepEqual(olet.bp, pt(0, 100, 0), 'bp should be preserved');
}

// ---------------------------------------------------------------------------
// json-topo-parser: SOCKOLET retains original ep1/ep2 when present
// ---------------------------------------------------------------------------

{
  const json = JSON.stringify({
    components: [
      {
        type: 'SOCKOLET',
        ep1: pt(10, 0, 0),
        ep2: pt(10, 50, 0),
        cp: pt(10, 0, 0),
        bp: pt(10, 50, 0),
      },
    ],
  });

  const result = parseJsonToTopoInput(json);
  const olet = result.segments.find((s) => s.type === 'SOCKOLET');
  assert.ok(olet, 'SOCKOLET with ep1/ep2 present must be parsed');
  assert.deepEqual(olet.ep1, pt(10, 0, 0));
  assert.deepEqual(olet.ep2, pt(10, 50, 0));
}

// ---------------------------------------------------------------------------
// topo-builder: TEE registers three topology nodes
// ---------------------------------------------------------------------------

{
  const { project, topoGraph } = buildProject([
    {
      id: 'tee-1',
      type: 'TEE',
      ep1: pt(0, 0, 0),
      ep2: pt(200, 0, 0),
      bp: pt(100, 100, 0),
      rawAttributes: {},
    },
  ]);

  // Three nodes: TEE_MAIN_1 (ep1), TEE_MAIN_2 (ep2), TEE_BRANCH (bp)
  assert.equal(project.nodes.length, 3, 'TEE must produce 3 topology nodes');

  const nodePositions = new Set(project.nodes.map(posKey));
  assert.ok(nodePositions.has('0|0|0'), 'ep1 node present');
  assert.ok(nodePositions.has('200|0|0'), 'ep2 node present');
  assert.ok(nodePositions.has('100|100|0'), 'bp (branch) node present');

  // Component must have 3 anchor nodes
  const cmp = project.components[0];
  assert.equal(cmp.anchorNodeIds.length, 3, 'TEE component must have 3 anchorNodeIds');

  // Anchor must have a valid bpNodeId
  const anchor = topoGraph.anchors[0];
  assert.ok(anchor.bpNodeId, 'TEE anchor must have non-null bpNodeId');
  assert.equal(anchor.cpNodeId, null, 'TEE anchor cpNodeId must be null');

  // The bpNodeId must reference the branch-point node
  const bpNode = project.nodes.find((n) => n.id === anchor.bpNodeId);
  assert.ok(bpNode, 'bpNodeId must reference an existing node');
  assert.deepEqual(bpNode.position, pt(100, 100, 0), 'bpNode position must equal bp');
}

// ---------------------------------------------------------------------------
// topo-builder: branch pipe connecting to TEE branch gets the same node
// ---------------------------------------------------------------------------

{
  const { project } = buildProject([
    {
      id: 'tee-1',
      type: 'TEE',
      ep1: pt(0, 0, 0),
      ep2: pt(200, 0, 0),
      bp: pt(100, 100, 0),
      rawAttributes: {},
    },
    {
      id: 'branch-pipe',
      type: 'PIPE',
      ep1: pt(100, 100, 0),
      ep2: pt(100, 300, 0),
      rawAttributes: {},
    },
  ]);

  // Both TEE bp and pipe ep1 are at (100,100,0) → merged into one node.
  // Expected: 4 unique nodes total (0,0,0 / 200,0,0 / 100,100,0 / 100,300,0).
  assert.equal(project.nodes.length, 4, 'Branch pipe must share the TEE bp node (no duplicate)');

  // The shared node at (100,100,0) must be connected to two segments: TEE + branch pipe.
  // (TEE's run segment ep1→ep2 doesn't connect through bp, but the branch-pipe segment does.)
  const sharedNode = project.nodes.find((n) => posKey(n) === '100|100|0');
  assert.ok(sharedNode, 'Shared TEE/branch-pipe node must exist');
  assert.equal(sharedNode.connectedSegmentIds.length, 1,
    'Shared node connects to the branch-pipe segment (TEE run segment does not use bp as endpoint)');
}

// ---------------------------------------------------------------------------
// topo-builder: OLET uses cp as header-tap node and bp as branch node
// ---------------------------------------------------------------------------

{
  const { project, topoGraph } = buildProject([
    {
      id: 'olet-1',
      type: 'OLET',
      cp: pt(0, 0, 0),
      bp: pt(0, 150, 0),
      rawAttributes: {},
    },
  ]);

  assert.equal(project.nodes.length, 2, 'OLET must produce 2 topology nodes (cp + bp)');

  const nodePositions = new Set(project.nodes.map(posKey));
  assert.ok(nodePositions.has('0|0|0'), 'OLET cp (header tap) node present');
  assert.ok(nodePositions.has('0|150|0'), 'OLET bp (branch) node present');

  // Anchor cpNodeId must point at the header-tap node
  const anchor = topoGraph.anchors[0];
  assert.ok(anchor.cpNodeId, 'OLET anchor must have non-null cpNodeId');
  assert.equal(anchor.bpNodeId, null, 'OLET anchor bpNodeId must be null');

  const cpNode = project.nodes.find((n) => n.id === anchor.cpNodeId);
  assert.ok(cpNode, 'cpNodeId must reference an existing node');
  assert.deepEqual(cpNode.position, pt(0, 0, 0), 'cpNode position must equal cp');
}

// ---------------------------------------------------------------------------
// topo-builder: TEE missing bp emits a diagnostic warning
// ---------------------------------------------------------------------------

{
  const { project } = buildProject([
    {
      id: 'tee-no-bp',
      type: 'TEE',
      ep1: pt(0, 0, 0),
      ep2: pt(200, 0, 0),
      rawAttributes: {},
    },
  ]);

  // Only 2 nodes (no branch node because bp is absent).
  assert.equal(project.nodes.length, 2, 'TEE without bp must still produce 2 run nodes');

  const warnings = project.diagnostics.messages.filter(
    (e) => e.code === 'TOPO_TEE_BRANCH_MISSING',
  );
  assert.equal(warnings.length, 1, 'Missing TEE bp must emit TOPO_TEE_BRANCH_MISSING warning');
}

console.log('✅ json-topo-tee-olet unit tests passed.');
