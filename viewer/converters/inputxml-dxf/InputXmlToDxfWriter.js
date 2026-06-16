import { createDxfDocument, lineEntity, pointEntity, textEntity } from '../../vendor/dxf-lines.js';

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dxfNum(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(Number(n.toFixed(6))) : '0';
}

function normalizeOutputMode(value) {
  const mode = String(value || 'iso-drawing').trim().toLowerCase();
  if (['geometry', 'raw', 'model', 'model-geometry'].includes(mode)) return 'geometry';
  return 'iso-drawing';
}

function normalizeProjectionMode(value) {
  const mode = String(value || '3d').trim().toLowerCase();
  if (['top', 'xy', 'plan'].includes(mode)) return 'top';
  if (['elevation-xz', 'xz', 'front', 'elevation-e'].includes(mode)) return 'elevation-xz';
  if (['elevation-yz', 'yz', 'side', 'elevation-n'].includes(mode)) return 'elevation-yz';
  if (['iso', 'iso-2.5d', 'isometric'].includes(mode)) return 'iso-2.5d';
  return '3d';
}

function resolveProjectionMode(options, outputMode) {
  const explicit = options.projectionMode ?? options.dxfProjectionMode ?? options.outputProjection;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) return normalizeProjectionMode(explicit);
  return outputMode === 'iso-drawing' ? 'iso-2.5d' : '3d';
}

function normalizePipeBodyMode(value, outputMode) {
  const fallback = outputMode === 'iso-drawing' ? 'thick-2d' : 'centerline';
  const mode = String(value || fallback).trim().toLowerCase();
  if (['thick', 'thick-2d', 'solid', 'body', 'pipe-body'].includes(mode)) return 'thick-2d';
  return 'centerline';
}

function projectPoint(point, projectionMode) {
  if (projectionMode === 'top') return { x: point.x, y: point.y, z: 0 };
  if (projectionMode === 'elevation-xz') return { x: point.x, y: point.z, z: 0 };
  if (projectionMode === 'elevation-yz') return { x: point.y, y: point.z, z: 0 };
  if (projectionMode === 'iso-2.5d') {
    return { x: point.x - point.y, y: point.z + 0.5 * (point.x + point.y), z: 0 };
  }
  return { x: point.x, y: point.y, z: point.z };
}

function projectScaledPoint(point, scale, projectionMode) {
  const projected = projectPoint(point, projectionMode);
  return { x: projected.x * scale, y: projected.y * scale, z: projected.z * scale };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function emptyExtents() {
  return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, width: 0, height: 0, depth: 0 };
}

