#!/usr/bin/env node
/**
 * BM_CII bend / elbow record benchmark QC.
 *
 * This is a record-identity benchmark, not a category-count check. It exists
 * because bend geometry can look visually acceptable while source bend records,
 * bend trim arcs, or rendered elbow nodes are missing/duplicated.
 *
 * Hard goals:
 *   - Build expected bend records from sidecar.bendTrimArcs first.
 *   - Fallback to sidecar components that look like BEND/ELBOW/ARC only if no
 *     bendTrimArcs are present.
 *   - Count only rendered bend roots, not every child primitive or decorative arc.
 *   - Fail orphan bend-like GLB nodes that have no trace/record identity.
 *   - Fail missing/extra expected record ids.
 */

import fs from 'node:fs';
import path from 'node:path';

const TRIANGLES_MODE = 4;
const JSON_CHUNK = 0x4e4f534a;

function usage() {
  return `Usage:
  node scripts/bm-cii/bend-record-benchmark-qc.mjs \
    --glb <file.glb> \
    --sidecar <sidecar.json> \
    --out <report.json> \
    [--pretty] [--strict]
`;
}

function argValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readGlbJson(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 20) throw new Error(`GLB too small: ${file}`);
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  if (magic !== 0x46546c67) throw new Error(`Invalid GLB magic: ${file}`);
  if (version !== 2) throw new Error(`Expected GLB v2, got ${version}: ${file}`);
  if (length !== buffer.length) throw new Error(`GLB header length mismatch: ${file}`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === JSON_CHUNK) {
      return JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/u, ''));
    }
  }
  throw new Error(`Missing JSON chunk: ${file}`);
}

function upper(value) {
  return String(value ?? '').toUpperCase();
}

