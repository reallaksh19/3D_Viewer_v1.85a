import { SourceFileRecord } from '../SourceFileRecord.js';
import { buildGlbCanonicalProject } from '../../builders/glb/glb-metadata-builder.js';

export class GlbImportAdapter {
  static detect(payload) {
    return !!payload?.isGLB || !!payload?.glb || payload instanceof ArrayBuffer;
  }

  async import({ id = '', name = 'input.glb', payload = null } = {}) {
    const sourceRecord = new SourceFileRecord({
      id: id || `glb-${Date.now()}`,
      name,
      format: 'GLB',
      dialect: 'UNKNOWN_GLB',
      rawBinary: payload instanceof ArrayBuffer ? payload : null,
      metadata: payload && typeof payload === 'object' ? payload : {},
    });
    sourceRecord.addMessage('INFO', 'GLB source ingested.');
    const parsed = payload && typeof payload === 'object' ? payload : { meshCount: 0, nodeCount: 0 };
    const project = buildGlbCanonicalProject({ sourceRecord, parsed });
    return { sourceRecord, parsed, project };
  }
}
