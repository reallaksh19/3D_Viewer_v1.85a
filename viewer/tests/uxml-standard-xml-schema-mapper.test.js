import { describe, expect, it } from 'vitest';

import {
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  createUxmlDocument,
  createUxmlSource,
} from '../uxml/UxmlTypes.js';

import {
  mapGenericXmlToUxml,
  mapStandardXmlSchemaToUxml,
  mapStandardXmlToUxml,
} from '../uxml/UxmlStandardXmlSchemaMapper.js';

import {
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

const STANDARD_XML_SAMPLE = `
<Project>
  <Component id="PIPE-1" type="PIPE" pipelineRef="/P1" lineNo="L-1001" bore="250" ep1="0,0,0" ep2="1000,0,0" refNo="REF-P1" seqNo="10" />
  <Component id="VALVE-1" type="VALVE" pipelineRef="/P1" lineNo="L-1001" bore="250" ep1="1000,0,0" ep2="1200,0,0" refNo="REF-V1" seqNo="20" />
  <Pipe id="PIPE-2" pipelineRef="/P1" lineNo="L-1001" bore="250" ep1="1200,0,0" ep2="2200,0,0" refNo="REF-P2" seqNo="30" />
</Project>
`;

const NESTED_XML_SAMPLE = `
<Project>
  <Pipe id="PIPE-N1" pipelineRef="/P2" lineNo="L-2001" bore="300" refNo="REF-N1" seqNo="10">
    <EndPoint role="EP1" x="0" y="0" z="0"/>
    <EndPoint role="EP2" x="2000" y="0" z="0"/>
  </Pipe>

  <Tee id="TEE-N1" pipelineRef="/P2" lineNo="L-2001" bore="300" branchBore="100" refNo="REF-T" seqNo="20">
    <EndPoint role="EP1" x="2000" y="0" z="0"/>
    <EndPoint role="EP2" x="2200" y="0" z="0"/>
    <CentrePoint x="2100" y="0" z="0"/>
    <BranchPoint x="2100" y="200" z="0"/>
  </Tee>

  <Olet id="OLET-N1" pipelineRef="/P2" lineNo="L-2001" bore="300" branchBore="80" cp="1000,0,0" bp="1000,250,0" refNo="REF-O" seqNo="30"/>
  <Support id="SUP-N1" type="PS-GUIDE" pipelineRef="/P2" lineNo="L-2001" supportCoord="500,0,-250" refNo="REF-S" seqNo="40"/>
</Project>
`;

function freshDoc() {
  const doc = createUxmlDocument();

  doc.sources.push(createUxmlSource({
    id: 'SRC-1',
    format: XML_PROFILES.STANDARD_XML,
    name: 'standard.xml',
    role: 'PRIMARY',
  }));

  return doc;
}

describe('UxmlStandardXmlSchemaMapper Agent 19', () => {
  it('maps simple Project/Component XML into UXML components and anchors', () => {
    const doc = freshDoc();

    const result = mapStandardXmlToUxml(STANDARD_XML_SAMPLE, doc, 'SRC-1', {
      fileName: 'standard.xml',
    });

    expect(result.schema).toBe('uxml-standard-xml-schema-mapper/v1');
    expect(result.ok).toBe(true);

    expect(doc.components).toHaveLength(3);
    expect(doc.anchors.length).toBeGreaterThanOrEqual(6);
    expect(doc.ports.length).toBeGreaterThanOrEqual(6);
    expect(doc.segments).toHaveLength(3);

    const pipe = doc.components.find(c => c.id === 'PIPE-1');

    expect(pipe).toBeTruthy();
    expect(pipe.normalizedType).toBe('PIPE');
    expect(pipe.pipelineRef).toBe('/P1');
    expect(pipe.lineKey).toBe('L-1001');
    expect(pipe.refNo).toBe('REF-P1');
    expect(pipe.seqNo).toBe('10');
  });

  it('maps nested endpoints, CP/BP and support points', () => {
    const doc = freshDoc();

    const result = mapStandardXmlToUxml(NESTED_XML_SAMPLE, doc, 'SRC-1', {
      fileName: 'nested-standard.xml',
    });

    expect(result.ok).toBe(true);

    const pipe = doc.components.find(c => c.id === 'PIPE-N1');
    const tee = doc.components.find(c => c.id === 'TEE-N1');
    const olet = doc.components.find(c => c.id === 'OLET-N1');
    const support = doc.components.find(c => c.id === 'SUP-N1');

    expect(pipe).toBeTruthy();
    expect(tee).toBeTruthy();
    expect(olet).toBeTruthy();
    expect(support).toBeTruthy();

    expect(tee.anchorIds.some(id => id.includes('CP'))).toBe(true);
    expect(tee.anchorIds.some(id => id.includes('BP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('CP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('BP'))).toBe(true);

    expect(doc.supports).toHaveLength(1);
    expect(doc.supports[0].componentId).toBe('SUP-N1');
  });

  it('records diagnostics and loss for XML with no known component tags', () => {
    const doc = freshDoc();

    const result = mapStandardXmlToUxml('<Project><Unknown id="X"/></Project>', doc, 'SRC-1', {
      fileName: 'unknown.xml',
    });

    expect(result.ok).toBe(false);
    expect(doc.components).toHaveLength(0);
    expect(doc.lossContract.some(l => l.code === 'UXML-STANDARDXML-MAPPER-NO-COMPONENT-TAGS')).toBe(true);
    expect(doc.diagnostics.some(d => d.code === 'UXML-STANDARDXML-MAPPER-ZERO-COMPONENTS')).toBe(true);
  });

  it('normalizer uses Standard XML mapper for STANDARD_XML profile', () => {
    const result = normalizeXmlToUxml(STANDARD_XML_SAMPLE, {
      fileName: 'standard.xml',
      selectedSourceType: 'EXISTING_XML',
      profileReport: {
        profile: XML_PROFILES.STANDARD_XML,
        blockers: [],
        confidence: 'HIGH',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.uxml.components.length).toBe(3);
    expect(result.uxml.anchors.length).toBeGreaterThanOrEqual(6);
    expect(result.uxml.segments.length).toBe(3);
    expect(result.diagnostics.some(d => d.code === 'UXML-NORMALIZER-STANDARDXML-MAPPER-OK')).toBe(true);
  });

  it('provides alias exports', () => {
    const a = freshDoc();
    const b = freshDoc();

    const resultA = mapStandardXmlSchemaToUxml(STANDARD_XML_SAMPLE, a, 'SRC-1', {});
    const resultB = mapGenericXmlToUxml(STANDARD_XML_SAMPLE, b, 'SRC-1', {});

    expect(resultA.schema).toBe('uxml-standard-xml-schema-mapper/v1');
    expect(resultB.schema).toBe('uxml-standard-xml-schema-mapper/v1');
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
  });
});