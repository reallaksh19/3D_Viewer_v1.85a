import './psnm-utility/psnm-context-actions.js?v=20260613-context-actions-no-blocker-1';
import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-coordinate-audit-ui.js?v=20260615-coordinate-audit-phase-d-1';
import { installPsnmAxisAutoAnchorAddon } from './psnm-utility/psnm-axis-auto-anchor-addon.js?v=20260612-axis-auto-anchor-addon-1';
import { installPsnmAnchorPersistenceAddon } from './psnm-utility/psnm-anchor-persistence-addon.js?v=20260613-anchor-persistence-1';
import { installPsMappingUtilityTile } from './ps-mapping-utility-tab-support-prefix-ui.js?v=20260614-support-prefix-ui-no-duplicate-playground-1';
import { installPsMappingModalBridge } from './ps-mapping-utility/ps-mapping-modal-bridge.js?v=20260611-modal-bridge-1';
import './ps-mapping-utility/ps-mapping-mandatory-audit-shim.js?v=20260610-psmap-audit-tag-1';

function mountPsMappingLauncher(container, ctx) {
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-psmap-action="open"]')) return null;
  return installPsMappingUtilityTile(utilitiesRoot, ctx);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  const destroyPSNM = renderPSNMCoreUtilityTab(container, ctx);
  const destroyAxisAutoAnchor = installPsnmAxisAutoAnchorAddon(container, ctx);
  const destroyAnchorPersistence = installPsnmAnchorPersistenceAddon(container, ctx);
  const destroyPsMapping = mountPsMappingLauncher(container, ctx);
  const destroyBridge = installPsMappingModalBridge(container, ctx);
  return () => {
    if (typeof destroyBridge === 'function') destroyBridge();
    if (typeof destroyPsMapping === 'function') destroyPsMapping();
    if (typeof destroyAnchorPersistence === 'function') destroyAnchorPersistence();
    if (typeof destroyAxisAutoAnchor === 'function') destroyAxisAutoAnchor();
    if (typeof destroyPSNM === 'function') destroyPSNM();
  };
}

export default renderPSNM_UtilityTab;
