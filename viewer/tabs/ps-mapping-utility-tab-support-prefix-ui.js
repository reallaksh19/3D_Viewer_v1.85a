import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-support-number-ui.js?v=20260614-support-number-ui-1';
import { DEFAULT_OPTIONS } from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260614-duplicate-support-key-1';

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function patchSupportPrefixConfig() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel || panel.querySelector('[data-psmap-support-prefix-config]')) return;
  const host = document.createElement('div');
  host.className = 'psmap-card';
  host.setAttribute('data-psmap-support-prefix-config', '1');
  host.innerHTML = `
    <div class="psmap-card-head"><b>Support No. Prefix / Duplicate-Key Diagnostics</b></div>
    <div class="psmap-card-body">
      <div class="psmap-grid-2">
        <div class="psmap-field">
          <label>Support No. prefixes</label>
          <input type="text" data-psmap-setup="supportNoPrefixKeywords" value="${h(DEFAULT_OPTIONS.supportNoPrefixKeywords || 'PS,SL')}" placeholder="PS,SL,SUP">
          <div class="psmap-help-text">Comma-separated prefixes used in diagnostics. Existing support numbers keep their prefix; proposed missing rows use &lt;SupportNo&gt;.X1.</div>
        </div>
        <div class="psmap-field">
          <label>Duplicate key mode</label>
          <input type="text" data-psmap-setup="duplicateSupportKeyMode" value="warn" placeholder="warn">
          <div class="psmap-help-text">Duplicate key = Support No + Line Family + Pipe Size/DN + Node. Duplicates are reported in Reason / Node Coverage Note for manual review.</div>
        </div>
      </div>
    </div>`;
  (panel.querySelector('.psmap-card-body') || panel).appendChild(host);
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const observer = new MutationObserver(patchSupportPrefixConfig);
  observer.observe(document.body, { childList: true, subtree: true });
  patchSupportPrefixConfig();
  return () => {
    observer.disconnect();
    if (typeof destroyBase === 'function') destroyBase();
  };
}
