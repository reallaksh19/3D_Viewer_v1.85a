import { PHASE4_DATASETS } from './datasets/index.js';
import { rowProvenance, validateDatasetProvenance } from './provenance.js';
import { hit, miss, same } from './matchers.js';

function findPipe(rows, q) {
  return rows.find((r) => same(r.nps, q.nps) && same(r.schedule, q.schedule));
}

function findFlange(rows, q) {
  return rows.find((r) => same(r.subtype, q.subtype || 'WN')
    && same(r.nps, q.nps)
    && same(r.classRating, q.classRating)
    && same(r.facing, q.facing || 'RF'));
}

function findValve(rows, q) {
  return rows.find((r) => same(r.valveType, q.valveType)
    && same(r.nps, q.nps)
    && same(r.classRating, q.classRating)
    && same(r.facing, q.facing || 'RF'));
}

function findFitting(rows, q) {
  return rows.find((r) => same(r.subtype, q.subtype)
    && same(r.nps, q.nps)
    && same(r.schedule, q.schedule));
}

function findWeight(rows, q) {
  return rows.find((r) => same(r.componentType, q.componentType)
    && same(r.subtype, q.subtype)
    && same(r.nps, q.nps)
    && same(r.classRating, q.classRating));
}

export function createPipeDataDb(datasets = PHASE4_DATASETS) {
  return {
    datasets,
    validateProvenance: () => validateDatasetProvenance(datasets),
    lookupPipe: (q) => wrap(findPipe(datasets.pipeSchedules, q), 'PIPE_LOOKUP_MISS', q, pipeKey),
    lookupFlange: (q) => wrap(findFlange(datasets.flanges, q), 'FLANGE_LOOKUP_MISS', q, flangeKey),
    lookupValve: (q) => wrap(findValve(datasets.valves, q), 'VALVE_LOOKUP_MISS', q, valveKey),
    lookupFitting: (q) => wrap(findFitting(datasets.fittings, q), 'FITTING_LOOKUP_MISS', q, fittingKey),
    lookupWeight: (q) => wrap(findWeight(datasets.componentWeights, q), 'WEIGHT_LOOKUP_MISS', q, weightKey),
  };
}

function wrap(row, code, query, keyFn) {
  return row ? hit(row, keyFn(row), rowProvenance(row)) : miss(code, query);
}

const pipeKey = (r) => `PIPE|NPS${r.nps}|SCH${r.schedule}`;
const flangeKey = (r) => `FLANGE|${r.subtype}|NPS${r.nps}|CL${r.classRating}|${r.facing}`;
const valveKey = (r) => `VALVE|${r.valveType}|NPS${r.nps}|CL${r.classRating}|${r.facing}`;
const fittingKey = (r) => `FITTING|${r.subtype}|NPS${r.nps}|SCH${r.schedule}`;
const weightKey = (r) => `WEIGHT|${r.componentType}|${r.subtype}|NPS${r.nps}|CL${r.classRating}`;
