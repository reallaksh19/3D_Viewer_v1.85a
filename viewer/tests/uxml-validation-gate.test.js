import { describe, expect, it } from 'vitest';

import {
  ANCHOR_ROLES,
  COMPONENT_TYPES,
  PORT_ROLES,
  SEGMENT_TYPES,
} from '../uxml/UxmlConstants.js';

import {
  createUxmlAnchor,
  createUxmlComponent,
  createUxmlDocument,
  createUxmlPort,
  createUxmlSegment,
  createUxmlSource,
  createUxmlSupport,
} from '../uxml/UxmlTypes.js';

import {
  runUxmlValidationGate,
  validateUxmlDocument,
} from '../uxml/UxmlValidationGate.js';

function p(x, y, z) {
  return { x, y, z };
}

function validPipeDoc() {
  const doc = createUxmlDocument();

  doc.sources.push(createUxmlSource({
    id: 'SRC-1',
    format: 'STANDARD_XML',
    name: 'standard.xml',
  }));

  doc.components.push(createUxmlComponent({
    id: 'C-PIPE-1',
    sourceRefs: ['SRC-1'],
    type: COMPONENT_TYPES.PIPE,
    normalizedType: COMPONENT_TYPES.PIPE,
    pipelineRef: '/P1',
    bore: 250,
    anchorIds: ['A-PIPE-EP1', 'A-PIPE-EP2'],
    portIds: ['P-PIPE-EP1', 'P-PIPE-EP2'],
    segmentIds: ['S-PIPE-1'],
  }));

  doc.anchors.push(
    createUxmlAnchor({
      id: 'A-PIPE-EP1',
      componentId: 'C-PIPE-1',
      role: ANCHOR_ROLES.EP1,
      point: p(0, 0, 0),
      confidence: 'EXACT_SOURCE',
    }),
    createUxmlAnchor({
      id: 'A-PIPE-EP2',
      componentId: 'C-PIPE-1',
      role: ANCHOR_ROLES.EP2,
      point: p(1000, 0, 0),
      confidence: 'EXACT_SOURCE',
    })
  );

  doc.ports.push(
    createUxmlPort({
      id: 'P-PIPE-EP1',
      componentId: 'C-PIPE-1',
      anchorId: 'A-PIPE-EP1',
      role: PORT_ROLES.PIPE_END_1,
      point: p(0, 0, 0),
      bore: 250,
      fixed: false,
      futureMovable: true,
    }),
    createUxmlPort({
      id: 'P-PIPE-EP2',
      componentId: 'C-PIPE-1',
      anchorId: 'A-PIPE-EP2',
      role: PORT_ROLES.PIPE_END_2,
      point: p(1000, 0, 0),
      bore: 250,
      fixed: false,
      futureMovable: true,
    })
  );

  doc.segments.push(createUxmlSegment({
    id: 'S-PIPE-1',
    componentId: 'C-PIPE-1',
    type: SEGMENT_TYPES.PIPE_RUN,
    startAnchorId: 'A-PIPE-EP1',
    endAnchorId: 'A-PIPE-EP2',
    bore: 250,
  }));

  return doc;
}

