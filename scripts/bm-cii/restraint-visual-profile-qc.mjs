#!/usr/bin/env node
/**
 * BM_CII restraint visual profile QC gate.
 *
 * This is intentionally stricter than generic layer QC. It fails when support
 * meshes are layer-toggleable but not stamped with the agreed engineering
 * visual profile contract.
 *
 * This gate is deliberately not satisfied by layer metadata alone. A support
 * node must also carry a renderGlyph and renderScale so a metadata-only GLB
 * cannot mask missing/weak baked or runtime restraint symbols.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  RESTRAINT_VISUAL_PROFILE,
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
} from '../../viewer/js/pcf2glb/glb/RestraintVisualProfile.js';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/bm-cii/restraint-visual-profile-qc.mjs \
    --glb <file.glb> \
    --support-source inputxml|isonote \
    --out <report.json> \
    --strict

Checks:
  1. Every rendered support/restraint node has bmCiiLayer.
  2. Support source layer matches --support-source.
  3. Support kind normalizes to the shared restraint visual profile contract.
  4. Directional support kinds carry X/Y/Z axis where available/required.
  5. Support layer or trace declares profile v4-engineering-readable.
  6. Support trace/metadata declares renderGlyph and renderScale.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { strict: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') usage(0);
    if (token === '--strict') { args.strict = true; continue; }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    i += 1;
  }
  if (!args.glb) throw new Error('Missing required --glb');
  args.supportSource = String(args.supportSource || '').toLowerCase();
  if (!['inputxml', 'isonote'].includes(args.supportSource)) throw new Error('Missing/invalid --support-source inputxml|isonote');
  return args;
}

function readGlbJson(glbPath) {
  const buffer = fs.readFileSync(glbPath);
  if (buffer.length < 20) throw new Error(`${glbPath}: GLB is too small.`);
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  if (magic !== GLB_MAGIC) throw new Error(`${glbPath}: invalid GLB magic.`);
  if (version !== 2) throw new Error(`${glbPath}: expected GLB v2, got ${version}.`);
  if (length !== buffer.length) throw new Error(`${glbPath}: header length ${length} != actual ${buffer.length}.`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === CHUNK_JSON) {
      const text = chunk.toString('utf8').replace(/[\u0000\s]+$/g, '');
      return {
        json: JSON.parse(text),
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        bytes: buffer.length,
      };
    }
  }
  throw new Error(`${glbPath}: missing JSON chunk.`);
}

function walkNodes(gltf) {
  const nodes = gltf.nodes || [];
  const rows = [];
  const visit = (nodeIndex, inherited = {}) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    const extras = node.extras || {};
    const trace = extras.bmCiiTrace || inherited.trace || null;
    const layer = extras.bmCiiLayer || inherited.layer || null;
    const profile = extras.bmCiiRestraintVisualProfile || inherited.profile || null;
    if (node.mesh !== undefined) rows.push({ nodeIndex, nodeName: node.name || `node_${nodeIndex}`, trace, layer, profile, extras });
    for (const child of node.children || []) visit(child, { trace, layer, profile });
  };
  const children = new Set();
  for (const node of nodes) for (const child of node.children || []) children.add(child);
  nodes.forEach((_, index) => { if (!children.has(index)) visit(index); });
  return rows;
}

function isSupport(row) {
  const layerIds = row.layer?.layerIds || [];
  return row.layer?.category === 'support'
    || row.trace?.entity === 'support'
    || layerIds.includes('plant.restraints');
}

function supportRecord(row) {
  const trace = row.trace || {};
  const layer = row.layer || {};
  const profileMeta = row.profile || row.extras.bmCiiRestraintVisualProfile || {};
  const kind = normalizeRestraintKind(trace.supportKind || trace.kind || layer.supportKind || profileMeta.kind || row.extras.supportKind || '');
  const axis = normalizeRestraintAxisLabel(trace.axis || trace.direction || trace.restraintAxis || layer.axis || profileMeta.axis || row.extras.restraintAxis || '');
  const sourceRaw = String(trace.supportSource || trace.source || layer.source || profileMeta.source || row.extras.supportSource || '').toLowerCase();
  const source = sourceRaw.includes('isonote') ? 'isonote' : sourceRaw.includes('inputxml') ? 'inputxml' : sourceRaw;
  const profile = trace.visualProfile
    || trace.glbSupportVisualProfile
    || trace.renderProfile
    || layer.restraintVisualProfile
    || layer.visualProfile
    || row.extras.glbSupportVisualProfile
    || profileMeta.profile
    || '';
  const renderGlyph = trace.renderGlyph || trace.glyph || profileMeta.role || row.extras.renderGlyph || '';
  const renderScaleRaw = trace.renderScale ?? profileMeta.renderScale ?? row.extras.renderScale;
  const renderScale = Number(renderScaleRaw);
  return {
    nodeName: row.nodeName,
    source,
    kind,
    axis,
    profile,
    renderGlyph,
    renderScale: Number.isFinite(renderScale) && renderScale > 0 ? renderScale : null,
    layerIds: layer.layerIds || [],
  };
}

function run(glbPath, expectedSource) {
  const { json: gltf, sha256, bytes } = readGlbJson(glbPath);
  const supportRows = walkNodes(gltf).filter(isSupport).map(supportRecord);
  const validKinds = new Set([...RESTRAINT_VISUAL_PROFILE.requiredKinds, 'SHOE', 'HOLDDOWN']);
  const directional = new Set(RESTRAINT_VISUAL_PROFILE.directionalKinds);
  const wrongSource = supportRows.filter(r => r.source && r.source !== expectedSource);
  const invalidKind = supportRows.filter(r => !validKinds.has(r.kind));
  const missingProfile = supportRows.filter(r => r.profile !== RESTRAINT_VISUAL_PROFILE.id);
  const missingSubtypeLayer = supportRows.filter(r => !r.layerIds.includes(`restraints.${String(r.kind || 'unknown').toLowerCase()}`));
  const missingSourceLayer = supportRows.filter(r => !r.layerIds.includes(`restraints.${expectedSource}`));
  const missingAxis = supportRows.filter(r => directional.has(r.kind) && !r.axis);
  const missingGlyph = supportRows.filter(r => !r.renderGlyph);
  const missingReadableScale = supportRows.filter(r => r.renderScale === null);
  const supportKindCounts = supportRows.reduce((acc, r) => {
    acc[r.kind || ''] = (acc[r.kind || ''] || 0) + 1;
    return acc;
  }, {});
  const gates = {
    hasSupportRows: supportRows.length > 0,
    selectedSourceOnly: wrongSource.length === 0,
    validKindsOnly: invalidKind.length === 0,
    visualProfileStamped: missingProfile.length === 0,
    sourceLayerStamped: missingSourceLayer.length === 0,
    subtypeLayerStamped: missingSubtypeLayer.length === 0,
    directionalKindsCarryAxis: missingAxis.length === 0,
    renderGlyphStamped: missingGlyph.length === 0,
    readableScaleStamped: missingReadableScale.length === 0,
  };
  return {
    schema: 'bm-cii-restraint-visual-profile-qc/v2',
    createdAtUtc: new Date().toISOString(),
    file: path.basename(glbPath),
    sha256,
    bytes,
    expectedSource,
    expectedProfile: RESTRAINT_VISUAL_PROFILE.id,
    supportRows,
    supportKindCounts,
    failures: {
      wrongSource,
      invalidKind,
      missingProfile,
      missingSubtypeLayer,
      missingSourceLayer,
      missingAxis,
      missingGlyph,
      missingReadableScale,
    },
    gates,
    ok: Object.values(gates).every(Boolean),
    failedGates: Object.entries(gates).filter(([, ok]) => !ok).map(([name]) => name),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const report = run(args.glb, args.supportSource);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (args.strict && !report.ok) {
    console.error(`[bm-cii-restraint-visual-profile-qc] FAIL: ${report.failedGates.join(', ')}`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[bm-cii-restraint-visual-profile-qc] ${error.message}`);
  process.exit(1);
}
