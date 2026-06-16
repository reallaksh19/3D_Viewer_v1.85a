#!/usr/bin/env node
/**
 * BM_CII support-record benchmark QC gate.
 *
 * This is intentionally stricter than layer/category QC.
 * It fails when support-like GLB geometry is not backed by an explicit source
 * support record. It is designed to catch the orange/proxy-symbol pollution
 * seen in the Basic GLB/PCF viewer screenshots.
 *
 * Required principle:
 *   one source support record = one traceable rendered support glyph
 *
 * Usage:
 *   node scripts/bm-cii/support-record-benchmark-qc.mjs \
 *     --glb BM_CII_Enriched_engineering_inputxml.glb \
 *     --sidecar BM_CII_Enriched_benchmark.sidecar.json \
 *     --support-source inputxml \
 *     --out reports/support-record-qc.json \
 *     --strict
 */

import fs from 'node:fs';
import path from 'node:path';

const SUPPORT_LIKE_NAME = /SUPPORT|RESTRAINT|REST|GUIDE|LINESTOP|LINE_STOP|LIMIT|ANCHOR|HANGER|SPRING|SHOE|HOLDDOWN|TYPE0|UNKNOWN|BM_CII_RESTRAINT/i;
const VALID_SUPPORT_KINDS = new Set(['REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'ANCHOR', 'HANGER', 'SPRING', 'HOLDDOWN', 'UNKNOWN']);
const UNKNOWN_KINDS = new Set(['UNKNOWN', 'TYPE0']);
const EXPECTED_CONTRACT = Object.freeze({
  GUIDE: 'guide-lateral-arrows-tip-at-od2',
  REST: 'rest-vertical-arrow-tip-at-od2',
  HOLDDOWN: 'rest-vertical-arrow-tip-at-od2',
  LINESTOP: 'linestop-axial-arrows-offset-od2',
  LIMIT: 'limit-axial-arrow-offset-od2',
  ANCHOR: 'anchor-fixed-symbol',
  HANGER: 'hanger-spring-symbol',
  SPRING: 'hanger-spring-symbol',
  UNKNOWN: 'unknown-debug-default-off',
});

function usage() {
  console.error(`Usage:
  node scripts/bm-cii/support-record-benchmark-qc.mjs \\
    --glb <file.glb> \\
    --sidecar <sidecar.json> \\
    --support-source <inputxml|isonote> \\
    [--out <report.json>] [--pretty] [--strict]
`);
}

function parseArgs(argv) {
  const args = { pretty: false, strict: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pretty') args.pretty = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg.startsWith('--')) args[arg.slice(2)] = argv[++i];
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readGlbJson(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20) throw new Error(`GLB too small: ${file}`);
  const magic = bytes.readUInt32LE(0);
  const version = bytes.readUInt32LE(4);
  const totalLength = bytes.readUInt32LE(8);
  if (magic !== 0x46546c67) throw new Error(`Bad GLB magic: ${file}`);
  if (version !== 2) throw new Error(`Expected GLB v2, got ${version}: ${file}`);
  if (totalLength !== bytes.length) throw new Error(`GLB length mismatch: header=${totalLength} actual=${bytes.length}`);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) return JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/g, ''));
  }
  throw new Error(`Missing JSON chunk: ${file}`);
}

