#!/usr/bin/env node
/**
 * BM_CII restraint + annotation fidelity QC gate.
 *
 * This gate is stricter than layer/category tally QC. It rejects GLBs where:
 *   - LINESTOP / LIMIT / GUIDE / Z-direction restraints are not traceable;
 *   - rendered support source is mixed between InputXML and ISONOTE variants;
 *   - rendered support glyphs do not carry an engineering visual profile;
 *   - annotations contain random/generated text instead of expected ISONOTE callouts.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const EXPECTED_CALLOUT_NODES = ['35', '130', '205', '255'];
const VALID_SUPPORT_KINDS = new Set(['REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'ANCHOR', 'HANGER', 'SPRING', 'HOLDDOWN', 'SHOE', 'UNKNOWN', 'TYPE0']);
const AXIS_KINDS_REQUIRED = new Set(['GUIDE', 'LINESTOP', 'LIMIT', 'ANCHOR']);
const DIRECTIONAL_AXIS_VALUES = new Set(['X', 'Y', 'Z', '+X', '-X', '+Y', '-Y', '+Z', '-Z']);
const MIN_RENDER_SCALE = 0.12;

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/bm-cii/restraint-annotation-fidelity-qc.mjs \
    --sidecar <BM_CII sidecar.json> \
    --inputxml-glb <InputXML support GLB> \
    --isonote-glb <ISONOTE support GLB> \
    --out <qc-report.json> \
    --strict

Checks:
  1. InputXML GLB carries only inputxml support-source traces.
  2. ISONOTE GLB carries only isonote support-source traces.
  3. InputXML and ISONOTE support signatures are not accidentally identical.
  4. LINESTOP / LIMIT / GUIDE / ANCHOR traces carry direction/axis metadata.
  5. Z-direction traces are explicit when source or trace indicates Z.
  6. Rendered glyphs carry renderGlyph/renderScale or a visual profile marker.
  7. Annotation traces contain only expected callouts 1..4 at nodes 35,130,205,255.
  8. No random annotation text is allowed outside the expected sidecar callout text.
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
  for (const key of ['sidecar', 'inputxmlGlb', 'isonoteGlb']) {
    if (!args[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`);
  }
  return args;
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

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

function normalizeKind(kind) {
  const raw = String(kind || 'UNKNOWN').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (raw.includes('LINESTOP') || raw.includes('LINE_STOP') || raw.includes('LIMIT_STOP') || raw.includes('LIMT_STOP')) return 'LINESTOP';
  if (raw === 'TYPE_0') return 'TYPE0';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('ANCHOR')) return 'ANCHOR';
  if (raw.includes('HANGER')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('HOLDDOWN')) return 'HOLDDOWN';
  if (raw.includes('REST') || raw.includes('SHOE') || raw.includes('SUPPORT')) return 'REST';
  if (raw.includes('TYPE0') || raw === '0' || raw.includes('UNKNOWN')) return 'UNKNOWN';
  return raw;
}

function normalizeSource(source) {
  const value = String(source || '').trim().toLowerCase();
  if (value.includes('isonote')) return 'isonote';
  if (value.includes('inputxml') || value.includes('xml')) return 'inputxml';
  return value || 'unknown';
}

function nodeId(value) { return value === null || value === undefined ? '' : String(value).trim(); }

function getAxis(trace) {
  const raw = trace.axis || trace.direction || trace.dof || trace.restraintAxis || trace.axisLabel || trace.renderAxis || trace.bmCiiLayer?.axis;
  if (Array.isArray(raw)) {
    const [x, y, z] = raw.map(Number);
    const abs = [Math.abs(x || 0), Math.abs(y || 0), Math.abs(z || 0)];
    const max = Math.max(...abs);
    if (max <= 0) return '';
    const index = abs.indexOf(max);
    const axis = ['X', 'Y', 'Z'][index];
    const sign = [x, y, z][index] < 0 ? '-' : '+';
    return `${sign}${axis}`;
  }
  if (raw && typeof raw === 'object') return getAxis([raw.x, raw.y, raw.z]);
  return String(raw || '').trim().toUpperCase();
}

function supportRecordFromSource(record, index, source) {
  const kind = normalizeKind(record.kind || record.type || record.restraintType || record.supportType || record.display);
  const axis = getAxis(record);
  return {
    index,
    source,
    node: nodeId(record.node || record.nodeNumber || record.NodeNumber || record.supportNode),
    kind,
    axis,
    gapMm: Number.isFinite(Number(record.gapMm ?? record.gap ?? record.restraintGap))
      ? Number(record.gapMm ?? record.gap ?? record.restraintGap)
      : null,
  };
}

function expectedSupports(sidecar, source) {
  const key = source === 'isonote' ? 'supportsIsonote' : 'supportsInputXml';
  return (sidecar[key] || []).map((record, i) => supportRecordFromSource(record, i + 1, source));
}

function expectedCallouts(sidecar) {
  return (sidecar.caesarAnnotationCallouts || []).map((callout, i) => ({
    calloutNo: Number(callout.no ?? callout.calloutNo ?? i + 1),
    node: nodeId(callout.node),
    text: String(callout.text || '').trim(),
  }));
}

function extractTrace(node, inheritedTrace = null) {
  const extras = node.extras || {};
  return extras.bmCiiTrace || extras.BM_CII_TRACE || inheritedTrace || null;
}

function collectTraces(gltf) {
  const nodes = gltf.nodes || [];
  const traces = [];
  const visit = (nodeIndex, inheritedTrace, chain) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    const trace = extractTrace(node, inheritedTrace);
    const layer = node.extras?.bmCiiLayer || null;
    const nextChain = [...chain, node.name || `node_${nodeIndex}`];
    if (node.mesh !== undefined) {
      traces.push({
        nodeIndex,
        nodeName: node.name || `node_${nodeIndex}`,
        meshIndex: node.mesh,
        trace,
        layer,
        chain: nextChain,
      });
    }
    for (const child of node.children || []) visit(child, trace, nextChain);
  };
  const childSet = new Set();
  for (const node of nodes) for (const child of node.children || []) childSet.add(child);
  nodes.forEach((_, idx) => { if (!childSet.has(idx)) visit(idx, null, []); });
  return traces;
}

function isSupportEntry(entry) {
  const traceEntity = String(entry.trace?.entity || '').toLowerCase();
  const layerCategory = String(entry.layer?.category || '').toLowerCase();
  return traceEntity === 'support' || layerCategory === 'support';
}

function isAnnotationEntry(entry) {
  const traceEntity = String(entry.trace?.entity || '').toLowerCase();
  const layerCategory = String(entry.layer?.category || '').toLowerCase();
  return traceEntity === 'annotation' || layerCategory === 'annotation';
}

function supportTraceRecord(entry) {
  const trace = entry.trace || {};
  const layer = entry.layer || {};
  const source = normalizeSource(trace.supportSource || trace.source || trace.renderSource || layer.source);
  const kind = normalizeKind(trace.supportKind || trace.kind || trace.type || trace.restraintType || layer.supportKind);
  const axis = getAxis({ ...trace, axis: trace.axis || layer.axis });
  const renderScale = Number(trace.renderScale ?? trace.glyphScale ?? layer.renderScale ?? NaN);
  return {
    nodeName: entry.nodeName,
    nodeIndex: entry.nodeIndex,
    source,
    node: nodeId(trace.node || trace.nodeNumber || trace.supportNode),
    kind,
    axis,
    gapMm: trace.gapMm ?? trace.gap ?? trace.restraintGap ?? layer.gap ?? null,
    traceKey: trace.traceKey || '',
    renderGlyph: trace.renderGlyph || trace.glyph || layer.renderGlyph || '',
    renderScale: Number.isFinite(renderScale) ? renderScale : null,
    visualProfile: trace.visualProfile || trace.glbSupportVisualProfile || layer.visualProfile || '',
  };
}

function annotationPayloads(entries) {
  const result = [];
  for (const entry of entries) {
    if (!isAnnotationEntry(entry)) continue;
    const trace = entry.trace || {};
    const callouts = Array.isArray(trace.callouts) ? trace.callouts : [];
    result.push({
      nodeName: entry.nodeName,
      traceKey: trace.traceKey || '',
      text: trace.text || trace.label || '',
      callouts: callouts.map((c, i) => ({
        calloutNo: Number(c.calloutNo ?? c.no ?? i + 1),
        node: nodeId(c.node),
        text: String(c.text || '').trim(),
      })),
    });
  }
  return result;
}

function mapSupportKindCounts(records) {
  const counts = {};
  for (const record of records) counts[record.kind] = (counts[record.kind] || 0) + 1;
  return counts;
}

function compareKindCounts(expected, actual) {
  const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
  return keys.map(key => ({
    kind: key,
    expected: expected[key] || 0,
    actual: actual[key] || 0,
    ok: (expected[key] || 0) === (actual[key] || 0),
  }));
}

function supportSignature(record) {
  return `${record.source}|${record.node}|${record.kind}|${record.axis}|${record.gapMm ?? ''}`;
}

function supportSourceQc(source, expected, actualRecords) {
  const wrongSource = actualRecords.filter(record => record.source !== source);
  const invalidKinds = actualRecords.filter(record => !VALID_SUPPORT_KINDS.has(record.kind));
  const directionalMissingAxis = actualRecords.filter(record => AXIS_KINDS_REQUIRED.has(record.kind) && !record.axis);
  const directionalInvalidAxis = actualRecords.filter(record => record.axis && !DIRECTIONAL_AXIS_VALUES.has(record.axis) && !/^[+-]?[XYZ]$/.test(record.axis));
  const zExpected = expected.filter(record => /Z/i.test(record.axis));
  const zActual = actualRecords.filter(record => /Z/i.test(record.axis));
  const kindCompare = compareKindCounts(mapSupportKindCounts(expected), mapSupportKindCounts(actualRecords));
  const kindMismatch = kindCompare.filter(record => !record.ok);
  const lineStopActual = actualRecords.filter(record => record.kind === 'LINESTOP');
  const limitActual = actualRecords.filter(record => record.kind === 'LIMIT');
  const missingVisualGlyph = actualRecords.filter(record => !record.renderGlyph && !record.visualProfile);
  const tinyVisualGlyph = actualRecords.filter(record => record.renderScale !== null && record.renderScale < MIN_RENDER_SCALE);

  return {
    supportSource: source,
    expectedCount: expected.length,
    actualTraceCount: actualRecords.length,
    actualRecords,
    wrongSource,
    invalidKinds,
    directionalMissingAxis,
    directionalInvalidAxis,
    zExpectedCount: zExpected.length,
    zActualCount: zActual.length,
    lineStopActualCount: lineStopActual.length,
    limitActualCount: limitActual.length,
    missingVisualGlyph,
    tinyVisualGlyph,
    kindCompare,
    kindMismatch,
    signatures: actualRecords.map(supportSignature).sort(),
    gates: {
      hasExpectedSupportRecords: expected.length > 0,
      hasRenderedSupportTraces: actualRecords.length > 0,
      selectedSourceOnly: wrongSource.length === 0,
      validSupportKindsOnly: invalidKinds.length === 0,
      directionalKindsHaveAxis: directionalMissingAxis.length === 0,
      directionalAxesValid: directionalInvalidAxis.length === 0,
      zAxisPreservedWhenExpected: zExpected.length === 0 || zActual.length >= zExpected.length,
      kindCountsMatchExpected: kindMismatch.length === 0,
      kindCountsDoNotCollapseToUnknown: (mapSupportKindCounts(actualRecords).UNKNOWN || 0) < actualRecords.length,
      lineStopAndLimitRemainDistinct: !(lineStopActual.length > 0 && limitActual.length === 0 && expected.some(r => r.kind === 'LIMIT')),
      renderedGlyphMetadataPresent: missingVisualGlyph.length === 0,
      renderedGlyphScaleReadable: tinyVisualGlyph.length === 0,
    },
  };
}

function annotationQc(expected, payloads) {
  const allowedText = new Set(expected.map(c => c.text).filter(Boolean));
  const allCallouts = payloads.flatMap(payload => payload.callouts);
  const numbers = allCallouts.map(c => c.calloutNo).sort((a, b) => a - b);
  const nodes = Array.from(new Set(allCallouts.map(c => c.node))).sort((a, b) => Number(a) - Number(b));
  const randomTopLevelText = payloads.map(payload => String(payload.text || '').trim()).filter(text => text && !allowedText.has(text));
  const randomCalloutText = allCallouts.map(c => c.text).filter(text => text && !allowedText.has(text));
  const expectedTextsMissing = expected.filter(c => c.text && !allCallouts.some(actual => actual.text === c.text)).map(c => c.text);

  return {
    expectedCount: expected.length,
    annotationTraceCount: payloads.length,
    allCallouts,
    numbers,
    nodes,
    randomTopLevelText,
    randomCalloutText,
    expectedTextsMissing,
    gates: {
      exactlyTwoMergedAnnotationMeshes: payloads.length === 2,
      expectedFourCalloutsAvailable: expected.length === 4,
      calloutNumbersStable: JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4, 1, 2, 3, 4]) || JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4]),
      calloutNodesStable: EXPECTED_CALLOUT_NODES.every(node => nodes.includes(node)),
      noRandomTopLevelAnnotationText: randomTopLevelText.length === 0,
      noRandomCalloutText: randomCalloutText.length === 0,
      expectedTextPreserved: expectedTextsMissing.length === 0,
    },
  };
}

function buildVariantReport(glbPath, source, sidecar) {
  const { json: gltf, sha256, bytes } = readGlbJson(glbPath);
  const traces = collectTraces(gltf);
  const supportRecords = traces.filter(isSupportEntry).map(supportTraceRecord);
  const annPayloads = annotationPayloads(traces);
  const support = supportSourceQc(source, expectedSupports(sidecar, source), supportRecords);
  const annotation = annotationQc(expectedCallouts(sidecar), annPayloads);
  const gates = {
    ...Object.fromEntries(Object.entries(support.gates).map(([k, v]) => [`support.${k}`, v])),
    ...Object.fromEntries(Object.entries(annotation.gates).map(([k, v]) => [`annotation.${k}`, v])),
  };
  return {
    file: path.basename(glbPath),
    sha256,
    bytes,
    supportSource: source,
    support,
    annotation,
    gates,
    ok: Object.values(gates).every(Boolean),
    failedGates: Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k),
  };
}

function crossVariantQc(inputxmlReport, isonoteReport) {
  const inputxmlSignatures = new Set(inputxmlReport.support.signatures || []);
  const isonoteSignatures = new Set(isonoteReport.support.signatures || []);
  const intersection = Array.from(inputxmlSignatures).filter(sig => isonoteSignatures.has(sig)).sort();
  const identicalSupportCountAndSignatures =
    inputxmlReport.support.actualTraceCount === isonoteReport.support.actualTraceCount &&
    inputxmlSignatures.size === isonoteSignatures.size &&
    intersection.length === inputxmlSignatures.size;
  return {
    inputxmlSupportCount: inputxmlReport.support.actualTraceCount,
    isonoteSupportCount: isonoteReport.support.actualTraceCount,
    commonSignatures: intersection,
    gates: {
      bothVariantsHaveSupportTraces: inputxmlReport.support.actualTraceCount > 0 && isonoteReport.support.actualTraceCount > 0,
      variantsNotAccidentallyIdentical: !identicalSupportCountAndSignatures,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const sidecar = readJson(args.sidecar);
  const inputxml = buildVariantReport(args.inputxmlGlb, 'inputxml', sidecar);
  const isonote = buildVariantReport(args.isonoteGlb, 'isonote', sidecar);
  const cross = crossVariantQc(inputxml, isonote);
  const gates = {
    inputxmlOk: inputxml.ok,
    isonoteOk: isonote.ok,
    ...Object.fromEntries(Object.entries(cross.gates).map(([k, v]) => [`cross.${k}`, v])),
  };
  const report = {
    schema: 'bm-cii-restraint-annotation-fidelity-qc/v2',
    createdAtUtc: new Date().toISOString(),
    sidecar: path.basename(args.sidecar),
    inputxml,
    isonote,
    cross,
    gates,
    ok: Object.values(gates).every(Boolean),
    failedGates: Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k),
  };
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (args.strict && !report.ok) {
    console.error(`[bm-cii-restraint-annotation-fidelity-qc] FAIL: ${report.failedGates.join(', ')}`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[bm-cii-restraint-annotation-fidelity-qc] ${error.message}`);
  process.exit(1);
}
