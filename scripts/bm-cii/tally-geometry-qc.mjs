#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

const COMPONENT_TYPE_BYTES = Object.freeze({
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
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

function usage() {
  return `Usage:
  node scripts/bm-cii/tally-geometry-qc.mjs \\
    --glb <output.glb> \\
    --sidecar <benchmark.sidecar.json> \\
    [--support-source inputxml|isonote] \\
    [--out <qc-report.json>] \\
    [--pretty] \\
    [--strict]

Purpose:
  BM_CII geometry tally QC gate.

Compares source/sidecar semantic inventory against the rendered GLB inventory:
  - piping/component records
  - pipe/bend/valve/flange/tee-olet rendered nodes
  - selected restraint/support source
  - support/restraint nodes even when source namespace contains ISONOTE
  - CAESAR annotation/callout nodes separately from ISONOTE support arrows
  - bounds/scale coherence between plant geometry and annotations

Exit code:
  0 = QC passed
  1 = QC failed when --strict is used
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
  if (buffer.length < 20) throw new Error('GLB too small.');
  const magic = readUInt32LE(buffer, 0);
  const version = readUInt32LE(buffer, 4);
  const length = readUInt32LE(buffer, 8);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected GLB v2.`);
  if (length !== buffer.length) throw new Error(`GLB header length ${length} != actual ${buffer.length}.`);

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
      json = JSON.parse(buffer.subarray(start, end).toString('utf8').replace(/\0+$/g, '').trim());
    } else {
      binBytes += chunkLength;
    }

    offset = end;
  }

  if (!json) throw new Error('Missing JSON chunk.');
  return { json, binBytes, chunks };
}

function countTriangles(primitive, gltf) {
  const mode = primitive.mode ?? TRIANGLES;
  let vertexCount = 0;

  if (primitive.indices !== undefined) {
    vertexCount = gltf.accessors?.[primitive.indices]?.count ?? 0;
  } else if (primitive.attributes?.POSITION !== undefined) {
    vertexCount = gltf.accessors?.[primitive.attributes.POSITION]?.count ?? 0;
  }

  if (mode === TRIANGLES) return Math.floor(vertexCount / 3);
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, vertexCount - 2);
  return 0;
}

function accessorByteSize(accessorIndex, gltf) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) return 0;

  const componentBytes = COMPONENT_TYPE_BYTES[accessor.componentType] ?? 0;
  const components = ACCESSOR_TYPE_COMPONENTS[accessor.type] ?? 0;
  return (accessor.count ?? 0) * componentBytes * components;
}

function primitiveAccessorBytes(primitive, gltf) {
  const ids = new Set();
  if (primitive.indices !== undefined) ids.add(primitive.indices);
  for (const value of Object.values(primitive.attributes || {})) ids.add(value);

  let bytes = 0;
  for (const id of ids) bytes += accessorByteSize(id, gltf);
  return bytes;
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function trsMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix.slice();

  const t = node.translation || [0, 0, 0];
  const s = node.scale || [1, 1, 1];
  const q = node.rotation || [0, 0, 0, 1];
  const [x, y, z, w] = q;

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function sceneRootNodes(gltf) {
  const sceneIndex = gltf.scene ?? 0;
  return gltf.scenes?.[sceneIndex]?.nodes || [];
}

function walkNodes(gltf, nodeIndex, parentWorld, rows) {
  const node = gltf.nodes?.[nodeIndex] || {};
  const world = multiply(parentWorld, trsMatrix(node));
  rows.push({ nodeIndex, node, world });
  for (const child of node.children || []) walkNodes(gltf, child, world, rows);
}

function flattenNodes(gltf) {
  const rows = [];
  for (const root of sceneRootNodes(gltf)) walkNodes(gltf, root, identity(), rows);
  return rows;
}

function cornersFromMinMax(min, max) {
  if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) return [];

  const out = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) out.push([x, y, z]);
    }
  }
  return out;
}

function mergeBounds(bounds, p) {
  if (!p) return bounds;
  if (!bounds) return { min: p.slice(), max: p.slice(), count: 1 };

  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], p[i]);
    bounds.max[i] = Math.max(bounds.max[i], p[i]);
  }
  bounds.count += 1;
  return bounds;
}

function formatBounds(bounds) {
  if (!bounds) return null;
  return {
    min: bounds.min.map((v) => Number(v.toFixed(9))),
    max: bounds.max.map((v) => Number(v.toFixed(9))),
    centroid: boundsCentroid(bounds).map((v) => Number(v.toFixed(9))),
    diagonal: Number(boundsDiagonal(bounds).toFixed(9)),
    maxAbs: Number(boundsMaxAbs(bounds).toFixed(9)),
    count: bounds.count,
  };
}

