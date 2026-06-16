import * as THREE from 'three';

function point3(point = {}) {
  const x = Number(point.x);
  const y = Number(point.y);
  const z = Number(point.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function text(value) {
  return String(value ?? '').trim();
}

export function buildNodeLabelObject(comp = {}) {
  const pt = point3(comp.coOrds || comp.centrePoint || comp.ep1);
  const label = text(
    comp.label
    || comp.refNo
    || comp.attributes?.NODE_LABEL
    || comp.raw?.NODE_LABEL
    || comp.id,
  );

  if (!pt || !label) return null;

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.25,
      roughness: 0.45,
    }),
  );

  marker.position.copy(pt);
  marker.name = `node-label:${label}`;
  marker.userData = {
    pcfType: 'NODE_LABEL',
    pcfId: comp.id || `node-label-${label}`,
    refNo: label,
    labelAnchor: true,
    labelKind: 'node',
    labelText: label,
    glbShape: 'node-label-anchor',
    NODE_LABEL: label,
    ...(comp.raw || {}),
    ...(comp.attributes || {}),
  };

  return marker;
}
