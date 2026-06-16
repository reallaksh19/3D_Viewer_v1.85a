export class PcfxExportAdapter {
  export(project) {
    return {
      json: JSON.stringify(project, null, 2),
      contracts: [],
    };
  }
}
