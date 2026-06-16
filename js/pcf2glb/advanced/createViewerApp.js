import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createRenderer } from './createRenderer.js';
import { createCameraController } from './createCameraController.js';
import { createToolbar } from './createToolbar.js';
import { buildSceneIndex } from './sceneIndex.js';
import { createSelection } from './createSelection.js';
import { createPropertyPanel } from './createPropertyPanel.js';
import { createHeatmap } from './createHeatmap.js';
import { createSectionBox } from './createSectionBox.js';
import { createMarqueeZoom } from './createMarqueeZoom.js';
import { disposeScene } from './disposeRuntime.js';
import { createAxisHelper } from './createAxisHelper.js';
import { createDebugPanel } from './createDebugPanel.js';
// import { computeBoundingMeasurement } from '../pro-editor/core/measureUtils.js';

export function createViewerApp(previewContainer, toolbarContainer, propPanel, propContent, debugLogsContainer) {

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Defer initialization to first frame to ensure container has size
  let initialized = false;
  let renderer, domElement, disposeRenderer, camera, controller, axesHelper, dirLight, pointLight, toolbar;
  let currentRoot = null;
  let animationId;
  let sceneIndex = null;
  let propertyPanel = null;
  let heatmap = null;
  let sectionBox = null;
  let debugPanel = null;
  let selection = null;
  let css2dRenderer = null;
  let msgCircleGroup = new THREE.Group();
  let msgSquareGroup = new THREE.Group();
  let measureEnabled = false;
  let measurementListener = null;
  let measureStateListener = null;
  let sectionEnabled = false;

  const init = () => {
    if (initialized || !previewContainer.clientWidth) return;
    initialized = true;

    const renderData = createRenderer(previewContainer);
    renderer = renderData.renderer;
    domElement = renderData.domElement;
    disposeRenderer = renderData.dispose;

    // CSS2D overlay for MESSAGE-CIRCLE labels
    css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
    css2dRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;';
    previewContainer.style.position = 'relative';
    previewContainer.appendChild(css2dRenderer.domElement);
    scene.add(msgCircleGroup);
    scene.add(msgSquareGroup);

    window.addEventListener('resize', () => {
      if (css2dRenderer) css2dRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
    });

    camera = new THREE.PerspectiveCamera(60, previewContainer.clientWidth / previewContainer.clientHeight, 0.1, 10000000);

    controller = createCameraController(camera, domElement);

    axesHelper = createAxisHelper(camera, domElement);
    // ViewHelper automatically attaches to camera, no need to add to scene

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    scene.add(dirLight);

    pointLight = new THREE.PointLight(0xffffff, 0.5);
    camera.add(pointLight);
    scene.add(camera);

    toolbar = createToolbar(toolbarContainer, controller);
    toolbar.setFitHandler(() => {
       if (currentRoot) controller.fitScene(currentRoot);
    });
    toolbar.setMeasureHandler((enabled) => {
      measureEnabled = !!enabled;
      if (measureStateListener) measureStateListener(measureEnabled);
      if (!measureEnabled && measurementListener) measurementListener(null);
    });

    propertyPanel = createPropertyPanel(propPanel, propContent);
    heatmap = createHeatmap(scene);
    sectionBox = createSectionBox(scene, renderer);

    debugPanel = createDebugPanel(debugLogsContainer);

    // Wire up marquee zoom (Shift + Drag)
    const getActiveCamera = () => controller.getActiveCamera();
    const marqueeZoom = createMarqueeZoom(getActiveCamera, scene, domElement, controller);

    toolbar.setSectionHandler((enabled) => {
        sectionEnabled = !!enabled;
        if (enabled) {
            sectionBox.enable();
            if (currentRoot) sectionBox.fitToScene(currentRoot);
        } else {
            sectionBox.disable(currentRoot);
        }
    });

    selection = createSelection(getActiveCamera, scene, domElement);
    selection.onSelect((clickedObj) => {
        if (!clickedObj || !sceneIndex) {
            controller.resetTarget();
            propertyPanel.hide();
            if (measurementListener) measurementListener(null);
            return;
        }

        const id = clickedObj.userData.pcfId || clickedObj.name || clickedObj.uuid;
        const item = sceneIndex.byId.get(id);

        if (item) {
            controller.fitObject(item.object3D);
            propertyPanel.show(item);
            if (measureEnabled && measurementListener) {
              const measurement = null; // computeBoundingMeasurement(item.object3D);
              measurementListener({
                id,
                width: Number(measurement.width || 0),
                height: Number(measurement.height || 0),
                depth: Number(measurement.depth || 0),
                diagonal: Number(measurement.diagonal || 0),
              });
            } else if (measurementListener) {
              measurementListener(null);
            }

            // Auto section fit to selection if enabled
            if (sectionBox && sectionBox.isEnabled()) {
                sectionBox.fitToSelection(item.object3D, currentRoot);
            }
        }
    });

    // Handle view helper clicks
    domElement.addEventListener('pointerup', (event) => {
      if (axesHelper && axesHelper.handleClick(event)) {
          // Handled by view helper
      }
    });

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controller.update();
      renderer.autoClear = true;
      renderer.render(scene, controller.getActiveCamera());
      if (css2dRenderer) css2dRenderer.render(scene, controller.getActiveCamera());
      if (axesHelper) {
          renderer.autoClear = false;
          axesHelper.render(renderer);
      }
    };
    animate();
  };

  setTimeout(init, 100);

  return {
    get camera() { return camera; },
    set camera(cam) { camera = cam; },
    get orthographicCamera() { return controller?.getActiveCamera?.(); },
    get perspectiveCamera() { return camera; },
    setMeasureEnabled: (enabled) => {
      measureEnabled = !!enabled;
      toolbar?.setMeasureState?.(measureEnabled);
      if (measureStateListener) measureStateListener(measureEnabled);
      if (!measureEnabled && measurementListener) measurementListener(null);
    },
    setMeasureStateListener: (fn) => {
      measureStateListener = typeof fn === 'function' ? fn : null;
    },
    setMeasurementListener: (fn) => {
      measurementListener = typeof fn === 'function' ? fn : null;
    },
    fitAll: () => {
      if (currentRoot && controller) controller.fitScene(currentRoot);
    },
    setPresetView: (name) => {
      controller?.setPresetView?.(name);
    },
    toggleSection: () => {
      sectionEnabled = !sectionEnabled;
      if (sectionEnabled) {
        sectionBox?.enable?.();
        if (currentRoot) sectionBox?.fitToScene?.(currentRoot);
      } else {
        sectionBox?.disable?.(currentRoot);
      }
    },
    loadGLB: async (url) => {
      init();
      const loader = new GLTFLoader();
      return new Promise((resolve, reject) => {
          loader.load(url, (gltf) => {
              if (currentRoot) {
                  scene.remove(currentRoot);
                  disposeScene(currentRoot);
              }
              currentRoot = gltf.scene;
              scene.add(currentRoot);

              sceneIndex = buildSceneIndex(currentRoot);

              // Pre-compute metrics before fit to ensure camera far clip handles large scenes
              const box = new THREE.Box3().setFromObject(currentRoot);
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.sqrt(size.x*size.x + size.y*size.y + size.z*size.z);

              // ViewHelper sets its own scale, no need to scale it like axesHelper

              controller.fitScene(currentRoot);
              dirLight.position.copy(controller.getActiveCamera().position);

              debugPanel.log('system', 'info', `Loaded scene with ${sceneIndex.items.length} indexed objects`);

              // Inform toolbar of available properties
              const propSet = new Set();
              currentRoot.traverse(c => {
                  if (c.isMesh && c.userData) {
                      Object.keys(c.userData).forEach(k => {
                          if (k !== 'pcfId' && k !== 'pcfType') propSet.add(k);
                      });
                  }
              });
              toolbar.setProperties(Array.from(propSet).sort());

              toolbar.setHeatmapHandler((prop) => {
                  if (prop === 'default') {
                      heatmap.clearMetric();
                      toolbar.updateLegend(null);
                      return;
                  }

                  // For standalone meshes, we can adapt the heatmap signature
                  const valuesSet = new Set();
                  currentRoot.traverse(c => {
                      if (c.isMesh && c.userData && c.userData[prop] !== undefined) {
                          valuesSet.add(String(c.userData[prop]));
                      }
                  });
                  const uniqueValues = Array.from(valuesSet).sort();
                  const palettes = [
                      0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x46f0f0, 0xf032e6, 0xbcf60c, 0xfabebe,
                      0x008080, 0xe6beff, 0x9a6324, 0xfffac8, 0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0x808080,
                  ];
                  const colorMap = new Map();
                  uniqueValues.forEach((val, idx) => {
                      colorMap.set(val, palettes[idx % palettes.length]);
                  });

                  heatmap.clearMetric();
                  currentRoot.traverse(child => {
                      if (child.isMesh && child.userData) {
                          const mats = Array.isArray(child.material) ? child.material : [child.material];
                          mats.forEach(mat => {
                              if (!mat.userData.__baseColor) {
                                  mat.userData.__baseColor = mat.color.clone();
                              }
                              const val = String(child.userData[prop]);
                              if (child.userData[prop] !== undefined && colorMap.has(val)) {
                                  mat.color.setHex(colorMap.get(val));
                              } else {
                                  mat.color.set('#666666'); // Ghosted
                              }
                          });
                      }
                  });

                  let html = '';
                  uniqueValues.forEach(val => {
                      const colorHex = '#' + colorMap.get(val).toString(16).padStart(6, '0');
                      html += `<div style="display:flex; align-items:center; margin-bottom:4px;">
                          <span style="width:12px; height:12px; background:${colorHex}; display:inline-block; margin-right:6px; border:1px solid #fff;"></span>
                          <span>${val}</span>
                      </div>`;
                  });
                  toolbar.updateLegend(html);
              });

              resolve();
          }, undefined, reject);
      });
    },
    loadMessageSquareNodes: (nodes = []) => {
      while (msgSquareGroup.children.length) {
        msgSquareGroup.remove(msgSquareGroup.children[0]);
      }
      for (const { pos, text } of nodes) {
        if (!pos || !text) continue;
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = `
          font: 600 9px/1.2 "Courier New", monospace;
          color: #1a1a00;
          background: rgba(255,235,59,0.92);
          padding: 2px 5px;
          border: 1px solid rgba(161,120,0,0.6);
          border-radius: 3px;
          pointer-events: none;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        const obj = new CSS2DObject(div);
        obj.position.set(-pos.y, pos.z, -pos.x);
        obj.position.y += 14;
        obj.userData.type = 'msg-square-label';
        msgSquareGroup.add(obj);
      }
    },
    loadMessageCircleNodes: (nodes = []) => {
      // Clear existing labels
      while (msgCircleGroup.children.length) {
        msgCircleGroup.remove(msgCircleGroup.children[0]);
      }
      for (const { pos, text } of nodes) {
        if (!pos || !text) continue;
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = `
          font: 700 10px/1 "Courier New", monospace;
          color: #fff;
          background: #1a56db;
          padding: 2px 5px;
          border: 2px solid #93c5fd;
          border-radius: 999px;
          pointer-events: none;
          white-space: nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          letter-spacing: 0.03em;
        `;
        const obj = new CSS2DObject(div);
        // PCF coords: X=East, Y=North, Z=Up → Three.js (Z-up default): X=-Y, Y=Z, Z=-X
        obj.position.set(-pos.y, pos.z, -pos.x);
        obj.position.y += 8;
        obj.userData.type = 'msg-circle-label';
        msgCircleGroup.add(obj);
      }
    },
    dispose: () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (disposeRenderer) disposeRenderer();
      if (controller) controller.dispose();
      if (selection) selection.dispose();
      if (css2dRenderer?.domElement?.parentNode === previewContainer) {
        previewContainer.removeChild(css2dRenderer.domElement);
      }
    }
  };
}
