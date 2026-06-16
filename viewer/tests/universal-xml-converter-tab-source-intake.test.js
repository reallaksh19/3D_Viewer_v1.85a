import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

import {
  detectSourceType,
  renderUniversalXmlConverterTab,
  runPipelineActionAsync,
  runUniversalXmlPipelineFromTextAsync,
  _test,
} from '../tabs/universal-xml-converter-tab.js';

function samplePcf() {
  return `
ISOGEN-FILES ISOGEN.FLS
PIPELINE-REFERENCE /UI-PCF-1001
PIPE
    END-POINT 0 0 0 200
    END-POINT 1000 0 0 200
VALVE
    END-POINT 1000 0 0 200
    END-POINT 1200 0 0 200
`;
}

function minimalPdfConvertedInputXml() {
  return `
<?xml version="1.0"?>
<CAESARII VERSION="14.00" XML_TYPE="Input">
  <PIPINGMODEL JOBNAME="PDF-UI-BRIDGE" NUMELT="1">
    <PIPINGELEMENT
      FROM_NODE="10.000000"
      TO_NODE="20.000000"
      DIAMETER="250.000000"
      DELTA_X="100.000000"
      DELTA_Y="-1.010100"
      DELTA_Z="-1.010100"
    />
  </PIPINGMODEL>
</CAESARII>
`;
}

