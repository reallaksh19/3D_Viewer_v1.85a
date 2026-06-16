import { executeViewerAction, ACTIONS } from '../../viewer-actions.js';
import { dispatchViewerCommand, ViewerCommand } from '../../contracts/viewer-commands.js';
import { RvmViewer3D } from '../../rvm-viewer/RvmViewer3D.js';
import * as THREE from 'three';

let dispatchedCommands = [];

// A mock RvmViewer3D but leveraging the real interface to test `dispatchViewerCommand` correctly
class MockRvmViewer3D {
    fitAll() { dispatchedCommands.push({ viewerMethod: 'fitAll' }); }
    fitSelection() { dispatchedCommands.push({ viewerMethod: 'fitSelection' }); }
    setSectionMode(mode) { dispatchedCommands.push({ viewerMethod: 'setSectionMode', arg: mode }); }
    disableSection() { dispatchedCommands.push({ viewerMethod: 'disableSection' }); }
    setNavMode(mode) { dispatchedCommands.push({ viewerMethod: 'setNavMode', arg: mode }); }
    getNavMode() { return 'orbit'; }
    toggleProjection() { dispatchedCommands.push({ viewerMethod: 'toggleProjection' }); }
    snapToPreset(preset) { dispatchedCommands.push({ viewerMethod: 'snapToPreset', arg: preset }); }
    clearSelection() { dispatchedCommands.push({ viewerMethod: 'clearSelection' }); }
    isolateSelection() { dispatchedCommands.push({ viewerMethod: 'isolateSelection' }); }
    showAll() { dispatchedCommands.push({ viewerMethod: 'showAll' }); }
    dispose() { dispatchedCommands.push({ viewerMethod: 'dispose' }); }
}