function upper(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeKind(value) {
  const raw = upper(value).replace(/[\s_-]+/g, '');
  if (!raw || raw === '0' || raw.includes('TYPE0') || raw.includes('UNKNOWN')) return 'UNKNOWN';
  if (raw.includes('HOLDDOWN') || raw.includes('HOLDOWN')) return 'HOLDDOWN';
  if (raw.includes('LINESTOP') || raw.includes('LIMITSTOP') || raw.includes('LIMTSTOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('ANCHOR')) return 'ANCHOR';
  if (raw.includes('HANGER')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('REST') || raw.includes('SHOE')) return 'REST';
  return 'UNKNOWN';
}

function normalizeAxis(value) {
  if (Array.isArray(value) && value.length >= 3) {
    const abs = value.slice(0, 3).map((v) => Math.abs(Number(v) || 0));
    const max = Math.max(...abs);
    if (max > 0) return ['X', 'Y', 'Z'][abs.indexOf(max)];
  }
  const raw = upper(value);
  if (!raw) return '';
  if (/\bX\b|AXIS_X|DIRECTION_X/.test(raw)) return 'X';
  if (/\bY\b|AXIS_Y|DIRECTION_Y/.test(raw)) return 'Y';
  if (/\bZ\b|AXIS_Z|DIRECTION_Z/.test(raw)) return 'Z';
  if (raw === 'X' || raw.includes('+X') || raw.includes('-X')) return 'X';
  if (raw === 'Y' || raw.includes('+Y') || raw.includes('-Y')) return 'Y';
  if (raw === 'Z' || raw.includes('+Z') || raw.includes('-Z')) return 'Z';
  return '';
}

function supportArrayForSource(sidecar, source) {
  if (source === 'inputxml') return sidecar.supportsInputXml || sidecar.supportsInputXML || [];
  if (source === 'isonote') return sidecar.supportsIsonote || sidecar.supportsISONOTE || [];
  throw new Error(`Unsupported support source: ${source}`);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function supportRecordIdOf({ source, index, node, kind, axis }) {
  const indexText = String(index).padStart(2, '0');
  return `${source}:${indexText}:node:${node || 'NA'}:kind:${kind || 'UNKNOWN'}:axis:${axis || 'NA'}`;
}

function expectedSupportRecords(sidecar, source) {
  const supports = supportArrayForSource(sidecar, source);
  return supports.map((support, index) => {
    const node = String(firstNonEmpty(support.node, support.nodeNumber, support.NodeNumber, support.supportNode));
    const kind = normalizeKind(firstNonEmpty(support.kind, support.type, support.display, support.supportKind, support.restraintType));
    const axis = normalizeAxis(firstNonEmpty(support.axis, support.axisGlb, support.direction, support.restraintAxis));
    const recordId = String(firstNonEmpty(
      support.recordId,
      support.id,
      support.supportId,
      supportRecordIdOf({ source, index: index + 1, node, kind, axis }),
    ));
    return {
      index: index + 1,
      recordId,
      source,
      node,
      kind,
      axis,
      expectedContract: EXPECTED_CONTRACT[kind] || EXPECTED_CONTRACT.UNKNOWN,
      visibleDefault: !UNKNOWN_KINDS.has(kind),
      rawKind: firstNonEmpty(support.kind, support.type, support.display, support.supportKind, support.restraintType),
    };
  });
}

function nodeName(gltf, node, index) {
  const mesh = Number.isInteger(node.mesh) ? gltf.meshes?.[node.mesh] : null;
  return `${node.name || `node_${index}`} ${mesh?.name || ''}`.trim();
}

function traceOf(node = {}) {
  const extras = node.extras || {};
  const userData = extras.userData || {};
  return extras.bmCiiTrace || userData.bmCiiTrace || extras.BM_CII_TRACE || null;
}

function layerOf(node = {}) {
  const extras = node.extras || {};
  const userData = extras.userData || {};
  return extras.bmCiiLayer || userData.bmCiiLayer || null;
}

function layerIdsOf(node = {}) {
  const layer = layerOf(node) || {};
  const ids = layer.layerIds || node.extras?.bmCiiLayerIds || [];
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function isSupportGlyphTrace(trace) {
  return trace?.entity === 'support';
}

function isSupportPartTrace(trace) {
  return trace?.entity === 'supportPart' || trace?.entity === 'support-part';
}

function isSupportLayer(layer) {
  return layer?.category === 'support' || layer?.semanticCategory === 'support' || (Array.isArray(layer?.layerIds) && layer.layerIds.includes('plant.restraints'));
}

function renderedSupportRecords(gltf) {
  const records = [];
  const supportLikeOrphans = [];
  const supportLikeNodes = [];
  const supportParts = [];

  (gltf.nodes || []).forEach((node, index) => {
    if (node.mesh === undefined || node.mesh === null) return;
    const name = nodeName(gltf, node, index);
    const trace = traceOf(node);
    const layer = layerOf(node);
    const layerIds = layerIdsOf(node);
    const supportTrace = isSupportGlyphTrace(trace);
    const supportPartTrace = isSupportPartTrace(trace);
    const supportLayer = isSupportLayer(layer);
    const supportName = SUPPORT_LIKE_NAME.test(name);

    if (supportName || supportLayer || supportTrace || supportPartTrace) {
      supportLikeNodes.push({ index, name, traceEntity: trace?.entity || '', hasTrace: !!trace, hasLayer: !!layer, layerIds });
    }

    if (supportTrace) {
      const kind = normalizeKind(firstNonEmpty(trace.supportKind, trace.kind, layer?.supportKind));
      const axis = normalizeAxis(firstNonEmpty(trace.axis, trace.restraintAxis, layer?.axis));
      records.push({
        index,
        name,
        recordId: String(firstNonEmpty(trace.recordId, trace.supportRecordId, trace.traceKey, '')),
        source: String(firstNonEmpty(trace.source, trace.supportSource, layer?.source)).toLowerCase(),
        node: String(firstNonEmpty(trace.node, trace.sourceNode, trace.supportNode)),
        kind,
        axis,
        contract: String(firstNonEmpty(trace.supportSymbolContract, trace.renderGlyphContract, trace.contract)),
        renderGlyph: String(firstNonEmpty(trace.renderGlyph, trace.glyph)),
        visualProfile: String(firstNonEmpty(trace.visualProfile, trace.bmCiiRestraintVisualProfile?.profile, node.extras?.bmCiiRestraintVisualProfile?.profile)),
        visibleDefault: layer?.visibleDefault !== false,
        layerIds,
      });
    } else if (supportPartTrace) {
      supportParts.push({ index, name, parentRecordId: trace.parentRecordId || trace.supportRecordId || '', layerIds });
    } else if (supportName || supportLayer) {
      supportLikeOrphans.push({ index, name, hasLayer: !!layer, layerIds });
    }
  });

  return { records, supportLikeOrphans, supportLikeNodes, supportParts };
}

function keyFor(record) {
  return `${record.source}|${record.node}|${record.kind}|${record.axis || 'NA'}`;
}

function compareRecords(expected, actual, source) {
  const expectedByKey = new Map();
  const duplicateExpectedKeys = [];
  for (const record of expected) {
    const key = keyFor(record);
    if (expectedByKey.has(key)) duplicateExpectedKeys.push(key);
    expectedByKey.set(key, record);
  }

  const actualByKey = new Map();
  const duplicateActualKeys = [];
  for (const record of actual) {
    const key = keyFor(record);
    if (actualByKey.has(key)) duplicateActualKeys.push(key);
    actualByKey.set(key, record);
  }

  const missing = [];
  const matched = [];
  for (const [key, expectedRecord] of expectedByKey.entries()) {
    const actualRecord = actualByKey.get(key);
    if (!actualRecord) missing.push({ key, expected: expectedRecord });
    else matched.push({ key, expected: expectedRecord, actual: actualRecord });
  }

  const unexpected = [];
  for (const [key, actualRecord] of actualByKey.entries()) {
    if (!expectedByKey.has(key)) unexpected.push({ key, actual: actualRecord });
  }

  const sourceMixed = actual.filter((record) => record.source && record.source !== source);
  const invalidKinds = actual.filter((record) => !VALID_SUPPORT_KINDS.has(record.kind));
  const missingRecordId = actual.filter((record) => !record.recordId);
  const missingContract = actual.filter((record) => !record.contract && !record.renderGlyph);
  const contractMismatch = actual.filter((record) => {
    const expectedContract = EXPECTED_CONTRACT[record.kind] || EXPECTED_CONTRACT.UNKNOWN;
    return record.contract && record.contract !== expectedContract;
  });
  const unknownVisible = actual.filter((record) => UNKNOWN_KINDS.has(record.kind) && record.visibleDefault !== false);

  return {
    missing,
    unexpected,
    matched,
    duplicateExpectedKeys,
    duplicateActualKeys,
    sourceMixed,
    invalidKinds,
    missingRecordId,
    missingContract,
    contractMismatch,
    unknownVisible,
  };
}

function runQc({ glbFile, sidecarFile, supportSource }) {
  const source = String(supportSource || '').toLowerCase();
  const sidecar = readJson(sidecarFile);
  const gltf = readGlbJson(glbFile);
  const expected = expectedSupportRecords(sidecar, source);
  const { records: actual, supportLikeOrphans, supportLikeNodes, supportParts } = renderedSupportRecords(gltf);
  const compare = compareRecords(expected, actual, source);

  const gates = {
    sourceHasSupportRecords: expected.length > 0,
    renderedSupportRecordCountMatchesExpected: actual.length === expected.length,
    noSupportLikeOrphans: supportLikeOrphans.length === 0,
    noMissingExpectedSupportRecords: compare.missing.length === 0,
    noUnexpectedSupportRecords: compare.unexpected.length === 0,
    noDuplicateExpectedKeys: compare.duplicateExpectedKeys.length === 0,
    noDuplicateActualKeys: compare.duplicateActualKeys.length === 0,
    noSourceMixing: compare.sourceMixed.length === 0,
    noInvalidSupportKinds: compare.invalidKinds.length === 0,
    allSupportGlyphsHaveRecordId: compare.missingRecordId.length === 0,
    allSupportGlyphsHaveContractOrGlyph: compare.missingContract.length === 0,
    allSupportGlyphContractsMatchKind: compare.contractMismatch.length === 0,
    unknownType0NotVisibleByDefault: compare.unknownVisible.length === 0,
  };

  return {
    schema: 'bm-cii-support-record-benchmark-qc/report-v2',
    createdAtUtc: new Date().toISOString(),
    glb: path.basename(glbFile),
    sidecar: path.basename(sidecarFile),
    supportSource: source,
    ok: Object.values(gates).every(Boolean),
    gates,
    summary: {
      expectedSupportRecords: expected.length,
      renderedSupportRecords: actual.length,
      supportLikeNodes: supportLikeNodes.length,
      supportLikeOrphans: supportLikeOrphans.length,
      supportPartNodes: supportParts.length,
      matchedSupportRecords: compare.matched.length,
      missingSupportRecords: compare.missing.length,
      unexpectedSupportRecords: compare.unexpected.length,
    },
    expected,
    actual,
    supportParts,
    supportLikeOrphans,
    failures: {
      missing: compare.missing,
      unexpected: compare.unexpected,
      duplicateExpectedKeys: compare.duplicateExpectedKeys,
      duplicateActualKeys: compare.duplicateActualKeys,
      sourceMixed: compare.sourceMixed,
      invalidKinds: compare.invalidKinds,
      missingRecordId: compare.missingRecordId,
      missingContract: compare.missingContract,
      contractMismatch: compare.contractMismatch,
      unknownVisible: compare.unknownVisible,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.glb || !args.sidecar || !args['support-source']) {
    usage();
    process.exit(2);
  }
  const report = runQc({ glbFile: args.glb, sidecarFile: args.sidecar, supportSource: args['support-source'] });
  const json = JSON.stringify(report, null, args.pretty ? 2 : 0);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${json}\n`);
  } else {
    console.log(json);
  }
  if (args.strict && !report.ok) process.exit(1);
}

main();
