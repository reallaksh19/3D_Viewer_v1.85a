import { SourceFileRecord } from '../SourceFileRecord.js';
import { CanonicalProject } from '../../canonical/CanonicalProject.js';

export class NeutralXmlImportAdapter {
  static detect(xmlText) {
    return /^\s*</.test(xmlText || '');
  }

  async import({ id = '', name = 'input.xml', text = '' } = {}) {
    const sourceRecord = new SourceFileRecord({
      id: id || `xml-${Date.now()}`,
      name,
      format: 'XML',
      dialect: 'NEUTRAL_XML',
      rawText: text,
    });
    sourceRecord.addMessage('WARN', 'Neutral XML imported without dialect-specific mapping.');
    const project = new CanonicalProject({ id: `project-${sourceRecord.id}`, name });
    project.addSourceFile(sourceRecord);
    project.diagnostics.warn('NEUTRAL_XML_STUB', 'Neutral XML adapter loaded. Add dialect-specific graph mapping before production use.');
    return { sourceRecord, parsed: {}, project };
  }
}
