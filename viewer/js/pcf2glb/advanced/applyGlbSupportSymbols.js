import * as THREE from 'three';
import {
  RESTRAINT_VISUAL_PROFILE,
  SUPPORT_SYMBOL_COLORS,
  layerIdsForRestraintSupport,
  normalizeRestraintAxisLabel,
  normalizeRestraintKind,
  visualProfileMetadata,
} from '../glb/RestraintVisualProfile.js';

const GLB_SUPPORT_SYMBOLS_GROUP = `__GLB_SUPPORT_SYMBOLS_${RESTRAINT_VISUAL_PROFILE.id}__`;
const LAYER_SCHEMA = 'bm-cii-layer/v1';
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: options.emissiveIntensity ?? 0.16,
    roughness: 0.42,
    metalness: 0.06,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
}

function sourceOf(data = {}) {
  const layerSource = String(data.bmCiiLayer?.source || '').toLowerCase();
  const traceSource = String(data.bmCiiTrace?.supportSource || data.bmCiiTrace?.source || '').toLowerCase();
  const direct = String(data.supportSource || data.renderSource || '').toLowerCase();
  if (layerSource.includes('isonote') || traceSource.includes('isonote') || direct.includes('isonote')) return 'isonote';
  return 'inputxml';
}

function kindOf(data = {}) {
  return normalizeRestraintKind(
    data.supportKind || data.bmCiiTrace?.supportKind || data.bmCiiTrace?.kind || data.bmCiiLayer?.supportKind || data.pcfType || data.type,
  ) || 'UNKNOWN';
}

function axisLabelOf(data = {}) {
  return normalizeRestraintAxisLabel(
    data.bmCiiTrace?.axis || data.bmCiiTrace?.direction || data.bmCiiTrace?.restraintAxis || data.restraintAxis || data.bmCiiLayer?.axis || data.supportAxis,
  );
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
  if (raw.includes('Y')) return raw.startsWith('-') ? UP.clone().negate() : UP.clone();
  if (raw.includes('Z')) return raw.startsWith('-') ? Z_AXIS.clone().negate() : Z_AXIS.clone();
  return null;
}

function axisVectorOf(data = {}, axisLabel = '') {
  const rawAxis = data.bmCiiTrace?.axis || data.bmCiiTrace?.direction || data.restraintAxis || data.bmCiiLayer?.axis || data.supportAxis;
  let vector = vectorFrom(data.supportAxis) || vectorFrom(rawAxis) || axisVectorFromLabel(axisLabel) || X_AXIS.clone();
  if (data.supportAxisSpace === 'caesar-zup') vector = new THREE.Vector3(vector.x, vector.z, -vector.y);
  return vector.lengthSq() > 1e-8 ? vector.normalize() : X_AXIS.clone();
}

function orientAlongY(object, direction) {
  const dir = direction.clone().normalize();
  if (dir.lengthSq() < 1e-8) return;
  object.quaternion.setFromUnitVectors(UP, dir);
}

function cylinderBetween(start, end, color, radius, radialSegments = 14) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(start.clone().add(delta.multiplyScalar(0.5)));
  orientAlongY(mesh, new THREE.Vector3().subVectors(end, start));
  return mesh;
}

function arrow(start, end, color, radius, role = '') {
  const group = new THREE.Group();
  if (role) group.userData.glbSupportSymbolRole = role;
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length < 1e-6) return group;
  const dir = delta.clone().normalize();
  const headLength = Math.min(Math.max(radius * 5.0, length * 0.22), length * 0.42);
  const shaftEnd = end.clone().sub(dir.clone().multiplyScalar(headLength));
  const shaft = cylinderBetween(start, shaftEnd, color, radius, 14);
  if (shaft) group.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.8, headLength, 18), material(color));
  head.userData.glbSupportSymbolMesh = true;
  head.position.copy(shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5)));
  orientAlongY(head, dir);
  group.add(head);
  return group;
}

function torus(center, normal, major, minor, color) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, minor, 8, 24), material(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(center);
  orientAlongY(mesh, normal);
  return mesh;
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

function box(center, size, color, basis = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));
  mesh.userData.glbSupportSymbolMesh = true;
  mesh.position.copy(center);
  if (basis?.x && basis?.y && basis?.z) {
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.x.clone().normalize(), basis.y.clone().normalize(), basis.z.clone().normalize()));
  }
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

