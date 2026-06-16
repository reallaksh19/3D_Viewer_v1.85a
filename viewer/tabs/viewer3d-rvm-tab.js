import * as THREE from 'three';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { state, saveStickyState, setActiveTab, updateRvmPcfExtractState } from '../core/state.js';
import { buildRvmJsonPcfRequestPayload } from './rvm-json-pcf-trigger-helpers.js';
import { on, off, emit } from '../core/event-bus.js';
import { detectRvmCapabilities } from '../rvm/RvmCapabilities.js';
import { notify } from '../diagnostics/notification-center.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { parseRmssAttributes } from '../converters/rmss-attribute-parser.js';
import { resolveKindFromAttrs as _resolveKindFromAttrs } from '../rvm-viewer/RvmSupportMapper.js?v=20260518-support-mapper-11';
import { parseStpSupportMembers } from '../parser/stp-support-parser.js';
import { RvmSearchIndex } from '../rvm/RvmSearchIndex.js';
import { RvmTagXmlStore } from '../rvm/RvmTagXmlStore.js';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
  normalizeRvmSupportSymbolScale,
  saveRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260518-support-mapper-11';

function _enrichJsonWithMapperKinds(nodes) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node) continue;
    const typeStr = String(node.type || node.attributes?.TYPE || '').toUpperCase();
    if (typeStr === 'SUPPORT' || typeStr === 'ATTA' || typeStr === 'ANCI') {
      const attrs = node.attributes || (node.attributes = {});
      const kind = _resolveKindFromAttrs(attrs);
      if (kind) {
        attrs.SUPPORT_TYPE = kind;
        attrs.SUPPORT_KIND = kind;
        attrs.SUPPORT_MAPPER_KIND = kind;
      }
    }
    if (Array.isArray(node.children)) _enrichJsonWithMapperKinds(node.children);
    if (Array.isArray(node.items)) _enrichJsonWithMapperKinds(node.items);
    if (Array.isArray(node.branches)) _enrichJsonWithMapperKinds(node.branches);
  }
}

let _viewer = null;
let _shortcutHandler = null;
let _resizeObserver = null;
let _capabilitiesListenerOff = null;
let _toolChangedHandler = null;
let _tagEventsOff = null;
let _supportMapperRulesHandler = null;
let _fallbackTagXmlStore = null;

// â”€â”€ Toolbar action labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ACTION_LABELS = {
  NAV_ORBIT: 'Orbit',
  NAV_PAN: 'Pan',
  NAV_SELECT: 'Select',
  MARQUEE_SELECT: 'Box Sel',
  MEASURE_TOOL: 'Measure',
  VIEW_MARQUEE_ZOOM: 'Zoom',
  NAV_PLAN_X: 'Top',
  NAV_ROTATE_Y: 'Front',
  NAV_ROTATE_Z: 'Right',
  VIEW_FIT_ALL: 'Fit All',
  VIEW_FIT_SELECTION: 'Fit Sel',
  VIEW_TOGGLE_PROJECTION: 'Ortho',
  SNAP_ISO_NW: 'Iso NW',
  SNAP_ISO_NE: 'Iso NE',
  SNAP_ISO_SW: 'Iso SW',
  SNAP_ISO_SE: 'Iso SE',
  SECTION_BOX: 'Sec Box',
  SECTION_PLANE_UP: 'Sec Up',
  SECTION_DISABLE: 'Sec Off',
};

const ICON_ONLY_ACTIONS = new Set([
  'NAV_PLAN_X',
  'NAV_ROTATE_Y',
  'NAV_ROTATE_Z',
  'SNAP_ISO_NW',
  'SNAP_ISO_NE',
  'SNAP_ISO_SW',
  'SNAP_ISO_SE',
]);

const PERSISTENT_BLUE_ACTIONS = new Set([
  'NAV_ORBIT',
  'NAV_PAN',
  'NAV_SELECT',
  'MARQUEE_SELECT',
  'MEASURE_TOOL',
  'VIEW_MARQUEE_ZOOM',
  'NAV_PLAN_X',
  'NAV_ROTATE_Y',
  'NAV_ROTATE_Z',
  'SNAP_ISO_NW',
  'SNAP_ISO_NE',
  'SNAP_ISO_SW',
  'SNAP_ISO_SE',
  'VIEW_TOGGLE_PROJECTION',
  'SECTION_BOX',
  'SECTION_PLANE_UP',
  'SECTION_DISABLE',
]);

const THEME_OPTIONS = [
  { value: 'NavisDark', label: 'Dark (Navy)' },
  { value: 'HighContrast', label: 'High Contrast' },
  { value: 'DrawLight', label: 'Light' },
  { value: 'SteelNeutral', label: 'Steel Neutral' },
];

const RVM_TOOL_GROUPS = Object.freeze([
  {
    className: 'rvm-ribbon-nav',
    label: 'Navigate',
    actions: ['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT'],
  },
  {
    className: 'rvm-ribbon-view',
    label: 'View',
    actions: ['VIEW_FIT_ALL', 'VIEW_FIT_SELECTION', 'VIEW_TOGGLE_PROJECTION', 'VIEW_MARQUEE_ZOOM'],
  },
  {
    className: 'rvm-ribbon-sectioning',
    label: 'Section',
    actions: ['SECTION_BOX', 'SECTION_PLANE_UP', 'SECTION_DISABLE'],
  },
  {
    className: 'rvm-ribbon-orient',
    label: 'Orient',
    actions: ['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE'],
  },
]);

function _actionTooltip(id) {
  return ACTION_LABELS[id] || id;
}

function _getRvmThemePreset() {
  const themePreset = state.viewerSettings?.themePreset || state.viewer3DConfig?.scene?.themePreset || 'NavisDark';
  return THEME_OPTIONS.some((option) => option.value === themePreset) ? themePreset : 'NavisDark';
}

function _getRvmThemeClass() {
  return `geo-theme-${String(_getRvmThemePreset()).toLowerCase()}`;
}

function _applyRvmTheme(container, themePreset) {
  if (!container) return;
  const nextTheme = THEME_OPTIONS.some((option) => option.value === themePreset) ? themePreset : 'NavisDark';
  const nextClass = `geo-theme-${String(nextTheme).toLowerCase()}`;
  THEME_OPTIONS.forEach((option) => container.classList.remove(`geo-theme-${String(option.value).toLowerCase()}`));
  container.classList.add(nextClass);

  const themeSelect = container.querySelector('#rvm-theme-select');
  if (themeSelect && themeSelect.value !== nextTheme) {
    themeSelect.value = nextTheme;
  }
}

function _renderToolButton(id, icon) {
  const label = ACTION_LABELS[id] || id;
  const iconOnly = ICON_ONLY_ACTIONS.has(id);

  return `
    <button
      class="rvm-tool-btn ${id === 'NAV_ORBIT' ? 'is-active' : ''} ${iconOnly ? 'is-icon-only' : ''}"
      data-action="${id}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
      type="button"
    >
      ${icon}
      ${iconOnly ? '' : `<span>${escapeHtml(label)}</span>`}
    </button>
  `;
}

function _renderToolbarGroup(group) {
  return `
    <div class="rvm-ribbon-section rvm-tool-group ${group.className}" aria-label="${escapeHtml(group.label)} tools">
      <span class="rvm-ribbon-label">${escapeHtml(group.label)}</span>
      <div class="rvm-ribbon-button-row">
        ${group.actions.map((id) => _renderToolButton(id, ACTION_ICONS[id])).join('')}
      </div>
    </div>
  `;
}

const ACTION_ICONS = {
  NAV_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>',
  MARQUEE_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="3 2"/><path d="m14 14 7.07 7.07"/><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" opacity="0.55"/></svg>',
  NAV_ORBIT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  NAV_PAN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>',
  VIEW_FIT_ALL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/></svg>',
  VIEW_FIT_SELECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/><circle cx="12" cy="12" r="3"/></svg>',
  VIEW_TOGGLE_PROJECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="m3 3 18 18"/><path d="m21 3-18 18"/></svg>',
  SECTION_BOX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M4 10h16"/><path d="M10 4v16"/></svg>',
  SECTION_PLANE_UP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16h18"/><path d="M12 4v10"/><path d="m8.5 8.5 3.5-4 3.5 4"/></svg>',
  SECTION_DISABLE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  MEASURE_TOOL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="8" rx="2" ry="2"/><path d="M6 8v4"/><path d="M10 8v4"/><path d="M14 8v4"/><path d="M18 8v4"/></svg>',
  VIEW_MARQUEE_ZOOM: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1" stroke-dasharray="3 2"/><circle cx="17" cy="17" r="3"/><path d="m21 21-2.15-2.15"/></svg>',
  NAV_PLAN_X: `
    <svg class="rvm-svg-view rvm-svg-plan-x" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M5 15.5 12 19l7-3.5-7-3.5-7 3.5Z"/>
      <path d="M12 12V4"/>
      <path d="m8.8 7.2 3.2-3.2 3.2 3.2"/>
      <path d="M5 15.5V9l7-3.5L19 9v6.5"/>
      <path d="M5 9 12 12.5 19 9"/>
      <path d="M12 12.5v6.5"/>
    </svg>
  `,

  NAV_ROTATE_Y: `
    <svg class="rvm-svg-view rvm-svg-rotate-y" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M8 7.5 12 5l4 2.5v5L12 15l-4-2.5v-5Z"/>
      <path d="M12 3v18"/>
      <path d="M5.5 8.2C3.9 9.1 3 10.4 3 12c0 3 4 5.4 9 5.4s9-2.4 9-5.4c0-1.6-.9-2.9-2.5-3.8"/>
      <path d="m17.7 6.1 1.4 2.6-2.9.5"/>
    </svg>
  `,

  NAV_ROTATE_Z: `
    <svg class="rvm-svg-view rvm-svg-rotate-z" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M7 14.5 12 17l5-2.5L12 12l-5 2.5Z"/>
      <path d="M12 12V4"/>
      <path d="m9.3 6.7 2.7-2.7 2.7 2.7"/>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4"/>
      <path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4"/>
      <path d="m16.2 4.5 1.1 3-3.1.2"/>
    </svg>
  `,

  SNAP_ISO_NW: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/>
      <path d="M12 3.5v8"/>
      <path d="M5 8.5 12 12l7-4.5"/>
      <path d="M12 12v8.5"/>
      <path d="M8 6.2 4.5 4.5 6.2 8"/>
      <path d="M4.5 4.5 9 9"/>
      <circle cx="7.2" cy="7.2" r="1.4"/>
    </svg>
  `,

  SNAP_ISO_NE: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/>
      <path d="M12 3.5v8"/>
      <path d="M5 8.5 12 12l7-4.5"/>
      <path d="M12 12v8.5"/>
      <path d="M16 6.2 19.5 4.5 17.8 8"/>
      <path d="M19.5 4.5 15 9"/>
      <circle cx="16.8" cy="7.2" r="1.4"/>
    </svg>
  `,

  SNAP_ISO_SW: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/>
      <path d="M12 3.5v8"/>
      <path d="M5 8.5 12 12l7-4.5"/>
      <path d="M12 12v8.5"/>
      <path d="M8 17.8 4.5 19.5 6.2 16"/>
      <path d="M4.5 19.5 9 15"/>
      <circle cx="7.2" cy="16.8" r="1.4"/>
    </svg>
  `,

  SNAP_ISO_SE: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3.5 19 7.5v8L12 20.5 5 16.5v-8L12 3.5Z"/>
      <path d="M12 3.5v8"/>
      <path d="M5 8.5 12 12l7-4.5"/>
      <path d="M12 12v8.5"/>
      <path d="M16 17.8 19.5 19.5 17.8 16"/>
      <path d="M19.5 19.5 15 15"/>
      <circle cx="16.8" cy="16.8" r="1.4"/>
    </svg>
  `,
};

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><rect x="4" y="16" width="16" height="4" rx="1.5"/></svg>';
const TOOL_ACTION_TO_MODE = Object.freeze({
  NAV_ORBIT: 'orbit',
  NAV_PAN: 'pan',
  NAV_SELECT: 'select',
  MARQUEE_SELECT: 'marquee_select',
  MEASURE_TOOL: 'measure',
  VIEW_MARQUEE_ZOOM: 'zoom',
});