describe('Universal XML Converter PCF/PDF source intake bridge UI', () => {
  it('detects PCF and PDF source types', () => {
    expect(detectSourceType('line.pcf', samplePcf())).toBe('PCF');
    expect(detectSourceType('input-echo.pdf', '%PDF-1.7 mock')).toBe('PDF');
    expect(detectSourceType('staged.json', '{"branch":[{"children":[]}]}')).toBe('STAGED_JSON');
  });

  it('resolves PCF as bridge route from tab state', () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'line.pcf',
      size: samplePcf().length,
      type: 'text/plain',
      lastModified: null,
    };
    state.sourceText = samplePcf();
    state.selectedSourceType = 'PCF';
    state.detectedSourceType = 'PCF';

    const route = _test.sourceIntakeRouteSummary(state);

    expect(_test.effectiveSourceType(state)).toBe('PCF');
    expect(_test.isBridgeSourceType('PCF')).toBe(true);
    expect(route.ok).toBe(true);
    expect(route.sourceType).toBe('PCF');
    expect(route.bridgeConverterId).toBe('pcf_to_standardxml');
    expect(route.bridgeOutputProfile).toBe('STANDARD_XML');
  });

  it('runs PCF through Source Intake Bridge then UXML normalization', async () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'line.pcf',
      size: samplePcf().length,
      type: 'text/plain',
      lastModified: null,
    };
    state.sourceText = samplePcf();
    state.selectedSourceType = 'PCF';
    state.detectedSourceType = 'PCF';

    const intake = await runPipelineActionAsync(state, 'run-source-intake-bridge');

    expect(intake.ok).toBe(true);
    expect(intake.route.sourceType).toBe('PCF');
    expect(intake.bridgeOutputProfile).toBe('STANDARD_XML');
    expect(intake.bridgeOutputText).toContain('<Project');

    expect(state.pipeline.sourceIntakeBridge).toBe(intake);
    expect(state.pipeline.normalizerResult.ok).toBe(true);
    expect(state.pipeline.uxml.components.length).toBeGreaterThan(0);
    expect(state.pipeline.uxml.anchors.length).toBeGreaterThan(0);
    expect(state.pipeline.uxml.ports.length).toBeGreaterThan(0);

    expect(intake.generatedPcf).toBe(false);
    expect(intake.pcfTextByPipelineRef).toBeUndefined();
    expect(intake.masterResolution).toBeUndefined();
  });

  it('runs full async pipeline from PCF text', async () => {
    const state = await runUniversalXmlPipelineFromTextAsync(samplePcf(), {
      sourceName: 'line.pcf',
      selectedSourceType: 'PCF',
    });

    expect(state.pipeline.sourceIntakeBridge.ok).toBe(true);
    expect(state.pipeline.sourceIntakeBridge.route.sourceType).toBe('PCF');
    expect(state.pipeline.normalizerResult.ok).toBe(true);
    expect(state.pipeline.uxml.components.length).toBeGreaterThan(0);
    expect(state.pipeline.validationReport.ready).toBe(true);
    expect(state.pipeline.faceModel.schema).toBe('uxml-face-model/v1');
    expect(state.pipeline.universalGraph.schema).toBe('uxml-universal-topo-graph/v1');

    expect(state.pipeline.sourceIntakeBridge.generatedPcf).toBe(false);
    expect(state.pipeline.sourceIntakeBridge.pcfTextByPipelineRef).toBeUndefined();
    expect(state.pipeline.sourceIntakeBridge.masterResolution).toBeUndefined();
  });

  it('blocks PDF source intake when converterExecutor is missing', async () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'input-echo.pdf',
      size: 12,
      type: 'application/pdf',
      lastModified: null,
    };
    state.sourceText = '%PDF-1.7 mock';
    state.selectedSourceType = 'PDF';
    state.detectedSourceType = 'PDF';

    const result = await runPipelineActionAsync(state, 'run-source-intake-bridge');

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics[0].code).toBe('UXML-INTAKE-PDF-CONVERTER-EXECUTOR-MISSING');
  });

  it('runs PDF through injected pdf_to_inputxml converterExecutor', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('pdf_to_inputxml');

      return {
        ok: true,
        outputText: minimalPdfConvertedInputXml(),
      };
    });

    const state = await runUniversalXmlPipelineFromTextAsync('%PDF-1.7 mock', {
      sourceName: 'input-echo.pdf',
      selectedSourceType: 'PDF',
      converterExecutor,
    });

    expect(converterExecutor).toHaveBeenCalledTimes(1);

    expect(state.pipeline.sourceIntakeBridge.ok).toBe(true);
    expect(state.pipeline.sourceIntakeBridge.route.sourceType).toBe('PDF');
    expect(state.pipeline.sourceIntakeBridge.route.bridgeConverterId).toBe('pdf_to_inputxml');
    expect(state.pipeline.sourceIntakeBridge.bridgeOutputProfile).toBe('INPUT_XML');

    expect(state.pipeline.normalizerResult.ok).toBe(true);
    expect(state.pipeline.uxml.components.length).toBeGreaterThan(0);
    expect(state.pipeline.uxml.anchors.length).toBeGreaterThan(0);
    expect(state.pipeline.uxml.ports.length).toBeGreaterThan(0);

    expect(state.pipeline.sourceIntakeBridge.generatedPcf).toBe(false);
    expect(state.pipeline.sourceIntakeBridge.pcfTextByPipelineRef).toBeUndefined();
    expect(state.pipeline.sourceIntakeBridge.masterResolution).toBeUndefined();
  });

  it('runs staged json through run-existing-converter action', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('stagedjson_to_inputxml');
      return {
        ok: true,
        outputText: minimalPdfConvertedInputXml(),
      };
    });

    const state = _test.createInitialState();
    state.sourceFile = {
      name: 'staged.json',
      size: 64,
      type: 'application/json',
      lastModified: null,
    };
    state.sourceText = '{"branch":[{"children":[]}]}';
    state.selectedSourceType = 'STAGED_JSON';
    state.detectedSourceType = 'STAGED_JSON';
    state.converterExecutor = converterExecutor;

    const intake = await runPipelineActionAsync(state, 'run-existing-converter');

    expect(converterExecutor).toHaveBeenCalledTimes(1);
    expect(intake.ok).toBe(true);
    expect(intake.route.sourceType).toBe('STAGED_JSON');
    expect(intake.route.bridgeConverterId).toBe('stagedjson_to_inputxml');
    expect(state.pipeline.uxml.components.length).toBeGreaterThan(0);
  });

  it('auto-detects staged json in AUTO mode and runs existing converter', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('stagedjson_to_inputxml');
      return {
        ok: true,
        outputText: minimalPdfConvertedInputXml(),
      };
    });

    const state = _test.createInitialState();
    state.sourceFile = {
      name: 'network-staged.json',
      size: 64,
      type: 'application/json',
      lastModified: null,
    };
    state.sourceText = '{"branch":[{"children":[]}]}';
    state.selectedSourceType = 'AUTO';
    state.detectedSourceType = detectSourceType(state.sourceFile.name, state.sourceText);
    state.converterExecutor = converterExecutor;

    const intake = await runPipelineActionAsync(state, 'run-existing-converter');

    expect(state.detectedSourceType).toBe('STAGED_JSON');
    expect(converterExecutor).toHaveBeenCalledTimes(1);
    expect(intake.ok).toBe(true);
    expect(intake.route.sourceType).toBe('STAGED_JSON');
    expect(intake.route.bridgeConverterId).toBe('stagedjson_to_inputxml');
  });

  it('renders Source Intake Bridge wording', () => {
    const container = document.createElement('div');

    renderUniversalXmlConverterTab(container);

    const html = container.innerHTML;

    expect(html).toContain('Universal XML Converter');
    expect(html).toContain('Source Intake');
    expect(html).toContain('PCF');
    expect(html).toContain('PDF');
    expect(html).toContain('Run existing converter');
    expect(html).toContain('Source Intake Bridge');
  });
});
