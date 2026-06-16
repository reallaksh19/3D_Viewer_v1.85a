export const PSNM_PHASE_MANIFEST = Object.freeze([
  {
    id: '4A',
    name: 'Master PS No',
    files: [
      'psnm-master-types.js',
      'psnm-master-resolver.js',
      'psnm-master-adapter.js',
    ],
    contract: 'Table 1 + Table 4A resolve into editable Master PS No. Downstream PS matching uses Master PS rows only.',
  },
  {
    id: '4B',
    name: 'Master Node',
    files: [
      'psnm-master-node-resolver.js',
      'psnm-master-adapter.js',
      'psnm-utility-tab-v6.js',
    ],
    contract: 'Table 2 + Table 3 + Table 4B resolve into editable Master Node. Downstream Node matching uses Master Node rows only.',
  },
  {
    id: '4C',
    name: 'Workflow Hardening',
    files: [
      'psnm-phase4c-hardening.js',
      'psnm-master-smoke-test.js',
    ],
    contract: 'Run gates, Apply Master Edits, Download CSV, and smoke-test checks protect the master workflow.',
  },
  {
    id: '4D',
    name: 'Source / Setup Persistence',
    files: [
      'psnm-phase4d-persistence.js',
    ],
    contract: 'Source and setup values can be saved, restored, and cleared using a local snapshot.',
  },
  {
    id: '4E',
    name: 'Acceptance Suite',
    files: [
      'psnm-master-acceptance-suite.js',
      'psnm-phase4e-acceptance-ui.js',
    ],
    contract: 'Acceptance suite validates master PS, master node, bore priority, anchor source, matcher input, and coverage source.',
  },
  {
    id: '4F',
    name: 'Phase Manifest / Self Audit',
    files: [
      'psnm-phase-manifest.js',
      'psnm-phase-manifest-ui.js',
    ],
    contract: 'User can inspect the implemented PSNM phases and their contracts directly in the popup.',
  },
  {
    id: '4G',
    name: 'Phase Suite Loader',
    files: [
      'psnm-phase-suite.js',
      'psnm-utility-tab.js',
    ],
    contract: 'Popup extension modules are loaded through one consolidated suite entry point before native v7 consolidation.',
  },
  {
    id: '4H',
    name: 'Cache Health',
    files: [
      'psnm-cache-health-ui.js',
      'psnm-phase-suite.js',
    ],
    contract: 'Popup can report the loaded phase-suite version and whether acceptance/manifest globals are available at runtime.',
  },
]);

export function PSNM_getPhaseManifest() {
  return PSNM_PHASE_MANIFEST.map((phase) => ({ ...phase, files: [...phase.files] }));
}

if (typeof window !== 'undefined') {
  window.PSNM_getPhaseManifest = PSNM_getPhaseManifest;
}