const RVM_MODE_LABELS = Object.freeze({
  orbit: 'Orbit',
  pan: 'Pan',
  select: 'Select',
  marquee_select: 'Box Sel',
  measure: 'Measure',
  zoom: 'Zoom',
});

function _updateRvmModeChip(container, mode) {
  const chip = container?.querySelector?.('#rvm-mode-chip');
  if (!chip) return;

  const normalized = String(mode || 'orbit');
  chip.textContent = RVM_MODE_LABELS[normalized] || normalized;
  chip.className = 'mode-chip';
  if (normalized === 'select' || normalized === 'marquee_select') chip.classList.add('select');
  if (normalized === 'measure') chip.classList.add('measure');
}

function _setActiveToolButton(container, action) {
  const buttons = container.querySelectorAll('.rvm-tool-btn[data-action]');
  buttons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.action === action);
  });
  const mode = TOOL_ACTION_TO_MODE[action];
  if (mode) _updateRvmModeChip(container, mode);
}

function _applyToolbarClickedState(container, action, btn) {
  if (!action || !btn) return;

  if (PERSISTENT_BLUE_ACTIONS.has(action)) {
    _setActiveToolButton(container, action);
    return;
  }

  _pulseButton(btn);
}

function _bindToolbarClickedState(container) {
  container.addEventListener(
    'click',
    (event) => {
      const btn = event.target.closest('.rvm-tool-btn[data-action], .rvm-btn[data-action]');
      if (!btn || !container.contains(btn)) return;

      const action = btn.dataset.action || '';
      _applyToolbarClickedState(container, action, btn);
    },
    true
  );
}

function _pulseButton(btn) {
  btn.classList.add('is-pressed');
  setTimeout(() => btn.classList.remove('is-pressed'), 160);
}

// â”€â”€ Viewer stub (replaced by Agent 3 / RvmViewer3D) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _createViewerStub(container) {
  const viewport = container.querySelector('.rvm-viewport');
  if (viewport) {
    viewport.innerHTML = '<div class="rvm-placeholder">RVM Viewer initializing - load a .bundle.json to begin</div>';
  }
  return { dispose() {} };
}

// â”€â”€ Teardown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _disposeRvmViewer() {
  if (_shortcutHandler) {
    window.removeEventListener('keydown', _shortcutHandler, true);
    _shortcutHandler = null;
  }
  if (_viewer) {
    _viewer.dispose();
    _viewer = null;
  }
  if (_resizeObserver) {
    _resizeObserver.disconnect();
    _resizeObserver = null;
  }
  if (_capabilitiesListenerOff) {
    _capabilitiesListenerOff();
    _capabilitiesListenerOff = null;
  }
  if (_toolChangedHandler) {
    window.removeEventListener('app:tool-changed', _toolChangedHandler);
    _toolChangedHandler = null;
  }
  if (_supportMapperRulesHandler) {
    window.removeEventListener('rvm-support-mapper-rules-changed', _supportMapperRulesHandler);
    _supportMapperRulesHandler = null;
  }
  if (_tagEventsOff) {
    _tagEventsOff();
    _tagEventsOff = null;
  }

  _fallbackTagXmlStore = null;
}

// â”€â”€ Capability banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _renderCapabilityBanner(container, caps) {
  const banner = container.querySelector('#rvm-capability-banner');
  if (!banner) return;
  const mode = caps?.deploymentMode || 'static';
  const modeLabel = mode === 'assisted' ? 'Assisted (conversion enabled)' : 'Static (pre-converted bundles only)';
  banner.textContent = `Mode: ${modeLabel}`;
  banner.dataset.mode = mode;
}

// ── RVM UI status strip / empty states / tag panel actions ───────────────

function _rvmUiEsc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function _asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return Array.from(value);
  if (value instanceof Map) return Array.from(value.values());
  return [];
}

function _countMaybe(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set || value instanceof Map) return value.size;
  if (typeof value.length === 'number') return value.length;
  if (typeof value.size === 'number') return value.size;
  return 0;
}

function _firstFiniteCount(...values) {
  for (const value of values) {
    const n = _countMaybe(value);
    if (n > 0) return n;
  }
  return 0;
}

function _getRvmTagStore() {
  const viewerStore =
    _viewer?.tagStore ||
    _viewer?.tagXmlStore ||
    _viewer?.reviewTagStore ||
    null;

  if (
    viewerStore &&
    typeof viewerStore.importFromXml === 'function' &&
    typeof viewerStore.exportToXml === 'function'
  ) {
    return viewerStore;
  }

  if (!_fallbackTagXmlStore) {
    const identityMap =
      _viewer?.identityMap ||
      _viewer?.index?.identityMap ||
      _viewer?.rvmIndex?.identityMap ||
      null;

    const bundleId =
      _viewer?.bundleId ||
      _viewer?.activeBundleId ||
      state.rvm?.activeBundleId ||
      state.rvm?.bundleId ||
      state.rvm?.currentBundleId ||
      'rvm-active-bundle';

    _fallbackTagXmlStore = new RvmTagXmlStore(identityMap, bundleId);
  }

  return _fallbackTagXmlStore;
}

function _getRvmTags() {
  const store = _getRvmTagStore();

  if (store && typeof store.getAllTags === 'function') {
    return store.getAllTags();
  }

  return Array.isArray(state.rvm?.tags) ? state.rvm.tags : [];
}

function _getRvmUiStats() {
  const tags = _getRvmTags();
  const unresolvedTags = tags.filter(tag => tag?.status === 'unresolved');

  const searchIndex =
    _viewer?.searchIndex ||
    state.rvm?.searchIndex ||
    null;

  const nodeSources = [
    _viewer?.nodes,
    _viewer?.treeNodes,
    _viewer?.rvmIndex?.nodes,
    _viewer?.index?.nodes,
    _viewer?.model?.nodes,
    searchIndex?.items,
    searchIndex?.records,
    searchIndex?.nodes,
    state.rvm?.nodes,
    state.rvm?.treeNodes,
    state.rvm?.index?.nodes,
    state.rvm?.model?.nodes,
    state.rvm?.bundle?.nodes,
    state.rvm?.bundle?.index?.nodes,
  ];

  const visibleSources = [
    _viewer?.visibleObjectIds,
    _viewer?.visibleCanonicalIds,
    _viewer?.visibleIds,
    _viewer?.visibilitySet,
    state.rvm?.visibleObjectIds,
    state.rvm?.visibleCanonicalIds,
  ];

  const selectedSources = [
    _viewer?.selection?.getSelectionRenderIds?.(),
    _viewer?.selectedObjectIds,
    _viewer?.selectedCanonicalIds,
    _viewer?.selectionSet,
    state.rvm?.selectedObjectIds,
    state.rvm?.selectedCanonicalIds,
    state.rvm?.selection,
  ];

  const objectCount = _firstFiniteCount(...nodeSources);
  const visibleCount = _firstFiniteCount(...visibleSources) || objectCount;
  const selectedCount = _firstFiniteCount(...selectedSources);

  return {
    objects: objectCount,
    visible: visibleCount,
    selected: selectedCount,
    tags: tags.length,
    unresolved: unresolvedTags.length,
  };
}

function _ensureRvmStatusStrip(container) {
  if (container.querySelector('#rvm-status-strip')) return;

  const banner = container.querySelector('#rvm-capability-banner');
  if (!banner) return;

  banner.insertAdjacentHTML(
    'afterend',
    `
      <div id="rvm-status-strip" class="rvm-status-strip" aria-live="polite">
        <span class="rvm-status-chip" data-rvm-status-chip="objects">Objects: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="visible">Visible: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="selected">Selected: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="tags">Tags: 0</span>
        <span class="rvm-status-chip" data-rvm-status-chip="unresolved">Unresolved: 0</span>
      </div>
    `
  );
}

function _setRvmStatusChip(container, key, label, value) {
  const chip = container.querySelector(`[data-rvm-status-chip="${key}"]`);
  if (!chip) return;

  const n = Number(value || 0);
  chip.textContent = `${label}: ${n.toLocaleString()}`;
  chip.classList.toggle('is-warn', key === 'unresolved' && n > 0);
  chip.classList.toggle('is-active', n > 0);
}

function _updateRvmStatusStrip(container) {
  if (!container?.isConnected) return;

  _ensureRvmStatusStrip(container);

  const stats = _getRvmUiStats();

  _setRvmStatusChip(container, 'objects', 'Objects', stats.objects);
  _setRvmStatusChip(container, 'visible', 'Visible', stats.visible);
  _setRvmStatusChip(container, 'selected', 'Selected', stats.selected);
  _setRvmStatusChip(container, 'tags', 'Tags', stats.tags);
  _setRvmStatusChip(container, 'unresolved', 'Unresolved', stats.unresolved);
  _updateRvmBottomStatus(container, stats);
}

function _setRvmBottomSelection(container, count) {
  const el = container?.querySelector?.('#rvm-sel-count');
  if (el) el.textContent = String(Number(count || 0));
}

function _setRvmBottomMessage(container, message) {
  const el = container?.querySelector?.('#rvm-sb-msg');
  if (el) el.textContent = String(message || '');
}

function _setRvmBottomPerf(container) {
  const el = container?.querySelector?.('#rvm-fps');
  if (!el) return;
  const triangles = Number(_viewer?.renderer?.info?.render?.triangles);
  if (!Number.isFinite(triangles) || triangles <= 0) {
    el.textContent = '-fps';
    return;
  }
  const thousands = triangles / 1000;
  el.textContent = `-fps | ${thousands.toFixed(thousands >= 10 ? 0 : 1)}K tri`;
}

function _setRvmStatusCoords(container, coords) {
  const values = Array.isArray(coords) && coords.length >= 3 ? coords : ['-', '-', '-'];
  ['rsx', 'rsy', 'rsz'].forEach((id, index) => {
    const el = container?.querySelector?.(`#${id}`);
    if (!el) return;
    const value = values[index];
    el.textContent = Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '-';
  });
}

function _parseRvmCoordValue(value) {
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3);
  const text = String(value ?? '');
  if (!text.trim()) return null;
  const matches = text.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!matches || matches.length < 3) return null;
  const coords = matches.slice(0, 3).map(Number);
  return coords.every((coord) => Number.isFinite(coord)) ? coords : null;
}

function _extractRvmCoordsFromAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return null;
  const keys = ['COORDS', 'CO-ORDS', 'POSITION', 'CENTRE', 'CENTER', 'ORIGIN'];
  for (const key of keys) {
    const value = attrs[key] ?? attrs[key.toLowerCase()];
    const coords = _parseRvmCoordValue(value);
    if (coords) return coords;
  }
  return null;
}

function _updateRvmBottomStatus(container, stats = _getRvmUiStats()) {
  _setRvmBottomSelection(container, stats.selected);
  _setRvmBottomMessage(
    container,
    stats.objects > 0
      ? `Objects ${stats.objects.toLocaleString()} | Visible ${stats.visible.toLocaleString()}`
      : 'Load a dataset to begin'
  );
  _setRvmBottomPerf(container);
}