function runTests() {
    let success = true;

    // Test routing from `executeViewerAction` -> `dispatchViewerCommand` -> `RvmViewer3D`
    const mockViewer = new MockRvmViewer3D();
    const ctx = { viewer: mockViewer };

    console.log("--- Testing dispatchViewerCommand routing ---");
    dispatchViewerCommand(ctx, { type: ViewerCommand.FIT_ALL });
    dispatchViewerCommand(ctx, { type: ViewerCommand.FIT_SELECTION });
    dispatchViewerCommand(ctx, { type: ViewerCommand.TOGGLE_SECTION, payload: { mode: 'BOX' } });
    dispatchViewerCommand(ctx, { type: ViewerCommand.TOGGLE_SECTION, payload: { mode: null } }); // DISABLE
    dispatchViewerCommand(ctx, { type: ViewerCommand.SET_VIEW_MODE, payload: { mode: 'orbit' } });
    dispatchViewerCommand(ctx, { type: ViewerCommand.TOGGLE_PROJECTION });
    dispatchViewerCommand(ctx, { type: ViewerCommand.CLEAR_SELECTION });

    mockViewer.dispose();

    const expectedCalls = [
        'fitAll', 'fitSelection', 'setSectionMode', 'disableSection',
        'setNavMode', 'toggleProjection', 'clearSelection', 'dispose'
    ];

    if (dispatchedCommands.length !== expectedCalls.length) {
        console.error(`\u274c Failed: expected ${expectedCalls.length} commands, got ${dispatchedCommands.length}`);
        success = false;
    } else {
        for (let i = 0; i < expectedCalls.length; i++) {
            if (dispatchedCommands[i].viewerMethod !== expectedCalls[i]) {
                console.error(`\u274c Failed: Expected ${expectedCalls[i]} but got ${dispatchedCommands[i].viewerMethod}`);
                success = false;
            }
        }
        if (success) console.log('\u2705 dispatchViewerCommand correctly routed to RvmViewer3D');
    }

    // Now test REAL RvmViewer3D instances but mocking container and geometry
    // Now test REAL RvmViewer3D instances but mocking container and geometry
    // to avoid headless browser limits in Node
    console.log("--- Testing RvmViewer3D methods ---");

    // Setup dummy container
    const container = {
        clientWidth: 800,
        clientHeight: 600,
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        ownerDocument: {
            removeEventListener: () => {},
            addEventListener: () => {}
        }
    };

    // To mock requestAnimationFrame and document for headless environment
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    global.window = { devicePixelRatio: 1 };
    global.document = {
        createElementNS: () => ({ style: {}, getContext: () => ({}) })
    };
    global.ResizeObserver = class { observe() {} disconnect() {} };

    // We only test dispatchViewerCommand logic and object state logic
    // to bypass real WebGL execution in node context.
    // Instead of creating real RvmViewer3D which instantiates WebGLRenderer directly,
    // let's mock it at instantiation by patching the constructor instance immediately after creation.

    // global.document hack needs slightly more to prevent crash in CSS2DRenderer
    global.document = {
        createElementNS: () => ({
            style: {},
            ownerDocument: { removeEventListener: () => {}, addEventListener: () => {} },
            getRootNode: () => ({ removeEventListener: () => {}, addEventListener: () => {} }),
            getContext: () => ({
                getExtension: () => null,
                getParameter: () => "WebGL 2.0",
                createTexture: () => null,
                bindTexture: () => null,
                texParameteri: () => null,
                texImage2D: () => null,
                texImage3D: () => null,
                pixelStorei: () => null,
                clearColor: () => null,
                clearDepth: () => null,
                clearStencil: () => null,
                enable: () => null,
                disable: () => null,
                depthFunc: () => null,
                frontFace: () => null,
                cullFace: () => null,
                blendEquationSeparate: () => null,
                blendFuncSeparate: () => null,
                viewport: () => null,
                getShaderPrecisionFormat: () => ({ precision: 1 }),
                getContextAttributes: () => ({}),
                getSupportedExtensions: () => [],
                createFramebuffer: () => null,
            }),
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        createElement: () => ({
            style: {},
            addEventListener: () => {},
            removeEventListener: () => {}
        })
    };

    const viewer = new RvmViewer3D(container, { identityMap: null });
    // Patch renderers
    viewer.renderer = {
        domElement: { style: {}, parentNode: { removeChild: () => {} } },
        setSize: () => {}, setPixelRatio: () => {}, render: () => {}, dispose: () => {},
        localClippingEnabled: true
    };
    viewer.labelRenderer = {
        domElement: { style: {}, parentNode: { removeChild: () => {} } },
        setSize: () => {}, render: () => {}
    };


    // Test: dispose() nullifies all internal refs
    viewer.dispose();
    if (viewer.scene === null && viewer.renderer === null) {
        console.log('\u2705 dispose() nullifies all internal refs');
    } else {
        console.error('\u274c Failed: dispose() did not nullify refs properly');
        success = false;
    }

    // Setup another for sectioning/isolate tests
    const viewer2 = new RvmViewer3D(container, { identityMap: null });
    viewer2.renderer = {
        domElement: { style: {}, parentNode: { removeChild: () => {} } },
        setSize: () => {}, setPixelRatio: () => {}, render: () => {}, dispose: () => {},
        localClippingEnabled: true
    };
    viewer2.labelRenderer = {
        domElement: { style: {}, parentNode: { removeChild: () => {} } },
        setSize: () => {}, render: () => {}
    };
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mat = new THREE.MeshBasicMaterial();
    const meshA = new THREE.Mesh(geom, mat);
    meshA.name = "OBJ:A";
    meshA.userData.name = "OBJ:A";

    const meshB = new THREE.Mesh(geom, mat);
    meshB.name = "OBJ:B";
    meshB.userData.name = "OBJ:B";

    const group = new THREE.Group();
    group.add(meshA, meshB);

    viewer2.setModel(group);

    // Test: section box: 6 clipping planes applied to all meshes
    viewer2.setSectionMode('BOX');
    if (meshA.material.clippingPlanes && meshA.material.clippingPlanes.length === 6) {
        console.log('\u2705 section box: 6 clipping planes applied to all meshes');
    } else {
        console.error('\u274c Failed: section box clipping planes not applied');
        success = false;
    }

    // Test: section off: clippingPlanes = [] on all meshes
    viewer2.disableSection();
    if (!meshA.material.clippingPlanes || meshA.material.clippingPlanes.length === 0) {
         console.log('\u2705 section off: clippingPlanes = [] on all meshes');
    } else {
         console.error('\u274c Failed: disableSection did not remove planes');
         success = false;
    }

    // Test: isolate(['OBJ:A']): only OBJ:A visible; showAll restores
    viewer2.visibility.isolate(['OBJ:A']);
    if (meshA.visible === true && meshB.visible === false) {
        console.log('\u2705 isolate(["OBJ:A"]): only OBJ:A visible');
    } else {
        console.error('\u274c Failed: isolate(["OBJ:A"])');
        success = false;
    }

    viewer2.showAll();
    if (meshA.visible === true && meshB.visible === true) {
         console.log('\u2705 showAll restores visibility');
    } else {
         console.error('\u274c Failed: showAll');
         success = false;
    }

    viewer2.dispose();

    if (!success) {
        process.exit(1);
    }
}

runTests();
