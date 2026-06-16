import { createPipeDataDb } from '../db/createPipeDataDb.js';
import { enrichPipe } from './enrichPipe.js';
import { enrichFlange } from './enrichFlange.js';
import { enrichValve } from './enrichValve.js';
import { enrichFitting } from './enrichFitting.js';
import { enrichSupport } from './enrichSupport.js';
import { addComponentDiagnostic, cloneGraph } from './enrichmentHelpers.js';

export function enrichWithPipeData(graph, pipeDataDb = createPipeDataDb()) {
  const next = cloneGraph(graph);
  for (const component of next.components) {
    enrichComponent(next, component, pipeDataDb);
  }
  return next;
}

function enrichComponent(graph, component, db) {
  if (component.type === 'PIPE') return enrichPipe(graph, component, db);
  if (component.type === 'FLANGE') return enrichFlange(graph, component, db);
  if (component.type === 'VALVE') return enrichValve(graph, component, db);
  if (component.type === 'ELBOW' || component.type === 'TEE' || component.type === 'REDUCER') {
    return enrichFitting(graph, component, db);
  }
  if (component.type === 'SUPPORT') return enrichSupport(graph, component, db);
  addComponentDiagnostic(component, {
    code: 'PIPE_DATA_UNSUPPORTED_COMPONENT',
    message: `No PipeData enricher for ${component.type}.`,
  });
  return undefined;
}
