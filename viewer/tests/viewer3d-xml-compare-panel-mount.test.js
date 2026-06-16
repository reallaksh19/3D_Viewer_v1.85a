import assert from 'assert/strict';

function createContainer() {
  const listeners = {};
  let html = '';

  return {
    listeners,
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value);
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type, handler) {
      if (listeners[type] === handler) {
        delete listeners[type];
      }
    },
    contains() {
      return true;
    },
  };
}

function routeChangeEvent(value) {
  return {
    target: {
      closest(selector) {
        if (selector === '[data-v3d-xc-inputxml-route]') {
          return { value };
        }
        return null;
      },
    },
  };
}

function fileChangeEvent(datasetId, file) {
  return {
    target: {
      closest(selector) {
        if (selector === '[data-v3d-xc-load]') {
          return {
            dataset: { v3dXcLoad: datasetId },
            files: [file],
            value: 'keep',
          };
        }
        return null;
      },
    },
  };
}

function actionClickEvent(action) {
  return {
    target: {
      closest(selector) {
        if (selector === '[data-v3d-xc-action]') {
          return { dataset: { v3dXcAction: action } };
        }
        return null;
      },
    },
  };
}

function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function run() {
  console.log('--- viewer3d-xml-compare-panel-mount.test.js ---');

  const { mountXmlComparePanel } = await import('../tabs/viewer3d-xml-compare-panel.js');
  const { INPUTXML_IMPORT_ROUTES, INPUTXML_IMPORT_ROUTE_STORAGE_KEY } = await import('../xml-compare/InputXmlImportRoutes.js');

  const container = createContainer();
  const events = {
    loaded: [],
    preview: [],
    compare: [],
    cleared: 0,
  };

  const panel = mountXmlComparePanel(container, {
    onDatasetLoaded(datasetId, result) {
      events.loaded.push({ datasetId, result });
    },
    onPreviewOverlay(a, b) {
      events.preview.push([a, b]);
    },
    onCompare(a, b) {
      events.compare.push([a, b]);
    },
    onClear() {
      events.cleared += 1;
    },
  });

  assert.equal(panel.getState().routeStorageKey, INPUTXML_IMPORT_ROUTE_STORAGE_KEY);
  assert.equal(panel.getState().hasA, false);
  assert.equal(panel.getState().hasB, false);
  assert.ok(container.innerHTML.includes('v3d-xc-panel'));
  assert.ok(container.innerHTML.includes('InputXML Route'));
  assert.ok(container.innerHTML.includes('Load XML A'));
  assert.ok(container.innerHTML.includes('Load XML B'));
  assert.ok(container.innerHTML.includes('Preview'));
  assert.ok(container.innerHTML.includes('Compare'));
  assert.ok(container.innerHTML.includes('Clear'));

  container.listeners.change(routeChangeEvent(INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER));
  assert.equal(panel.getState().inputXmlRoute, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.ok(container.innerHTML.includes('Selected route: Native XML Builder'));

  const xmlText = `
    <InputXML>
      <Components>
        <Component id="P1" type="PIPE" pipelineRef="LINE-1" refNo="10" seqNo="1" ep1="0 0 0" ep2="100 0 0" bore="100" />
      </Components>
    </InputXML>
  `;

  const fileA = { name: 'sample-a.xml', text: async () => xmlText };
  const fileB = { name: 'sample-b.xml', text: async () => xmlText };

  container.listeners.change(fileChangeEvent('A', fileA));
  await waitForAsync();

  container.listeners.change(fileChangeEvent('B', fileB));
  await waitForAsync();

  assert.equal(events.loaded.length, 2);
  assert.equal(events.loaded[0].datasetId, 'A');
  assert.equal(events.loaded[0].result.route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(events.loaded[1].datasetId, 'B');
  assert.equal(events.loaded[1].result.route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(panel.getState().hasA, true);
  assert.equal(panel.getState().hasB, true);
  assert.equal(panel.getState().routeA, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(panel.getState().routeB, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);

  container.listeners.click(actionClickEvent('preview'));
  container.listeners.click(actionClickEvent('compare'));

  assert.equal(events.preview.length, 1);
  assert.equal(events.compare.length, 1);
  assert.equal(events.preview[0][0].route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(events.preview[0][1].route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(events.compare[0][0].route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(events.compare[0][1].route, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);

  container.listeners.click(actionClickEvent('clear'));
  assert.equal(events.cleared, 1);
  assert.equal(panel.getState().hasA, false);
  assert.equal(panel.getState().hasB, false);
  assert.ok(container.innerHTML.includes('No file loaded'));

  panel.destroy();
  assert.equal(container.innerHTML, '');
  assert.ok(!container.listeners.change);
  assert.ok(!container.listeners.click);

  console.log('[PASS] viewer3d XML compare panel mount passed.');
}

run().catch((error) => {
  console.error('[FAIL] viewer3d XML compare panel mount failed.');
  console.error(error);
  process.exit(1);
});
