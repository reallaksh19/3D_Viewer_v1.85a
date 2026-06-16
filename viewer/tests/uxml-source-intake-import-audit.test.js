import { describe, expect, it, vi } from 'vitest';

import {
  runUxmlSourceIntakeBridge,
  resolveUxmlSourceIntakeRoute,
} from '../uxml/UxmlSourceIntakeBridge.js';

function samplePcf() {
  return `
ISOGEN-FILES ISOGEN.FLS
PIPELINE-REFERENCE /AUDIT-PCF
PIPE
    END-POINT 0 0 0 250
    END-POINT 1000 0 0 250
VALVE
    END-POINT 1000 0 0 250
    END-POINT 1200 0 0 250
`;
}

function sampleStandardXml() {
  return `
<Project>
  <Pipe id="PIPE-1" pipelineRef="/AUDIT-XML" lineNo="L-1" bore="250" ep1="0,0,0" ep2="1000,0,0"/>
  <Valve id="VALVE-1" pipelineRef="/AUDIT-XML" lineNo="L-1" bore="250" ep1="1000,0,0" ep2="1200,0,0"/>
</Project>
`;
}

function sampleInputXml() {
  return `
<?xml version="1.0"?>
<CAESARII VERSION="14.00" XML_TYPE="Input">
  <PIPINGMODEL JOBNAME="AUDIT-INPUTXML" NUMELT="1">
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

function assertImportBoundary(result) {
  expect(result.generatedPcf).toBe(false);
  expect(result.pcfTextByPipelineRef).toBeUndefined();
  expect(result.masterResolution).toBeUndefined();
  expect(result.masterResolutionRequests).toBeUndefined();
}

function assertUxmlCompleteness(result) {
  expect(result.ok).toBe(true);
  expect(result.normalized?.ok).toBe(true);
  expect(result.normalized?.uxml).toBeTruthy();
  expect(result.normalized.uxml.components.length).toBeGreaterThan(0);
  expect(result.normalized.uxml.anchors.length).toBeGreaterThan(0);
  expect(result.normalized.uxml.ports.length).toBeGreaterThan(0);
}

describe('UXML source intake import audit', () => {
  it('audits route coverage for PCF/PDF/STAGED_JSON/InputXML/StandardXML', () => {
    expect(resolveUxmlSourceIntakeRoute({ fileName: 'a.pcf', text: samplePcf() }).sourceType).toBe('PCF');
    expect(resolveUxmlSourceIntakeRoute({ fileName: 'a.pdf', text: '%PDF-1.7' }).sourceType).toBe('PDF');
    expect(resolveUxmlSourceIntakeRoute({ fileName: 'a.json', text: '{"items":[]}' }).sourceType).toBe('STAGED_JSON');
    expect(resolveUxmlSourceIntakeRoute({ fileName: 'a.xml', text: sampleInputXml() }).sourceType).toBe('INPUT_XML');
    expect(resolveUxmlSourceIntakeRoute({ fileName: 'a.xml', text: sampleStandardXml() }).sourceType).toBe('STANDARD_XML');
  });

  it('audits PCF intake completeness and ownership boundaries', async () => {
    const result = await runUxmlSourceIntakeBridge({
      fileName: 'audit.pcf',
      text: samplePcf(),
      selectedSourceType: 'PCF',
    });

    assertUxmlCompleteness(result);
    assertImportBoundary(result);
    expect(result.route.sourceType).toBe('PCF');
    expect(result.route.bridgeConverterId).toBe('pcf_to_standardxml');
    expect(result.normalized.uxml.components.length).toBeGreaterThanOrEqual(2);
  });

  it('audits PDF intake through existing converter bridge', async () => {
    const converterExecutor = vi.fn(async (request) => {
      expect(request.converterId).toBe('pdf_to_inputxml');
      return { ok: true, outputText: sampleInputXml() };
    });

    const result = await runUxmlSourceIntakeBridge({
      fileName: 'audit.pdf',
      text: '%PDF-1.7',
      selectedSourceType: 'PDF',
      converterExecutor,
    });

    expect(converterExecutor).toHaveBeenCalledTimes(1);
    assertUxmlCompleteness(result);
    assertImportBoundary(result);
    expect(result.route.sourceType).toBe('PDF');
    expect(result.route.bridgeConverterId).toBe('pdf_to_inputxml');
  });

  it('audits staged JSON intake through existing converter bridge', async () => {
    const converterExecutor = vi.fn(async (request) => {
      expect(request.converterId).toBe('stagedjson_to_inputxml');
      return { ok: true, outputText: sampleInputXml() };
    });

    const result = await runUxmlSourceIntakeBridge({
      fileName: 'audit.json',
      text: '{"dataset":"staged"}',
      selectedSourceType: 'STAGED_JSON',
      converterExecutor,
    });

    expect(converterExecutor).toHaveBeenCalledTimes(1);
    assertUxmlCompleteness(result);
    assertImportBoundary(result);
    expect(result.route.sourceType).toBe('STAGED_JSON');
    expect(result.route.bridgeConverterId).toBe('stagedjson_to_inputxml');
  });

  it('audits direct InputXML and direct StandardXML normalization paths', async () => {
    const inputXml = await runUxmlSourceIntakeBridge({
      fileName: 'audit-input.xml',
      text: sampleInputXml(),
      selectedSourceType: 'INPUT_XML',
    });
    const standardXml = await runUxmlSourceIntakeBridge({
      fileName: 'audit-standard.xml',
      text: sampleStandardXml(),
      selectedSourceType: 'STANDARD_XML',
    });

    assertUxmlCompleteness(inputXml);
    assertUxmlCompleteness(standardXml);
    assertImportBoundary(inputXml);
    assertImportBoundary(standardXml);
    expect(inputXml.route.strategy).toBe('DIRECT_XML_NORMALIZATION');
    expect(standardXml.route.strategy).toBe('DIRECT_XML_NORMALIZATION');
  });
});

