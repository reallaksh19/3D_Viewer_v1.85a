import { describe, expect, it } from 'vitest';
import { detectUxmlProfile, detectXmlProfile, assertXmlProfileBuildAllowed } from '../uxml/UxmlProfileDetector.js';
import { XML_PROFILES } from '../uxml/UxmlConstants.js';

describe('UxmlProfileDetector', () => {
  it('detects UXML profile', () => {
    const report = detectUxmlProfile('<UXML profile="test"></UXML>');
    expect(report.profile).toBe(XML_PROFILES.UXML);
  });

  it('detects STANDARD_XML profile', () => {
    const report = detectUxmlProfile('<Project><Component/></Project>');
    expect(report.profile).toBe(XML_PROFILES.STANDARD_XML);
  });

  it('detects INPUT_XML profile', () => {
    const report = detectUxmlProfile('<InputXML><Nodes></Nodes><Elements></Elements></InputXML>');
    expect(report.profile).toBe(XML_PROFILES.INPUT_XML);
  });

  it('detects BENCHMARK_XML profile', () => {
    const report = detectUxmlProfile('<BenchmarkCase><ExpectedResult></ExpectedResult></BenchmarkCase>');
    expect(report.profile).toBe(XML_PROFILES.BENCHMARK_XML);
  });

  it('allows build for supported profiles', () => {
    expect(assertXmlProfileBuildAllowed({ profile: XML_PROFILES.STANDARD_XML, blockers: [] }).ok).toBe(true);
    expect(assertXmlProfileBuildAllowed({ profile: XML_PROFILES.UNKNOWN_XML, blockers: ['NOT_XML'] }).ok).toBe(false);
  });

  it('detects filename-hinted Input XML even without literal InputXML root', () => {
    const xml = `
      <?xml version="1.0"?>
      <PlantModel>
        <Pipeline name="L-1001">
          <Node id="N1" x="0" y="0" z="0"/>
          <Node id="N2" x="1000" y="0" z="0"/>
          <Element id="E1" type="PIPE" startNode="N1" endNode="N2"/>
        </Pipeline>
      </PlantModel>
    `;

    const report = detectXmlProfile(xml, {
      fileName: '1001-P - COPY_INPUT.XML',
    });

    expect(report.profile).toBe('INPUT_XML');
    expect(report.isKnownProfile).toBe(true);
    expect(report.shouldBlockTopologyBuild).toBe(false);
    expect(report.confidence).toBe('MEDIUM');
  });
});
