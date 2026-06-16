import { createAdapterGraph } from '../graph/createAdapterGraph.js';
import { namespaceImportedIds } from '../uxml/namespaceImportedIds.js';
import { unescapeXml } from '../uxml/xmlEscapes.js';
import { ARRAY_SECTION_KEYS, SECTION_TAGS } from '../uxml/sectionNames.js';

export function fromUxmlXml(xmlText, options = {}) {
  const text = String(xmlText || '').trim();
  const root = text.match(/^<UXML\b([^>]*)>/i);
  if (!root) throw new Error('UXML root element not found');
  const rootAttrs = parseAttributes(root[1]);
  const graph = createAdapterGraph({
    now: options.now,
    schemaVersion: rootAttrs.schemaVersion || 'uxml-topology-v1',
    profile: rootAttrs.profile || 'UXML-TOPOLOGY-FULL',
    header: readObject(text, 'Header', defaultHeader(options.now)),
    units: readObject(text, 'Units', undefined),
    adapter: readObject(text, 'Adapter', undefined),
  });
  for (const key of ARRAY_SECTION_KEYS) graph[key] = readArray(text, SECTION_TAGS[key]);
  if (!graph.components.length) graph.components = readLegacyComponents(text);
  return namespaceImportedIds(graph, options.idNamespace || '');
}

function defaultHeader(now) {
  return {
    projectId: '',
    modelId: '',
    createdBy: 'piping-adapter',
    createdAt: now || '1970-01-01T00:00:00.000Z',
    purpose: 'cross-repo-piping-exchange',
    notes: '',
  };
}

function readObject(text, tag, fallback) {
  const attrs = readElementAttributes(text, tag);
  if (attrs.data) return JSON.parse(unescapeXml(attrs.data));
  const plain = readPlainAttributes(attrs);
  if (!plain) return fallback;
  return fallback ? { ...fallback, ...plain } : plain;
}

function readPlainAttributes(attrs) {
  const entries = Object.entries(attrs).filter(([key]) => key !== 'data');
  return entries.length ? Object.fromEntries(entries) : null;
}

function readArray(text, tag) {
  const body = readElementBody(text, tag);
  if (!body) return [];
  return [...body.matchAll(/<Item\b([^>]*?)\/>/gi)]
    .map((match) => parseAttributes(match[1]).data)
    .filter((data) => data != null)
    .map((data) => JSON.parse(unescapeXml(data)));
}

function readLegacyComponents(text) {
  return [...text.matchAll(/<Component\b([^>]*?)\/>/gi)].map((match) => {
    const attrs = parseAttributes(match[1]);
    return {
      id: attrs.id || '',
      sourceRefs: [],
      type: attrs.type || 'UNKNOWN',
      normalizedType: attrs.normalizedType || attrs.type || 'UNKNOWN',
      pipelineRef: attrs.pipelineRef || '',
      lineKey: '',
      refNo: '',
      seqNo: '',
      name: attrs.name || attrs.id || '',
      bore: null,
      branchBore: null,
      boreUnit: 'MM',
      sizeRaw: '',
      skey: '',
      ca: {},
      rawAttributes: {},
      normalized: {},
      derived: {},
      anchorIds: [],
      portIds: [],
      segmentIds: [],
      supportId: '',
      confidence: 'EXACT_SOURCE',
      diagnostics: [],
    };
  });
}

function readElementBody(text, name) {
  const match = text.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1] : '';
}

function readElementAttributes(text, name) {
  const match = text.match(new RegExp(`<${name}\\b([^>]*)\\/?>(?:</${name}>)?`, 'i'));
  return match ? parseAttributes(match[1]) : {};
}

function parseAttributes(text) {
  const attrs = {};
  for (const match of String(text || '').matchAll(/([A-Za-z_:][A-Za-z0-9_:.-]*)="([^"]*)"/g)) {
    attrs[match[1]] = unescapeXml(match[2]);
  }
  return attrs;
}
