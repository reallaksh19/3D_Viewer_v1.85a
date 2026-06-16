import { CanonicalProject } from '../../canonical/CanonicalProject.js';

export function buildPcfCanonicalProject({ sourceRecord, parsed }) {
  const project = new CanonicalProject({
    id: `project-${sourceRecord.id}`,
    name: sourceRecord.name || 'PCF Project',
    metadata: { format: 'PCF', dialect: sourceRecord.dialect },
  });
  project.addSourceFile(sourceRecord);
  project.diagnostics.warn('PCF_BUILDER_STUB', 'PCF canonical builder starter implementation loaded. Add host-repo-specific parser mapping here.', {
    parsedKeys: Object.keys(parsed || {}),
  });
  return project;
}
