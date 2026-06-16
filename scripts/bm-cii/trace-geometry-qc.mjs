#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

const BM_CII_GEOMETRY_TRACE_SCHEMA = 'bm-cii-geometry-trace/v1';

function usage() {
  return `Usage:
  node scripts/bm-cii/trace-geometry-qc.mjs \
    --glb <output.glb> \
    --sidecar <benchmark.sidecar.json> \
    [--support-source inputxml|isonote] \
    [--min-trace-coverage 0.90] \
    [--out <trace-qc-report.json>] \
    [--pretty] \
    [--strict]

Purpose:
  BM_CII identity-level geometry trace QC gate.

This is stricter than category tally QC. It verifies that rendered GLB nodes carry
BM_CII trace metadata and that expected source identities can be matched to GLB
component/support/annotation traces.

Exit code:
  0 = QC passed
  1 = QC failed when --strict is used
`;
}

function argValue(args, name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx < 0) return fallback;
  return args[idx + 1] ?? fallback;
}

function hasArg(args, name) {
  return args.includes(name);
}

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const out = text(value);
    if (out) return out;
  }
  return '';
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
  if (primitive.indices !== undefined) vertexCount = gltf.accessors?.[primitive.indices]?.count ?? 0;
  else if (primitive.attributes?.POSITION !== undefined) vertexCount = gltf.accessors?.[primitive.attributes.POSITION]?.count ?? 0;
  if (mode === TRIANGLES) return Math.floor(vertexCount / 3);
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, vertexCount - 2);
  return 0;
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

function extractTraceFromExtras(extras = {}) {
  const trace = extras?.bmCiiTrace;
  if (trace && typeof trace === 'object') return trace;
  if (extras?.bmCiiTraceSchema === BM_CII_GEOMETRY_TRACE_SCHEMA) {
    return {
      schema: BM_CII_GEOMETRY_TRACE_SCHEMA,
      entity: extras.bmCiiTraceEntity || '',
      traceKey: extras.bmCiiTraceKey || '',
      semanticCategory: extras.bmCiiTraceCategory || '',
      sourceComponentId: extras.sourceComponentId || '',
      node: extras.sourceNode || '',
      fromNode: extras.sourceFromNode || '',
      toNode: extras.sourceToNode || '',
      supportSource: extras.supportSource || '',
      supportKind: extras.supportKind || '',
    };
  }
  return null;
}

function inheritedTrace(parentTrace, ownTrace) {
  return ownTrace || parentTrace || null;
}

function walkNodes(gltf, nodeIndex, parentWorld, parentTrace, rows) {
  const node = gltf.nodes?.[nodeIndex] || {};
  const world = multiply(parentWorld, trsMatrix(node));
  const trace = inheritedTrace(parentTrace, extractTraceFromExtras(node.extras || {}));
  rows.push({ nodeIndex, node, world, trace });
  for (const child of node.children || []) walkNodes(gltf, child, world, trace, rows);
}

