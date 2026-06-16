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
  buildUxmlFaceModel,
} from '../uxml/UxmlFaceModelBuilder.js';

import {
  buildUxmlUniversalTopoGraph,
} from '../uxml/UxmlUniversalTopoGraphBuilder.js';

const REAL_1001_INPUT_XML = path.resolve(
  process.cwd(),
  'Benchmarks',
  'INPUT XML to CII 2019',
  '1001',
  '1001-P - COPY_INPUT.XML'
);

function readReal1001Xml() {
  expect(fs.existsSync(REAL_1001_INPUT_XML)).toBe(true);
  return fs.readFileSync(REAL_1001_INPUT_XML, 'utf8');
}

function normalizeReal1001() {
  const xml = readReal1001Xml();

  return normalizeXmlToUxml(xml, {
    fileName: '1001-P - COPY_INPUT.XML',
    selectedSourceType: 'INPUT_XML',
    profileReport: {
      profile: XML_PROFILES.INPUT_XML,
      confidence: 'HIGH',
      blockers: [],
    },
  });
}

function countTypes(components = []) {
  const counts = {};

  for (const component of components) {
    const type = component.normalizedType || component.type || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  }

  return counts;
}

describe('Import Agent 22 - real 1001 InputXML topology workbench smoke', () => {
  it('normalizes actual 1001 InputXML and builds a FaceModel', () => {
    const result = normalizeReal1001();

    expect(result.ok).toBe(true);
    expect(result.uxml).toBeTruthy();

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

    const faceModel = buildUxmlFaceModel(result.uxml, {
      allowPartial: true,
    });

    expect(faceModel.ok).toBe(true);
    expect(faceModel.schema).toBe('uxml-face-model/v1');
    expect(faceModel.blocked).toBe(false);
    expect(faceModel.summary.componentCount).toBe(result.uxml.components.length);
    expect(faceModel.summary.faceCount).toBeGreaterThan(0);
    expect(Array.isArray(faceModel.faces)).toBe(true);
    expect(faceModel.faces.length).toBe(faceModel.summary.faceCount);

    expect(result.generatedPcf).toBeUndefined();
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
    expect(result.masterResolutionRequests).toBeUndefined();
  });

  it('builds UniversalTopoGraph from actual 1001 InputXML-derived UXML', () => {
    const result = normalizeReal1001();
    const faceModel = buildUxmlFaceModel(result.uxml, {
      allowPartial: true,
    });

    const graph = buildUxmlUniversalTopoGraph(result.uxml, {
      connectToleranceMm: 6,
      faceModel,
      allowBlockedFaceModel: true,
    });

    expect(graph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(graph.blocked).toBe(false);
    expect(graph.summary.componentCount).toBe(result.uxml.components.length);
    expect(graph.summary.portCount).toBeGreaterThan(0);
    expect(graph.summary.nodeCount).toBeGreaterThan(0);
    expect(graph.summary.edgeCount).toBeGreaterThan(0);

    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.ports)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(Array.isArray(graph.disconnected)).toBe(true);
    expect(Array.isArray(graph.diagnostics)).toBe(true);
    expect(graph.ports.length).toBeGreaterThan(0);
    expect(graph.diagnostics.length).toBeGreaterThan(0);

    const ownership = {
      hasUxml: !!result.uxml,
      hasFaceModelReadyInput:
        result.uxml.components.length > 0 &&
        result.uxml.anchors.length > 0 &&
        result.uxml.ports.length > 0,
      hasUniversalTopologyGraph: graph.schema === 'uxml-universal-topo-graph/v1',
      generatedPcf: result.generatedPcf != null || result.pcfTextByPipelineRef != null,
      resolvedMasters: result.masterResolution != null || result.masterResolutionRequests != null,
    };

    expect(ownership).toEqual({
      hasUxml: true,
      hasFaceModelReadyInput: true,
      hasUniversalTopologyGraph: true,
      generatedPcf: false,
      resolvedMasters: false,
    });
  });

  it('keeps real InputXML topology workbench smoke inside import/topology-readiness boundaries', () => {
    const xml = readReal1001Xml();
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

    const faceModel = buildUxmlFaceModel(result.uxml, {
      allowPartial: true,
    });

    const graph = buildUxmlUniversalTopoGraph(result.uxml, {
      connectToleranceMm: 6,
      faceModel,
      allowBlockedFaceModel: true,
    });

    expect(xml).toBe(before);
    expect(result.ok).toBe(true);
    expect(faceModel.schema).toBe('uxml-face-model/v1');
    expect(graph.schema).toBe('uxml-universal-topo-graph/v1');

    expect(result.generatedPcf).toBeUndefined();
    expect(result.pcfTextByPipelineRef).toBeUndefined();
    expect(result.masterResolution).toBeUndefined();
    expect(result.masterResolutionRequests).toBeUndefined();

    expect(graph.generatedPcf).toBeUndefined();
    expect(graph.pcfTextByPipelineRef).toBeUndefined();
    expect(graph.masterResolution).toBeUndefined();
  });
});