function _insertEmptyStateOnce(host, id, html) {
  if (!host || document.getElementById(id)) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const el = wrapper.firstElementChild;
  if (el) host.prepend(el);
}

function _ensureRvmEmptyStates(container) {
  const treeHost =
    container.querySelector('.rvm-tree') ||
    container.querySelector('#rvm-tree');

  _insertEmptyStateOnce(
    treeHost,
    'rvm-hierarchy-empty',
    `
      <div id="rvm-hierarchy-empty" class="rvm-empty-state" data-rvm-empty-state="hierarchy">
        <div class="rvm-empty-title">No hierarchy loaded</div>
        <div class="rvm-empty-body">Load an RVM / REV / JSON / GLB dataset to view hierarchy.</div>
      </div>
    `
  );

  const attrHost =
    container.querySelector('.rvm-attributes-panel') ||
    container.querySelector('#rvm-attributes-panel');

  _insertEmptyStateOnce(
    attrHost,
    'rvm-attributes-empty',
    `
      <div id="rvm-attributes-empty" class="rvm-empty-state" data-rvm-empty-state="attributes">
        <div class="rvm-empty-title">No object selected</div>
        <div class="rvm-empty-body">Select an object to inspect attributes.</div>
      </div>
    `
  );

  const tagHost =
    container.querySelector('.rvm-tag-list') ||
    container.querySelector('#rvm-tag-list');

  _insertEmptyStateOnce(
    tagHost,
    'rvm-tags-empty',
    `
      <div id="rvm-tags-empty" class="rvm-empty-state" data-rvm-empty-state="tags">
        <div class="rvm-empty-title">No tags yet</div>
        <div class="rvm-empty-body">Create a tag or import Navisworks Tags XML.</div>
      </div>
    `
  );

  const searchHost =
    container.querySelector('#rvm-search-results') ||
    container.querySelector('.rvm-search-results');

  _insertEmptyStateOnce(
    searchHost,
    'rvm-search-empty',
    `
      <div id="rvm-search-empty" class="rvm-empty-state is-compact" data-rvm-empty-state="search">
        <div class="rvm-empty-body">Type to search loaded objects.</div>
      </div>
    `
  );
}

function _hasRealChildren(host, ignoreSelector) {
  if (!host) return false;

  return Array.from(host.children || []).some(child => {
    if (ignoreSelector && child.matches(ignoreSelector)) return false;
    if (child.hidden) return false;
    if (child.style?.display === 'none') return false;
    return true;
  });
}

function _refreshRvmEmptyStates(container) {
  if (!container?.isConnected) return;

  _ensureRvmEmptyStates(container);

  const treeHost =
    container.querySelector('.rvm-tree') ||
    container.querySelector('#rvm-tree');

  const attrHost =
    container.querySelector('.rvm-attributes-panel') ||
    container.querySelector('#rvm-attributes-panel');

  const tagHost =
    container.querySelector('.rvm-tag-list') ||
    container.querySelector('#rvm-tag-list');

  const searchHost =
    container.querySelector('#rvm-search-results') ||
    container.querySelector('.rvm-search-results');

  const hierarchyEmpty = container.querySelector('#rvm-hierarchy-empty');
  const attributesEmpty = container.querySelector('#rvm-attributes-empty');
  const tagsEmpty = container.querySelector('#rvm-tags-empty');
  const searchEmpty = container.querySelector('#rvm-search-empty');

  const hasHierarchy = _hasRealChildren(treeHost, '#rvm-hierarchy-empty');
  const hasAttributes = _hasRealChildren(attrHost, '#rvm-attributes-empty');

  const tags = _getRvmTags();
  const hasTags = tags.length > 0 || _hasRealChildren(tagHost, '#rvm-tags-empty');

  const query = container.querySelector('#rvm-search-input')?.value?.trim() || '';
  const hasSearchResults = _hasRealChildren(searchHost, '#rvm-search-empty');

  if (hierarchyEmpty) hierarchyEmpty.hidden = hasHierarchy;
  if (attributesEmpty) attributesEmpty.hidden = hasAttributes;
  if (tagsEmpty) tagsEmpty.hidden = hasTags;
  if (searchEmpty) searchEmpty.hidden = Boolean(query) || hasSearchResults;
}

function _ensureRvmTagPanelActions(container) {
  if (container.querySelector('[data-rvm-tag-panel-actions]')) return;

  const tagList =
    container.querySelector('.rvm-tag-list') ||
    container.querySelector('#rvm-tag-list');

  if (!tagList) return;

  const header = document.createElement('div');
  header.className = 'rvm-tag-panel-actions';
  header.dataset.rvmTagPanelActions = 'true';
  header.innerHTML = `
    <div class="rvm-tag-panel-title">Tags</div>
    <div class="rvm-tag-panel-buttons">
      <button class="rvm-btn rvm-tag-panel-btn" type="button" data-rvm-tag-action="add" title="Create review tag">
        + Add
      </button>

      <label class="rvm-btn rvm-tag-panel-btn rvm-tag-panel-file" title="Import Navisworks / RVM Tags XML">
        Import XML
        <input
          data-rvm-tag-xml-input
          type="file"
          accept=".xml,application/xml,text/xml"
          style="display:none"
        >
      </label>

      <button class="rvm-btn rvm-tag-panel-btn" type="button" data-rvm-tag-action="export" title="Export Tags XML">
        Export XML
      </button>
    </div>
  `;

  tagList.parentElement?.insertBefore(header, tagList);
}

function _downloadRvmText(filename, content, mime = 'application/xml') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function _openRvmTagCreateUi(container) {
  const existingAddButton = container.querySelector('#rvm-add-tag-btn');

  if (existingAddButton && typeof existingAddButton.click === 'function') {
    existingAddButton.click();
    return;
  }

  try {
    _openTagModal(container);
  } catch {
    notify({
      type: 'info',
      message: 'Select an object before creating a tag.',
    });
  }
}

function _bindRvmTagPanelActions(container) {
  if (container.dataset.rvmTagPanelActionsBound === 'true') return;
  container.dataset.rvmTagPanelActionsBound = 'true';

  container.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-rvm-tag-action]');
    if (!actionBtn || !container.contains(actionBtn)) return;

    const action = actionBtn.dataset.rvmTagAction;

    if (action === 'add') {
      _openRvmTagCreateUi(container);
      return;
    }

    if (action === 'export') {
      const store = _getRvmTagStore();
      const xml = store.exportToXml();

      _downloadRvmText('rvm-review-tags.xml', xml, 'application/xml');

      notify({
        type: 'info',
        message: 'Exported Tags XML as rvm-review-tags.xml.',
      });

      _refreshRvmUiStatus(container);
    }
  });

  container.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-rvm-tag-xml-input]');
    if (!input || !container.contains(input)) return;

    const file = input.files?.[0] || null;
    if (!file) return;

    try {
      const text = await file.text();
      const store = _getRvmTagStore();
      const imported = store.importFromXml(text);

      notify({
        type: 'info',
        message: `Imported ${imported.length} tag(s) from ${file.name}.`,
      });

      _refreshRvmUiStatus(container);
    } catch (err) {
      notify({
        type: 'error',
        message: `Failed to import Tags XML: ${err.message}`,
      });
    } finally {
      input.value = '';
    }
  });
}

function _refreshRvmUiStatus(container) {
  _updateRvmStatusStrip(container);
  _refreshRvmEmptyStates(container);
}

// ── RVM support symbol settings ─────────────────────────────────────────

function _formatSupportScale(value) {
  return normalizeRvmSupportSymbolScale(value).toFixed(2);
}

function _ensureRvmSupportSymbolSettings(container) {
  if (container.querySelector('[data-rvm-support-settings]')) return;

  const rightPanel = container.querySelector('.rvm-right-panel');
  if (!rightPanel) return;

  const settings = getRvmSupportSymbolSettings();
  const scale = _formatSupportScale(settings.scaleMultiplier);

  const card = document.createElement('div');
  card.className = 'rvm-support-settings-card';
  card.dataset.rvmSupportSettings = 'true';

  card.innerHTML = `
    <div class="rvm-support-settings-title">Viewer Settings</div>

    <div class="rvm-support-scale-row">
      <label for="rvm-support-symbol-scale">Support symbol scale</label>

      <div class="rvm-support-scale-controls">
        <input
          id="rvm-support-symbol-scale"
          data-rvm-support-symbol-scale
          type="range"
          min="0.25"
          max="4"
          step="0.05"
          value="${_rvmUiEsc(scale)}"
          title="Scale support symbols"
        >

        <input
          data-rvm-support-symbol-scale-number
          type="number"
          min="0.25"
          max="4"
          step="0.05"
          value="${_rvmUiEsc(scale)}"
          title="Support symbol scale multiplier"
        >

        <button
          class="rvm-btn rvm-support-scale-reset"
          type="button"
          data-rvm-support-symbol-scale-reset
          title="Reset support symbol scale"
        >
          Reset
        </button>
      </div>

      <div class="rvm-support-scale-hint">
        Current multiplier: <b data-rvm-support-symbol-scale-value>${_rvmUiEsc(scale)}×</b>
      </div>
    </div>
  `;

  /*
   * Support type mapping is configured in Model Converters because the rules are
   * applied during ATT/RVM -> XML+JSON+STP conversion. The RVM viewer only reads
   * saved rules for appearance/rendering and must not expose the editor here.
   */
  const firstHeader = rightPanel.querySelector('.rvm-panel-header');
  if (firstHeader) {
    firstHeader.insertAdjacentElement('afterend', card);
  } else {
    rightPanel.prepend(card);
  }
}
function _syncRvmSupportScaleControls(container, scale) {
  const value = _formatSupportScale(scale);

  const range = container.querySelector('[data-rvm-support-symbol-scale]');
  const number = container.querySelector('[data-rvm-support-symbol-scale-number]');
  const display = container.querySelector('[data-rvm-support-symbol-scale-value]');

  if (range) range.value = value;
  if (number) number.value = value;
  if (display) display.textContent = `${value}×`;
}

function _applyRvmSupportScale(
  container,
  rawValue,
  source = 'support-scale-settings',
  options = {}
) {
  const notifyUser = options.notifyUser === true;

  const scaleMultiplier = normalizeRvmSupportSymbolScale(rawValue);
  const settings = saveRvmSupportSymbolSettings({ scaleMultiplier });

  _syncRvmSupportScaleControls(container, settings.scaleMultiplier);

  const result =
    _viewer?.setSupportSymbolOptions?.({
      scaleMultiplier: settings.scaleMultiplier,
    }) ||
    applyRvmSupportSymbolSettings(_viewer, {
      scaleMultiplier: settings.scaleMultiplier,
    });

  try {
    _viewer?.scene?.updateMatrixWorld?.(true);
    if (_viewer?.renderer && _viewer?.camera && _viewer?.scene) {
      _viewer.renderer.render(_viewer.scene, _viewer.camera);
      _viewer._css2dRenderer?.render(_viewer.scene, _viewer.camera);
    }
  } catch (err) {
    console.warn('[RVM] Failed to force support symbol refresh:', err);
  }

  if (notifyUser) {
    notify({
      type: 'info',
      message: `Support symbol scale set to ${settings.scaleMultiplier.toFixed(2)}×.`,
    });
  }

  try {
    emit(RuntimeEvents.RVM_CONFIG_CHANGED, {
      key: 'supportSymbolScale',
      source,
      scaleMultiplier: settings.scaleMultiplier,
      result,
    });
  } catch (err) {
    console.warn('[RVM] Failed to emit support symbol scale change:', err);
  }

  return result;
}