function boundsDiagonal(bounds) {
  if (!bounds) return 0;
  const dx = bounds.max[0] - bounds.min[0];
  const dy = bounds.max[1] - bounds.min[1];
  const dz = bounds.max[2] - bounds.min[2];
  return Math.hypot(dx, dy, dz);
}

function boundsCentroid(bounds) {
  if (!bounds) return [0, 0, 0];
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

function boundsMaxAbs(bounds) {
  if (!bounds) return 0;
  return Math.max(...bounds.min.map(Math.abs), ...bounds.max.map(Math.abs));
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function nodeName(row, gltf) {
  const node = row.node || {};
  const mesh = node.mesh !== undefined ? gltf.meshes?.[node.mesh] : null;
  return String(node.name || mesh?.name || `node_${row.nodeIndex}`);
}

function meshName(row, gltf) {
  const node = row.node || {};
  const mesh = node.mesh !== undefined ? gltf.meshes?.[node.mesh] : null;
  return String(mesh?.name || node.name || `mesh_${node.mesh ?? row.nodeIndex}`);
}

function isCaesarAnnotationName(n) {
  return /CAESAR[_-]?ANNOTATION|CAESAR-NODE-LABEL|NODE[_-]?(DISC|BUBBLE|LABEL)|ISONOTE[_-]?(DISC|CALLOUT)|CALLOUT/.test(n);
}

function isSupportOrRestraintName(n) {
  return /SUPPORT[_-]?ARROW|SUPPORT|RESTRAINT|HANGER|SPRING|LINESTOP|LINE_STOP|GUIDE|HOLDDOWN|HOLD_DOWN|LIMIT|UNKNOWN_TYPE0|UNKNOWN|ANCHOR|SHOE|REST(_|$)|REST[-_]?/.test(n);
}

function classifyNode(name) {
  const n = String(name || '').toUpperCase();

  if (/\bAXIS[_-]|AXIS_X|AXIS_Y|AXIS_Z/.test(n)) return 'axis';

  /*
   * Important ordering:
   * - CAESAR annotation/callout meshes are annotation.
   * - ISONOTE support-source arrows are still supports/restraints.
   *
   * The old classifier used generic ISONOTE matching first, so nodes such as
   * SUPPORT_ARROW_V7_ISONOTE_..._GUIDE were incorrectly tallied as annotation.
   */
  if (/CAESAR[_-]?ANNOTATION|CAESAR-NODE-LABEL/.test(n)) return 'annotation';
  if (isSupportOrRestraintName(n)) return 'support';
  if (isCaesarAnnotationName(n)) return 'annotation';

  if (/VALVE|_V[A-Z]{2}_|VGT|VGL|VBA|VCH/.test(n)) return 'valve';
  if (/FLANGE|FLG/.test(n)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(n)) return 'teeOlet';
  if (/BEND|ELBOW|ARC/.test(n)) return 'bend';
  if (/PIPE|PE_\d+/.test(n)) return 'pipe';

  return 'other';
}

function semanticTypeFromComponent(component) {
  const text = [
    component.type,
    component.elementType,
    component.componentType,
    component.typeDesc,
    component.description,
    component.name,
    component.id,
  ].map((v) => String(v || '')).join(' ').toUpperCase();

  if (/VALVE|_V[A-Z]{2}_|VGT|VGL|VBA|VCH/.test(text)) return 'valve';
  if (/FLANGE|FLG/.test(text)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(text)) return 'teeOlet';
  if (/BEND|ELBOW/.test(text)) return 'bend';
  if (/PIPE|RIGID|TRIM/.test(text)) return 'pipe';

  return 'other';
}

function countBy(items, fn) {
  const out = {};
  for (const item of items || []) {
    const key = fn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function selectedSupportRecords(sidecar, supportSource) {
  if (supportSource === 'isonote') return sidecar.supportsIsonote || sidecar.supportsISONOTE || [];
  return sidecar.supportsInputXml || sidecar.supportsInputXML || sidecar.supports || [];
}

function inferSupportSource(glbPath) {
  const name = path.basename(glbPath).toLowerCase();
  return name.includes('isonote') ? 'isonote' : 'inputxml';
}

function addPrimitiveBounds(row, primitive, gltf, categoryBounds, category) {
  const positionAccessorId = primitive.attributes?.POSITION;
  if (positionAccessorId === undefined) return;

  const accessor = gltf.accessors?.[positionAccessorId];
  if (!accessor?.min || !accessor?.max) return;

  for (const corner of cornersFromMinMax(accessor.min, accessor.max)) {
    const worldPoint = transformPoint(row.world, corner);
    categoryBounds[category] = mergeBounds(categoryBounds[category], worldPoint);
  }
}

function buildActualInventory(gltf) {
  const nodeRows = flattenNodes(gltf);

  const actual = {
    totalNodesInScene: nodeRows.length,
    geometryNodes: 0,
    meshPrimitives: 0,
    estimatedDrawCalls: 0,
    triangles: 0,
    accessorBytes: 0,
    byCategory: {},
    categoryTriangles: {},
    categoryAccessorBytes: {},
    categoryBounds: {},
    nodeRecords: [],
  };

  const rawBounds = {};

  for (const row of nodeRows) {
    const node = row.node || {};
    if (node.mesh === undefined) continue;

    const mesh = gltf.meshes?.[node.mesh];
    if (!mesh) continue;

    const displayName = `${nodeName(row, gltf)} ${meshName(row, gltf)}`;
    const category = classifyNode(displayName);
    const primitives = mesh.primitives || [];

    let nodeTriangles = 0;
    let nodeAccessorBytes = 0;
    for (const primitive of primitives) {
      const primitiveTriangles = countTriangles(primitive, gltf);
      const primitiveBytes = primitiveAccessorBytes(primitive, gltf);

      nodeTriangles += primitiveTriangles;
      nodeAccessorBytes += primitiveBytes;
      addPrimitiveBounds(row, primitive, gltf, rawBounds, category);
    }

    actual.geometryNodes += 1;
    actual.meshPrimitives += primitives.length;
    actual.estimatedDrawCalls += primitives.length;
    actual.triangles += nodeTriangles;
    actual.accessorBytes += nodeAccessorBytes;

    actual.byCategory[category] = (actual.byCategory[category] || 0) + 1;
    actual.categoryTriangles[category] = (actual.categoryTriangles[category] || 0) + nodeTriangles;
    actual.categoryAccessorBytes[category] = (actual.categoryAccessorBytes[category] || 0) + nodeAccessorBytes;

    actual.nodeRecords.push({
      nodeIndex: row.nodeIndex,
      nodeName: nodeName(row, gltf),
      meshName: meshName(row, gltf),
      category,
      primitives: primitives.length,
      triangles: nodeTriangles,
      accessorBytes: nodeAccessorBytes,
    });
  }

  for (const [category, bounds] of Object.entries(rawBounds)) {
    actual.categoryBounds[category] = formatBounds(bounds);
  }

  return actual;
}

function supportKind(record) {
  return String(record.kind || record.type || record.restraintType || record.rawType || 'UNKNOWN').toUpperCase();
}

function buildExpectedInventory(sidecar, supportSource) {
  const components = sidecar.components || [];
  const selectedSupports = selectedSupportRecords(sidecar, supportSource);
  const callouts = sidecar.caesarAnnotationCallouts || [];

  return {
    componentsTotal: components.length,
    componentsBySemanticType: countBy(components, semanticTypeFromComponent),
    pipeSemanticRecords: components.filter((c) => semanticTypeFromComponent(c) === 'pipe').length,
    bendTrimArcs: (sidecar.bendTrimArcs || []).length,
    teeOletTopologyRecords: (sidecar.teeOletTopology || []).length,
    selectedSupportSource: supportSource,
    supportRecordsTotal: selectedSupports.length,
    supportRecordsByKind: countBy(selectedSupports, supportKind),
    isonoteCallouts: callouts.length,
    calloutNodes: [...new Set(callouts.map((c) => String(c.node || c.nodeNumber || '')))].filter(Boolean).sort(),
  };
}

function mergeFormattedBounds(items) {
  const raw = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], count: 0 };
  let hit = false;

  for (const item of items || []) {
    if (!item) continue;
    for (let i = 0; i < 3; i += 1) {
      raw.min[i] = Math.min(raw.min[i], item.min[i]);
      raw.max[i] = Math.max(raw.max[i], item.max[i]);
    }
    raw.count += item.count || 1;
    hit = true;
  }

  return hit ? formatBounds(raw) : null;
}

function boundsCoherence(actual) {
  const plantCategories = ['pipe', 'bend', 'valve', 'flange', 'teeOlet', 'support', 'other'];
  const plantBounds = mergeFormattedBounds(plantCategories.map((c) => actual.categoryBounds[c]));
  const annotationBounds = actual.categoryBounds.annotation || null;

  if (!plantBounds || !annotationBounds) {
    return {
      ok: false,
      reason: 'Missing plant or annotation bounds.',
      plantBounds,
      annotationBounds,
    };
  }

  const plantDiagonal = plantBounds.diagonal;
  const annotationDiagonal = annotationBounds.diagonal;
  const annotationToPlantDiagonalRatio = plantDiagonal ? annotationDiagonal / plantDiagonal : Infinity;
  const centroidDistance = distance3(annotationBounds.centroid, plantBounds.centroid);
  const annotationCentroidDistanceToPlantDiagonalRatio = plantDiagonal ? centroidDistance / plantDiagonal : Infinity;
  const annotationMaxAbsToPlantMaxAbsRatio = plantBounds.maxAbs ? annotationBounds.maxAbs / plantBounds.maxAbs : Infinity;

  const gates = {
    plantDiagonalPositive: plantDiagonal > 0,
    annotationDiagonalPositive: annotationDiagonal > 0,
    annotationToPlantDiagonalRatioLe1p50: annotationToPlantDiagonalRatio <= 1.5,
    annotationCentroidDistanceLe1p25PlantDiagonal: annotationCentroidDistanceToPlantDiagonalRatio <= 1.25,
    annotationMaxAbsToPlantMaxAbsLe2: annotationMaxAbsToPlantMaxAbsRatio <= 2,
  };

  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    plantBounds,
    annotationBounds,
    annotationToPlantDiagonalRatio: Number(annotationToPlantDiagonalRatio.toFixed(9)),
    annotationCentroidDistance: Number(centroidDistance.toFixed(9)),
    annotationCentroidDistanceToPlantDiagonalRatio: Number(annotationCentroidDistanceToPlantDiagonalRatio.toFixed(9)),
    annotationMaxAbsToPlantMaxAbsRatio: Number(annotationMaxAbsToPlantMaxAbsRatio.toFixed(9)),
  };
}

function runQc(expected, actual) {
  const bounds = boundsCoherence(actual);
  const renderedPlantNodes =
    (actual.byCategory.pipe || 0) +
    (actual.byCategory.bend || 0) +
    (actual.byCategory.valve || 0) +
    (actual.byCategory.flange || 0) +
    (actual.byCategory.teeOlet || 0) +
    (actual.byCategory.support || 0) +
    (actual.byCategory.other || 0);

  const gates = {
    glbHasGeometry: actual.geometryNodes > 0 && actual.triangles > 0,
    sourceHasComponents: expected.componentsTotal > 0,
    renderedHasPlantGeometry: renderedPlantNodes > 0,
    renderedHasSelectedSupports: expected.supportRecordsTotal > 0 ? (actual.byCategory.support || 0) > 0 : true,
    renderedHasAnnotations: expected.isonoteCallouts > 0 ? (actual.byCategory.annotation || 0) > 0 : true,
    annotationNodeCountWithinBudget: (actual.byCategory.annotation || 0) <= 3,
    calloutCountStable: expected.isonoteCallouts === 4,
    boundsCoherent: bounds.ok,
  };

  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    boundsCoherence: bounds,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, '--help') || hasArg(args, '-h')) {
    console.log(usage());
    return;
  }

  const glbPath = argValue(args, '--glb');
  const sidecarPath = argValue(args, '--sidecar');
  const outPath = argValue(args, '--out');
  const pretty = hasArg(args, '--pretty');
  const strict = hasArg(args, '--strict');
  const supportSource = (argValue(args, '--support-source') || inferSupportSource(glbPath || '')).toLowerCase();

  if (!glbPath || !sidecarPath) {
    console.error(usage());
    throw new Error('Both --glb and --sidecar are required.');
  }

  if (!['inputxml', 'isonote'].includes(supportSource)) {
    throw new Error(`Invalid --support-source ${supportSource}; expected inputxml or isonote.`);
  }

  const glbBuffer = await fs.readFile(glbPath);
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  const { json: gltf, binBytes, chunks } = parseGlb(glbBuffer);

  const expected = buildExpectedInventory(sidecar, supportSource);
  const actual = buildActualInventory(gltf);
  const qc = runQc(expected, actual);

  const report = {
    schema: 'bm-cii-geometry-tally-qc/report-v2',
    createdAtUtc: new Date().toISOString(),
    glb: path.basename(glbPath),
    sidecar: path.basename(sidecarPath),
    supportSource,
    glbFile: {
      bytes: glbBuffer.length,
      kib: Number((glbBuffer.length / 1024).toFixed(3)),
      sha256: crypto.createHash('sha256').update(glbBuffer).digest('hex'),
      binBytes,
      chunkCount: chunks.length,
      asset: gltf.asset || {},
    },
    expected,
    actual,
    qc,
  };

  const text = JSON.stringify(report, null, pretty ? 2 : 0);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${text}\n`, 'utf8');
  } else {
    console.log(text);
  }

  if (strict && !qc.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`BM_CII geometry tally QC failed: ${err.message}`);
  process.exitCode = 1;
});
