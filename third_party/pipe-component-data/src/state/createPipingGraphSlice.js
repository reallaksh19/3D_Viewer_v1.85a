import { createAdapterGraph } from '../graph/createAdapterGraph.js';
import { patchComponent } from '../mutations/patchComponent.js';
import { addGraphDiagnostic } from '../mutations/addGraphDiagnostic.js';
import { selectComponentById } from '../selectors/selectComponentById.js';

export function createPipingGraphSlice(set, get) {
  return {
    pipingGraph: createAdapterGraph(),
    selectedComponentId: null,
    diagnosticsFilter: 'ALL',

    setPipingGraph: (graph) => set({ pipingGraph: graph }),

    resetPipingGraph: (options = {}) => set({
      pipingGraph: createAdapterGraph(options),
      selectedComponentId: null,
    }),

    updateComponent: (id, patch) => set({
      pipingGraph: patchComponent(get().pipingGraph, id, patch),
    }),

    addDiagnostic: (diagnostic) => set({
      pipingGraph: addGraphDiagnostic(get().pipingGraph, diagnostic),
    }),

    selectComponent: (id) => set({ selectedComponentId: id }),

    setDiagnosticsFilter: (filter) => set({
      diagnosticsFilter: filter || 'ALL',
    }),

    getSelectedComponent: () => {
      const state = get();
      return selectComponentById(state.pipingGraph, state.selectedComponentId);
    },

    exportGraph: () => get().pipingGraph,
  };
}