function _previewRvmSupportScaleControls(container, rawValue) {
  const scaleMultiplier = normalizeRvmSupportSymbolScale(rawValue);
  _syncRvmSupportScaleControls(container, scaleMultiplier);
}

function _bindRvmSupportSymbolSettings(container) {
  if (container.dataset.rvmSupportSymbolSettingsBound === 'true') return;
  container.dataset.rvmSupportSymbolSettingsBound = 'true';

  container.addEventListener('input', (event) => {
    const range = event.target.closest('[data-rvm-support-symbol-scale]');
    const number = event.target.closest('[data-rvm-support-symbol-scale-number]');

    if (!range && !number) return;
    if (!container.contains(event.target)) return;

    // Preview only. Do not rebuild symbols continuously while dragging.
    // Continuous rebuild can remove existing symbols if a transient scan finds 0 supports.
    _previewRvmSupportScaleControls(container, event.target.value);
  });

  container.addEventListener('change', (event) => {
    const range = event.target.closest('[data-rvm-support-symbol-scale]');
    const number = event.target.closest('[data-rvm-support-symbol-scale-number]');

    if (!range && !number) return;
    if (!container.contains(event.target)) return;

    // Commit once after slider release / number edit.
    _applyRvmSupportScale(container, event.target.value, 'support-scale-change', {
      notifyUser: true,
    });
  });

  container.addEventListener('click', (event) => {
    const reset = event.target.closest('[data-rvm-support-symbol-scale-reset]');
    if (!reset || !container.contains(reset)) return;

    _applyRvmSupportScale(container, 3.0, 'support-scale-reset', {
      notifyUser: true,
    });
  });
}

function _ensureRvmSupportSettings(container) {
  _ensureRvmSupportSymbolSettings(container);
  _bindRvmSupportSymbolSettings(container);
  _syncRvmSupportScaleControls(container, getRvmSupportSymbolSettings().scaleMultiplier);
}

const _RVM_RIGHT_PANEL_WIDTH_KEY = 'pcf-rvm-right-panel-width';

function _installRightPanelResizer(container) {
  const panel = container.querySelector('.rvm-right-panel');
  const handle = panel?.querySelector('.rvm-right-panel-resize-handle');
  if (!panel || !handle || handle._resizerInstalled) return;
  handle._resizerInstalled = true;

  const saved = parseInt(localStorage.getItem(_RVM_RIGHT_PANEL_WIDTH_KEY), 10);
  if (saved && saved >= 160 && saved <= 600) panel.style.width = `${saved}px`;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panel.offsetWidth;
    handle.classList.add('is-dragging');

    const onMove = (me) => {
      const delta = startX - me.clientX; // dragging left edge → moving left = wider
      const newW = Math.max(160, Math.min(600, startW + delta));
      panel.style.width = `${newW}px`;
    };
    const onUp = () => {
      handle.classList.remove('is-dragging');
      try { localStorage.setItem(_RVM_RIGHT_PANEL_WIDTH_KEY, String(panel.offsetWidth)); } catch {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── RVM axis gizmo (canvas-based, enhanced) ──────────────────────────────────

const _RVM_GIZMO_SIZE = 90;

function _buildRvmAxisGizmo(viewport) {
  if (viewport.querySelector('#rvm-axis-gizmo')) return viewport.querySelector('#rvm-axis-gizmo');
  const dpr = window.devicePixelRatio || 1;
  const S = _RVM_GIZMO_SIZE;
  const c = document.createElement('canvas');
  c.id = 'rvm-axis-gizmo';
  c.width = S * dpr;
  c.height = S * dpr;
  Object.assign(c.style, {
    position: 'absolute',
    top: '12px', right: '12px',   // top-right avoids selection label at bottom
    width: `${S}px`, height: `${S}px`,
    pointerEvents: 'none',
    zIndex: '35',
    borderRadius: '50%',
  });
  viewport.appendChild(c);
  return c;
}

function _drawRvmAxisGizmo(canvas, camera) {
  if (!canvas || !camera) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = cx - 14 * dpr;  // arrow length in canvas pixels
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Background disk
  ctx.beginPath();
  ctx.arc(cx, cy, cx - 1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 18, 32, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,158,255,0.18)';
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  // Extract camera right & up from world matrix columns (correct orientation)
  camera.updateMatrixWorld();
  const me = camera.matrixWorld.elements;
  // Column 0 = right, Column 1 = up, Column 2 = -forward
  const camRight = new THREE.Vector3(me[0], me[1], me[2]).normalize();
  const camUp    = new THREE.Vector3(me[4], me[5], me[6]).normalize();
  const camFwd   = new THREE.Vector3(-me[8], -me[9], -me[10]).normalize(); // view direction

  const AXES = [
    { v: new THREE.Vector3(1, 0, 0), label: 'X', color: '#e05555', dim: '#6b2222' },
    { v: new THREE.Vector3(0, 1, 0), label: 'Y', color: '#44cc66', dim: '#1e5c2c' },
    { v: new THREE.Vector3(0, 0, 1), label: 'Z', color: '#4499ee', dim: '#1a3f6e' },
  ];

  const projected = AXES.map(({ v, label, color, dim }) => {
    const sx =  v.dot(camRight);   // screen X
    const sy = -v.dot(camUp);      // screen Y (canvas Y flipped)
    const depth = v.dot(camFwd);   // +ve = facing camera
    return { sx, sy, depth, label, color, dim };
  });

  // Sort back-to-front so front axes draw over back axes
  projected.sort((a, b) => a.depth - b.depth);

  const _arrow = (x1, y1, x2, y2, color, lineW) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const hw = 4 * dpr, hl = 7 * dpr;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * hl, y2 - uy * hl); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
    ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
    ctx.closePath(); ctx.fill();
  };

  for (const a of projected) {
    const ex = cx + a.sx * R, ey = cy + a.sy * R;
    const isFront = a.depth >= 0;
    const color = isFront ? a.color : a.dim;
    const lw = isFront ? 2.2 * dpr : 1.2 * dpr;
    _arrow(cx, cy, ex, ey, color, lw);

    // Label — offset outward beyond arrow tip
    const labelR = R + 10 * dpr;
    const lx = cx + a.sx * labelR, ly = cy + a.sy * labelR;
    ctx.fillStyle = isFront ? a.color : a.dim;
    ctx.font = `bold ${isFront ? 11 : 9}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(a.label, lx, ly);
  }
}

// ── RVM viewport: hover coords + axis gizmo + multi-select fix ────────────────

function _wireRvmViewportExtras(container) {
  const viewport = container.querySelector('#rvm-viewport');
  if (!viewport) return;

  const gizmoCanvas = _buildRvmAxisGizmo(viewport);

  // Hover coordinates via raycasting
  const rsx = container.querySelector('#rsx');
  const rsy = container.querySelector('#rsy');
  const rsz = container.querySelector('#rsz');
  const clearCoords = () => {
    if (rsx) rsx.textContent = '-';
    if (rsy) rsy.textContent = '-';
    if (rsz) rsz.textContent = '-';
  };

  viewport.addEventListener('mousemove', (e) => {
    const v = _viewer;
    if (!v?.renderer?.domElement || !v?.camera || !v?.raycaster) return;
    const rect = v.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mouse = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
    v.raycaster.setFromCamera(mouse, v.camera);
    const hits = v.raycaster.intersectObjects(v.scene.children, true)
      .filter(h => h.object.isMesh && h.object.visible);
    if (hits.length > 0) {
      const p = hits[0].point;
      if (rsx) rsx.textContent = p.x.toFixed(0);
      if (rsy) rsy.textContent = p.y.toFixed(0);
      if (rsz) rsz.textContent = p.z.toFixed(0);
    } else {
      clearCoords();
    }
    _drawRvmAxisGizmo(gizmoCanvas, v.camera);
  });

  viewport.addEventListener('mouseleave', clearCoords);

  // Multi-select count: refresh strip shortly after mouseup (marquee completes on up)
  viewport.addEventListener('mouseup', () => {
    setTimeout(() => _updateRvmStatusStrip(container), 80);
  });

  // Continuously redraw axis gizmo on animation frame to track camera changes
  let _gizmoRafId = null;
  const _tickGizmo = () => {
    if (!container.isConnected) return;
    const v = _viewer;
    if (v?.camera) _drawRvmAxisGizmo(gizmoCanvas, v.camera);
    _gizmoRafId = requestAnimationFrame(_tickGizmo);
  };
  _tickGizmo();
}

function _ensureRvmUiEnhancements(container) {
  _ensureRvmStatusStrip(container);
  _ensureRvmEmptyStates(container);
  _ensureRvmTagPanelActions(container);
  _bindRvmTagPanelActions(container);
  _refreshRvmUiStatus(container);
  _installRightPanelResizer(container);
}

function _bindRvmUiStatusEvents(container) {
  const refresh = () => {
    if (!container.isConnected) return;
    _refreshRvmUiStatus(container);
  };

  const delayedRefresh = () => {
    setTimeout(refresh, 0);
  };

  const handlers = [
    [RuntimeEvents.RVM_MODEL_LOADED, delayedRefresh],
    [RuntimeEvents.MODEL_LOADED, delayedRefresh],
    [RuntimeEvents.RVM_NODE_SELECTED, delayedRefresh],
    [RuntimeEvents.COMPONENT_PICKED, delayedRefresh],
    [RuntimeEvents.RVM_TAG_CREATED, delayedRefresh],
    [RuntimeEvents.RVM_TAG_DELETED, delayedRefresh],
    [RuntimeEvents.RVM_SEARCH_CHANGED, delayedRefresh],
  ];

  handlers.forEach(([eventName, handler]) => on(eventName, handler));

  return () => {
    handlers.forEach(([eventName, handler]) => off(eventName, handler));
  };
}

// â”€â”€ STP file loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _bindStpLoader(container) {
  const input = container.querySelector('#rvm-stp-file-input');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { members, stats } = parseStpSupportMembers(text);
      if (!_viewer) {
        notify({ type: 'warning', message: 'No 3D viewer active. Load a model first, then append STP.' });
        e.target.value = '';
        return;
      }
      _viewer.clearStpMembers();
      _viewer.appendStpMembers(members);
      _viewer.fitAll?.();
      notify({ type: 'info', message: `STP: appended ${stats.memberCount} support member(s) from ${file.name}.` });
    } catch (err) {
      notify({ type: 'error', message: `STP import failed: ${err?.message || err}` });
    }
    e.target.value = '';
  });
}

// â”€â”€ Bundle file loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _bindBundleLoader(container) {
  const input = container.querySelector('#rvm-universal-file-input');
  if (!input) return;

  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Separate RVM and its sidecars (ATT/TXT) if uploaded together
    const rvmFiles = files.filter(f => f.name.toLowerCase().endsWith('.rvm') || f.name.toLowerCase().endsWith('.rev'));
    const sidecars = files.filter(f => f.name.toLowerCase().endsWith('.att') || f.name.toLowerCase().endsWith('.txt'));
    const otherFiles = files.filter(f => !rvmFiles.includes(f) && !sidecars.includes(f));

    // 1. Process RVM + Sidecars together
    for (const rvmFile of rvmFiles) {
        const importKind = rvmFile.name.toLowerCase().endsWith('.rev') ? 'raw-rev' : 'raw-rvm';
        emit(RuntimeEvents.FILE_LOADED, { 
            name: rvmFile.name, 
            source: 'rvm-tab', 
            payload: rvmFile,
            sidecars: sidecars, // Pass sidecars to RVM bridge
            kind: importKind 
        });
    }

    // 2. Process standalone ATT files (only if no RVMs were uploaded)
    if (rvmFiles.length === 0) {
        for (const sidecar of sidecars) {
            try {
                const text = await sidecar.text();
                const hierarchyJson = parseRmssAttributes(text, state.rvm?.routing);
                _enrichJsonWithMapperKinds(hierarchyJson);
                if (!Array.isArray(hierarchyJson) || hierarchyJson.length === 0) {
                    notify({ type: 'warning', message: 'No branch/fitting topology was parsed from attribute file.' });
                }
                emit(RuntimeEvents.FILE_LOADED, { name: sidecar.name + '.json', source: 'rvm-tab', payload: hierarchyJson, kind: 'aveva-json' });
                notify({ type: 'info', message: `Converted RMSS Attributes to JSON hierarchy` });
            } catch (err) {
                notify({ type: 'error', message: `Failed to parse ${sidecar.name}: ${err.message}` });
            }
        }
    }

    // 3. Process remaining files (JSON, GLB)
    for (const file of otherFiles) {
      const ext = file.name.split('.').pop().toLowerCase();
      try {
        if (ext === 'json') {
          const text = await file.text();
          const json = JSON.parse(text);
          const isBundleManifest = Boolean(json) && typeof json === 'object' && json.schemaVersion === 'rvm-bundle/v1';
          emit(RuntimeEvents.FILE_LOADED, { name: file.name, source: 'rvm-tab', payload: json, kind: isBundleManifest ? 'bundle' : 'aveva-json' });
        } else if (ext === 'glb' || ext === 'gltf') {
          const url = URL.createObjectURL(file);
          const bundleId = `direct-glb-${Date.now()}`;
          const mockManifest = {
              schemaVersion: 'rvm-bundle/v1',
              bundleId,
              artifacts: { glb: url },
              runtime: { units: 'mm', upAxis: 'Y', scale: 1, originOffset: [0,0,0] }
          };
          emit(RuntimeEvents.FILE_LOADED, { name: file.name, source: 'rvm-tab', payload: mockManifest, kind: 'bundle' });
        }
      } catch (err) {
        notify({ type: 'error', message: `Failed to parse ${file.name}: ${err.message}` });
      }
    }
    
    e.target.value = ''; // Reset input
  });
}

// â”€â”€ Search handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€



function _bindAttrSearch(container) {
  const input = container.querySelector('#rvm-attr-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const term = input.value.toLowerCase();
    const rows = container.querySelectorAll('.rvm-attr-row');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

function _bindSearch(container) {
  const input = container.querySelector('#rvm-search-input');
  if (!input) return;
  let _debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(_debounce);
    _debounce = setTimeout(async () => {
      const query = input.value.trim();
      emit(RuntimeEvents.RVM_SEARCH_CHANGED, { query });

      const viewer = _viewer;
      if (!viewer || !viewer.searchIndex) return;
      if (viewer.searchIndex.build && !viewer.searchIndex.indexReady) {
        await viewer.searchIndex.build();
      }
      const results = viewer.searchIndex.search(query);
      const list = container.querySelector('#rvm-search-results');
      if (!list) return;
      list.innerHTML = results.map((r) => {
        const label = escapeHtml(`${r.kind ? `[${r.kind}] ` : ''}${r.name || r.canonicalObjectId}`);
        return `<li class="rvm-search-item" style="cursor:pointer;" data-id="${escapeHtml(r.canonicalObjectId)}">${label}</li>`;
      }).join('');
      const items = list.querySelectorAll('.rvm-search-item');
      items.forEach((li) => {
        li.addEventListener('click', () => {
          const currentViewer = _viewer;
          const id = li.dataset.id;
          if (!currentViewer || !id || typeof currentViewer.selectByCanonicalId !== 'function') return;
          currentViewer.selectByCanonicalId(id);
          currentViewer.fitSelection();
          list.querySelectorAll('.rvm-search-item').forEach((item) => item.classList.remove('is-selected'));
          li.classList.add('is-selected');
        });
      });
    }, 180);
  });
}


// â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


function _closeTransientRvmUi(container) {
  try {
    _closeTagModal(container);
  } catch {
    // Keep ESC safe even if modal code changes.
  }

  const active = document.activeElement;
  if (active && container.contains(active)) {
    const tag = active.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable) {
      active.blur();
    }
  }

  const openEls = container.querySelectorAll(
    '.is-open, .is-menu-open, .rvm-context-menu, .rvm-import-menu, [data-rvm-popover]'
  );

  openEls.forEach((el) => {
    el.classList.remove('is-open');
    el.classList.remove('is-menu-open');

    if (el.tagName?.toLowerCase() === 'details') {
      el.open = false;
    }

    if (el.classList.contains('rvm-context-menu') || el.classList.contains('rvm-import-menu')) {
      el.style.display = 'none';
    }
  });
}

function _resetRvmInteractionToOrbit(container) {
  _viewer?.cancelMarquee?.();
  _viewer?.cancelMeasure?.();
  _viewer?.clearMeasurePreview?.();
  _viewer?.clearSelection?.();
  _viewer?.setNavMode?.('orbit');

  _setActiveToolButton(container, 'NAV_ORBIT');

  try {
    emit(RuntimeEvents.RVM_CONFIG_CHANGED, {
      key: 'activeTool',
      tool: 'orbit',
      source: 'rvm-escape',
    });
  } catch (err) {
    console.warn('[RVM] Failed to emit tool change:', err);
  }
}

function _normalizeRvmPanelControls(container) {
  ['rvm-tree-check-all', 'rvm-tree-uncheck-all', 'rvm-tree-expand-all', 'rvm-tree-collapse-all'].forEach((id) => {
    const button = container.querySelector(`#${id}`);
    if (!button) return;
    button.classList.add('rvm-panel-control-btn');
    button.removeAttribute('style');
  });
}

