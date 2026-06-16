import { describe, expect, it } from 'vitest';

import {
  ANCHOR_ROLES,
  COMPONENT_TYPES,
  PORT_ROLES,
  SEGMENT_TYPES,
  UXML_PROFILES,
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  normalizeToUxml,
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

describe('UxmlNormalizer Agent 02 skeleton', () => {
  it('blocks non-XML input and returns UXML-shaped diagnostic document', () => {
    const result = normalizeXmlToUxml('PIPELINE-REFERENCE X\nPIPE');

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.profileReport.profile).toBe(XML_PROFILES.UNKNOWN_XML);
    expect(result.uxml.sources.length).toBe(1);
    expect(result.uxml.diagnostics[0].severity).toBe('ERROR');
    expect(result.uxml.lossContract[0].severity).toBe('ERROR');
  });

  it('preserves already-UXML input as source with pass-through diagnostic', () => {
    const result = normalizeXmlToUxml(`
      <UXML version="1.0" profile="UXML-TOPOLOGY-FULL">
        <Components/>
      </UXML>
    `);

    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.profileReport.profile).toBe(XML_PROFILES.UXML);
    expect(result.uxml.profile).toBe(UXML_PROFILES.TOPOLOGY_FULL);
    expect(result.uxml.sources.length).toBe(1);
    expect(result.uxml.diagnostics.some(d => d.code === 'UXML-PASSTHROUGH-PROFILE-DETECTED')).toBe(true);
  });



  it('normalizes STANDARD_XML tee with branch point', () => {
    const result = normalizeXmlToUxml(`
      <Project>
        <Component
          id="TEE-001"
          type="TEE"
          pipelineRef="/P1"
          bore="250"
          branchBore="100"
          ep1="0,0,0"
          ep2="1000,0,0"
          cp="500,0,0"
          bp="500,300,0"
        />
      </Project>
    `);

    expect(result.ok).toBe(true);

    const component = result.uxml.components[0];
    expect(component.normalizedType).toBe(COMPONENT_TYPES.TEE);
    expect(component.branchBore).toBe(100);

    expect(result.uxml.anchors.map(a => a.role)).toContain(ANCHOR_ROLES.BP);
    expect(result.uxml.anchors.map(a => a.role)).toContain(ANCHOR_ROLES.CP);
    expect(result.uxml.ports.map(p => p.role)).toContain(PORT_ROLES.TEE_BRANCH);
  });

  it('normalizes STANDARD_XML olet with CP/BP and creates OLET ports', () => {
    const result = normalizeXmlToUxml(`
      <Project>
        <Component
          id="OLET-001"
          type="OLET"
          pipelineRef="/P1"
          bore="250"
          branchBore="100"
          cp="500,0,0"
          bp="500,250,0"
        />
      </Project>
    `);

    expect(result.ok).toBe(true);

    const component = result.uxml.components[0];
    expect(component.normalizedType).toBe(COMPONENT_TYPES.OLET);
    expect(result.uxml.anchors.map(a => a.role)).toContain(ANCHOR_ROLES.CP);
    expect(result.uxml.anchors.map(a => a.role)).toContain(ANCHOR_ROLES.BP);
    expect(result.uxml.ports.map(p => p.role)).toContain(PORT_ROLES.OLET_HEADER_TAP);
    expect(result.uxml.ports.map(p => p.role)).toContain(PORT_ROLES.OLET_BRANCH);
  });









  it('preserves BENCHMARK_XML as source only and does not invent topology', () => {
    const result = normalizeXmlToUxml(`
      <BenchmarkCase>
        <ExpectedResult>
          <Assertion code="COMPONENT-COUNT"/>
        </ExpectedResult>
      </BenchmarkCase>
    `);

    expect(result.ok).toBe(true);
    expect(result.profileReport.profile).toBe(XML_PROFILES.BENCHMARK_XML);
    expect(result.uxml.components.length).toBe(0);
    expect(result.uxml.anchors.length).toBe(0);
    expect(result.uxml.lossContract.some(l => l.code === 'UXML-BENCHMARK-NOT-TOPOLOGY-SOURCE')).toBe(true);
  });

  it('provides normalizeToUxml alias', () => {
    const result = normalizeToUxml(`
      <Project>
        <Component id="PIPE-A" type="PIPE" ep1="0,0,0" ep2="1,0,0"/>
      </Project>
    `);

    expect(result.ok).toBe(true);
    expect(result.uxml.components[0].id).toBe('PIPE-A');
  });

  it('returns stable stats for normalizer output', () => {
    const result = normalizeXmlToUxml(`
      <Project>
        <Component id="PIPE-STATS" type="PIPE" pipelineRef="/P1" ep1="0,0,0" ep2="100,0,0"/>
      </Project>
    `);

    expect(result.stats).toEqual({
      sourceCount: 1,
      mappingCount: 3,
      pipelineCount: 1,
      componentCount: 1,
      anchorCount: 4,
      portCount: 4,
      segmentCount: 1,
      supportCount: 0,
      lossCount: 0,
      diagnosticCount: 5,
    });
  });

  it('normalizes non-literal InputXML variant through adaptive mapper', () => {
    const xml = `
      <?xml version="1.0"?>
      <PlantModel>
        <Pipeline name="L-1001">
          <Node id="N1" x="0" y="0" z="0"/>
          <Node id="N2" x="1000" y="0" z="0"/>
          <Element id="PIPE-1" type="PIPE" pipelineRef="/P1" lineNo="L-1001" startNode="N1" endNode="N2" bore="250"/>
        </Pipeline>
      </PlantModel>
    `;

    const result = normalizeXmlToUxml(xml, {
      fileName: '1001-P - COPY_INPUT.XML',
      selectedSourceType: 'INPUT_XML',
      profileReport: {
        profile: 'INPUT_XML',
        blockers: [],
        confidence: 'MEDIUM',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.uxml.components.length).toBe(1);
    expect(result.uxml.anchors.length).toBe(4);
    expect(result.uxml.ports.length).toBe(4);
    expect(result.uxml.segments.length).toBe(1);
  });

  it('normalizes Standard XML through dedicated XML mapper', () => {
    const xml = `
      <Project>
        <Component id="PIPE-1" type="PIPE" pipelineRef="/P1" lineNo="L-1001" ep1="0,0,0" ep2="1000,0,0" bore="250"/>
        <Component id="FLANGE-1" type="FLANGE" pipelineRef="/P1" lineNo="L-1001" ep1="1000,0,0" ep2="1050,0,0" bore="250"/>
      </Project>
    `;

    const result = normalizeXmlToUxml(xml, {
      fileName: 'standard.xml',
      profileReport: {
        profile: 'STANDARD_XML',
        blockers: [],
        confidence: 'HIGH',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.uxml.components.length).toBe(2);
    expect(result.uxml.anchors.length).toBe(8);
    expect(result.uxml.ports.length).toBe(8);
    expect(result.uxml.segments.length).toBe(2);
  });
});
