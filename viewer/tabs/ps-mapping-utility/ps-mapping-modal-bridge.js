const BRIDGE_FLAG = '__psMappingModalBridgeInstalled';

function findUtilitiesRoot() {
  return document.querySelector('.psnm-root') || document.querySelector('[data-tab-panel="utilities"]') || null;
}

function movePsMappingModalIntoUtilitiesRoot() {
  const modal = document.querySelector('[data-psmap-modal]');
  const utilitiesRoot = findUtilitiesRoot();
  if (!modal || !utilitiesRoot || utilitiesRoot.contains(modal)) return;
  utilitiesRoot.appendChild(modal);
}

export function installPsMappingModalBridge() {
  if (window[BRIDGE_FLAG]) return window[BRIDGE_FLAG];

  const observer = new MutationObserver(() => movePsMappingModalIntoUtilitiesRoot());
  observer.observe(document.body, { childList: true });

  const onPointerDown = () => movePsMappingModalIntoUtilitiesRoot();
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onPointerDown, true);

  const destroy = () => {
    observer.disconnect();
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onPointerDown, true);
    if (window[BRIDGE_FLAG] === destroy) delete window[BRIDGE_FLAG];
  };

  window[BRIDGE_FLAG] = destroy;
  return destroy;
}