function _bindRvmHierarchyFilter(container) {
  const input = container.querySelector('#rvm-tree-filter');
  const tree = container.querySelector('#rvm-hierarchy-tree');
  if (!input || !tree) return;
  input.addEventListener('input', () => {
    const term = String(input.value || '').trim().toLowerCase();
    tree.querySelectorAll('li').forEach((row) => {
      row.hidden = Boolean(term) && !row.textContent.toLowerCase().includes(term);
    });
  });
}

function _renderRvmSelectionHud() {
  return `
    <div id="rvm-selection-hud" class="viewer-selection-hud rvm-selection-hud" hidden>
      <div class="viewer-selection-hud-type" data-rvm-selection-type>Selection</div>
      <div class="viewer-selection-hud-name" data-rvm-selection-name>-</div>
      <div class="viewer-selection-hud-meta" data-rvm-selection-meta>-</div>
    </div>
  `;
}

function _updateRvmSelectionHud(container, selection, entry = null) {
  const hud = container?.querySelector?.('#rvm-selection-hud');
  if (!hud) return;
  const canonicalId = selection?.canonicalObjectId || selection?.canonicalId || '';
  hud.hidden = !canonicalId;
  if (!canonicalId) return;
  hud.querySelector('[data-rvm-selection-type]').textContent = String(entry?.kind || 'RVM Object');
  hud.querySelector('[data-rvm-selection-name]').textContent = String(entry?.name || canonicalId);
  hud.querySelector('[data-rvm-selection-meta]').textContent = String(canonicalId);
}

function _renderRvmContextMenu() {
  const items = [
    ['fitSelection', 'Fit Selection'],
    ['isolate', 'Isolate'],
    ['showAll', 'Show All'],
    ['attributes', 'View Attributes'],
    ['tag', 'Add Review Tag'],
    ['copyCoordinates', 'Copy Coordinates'],
  ];
  return `
    <div id="rvm-context-menu" class="viewer-context-menu" role="menu" hidden>
      ${items.map(([action, label]) => `<button class="viewer-context-menu-item" type="button" role="menuitem" data-rvm-context-action="${action}">${escapeHtml(label)}</button>`).join('')}
    </div>
  `;
}

function _copyRvmSelectionCoordinates(selection) {
  const canonicalId = selection?.canonicalObjectId || selection?.canonicalId || '';
  if (!canonicalId) return;
  const entry = _viewer?.searchIndex?._searchableEntries?.find(e => e.canonicalObjectId === canonicalId);
  const attrs = entry?.attrs || {};
  const coord = attrs.COORDS || attrs['CO-ORDS'] || attrs.POSITION || attrs.CENTRE || attrs.CENTER || canonicalId;
  navigator.clipboard?.writeText?.(String(coord)).catch(() => {});
}

function _bindRvmContextMenu(container) {
  const menu = container.querySelector('#rvm-context-menu');
  const host = container.querySelector('.rvm-body') || container;
  if (!menu || !host) return;
  const close = () => {
    menu.hidden = true;
    menu.classList.remove('is-open');
  };
  host.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.rvm-right-panel, .rvm-left-panel')) return;
    event.preventDefault();
    const selection = _viewer?.getSelection?.() || state.rvm?.selection || {};
    const hasSelection = Boolean(selection?.canonicalObjectId || selection?.canonicalId);
    menu.querySelectorAll('[data-rvm-context-action]').forEach((item) => {
      const action = item.dataset.rvmContextAction;
      item.disabled = action !== 'showAll' && !hasSelection;
    });
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.hidden = false;
    menu.classList.add('is-open');
  });
  menu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-rvm-context-action]');
    if (!item || item.disabled) return;
    const action = item.dataset.rvmContextAction;
    const selection = _viewer?.getSelection?.() || state.rvm?.selection || {};
    if (action === 'fitSelection') _viewer?.fitSelection?.();
    if (action === 'isolate') _viewer?.isolateSelection?.();
    if (action === 'showAll') _viewer?.showAll?.();
    if (action === 'attributes') container.querySelector('#rvm-attr-search')?.focus?.();
    if (action === 'tag') _openTagModal(container, selection);
    if (action === 'copyCoordinates') _copyRvmSelectionCoordinates(selection);
    close();
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  window.addEventListener('scroll', close, true);
}

function _bindShortcuts(container) {
  if (_shortcutHandler) {
    window.removeEventListener('keydown', _shortcutHandler, true);
    _shortcutHandler = null;
  }

  _shortcutHandler = (e) => {
    if (!container.isConnected) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();

      _closeTransientRvmUi(container);
      _resetRvmInteractionToOrbit(container);

      return;
    }

    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'f' || e.key === 'F') {
      _viewer?.fitAll?.();
    }
  };

  window.addEventListener('keydown', _shortcutHandler, true);
}


// â”€â”€ HTML scaffold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _bindSupportMapperRuleChanges(container) {
  if (_supportMapperRulesHandler) {
    window.removeEventListener('rvm-support-mapper-rules-changed', _supportMapperRulesHandler);
    _supportMapperRulesHandler = null;
  }

  _supportMapperRulesHandler = () => {
    if (!container.isConnected || !_viewer) return;

    const result =
      _viewer.setSupportSymbolOptions?.({ reason: 'support-mapper-rule-change' }) ||
      _viewer.refreshSupportSymbolsFromSource?.() ||
      _viewer.refreshSupportSymbols?.();

    if (result) _viewer.supportSymbolDiagnostics = result;
  };

  window.addEventListener('rvm-support-mapper-rules-changed', _supportMapperRulesHandler);
}

