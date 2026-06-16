import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  XML_PROFILES,
  COMPONENT_TYPES,
} from '../uxml/UxmlConstants.js';

import {
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

import {
  UXML_INPUTXML_1001_EXPECTED_METRICS,
} from '../uxml/UxmlInputXmlSchemaMapper.js';

const REAL_1001_INPUT_XML = path.resolve(
  process.cwd(),
  'Benchmarks',
  'INPUT XML to CII 2019',
  '1001',
  '1001-P - COPY_INPUT.XML'
);

function countTypes(components = []) {
  const counts = {};

  for (const component of components) {
    const type = component.normalizedType || component.type || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  }

  return counts;
}

describe('Import Agent 21 - real 1001-P COPY_INPUT.XML smoke', () => {
  it('has the actual checked-in benchmark file', () => {
    expect(fs.existsSync(REAL_1001_INPUT_XML)).toBe(true);

    const text = fs.readFileSync(REAL_1001_INPUT_XML, 'utf8');

    expect(text.length).toBeGreaterThan(1000);
    expect(text).toMatch(/PIPINGMODEL|PIPINGELEMENT|CAESAR/i);
  });

  it('normalizes the real benchmark file into UXML entities and diagnostic output', () => {
    const xml = fs.readFileSync(REAL_1001_INPUT_XML, 'utf8');
    const before = String(xml);

    const result = normalizeXmlToUxml(xml, {
      fileName: '1001-P - COPY_INPUT.XML',
      selectedSourceType: 'INPUT_XML',
      profileReport: {
        profile: XML_PROFILES.INPUT_XML,
        confidence: 'HIGH',
        blockers: [],
      },
    });

    expect(xml).toBe(before);
    expect(result.ok).toBe(true);
    expect(result.uxml).toBeTruthy();

    expect(result.stats.componentCount).toBeGreaterThan(0);
    expect(result.stats.anchorCount).toBeGreaterThan(0);
    expect(result.stats.portCount).toBeGreaterThan(0);
    expect(result.stats.segmentCount).toBeGreaterThan(0);

    expect(result.uxml.components.length).toBeGreaterThan(0);
    expect(result.uxml.anchors.length).toBeGreaterThan(0);
    expect(result.uxml.ports.length).toBeGreaterThan(0);
    expect(result.uxml.segments.length).toBeGreaterThan(0);

    const counts = countTypes(result.uxml.components);

    expect(counts[COMPONENT_TYPES.BEND] || 0).toBeGreaterThanOrEqual(1);
    expect(
      (counts[COMPONENT_TYPES.REDUCER_CONCENTRIC] || 0) +
      (counts[COMPONENT_TYPES.REDUCER_ECCENTRIC] || 0)
    ).toBeGreaterThanOrEqual(1);

    const diagnostic = result.uxml.diagnostics.find(d =>
      d.code === 'UXML-INPUTXML-1001-COPY-SCHEMA-EXTENSION'
    );

    expect(diagnostic).toBeTruthy();
    expect(diagnostic.severity).toBe('INFO');
    expect(diagnostic.details.expected.elements).toBe(UXML_INPUTXML_1001_EXPECTED_METRICS.elements);
    expect(diagnostic.details.actual.elements).toBeGreaterThan(0);
    expect(diagnostic.details.matched).toBe(true);

    expect(result.generatedPcf).toBeUndefined();
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
    expect(result.masterResolutionRequests).toBeUndefined();
    expect(result.universalGraph).toBeUndefined();
    expect(result.rayGraph).toBeUndefined();
    expect(result.topologyDecision).toBeUndefined();
  });

  it('stays import-only for the real benchmark file', () => {
    const xml = fs.readFileSync(REAL_1001_INPUT_XML, 'utf8');

    const result = normalizeXmlToUxml(xml, {
      fileName: '1001-P - COPY_INPUT.XML',
      selectedSourceType: 'INPUT_XML',
      profileReport: {
        profile: XML_PROFILES.INPUT_XML,
        confidence: 'HIGH',
        blockers: [],
      },
    });

    expect(result.uxml.components.length).toBeGreaterThan(0);
    expect(result.uxml.anchors.length).toBeGreaterThan(0);
    expect(result.uxml.ports.length).toBeGreaterThan(0);
    expect(result.uxml.segments.length).toBeGreaterThan(0);
    expect(result.generatedPcf).toBeUndefined();
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
    expect(result.masterResolutionRequests).toBeUndefined();
    expect(result.universalGraph).toBeUndefined();
    expect(result.rayGraph).toBeUndefined();
    expect(result.topologyDecision).toBeUndefined();
  });
});
