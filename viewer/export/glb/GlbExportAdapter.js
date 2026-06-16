export class GlbExportAdapter {
  export(project) {
    return {
      jsonLikeScene: {
        projectId: project.id,
        assemblies: project.assemblies.length,
        segments: (project.segments || []).length,
        supports: (project.supports || []).length,
        annotations: (project.annotations || []).length,
      },
      contracts: [],
    };
  }
}