function pointExtents(points) {
  const finite = (points || []).filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  if (!finite.length) return emptyExtents();
  const xs = finite.map((point) => point.x);
  const ys = finite.map((point) => point.y);
  const zs = finite.map((point) => point.z);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const minZ = Math.min(...zs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const maxZ = Math.max(...zs);
  return { minX, minY, minZ, maxX, maxY, maxZ, width: maxX - minX, height: maxY - minY, depth: maxZ - minZ };
}

function createPaperTransform(points, outputMode, options) {
  const before = pointExtents(points);
  if (outputMode !== 'iso-drawing') {
    return { fitScale: 1, sheet: null, extentsBefore: before, extentsAfter: before, apply: (point) => ({ x: point.x, y: point.y, z: point.z }) };
  }

  const sheetWidth = Math.max(numberOr(options.sheetWidth || options.dxfSheetWidth, 420), 10);
  const sheetHeight = Math.max(numberOr(options.sheetHeight || options.dxfSheetHeight, 297), 10);
  const margin = Math.max(numberOr(options.sheetMargin || options.dxfSheetMargin, 15), 0);
  const availableWidth = Math.max(sheetWidth - margin * 2, 1);
  const availableHeight = Math.max(sheetHeight - margin * 2, 1);
  const sourceWidth = Math.max(before.width, 1);
  const sourceHeight = Math.max(before.height, 1);
  const fitScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const safeFit = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;

  const apply = (point) => ({
    x: (point.x - before.minX) * safeFit + margin,
    y: sheetHeight - margin - (point.y - before.minY) * safeFit,
    z: 0,
  });

  return {
    fitScale: safeFit,
    sheet: { width: sheetWidth, height: sheetHeight, margin },
    extentsBefore: before,
    extentsAfter: pointExtents(points.map(apply)),
    apply,
  };
}

function normalizeBranch(branch) {
  return {
    id: String(branch?.id || '').trim(),
    label: String(branch?.label || branch?.id || '').trim(),
    pipelineRef: String(branch?.pipelineRef || '').trim(),
    lineKey: String(branch?.lineKey || '').trim(),
    lineNo: String(branch?.lineNo || '').trim(),
    aliases: Array.isArray(branch?.aliases) ? branch.aliases.map((alias) => String(alias || '').trim()).filter(Boolean) : [],
    componentCount: Number.isFinite(Number(branch?.componentCount)) ? Number(branch.componentCount) : 0,
  };
}

function branchSelected(branch, selectedIds) {
  if (!selectedIds.length) return true;
  const aliases = [branch.id, branch.pipelineRef, branch.lineKey, branch.lineNo, ...(branch.aliases || [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return aliases.some((alias) => selectedIds.includes(alias));
}

function normType(value) {
  return String(value || '').toUpperCase();
}

function vector(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(length) || length <= Number.EPSILON) return null;
  return { dx: dx / length, dy: dy / length, dz: dz / length, length };
}

function symbolSize(length, textHeight) {
  const base = Math.max(numberOr(textHeight, 2.5) * 2, 1);
  const byLength = Number.isFinite(length) && length > 0 ? length * 0.08 : base;
  return Math.min(Math.max(base, byLength), base * 4);
}

function offset(point, axis, along, side) {
  return {
    x: point.x + axis.dx * along - axis.dy * side,
    y: point.y + axis.dy * along + axis.dx * side,
    z: point.z + axis.dz * along,
  };
}

function labelOffset(point, axis, textHeight, multiplier = 2.2) {
  if (!axis) return { x: point.x + textHeight * multiplier, y: point.y + textHeight * multiplier, z: point.z };
  return offset(point, axis, textHeight * 0.8, textHeight * multiplier);
}

function solidQuadEntity(id, a, b, c, d, layer) {
  return [
    '0', 'SOLID', '8', layer,
    '10', dxfNum(a?.x), '20', dxfNum(a?.y), '30', dxfNum(a?.z),
    '11', dxfNum(b?.x), '21', dxfNum(b?.y), '31', dxfNum(b?.z),
    '12', dxfNum(c?.x), '22', dxfNum(c?.y), '32', dxfNum(c?.z),
    '13', dxfNum(d?.x), '23', dxfNum(d?.y), '33', dxfNum(d?.z),
  ];
}

function addPipeBody(entities, id, p1, p2, width, layer) {
  const axis = vector(p1, p2);
  if (!axis || width <= 0) return 0;
  const half = width / 2;
  const a = offset(p1, axis, 0, half);
  const b = offset(p2, axis, 0, half);
  const c = offset(p2, axis, 0, -half);
  const d = offset(p1, axis, 0, -half);
  entities.push(solidQuadEntity(`${id}-pipe-body`, a, b, c, d, layer));
  entities.push(lineEntity(`${id}-pipe-outline-a`, a, b, `${layer}_OUTLINE`));
  entities.push(lineEntity(`${id}-pipe-outline-b`, d, c, `${layer}_OUTLINE`));
  return 1;
}

function addValveSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight);
  const left = offset(c, axis, -size, 0);
  const right = offset(c, axis, size, 0);
  const top = offset(c, axis, 0, size);
  const bottom = offset(c, axis, 0, -size);
  entities.push(lineEntity(`${id}-valve-a`, left, top, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-b`, top, right, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-c`, right, bottom, 'VALVES'));
  entities.push(lineEntity(`${id}-valve-d`, bottom, left, 'VALVES'));
  return 4;
}

function addFlangeSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight);
  const gap = size * 0.35;
  for (const [index, point] of [offset(c, axis, -gap, 0), offset(c, axis, gap, 0)].entries()) {
    entities.push(lineEntity(`${id}-flange-${index}`, offset(point, axis, 0, -size), offset(point, axis, 0, size), 'FLANGES'));
  }
  return 2;
}

function addTeeSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight) * 0.75;
  entities.push(lineEntity(`${id}-tee-cross`, offset(c, axis, 0, -size), offset(c, axis, 0, size), 'TEES'));
  entities.push(lineEntity(`${id}-tee-cap`, offset(c, axis, -size, size), offset(c, axis, size, size), 'TEES'));
  return 2;
}

function addReducerSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight);
  const leftTop = offset(c, axis, -size, size * 0.8);
  const leftBottom = offset(c, axis, -size, -size * 0.8);
  const rightTop = offset(c, axis, size, size * 0.35);
  const rightBottom = offset(c, axis, size, -size * 0.35);
  entities.push(lineEntity(`${id}-reducer-top`, leftTop, rightTop, 'REDUCERS'));
  entities.push(lineEntity(`${id}-reducer-bottom`, leftBottom, rightBottom, 'REDUCERS'));
  entities.push(lineEntity(`${id}-reducer-left`, leftTop, leftBottom, 'REDUCERS'));
  entities.push(lineEntity(`${id}-reducer-right`, rightTop, rightBottom, 'REDUCERS'));
  return 4;
}

function addOletSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const c = midpoint(p1, p2);
  const size = symbolSize(axis.length, textHeight) * 0.75;
  const base1 = offset(c, axis, -size, 0);
  const base2 = offset(c, axis, size, 0);
  const boss = offset(c, axis, 0, size);
  entities.push(lineEntity(`${id}-olet-base`, base1, base2, 'OLETS'));
  entities.push(lineEntity(`${id}-olet-left`, base1, boss, 'OLETS'));
  entities.push(lineEntity(`${id}-olet-right`, base2, boss, 'OLETS'));
  return 3;
}

function addElbowSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const size = Math.min(symbolSize(axis.length, textHeight), axis.length / 2);
  const points = [];
  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6;
    const along = -size + size * 2 * t;
    const bulge = Math.sin(Math.PI * t) * size * 0.55;
    points.push(offset(midpoint(p1, p2), axis, along, bulge));
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    entities.push(lineEntity(`${id}-elbow-${i}`, points[i], points[i + 1], 'ELBOWS'));
  }
  return Math.max(points.length - 1, 0);
}

function addNozzleSymbol(entities, id, p1, p2, textHeight) {
  const axis = vector(p1, p2);
  if (!axis) return 0;
  const end = p2;
  const size = symbolSize(axis.length, textHeight) * 0.65;
  entities.push(lineEntity(`${id}-nozzle-face`, offset(end, axis, 0, -size), offset(end, axis, 0, size), 'NOZZLES'));
  entities.push(lineEntity(`${id}-nozzle-stem`, offset(end, axis, -size, 0), offset(end, axis, size, 0), 'NOZZLES'));
  return 2;
}

function addSupportSymbol(entities, id, point, textHeight, supportType = 'unknown') {
  const size = Math.max(numberOr(textHeight, 2.5) * 2, 1);
  const left = { x: point.x - size, y: point.y - size, z: point.z };
  const right = { x: point.x + size, y: point.y - size, z: point.z };
  const baseLeft = { x: point.x - size * 1.4, y: point.y - size * 1.35, z: point.z };
  const baseRight = { x: point.x + size * 1.4, y: point.y - size * 1.35, z: point.z };
  let count = 0;

  const add = (suffix, a, b) => {
    entities.push(lineEntity(`${id}-${supportType}-${suffix}`, a, b, 'SUPPORTS'));
    count += 1;
  };

  if (supportType === 'guide') {
    add('bar-a', { x: point.x - size, y: point.y + size, z: point.z }, { x: point.x - size, y: point.y - size, z: point.z });
    add('bar-b', { x: point.x + size, y: point.y + size, z: point.z }, { x: point.x + size, y: point.y - size, z: point.z });
    add('base', baseLeft, baseRight);
    return count;
  }
  if (supportType === 'limit' || supportType === 'lineStop') {
    add('plate', { x: point.x, y: point.y + size, z: point.z }, { x: point.x, y: point.y - size, z: point.z });
    add('stop-a', { x: point.x, y: point.y, z: point.z }, { x: point.x - size, y: point.y - size, z: point.z });
    add('stop-b', { x: point.x, y: point.y, z: point.z }, { x: point.x + size, y: point.y - size, z: point.z });
    return count;
  }
  if (supportType === 'anchor') {
    const tl = { x: point.x - size, y: point.y + size, z: point.z };
    const tr = { x: point.x + size, y: point.y + size, z: point.z };
    const br = { x: point.x + size, y: point.y - size, z: point.z };
    const bl = { x: point.x - size, y: point.y - size, z: point.z };
    add('box-a', tl, tr); add('box-b', tr, br); add('box-c', br, bl); add('box-d', bl, tl); add('diag', tl, br);
    return count;
  }
  if (supportType === 'hanger') {
    add('rod', { x: point.x, y: point.y + size * 1.6, z: point.z }, point);
    add('left', point, left);
    add('right', point, right);
    add('base', baseLeft, baseRight);
    return count;
  }

  add('left', point, left);
  add('right', point, right);
  add('base', baseLeft, baseRight);
  return count;
}

