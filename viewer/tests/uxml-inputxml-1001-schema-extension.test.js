import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  COMPONENT_TYPES,
  XML_PROFILES,
} from '../uxml/UxmlConstants.js';

import {
  createUxmlDocument,
  createUxmlSource,
} from '../uxml/UxmlTypes.js';

import {
  UXML_INPUTXML_1001_EXPECTED_METRICS,
  UXML_INPUTXML_1001_COPY_SCHEMA_EXTENSION_SCHEMA,
  mapInputXmlToUxml,
} from '../uxml/UxmlInputXmlSchemaMapper.js';

import {
  normalizeXmlToUxml,
} from '../uxml/UxmlNormalizer.js';

const BENCHMARK_XML = 'Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML';
const AUDIT_JSON = 'Benchmarks/InputXML Schema Audit/1001-P-COPY-inputxml-audit.json';

function freshDoc() {
  const doc = createUxmlDocument();

  doc.sources.push(createUxmlSource({
    id: 'SRC-1',
    format: XML_PROFILES.INPUT_XML,
    name: '1001-P - COPY_INPUT.XML',
    role: 'PRIMARY',
  }));

  return doc;
}

function countByType(doc, type) {
  return doc.components.filter(component => component.normalizedType === type).length;
}

describe('Import Agent 20 - 1001 COPY_INPUT.XML schema extension', () => {
  it('maps the real benchmark signature and emits the audit diagnostic', () => {
    const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
    const xml = fs.readFileSync(BENCHMARK_XML, 'utf8');
    const doc = freshDoc();

    const result = mapInputXmlToUxml(xml, doc, 'SRC-1', {
      fileName: '1001-P - COPY_INPUT.XML',
    });

    expect(result.schema).toBe('uxml-inputxml-schema-mapper/v1');
    expect(result.ok).toBe(true);
    expect(result.candidateTagCount).toBe(audit.metrics.elements);

    const auditDiagnostic = doc.diagnostics.find(diagnostic =>
      diagnostic.code === 'UXML-INPUTXML-1001-COPY-SCHEMA-EXTENSION'
    );

    expect(auditDiagnostic).toBeTruthy();
    expect(auditDiagnostic.severity).toBe('INFO');
    expect(auditDiagnostic.details.schema).toBe(UXML_INPUTXML_1001_COPY_SCHEMA_EXTENSION_SCHEMA);
    expect(auditDiagnostic.details.expected).toEqual(UXML_INPUTXML_1001_EXPECTED_METRICS);
    expect(auditDiagnostic.details.actual).toEqual({
      elements: audit.metrics.elements,
      bends: audit.metrics.bends,
      rigids: audit.metrics.rigids,
      reducers: audit.metrics.reducers,
      hangers: audit.metrics.hangers,
      restraints: audit.metrics.restraints,
      sifTees: audit.metrics.sif_tees,
    });
    expect(auditDiagnostic.details.matched).toBe(true);

    expect(doc.components.length).toBe(audit.metrics.elements + audit.metrics.hangers + audit.metrics.restraints);
    expect(doc.segments.length).toBe(audit.metrics.elements);
    expect(doc.supports.length).toBe(audit.metrics.hangers + audit.metrics.restraints);

    expect(countByType(doc, COMPONENT_TYPES.BEND)).toBe(audit.metrics.bends);
    expect(countByType(doc, COMPONENT_TYPES.TEE)).toBe(audit.metrics.sif_tees);
    expect(countByType(doc, COMPONENT_TYPES.SUPPORT)).toBe(audit.metrics.hangers + audit.metrics.restraints);
    expect(
      countByType(doc, COMPONENT_TYPES.REDUCER_CONCENTRIC) +
      countByType(doc, COMPONENT_TYPES.REDUCER_ECCENTRIC)
    ).toBe(audit.metrics.reducers);

    expect(doc.diagnostics.some(diagnostic =>
      diagnostic.code === 'UXML-INPUTXML-CAESAR-PIPINGELEMENTS'
    )).toBe(true);
  });

  it('normalizer routes the same benchmark file through the extension without mutating source XML', () => {
    const xml = fs.readFileSync(BENCHMARK_XML, 'utf8');
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
    expect(result.uxml.components.length).toBeGreaterThan(0);
    expect(result.diagnostics.some(diagnostic =>
      diagnostic.code === 'UXML-INPUTXML-1001-COPY-SCHEMA-EXTENSION'
    )).toBe(true);
  });
});
