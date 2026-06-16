import { describe, expect, it } from 'vitest';

import {
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  createUxmlDocument,
  createUxmlSource,
} from '../uxml/UxmlTypes.js';

import {
  mapInputXmlToUxml,
  mapInputXmlSchemaToUxml,
} from '../uxml/UxmlInputXmlSchemaMapper.js';

import {
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

const INPUT_XML_VARIANT = `
<?xml version="1.0"?>
<PlantModel>
  <Pipeline name="L-1001" pipelineRef="/P1">
    <Node id="N1" x="0" y="0" z="0"/>
    <Node id="N2" x="1000" y="0" z="0"/>
    <Node id="N3" x="1200" y="0" z="0"/>
    <Node id="N4" x="2200" y="0" z="0"/>

    <Element id="PIPE-1" type="PIPE" pipelineRef="/P1" lineNo="L-1001" bore="250" startNode="N1" endNode="N2" refNo="REF-P1" seqNo="10"/>
    <Element id="VALVE-1" type="VALVE" pipelineRef="/P1" lineNo="L-1001" bore="250" startNode="N2" endNode="N3" refNo="REF-V1" seqNo="20"/>
    <Pipe id="PIPE-2" pipelineRef="/P1" lineNo="L-1001" bore="250" ep1="1200,0,0" ep2="2200,0,0" refNo="REF-P2" seqNo="30"/>
  </Pipeline>
</PlantModel>
`;

const BRANCH_XML_VARIANT = `
<?xml version="1.0"?>
<PlantModel>
  <Pipe id="HEADER-1" pipelineRef="/P2" lineNo="L-2001" bore="300" ep1="0,0,0" ep2="2000,0,0" refNo="REF-H" seqNo="10"/>
  <Tee id="TEE-1" pipelineRef="/P2" lineNo="L-2001" bore="300" branchBore="100" ep1="2000,0,0" ep2="2200,0,0" cp="2100,0,0" bp="2100,200,0" refNo="REF-T" seqNo="20"/>
  <Olet id="OLET-1" pipelineRef="/P2" lineNo="L-2001" bore="300" branchBore="80" cp="1000,0,0" bp="1000,250,0" refNo="REF-O" seqNo="30"/>
  <Support id="SUP-1" type="PS-GUIDE" pipelineRef="/P2" lineNo="L-2001" supportCoord="500,0,-250" refNo="REF-S" seqNo="40"/>
</PlantModel>
`;

const CAESAR_INPUT_XML_VARIANT = `
<?xml version="1.0"?>
<PIPINGMODEL JOBNAME="RMSS" NUMELT="3">
  <PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DIAMETER="250.0000" DELTA_X="1000.0000" DELTA_Y="-1.010100" DELTA_Z="-1.010100"/>
  <PIPINGELEMENT FROM_NODE="20" TO_NODE="30" DIAMETER="-1.010100" DELTA_X="-1.010100" DELTA_Y="500.0000" DELTA_Z="-1.010100">
    <RIGID TYPE="Valve"/>
  </PIPINGELEMENT>
  <PIPINGELEMENT FROM_NODE="30" TO_NODE="40" DIAMETER="-1.010100" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="250.0000">
    <BEND/>
  </PIPINGELEMENT>
</PIPINGMODEL>
`;

const CAESAR_INPUT_XML_WITH_GEOM_COMMENTS = `
<?xml version="1.0"?>
<CAESARII VERSION="14.00" XML_TYPE="Input">
<PIPINGMODEL JOBNAME="RMSS" NUMELT="2">
  <PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DIAMETER="250.000000" DELTA_X="1000.000000" DELTA_Y="-1.010100" DELTA_Z="-1.010100">
    <!-- UXML_GEOM FROM_X="150000.000000" FROM_Y="160000.000000" FROM_Z="1000.000000" TO_X="151000.000000" TO_Y="160000.000000" TO_Z="1000.000000" -->
  </PIPINGELEMENT>
  <PIPINGELEMENT FROM_NODE="30.000000" TO_NODE="40.000000" DIAMETER="-1.010100" DELTA_X="-1.010100" DELTA_Y="-500.000000" DELTA_Z="-1.010100">
    <!-- UXML_GEOM FROM_X="152000.000000" FROM_Y="160000.000000" FROM_Z="1000.000000" TO_X="152000.000000" TO_Y="159500.000000" TO_Z="1000.000000" -->
  </PIPINGELEMENT>
</PIPINGMODEL>
</CAESARII>
`;

const CAESAR_INPUT_XML_WITH_TYPE_HINTS = `
<?xml version="1.0"?>
<CAESARII VERSION="14.00" XML_TYPE="Input">
<PIPINGMODEL JOBNAME="RMSS" NUMELT="2">
  <PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DIAMETER="250.000000" DELTA_X="1000.000000" DELTA_Y="-1.010100" DELTA_Z="-1.010100">
    <!-- UXML_GEOM TYPE="TEE" FROM_X="150000.000000" FROM_Y="160000.000000" FROM_Z="1000.000000" TO_X="151000.000000" TO_Y="160000.000000" TO_Z="1000.000000" -->
  </PIPINGELEMENT>
  <PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" DIAMETER="-1.010100" DELTA_X="-1.010100" DELTA_Y="500.000000" DELTA_Z="-1.010100">
    <!-- UXML_GEOM TYPE="OLET" FROM_X="151000.000000" FROM_Y="160000.000000" FROM_Z="1000.000000" TO_X="151000.000000" TO_Y="160500.000000" TO_Z="1000.000000" -->
  </PIPINGELEMENT>
</PIPINGMODEL>
</CAESARII>
`;

const CAESAR_INPUT_XML_WITH_PDF_SIF_TYPES = `
<?xml version="1.0"?>
<CAESARII VERSION="11.00" XML_TYPE="Input">
<PIPINGMODEL JOBNAME="PDF-GENERATED" NUMELT="2">
  <PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DIAMETER="250.000000" DELTA_X="1000.000000" DELTA_Y="-1.010100" DELTA_Z="-1.010100">
    <SIF SIF_NUM="1" NODE="20.000000" TYPE="3.000000"/>
  </PIPINGELEMENT>
  <PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" DIAMETER="-1.010100" DELTA_X="-1.010100" DELTA_Y="500.000000" DELTA_Z="-1.010100">
    <SIF SIF_NUM="1" NODE="30.000000" TYPE="5.000000"/>
  </PIPINGELEMENT>
</PIPINGMODEL>
</CAESARII>
`;

function freshDoc() {
  const doc = createUxmlDocument();
  doc.sources.push(createUxmlSource({
    id: 'SRC-1',
    format: XML_PROFILES.INPUT_XML,
    name: 'test-input.xml',
    role: 'PRIMARY',
  }));
  return doc;
}

describe('UxmlInputXmlSchemaMapper Agent 18', () => {
  it('maps node-referenced InputXML elements into UXML components and anchors', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(INPUT_XML_VARIANT, doc, 'SRC-1', {
      fileName: '1001-P - COPY_INPUT.XML',
    });

    expect(result.schema).toBe('uxml-inputxml-schema-mapper/v1');
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

  it('maps branch components and supports with CP/BP/support anchors', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(BRANCH_XML_VARIANT, doc, 'SRC-1', {
      fileName: 'branch_INPUT.XML',
    });

    expect(result.ok).toBe(true);

    const tee = doc.components.find(c => c.id === 'TEE-1');
    const olet = doc.components.find(c => c.id === 'OLET-1');
    const support = doc.components.find(c => c.id === 'SUP-1');

    expect(tee).toBeTruthy();
    expect(olet).toBeTruthy();
    expect(support).toBeTruthy();

    expect(tee.anchorIds.some(id => id.includes('BP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('CP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('BP'))).toBe(true);

    expect(doc.supports).toHaveLength(1);
    expect(doc.supports[0].componentId).toBe('SUP-1');
  });

  it('does not mutate source XML and records diagnostics/loss for partial schemas', () => {
    const xml = '<PlantModel><UnknownThing id="X1"/></PlantModel>';
    const before = String(xml);
    const doc = freshDoc();

    const result = mapInputXmlToUxml(xml, doc, 'SRC-1', {
      fileName: 'unknown_INPUT.XML',
    });

    expect(xml).toBe(before);
    expect(result.ok).toBe(false);
    expect(doc.components).toHaveLength(0);
    expect(doc.lossContract.some(l => l.code === 'UXML-INPUTXML-MAPPER-NO-COMPONENT-TAGS')).toBe(true);
    expect(doc.diagnostics.some(d => d.code === 'UXML-INPUTXML-MAPPER-ZERO-COMPONENTS')).toBe(true);
  });

  it('normalizer uses adaptive mapper for filename-hinted InputXML variants', () => {
    const result = normalizeXmlToUxml(INPUT_XML_VARIANT, {
      fileName: '1001-P - COPY_INPUT.XML',
      selectedSourceType: 'INPUT_XML',
      profileReport: {
        profile: XML_PROFILES.INPUT_XML,
        blockers: [],
        confidence: 'MEDIUM',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.uxml.components.length).toBe(3);
    expect(result.uxml.anchors.length).toBeGreaterThanOrEqual(6);
    expect(result.uxml.segments.length).toBe(3);
    expect(result.diagnostics.some(d => d.code === 'UXML-NORMALIZER-INPUTXML-MAPPER-OK')).toBe(true);
  });

  it('maps CAESAR PIPINGELEMENT rows with inherited diameter and chained deltas', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(CAESAR_INPUT_XML_VARIANT, doc, 'SRC-1', {
      fileName: 'rmss_INPUT.XML',
    });

    expect(result.ok).toBe(true);
    expect(result.candidateTagCount).toBe(3);
    expect(doc.components).toHaveLength(3);
    expect(doc.segments).toHaveLength(3);
    expect(doc.components.map(component => component.bore)).toEqual([250, 250, 250]);
    expect(doc.components[1].normalizedType).toBe('VALVE');
    expect(doc.components[2].normalizedType).toBe('BEND');

    const uniquePoints = new Set(doc.anchors.map(anchor => [
      anchor.point.x,
      anchor.point.y,
      anchor.point.z,
    ].join(',')));

    expect(uniquePoints.size).toBeGreaterThan(1);
    expect(doc.lossContract.some(loss => loss.code === 'UXML-INPUTXML-CAESAR-DIAMETER-MISSING')).toBe(false);
  });

  it('uses generated UXML_GEOM comments to preserve staged JSON absolute geometry', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(CAESAR_INPUT_XML_WITH_GEOM_COMMENTS, doc, 'SRC-1', {
      fileName: 'caesar.xml',
    });

    expect(result.ok).toBe(true);
    expect(doc.components).toHaveLength(2);

    const firstStart = doc.anchors.find(anchor => anchor.id === 'IX-A-IX-PE-00001-EP1')?.point;
    const secondStart = doc.anchors.find(anchor => anchor.id === 'IX-A-IX-PE-00002-EP1')?.point;

    expect(firstStart).toEqual({ x: 150000, y: 160000, z: 1000 });
    expect(secondStart).toEqual({ x: 152000, y: 160000, z: 1000 });
    expect(doc.diagnostics.find(diagnostic => diagnostic.code === 'UXML-INPUTXML-CAESAR-PIPINGELEMENTS')?.details.absoluteGeometryCommentCount).toBe(2);
  });

  it('uses generated UXML_GEOM type hints to preserve branch fitting identity', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(CAESAR_INPUT_XML_WITH_TYPE_HINTS, doc, 'SRC-1', {
      fileName: 'caesar.xml',
    });

    expect(result.ok).toBe(true);
    expect(doc.components.map(component => component.normalizedType)).toEqual(['TEE', 'OLET']);

    const olet = doc.components.find(component => component.normalizedType === 'OLET');

    expect(olet.anchorIds.some(id => id.includes('CP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('BP'))).toBe(true);
    expect(doc.segments.some(segment => segment.componentId === olet.id)).toBe(true);
  });

  it('infers branch fitting identity from CAESAR PDF-generated SIF type codes', () => {
    const doc = freshDoc();

    const result = mapInputXmlToUxml(CAESAR_INPUT_XML_WITH_PDF_SIF_TYPES, doc, 'SRC-1', {
      fileName: 'pdf_generated_INPUT.XML',
    });

    expect(result.ok).toBe(true);
    expect(doc.components.map(component => component.normalizedType)).toEqual(['TEE', 'OLET']);

    const olet = doc.components.find(component => component.normalizedType === 'OLET');

    expect(olet.anchorIds.some(id => id.includes('CP'))).toBe(true);
    expect(olet.anchorIds.some(id => id.includes('BP'))).toBe(true);
    expect(doc.segments.some(segment => segment.componentId === olet.id)).toBe(true);
  });

  it('provides alias export', () => {
    const doc = freshDoc();

    const result = mapInputXmlSchemaToUxml(INPUT_XML_VARIANT, doc, 'SRC-1', {
      fileName: 'alias_INPUT.XML',
    });

    expect(result.schema).toBe('uxml-inputxml-schema-mapper/v1');
    expect(result.ok).toBe(true);
  });
});