function pipeRadiusOf(data = {}, scale) {
  const raw = Number(data.supportPipeRadius || data.pipeRadius || data.boreRadius || data.bore || data.outsideDiameter || data.OutsideDiameter);
  if (Number.isFinite(raw) && raw > 0) return Math.min(Math.max(raw, scale * 0.10), scale * 0.45);
  return scale * 0.22;
}

function stampSupportMetadata(object, { source, kind, axisLabel, scale, role, pipeRadius }) {
  const layerIds = layerIdsForRestraintSupport({ source, kind, axisLabel });
  const visualProfile = visualProfileMetadata({ kind, source, axisLabel, scale, role });
  object.userData = {
    ...(object.userData || {}),
    bmCiiLayerSchema: LAYER_SCHEMA,
    bmCiiLayer: {
      schema: LAYER_SCHEMA,
      category: 'support',
      source,
      supportKind: normalizeRestraintKind(kind) || 'UNKNOWN',
      axis: normalizeRestraintAxisLabel(axisLabel),
      visibleDefault: kind !== 'UNKNOWN',
      layerIds,
      restraintVisualProfile: visualProfile.profile,
    },
    bmCiiLayerIds: layerIds,
    bmCiiRestraintVisualProfile: visualProfile,
    glbSupportRuntimeRole: role,
    supportPipeRadius: pipeRadius,
    supportSymbolContract: kind === 'GUIDE'
      ? 'lateral-arrows-touch-od-no-axis-marker'
      : kind === 'LINESTOP'
        ? 'axial-arrows-offset-od2-no-axis-marker'
        : kind === 'REST'
          ? 'vertical-arrow-touch-od'
          : '',
  };
}

function buildRest(group, pos, pipeRadius, scale, color) {
  const tip = pos.clone().add(UP.clone().multiplyScalar(-pipeRadius));
  const start = tip.clone().add(UP.clone().multiplyScalar(-scale * 0.92));
  group.add(arrow(start, tip, color, scale * 0.04, 'rest-vertical-arrow'));
}

function buildGuide(group, pos, pipeRadius, lateral, scale, color) {
  for (const sign of [1, -1]) {
    const tip = pos.clone().add(lateral.clone().multiplyScalar(sign * pipeRadius));
    const start = pos.clone().add(lateral.clone().multiplyScalar(sign * scale * 1.05));
    group.add(arrow(start, tip, color, scale * 0.048, 'guide-lateral-arrow'));
  }
}

function buildLineStop(group, pos, pipeRadius, pipeAxis, scale, color) {
  const surface = pos.clone().add(UP.clone().multiplyScalar(pipeRadius));
  for (const sign of [1, -1]) {
    const start = surface.clone().add(pipeAxis.clone().multiplyScalar(sign * scale * 1.10));
    group.add(arrow(start, surface, color, scale * 0.052, 'linestop-axial-arrow'));
  }
}

function buildLimit(group, pos, pipeRadius, axis, lateral, scale, color) {
  const limitAxis = axis.clone().normalize();
  const surface = pos.clone().add(UP.clone().multiplyScalar(pipeRadius));
  const side = lateral.clone().normalize();
  const basis = basisFrom(limitAxis, side);
  group.add(arrow(surface.clone().add(limitAxis.clone().multiplyScalar(scale * 1.12)), surface, color, scale * 0.042, 'limit-direction-arrow'));
  group.add(box(surface.clone().add(limitAxis.clone().multiplyScalar(scale * 0.26)).add(UP.clone().multiplyScalar(scale * 0.18)), new THREE.Vector3(scale * 0.040, scale * 0.28, scale * 0.16), 0xf59e0b, basis));
  group.add(box(surface.clone().add(limitAxis.clone().multiplyScalar(scale * 0.36)).add(UP.clone().multiplyScalar(scale * 0.18)), new THREE.Vector3(scale * 0.040, scale * 0.28, scale * 0.16), 0xf97316, basis));
}

function buildHanger(group, pos, pipeAxis, lateral, scale, color) {
  const topCenter = pos.clone().add(UP.clone().multiplyScalar(scale * 1.55));
  const pipeTop = pos.clone().add(UP.clone().multiplyScalar(scale * 0.15));
  group.add(box(topCenter, new THREE.Vector3(scale * 1.10, scale * 0.12, scale * 0.85), color, basisFrom(pipeAxis, lateral)));
  group.add(cylinderBetween(topCenter.clone().add(UP.clone().multiplyScalar(-scale * 0.08)), pipeTop, color, scale * 0.028, 12));
  for (let i = 0; i < 3; i += 1) group.add(torus(pos.clone().add(UP.clone().multiplyScalar(scale * (0.48 + i * 0.16))), UP, scale * 0.16, scale * 0.016, color));
}

