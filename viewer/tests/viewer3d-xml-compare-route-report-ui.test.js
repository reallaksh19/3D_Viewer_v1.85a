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

function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function run() {
  console.log('--- viewer3d-xml-compare-route-report-ui.test.js ---');

  const { mountXmlComparePanel } = await import('../tabs/viewer3d-xml-compare-panel.js');
  const { INPUTXML_IMPORT_ROUTES } = await import('../xml-compare/InputXmlImportRoutes.js');

  const container = createContainer();
  const panel = mountXmlComparePanel(container, {});

  const xmlText = `
    <InputXML>
      <Components>
        <Component id="P1" type="PIPE" pipelineRef="LINE-1" refNo="10" seqNo="1" ep1="0 0 0" ep2="100 0 0" bore="100" />
      </Components>
    </InputXML>
  `;

  const nativeFile = { name: 'native.xml', text: async () => xmlText };
  const uxmlFile = { name: 'uxml.xml', text: async () => xmlText };

  container.listeners.change(routeChangeEvent(INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER));
  container.listeners.change(fileChangeEvent('A', nativeFile));
  await waitForAsync();

  container.listeners.change(routeChangeEvent(INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP));
  container.listeners.change(fileChangeEvent('B', uxmlFile));
  await waitForAsync();

  assert.equal(panel.getState().routeA, INPUTXML_IMPORT_ROUTES.NATIVE_XML_BUILDER);
  assert.equal(panel.getState().routeB, INPUTXML_IMPORT_ROUTES.UXML_ROUND_TRIP);
  assert.equal(panel.getState().hasA, true);
  assert.equal(panel.getState().hasB, true);

  assert.ok(container.innerHTML.includes('XML A'));
  assert.ok(container.innerHTML.includes('XML B'));
  assert.ok(container.innerHTML.includes('Route: Native XML Builder'));
  assert.ok(container.innerHTML.includes('Route: UXML Round Trip'));
  assert.ok(container.innerHTML.includes('Native Builder: yes'));
  assert.ok(container.innerHTML.includes('UXML Components:'));
  assert.ok(container.innerHTML.includes('Diagnostics:'));

  panel.destroy();

  console.log('[PASS] viewer3d XML compare route report UI passed.');
}

run().catch((error) => {
  console.error('[FAIL] viewer3d XML compare route report UI failed.');
  console.error(error);
  process.exit(1);
});
