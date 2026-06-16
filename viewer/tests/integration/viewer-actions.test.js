import { executeViewerAction, ACTIONS } from '../../viewer-actions.js';

let dispatchedCommands = [];

// Mock viewer conforming to the expected methods inside our updated dispatchViewerCommand
const mockViewer = {
  setNavMode: (mode) => dispatchedCommands.push({ viewerMethod: 'setNavMode', arg: mode }),
  fitAll: () => dispatchedCommands.push({ viewerMethod: 'fitAll' }),
  fitSelection: () => dispatchedCommands.push({ viewerMethod: 'fitSelection' }),
  toggleProjection: () => dispatchedCommands.push({ viewerMethod: 'toggleProjection' }),
  snapToPreset: (preset) => dispatchedCommands.push({ viewerMethod: 'snapToPreset', arg: preset }),
  disableSection: () => dispatchedCommands.push({ viewerMethod: 'disableSection' }),
  setSectionMode: (mode) => dispatchedCommands.push({ viewerMethod: 'setSectionMode', arg: mode }),
  getNavMode: () => 'orbit'
};

function runTests() {
  executeViewerAction(mockViewer, ACTIONS.NAV_ORBIT);
  executeViewerAction(mockViewer, ACTIONS.VIEW_FIT_ALL);
  executeViewerAction(mockViewer, ACTIONS.SNAP_ISO_SE);
  executeViewerAction(mockViewer, ACTIONS.SECTION_BOX);
  executeViewerAction(mockViewer, ACTIONS.VIEW_MARQUEE_ZOOM);
  executeViewerAction(mockViewer, ACTIONS.MEASURE_TOOL);

  if (dispatchedCommands.length !== 6) {
      console.error('Failed viewer actions integration.');
      process.exit(1);
  }

  const expectedCalls = ['setNavMode', 'fitAll', 'snapToPreset', 'setSectionMode', 'setNavMode', 'setNavMode'];
  for (let i = 0; i < expectedCalls.length; i++) {
      if (dispatchedCommands[i].viewerMethod !== expectedCalls[i]) {
          console.error(`Failed: Expected ${expectedCalls[i]} but got ${dispatchedCommands[i].viewerMethod}`);
          process.exit(1);
      }
  }

  console.log('\u2705 A4 Viewer tools correctly routed to valid viewer methods.');
}
runTests();