function buildUnknown(group, pos, pipeAxis, lateral, scale, color) {
  group.add(torus(pos.clone().add(UP.clone().multiplyScalar(scale * 0.10)), pipeAxis, scale * 0.16, scale * 0.012, color));
}

function buildAnchor(group, pos, pipeRadius, pipeAxis, lateral, scale, color) {
  buildRest(group, pos, pipeRadius, scale, color);
  for (const dir of [UP, UP.clone().negate(), pipeAxis, pipeAxis.clone().negate(), lateral, lateral.clone().negate()]) {
    group.add(arrow(pos.clone(), pos.clone().add(dir.clone().normalize().multiplyScalar(scale * 0.72)), color, scale * 0.032, 'anchor-axis'));
  }
}

function disposeGroup(group) {
  group.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat?.dispose?.());
    else node.material?.dispose?.();
  });
}

function isBakedSupportReference(object) {
  const data = object.userData || {};
  const layer = data.bmCiiLayer || {};
  const name = String(object.name || '').toUpperCase();
  return String(data.glbShape || '').startsWith('support-reference-')
    || layer.category === 'support'
    || layer.layerIds?.includes?.('plant.restraints')
    || name.includes('BM_CII_RESTRAINT')
    || name.includes('SUPPORT_ARROW_V7');
}

function isCandidateSupportObject(object) {
  if (!object?.isMesh && object?.type !== 'Group') return false;
  const data = object.userData || {};
  if (data.glbSupportSymbolMesh || data.glbSupportSymbol || data.glbSupportSymbolRoot) return false;
  const layer = data.bmCiiLayer || {};
  const kind = kindOf(data);
  return Boolean(kind) || layer.category === 'support' || layer.layerIds?.includes?.('plant.restraints') || isBakedSupportReference(object);
}

function computeSymbolScale(root, options = {}) {
  const box3 = new THREE.Box3().setFromObject(root);
  const diagonal = box3.isEmpty() ? 1 : box3.getSize(new THREE.Vector3()).length();
  const scaleMultiplier = Number(options.scaleMultiplier) > 0 ? Number(options.scaleMultiplier) : 1.0;
  if (diagonal < 50) return Math.max(0.24, Math.min(0.90, diagonal * 0.082)) * scaleMultiplier;
  return Math.max(24, Math.min(200, diagonal * 0.050)) * scaleMultiplier;
}

function supportKey(kind, source, position, axisLabel) {
  return `${source}:${kind}:${axisLabel}:${position.x.toFixed(3)}:${position.y.toFixed(3)}:${position.z.toFixed(3)}`;
}

function hideBakedSupportMarkers(root) {
  root.traverse((object) => {
    if (!isBakedSupportReference(object)) return;
    object.visible = false;
    object.userData = { ...(object.userData || {}), glbSupportBakedFallback: false, hiddenByRuntimeSupportProfile: RESTRAINT_VISUAL_PROFILE.id };
  });
}