describe('UxmlValidationGate Agent 03', () => {
  it('returns fatal report for non-object input', () => {
    const report = validateUxmlDocument(null);

    expect(report.ready).toBe(false);
    expect(report.exportAllowed).toBe(false);
    expect(report.diagnostics.some(d => d.code === 'UXML-DOCUMENT-NOT-OBJECT')).toBe(true);
    expect(report.stats.fatalCount).toBe(1);
  });

  it('detects missing required UXML sections', () => {
    const doc = createUxmlDocument();
    delete doc.anchors;
    delete doc.ports;

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.sections.uxml.ok).toBe(false);
    expect(report.sections.uxml.missingSections).toEqual(['anchors', 'ports']);
    expect(report.diagnostics.some(d => d.code === 'UXML-SHAPE-MISSING-SECTIONS')).toBe(true);
  });

  it('passes a valid pipe UXML document', () => {
    const report = validateUxmlDocument(validPipeDoc());

    expect(report.ready).toBe(true);
    expect(report.exportAllowed).toBe(true);
    expect(report.stats.errorCount).toBe(0);
    expect(report.stats.requiredAnchorMissingCount).toBe(0);
    expect(report.stats.convertedBoreMissingCount).toBe(0);
    expect(report.stats.pipeSegmentMissingCount).toBe(0);
  });

  it('detects duplicate component ids', () => {
    const doc = validPipeDoc();
    doc.components.push(createUxmlComponent({
      id: 'C-PIPE-1',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.PIPE,
      normalizedType: COMPONENT_TYPES.PIPE,
      bore: 250,
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.diagnostics.some(d => d.code === 'UXML-DUPLICATE-COMPONENT-ID')).toBe(true);
  });

  it('detects invalid anchor point and missing anchor component reference', () => {
    const doc = validPipeDoc();

    doc.anchors.push(createUxmlAnchor({
      id: 'A-BAD',
      componentId: 'C-MISSING',
      role: ANCHOR_ROLES.EP1,
      point: { x: 'bad', y: 0, z: 0 },
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.diagnostics.some(d => d.code === 'UXML-ANCHOR-POINT-INVALID')).toBe(true);
    expect(report.diagnostics.some(d => d.code === 'UXML-ANCHOR-COMPONENT-REF-MISSING')).toBe(true);
  });

  it('detects missing port anchor reference', () => {
    const doc = validPipeDoc();

    doc.ports.push(createUxmlPort({
      id: 'P-BAD',
      componentId: 'C-PIPE-1',
      anchorId: 'A-MISSING',
      role: PORT_ROLES.PIPE_END_1,
      point: p(0, 0, 0),
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.diagnostics.some(d => d.code === 'UXML-PORT-ANCHOR-REF-MISSING')).toBe(true);
  });

  it('detects segment anchor reference errors', () => {
    const doc = validPipeDoc();

    doc.segments.push(createUxmlSegment({
      id: 'S-BAD',
      componentId: 'C-PIPE-1',
      type: SEGMENT_TYPES.PIPE_RUN,
      startAnchorId: 'A-MISSING-1',
      endAnchorId: 'A-MISSING-2',
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.diagnostics.some(d => d.code === 'UXML-SEGMENT-ANCHOR-REF-MISSING')).toBe(true);
  });

  it('detects required PIPE anchors and pipe segment missing', () => {
    const doc = createUxmlDocument();

    doc.sources.push(createUxmlSource({ id: 'SRC-1', format: 'STANDARD_XML' }));
    doc.components.push(createUxmlComponent({
      id: 'C-PIPE-BAD',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.PIPE,
      normalizedType: COMPONENT_TYPES.PIPE,
      bore: 250,
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.stats.requiredAnchorMissingCount).toBe(2);
    expect(report.stats.pipeSegmentMissingCount).toBe(1);
    expect(report.diagnostics.some(d => d.code === 'UXML-COMPONENT-REQUIRED-ANCHOR-MISSING')).toBe(true);
    expect(report.diagnostics.some(d => d.code === 'UXML-PIPE-SEGMENT-MISSING')).toBe(true);
  });

  it('detects TEE branch anchor and branchBore missing', () => {
    const doc = validPipeDoc();

    doc.components.push(createUxmlComponent({
      id: 'C-TEE-1',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.TEE,
      normalizedType: COMPONENT_TYPES.TEE,
      bore: 250,
      branchBore: null,
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.stats.branchBoreMissingCount).toBe(1);
    expect(report.diagnostics.some(d => d.code === 'UXML-COMPONENT-BRANCH-BORE-MISSING')).toBe(true);
    expect(report.diagnostics.some(d => d.code === 'UXML-COMPONENT-REQUIRED-ANCHOR-MISSING')).toBe(true);
  });

  it('detects OLET CP/BP and branchBore missing', () => {
    const doc = validPipeDoc();

    doc.components.push(createUxmlComponent({
      id: 'C-OLET-1',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.OLET,
      normalizedType: COMPONENT_TYPES.OLET,
      bore: 250,
      branchBore: null,
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.stats.branchBoreMissingCount).toBe(1);
    expect(report.stats.requiredAnchorMissingCount).toBeGreaterThanOrEqual(2);
    expect(report.diagnostics.some(d => d.code === 'UXML-COMPONENT-BRANCH-BORE-MISSING')).toBe(true);
  });

  it('detects support pipe-continuity port', () => {
    const doc = validPipeDoc();

    doc.components.push(createUxmlComponent({
      id: 'C-SUP-1',
      sourceRefs: ['SRC-1'],
      type: COMPONENT_TYPES.SUPPORT,
      normalizedType: COMPONENT_TYPES.SUPPORT,
      anchorIds: ['A-SUP-1'],
      portIds: ['P-SUP-BAD'],
      supportId: 'SUP-1',
    }));

    doc.anchors.push(createUxmlAnchor({
      id: 'A-SUP-1',
      componentId: 'C-SUP-1',
      role: ANCHOR_ROLES.SUPPORT_POINT,
      point: p(500, -100, 0),
      confidence: 'EXACT_SOURCE',
    }));

    doc.ports.push(createUxmlPort({
      id: 'P-SUP-BAD',
      componentId: 'C-SUP-1',
      anchorId: 'A-SUP-1',
      role: PORT_ROLES.PIPE_END_1,
      point: p(500, -100, 0),
      connectsTo: 'ENDPOINT',
    }));

    doc.supports.push(createUxmlSupport({
      id: 'SUP-1',
      componentId: 'C-SUP-1',
      type: 'GUIDE',
      supportAnchorId: 'A-SUP-1',
    }));

    const report = validateUxmlDocument(doc);

    expect(report.ready).toBe(false);
    expect(report.stats.supportPipeContinuityPorts).toBe(1);
    expect(report.diagnostics.some(d => d.code === 'UXML-SUPPORT-PIPE-CONTINUITY-PORT')).toBe(true);
  });

  it('provides runUxmlValidationGate alias', () => {
    const report = runUxmlValidationGate(validPipeDoc());

    expect(report.ready).toBe(true);
    expect(report.schema).toBe('uxml-validation-gate/v1');
  });
});
