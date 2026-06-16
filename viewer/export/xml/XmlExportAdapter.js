export class XmlExportAdapter {
  export(project) {
    return {
      text: `<!-- XML export adapter starter. Add dialect-specific serialization. Project: ${project.id} -->`,
      contracts: [],
    };
  }
}