function flattenNodes(gltf) {
  const rows = [];
  for (const root of sceneRootNodes(gltf)) walkNodes(gltf, root, identity(), null, rows);
  return rows;
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

function traceCategory(trace = {}) {
  return trace.semanticCategory || trace.category || trace.bmCiiTraceCategory || '';
}

function traceEntity(trace = {}) {
  return trace.entity || trace.bmCiiTraceEntity || '';
}

function classifyFallback(name) {
  const n = upper(name);
  if (/CAESAR[_-]?ANNOTATION|CAESAR-NODE-LABEL|CALLOUT/.test(n)) return 'annotation';
  if (/SUPPORT|RESTRAINT|GUIDE|LINESTOP|LINE_STOP|HANGER|SPRING|ANCHOR|SHOE|REST/.test(n)) return 'support';
  if (/VALVE|VGT|VGL|VBA|VCH/.test(n)) return 'valve';
  if (/FLANGE|FLG/.test(n)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(n)) return 'teeOlet';
  if (/BEND|ELBOW|ARC/.test(n)) return 'bend';
  if (/PIPE|PE_\d+/.test(n)) return 'pipe';
  if (/AXIS/.test(n)) return 'axis';
  return 'other';
}

function categoryForRow(row, gltf) {
  const tracedCategory = traceCategory(row.trace || {});
  if (tracedCategory) return tracedCategory;
  return classifyFallback(`${nodeName(row, gltf)} ${meshName(row, gltf)}`);
}

function semanticTypeFromComponent(component = {}) {
  const raw = upper([
    component.type,
    component.elementType,
    component.componentType,
    component.typeDesc,
    component.description,
    component.name,
    component.id,
  ].join(' '));
  if (/SUPPORT|RESTRAINT|GUIDE|LINESTOP|LINE STOP|HANGER|SPRING|ANCHOR|SHOE|REST/.test(raw)) return 'support';
  if (/VALVE|VGT|VGL|VBA|VCH/.test(raw)) return 'valve';
  if (/FLANGE|FLG/.test(raw)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(raw)) return 'teeOlet';
  if (/BEND|ELBOW|ELB/.test(raw)) return 'bend';
  if (/PIPE|RIGID|TRIM/.test(raw)) return 'pipe';
  return 'other';
}

function componentId(component = {}) {
  const attrs = { ...(component.raw || {}), ...(component.attributes || {}) };
  return firstNonEmpty(component.id, component.refNo, attrs.COMPONENT_IDENTIFIER, attrs['COMPONENT-IDENTIFIER'], attrs['COMPONENT-ATTRIBUTE97']);
}

function componentKey(component = {}) {
  const attrs = { ...(component.raw || {}), ...(component.attributes || {}) };
  const category = semanticTypeFromComponent(component);
  const fromNode = firstNonEmpty(component.fromNode, component.from, component.node1, attrs.FROM_NODE, attrs.FromNode, attrs.NODE1, component.node);
  const toNode = firstNonEmpty(component.toNode, component.to, component.node2, attrs.TO_NODE, attrs.ToNode, attrs.NODE2, component.node);
  return ['component', category, componentId(component) || 'NO_ID', fromNode || '', toNode || ''].join('|');
}

function calloutsFromSidecar(sidecar = {}) {
  return sidecar.caesarAnnotationCallouts || sidecar.callouts || sidecar.sidecars?.[0]?.callouts || [];
}

function selectedSupportRecords(sidecar, supportSource) {
  if (supportSource === 'isonote') return sidecar.supportsIsonote || sidecar.supportsISONOTE || [];
  return sidecar.supportsInputXml || sidecar.supportsInputXML || sidecar.supports || [];
}

function supportKind(record = {}) {
  return upper(firstNonEmpty(record.kind, record.type, record.restraintType, record.rawType, record.supportKind, 'UNKNOWN'));
}

function supportNode(record = {}) {
  return firstNonEmpty(record.node, record.nodeNumber, record.psNode, record.supportNode, record.NODE, record.Node);
}

function buildExpectedInventory(sidecar, supportSource) {
  const components = sidecar.components || [];
  const supportRecords = selectedSupportRecords(sidecar, supportSource);
  const callouts = calloutsFromSidecar(sidecar);
  const expectedComponentKeys = components.map(componentKey).filter(Boolean);
  const expectedComponentIds = components.map(componentId).filter(Boolean);
  const expectedCalloutNodes = [...new Set(callouts.map((callout) => text(callout.node || callout.nodeNumber || callout.NODE)).filter(Boolean))].sort();

  return {
    componentsTotal: components.length,
    expectedComponentKeys,
    expectedComponentIds,
    componentsBySemanticType: components.reduce((acc, component) => {
      const category = semanticTypeFromComponent(component);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {}),
    selectedSupportSource: supportSource,
    supportRecordsTotal: supportRecords.length,
    supportRecordsByKind: supportRecords.reduce((acc, record) => {
      const kind = supportKind(record);
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {}),
    supportNodes: [...new Set(supportRecords.map(supportNode).filter(Boolean))].sort(),
    isonoteCallouts: callouts.length,
    calloutNodes: expectedCalloutNodes,
  };
}

function buildActualInventory(gltf) {
  const rows = flattenNodes(gltf);
  const actual = {
    totalNodesInScene: rows.length,
    geometryNodes: 0,
    tracedGeometryNodes: 0,
    traceCoverage: 0,
    triangles: 0,
    byCategory: {},
    tracedComponentKeys: {},
    tracedComponentIds: {},
    tracedSupportSources: {},
    tracedSupportKinds: {},
    tracedSupportNodes: {},
    tracedCalloutNodes: {},
    tracedCalloutNumbers: {},
    nodeRecords: [],
  };

  for (const row of rows) {
    const node = row.node || {};
    if (node.mesh === undefined) continue;
    const mesh = gltf.meshes?.[node.mesh];
    if (!mesh) continue;

    const category = categoryForRow(row, gltf);
    const primitives = mesh.primitives || [];
    const triangles = primitives.reduce((sum, primitive) => sum + countTriangles(primitive, gltf), 0);
    const trace = row.trace || null;

    actual.geometryNodes += 1;
    actual.triangles += triangles;
    actual.byCategory[category] = (actual.byCategory[category] || 0) + 1;

    if (trace) {
      actual.tracedGeometryNodes += 1;
      if (trace.traceKey) actual.tracedComponentKeys[trace.traceKey] = (actual.tracedComponentKeys[trace.traceKey] || 0) + 1;
      if (trace.sourceComponentId) actual.tracedComponentIds[trace.sourceComponentId] = (actual.tracedComponentIds[trace.sourceComponentId] || 0) + 1;
      if (category === 'support' || traceCategory(trace) === 'support') {
        const source = text(trace.supportSource || trace.source || '').toLowerCase();
        const kind = upper(trace.supportKind || trace.kind || 'UNKNOWN');
        const nodeId = text(trace.node || trace.fromNode || trace.toNode || '');
        if (source) actual.tracedSupportSources[source] = (actual.tracedSupportSources[source] || 0) + 1;
        if (kind) actual.tracedSupportKinds[kind] = (actual.tracedSupportKinds[kind] || 0) + 1;
        if (nodeId) actual.tracedSupportNodes[nodeId] = (actual.tracedSupportNodes[nodeId] || 0) + 1;
      }
      if (category === 'annotation' || traceEntity(trace) === 'annotation') {
        for (const callout of trace.callouts || []) {
          const nodeId = text(callout.node);
          const no = text(callout.no);
          if (nodeId) actual.tracedCalloutNodes[nodeId] = (actual.tracedCalloutNodes[nodeId] || 0) + 1;
          if (no) actual.tracedCalloutNumbers[no] = (actual.tracedCalloutNumbers[no] || 0) + 1;
        }
        for (const nodeId of trace.calloutNodes || []) {
          const key = text(nodeId);
          if (key) actual.tracedCalloutNodes[key] = (actual.tracedCalloutNodes[key] || 0) + 1;
        }
      }
    }

    actual.nodeRecords.push({
      nodeIndex: row.nodeIndex,
      nodeName: nodeName(row, gltf),
      meshName: meshName(row, gltf),
      category,
      triangles,
      hasTrace: Boolean(trace),
      traceKey: trace?.traceKey || '',
      traceEntity: traceEntity(trace || {}),
      traceCategory: traceCategory(trace || {}),
      sourceComponentId: trace?.sourceComponentId || '',
      supportSource: trace?.supportSource || trace?.source || '',
      supportKind: trace?.supportKind || '',
    });
  }

  actual.traceCoverage = actual.geometryNodes ? Number((actual.tracedGeometryNodes / actual.geometryNodes).toFixed(6)) : 0;
  return actual;
}

function missingItems(expected, foundMap) {
  return expected.filter((key) => !foundMap[key]);
}

function runQc(expected, actual, options = {}) {
  const minTraceCoverage = Number.isFinite(options.minTraceCoverage) ? options.minTraceCoverage : 0.9;
  const missingComponentIds = missingItems(expected.expectedComponentIds, actual.tracedComponentIds);
  const expectedCalloutNodes = expected.calloutNodes || [];
  const missingCalloutNodes = missingItems(expectedCalloutNodes, actual.tracedCalloutNodes);
  const expectedSupportSource = expected.selectedSupportSource;
  const supportSourceCount = actual.tracedSupportSources[expectedSupportSource] || 0;

  const gates = {
    glbHasGeometry: actual.geometryNodes > 0 && actual.triangles > 0,
    traceMetadataPresent: actual.tracedGeometryNodes > 0,
    traceCoverageMeetsMinimum: actual.traceCoverage >= minTraceCoverage,
    allExpectedComponentIdsTraced: missingComponentIds.length === 0,
    selectedSupportSourceTraced: expected.supportRecordsTotal > 0 ? supportSourceCount > 0 : true,
    annotationCalloutNodesTraced: expected.isonoteCallouts > 0 ? missingCalloutNodes.length === 0 : true,
  };

  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    minTraceCoverage,
    missingComponentIds,
    missingCalloutNodes,
    tracedSupportSourceCount: supportSourceCount,
  };
}

function inferSupportSource(glbPath) {
  const name = path.basename(glbPath || '').toLowerCase();
  return name.includes('isonote') ? 'isonote' : 'inputxml';
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
  const minTraceCoverage = Number(argValue(args, '--min-trace-coverage', '0.90'));

  if (!glbPath || !sidecarPath) {
    console.error(usage());
    throw new Error('Both --glb and --sidecar are required.');
  }
  if (!['inputxml', 'isonote'].includes(supportSource)) throw new Error(`Invalid --support-source ${supportSource}; expected inputxml or isonote.`);
  if (!Number.isFinite(minTraceCoverage) || minTraceCoverage < 0 || minTraceCoverage > 1) throw new Error('--min-trace-coverage must be between 0 and 1.');

  const glbBuffer = await fs.readFile(glbPath);
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  const { json: gltf, binBytes, chunks } = parseGlb(glbBuffer);

  const expected = buildExpectedInventory(sidecar, supportSource);
  const actual = buildActualInventory(gltf);
  const qc = runQc(expected, actual, { minTraceCoverage });

  const report = {
    schema: 'bm-cii-geometry-trace-qc/report-v1',
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

  const body = JSON.stringify(report, null, pretty ? 2 : 0);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${body}\n`, 'utf8');
  } else {
    console.log(body);
  }

  if (strict && !qc.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`BM_CII geometry trace QC failed: ${error.message}`);
  process.exitCode = 1;
});
