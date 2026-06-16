import { loadStickyState, state, setActiveTab } from './state.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { emit, on } from './event-bus.js';
import { initDevDebugWindow } from '../debug/dev-debug-window.js';

const TAB_VISIBILITY_URL = new URL('../config/tab-visibility.json', import.meta.url).href;

const TAB_ID_ALIASES = new Map([
  ['viewer', 'viewer3d'],
  ['viewer3d', 'viewer3d'],
  ['rvm-viewer', 'viewer3d-rvm'],
  ['viewer3d-rvm', 'viewer3d-rvm'],
  ['converter', 'model-converters'],
  ['model-converters', 'model-converters'],
  ['basic-glb-pcf', 'basic-glb-pcf'],
  ['pcfx-converter', 'pcfx-converter'],
  ['model-exchange', 'model-exchange'],
  ['interchange-config', 'interchange-config'],
  ['support-mapping-config', 'support-mapping-config'],
  ['adapter-mapping', 'adapter-mapping'],
  ['rvm-json-pcf', 'rvm-json-pcf'],
  ['universal-xml', 'universal-xml'],
  ['xml-compare', 'xml-compare'],
  ['psnm-utility', 'psnm-utility'],
]);

function pickRenderer(module, exportName, tabId) {
  const renderer = module?.[exportName];
  if (typeof renderer !== 'function') {
    throw new Error(`Tab ${tabId} did not export renderer ${exportName}`);
  }
  return renderer;
}

async function loadPsnmUtilityRenderer() {
  await Promise.allSettled([
    import('../tabs/psnm-utility/psnm-ui-p2-enhancements.js?v=20260609-p2-1'),
    import('../tabs/psnm-utility/psnm-phase4c-hardening.js?v=20260609-phase4c-1'),
    import('../tabs/psnm-utility/psnm-phase4d-persistence.js?v=20260609-phase4d-1'),
  ]);
  return import('../tabs/psnm-utility-tab.js?v=20260613-psnm-anchor-no-blocker-1')
    .then((module) => pickRenderer(module, 'renderPSNM_UtilityTab', 'psnm-utility'));
}

const TABS = [
  { id: 'viewer3d', label: '3D Viewer', load: () => import('../tabs/viewer3d-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3D', 'viewer3d')) },
  { id: 'viewer3d-rvm', label: '3D RVM Viewer', load: () => import('../tabs/viewer3d-rvm-tab.js?v=20260518-statusbar-theme-12').then((module) => pickRenderer(module, 'renderViewer3DRvm', 'viewer3d-rvm')) },
  { id: 'model-converters', label: '3D Model Converters', load: () => import('../tabs/model-converters-tab.js?v=20260612-projection-import-fix').then((module) => pickRenderer(module, 'renderModelConvertersTab', 'model-converters')) },
  { id: 'basic-glb-pcf', label: 'Basic GLB-PCF', load: () => import('../js/pcf2glb/ui/BasicGlbPcfPanel.js').then((module) => pickRenderer(module, 'renderBasicGlbPcfPanel', 'basic-glb-pcf')) },
  { id: 'pcfx-converter', label: 'PCFX Converter', load: () => import('../tabs/pcfx-converter-tab.js').then((module) => pickRenderer(module, 'renderPcfxConverterTab', 'pcfx-converter')) },
  { id: 'model-exchange', label: 'Model Exchange', load: () => import('../tabs/model-exchange-tab.js').then((module) => pickRenderer(module, 'renderModelExchangeTab', 'model-exchange')) },
  { id: 'interchange-config', label: 'Interchange Config', load: () => import('../tabs/interchange-config-tab.js').then((module) => pickRenderer(module, 'renderInterchangeConfigTab', 'interchange-config')) },
  { id: 'support-mapping-config', label: 'Support Mapping', load: () => import('../tabs/support-mapping-config-tab.js').then((module) => pickRenderer(module, 'renderSupportMappingConfigTab', 'support-mapping-config')) },
  { id: 'adapter-mapping', label: 'Adapter Mapping', load: () => import('../tabs/adapter-mapping-tab.js').then((module) => pickRenderer(module, 'renderAdapterMappingTab', 'adapter-mapping')) },
  { id: 'rvm-json-pcf', label: 'RVM JSON→PCF', load: () => import('../tabs/rvm-json-pcf-extract-tab-workflow-wired.js').then((module) => pickRenderer(module, 'mount', 'rvm-json-pcf')) },
  { id: 'universal-xml', label: 'Universal XML', load: () => import('../tabs/universal-xml-converter-tab.js').then((module) => pickRenderer(module, 'renderUniversalXmlConverterTab', 'universal-xml')) },
  { id: 'xml-compare', label: 'XML Compare', load: () => import('../tabs/xml-compare-tab.js').then((module) => pickRenderer(module, 'renderXmlCompareTab', 'xml-compare')) },
  { id: 'psnm-utility', label: 'Utilities', load: loadPsnmUtilityRenderer },
];