export function applyGlbSupportSymbols(root, scene, options = {}) {
  const existing = scene.getObjectByName(GLB_SUPPORT_SYMBOLS_GROUP) || root.getObjectByName?.(GLB_SUPPORT_SYMBOLS_GROUP);
  if (existing) {
    existing.parent?.remove?.(existing);
    disposeGroup(existing);
  }

  root.updateMatrixWorld(true);
  const scale = computeSymbolScale(root, options);
  const symbolRoot = new THREE.Group();
  symbolRoot.name = GLB_SUPPORT_SYMBOLS_GROUP;
  symbolRoot.userData = {
    glbSupportSymbolRoot: true,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
    bmCiiRestraintVisualProfile: visualProfileMetadata({ scale, role: 'runtime-symbol-root' }),
  };

  const seen = new Set();
  const worldPos = new THREE.Vector3();
  let scanned = 0;
  let hidden = 0;

  root.traverse((object) => {
    if (!isCandidateSupportObject(object)) return;
    const data = object.userData || {};
    const kind = kindOf(data);
    const source = sourceOf(data);
    const axisLabel = axisLabelOf(data);
    const restraintAxis = axisVectorOf(data, axisLabel);
    const pipeRadius = pipeRadiusOf(data, scale);

    object.getWorldPosition(worldPos);
    const key = supportKey(kind, source, worldPos, axisLabel);
    if (seen.has(key)) return;
    seen.add(key);
    scanned += 1;

    const pipeAxis = (kind === 'LINESTOP' || kind === 'LIMIT') ? horizontalAxisOrFallback(restraintAxis, Z_AXIS) : restraintAxis.clone().normalize();
    const lateral = kind === 'GUIDE' ? horizontalAxisOrFallback(restraintAxis, X_AXIS) : lateralAxis(pipeAxis);

    const group = new THREE.Group();
    group.name = `glb-support-${kind.toLowerCase()}-${source}-${object.name || object.uuid}`;
    group.userData = {
      glbSupportSymbolKind: kind,
      glbSupportSymbol: true,
      glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
      pcfId: data.pcfId || data.componentId || object.name || object.uuid,
      pcfType: data.pcfType || 'SUPPORT',
      refNo: data.refNo || data.REF_NO || '',
      lineNo: data.lineNo || '',
      supportKind: kind,
      supportSource: source,
      restraintAxis: axisLabel,
      supportAxis: { x: restraintAxis.x, y: restraintAxis.y, z: restraintAxis.z },
      supportPipeRadius: pipeRadius,
      bmCiiTrace: {
        ...(data.bmCiiTrace || {}),
        entity: 'support',
        supportKind: kind,
        supportSource: source,
        axis: axisLabel,
        renderGlyph: `runtime-${RESTRAINT_VISUAL_PROFILE.id}-${kind.toLowerCase()}`,
        renderScale: scale,
        visualProfile: RESTRAINT_VISUAL_PROFILE.id,
        supportSymbolContract: kind === 'GUIDE'
          ? 'lateral-arrows-touch-od-no-axis-marker'
          : kind === 'LINESTOP'
            ? 'axial-arrows-offset-od2-no-axis-marker'
            : kind === 'REST'
              ? 'vertical-arrow-touch-od'
              : '',
      },
      bmCiiRestraintVisualProfile: visualProfileMetadata({ kind, source, axisLabel, scale, role: 'runtime-symbol-root' }),
    };
    stampSupportMetadata(group, { source, kind, axisLabel, scale, role: 'runtime-symbol-root', pipeRadius });

    const color = SUPPORT_SYMBOL_COLORS[kind] || SUPPORT_SYMBOL_COLORS.UNKNOWN;
    const pos = worldPos.clone();
    if (kind === 'REST' || kind === 'SHOE' || kind === 'HOLDDOWN') buildRest(group, pos, pipeRadius, scale, color);
    else if (kind === 'GUIDE') buildGuide(group, pos, pipeRadius, lateral, scale, color);
    else if (kind === 'LINESTOP') buildLineStop(group, pos, pipeRadius, pipeAxis, scale, color);
    else if (kind === 'LIMIT') buildLimit(group, pos, pipeRadius, restraintAxis, lateral, scale, color);
    else if (kind === 'HANGER' || kind === 'SPRING') buildHanger(group, pos, pipeAxis, lateral, scale, color);
    else if (kind === 'ANCHOR') buildAnchor(group, pos, pipeRadius, pipeAxis, lateral, scale, color);
    else buildUnknown(group, pos, pipeAxis, lateral, scale, color);

    group.traverse((child) => stampSupportMetadata(child, { source, kind, axisLabel, scale, role: child.userData.glbSupportSymbolRole || 'runtime-symbol-child', pipeRadius }));
    if (group.children.length) symbolRoot.add(group);
  });

  hideBakedSupportMarkers(root);
  root.traverse((object) => { if (isBakedSupportReference(object)) hidden += 1; });

  const created = symbolRoot.children.length;
  if (created > 0) scene.add(symbolRoot);

  console.info('[glb-support-symbols]', { created, scanned, hidden, scale, profile: RESTRAINT_VISUAL_PROFILE.id, guide: 'lateral-arrows-touch-od-no-axis-marker', linestop: 'axial-arrows-offset-od2-no-axis-marker', rest: 'vertical-arrow-touch-od' });
  return { created, scanned, hidden, scale, profile: RESTRAINT_VISUAL_PROFILE.id };
}
