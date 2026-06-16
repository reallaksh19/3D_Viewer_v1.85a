import { describe, expect, it } from 'vitest';

import {
  convertPcfTextToStandardXml,
} from '../uxml/UxmlPcfStandardXmlBridge.js';

import {
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

function samplePcf() {
  return `
ISOGEN-FILES ISOGEN.FLS
PIPELINE-REFERENCE /PCF-1001
PIPE
    END-POINT 0 0 0 200
    END-POINT 1000 0 0 200
VALVE
    END-POINT 1000 0 0 200
    END-POINT 1200 0 0 200
FLANGE
    END-POINT 1200 0 0 200
    END-POINT 1250 0 0 200
TEE
    END-POINT 1250 0 0 200
    END-POINT 1500 0 0 200
    CENTRE-POINT 1375 0 0 200
    BRANCH1-POINT 1375 250 0 100
SUPPORT
    CO-ORDS 1400 80 0
`;
}

describe('UxmlPcfStandardXmlBridge', () => {
  it('converts PCF text to Standard XML without generating PCF', () => {
    const result = convertPcfTextToStandardXml(samplePcf(), {
      fileName: 'sample.pcf',
    });

    expect(result.schema).toBe('uxml-pcf-standardxml-bridge/v1');
    expect(result.ok).toBe(true);
    expect(result.sourceFormat).toBe('PCF');
    expect(result.targetProfile).toBe('STANDARD_XML');
    expect(result.pipelineRef).toBe('/PCF-1001');
    expect(result.componentCount).toBe(5);

    expect(result.standardXml).toContain('<Project');
    expect(result.standardXml).toContain('<Pipeline');
    expect(result.standardXml).toContain('<Pipe');
    expect(result.standardXml).toContain('<Valve');
    expect(result.standardXml).toContain('<Flange');
    expect(result.standardXml).toContain('<Tee');
    expect(result.standardXml).toContain('branchBore="100"');
    expect(result.standardXml).toContain('bore="200"');

    expect(result.generatedPcf).toBe(false);
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
  });

  it('normalizes generated Standard XML into UXML entities', () => {
    const bridge = convertPcfTextToStandardXml(samplePcf(), {
      fileName: 'sample.pcf',
    });

    const normalized = normalizeXmlToUxml(bridge.standardXml, {
      fileName: 'sample.pcf.standard.xml',
      selectedSourceType: XML_PROFILES.STANDARD_XML,
      profileReport: {
        profile: XML_PROFILES.STANDARD_XML,
        confidence: 'HIGH',
        blockers: [],
      },
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.uxml.components.length).toBeGreaterThanOrEqual(4);
    expect(normalized.uxml.anchors.length).toBeGreaterThan(0);
    expect(normalized.uxml.ports.length).toBeGreaterThan(0);
    expect(normalized.uxml.segments.length).toBeGreaterThan(0);

    expect(normalized.generatedPcf).toBeUndefined();
    expect(normalized.pcfTextByPipelineRef).toBeUndefined();
    expect(normalized.masterResolution).toBeUndefined();
  });
});
