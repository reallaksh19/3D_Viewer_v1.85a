import { DEFAULT_GRAVITY_M_S2, round } from './geometryMath.js';

export function supportReactions(graph, totalWeightN, options = {}) {
  const supports = graph.supports || [];
  if (supports.length === 0) return [];
  const gravityM_S2 = Number(options.gravityM_S2 ?? DEFAULT_GRAVITY_M_S2);
  const reactionN = totalWeightN / supports.length;
  return supports.map((support) => ({
    id: support.id,
    componentId: support.componentId,
    supportAnchorId: support.supportAnchorId,
    reaction_N: round(reactionN),
    reaction_kgf: round(reactionN / gravityM_S2),
    basis: 'EQUAL_DISTRIBUTION_SCREENING',
  }));
}

export function reactionSumN(reactions) {
  return round(reactions.reduce((sum, support) => sum + Number(support.reaction_N || 0), 0));
}
