import { SourceFileRecord } from '../SourceFileRecord.js';
import { SourceDialectInfo } from '../SourceDialectInfo.js';
import { buildXmlCanonicalProject } from '../../builders/xml/xml-graph-builder.js';

function attrNum(node, key, fallback = null) {
  if (!node || !node.getAttribute) return fallback;
  const raw = node.getAttribute(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseCaesarXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const model = doc.querySelector('PIPINGMODEL');
  const elements = [];
  const restraints = [];
  const bends = [];

  const elementNodes = [...doc.querySelectorAll('PIPINGELEMENT')];
  elementNodes.forEach((elNode, index) => {
    const el = {
      index,
      from: Number(elNode.getAttribute('FROM_NODE')),
      to: Number(elNode.getAttribute('TO_NODE')),
      dx: attrNum(elNode, 'DELTA_X', 0),
      dy: attrNum(elNode, 'DELTA_Y', 0),
      dz: attrNum(elNode, 'DELTA_Z', 0),
      od: attrNum(elNode, 'OD', null),
      wall: attrNum(elNode, 'WALL_THICKNESS', null),
      material: elNode.getAttribute('MATNAME') || '',
      name: elNode.getAttribute('NAME') || '',
      lineNo: elNode.getAttribute('LINE_NO') || elNode.getAttribute('LINE-NO') || '',
      P1: attrNum(elNode, 'P1', null),
      T1: attrNum(elNode, 'T1', null),
      corrosion: attrNum(elNode, 'CORR_THK', null),
      hasBend: false,
      bend: null,
    };
    elements.push(el);
  });

  [...doc.querySelectorAll('BEND')].forEach((bNode) => {
    const nearNode = Number(bNode.getAttribute('NEAR_NODE') || bNode.getAttribute('NODE') || NaN);
    const radius = attrNum(bNode, 'RADIUS', null);
    let matched = -1;
    if (Number.isFinite(nearNode)) {
      matched = elements.findIndex((el) => Number(el.from) === nearNode || Number(el.to) === nearNode);
    }
    if (matched >= 0) {
      elements[matched].hasBend = true;
      elements[matched].bend = { nearNode, radius, centrePoint: null };
      bends.push({ elementIndex: matched, nearNode, radius });
    }
  });

  [...doc.querySelectorAll('RESTRAINT')].forEach((rNode) => {
    restraints.push({
      node: Number(rNode.getAttribute('NODE')),
      rawType: rNode.getAttribute('TYPE') || rNode.getAttribute('RESTRAINT_TYPE') || '',
      supportBlock: rNode.getAttribute('SUPPORT_NAME') || '',
      supportDescription: rNode.getAttribute('DESC') || '',
      axisCosines: {
        x: attrNum(rNode, 'XCOSINE', 0),
        y: attrNum(rNode, 'YCOSINE', 0),
        z: attrNum(rNode, 'ZCOSINE', 0),
      },
      dofs: [],
    });
  });

  return {
    format: 'XML',
    dialect: 'CAESAR_XML',
    meta: {
      jobName: model?.getAttribute('JOBNAME') || '',
      northX: attrNum(model, 'NORTH_X', null),
      northY: attrNum(model, 'NORTH_Y', null),
      northZ: attrNum(model, 'NORTH_Z', null),
    },
    elements,
    bends,
    restraints,
  };
}

export class CaesarXmlImportAdapter {
  static detect(xmlText) {
    return /<\s*PIPINGMODEL/i.test(xmlText || '') || /<\s*PIPINGELEMENT/i.test(xmlText || '');
  }

  async import({ id = '', name = 'input.xml', text = '' } = {}) {
    const parsed = parseCaesarXml(text);
    const dialectInfo = new SourceDialectInfo({
      format: 'XML',
      dialect: 'CAESAR_XML',
      units: 'SOURCE_DEFINED',
      axisConvention: 'Y_UP',
      metadata: parsed.meta,
    });
    const sourceRecord = new SourceFileRecord({
      id: id || `xml-${Date.now()}`,
      name,
      format: 'XML',
      dialect: dialectInfo.dialect,
      rawText: text,
      metadata: { ...parsed.meta, dialectInfo },
    });
    sourceRecord.addMessage('INFO', 'CAESAR XML parsed.', { elements: parsed.elements.length, restraints: parsed.restraints.length });
    const project = buildXmlCanonicalProject({ sourceRecord, parsed });
    return { sourceRecord, parsed, project };
  }
}
