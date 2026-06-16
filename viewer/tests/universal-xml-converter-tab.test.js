import { describe, expect, it } from 'vitest';

// Set up JSDOM for this specific test
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
import {
  detectSourceType,
  runPipelineActionAsync,
  runPipelineAction,
  runUniversalXmlPipelineFromText,
  renderUniversalXmlConverterTab,
  _test,
} from '../tabs/universal-xml-converter-tab.js';

const STANDARD_XML_SAMPLE = `
<Project>
  <Component
    id="PIPE-001"
    type="PIPE"
    pipelineRef="/P1"
    bore="250"
    ep1="0,0,0"
    ep2="1000,0,0"
  />
  <Component
    id="VALVE-001"
    type="VALVE"
    pipelineRef="/P1"
    bore="250"
    ep1="1000,0,0"
    ep2="1200,0,0"
  />
  <Component
    id="PIPE-002"
    type="PIPE"
    pipelineRef="/P1"
    bore="250"
    ep1="1200,0,0"
    ep2="2000,0,0"
  />
</Project>
`;

const OLET_XML_SAMPLE = `
<Project>
  <Component
    id="HEADER-001"
    type="PIPE"
    pipelineRef="/P1"
    bore="250"
    ep1="0,0,0"
    ep2="1000,0,0"
  />
  <Component
    id="OLET-001"
    type="OLET"
    pipelineRef="/P1"
    bore="250"
    branchBore="100"
    cp="500,0,0"
    bp="500,100,0"
  />
  <Component
    id="BRANCH-001"
    type="PIPE"
    pipelineRef="/P1"
    bore="100"
    ep1="500,250,0"
    ep2="500,900,0"
  />
</Project>
`;