function first(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function isBendText(text) {
  return /\b(BEND|ELBOW|ELB|ARC)\b|BEND_|ELBOW_|_ARC_/i.test(String(text || ''));
}

function componentText(component = {}) {
  return [
    component.id,
    component.name,
    component.type,
    component.componentType,
    component.typeDesc,
    component.description,
    component.tag,
    component.shape,
  ].filter(Boolean).join(' ');
}

function stableRecordId(prefix, index, raw = {}) {
  const sourceId = first(raw.id, raw.recordId, raw.componentId, raw.sourceComponentId, raw.refNo, raw.componentRefNo, raw.node, raw.fromNode);
  return `${prefix}:${index + 1}:${String(sourceId || 'record').replace(/\s+/g, '_')}`;
}

function expectedBendRecords(sidecar) {
  const arcs = Array.isArray(sidecar.bendTrimArcs) ? sidecar.bendTrimArcs : [];
  if (arcs.length) {
    return arcs.map((arc, index) => ({
      recordId: first(arc.recordId, arc.bendRecordId, arc.id) || stableRecordId('bendArc', index, arc),
      source: 'bendTrimArcs',
      index: index + 1,
      fromNode: String(first(arc.fromNode, arc.startNode, arc.node1, arc.n1)),
      toNode: String(first(arc.toNode, arc.endNode, arc.node2, arc.n2)),
      centerNode: String(first(arc.node, arc.centerNode, arc.bendNode, arc.apexNode)),
      radius: Number(first(arc.radius, arc.radiusMm, arc.bendRadius, arc.bendRadiusMm)) || null,
      angleDeg: Number(first(arc.angleDeg, arc.angle, arc.bendAngleDeg, arc.sweepDeg)) || null,
      contract: 'bend-trim-arc-record',
    }));
  }

  const components = Array.isArray(sidecar.components) ? sidecar.components : [];
  return components
    .map((component, originalIndex) => ({ component, originalIndex }))
    .filter(({ component }) => isBendText(componentText(component)))
    .map(({ component, originalIndex }, index) => ({
      recordId: first(component.recordId, component.id, component.componentId, component.sourceComponentId) || stableRecordId('bendComponent', index, component),
      source: 'components',
      index: index + 1,
      componentIndex: originalIndex,
      fromNode: String(first(component.fromNode, component.startNode, component.node1)),
      toNode: String(first(component.toNode, component.endNode, component.node2)),
      centerNode: String(first(component.node, component.centerNode, component.bendNode)),
      radius: Number(first(component.radius, component.radiusMm, component.bendRadius, component.bendRadiusMm)) || null,
      angleDeg: Number(first(component.angleDeg, component.angle, component.bendAngleDeg, component.sweepDeg)) || null,
      contract: 'bend-component-record',
    }));
}

function nodeTrace(node = {}) {
  const extras = node.extras || node.userData || {};
  return extras.bmCiiTrace || extras.bmCiiGeometryTrace || extras.geometryTrace || {};
}

function nodeLayer(node = {}) {
  const extras = node.extras || node.userData || {};
  return extras.bmCiiLayer || {};
}

function primitiveTriangles(gltf, primitive = {}) {
  const mode = primitive.mode ?? TRIANGLES_MODE;
  if (mode !== TRIANGLES_MODE) return 0;
  if (primitive.indices !== undefined && gltf.accessors?.[primitive.indices]) {
    return Math.floor((gltf.accessors[primitive.indices].count || 0) / 3);
  }
  const pos = primitive.attributes?.POSITION;
  if (pos !== undefined && gltf.accessors?.[pos]) return Math.floor((gltf.accessors[pos].count || 0) / 3);
  return 0;
}

function nodeTriangles(gltf, node = {}) {
  if (node.mesh === undefined || !gltf.meshes?.[node.mesh]) return 0;
  return (gltf.meshes[node.mesh].primitives || []).reduce((sum, primitive) => sum + primitiveTriangles(gltf, primitive), 0);
}

function renderedBendRecords(gltf) {
  const nodes = gltf.nodes || [];
  const meshes = gltf.meshes || [];
  const actual = [];
  const orphans = [];
  const childParts = [];

  nodes.forEach((node, nodeIndex) => {
    if (node.mesh === undefined) return;
    const mesh = meshes[node.mesh] || {};
    const nameText = `${node.name || ''} ${mesh.name || ''}`;
    const trace = nodeTrace(node);
    const layer = nodeLayer(node);
    const category = upper(first(trace.semanticCategory, trace.category, layer.category));
    const entity = upper(trace.entity);
    const isBendByTrace = entity === 'BEND' || category === 'BEND' || category === 'ELBOW';
    const isBendByName = isBendText(nameText);
    const isPart = trace.entity === 'bendPart' || trace.bendPart === true || /BEND_PART|ELBOW_PART|ARC_PART/i.test(nameText);

    if (!isBendByTrace && !isBendByName) return;

    const recordId = first(trace.recordId, trace.bendRecordId, trace.sourceComponentId, trace.componentId, trace.traceKey);
    const record = {
      nodeIndex,
      nodeName: node.name || `node_${nodeIndex}`,
      meshName: mesh.name || `mesh_${node.mesh}`,
      recordId: String(recordId || ''),
      entity: trace.entity || '',
      semanticCategory: first(trace.semanticCategory, trace.category, layer.category),
      fromNode: String(first(trace.fromNode, trace.sourceFromNode)),
      toNode: String(first(trace.toNode, trace.sourceToNode)),
      centerNode: String(first(trace.node, trace.centerNode, trace.bendNode)),
      contract: first(trace.bendContract, trace.supportSymbolContract, trace.geometryContract, trace.contract),
      triangles: nodeTriangles(gltf, node),
    };

    if (isPart) {
      childParts.push(record);
    } else if (record.recordId) {
      actual.push(record);
    } else {
      orphans.push(record);
    }
  });

  return { actual, orphans, childParts };
}

function compareExpectedActual(expected, actual) {
  const expectedIds = new Set(expected.map((record) => String(record.recordId)));
  const actualIds = new Set(actual.map((record) => String(record.recordId)));
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const extra = [...actualIds].filter((id) => !expectedIds.has(id));
  const duplicateIds = [...actualIds].filter((id) => actual.filter((record) => String(record.recordId) === id).length > 1);
  return { missing, extra, duplicateIds: [...new Set(duplicateIds)] };
}

function main() {
  const args = process.argv.slice(2);
  const glbFile = argValue(args, '--glb');
  const sidecarFile = argValue(args, '--sidecar');
  const outFile = argValue(args, '--out');
  const pretty = args.includes('--pretty');
  const strict = args.includes('--strict');

  if (!glbFile || !sidecarFile) {
    console.error(usage());
    process.exit(2);
  }

  const sidecar = readJson(sidecarFile);
  const gltf = readGlbJson(glbFile);
  const expected = expectedBendRecords(sidecar);
  const { actual, orphans, childParts } = renderedBendRecords(gltf);
  const identity = compareExpectedActual(expected, actual);

  const gates = {
    sourceHasBendRecords: expected.length > 0,
    actualBendGlyphRootCountMatchesExpected: actual.length === expected.length,
    noOrphanBendLikeGeometry: orphans.length === 0,
    noDuplicateBendRecordIds: identity.duplicateIds.length === 0,
    noMissingBendRecordIds: identity.missing.length === 0,
    noUnexpectedBendRecordIds: identity.extra.length === 0,
  };

  const report = {
    schema: 'bm-cii-bend-record-benchmark-qc/v1',
    createdAtUtc: new Date().toISOString(),
    glb: path.basename(glbFile),
    sidecar: path.basename(sidecarFile),
    ok: Object.values(gates).every(Boolean),
    gates,
    summary: {
      expectedBendRecords: expected.length,
      renderedBendGlyphRoots: actual.length,
      orphanBendLikeGeometry: orphans.length,
      bendChildParts: childParts.length,
      missingRecordIds: identity.missing.length,
      unexpectedRecordIds: identity.extra.length,
      duplicateRecordIds: identity.duplicateIds.length,
    },
    expected,
    actual,
    orphans,
    childParts,
    identity,
  };

  const json = JSON.stringify(report, null, pretty ? 2 : 0);
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, json + '\n');
  } else {
    console.log(json);
  }

  if (strict && !report.ok) process.exit(1);
}

main();