function _buildHTML(caps) {
  // Always render the Load RVM button. If the local backend is dead, clicking it will trigger the GitHub PAT prompt.
  const isStaticMode = false;
  const themePreset = _getRvmThemePreset();
  const themeClass = _getRvmThemeClass();
  return `
<div class="geo-tab ${themeClass} rvm-tab-root">
  <div class="geo-top-ribbon" id="rvm-top-ribbon">
    <div class="rvm-ribbon-section rvm-ribbon-file" aria-label="RVM import tools">
      <span class="rvm-ribbon-label">Import</span>
      <div class="rvm-ribbon-button-row">
      <label class="rvm-btn rvm-btn-file" title="Load dataset (RVM, REV, JSON Bundle, ATT TXT, GLB)">
        ${UPLOAD_ICON}<span>Import Dataset</span>
        <input type="file" id="rvm-universal-file-input" multiple accept=".json,.rvm,.rev,.txt,.att,.glb,.gltf" style="display:none">
      </label>
      <label class="rvm-btn rvm-btn-file" title="Append STP support members as overlay">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="21 15 21 21 3 21 3 15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Append STP</span>
        <input type="file" id="rvm-stp-file-input" accept=".stp,.STP,.step,.STEP" style="display:none">
      </label>
      <button class="rvm-btn" id="rvm-settings-btn" title="Open Interchange Mapping Settings" style="padding:4px 8px; cursor:pointer;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Settings</span>
      </button>
      </div>
    </div>
    ${RVM_TOOL_GROUPS.map(_renderToolbarGroup).join('')}
    <div class="rvm-ribbon-section rvm-ribbon-search">
      <span class="rvm-ribbon-label">Search</span>
      <input type="search" id="rvm-search-input" placeholder="Search objects..." autocomplete="off">
    </div>
    <div class="rvm-ribbon-section rvm-ribbon-actions" aria-label="RVM output actions">
      <span class="rvm-ribbon-label">Output</span>
      <button class="rvm-btn" data-action="EXTRACT_PCF_JSON" title="Extract PCF from loaded JSON bundle (JSON/RVM → PCF)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span>Json to PCF</span>
      </button>
    </div>
    <div class="rvm-ribbon-section rvm-ribbon-theme">
      <span class="rvm-ribbon-label">Theme</span>
      <label class="rvm-theme-shell" title="Switch the RVM UI theme">
        <select id="rvm-theme-select" class="rvm-theme-select">
          ${THEME_OPTIONS.map((option) => `<option value="${option.value}" ${themePreset === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
        </select>
      </label>
    </div>
  </div>
  <div id="rvm-capability-banner" class="rvm-capability-banner"></div>
  <div class="geo-body rvm-body">
    <div class="geo-left-panel rvm-left-panel">
      <div class="rvm-panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
        <span>Hierarchy</span>
        <span style="display:flex;gap:3px;flex-shrink:0;">
          <button id="rvm-tree-check-all"    title="Check all"     style="font-size:10px;padding:2px 5px;cursor:pointer;background:#2a3547;border:1px solid #3d4a61;color:#b0c8f0;border-radius:3px;">✓ All</button>
          <button id="rvm-tree-uncheck-all"  title="Uncheck all"   style="font-size:10px;padding:2px 5px;cursor:pointer;background:#2a3547;border:1px solid #3d4a61;color:#b0c8f0;border-radius:3px;">✗</button>
          <button id="rvm-tree-expand-all"   title="Expand all"    style="font-size:10px;padding:2px 5px;cursor:pointer;background:#2a3547;border:1px solid #3d4a61;color:#b0c8f0;border-radius:3px;">⊞</button>
          <button id="rvm-tree-collapse-all" title="Collapse all"  style="font-size:10px;padding:2px 5px;cursor:pointer;background:#2a3547;border:1px solid #3d4a61;color:#b0c8f0;border-radius:3px;">⊟</button>
        </span>
      </div>
      <ul id="rvm-hierarchy-tree" class="rvm-tree" role="tree" aria-label="Model hierarchy"></ul>
      <div class="rvm-panel-filter-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="rvm-tree-filter" class="rvm-panel-filter" type="search" placeholder="Filter hierarchy..." autocomplete="off">
      </div>
      <div class="rvm-panel-header">Search Results</div>
      <ul id="rvm-search-results" class="rvm-tree" role="list"></ul>
    </div>
    <div class="rvm-viewport" id="rvm-viewport">
      <canvas class="rvm-canvas" id="rvm-canvas"></canvas>
      <!-- Section Box Adjustment Panel -->
      <div id="rvm-section-panel" style="position:absolute; top:112px; left:16px; width:260px; background:rgba(12,22,38,0.96); color:#e8f3ff; padding:14px 16px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.4); display:none; z-index:15; border:1px solid rgba(74,158,255,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:13px; color:#7ab3ff; display:inline-flex; align-items:center; gap:6px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M10 4v16"/></svg><span>Section Box</span></strong>
          <button id="btn-rvm-section-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;">&times;</button>
        </div>
        <div style="display:grid; gap:10px; font-size:11px;">
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Min X <span id="lbl-rx-min">0</span></label><input type="range" id="rx-min" min="0" max="100" value="0" style="width:100%; accent-color:#4a9eff;"></div>
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Max X <span id="lbl-rx-max">100</span></label><input type="range" id="rx-max" min="0" max="100" value="100" style="width:100%; accent-color:#4a9eff;"></div>
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Min Y <span id="lbl-ry-min">0</span></label><input type="range" id="ry-min" min="0" max="100" value="0" style="width:100%; accent-color:#4a9eff;"></div>
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Max Y <span id="lbl-ry-max">100</span></label><input type="range" id="ry-max" min="0" max="100" value="100" style="width:100%; accent-color:#4a9eff;"></div>
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Min Z <span id="lbl-rz-min">0</span></label><input type="range" id="rz-min" min="0" max="100" value="0" style="width:100%; accent-color:#4a9eff;"></div>
          <div><label style="color:#9db7d8; display:flex; justify-content:space-between;">Max Z <span id="lbl-rz-max">100</span></label><input type="range" id="rz-max" min="0" max="100" value="100" style="width:100%; accent-color:#4a9eff;"></div>
        </div>
        <button id="btn-rvm-section-fit" style="margin-top:12px; width:100%; padding:6px; background:#1a3a5c; border:1px solid #4a9eff; border-radius:6px; color:#7ab3ff; cursor:pointer; font-size:11px;">Reset to Model Bounds</button>
      </div>
    </div>


    ${_renderRvmSelectionHud()}
    ${_renderRvmContextMenu()}

    <div class="geo-right-panel rvm-right-panel">
      <div class="rvm-right-panel-resize-handle" title="Drag to resize panel"></div>
      <div class="rvm-panel-header">Attributes</div>
      <div class="rvm-panel-filter-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="rvm-attr-search" class="rvm-panel-filter" placeholder="Filter attributes...">
      </div>
      <div id="rvm-attributes-content" class="rvm-attributes-panel"></div>

      <div class="rvm-panel-header">Review Tags</div>
      <div class="rvm-tag-filter-row">
        <select id="rvm-tag-severity-filter" class="rvm-tag-severity-filter">
          <option value="all">All Tags</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>
      <div class="rvm-tag-file-row">
        <label class="rvm-btn rvm-tag-file-btn" title="Import Tags from XML">
          Import Tags XML
          <input type="file" id="rvm-import-tags-input" accept=".xml" style="display:none">
        </label>
        <button class="rvm-btn rvm-tag-file-btn" id="rvm-export-tags-btn" disabled title="Export Tags to XML">Export Tags XML</button>
      </div>
      <div id="rvm-tag-list" class="rvm-tag-list"></div>
      <button class="rvm-btn" id="rvm-add-tag-btn" disabled>+ Add Tag</button>
    </div>

  </div>
  <div id="rvm-statusbar" class="rvm-statusbar" role="status" aria-live="polite">
    <div class="sb rvm-status-product">
      <span class="rvm-status-product-label">RVM</span>
      <span class="mode-chip" id="rvm-mode-chip">Orbit</span>
    </div>
    <div class="sb rvm-status-coord-segment" aria-label="Selection coordinates">
      <div class="sc-coords">
        <span class="sc-ax">X</span><span class="sc-v" id="rsx">-</span>
        <span class="sc-ax">Y</span><span class="sc-v" id="rsy">-</span>
        <span class="sc-ax">Z</span><span class="sc-v" id="rsz">-</span>
      </div>
    </div>
    <div class="sb">
      <span class="rvm-status-count" id="rvm-sel-count">0</span>
      <span class="rvm-status-count-label">selected</span>
    </div>
    <div class="sb rvm-sb-msg">
      <span id="rvm-sb-msg">Load a dataset to begin</span>
    </div>
    <div class="sb rvm-sb-perf">
      <span id="rvm-fps">-fps</span>
    </div>
  </div>
  <div id="rvm-tag-modal" class="rvm-tag-modal" aria-hidden="true">
    <div class="rvm-tag-modal-card">
      <div class="rvm-tag-modal-title">Create Review Tag</div>
      <label class="rvm-tag-modal-row">Tag ID
        <input id="rvm-tag-id-input" type="text" placeholder="TAG-..." />
      </label>
      <label class="rvm-tag-modal-row">Title
        <input id="rvm-tag-text-input" type="text" placeholder="Enter tag text" />
      </label>
      <label class="rvm-tag-modal-row">Severity
        <select id="rvm-tag-severity-input">
          <option value="info">Info</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label class="rvm-tag-modal-row">Target
        <input id="rvm-tag-target-input" type="text" readonly />
      </label>
      <div class="rvm-tag-modal-actions">
        <button class="rvm-btn" id="rvm-tag-cancel-btn" type="button">Cancel</button>
        <button class="rvm-btn" id="rvm-tag-create-btn" type="button">Create</button>
      </div>
    </div>
  </div>
</div>`.trim();
}

// â”€â”€ Toolbar action dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _bindToolbarActions(container) {
  const sectionPanel = container.querySelector('#rvm-section-panel');
  let _rvmModelBox = null;
  const showSectionPanel = () => {
    if (!sectionPanel) return;
    sectionPanel.style.display = 'block';
    _rvmModelBox = _viewer?.getModelBounds?.() || _rvmModelBox;
  };

  container.querySelector('#btn-rvm-section-close')?.addEventListener('click', () => { if(sectionPanel) sectionPanel.style.display = 'none'; });
  container.querySelector('#btn-rvm-section-fit')?.addEventListener('click', () => {
    ['rx-min','ry-min','rz-min'].forEach(id => { const el = container.querySelector(`#${id}`); if(el){el.value=0; const lbl=container.querySelector(`#lbl-${id}`); if(lbl)lbl.textContent='0%';} });
    ['rx-max','ry-max','rz-max'].forEach(id => { const el = container.querySelector(`#${id}`); if(el){el.value=100; const lbl=container.querySelector(`#lbl-${id}`); if(lbl)lbl.textContent='100%';} });
    _viewer?.resetSectionToModel?.();
  });

  function applyRvmSliders() {
    if (!_rvmModelBox || !_viewer?.setSectionClipBounds) return;
    const pct = id => Number(container.querySelector(`#${id}`)?.value ?? 0) / 100;
    const { min, max } = _rvmModelBox;
    const rx = max.x - min.x, ry = max.y - min.y, rz = max.z - min.z;
    _viewer.setSectionClipBounds({
      minX: min.x + rx * pct('rx-min'), maxX: min.x + rx * pct('rx-max'),
      minY: min.y + ry * pct('ry-min'), maxY: min.y + ry * pct('ry-max'),
      minZ: min.z + rz * pct('rz-min'), maxZ: min.z + rz * pct('rz-max'),
    });
  }

  ['rx-min','rx-max','ry-min','ry-max','rz-min','rz-max'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('input', e => {
      const lbl = container.querySelector(`#lbl-${id}`);
      if (lbl) lbl.textContent = e.target.value + '%';
      applyRvmSliders();
    });
  });

  const ribbon = container.querySelector('#rvm-top-ribbon');
  if (!ribbon) return;
  ribbon.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    _pulseButton(btn);
    const mode = TOOL_ACTION_TO_MODE[action];
    if (mode) {
      _viewer?.setNavMode?.(mode);
      _setActiveToolButton(container, action);
      return;
    }
    switch (action) {
      case 'NAV_PLAN_X':  _viewer?.snapToPreset?.('TOP'); break;
      case 'NAV_ROTATE_Y': _viewer?.snapToPreset?.('FRONT'); break;
      case 'NAV_ROTATE_Z': _viewer?.snapToPreset?.('RIGHT'); break;
      case 'SNAP_ISO_NW': _viewer?.snapToPreset?.('ISO_NW'); break;
      case 'SNAP_ISO_NE': _viewer?.snapToPreset?.('ISO_NE'); break;
      case 'SNAP_ISO_SW': _viewer?.snapToPreset?.('ISO_SW'); break;
      case 'SNAP_ISO_SE': _viewer?.snapToPreset?.('ISO_SE'); break;
      case 'VIEW_FIT_ALL': _viewer?.fitAll?.(); break;
      case 'VIEW_FIT_SELECTION': _viewer?.fitSelection?.(); break;
      case 'VIEW_TOGGLE_PROJECTION': _viewer?.toggleProjection?.(); break;
      case 'SECTION_BOX': 
        _viewer?.setSectionMode?.('BOX'); 
        showSectionPanel();
        break;
      case 'SECTION_PLANE_UP':
        _viewer?.setSectionMode?.('PLANE_UP');
        showSectionPanel();
        break;
      case 'SECTION_DISABLE':
        _viewer?.disableSection?.();
        if (sectionPanel) sectionPanel.style.display = 'none';
        break;
      case 'EXTRACT_PCF_JSON': {
        const payload = buildRvmJsonPcfRequestPayload({ appState: state });

        updateRvmPcfExtractState({
          scope: payload.scope,
          selectedCanonicalIds: payload.selectedCanonicalIds,
          workflowMode: payload.mode,
          workflowAdapterId: payload.workflowAdapterId,
          sourceKind: payload.sourceKind,
          activeWorkflowPhase: payload.requestedPhase,
          requestedPanel: payload.requestedPanel,
          lastRequestedAt: new Date().toISOString(),
        }, 'rvm-json-pcf-trigger');

        emit(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, payload);
        setActiveTab('rvm-json-pcf-extract');

        window.dispatchEvent(new CustomEvent('app:switch-tab', {
          detail: { tabId: 'rvm-json-pcf-extract' },
        }));

        break;
      }
      default: break;
    }
  });
}

