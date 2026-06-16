import * as THREE from 'three';
import {
  RESTRAINT_VISUAL_PROFILE,
  SUPPORT_SYMBOL_COLORS,
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
  visualProfileMetadata,
} from './RestraintVisualProfile.js';
import {
  normalizeSupportRecord,
  supportSymbolContractFor,
  supportTraceFromRecord,
} from './SupportRecordNormalizer.js';

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LAYER_SCHEMA = 'bm-cii-layer/v1';

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function attrsFrom(object, comp = {}) {
  return { ...(comp.raw || {}), ...(comp.attributes || {}), ...(object?.userData || {}) };
}

function vectorFrom(value) {
  if (Array.isArray(value)) {
    const v = new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
    return v.lengthSq() > 1e-8 ? v.normalize() : null;
  }
  if (value && typeof value === 'object') {
    const v = new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
    return v.lengthSq() > 1e-8 ? v.normalize() : null;
  }
  return null;
}

function axisVectorFromLabel(label) {
  const raw = String(label || '').toUpperCase();
  if (raw.includes('X')) return raw.startsWith('-') ? X_AXIS.clone().negate() : X_AXIS.clone();
  if (raw.includes('Y')) return raw.startsWith('-') ? Y_AXIS.clone().negate() : Y_AXIS.clone();
  if (raw.includes('Z')) return raw.startsWith('-') ? Z_AXIS.clone().negate() : Z_AXIS.clone();
  return null;
}

function axisVectorFrom(attrs = {}, comp = {}, axisLabel = '') {
  return vectorFrom(comp.supportAxis)
    || vectorFrom(attrs.supportAxis)
    || vectorFrom(attrs.SUPPORT_AXIS)
    || vectorFrom(attrs.caesarSupportAxis)
    || axisVectorFromLabel(axisLabel)
    || X_AXIS.clone();
}

function pipeRadiusFor(comp = {}, attrs = {}) {
  const bore = number(comp.bore ?? attrs.bore ?? attrs.BORE ?? attrs.DIAMETER ?? attrs.OutsideDiameter) || 100;
  return Math.max(bore / 2, 5);
}

function supportScaleFor(comp = {}, attrs = {}, options = {}) {
  const bore = number(comp.bore ?? attrs.bore ?? attrs.BORE ?? attrs.DIAMETER ?? attrs.OutsideDiameter) || 100;
  const multiplier = number(options.supportSymbolScale) || number(options.restraintSymbolScale) || 0.95;
  return Math.max(28, Math.min(190, bore * multiplier));
}

function sourceOf(attrs = {}, comp = {}, options = {}) {
  const raw = upper(options.supportRendering?.source || options.supportSource || comp.supportSource || comp.source || attrs.supportSource || attrs.SUPPORT_SOURCE || attrs['SUPPORT-SOURCE']);
  return raw.includes('ISONOTE') ? 'isonote' : 'inputxml';
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.10, roughness: 0.42, metalness: 0.08 });
}

function orientFromY(object, direction) {
  const dir = direction?.clone?.().normalize?.();
  if (!dir || dir.lengthSq() < 1e-8) return;
  object.quaternion.setFromUnitVectors(UP, dir);
}

function basisFrom(primary, lateral) {
  const x = primary.clone().normalize();
  let z = lateral.clone().normalize();
  if (z.lengthSq() < 1e-8 || Math.abs(z.dot(x)) > 0.96) {
    z = new THREE.Vector3().crossVectors(x, UP);
    if (z.lengthSq() < 1e-8) z = Z_AXIS.clone();
    z.normalize();
  }
  let y = new THREE.Vector3().crossVectors(z, x).normalize();
  if (y.dot(UP) < 0) y.negate();
  return { x, y, z };
}

function cylinderBetween(group, name, start, end, radius, color, radialSegments = 14) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(color));
  mesh.name = name;
  mesh.position.copy(start.clone().add(delta.multiplyScalar(0.5)));
  orientFromY(mesh, new THREE.Vector3().subVectors(end, start));
  group.add(mesh);
  return mesh;
}