const TAB_GROUPS = [
  { label: 'Viewers',    ids: ['viewer3d', 'viewer3d-rvm'] },
  { label: 'Converters', ids: ['model-converters', 'basic-glb-pcf', 'pcfx-converter', 'rvm-json-pcf', 'universal-xml', 'xml-compare'] },
  { label: 'Exchange',   ids: ['model-exchange', 'interchange-config', 'support-mapping-config', 'adapter-mapping'] },
  { label: 'Utilities',  ids: ['psnm-utility'] },
];

const tabRendererCache = new Map();

let activeTabDestroy = null;
let appShell = null;
let visibilityRules = null;
let visibilityRulesPromise = null;
let unsubscribeTabChange = null;
let devDebugDestroy = null;
let appDestroy = null;
let activeRenderToken = 0;

async function loadVisibilityRules() {
  if (!visibilityRulesPromise) {
    visibilityRulesPromise = fetch(TAB_VISIBILITY_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        const rules = json && typeof json === 'object' ? json : {};
        visibilityRules = rules;
        return rules;
      })
      .catch((error) => {
        console.warn('[app] tab visibility config unavailable; showing all tabs', error);
        visibilityRules = {};
        return visibilityRules;
      });
  }
  return visibilityRulesPromise;
}

function normalizeTabId(tabId) {
  return TAB_ID_ALIASES.get(String(tabId || '').trim()) || String(tabId || '').trim();
}

function visibleTabs() {
  const hidden = new Set((visibilityRules?.hiddenTabs || []).map(normalizeTabId));
  return TABS.filter((tab) => !hidden.has(tab.id));
}

function getDefaultTabId() {
  const tabs = visibleTabs();
  return tabs[0]?.id || 'viewer3d';
}

