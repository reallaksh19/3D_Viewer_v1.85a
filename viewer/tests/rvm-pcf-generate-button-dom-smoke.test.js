import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { mount, dispose } from '../tabs/rvm-json-pcf-extract-tab.js';
import { state, updateRvmPcfExtractState } from '../core/state.js';
import { RVM_PCF_TOPOLOGY_MODES } from '../rvm-pcf-extract/RvmPcfTopologyModes.js';
import { runUxmlTopologyForRvmRows } from '../rvm-pcf-extract/RvmUxmlTopologyBridge.js';

function rowsFixture() {
  return [
    {
      rowNo: 10,
      id: 'PIPE-1',
      type: 'PIPE',
      pipelineRef: '/RJP-5001',
      lineNo: 'L-RJP-5001',
      refNo: 'REF-P1',
      seqNo: '10',
      convertedBore: 250,
      ep1: { x: 100, y: 0, z: 0 },
      ep2: { x: 1100, y: 0, z: 0 },
      include: true,
    },
    {
      rowNo: 20,
      id: 'VALVE-1',
      type: 'VALVE',
      pipelineRef: '/RJP-5002',
      lineNo: 'L-RJP-5002',
      refNo: 'REF-V1',
      seqNo: '20',
      convertedBore: 250,
      ep1: { x: 1100, y: 0, z: 0 },
      ep2: { x: 1300, y: 0, z: 0 },
      include: true,
    },
  ];
}

function createDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
    url: 'http://localhost/',
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;

  return dom;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForText(element, text, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (String(element.textContent || '').includes(text)) {
      return;
    }
    await flush();
  }
  throw new Error(`Timed out waiting for text: ${text}`);
}

function resetState() {
  state.rvm = {
    deploymentMode: 'static',
    capabilities: null,
    activeBundle: null,
    manifest: null,
    index: { nodes: [{}, {}] },
    identityMap: null,
    tags: [],
    selection: { canonicalObjectId: null, canonicalObjectIds: [], renderObjectIds: [] },
    savedViews: [],
    diagnostics: [],
    asyncLoad: { loadId: null, status: 'idle', phase: null, progress: 0, error: null },
    routing: { topologyMethod: 'topology_legacy', routeThroughInstEnabled: false },
  };

  state.rvmPcfExtract.scope = 'selected';
  state.rvmPcfExtract.selectedCanonicalIds = ['PIPE-1', 'VALVE-1'];
  state.rvmPcfExtract.topologyMode = RVM_PCF_TOPOLOGY_MODES.UXML_TOPOLOGY;
  state.rvmPcfExtract.rows = rowsFixture();
  state.rvmPcfExtract.readinessGate = null;
  state.rvmPcfExtract.singlePcfForMultiLineSelection = true;
  state.rvmPcfExtract.pcfTextByPipelineRef = {};
  state.rvmPcfExtract.diagnostics = [];
  state.rvmPcfExtract.continuity = {
    continuityAutoAdjustEnabled: true,
    continuityMismatchToleranceMm: 6,
    continuityMovePriority: 'PIPE, FLANGE, VALVE, BEND, TEE',
    preferUpstreamComponent: true,
  };
}

describe('Generate PCF button DOM smoke in UXML topology mode', () => {
  beforeEach(() => {
    createDom();
    resetState();
  });

  it('blocks Generate PCF before readiness is run', async () => {
    const host = document.getElementById('host');
    mount(host);

    const generate = host.querySelector('[data-action="GENERATE_PCF"]');
    expect(generate).toBeTruthy();

    generate.click();
    await waitForText(host, 'Run Readiness Check before generating PCF.');

    expect(host.textContent).toContain('Run Readiness Check before generating PCF.');
    expect(host.textContent).not.toContain('Generated PCF for');
    expect(Object.keys(state.rvmPcfExtract.pcfTextByPipelineRef || {})).toHaveLength(0);
  });

  it('allows Generate PCF once a readiness gate is present', async () => {
    const readinessFixture = runUxmlTopologyForRvmRows(rowsFixture(), {
      connectToleranceMm: 6,
      maxRayLengthMm: 500,
      tubeToleranceMm: 12,
      allowPartialExport: true,
      name: 'pcf-generate-readiness',
    });

    state.rvmPcfExtract.readinessGate = {
      ...readinessFixture.readinessGate,
      report: {
        ...(readinessFixture.readinessGate?.report || {}),
        allowPcfExport: true,
      },
    };

    const host = document.getElementById('host');
    mount(host);

    const generate = host.querySelector('[data-action="GENERATE_PCF"]');

    expect(generate).toBeTruthy();

    expect(state.rvmPcfExtract.readinessGate).toBeTruthy();
    expect(state.rvmPcfExtract.readinessGate.report).toBeTruthy();
    expect(state.rvmPcfExtract.readinessGate.report.allowPcfExport).toBe(true);

    generate.click();
    await waitForText(host, 'Generated PCF for');

    expect(host.textContent).toContain('Generated PCF for 1 pipeline(s).');
    expect(Object.keys(state.rvmPcfExtract.pcfTextByPipelineRef || {})).toHaveLength(1);
    expect(Object.values(state.rvmPcfExtract.pcfTextByPipelineRef || {})[0]).toContain('PIPELINE-REFERENCE');
    expect(Object.values(state.rvmPcfExtract.pcfTextByPipelineRef || {})[0]).toContain('ISOGEN-FILES');
    expect(state.rvmPcfExtract.singlePcfForMultiLineSelection).toBe(true);
  });

  it('keeps legacy mode behavior available', async () => {
    state.rvmPcfExtract.topologyMode = RVM_PCF_TOPOLOGY_MODES.LEGACY;

    const host = document.getElementById('host');
    mount(host);

    const generate = host.querySelector('[data-action="GENERATE_PCF"]');
    generate.click();
    await flush();

    expect(host.textContent).toContain('Run Readiness Check before generating PCF.');
  });

  afterEach(() => {
    dispose();
  });
});