function arrow(group, name, start, end, color, radius) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < 1e-6) return null;
  const dir = delta.clone().normalize();
  const headLength = Math.min(Math.max(radius * 5.0, length * 0.22), length * 0.42);
  const shaftEnd = end.clone().sub(dir.clone().multiplyScalar(headLength));
  cylinderBetween(group, `${name}-shaft`, start, shaftEnd, radius, color, 14);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.8, headLength, 18), material(color));
  head.name = `${name}-head`;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5)));
  orientFromY(head, dir);
  group.add(head);
  return head;
}

function box(group, name, center, size, color, basis = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));
  mesh.name = name;
  mesh.position.copy(center);
  if (basis?.x && basis?.y && basis?.z) {
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.x.clone().normalize(), basis.y.clone().normalize(), basis.z.clone().normalize()));
  }
  group.add(mesh);
  return mesh;
}

function torus(group, name, center, normal, major, minor, color) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, minor, 8, 24), material(color));
  mesh.name = name;
  mesh.position.copy(center);
  orientFromY(mesh, normal);
  group.add(mesh);
  return mesh;
}

function lateralAxis(pipeAxis) {
  const cross = new THREE.Vector3().crossVectors(pipeAxis, UP);
  if (cross.lengthSq() > 1e-8) return cross.normalize();
  const crossX = new THREE.Vector3().crossVectors(pipeAxis, X_AXIS);
  return crossX.lengthSq() > 1e-8 ? crossX.normalize() : Z_AXIS.clone();
}

function horizontalAxisOrFallback(axis, fallback) {
  const source = axis?.lengthSq?.() > 1e-8 ? axis.clone().normalize() : fallback.clone();
  const horizontal = source.sub(UP.clone().multiplyScalar(source.dot(UP)));
  return horizontal.lengthSq() > 1e-8 ? horizontal.normalize() : fallback.clone().normalize();
}

function buildRest(group, id, pos, pipeRadius, scale, color) {
  const tip = pos.clone().add(UP.clone().multiplyScalar(-pipeRadius));
  const start = tip.clone().add(UP.clone().multiplyScalar(-scale * 0.92));
  arrow(group, `${id}-rest-vertical-arrow`, start, tip, color, scale * 0.040);
}

function buildGuide(group, id, pos, pipeRadius, lateral, scale, color) {
  // GUIDE = lateral arrows only. Tips touch pipe circumference. No vertical/axis arrows and no plates.
  for (const sign of [1, -1]) {
    const tip = pos.clone().add(lateral.clone().multiplyScalar(sign * pipeRadius));
    const start = pos.clone().add(lateral.clone().multiplyScalar(sign * scale * 1.05));
    arrow(group, `${id}-guide-lateral-arrow-${sign > 0 ? 'positive' : 'negative'}`, start, tip, color, scale * 0.048);
  }
}

function buildLineStop(group, id, pos, pipeRadius, pipeAxis, scale, color) {
  // LINESTOP = axial arrows only. Arrows are offset vertically by OD/2 and converge to pipe circumference.
  const surface = pos.clone().add(UP.clone().multiplyScalar(pipeRadius));
  for (const sign of [1, -1]) {
    const start = surface.clone().add(pipeAxis.clone().multiplyScalar(sign * scale * 1.10));
    arrow(group, `${id}-linestop-axial-arrow-${sign > 0 ? 'positive' : 'negative'}`, start, surface, color, scale * 0.052);
  }
}

function buildLimit(group, id, pos, pipeRadius, axis, lateral, scale, color) {
  const limitAxis = axis.clone().normalize();
  const surface = pos.clone().add(UP.clone().multiplyScalar(pipeRadius));
  const basis = basisFrom(limitAxis, lateral);
  arrow(group, `${id}-limit-direction-arrow`, surface.clone().add(limitAxis.clone().multiplyScalar(scale * 1.12)), surface, color, scale * 0.042);
  box(group, `${id}-limit-gap-tick-a`, surface.clone().add(limitAxis.clone().multiplyScalar(scale * 0.26)).add(UP.clone().multiplyScalar(scale * 0.18)), new THREE.Vector3(scale * 0.040, scale * 0.28, scale * 0.16), 0xf59e0b, basis);
  box(group, `${id}-limit-gap-tick-b`, surface.clone().add(limitAxis.clone().multiplyScalar(scale * 0.36)).add(UP.clone().multiplyScalar(scale * 0.18)), new THREE.Vector3(scale * 0.040, scale * 0.28, scale * 0.16), 0xf97316, basis);
}