async function loadRenderer(tab) {
  if (!tabRendererCache.has(tab.id)) {
    tabRendererCache.set(tab.id, tab.load());
  }
  return tabRendererCache.get(tab.id);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('app-toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast--${type}`;
  const msg = document.createElement('span');
  msg.className = 'app-toast__msg';
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('app-toast--in'));
  setTimeout(() => {
    toast.classList.remove('app-toast--in');
    toast.classList.add('app-toast--out');
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function renderShell() {
  const tabs = visibleTabs();
  const tabById = new Map(tabs.map((t) => [t.id, t]));
  const groupedIds = new Set(TAB_GROUPS.flatMap((g) => g.ids));

  function renderTabs() {
    const parts = [];
    for (const group of TAB_GROUPS) {
      const groupTabs = group.ids.map((id) => tabById.get(id)).filter(Boolean);
      if (!groupTabs.length) continue;
      if (parts.length) parts.push('<span class="tab-sep" aria-hidden="true"></span>');
      for (const t of groupTabs) {
        parts.push(`<button type="button" class="tab-btn" data-tab-id="${t.id}">${t.label}</button>`);
      }
    }
    const ungrouped = tabs.filter((t) => !groupedIds.has(t.id));
    if (ungrouped.length) {
      if (parts.length) parts.push('<span class="tab-sep" aria-hidden="true"></span>');
      for (const t of ungrouped) {
        parts.push(`<button type="button" class="tab-btn" data-tab-id="${t.id}">${t.label}</button>`);
      }
    }
    return parts.join('');
  }

  return `
    <header id="app-header">
      <div class="app-brand">
        <div class="header-title">PCF / GLB Viewer</div>
        <div class="header-sub">3D review, converters &amp; utilities</div>
      </div>
      <nav id="tab-bar" aria-label="Application tabs">
        ${renderTabs()}
      </nav>
    </header>
    <main id="tab-content" tabindex="-1"></main>
  `;
}

function syncActiveTabButton() {
  document.querySelectorAll('[data-tab-id]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tabId === state.activeTab);
  });
}

function renderAppShell() {
  const mount = document.getElementById('app-layout') || document.body;
  mount.innerHTML = renderShell();
  document.querySelectorAll('[data-tab-id]').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabId));
  });
  syncActiveTabButton();
}

function renderTabError(tab, error) {
  const container = document.getElementById('tab-content');
  if (!container) return;
  container.innerHTML = `<section class="tab-error"><h2>${tab?.label || 'Tab'} failed to load</h2><pre>${String(error?.stack || error?.message || error)}</pre></section>`;
}

function cleanupActiveTab() {
  if (!activeTabDestroy) return;
  try { activeTabDestroy(); } catch (error) { console.warn('[app] active tab cleanup failed', error); }
  activeTabDestroy = null;
}

async function renderActiveTab() {
  const token = ++activeRenderToken;
  const tabs = visibleTabs();
  const activeId = normalizeTabId(state.activeTab) || getDefaultTabId();
  const tab = tabs.find((item) => item.id === activeId) || tabs[0];
  if (!tab) return;
  if (state.activeTab !== tab.id) state.activeTab = tab.id;
  syncActiveTabButton();
  const container = document.getElementById('tab-content');
  if (!container) return;
  cleanupActiveTab();
  container.innerHTML = '<div class="tab-loading">Loading…</div>';
  try {
    const renderer = await loadRenderer(tab);
    if (token !== activeRenderToken) return;
    container.innerHTML = '';
    const destroy = renderer(container, { state, emit, on, RuntimeEvents, showToast });
    activeTabDestroy = typeof destroy === 'function' ? destroy : null;
    try { emit(RuntimeEvents.TAB_RENDERED, { tabId: tab.id }); } catch (e) { console.warn('[app] TAB_RENDERED emit failed', e); }
  } catch (error) {
    if (token !== activeRenderToken) return;
    console.error(`[app] failed to render tab ${tab.id}`, error);
    renderTabError(tab, error);
    try { emit(RuntimeEvents.RENDER_ERROR, { tabId: tab.id, error }); } catch {}
  }
}

async function boot() {
  loadStickyState?.();
  await loadVisibilityRules();
  state.activeTab = normalizeTabId(state.activeTab) || getDefaultTabId();
  renderAppShell();
  await renderActiveTab();
}

export function init() {
  if (appDestroy) appDestroy();
  unsubscribeTabChange = on(RuntimeEvents.TAB_CHANGED, async () => {
    syncActiveTabButton();
    await renderActiveTab();
  });
  devDebugDestroy = initDevDebugWindow?.({ state, emit, on, RuntimeEvents });
  boot();
  appDestroy = () => {
    cleanupActiveTab();
    try { unsubscribeTabChange?.(); } catch {}
    try { devDebugDestroy?.(); } catch {}
    unsubscribeTabChange = null;
    devDebugDestroy = null;
    appDestroy = null;
  };
  return appDestroy;
}