describe('Universal XML Converter Tab Agent 09', () => {
  it('detects XML source types from content/profile', () => {
    expect(detectSourceType('sample.xml', '<UXML/>')).toBe('UXML');

    expect(detectSourceType('input.xml', `
      <InputXML>
        <Nodes>
          <Node id="N1" x="0" y="0" z="0"/>
        </Nodes>
      </InputXML>
    `)).toBe('INPUT_XML');

    expect(detectSourceType('standard.xml', STANDARD_XML_SAMPLE)).toBe('STANDARD_XML');
  });

  it('detects *_INPUT.XML as InputXML source type using filename hint', () => {
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

    expect(detectSourceType('1001-P - COPY_INPUT.XML', xml)).toBe('INPUT_XML');
  });

  it('detects CAESARII PIPINGELEMENT XML as InputXML without filename hint', () => {
    expect(detectSourceType('caesar.xml', `
      <CAESARII VERSION="14.00" XML_TYPE="Input">
        <PIPINGMODEL JOBNAME="RMSS">
          <PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="100" DELTA_Y="-1.0101" DELTA_Z="-1.0101"/>
        </PIPINGMODEL>
      </CAESARII>
    `)).toBe('INPUT_XML');
  });

  it('uses extension fallback for non-XML converter sources', () => {
    expect(detectSourceType('model.pcf', 'PIPELINE-REFERENCE X')).toBe('PCF');
    expect(detectSourceType('drawing.pdf', '%PDF')).toBe('PDF');
    expect(detectSourceType('model.rev', 'REV')).toBe('REV_TO_XML');
    expect(detectSourceType('stage.json', '{"a":1}')).toBe('STAGED_JSON');
    expect(detectSourceType('attributes.txt', 'A=B')).toBe('TXT_TO_XML');
  });

  it('runs full UXML pipeline for Standard XML source', () => {
    const state = runUniversalXmlPipelineFromText(STANDARD_XML_SAMPLE, {
      sourceName: 'standard.xml',
    });

    expect(state.detectedSourceType).toBe('STANDARD_XML');

    expect(state.pipeline.profileReport.profile).toBe('STANDARD_XML');
    expect(state.pipeline.normalizerResult.ok).toBe(true);
    expect(state.pipeline.uxml.components.length).toBe(3);

    expect(state.pipeline.validationReport.ready).toBe(true);
    expect(state.pipeline.faceModel.ok).toBe(true);

    expect(state.pipeline.universalGraph.schema).toBe('uxml-universal-topo-graph/v1');
    expect(state.pipeline.universalGraph.summary.edgeCount).toBe(2);

    expect(state.pipeline.rayGraph.schema).toBe('uxml-ray-topo-graph/v2');
    expect(state.pipeline.comparison.schema).toBe('uxml-topo-graph-comparator/v1');
  });

  it('runs full UXML pipeline and surfaces ray/comparator evidence for OLET branch gap', () => {
    const state = runUniversalXmlPipelineFromText(OLET_XML_SAMPLE, {
      sourceName: 'olet.xml',
    });

    expect(state.pipeline.normalizerResult.ok).toBe(true);
    expect(state.pipeline.uxml.components.length).toBe(3);

    expect(state.pipeline.universalGraph.summary.disconnectedCount).toBeGreaterThan(0);
    expect(state.pipeline.rayGraph.summary.rayCandidateCount).toBeGreaterThanOrEqual(1);
    expect(state.pipeline.comparison.summary.rayCandidateCount).toBeGreaterThanOrEqual(1);
  });

  it('blocks raw PCF source from UXML normalization until existing converter bridge is used', () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'model.pcf',
      size: 32,
      type: 'text/plain',
      lastModified: null,
    };
    state.sourceText = 'PIPELINE-REFERENCE X\nPIPE';
    state.selectedSourceType = 'PCF';
    state.detectedSourceType = 'PCF';

    expect(() => runPipelineAction(state, 'convert-uxml')).toThrow(/PCF must go through the existing converter bridge before UXML normalization/);
  });

  it('provides stable source action gating', () => {
    const state = _test.createInitialState();

    expect(_test.canRunXmlActions(state)).toBe(true);

    state.sourceText = STANDARD_XML_SAMPLE;
    state.detectedSourceType = 'STANDARD_XML';

    expect(_test.canRunXmlActions(state)).toBe(true);

    state.selectedSourceType = 'PCF';

    expect(_test.canRunXmlActions(state)).toBe(true);
  });

  it('builds export summary with deferred output/master placeholders', () => {
    const state = runUniversalXmlPipelineFromText(STANDARD_XML_SAMPLE, {
      sourceName: 'summary.xml',
    });

    const summary = _test.buildSummary(state);

    expect(summary.schema).toBe('pcf-glb-viewer/universal-xml-converter-tab-summary/v2');
    expect(summary.phase).toBe('Agent09');
    expect(summary.source.name).toBe('summary.xml');
    expect(summary.deferred.existingConverterBridge).toBe(false);
    expect(summary.deferred.outputBridges).toBe(true);
    expect(summary.deferred.masters).toBe(true);
    expect(summary.comparator).toBeTruthy();
  });

  it('routes raw PCF source through Source Intake Bridge before UXML normalization', async () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'model.pcf',
      size: 128,
      type: 'text/plain',
      lastModified: null,
    };
    state.sourceText = `
ISOGEN-FILES ISOGEN.FLS
PIPELINE-REFERENCE /TEST
PIPE
    END-POINT 0 0 0
    END-POINT 1000 0 0
`;
    state.selectedSourceType = 'PCF';
    state.detectedSourceType = 'PCF';

    const intake = await runPipelineActionAsync(state, 'run-source-intake-bridge');

    expect(intake.ok).toBe(true);
    expect(intake.bridgeOutputProfile).toBe('STANDARD_XML');
    expect(state.pipeline.uxml.components.length).toBeGreaterThan(0);
  });

  it('can run the pipeline step-by-step through runPipelineAction', () => {
    const state = _test.createInitialState();

    state.sourceFile = {
      name: 'step.xml',
      size: STANDARD_XML_SAMPLE.length,
      type: 'text/xml',
      lastModified: null,
    };
    state.sourceText = STANDARD_XML_SAMPLE;
    state.detectedSourceType = detectSourceType('step.xml', STANDARD_XML_SAMPLE);

    const profile = runPipelineAction(state, 'detect-profile');
    expect(profile.profile).toBe('STANDARD_XML');

    const normalized = runPipelineAction(state, 'convert-uxml');
    expect(normalized.ok).toBe(true);

    const validation = runPipelineAction(state, 'validate-uxml');
    expect(validation.ready).toBe(true);

    const faceModel = runPipelineAction(state, 'build-face-model');
    expect(faceModel.ok).toBe(true);

    const universal = runPipelineAction(state, 'build-universal-topology');
    expect(universal.schema).toBe('uxml-universal-topo-graph/v1');

    const ray = runPipelineAction(state, 'build-ray-topology');
    expect(ray.schema).toBe('uxml-ray-topo-graph/v2');

    const comparison = runPipelineAction(state, 'compare-topology');
    expect(comparison.schema).toBe('uxml-topo-graph-comparator/v1');

    const decision = runPipelineAction(state, 'run-decision-gate');
    expect(decision.schema).toBe('uxml-topology-decision-gate/v1');

    const handoff = runPipelineAction(state, 'run-route-handoff');
    expect(handoff.schema).toBe('uxml-route-handoff-payload/v1');
  });

  it('exposes decision gate and route handoff stages', () => {
    const stageIds = _test.PIPELINE_STAGES.map(stage => stage.id);

    expect(stageIds).toContain('decision-gate');
    expect(stageIds).toContain('route-handoff');
    expect(stageIds).toContain('cl1-package');
    expect(stageIds).toContain('cl1-snapshot');
    expect(stageIds).toContain('cl1-replay');
    expect(stageIds).toContain('cl1-summary');
    expect(stageIds.indexOf('cl1-package')).toBeGreaterThan(stageIds.indexOf('route-handoff'));
    expect(stageIds.indexOf('cl1-snapshot')).toBeGreaterThan(stageIds.indexOf('cl1-package'));
    expect(stageIds.indexOf('cl1-replay')).toBeGreaterThan(stageIds.indexOf('cl1-snapshot'));
    expect(stageIds.indexOf('cl1-summary')).toBeGreaterThan(stageIds.indexOf('cl1-replay'));
  });

  it('keeps route handoff wording separate from direct PCF export', () => {
    const container = document.createElement('div');
    renderUniversalXmlConverterTab(container);

    const html = container.innerHTML;

    expect(html).toContain('Route Handoff');
    expect(html).toContain('Masters by Target Route');
    expect(html).toContain('Route Package');
    expect(html).toContain('does not emit PCF');
    expect(html).not.toContain('Masters deferred');
  });
});
