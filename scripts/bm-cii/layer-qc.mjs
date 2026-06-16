#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const JSON_CHUNK = 0x4E4F534A;
const BIN_CHUNK = 0x004E4942;
const GLB_MAGIC = 0x46546C67;

function usage() {
  return `Usage:
  node scripts/bm-cii/layer-qc.mjs --glb <file.glb> [--support-source inputxml|isonote] [--out report.json] [--pretty] [--strict]

Purpose:
  BM_CII GLB layer metadata QC gate.
  Fails if exported mesh nodes cannot be toggled by bmCiiLayer metadata.

Checks:
  - every rendered mesh node has bmCiiLayer.layerIds
  - root or scene has bmCiiLayerManifest
  - plant/restraint/annotation layers are present
  - supports have plant.restraints + selected source + support subtype layer
  - annotations have annotation.all + annotation.callout
  - selected InputXML/ISONOTE support source is not mixed accidentally
`;
}

function parseArgs(argv) {
  const args = { pretty: false, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--glb') args.glb = argv[++i];
    else if (arg === '--support-source') args.supportSource = String(argv[++i] || '').toLowerCase();
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--pretty') args.pretty = true;
    else if (arg === '--strict') args.strict = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.help && !args.glb) throw new Error('Missing --glb.');
  return args;
}

function readU32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

async function readGlb(filePath) {
  const data = await fs.readFile(filePath);
  if (data.length < 20) throw new Error(`GLB too small: ${filePath}`);
  const magic = readU32(data, 0);
  const version = readU32(data, 4);
  const totalLength = readU32(data, 8);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (version !== 2) throw new Error(`Expected GLB v2, got ${version}.`);
  if (totalLength !== data.length) throw new Error(`GLB length mismatch: header=${totalLength}, actual=${data.length}.`);

  let offset = 12;
  let json = null;
  while (offset + 8 <= data.length) {
    const chunkLength = readU32(data, offset);
    const chunkType = readU32(data, offset + 4);
    offset += 8;
    const chunk = data.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === JSON_CHUNK) json = JSON.parse(Buffer.from(chunk).toString('utf8').replace(/[\u0000\s]+$/g, ''));
    else if (chunkType !== BIN_CHUNK) {
      // ignored extension chunk
    }
  }
  if (!json) throw new Error('Missing GLB JSON chunk.');
  return { gltf: json, bytes: data.length };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function findManifest(gltf = {}) {
  if (gltf.extras?.bmCiiLayerManifest) return gltf.extras.bmCiiLayerManifest;
  for (const node of gltf.nodes || []) {
    if (node.extras?.bmCiiLayerManifest) return node.extras.bmCiiLayerManifest;
  }
  return null;
}

function layerOf(node = {}) {
  return node.extras?.bmCiiLayer || null;
}

function traceOf(node = {}) {
  return node.extras?.bmCiiTrace || null;
}

function classify(node = {}) {
  const layer = layerOf(node);
  const ids = new Set(asArray(layer?.layerIds));
  if (ids.has('annotation.all')) return 'annotation';
  if (ids.has('plant.restraints')) return 'support';
  if (ids.has('plant.pipe')) return 'pipe';
  if (ids.has('plant.bend')) return 'bend';
  if (ids.has('plant.valve')) return 'valve';
  if (ids.has('plant.flange')) return 'flange';
  if (ids.has('plant.tee_olet')) return 'teeOlet';
  if (ids.has('plant.axis')) return 'axis';
  return layer?.category || traceOf(node)?.semanticCategory || 'other';
}

function hasAnyPrefix(ids, prefix) {
  return ids.some((id) => String(id).startsWith(prefix));
}

function inspect(gltf, expectedSupportSource = '') {
  const nodes = gltf.nodes || [];
  const meshNodes = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.mesh !== undefined && node.mesh !== null);

  const manifest = findManifest(gltf);
  const byCategory = {};
  const missingLayer = [];
  const supportIssues = [];
  const annotationIssues = [];
  const sourceMixingIssues = [];

  for (const { node, index } of meshNodes) {
    const layer = layerOf(node);
    const ids = asArray(layer?.layerIds).map(String);
    const category = classify(node);
    byCategory[category] = (byCategory[category] || 0) + 1;

    if (!layer || ids.length === 0) {
      missingLayer.push({ index, name: node.name || '', reason: 'missing bmCiiLayer.layerIds' });
      continue;
    }

    if (category === 'support') {
      if (!ids.includes('plant.restraints')) supportIssues.push({ index, name: node.name || '', reason: 'support missing plant.restraints layer' });
      if (!hasAnyPrefix(ids, 'restraints.')) supportIssues.push({ index, name: node.name || '', reason: 'support missing restraints.* layer' });
      if (!ids.some((id) => ['restraints.rest', 'restraints.guide', 'restraints.linestop', 'restraints.limit', 'restraints.anchor', 'restraints.hanger', 'restraints.spring', 'restraints.unknown'].includes(id))) {
        supportIssues.push({ index, name: node.name || '', reason: 'support missing restraint subtype layer' });
      }
      if (expectedSupportSource) {
        const selected = `restraints.${expectedSupportSource}`;
        const opposite = expectedSupportSource === 'inputxml' ? 'restraints.isonote' : expectedSupportSource === 'isonote' ? 'restraints.inputxml' : '';
        if (!ids.includes(selected)) sourceMixingIssues.push({ index, name: node.name || '', reason: `support missing selected source layer ${selected}` });
        if (opposite && ids.includes(opposite)) sourceMixingIssues.push({ index, name: node.name || '', reason: `support contains opposite source layer ${opposite}` });
      }
    }

    if (category === 'annotation') {
      if (!ids.includes('annotation.all')) annotationIssues.push({ index, name: node.name || '', reason: 'annotation missing annotation.all layer' });
      if (!ids.includes('annotation.callout')) annotationIssues.push({ index, name: node.name || '', reason: 'annotation missing annotation.callout layer' });
    }
  }

  const gates = {
    glbHasMeshNodes: meshNodes.length > 0,
    hasLayerManifest: Boolean(manifest?.layers?.length),
    allMeshNodesHaveLayer: missingLayer.length === 0,
    hasPlantLayers: ['pipe', 'bend', 'valve', 'flange', 'teeOlet'].some((key) => byCategory[key] > 0),
    hasSupportLayer: (byCategory.support || 0) > 0,
    hasAnnotationLayer: (byCategory.annotation || 0) > 0,
    supportsHaveRequiredLayers: supportIssues.length === 0,
    annotationsHaveRequiredLayers: annotationIssues.length === 0,
    selectedSupportSourceNotMixed: sourceMixingIssues.length === 0,
  };

  return {
    gates,
    ok: Object.values(gates).every(Boolean),
    manifest: manifest ? { schema: manifest.schema, layerCount: asArray(manifest.layers).length } : null,
    meshNodeCount: meshNodes.length,
    byCategory,
    missingLayer,
    supportIssues,
    annotationIssues,
    sourceMixingIssues,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const { gltf, bytes } = await readGlb(args.glb);
  const result = {
    schema: 'bm-cii-layer-qc/report-v1',
    glb: path.basename(args.glb),
    bytes,
    supportSource: args.supportSource || '',
    ...inspect(gltf, args.supportSource),
  };

  const json = JSON.stringify(result, null, args.pretty ? 2 : 0);
  if (args.out) await fs.writeFile(args.out, `${json}\n`, 'utf8');
  else console.log(json);

  if (args.strict && !result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
