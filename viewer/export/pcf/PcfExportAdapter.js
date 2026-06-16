import { FidelityClass } from '../../canonical/FidelityClass.js';
import { buildLossContract } from '../../validation/LossContractEvaluator.js';

export class PcfExportAdapter {
  export(project) {
    const contracts = [];
    const lines = [];
    for (const seg of project.segments || []) {
      lines.push(`PIPE`);
      lines.push(`    FROM-NODE ${seg.fromNodeId}`);
      lines.push(`    TO-NODE ${seg.toNodeId}`);
      contracts.push(buildLossContract({
        objectId: seg.id,
        sourceFormat: project.metadata?.format || 'UNKNOWN',
        targetFormat: 'PCF',
        fidelityClass: seg.fidelity || FidelityClass.RECONSTRUCTED,
        rawPreserved: !!Object.keys(seg.rawAttributes || {}).length,
        normalizedPreserved: true,
      }));
    }
    return { text: lines.join('
'), contracts };
  }
}