function buildHanger(group, id, pos, pipeAxis, lateral, scale, color) {
  const topCenter = pos.clone().add(UP.clone().multiplyScalar(scale * 1.55));
  const pipeTop = pos.clone().add(UP.clone().multiplyScalar(scale * 0.15));
  box(group, `${id}-hanger-top-plate`, topCenter, new THREE.Vector3(scale * 1.10, scale * 0.12, scale * 0.85), color, basisFrom(pipeAxis, lateral));
  cylinderBetween(group, `${id}-hanger-rod`, topCenter.clone().add(UP.clone().multiplyScalar(-scale * 0.08)), pipeTop, scale * 0.028, color, 12);
  for (let i = 0; i < 3; i += 1) {
    torus(group, `${id}-hanger-coil-${i + 1}`, pos.clone().add(UP.clone().multiplyScalar(scale * (0.48 + i * 0.16))), UP, scale * 0.16, scale * 0.016, color);
  }
}

function buildUnknown(group, id, pos, pipeAxis, lateral, scale) {
  const warning = new THREE.Mesh(new THREE.OctahedronGeometry(scale * 0.12, 0), material(0xf59e0b));
  warning.name = `${id}-unknown-warning`;
  warning.position.copy(pos.clone().add(UP.clone().multiplyScalar(scale * 0.35)));
  group.add(warning);
}

function buildAnchor(group, id, pos, pipeRadius, pipeAxis, lateral, scale, color) {
  buildRest(group, id, pos, pipeRadius, scale, color);
  for (const dir of [UP, UP.clone().negate(), pipeAxis, pipeAxis.clone().negate(), lateral, lateral.clone().negate()]) {
    arrow(group, `${id}-anchor-axis`, pos.clone(), pos.clone().add(dir.clone().normalize().multiplyScalar(scale * 0.72)), color, scale * 0.032);
  }
}

function hideExistingProxyMeshes(object, markerGroupName) {
  const hidden = [];
  for (const child of object.children || []) {
    if (child.name === markerGroupName) continue;
    child.traverse?.((node) => {
      if (node.isMesh) {
        node.visible = false;
        hidden.push(node.name || node.uuid);
      }
    });
  }
  return hidden;
}

function stampLayerMetadata(target, record, { scale, role }) {
  const profile = visualProfileMetadata({ kind: record.kind, source: record.source, axisLabel: record.axis, scale, role });
  target.userData = {
    ...(target.userData || {}),
    bmCiiLayerSchema: LAYER_SCHEMA,
    bmCiiLayer: {
      schema: LAYER_SCHEMA,
      category: 'support',
      source: record.source,
      supportKind: record.kind,
      axis: record.axis,
      visibleDefault: record.visibleDefault,
      layerIds: record.layerIds,
      restraintVisualProfile: profile.profile,
      supportGlyphRole: role,
    },
    bmCiiLayerIds: record.layerIds,
    supportKind: record.kind,
    supportSource: record.source,
    restraintAxis: record.axis,
    supportSymbolScale: scale,
    renderScale: scale,
    visualProfile: RESTRAINT_VISUAL_PROFILE.id,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiRestraintVisualProfile: profile,
    supportReferenceStyle: true,
    supportReferenceStyleV5: true,
    supportGlyphRole: role,
    supportSymbolContract: record.supportSymbolContract,
    supportRecordId: record.recordId,
  };
}

function stampGlyphMetadata(target, record, { scale, role, renderGlyph }) {
  stampLayerMetadata(target, record, { scale, role });
  const isRenderableRecordRoot = role === 'baked-symbol-root';
  target.userData = {
    ...(target.userData || {}),
    renderGlyph,
    bmCiiTrace: isRenderableRecordRoot
      ? supportTraceFromRecord(record, { renderGlyph, renderScale: scale, visualProfile: RESTRAINT_VISUAL_PROFILE.id })
      : {
        entity: 'supportPart',
        parentRecordId: record.recordId,
        supportRecordId: record.recordId,
        supportKind: record.kind,
        supportSource: record.source,
        supportSymbolContract: record.supportSymbolContract,
      },
  };
}

