import { describe, expect, it, vi } from 'vitest';

import {
  UXML_SOURCE_TYPES,
  detectUxmlSourceType,
  resolveUxmlSourceIntakeRoute,
  runUxmlSourceIntakeBridge,
} from '../uxml/UxmlSourceIntakeBridge.js';

function samplePcf() {
  return `
ISOGEN-FILES ISOGEN.FLS
PIPELINE-REFERENCE /PCF-BRIDGE
PIPE
    END-POINT 0 0 0
    END-POINT 1000 0 0
VALVE
    END-POINT 1000 0 0
    END-POINT 1200 0 0
`;
}

function minimalInputXmlFromPdfConverter() {
  return `
<?xml version="1.0"?>
<CAESARII VERSION="14.00" XML_TYPE="Input">
  <PIPINGMODEL JOBNAME="PDF-BRIDGE" NUMELT="1">
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

describe('UxmlSourceIntakeBridge PCF/PDF', () => {
  it('detects PCF and PDF source types', () => {
    expect(detectUxmlSourceType({
      fileName: 'line.pcf',
      text: samplePcf(),
    })).toBe(UXML_SOURCE_TYPES.PCF);

    expect(detectUxmlSourceType({
      fileName: 'input-echo.pdf',
      text: '%PDF-1.7',
    })).toBe(UXML_SOURCE_TYPES.PDF);

    expect(detectUxmlSourceType({
      fileName: 'staged.json',
      text: '{"branch":[]}',
    })).toBe(UXML_SOURCE_TYPES.STAGED_JSON);
  });

  it('routes PCF to PCF -> Standard XML -> UXML', async () => {
    const result = await runUxmlSourceIntakeBridge({
      fileName: 'line.pcf',
      text: samplePcf(),
      selectedSourceType: 'PCF',
    });

    expect(result.ok).toBe(true);
    expect(result.route.sourceType).toBe('PCF');
    expect(result.route.bridgeConverterId).toBe('pcf_to_standardxml');
    expect(result.bridgeOutputProfile).toBe('STANDARD_XML');
    expect(result.bridgeOutputText).toContain('<Project');

    expect(result.normalized.ok).toBe(true);
    expect(result.normalized.uxml.components.length).toBeGreaterThan(0);
    expect(result.normalized.uxml.anchors.length).toBeGreaterThan(0);
    expect(result.normalized.uxml.ports.length).toBeGreaterThan(0);

    expect(result.generatedPcf).toBe(false);
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
  });

  it('blocks PDF when converterExecutor is missing', async () => {
    const result = await runUxmlSourceIntakeBridge({
      fileName: 'input-echo.pdf',
      text: '%PDF-1.7',
      selectedSourceType: 'PDF',
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics[0].code).toBe('UXML-INTAKE-PDF-CONVERTER-EXECUTOR-MISSING');
  });

  it('routes PDF through injected pdf_to_inputxml converterExecutor', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('pdf_to_inputxml');
      expect(request.fileName).toBe('input-echo.pdf');

      return {
        ok: true,
        outputText: minimalInputXmlFromPdfConverter(),
      };
    });

    const result = await runUxmlSourceIntakeBridge({
      fileName: 'input-echo.pdf',
      text: '%PDF-1.7 mock',
      selectedSourceType: 'PDF',
      converterExecutor,
    });

    expect(converterExecutor).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.route.sourceType).toBe('PDF');
    expect(result.route.bridgeConverterId).toBe('pdf_to_inputxml');
    expect(result.bridgeOutputProfile).toBe('INPUT_XML');

    expect(result.normalized.ok).toBe(true);
    expect(result.normalized.uxml.components.length).toBeGreaterThan(0);
    expect(result.normalized.uxml.anchors.length).toBeGreaterThan(0);
    expect(result.normalized.uxml.ports.length).toBeGreaterThan(0);

    expect(result.generatedPcf).toBe(false);
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
  });

  it('accepts worker-style converter outputs[] payload', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('pdf_to_inputxml');
      expect(Array.isArray(request.inputFiles)).toBe(true);
      expect(request.inputFiles.length).toBe(1);

      return {
        ok: true,
        outputs: [
          {
            name: 'pdf-output.xml',
            text: minimalInputXmlFromPdfConverter(),
            mime: 'text/xml',
          },
        ],
      };
    });

    const result = await runUxmlSourceIntakeBridge({
      fileName: 'input-echo.pdf',
      text: '%PDF-1.7 mock',
      selectedSourceType: 'PDF',
      sourceFile: { name: 'input-echo.pdf' },
      sourceArrayBuffer: new TextEncoder().encode('%PDF-1.7').buffer,
      converterExecutor,
    });

    expect(result.ok).toBe(true);
    expect(result.normalized.ok).toBe(true);
    expect(result.bridgeOutputText).toContain('<CAESARII');
  });

  it('routes staged json through stagedjson_to_inputxml converterExecutor', async () => {
    const converterExecutor = vi.fn(async request => {
      expect(request.converterId).toBe('stagedjson_to_inputxml');
      return {
        ok: true,
        outputText: minimalInputXmlFromPdfConverter(),
      };
    });

    const result = await runUxmlSourceIntakeBridge({
      fileName: 'stage.json',
      text: '{"branch":[{"children":[]}]}',
      selectedSourceType: 'STAGED_JSON',
      converterExecutor,
    });

    expect(result.ok).toBe(true);
    expect(result.route.sourceType).toBe('STAGED_JSON');
    expect(result.route.bridgeConverterId).toBe('stagedjson_to_inputxml');
    expect(result.normalized.ok).toBe(true);
  });

  it('resolves routes for PCF and PDF', () => {
    const pcfRoute = resolveUxmlSourceIntakeRoute({
      fileName: 'line.pcf',
      text: samplePcf(),
    });

    expect(pcfRoute.ok).toBe(true);
    expect(pcfRoute.sourceType).toBe('PCF');
    expect(pcfRoute.bridgeConverterId).toBe('pcf_to_standardxml');

    const pdfRoute = resolveUxmlSourceIntakeRoute({
      fileName: 'drawing.pdf',
      text: '%PDF-1.7',
    });

    expect(pdfRoute.ok).toBe(true);
    expect(pdfRoute.sourceType).toBe('PDF');
    expect(pdfRoute.bridgeConverterId).toBe('pdf_to_inputxml');

    const stagedRoute = resolveUxmlSourceIntakeRoute({
      fileName: 'staged.json',
      text: '{"branch":[{"children":[]}]}',
    });

    expect(stagedRoute.ok).toBe(true);
    expect(stagedRoute.sourceType).toBe('STAGED_JSON');
    expect(stagedRoute.bridgeConverterId).toBe('stagedjson_to_inputxml');
  });
});
