#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

const COMPONENT_TYPE_BYTES = Object.freeze({
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
});

const ACCESSOR_TYPE_COMPONENTS = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
});

const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

function usage() {
  return `Usage:
  node scripts/bm-cii/inspect-glb.mjs --glb <file.glb> [--out <report.json>] [--pretty]

Purpose:
  Static BM_CII GLB inspection for budget checks.

Reports:
  file size, SHA256, glTF counts, estimated draw calls, triangles,
  annotation nodes, annotation triangle share, and annotation accessor bytes.
`;
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  return args[idx + 1] ?? null;
}

function hasArg(args, name) {
  return args.includes(name);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function parseGlb(buffer) {
  if (buffer.length < 12) throw new Error('GLB too small: missing header.');
  const magic = readUInt32LE(buffer, 0);
  const version = readUInt32LE(buffer, 4);
  const length = readUInt32LE(buffer, 8);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB magic. Expected glTF binary magic.');
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected 2.`);
  if (length !== buffer.length) throw new Error(`GLB header length ${length} does not match file length ${buffer.length}.`);

  let offset = 12;
  let json = null;
  let binBytes = 0;
  const chunks = [];
  while (offset + 8 <= buffer.length) {
    const chunkLength = readUInt32LE(buffer, offset);
    const chunkType = readUInt32LE(buffer, offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > buffer.length) throw new Error('GLB chunk extends beyond file length.');
    chunks.push({ chunkType, chunkLength, start, end });
    if (chunkType === GLB_JSON_CHUNK) {
      const jsonText = buffer.subarray(start, end).toString('utf8').replace(/\u0000+$/g, '').trim();
      json = JSON.parse(jsonText);
    } else if (chunkType === GLB_BIN_CHUNK) {
      binBytes += chunkLength;
    }
    offset = end;
  }
  if (!json) throw new Error('GLB is missing JSON chunk.');
  return { json, binBytes, chunks };
}

function basename(value) {
  return path.basename(String(value || ''));
}

function upper(value) {
  return String(value ?? '').toUpperCase();
}

function nodeName(gltf, nodeIndex) {
  const node = gltf.nodes?.[nodeIndex];
  return node?.name || `node_${nodeIndex}`;
}

function meshName(gltf, meshIndex) {
  const mesh = gltf.meshes?.[meshIndex];
  return mesh?.name || `mesh_${meshIndex}`;
}

function materialName(gltf, materialIndex) {
  if (materialIndex === undefined || materialIndex === null || materialIndex < 0) return '__DEFAULT_MATERIAL__';
  return gltf.materials?.[materialIndex]?.name || `material_${materialIndex}`;
}

function isAnnotationName(name) {
  const n = upper(name);
  return [
    'CAESAR_ANNOTATION',
    'CAESAR-ANNOTATION',
    'CAESAR-ISONOTE',
    'ISONOTE',
    'CALLOUT',
    'NODE_DISC',
    'NODE-LABEL',
    'NODE_LABEL',
    'ANNOTATION_DISC',
  ].some((token) => n.includes(token));
}

function isSupportName(name) {
  const n = upper(name);
  return ['SUPPORT', 'RESTRAINT', 'HANGER', 'ANCHOR', 'GUIDE', 'LINESTOP'].some((token) => n.includes(token));
}

function accessorComponentBytes(accessor) {
  const bytes = COMPONENT_TYPE_BYTES[accessor?.componentType];
  if (!bytes) return 0;
  const comps = ACCESSOR_TYPE_COMPONENTS[accessor?.type] || 1;
  return (accessor?.count || 0) * bytes * comps;
}

function accessorByteLength(gltf, accessorIndex) {
  if (accessorIndex === undefined || accessorIndex === null || accessorIndex < 0) return 0;
  const accessor = gltf.accessors?.[accessorIndex];
  return accessorComponentBytes(accessor);
}

function primitiveTriangleCount(gltf, primitive) {
  const mode = primitive.mode ?? TRIANGLES;
  if (primitive.indices !== undefined) {
    const count = gltf.accessors?.[primitive.indices]?.count || 0;
    if (mode === TRIANGLES) return Math.floor(count / 3);
    if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, count - 2);
    return 0;
  }
  const positionAccessorIndex = primitive.attributes?.POSITION;
  const count = gltf.accessors?.[positionAccessorIndex]?.count || 0;
  if (mode === TRIANGLES) return Math.floor(count / 3);
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, count - 2);
  return 0;
}

function primitiveAccessorBytes(gltf, primitive) {
  const accessors = new Set();
  if (primitive.indices !== undefined) accessors.add(primitive.indices);
  for (const accessorIndex of Object.values(primitive.attributes || {})) accessors.add(accessorIndex);
  let bytes = 0;
  for (const accessorIndex of accessors) bytes += accessorByteLength(gltf, accessorIndex);
  return bytes;
}

function collectUsedExtensionNames(gltf) {
  const set = new Set();
  for (const ext of gltf.extensionsUsed || []) set.add(ext);
  for (const ext of gltf.extensionsRequired || []) set.add(ext);
  return [...set].sort();
}

function materialStats(gltf) {
  const materials = gltf.materials || [];
  const explicit = materials.length;
  const unlit = materials.filter((m) => m.extensions?.KHR_materials_unlit).length;
  const doubleSided = materials.filter((m) => m.doubleSided === true).length;
  const defaultMaterialUsed = (gltf.meshes || []).some((mesh) =>
    (mesh.primitives || []).some((primitive) => primitive.material === undefined || primitive.material === null)
  );
  return { explicit, unlit, doubleSided, defaultMaterialUsed };
}

function primitiveRecords(gltf) {
  const records = [];
  const nodes = gltf.nodes || [];
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node.mesh === undefined || node.mesh === null) continue;
    const mesh = gltf.meshes?.[node.mesh];
    if (!mesh) continue;
    const nName = nodeName(gltf, nodeIndex);
    const mName = meshName(gltf, node.mesh);
    const annotation = isAnnotationName(nName) || isAnnotationName(mName);
    const support = isSupportName(nName) || isSupportName(mName);
    for (let primitiveIndex = 0; primitiveIndex < (mesh.primitives || []).length; primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex];
      records.push({
        nodeIndex,
        nodeName: nName,
        meshIndex: node.mesh,
        meshName: mName,
        primitiveIndex,
        material: materialName(gltf, primitive.material),
        mode: primitive.mode ?? TRIANGLES,
        triangles: primitiveTriangleCount(gltf, primitive),
        accessorBytes: primitiveAccessorBytes(gltf, primitive),
        annotation,
        support,
      });
    }
  }
  return records;
}

function sum(records, key) {
  return records.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

function groupBy(records, keyFn) {
  const out = {};
  for (const item of records) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function inspectGltf({ gltf, binBytes, filePath, fileBytes }) {
  const records = primitiveRecords(gltf);
  const annotationRecords = records.filter((record) => record.annotation);
  const supportRecords = records.filter((record) => record.support);
  const totalTriangles = sum(records, 'triangles');
  const annotationTriangles = sum(annotationRecords, 'triangles');
  const totalAccessorBytes = sum(records, 'accessorBytes');
  const annotationAccessorBytes = sum(annotationRecords, 'accessorBytes');

  const annotationNodeNames = [...new Set(annotationRecords.map((r) => r.nodeName))].sort();
  const supportNodeNames = [...new Set(supportRecords.map((r) => r.nodeName))].sort();

  return {
    schema: 'bm-cii-glb-inspection/v1',
    inspectedAtUtc: new Date().toISOString(),
    file: basename(filePath),
    filePath,
    sha256: crypto.createHash('sha256').update(fileBytes).digest('hex'),
    fileBytes: fileBytes.length,
    fileKb: Number((fileBytes.length / 1024).toFixed(1)),
    glb: {
      binBytes,
      jsonAssetVersion: gltf.asset?.version || null,
      generator: gltf.asset?.generator || null,
      extensions: collectUsedExtensionNames(gltf),
    },
    counts: {
      scenes: gltf.scenes?.length || 0,
      nodes: gltf.nodes?.length || 0,
      meshes: gltf.meshes?.length || 0,
      primitives: records.length,
      estimatedDrawCalls: records.length,
      materials: gltf.materials?.length || 0,
      textures: gltf.textures?.length || 0,
      images: gltf.images?.length || 0,
      accessors: gltf.accessors?.length || 0,
      bufferViews: gltf.bufferViews?.length || 0,
      buffers: gltf.buffers?.length || 0,
    },
    materials: materialStats(gltf),
    triangles: {
      total: totalTriangles,
      annotation: annotationTriangles,
      support: sum(supportRecords, 'triangles'),
      annotationShare: totalTriangles ? Number((annotationTriangles / totalTriangles).toFixed(4)) : 0,
      annotationSharePct: totalTriangles ? Number(((annotationTriangles / totalTriangles) * 100).toFixed(2)) : 0,
    },
    accessorBytes: {
      totalReferenced: totalAccessorBytes,
      annotation: annotationAccessorBytes,
      annotationShare: totalAccessorBytes ? Number((annotationAccessorBytes / totalAccessorBytes).toFixed(4)) : 0,
      annotationSharePct: totalAccessorBytes ? Number(((annotationAccessorBytes / totalAccessorBytes) * 100).toFixed(2)) : 0,
    },
    annotations: {
      nodeCount: annotationNodeNames.length,
      nodes: annotationNodeNames,
      primitiveCount: annotationRecords.length,
      materialCounts: groupBy(annotationRecords, (r) => r.material),
    },
    supports: {
      nodeCount: supportNodeNames.length,
      nodes: supportNodeNames,
      primitiveCount: supportRecords.length,
    },
    primitiveRecords: records,
  };
}

export async function inspectGlb(filePath) {
  const fileBytes = await fs.readFile(filePath);
  const { json: gltf, binBytes } = parseGlb(fileBytes);
  return inspectGltf({ gltf, binBytes, filePath, fileBytes });
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, '--help') || hasArg(args, '-h')) {
    console.log(usage());
    return;
  }
  const glb = argValue(args, '--glb') || args[0];
  if (!glb) throw new Error(`Missing --glb argument.\n${usage()}`);
  const out = argValue(args, '--out');
  const pretty = hasArg(args, '--pretty') || Boolean(out);
  const report = await inspectGlb(path.resolve(glb));
  const json = JSON.stringify(report, null, pretty ? 2 : 0);
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, `${json}\n`, 'utf8');
  } else {
    console.log(json);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