export function applyBakedRestraintGlyph(object, comp = {}, options = {}) {
  if (!object || comp.type !== 'SUPPORT') return object;

  const attrs = attrsFrom(object, comp);
  const source = sourceOf(attrs, comp, options);
  const sourceRecord = normalizeSupportRecord({ ...attrs, ...comp }, {
    source,
    supportSource: source,
    index: comp.supportRecordIndex ?? comp.recordIndex ?? comp.index ?? comp.supportIndex,
  });
  const kind = sourceRecord.kind;
  const axisLabel = sourceRecord.axis;
  const axis = axisVectorFrom(attrs, comp, axisLabel);
  const scale = supportScaleFor(comp, attrs, options);
  const pipeRadius = pipeRadiusFor(comp, attrs);
  const color = SUPPORT_SYMBOL_COLORS[kind] || SUPPORT_SYMBOL_COLORS.UNKNOWN;
  const id = text(comp.id || sourceRecord.recordId || object.name || 'support');

  const pipeAxis = (kind === 'LINESTOP' || kind === 'LIMIT') ? horizontalAxisOrFallback(axis, Z_AXIS) : axis.clone().normalize();
  const lateral = kind === 'GUIDE' ? horizontalAxisOrFallback(axis, X_AXIS) : lateralAxis(pipeAxis);

  const markerGroup = new THREE.Group();
  markerGroup.name = `${sourceRecord.recordId}-restraint-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}`;
  const renderGlyph = `baked-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}`;
  const origin = new THREE.Vector3(0, 0, 0);

  if (kind === 'REST' || kind === 'SHOE' || kind === 'HOLDDOWN') buildRest(markerGroup, id, origin, pipeRadius, scale, color);
  else if (kind === 'GUIDE') buildGuide(markerGroup, id, origin, pipeRadius, lateral, scale, color);
  else if (kind === 'LINESTOP') buildLineStop(markerGroup, id, origin, pipeRadius, pipeAxis, scale, color);
  else if (kind === 'LIMIT') buildLimit(markerGroup, id, origin, pipeRadius, axis, lateral, scale, color);
  else if (kind === 'ANCHOR') buildAnchor(markerGroup, id, origin, pipeRadius, pipeAxis, lateral, scale, color);
  else if (kind === 'HANGER' || kind === 'SPRING') buildHanger(markerGroup, id, origin, pipeAxis, lateral, scale, color);
  else buildUnknown(markerGroup, id, origin, pipeAxis, lateral, scale, color);

  const glyphMeshes = [];
  markerGroup.traverse((child) => { if (child.isMesh) glyphMeshes.push(child); });
  glyphMeshes.forEach((child, index) => stampGlyphMetadata(child, sourceRecord, { scale, role: index === 0 ? 'baked-symbol-root' : 'baked-symbol-child', renderGlyph }));
  stampLayerMetadata(markerGroup, sourceRecord, { scale, role: 'baked-group' });

  const hiddenOriginalProxyMeshes = hideExistingProxyMeshes(object, markerGroup.name);
  object.add(markerGroup);
  object.userData = {
    ...(object.userData || {}),
    labelText: object.userData?.labelText || `${id} ${kind}`,
    supportKind: kind,
    supportAxis: { x: axis.x, y: axis.y, z: axis.z },
    restraintAxis: axisLabel,
    supportSource: source,
    supportRecordId: sourceRecord.recordId,
    supportSymbolScale: scale,
    supportPipeRadius: pipeRadius,
    renderGlyph,
    renderScale: scale,
    visualProfile: RESTRAINT_VISUAL_PROFILE.id,
    glbShape: `support-reference-v6-${kind.toLowerCase()}`,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiTrace: supportTraceFromRecord(sourceRecord, { renderGlyph, renderScale: scale, visualProfile: RESTRAINT_VISUAL_PROFILE.id }),
    bmCiiRestraintVisualProfile: visualProfileMetadata({ kind, source, axisLabel, scale, role: 'baked-object-root' }),
    supportSymbolContract: sourceRecord.supportSymbolContract || supportSymbolContractFor(kind),
    directionalSupportEnhanced: true,
    directionalSupportSymbolCount: markerGroup.children.length,
    supportReferenceStyle: true,
    supportReferenceStyleV6: true,
    hiddenOriginalProxyMeshCount: hiddenOriginalProxyMeshes.length,
  };
  return object;
}
