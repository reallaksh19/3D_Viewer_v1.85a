#!/usr/bin/env node
/**
 * gen-rvm-index.js
 *
 * Post-processor: reads rvmparser JSON attribute output → emits model.index.json
 *
 * Usage:
 *   node tools/gen-rvm-index.js <rvmparser-attrs.json> <output-index.json> [bundleId]
 *
 * The rvmparser --output-json flag produces a flat JSON array of node objects.
 * This script maps that structure to the rvm-index/v1 schema.
 */

import fs from 'fs';
import path from 'path';

function usage() {
  console.error('Usage: node gen-rvm-index.js <rvmparser-attrs.json> <output-index.json> [bundleId]');
  process.exit(1);
}

function main() {
  const [, , inputPath, outputPath, bundleId = 'bundle'] = process.argv;
  if (!inputPath || !outputPath) usage();

  let raw;
  try {
    raw = fs.readFileSync(path.resolve(inputPath), 'utf8');
  } catch (e) {
    console.error(`Cannot read input file: ${e.message}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`JSON parse error in input: ${e.message}`);
    process.exit(1);
  }

  // rvmparser may output either an array of nodes or { nodes: [...] }
  const rawNodes = Array.isArray(parsed) ? parsed : (parsed.nodes || []);

  const nodes = rawNodes.map((n, idx) => {
    const sourceId = String(n.id || n.sourceObjectId || `node-${idx}`);
    return {
      sourceObjectId: sourceId,
      // Phase 1: canonical === source
      canonicalObjectId: sourceId,
      renderObjectIds: n.renderObjectIds || n.meshIds || [`mesh_${idx}`],
      parentCanonicalObjectId: n.parentId ? String(n.parentId) : null,
      name: n.name || n.label || '',
      path: n.path || '',
      kind: n.kind || n.type || 'node',
      bbox: n.bbox || null,
      attributes: n.attributes || n.props || {},
    };
  });

  const index = {
    schemaVersion: 'rvm-index/v1',
    bundleId,
    units: 'mm',
    upAxis: 'Y',
    nodes,
  };

  const outDir = path.dirname(path.resolve(outputPath));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(index, null, 2), 'utf8');
  console.log(`✅ model.index.json written: ${nodes.length} nodes → ${outputPath}`);
}

main();
