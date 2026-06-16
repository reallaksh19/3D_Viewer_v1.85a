import './psnm-anchor-selection.js?v=20260613-anchor-selection-no-blocker-1';
import './psnm-auto-anchor.js?v=20260609-auto-anchor-1';
import './psnm-auto-datum-groups.js?v=20260609-auto-datum-groups-1';
import './psnm-axis-auto-anchor-benchmark.js?v=20260610-axis-benchmark-1';

const STYLE_ID = 'psnm-context-actions-style';

function installContextActionStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-modal .psnm-statusbar [data-psnm-action="resolveMasters"],
.psnm-modal .psnm-statusbar [data-psnm-action="runMatch"]{
  display:none!important;
}

.psnm-modal:has([data-psnm-tab="source"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
  display:inline-flex!important;
}

.psnm-modal:has([data-psnm-tab="master"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
  display:inline-flex!important;
}

.psnm-modal:has([data-psnm-tab="setup"].active) .psnm-statusbar [data-psnm-action="runMatch"]{
  display:inline-flex!important;
}
`;
  document.head.appendChild(style);
}

installContextActionStyle();

export function PSNM_contextActionsInstalled() {
  return true;
}
