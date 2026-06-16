import { ADAPTER_GRAPH_KEYS } from './adapterGraphKeys.js';

const DEFAULT_PROFILE = 'UXML-TOPOLOGY-FULL';
const SCHEMA_VERSION = 'uxml-topology-v1';

export function createAdapterGraph(options = {}) {
  const { now, profile, header, units, adapter, ...overrides } = options || {};
  const graph = makeBaseGraph({ now, profile, header, units, adapter });

  for (const [key, value] of Object.entries(overrides)) {
    if (!ADAPTER_GRAPH_KEYS.includes(key)) {
      throw new Error(`Unknown AdapterGraph top-level key: ${key}`);
    }
    graph[key] = value;
  }

  return graph;
}

function makeBaseGraph({ now, profile, header, units, adapter }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: profile || DEFAULT_PROFILE,
    header: makeHeader(now, header),
    sources: [],
    mappings: [],
    units: makeUnits(units),
    pipelines: [],
    components: [],
    anchors: [],
    ports: [],
    segments: [],
    supports: [],
    topologyHints: [],
    rayEvidence: [],
    lossContract: [],
    diagnostics: [],
    adapter: makeAdapter(adapter),
  };
}

function makeHeader(now, header = {}) {
  return {
    projectId: '',
    modelId: '',
    createdBy: 'piping-adapter',
    createdAt: now || new Date().toISOString(),
    purpose: 'cross-repo-piping-exchange',
    notes: '',
    ...header,
  };
}

function makeUnits(units = {}) {
  return {
    coordinates: 'MM',
    bore: 'MM',
    length: 'MM',
    weight: 'KG',
    pressure: 'kPa',
    temperature: 'C',
    rotation: 'DEGREES',
    ...units,
  };
}

function makeAdapter(adapter = {}) {
  return {
    schema: 'piping-adapter/v1',
    importSessionId: '',
    idNamespace: '',
    datasetVersions: {},
    ...adapter,
  };
}