// â”€â”€ ResizeObserver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _bindResize(container) {
  if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
  const viewport = container.querySelector('#rvm-viewport');
  if (!viewport || typeof ResizeObserver === 'undefined') return;
  _resizeObserver = new ResizeObserver(() => {
    _viewer?.onResize?.();
  });
  _resizeObserver.observe(viewport);
}

function _bindToolStateBridge(container) {
  if (_toolChangedHandler) {
    window.removeEventListener('app:tool-changed', _toolChangedHandler);
    _toolChangedHandler = null;
  }
  _toolChangedHandler = (event) => {
    const mode = String(event?.detail?.mode || '').toLowerCase();
    const action = Object.entries(TOOL_ACTION_TO_MODE).find(([, mapped]) => mapped === mode)?.[0];
    if (action) _setActiveToolButton(container, action);
  };
  window.addEventListener('app:tool-changed', _toolChangedHandler);
}

// â”€â”€ Tab event listener (TAB_CHANGED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


function _bindTabListener() {
  const modelLoadedCallback = (payload) => {
    if (_viewer && payload && payload.gltf && payload.gltf.scene) {
        _viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis);
        _viewer.fitAll();
        emit(RuntimeEvents.RENDER_COMPLETE, { source: 'rvm-tab', bundleId: payload.manifest?.bundleId });
        _viewer.setNavMode?.('orbit');
        const root = document.querySelector('.rvm-tab-root');
        if (root) _setActiveToolButton(root, 'NAV_ORBIT');

        if (payload.indexJson && payload.identityMap) {
            _viewer.searchIndex = new RvmSearchIndex(payload.indexJson, payload.identityMap);
            _viewer.searchIndex.build();
            _viewer.tagStore = new RvmTagXmlStore(payload.identityMap, payload.manifest?.bundleId || state.rvm.activeBundle);
            _viewer.tagStore.getAllTags().forEach((tag) => _viewer.addTag(tag));
        }

        // Store index in state so the PCF extract tab can access it without going through the viewer.
        if (payload.indexJson) {
            state.rvm.index = payload.indexJson;
        }

        const container = document.querySelector('.rvm-tab-root');
        if (container && payload.indexJson && payload.indexJson.nodes) {
            const tree = container.querySelector('#rvm-hierarchy-tree');
            if (tree) {
                import('../rvm/RvmTreeModel.js').then(module => {
                    if (!_viewer) return;
                    _viewer.treeModel = new module.RvmTreeModel(payload.indexJson, { viewer: _viewer });
                    _viewer.treeModel.build();
                    _viewer.treeModel.renderTree(tree);

                    // Wire hierarchy toolbar buttons (safe to re-bind; buttons persist in DOM)
                    const checkAll    = container.querySelector('#rvm-tree-check-all');
                    const uncheckAll  = container.querySelector('#rvm-tree-uncheck-all');
                    const expandAll   = container.querySelector('#rvm-tree-expand-all');
                    const collapseAll = container.querySelector('#rvm-tree-collapse-all');
                    if (checkAll)    checkAll.onclick    = () => _viewer.treeModel?.checkAll();
                    if (uncheckAll)  uncheckAll.onclick  = () => _viewer.treeModel?.uncheckAll();
                    if (expandAll)   expandAll.onclick   = () => _viewer.treeModel?.expandAll();
                    if (collapseAll) collapseAll.onclick = () => _viewer.treeModel?.collapseAll();
                });
            }
            const searchList = container.querySelector('#rvm-search-results');
            if (searchList) searchList.innerHTML = '';
        }

        if (container) {
            const exportBtn = container.querySelector('#rvm-export-tags-btn');
            if (exportBtn) exportBtn.disabled = false;
            const addBtn = container.querySelector('#rvm-add-tag-btn');
            if (addBtn) addBtn.disabled = false;

            // Initial render of tags if any were loaded with bundle
            _renderTagList(container);
            _updateRvmStatusStrip(container);
        }
    }
  };

  const configChangedCallback = () => {
      const root = document.querySelector('.rvm-tab-root');
      const nextTheme = _getRvmThemePreset();
      _applyRvmTheme(root, nextTheme);
      _viewer?.setThemePreset?.(nextTheme);
  };

  const nodeSelectedCallback = (payload) => {
      const canonicalId = payload?.canonicalId;
      const canonicalIds = Array.isArray(payload?.canonicalIds) ? [...payload.canonicalIds] : (canonicalId ? [canonicalId] : []);
      const renderObjectIds = Array.isArray(payload?.renderObjectIds) ? [...payload.renderObjectIds] : [];

      state.rvm.selection = {
          canonicalObjectId: canonicalId || null,
          canonicalObjectIds: canonicalIds,
          renderObjectIds,
      };

      updateRvmPcfExtractState({
          scope: canonicalIds.length > 0 ? 'selected' : 'full',
          selectedCanonicalIds: canonicalIds,
          selectedRenderObjectIds: renderObjectIds,
      }, 'viewer-selection');

      const root = document.querySelector('.rvm-tab-root');
      const attrContent = root?.querySelector('#rvm-attributes-content');
      if (!attrContent) return;

      // Highlight the hierarchy tree node(s) — supports multi-select
      if (root) {
          root.querySelectorAll('#rvm-hierarchy-tree li.is-selected').forEach(li => li.classList.remove('is-selected'));
          const idsToHighlight = new Set(canonicalIds.length ? canonicalIds : (canonicalId ? [canonicalId] : []));
          let firstMatch = null;
          root.querySelectorAll('#rvm-hierarchy-tree li[data-id]').forEach(li => {
              if (idsToHighlight.has(li.dataset.id)) {
                  li.classList.add('is-selected');
                  if (!firstMatch) firstMatch = li;
              }
          });
          if (firstMatch) firstMatch.scrollIntoView({ block: 'nearest' });
      }

      if (!canonicalId) {
          attrContent.innerHTML = '<div style="padding: 10px; color: #888;">No selection</div>';
          _updateRvmSelectionHud(root, null);
          _setRvmStatusCoords(root, null);
          _updateRvmStatusStrip(root);
          return;
      }

      // Check if this is an STP sphere by scanning the stpGroup for matching UUID.
      if (_viewer?._stpGroup) {
          let stpObj = null;
          _viewer._stpGroup.traverse(o => { if (o.uuid === canonicalId) stpObj = o; });
          if (stpObj?.userData?.isStp) {
              const ud = stpObj.userData;
              let html = `<div style="padding:8px 10px; font-weight:bold; font-size:12px; border-bottom:1px solid #444; color:#ff8c00; margin-bottom:4px;">${escapeHtml(ud.displayName || ud.supportTag || 'STP Member')}</div>`;
              html += `<div style="padding:2px 10px 4px; font-size:10px; color:#666;">Structural Support Member</div>`;
              if (ud.attrs && Object.keys(ud.attrs).length > 0) {
                  html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
                  for (const [key, val] of Object.entries(ud.attrs)) {
                      html += `<tr class="rvm-attr-row" style="vertical-align:top;"><td style="padding:3px 6px 3px 10px; color:#8ab; white-space:nowrap; border-bottom:1px solid #2a2d35; font-weight:500;">${escapeHtml(key)}</td><td style="padding:3px 10px 3px 4px; color:#ddd; word-break:break-all; border-bottom:1px solid #2a2d35;">${escapeHtml(String(val))}</td></tr>`;
                  }
                  html += '</table>';
              }
              attrContent.innerHTML = html;
              _updateRvmSelectionHud(root, { canonicalObjectId: canonicalId }, { name: ud.displayName || ud.supportTag || 'STP Member', kind: 'STP' });
              _setRvmStatusCoords(root, _extractRvmCoordsFromAttrs(ud.attrs));
              _updateRvmStatusStrip(root);
              return;
          }
      }

      // Look up in the pre-built search index entries (correct property)
      const entry = _viewer?.searchIndex?._searchableEntries?.find(e => e.canonicalObjectId === canonicalId);
      if (!entry) {
          attrContent.innerHTML = `<div style="padding: 10px; font-weight:bold; color:#ccc;">${escapeHtml(canonicalId)}</div><div style="padding: 6px 10px; color: #888;">No attribute data available</div>`;
          _updateRvmSelectionHud(root, { canonicalObjectId: canonicalId });
          _setRvmStatusCoords(root, null);
          _updateRvmStatusStrip(root);
          return;
      }

      let html = `<div style="padding:8px 10px; font-weight:bold; font-size:12px; border-bottom:1px solid #444; color:#7ab3ff; margin-bottom:4px;">${escapeHtml(entry.name || canonicalId)}</div>`;
      html += `<div style="padding:2px 10px 4px; font-size:10px; color:#666;">${escapeHtml(entry.kind || '')}</div>`;

      if (entry.attrs && Object.keys(entry.attrs).length > 0) {
          html += '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
          for (const [key, val] of Object.entries(entry.attrs)) {
              const isCoord = typeof val === 'string' && /^[\{\[]/i.test(val);
              html += `<tr class="rvm-attr-row" style="vertical-align:top;">
                          <td style="padding:3px 6px 3px 10px; color:#8ab; white-space:nowrap; border-bottom:1px solid #2a2d35; font-weight:500;">${escapeHtml(key)}</td>
                          <td style="padding:3px 10px 3px 4px; color:#ddd; word-break:break-all; border-bottom:1px solid #2a2d35; font-size:${isCoord ? '9px' : '11px'};">${escapeHtml(String(val))}</td>
                       </tr>`;
          }
          html += '</table>';
      } else {
          html += '<div style="padding:10px; color:#888;">No attribute data</div>';
      }
      attrContent.innerHTML = html;
      _updateRvmSelectionHud(root, { canonicalObjectId: canonicalId }, entry);
      _setRvmStatusCoords(root, _extractRvmCoordsFromAttrs(entry.attrs));
      _updateRvmStatusStrip(root);

      // Re-apply any active search filter
      const filterInput = root?.querySelector('#rvm-attr-search');
      if (filterInput && filterInput.value.trim()) {
          const q = filterInput.value.trim().toLowerCase();
          attrContent.querySelectorAll('.rvm-attr-row').forEach(row => {
              row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
      }
  };

  on(RuntimeEvents.RVM_MODEL_LOADED, modelLoadedCallback);
  on(RuntimeEvents.RVM_NODE_SELECTED, nodeSelectedCallback);
  on(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, configChangedCallback);

  _capabilitiesListenerOff = () => {
    off(RuntimeEvents.RVM_MODEL_LOADED, modelLoadedCallback);
    off(RuntimeEvents.RVM_NODE_SELECTED, nodeSelectedCallback);
    off(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, configChangedCallback);
  };
}

// â”€â”€ Public render function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function renderViewer3DRvm(container) {
  _disposeRvmViewer();

  // Capability probe runs async; render with static caps first, update banner when resolved
  const caps = { ...state.rvm.capabilities } || null;
  container.innerHTML = _buildHTML(caps);

  _renderCapabilityBanner(container, caps);
  _ensureRvmUiEnhancements(container);
  _ensureRvmSupportSettings(container);

  _bindBundleLoader(container);
  _bindStpLoader(container);
  _bindAttrSearch(container);
  _bindSearch(container);
  _normalizeRvmPanelControls(container);
  _bindRvmHierarchyFilter(container);
  _bindRvmContextMenu(container);
  _bindToolbarClickedState(container);
  _bindToolbarActions(container);
  _bindResize(container);
  _bindToolStateBridge(container);
  _bindShortcuts(container);
  _bindSupportMapperRuleChanges(container);
  _bindTabListener();
  _bindTags(container);

  if (_tagEventsOff) {
    _tagEventsOff();
    _tagEventsOff = null;
  }
  _tagEventsOff = _bindRvmUiStatusEvents(container);

  // Initialize the actual RvmViewer3D instance inside the viewport container
  const viewport = container.querySelector('.rvm-viewport');
  if (viewport) {
      viewport.innerHTML = '';
      _viewer = new RvmViewer3D(viewport, {
        identityMap: state.rvm.identityMap,
        themePreset: _getRvmThemePreset(),
      });
  }

  // Wire extras after viewer init so gizmo canvas survives viewport.innerHTML = ''
  _wireRvmViewportExtras(container);

  _applyRvmTheme(container, _getRvmThemePreset());
  _updateRvmModeChip(container, 'orbit');
  _setRvmStatusCoords(container, null);
  _updateRvmStatusStrip(container);

  const settingsBtn = container.querySelector('#rvm-settings-btn');
  if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('app:switch-tab', { detail: { tabId: 'adapter-mapping' } }));
      });
  }

  const themeSelect = container.querySelector('#rvm-theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (event) => {
      const newTheme = String(event.target.value || 'NavisDark');
      if (!state.viewerSettings) state.viewerSettings = {};
      if (!state.viewer3DConfig) state.viewer3DConfig = {};
      if (!state.viewer3DConfig.scene) state.viewer3DConfig.scene = {};

      state.viewerSettings.themePreset = newTheme;
      state.viewer3DConfig.scene.themePreset = newTheme;
      saveStickyState();

      _applyRvmTheme(container, newTheme);
      _viewer?.setThemePreset?.(newTheme);

      emit(RuntimeEvents.VIEWER3D_CONFIG_CHANGED, {
        source: 'viewer3d-rvm-tab',
        reason: 'theme-changed',
      });
    });
  }

  // Async capability probe â€” update banner once resolved
  import('../converters/rvm-helper-bridge.js').then(({ RvmHelperBridge }) => {
    const bridge = new RvmHelperBridge();
    detectRvmCapabilities(() => bridge.probe()).then((resolvedCaps) => {
      state.rvm.capabilities = resolvedCaps;
      _renderCapabilityBanner(container, resolvedCaps);
    });
  });

  return _disposeRvmViewer;
}



function escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function _renderTagList(container, filter = 'all') {
    const listEl = container.querySelector('#rvm-tag-list');
    if (!listEl || !_viewer || !_viewer.tagStore) return;

    let tags = _viewer.tagStore.getAllTags();
    if (filter !== 'all') {
        tags = tags.filter(t => (t.severity || 'info').toLowerCase() === filter);
    }

    listEl.innerHTML = tags.map(t => {
        let color = '#3d74c5';
        const sev = (t.severity || 'info').toLowerCase();
        if (sev === 'high') color = '#cc2222';
        else if (sev === 'medium') color = '#aa8822';
        else if (sev === 'low') color = '#22aa55';

        return `<div class="rvm-tag-item" data-id="${escapeHtml(t.id)}" style="padding:8px;border-left:4px solid ${color};margin-bottom:4px;background:#2a2a2a;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
              <div style="font-weight:bold;">${escapeHtml(t.text || t.id)}</div>
              <div style="display:flex;gap:4px;">
                <button class="rvm-tag-jump" type="button" data-action="jump" data-id="${escapeHtml(t.id)}" title="Jump to tag">Open</button>
                <button class="rvm-tag-delete" type="button" data-action="delete" data-id="${escapeHtml(t.id)}" title="Delete tag">Del</button>
              </div>
            </div>
            <div style="font-size:10px;color:#888;">ID: ${escapeHtml(t.id)} | Severity: ${escapeHtml(sev.toUpperCase())}</div>
            <div style="font-size:10px;color:#888;">Target: ${escapeHtml(t.canonicalObjectId || '-')}</div>
        </div>`;
    }).join('');

    const items = listEl.querySelectorAll('.rvm-tag-item');
    items.forEach((item) => {
      item.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action]');
        const tagId = btn?.dataset.id || item.dataset.id;
        if (!_viewer || !tagId) return;
        if (btn?.dataset.action === 'delete') {
          _viewer.tagStore.deleteTag(tagId);
          _viewer.removeTag(tagId);
          return;
        }
        _viewer.jumpToTag(tagId);
        const tag = _viewer.tagStore.getTag(tagId);
        if (tag?.canonicalObjectId) {
          _viewer.selectByCanonicalId(tag.canonicalObjectId);
          _viewer.fitSelection();
        }
      });
    });
}

function downloadText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download.txt';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function _openTagModal(container, selection) {
  const modal = container.querySelector('#rvm-tag-modal');
  const idInput = container.querySelector('#rvm-tag-id-input');
  const textInput = container.querySelector('#rvm-tag-text-input');
  const sevInput = container.querySelector('#rvm-tag-severity-input');
  const targetInput = container.querySelector('#rvm-tag-target-input');
  if (!modal || !idInput || !textInput || !sevInput || !targetInput) return;
  idInput.value = `TAG-${Date.now()}`;
  textInput.value = '';
  sevInput.value = 'info';
  targetInput.value = selection?.canonicalObjectId || '';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  textInput.focus();
}

function _closeTagModal(container) {
  const modal = container.querySelector('#rvm-tag-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function _bindTags(container) {
  const filterSelect = container.querySelector('#rvm-tag-severity-filter');
  if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
          _renderTagList(container, e.target.value);
      });
  }

  const onCreated = () => {
    const filter = filterSelect ? filterSelect.value : 'all';
    _renderTagList(container, filter);
  };
  const onDeleted = () => {
    const filter = filterSelect ? filterSelect.value : 'all';
    _renderTagList(container, filter);
  };
  on(RuntimeEvents.RVM_TAG_CREATED, onCreated);
  on(RuntimeEvents.RVM_TAG_DELETED, onDeleted);

  const prevOff = _tagEventsOff;
  _tagEventsOff = () => {
    if (prevOff) prevOff();
    off(RuntimeEvents.RVM_TAG_CREATED, onCreated);
    off(RuntimeEvents.RVM_TAG_DELETED, onDeleted);
  };

  const exportBtn = container.querySelector('#rvm-export-tags-btn');
  const importInput = container.querySelector('#rvm-import-tags-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!_viewer || !_viewer.tagStore) return;
      const xmlString = _viewer.tagStore.exportToXml();
      downloadText(xmlString, 'rvm-review-tags.xml', 'application/xml');
    });
  }

  if (importInput) {
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const xmlText = await file.text();
        if (_viewer && _viewer.tagStore) {
            _viewer.tagStore.importFromXml(xmlText);
            const tags = _viewer.tagStore.getAllTags();
            tags.forEach((tag) => _viewer.addTag(tag));
            _renderTagList(container, filterSelect ? filterSelect.value : 'all');
            notify({ type: 'success', message: 'Tags imported successfully' });
        } else {
            notify({ type: 'warning', message: 'No model loaded to import tags into' });
        }
      } catch (err) {
        notify({ type: 'error', message: `Failed to import tags: ${err.message}` });
      }
      importInput.value = ''; // reset
    });
  }

  const addBtn = container.querySelector('#rvm-add-tag-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!_viewer || !_viewer.tagStore) return;
      const selection = _viewer.getSelection();
      if (!selection.canonicalObjectId) {
         notify({ type: 'warning', message: 'Select an object first to attach a tag.' });
         return;
      }
      _openTagModal(container, selection);
    });
  }

  const cancelBtn = container.querySelector('#rvm-tag-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => _closeTagModal(container));
  }

  const createBtn = container.querySelector('#rvm-tag-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      if (!_viewer || !_viewer.tagStore) return;
      const idInput = container.querySelector('#rvm-tag-id-input');
      const textInput = container.querySelector('#rvm-tag-text-input');
      const sevInput = container.querySelector('#rvm-tag-severity-input');
      const targetInput = container.querySelector('#rvm-tag-target-input');
      const canonicalObjectId = String(targetInput?.value || '').trim();
      const text = String(textInput?.value || '').trim();
      const id = String(idInput?.value || '').trim();
      const severity = String(sevInput?.value || 'info').toLowerCase();
      if (!canonicalObjectId) {
        notify({ type: 'warning', message: 'No target selected for this tag.' });
        return;
      }
      if (!text) {
        notify({ type: 'warning', message: 'Tag text is required.' });
        return;
      }
      const view = _viewer.getSavedView();
      const worldAnchor = _viewer.getSelectionAnchor?.() || view?.camera?.target || null;
      const tag = _viewer.tagStore.createTag({
        id: id || undefined,
        canonicalObjectId,
        text,
        severity,
        cameraState: view.camera,
        worldPosition: worldAnchor
      });
      _viewer.addTag(tag);
      _closeTagModal(container);
      notify({ type: 'success', message: 'Tag created successfully.' });
    });
  }

  const modal = container.querySelector('#rvm-tag-modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) _closeTagModal(container);
    });
  }
}

// Auto-append STP members from the Model Converters tab when viewer is active.
on(RuntimeEvents.MODEL_CONVERTER_STP_READY, ({ members }) => {
  if (!_viewer || !Array.isArray(members) || !members.length) return;
  _viewer.clearStpMembers();
  _viewer.appendStpMembers(members);
  _viewer.fitAll?.();
  notify({ type: 'info', message: `STP: auto-appended ${members.length} support member(s) from converter.` });
});
