import { SourceFileRecord } from '../SourceFileRecord.js';
import { buildPcfCanonicalProject } from '../../builders/pcf/pcf-canonical-builder.js';

export class PcfImportAdapter {
  static detect(text) {
    return /PIPE|BEND|VALVE|FLANGE/.test(text || '');
  }

  async import({ id = '', name = 'input.pcf', text = '' } = {}) {
    const sourceRecord = new SourceFileRecord({
      id: id || `pcf-${Date.now()}`,
      name,
      format: 'PCF',
      dialect: 'GENERIC_PCF',
      rawText: text,
    });
    sourceRecord.addMessage('INFO', 'PCF source ingested.');
    const parsed = { rawText: text };
    const project = buildPcfCanonicalProject({ sourceRecord, parsed });
    return { sourceRecord, parsed, project };
  }
}
