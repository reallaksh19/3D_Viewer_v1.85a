import * as THREE from 'three';

export function resolveInspectableObject(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData?.glbSupportSymbolMesh || cur.userData?.glbSupportSymbolRole) {
      cur = cur.parent;
      continue;
    }
    if (cur.userData?.glbSupportSymbol) return cur;
    if (String(cur.userData?.glbShape || '').startsWith('support-reference-v2-')) return null;
    if (cur.userData?.pcfId || cur.userData?.REF_NO || cur.userData?.id) return cur;
    if (Object.keys(cur.userData || {}).length > 0) return cur;
    cur = cur.parent;
  }
  return obj;
}

export function createSelection(getCamera, scene, domElement) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let selectionCallback = null;
  let activeHighlightObject = null;
  let pointerStart = null;

  const selectAt = (e) => {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, getCamera());
    const intersects = raycaster.intersectObjects(scene.children, true);

    let clickedObject = null;
    for (const intersect of intersects) {
        // Skip helpers (assuming helpers don't have userData.pcfId and are not Meshes we care about)
        
        if (intersect.object.type === 'Mesh') {
            clickedObject = resolveInspectableObject(intersect.object);
            if (clickedObject) {
                break;
            }
        }
    }

    // Un-highlight previous
    if (activeHighlightObject && activeHighlightObject !== clickedObject) {
        activeHighlightObject.traverse((node) => {
            if (node.isMesh && node.material && node.userData.originalEmissive !== undefined) {
                node.material.emissive.setHex(node.userData.originalEmissive);
                node.material.emissiveIntensity = node.userData.originalIntensity;
            }
        });
    }

    // Highlight new
    if (clickedObject && activeHighlightObject !== clickedObject) {
        clickedObject.traverse((node) => {
            if (node.isMesh && node.material) {
                if (node.userData.originalEmissive === undefined) {
                    node.userData.originalEmissive = node.material.emissive.getHex();
                    node.userData.originalIntensity = node.material.emissiveIntensity || 0;
                }
                node.material = node.material.clone(); // ensure unique material to not highlight instances globally
                node.material.emissive.setHex(0x3b82f6); // Neon Blue
                node.material.emissiveIntensity = 0.8;
            }
        });
    }
    
    activeHighlightObject = clickedObject;
    if (selectionCallback) {
      selectionCallback(clickedObject);
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  const onPointerUp = (event) => {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
      pointerStart = null;
      return;
    }
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 4) return;
    selectAt(event);
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);

  return {
    onSelect: (fn) => { selectionCallback = fn; },
    dispose: () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
    }
  };
}