function addComponentSymbol(entities, segment, p1, p2, textHeight) {
  const id = segment.id || segment.componentId || 'segment';
  const type = normType(segment.type || segment.layer || segment.componentType);
  if (segment.layer === 'VALVES' || type.includes('VALVE')) return addValveSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'FLANGES' || type.includes('FLANGE') || type.includes('GASKET')) return addFlangeSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'TEES' || type.includes('TEE')) return addTeeSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'REDUCERS' || type.includes('REDUCER')) return addReducerSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'OLETS' || type.includes('OLET') || type.includes('BOSS')) return addOletSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'ELBOWS' || type.includes('ELBOW') || type.includes('BEND')) return addElbowSymbol(entities, id, p1, p2, textHeight);
  if (segment.layer === 'NOZZLES' || type.includes('NOZZLE')) return addNozzleSymbol(entities, id, p1, p2, textHeight);
  return 0;
}

function shouldLabelSegment(segment, outputMode, options) {
  if (options.showLabels === false) return false;
  if (options.showSegmentLabels === true) return Boolean(segment.label);
  if (outputMode === 'geometry' && options.showSegmentLabels !== false) return Boolean(segment.label);
  return false;
}

function shouldLabelComponent(segment, options) {
  if (options.showLabels === false || options.showComponentLabels === false) return false;
  return Boolean(segment.label) && !['PIPING', 'PIPING_CENTER', 'PIPING_BODY'].includes(segment.layer || '');
}

function shouldLabelSupport(support, options) {
  if (options.showLabels === false || options.showSupportLabels === false) return false;
  return Boolean(support.label);
}

function supportTypeCounts(supports) {
  return supports.reduce((acc, support) => {
    const key = support.supportType || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function writeInputXmlDxf({ segments = [], supports = [], branches = [], diagnostics = [] } = {}, options = {}) {
  const scale = Math.max(numberOr(options.dxfScale, 1), Number.EPSILON);
  const textHeight = numberOr(options.textHeight, 2.5);
  const showSymbols = options.showSymbols !== false;
  const outputMode = normalizeOutputMode(options.outputMode || options.dxfOutputMode);
  const projectionMode = resolveProjectionMode(options, outputMode);
  const pipeBodyMode = normalizePipeBodyMode(options.pipeBodyMode || options.dxfPipeBodyMode, outputMode);
  const pipeWidth = Math.max(numberOr(options.pipeWidth || options.dxfPipeWidth, textHeight * 0.7), 0);
  const selectedBranchIds = Array.isArray(options.selectedBranchIds) ? options.selectedBranchIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const branchManifest = branches.map(normalizeBranch);
  const selectedBranches = branchManifest.filter((branch) => branchSelected(branch, selectedBranchIds));
  const baseSegmentPoints = segments.flatMap((segment) => [projectScaledPoint(segment.p1, scale, projectionMode), projectScaledPoint(segment.p2, scale, projectionMode)]);
  const baseSupportPoints = supports.map((support) => projectScaledPoint(support.point, scale, projectionMode));
  const paper = createPaperTransform([...baseSegmentPoints, ...baseSupportPoints], outputMode, options);
  const entities = [];
  let symbolCount = 0;
  let pipeBodyCount = 0;

  for (const segment of segments) {
    const p1 = paper.apply(projectScaledPoint(segment.p1, scale, projectionMode));
    const p2 = paper.apply(projectScaledPoint(segment.p2, scale, projectionMode));
    const layer = segment.layer || 'PIPING';
    const axis = vector(p1, p2);
    if (pipeBodyMode === 'thick-2d') {
      pipeBodyCount += addPipeBody(entities, segment.id || segment.componentId, p1, p2, pipeWidth, layer === 'PIPING' ? 'PIPING_BODY' : `${layer}_BODY`);
    }
    entities.push(lineEntity(segment.id || segment.componentId, p1, p2, pipeBodyMode === 'thick-2d' ? (layer === 'PIPING' ? 'PIPING_CENTER' : layer) : layer));
    if (showSymbols) symbolCount += addComponentSymbol(entities, segment, p1, p2, textHeight);
    if (shouldLabelSegment(segment, outputMode, options)) {
      entities.push(textEntity(`${segment.id || segment.componentId}-label`, labelOffset(midpoint(p1, p2), axis, textHeight), segment.label, 'LABELS', textHeight));
    } else if (shouldLabelComponent(segment, options)) {
      entities.push(textEntity(`${segment.id || segment.componentId}-component-label`, labelOffset(midpoint(p1, p2), axis, textHeight, 2.8), segment.label, 'COMPONENT_LABELS', textHeight));
    }
  }

  for (const support of supports) {
    const point = paper.apply(projectScaledPoint(support.point, scale, projectionMode));
    entities.push(pointEntity(support.id || support.componentId, point, 'SUPPORTS'));
    if (showSymbols) symbolCount += addSupportSymbol(entities, support.id || support.componentId || 'support', point, textHeight, support.supportType || 'unknown');
    if (shouldLabelSupport(support, options)) {
      const labelPoint = { x: point.x + textHeight * 2.2, y: point.y + textHeight * 1.6, z: point.z };
      entities.push(textEntity(`${support.id || support.componentId}-support-label`, labelPoint, support.label, 'SUPPORT_LABELS', textHeight));
    }
  }

  const layers = [...new Set([
    'PIPING', 'PIPING_CENTER', 'PIPING_BODY', 'VALVES', 'FLANGES', 'TEES', 'REDUCERS', 'OLETS', 'ELBOWS', 'NOZZLES', 'SUPPORTS', 'LABELS', 'COMPONENT_LABELS', 'SUPPORT_LABELS',
    ...entities.map((tokens) => {
      const layerIndex = tokens.indexOf('8');
      return layerIndex >= 0 ? tokens[layerIndex + 1] : '';
    }).filter(Boolean),
  ])];

  const selectedCount = selectedBranchIds.length ? selectedBranches.length : branchManifest.length;

  return {
    dxf: createDxfDocument({ layers, entities }),
    sidecar: {
      schema: 'inputxml-dxf-sidecar/v1',
      source: options.sourceName || '',
      outputMode,
      projectionMode,
      pipeBodyMode,
      pipeWidth,
      drawing: {
        sheet: paper.sheet,
        fitScale: paper.fitScale,
        extentsBeforeFit: paper.extentsBefore,
        extentsAfterFit: paper.extentsAfter,
      },
      branchCount: branchManifest.length,
      selectedBranchCount: selectedCount,
      selectedBranchIds,
      branches: branchManifest,
      selectedBranches,
      segmentCount: segments.length,
      supportCount: supports.length,
      supportTypeCounts: supportTypeCounts(supports),
      symbolCount,
      pipeBodyCount,
      layers,
      labelPolicy: {
        segmentLabels: options.showSegmentLabels === true || (outputMode === 'geometry' && options.showSegmentLabels !== false),
        componentLabels: options.showLabels !== false && options.showComponentLabels !== false,
        supportLabels: options.showLabels !== false && options.showSupportLabels !== false,
      },
      diagnostics,
    },
  };
}
