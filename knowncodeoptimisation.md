# Known Code Optimisation / Patch Ledger

> Repo: `reallaksh19/3D_Viewer`  
> Branch verified: `main`  
> Created from current repo state on 2026-06-10.  
> Purpose: list patches, shims, and workarounds added during the PSNM / PS Mapping / app-shell recovery work so future maintainers can remove or harden them deliberately.

---

## Current verification snapshot

These files were re-read from current `main` before this ledger was created.

| Area | File | Current blob SHA observed |
|---|---|---|
| App shell / tab boot | `viewer/core/app.js` | `df2ab89193d5204479f69774c3b23780b0d62618` |
| PSNM wrapper + PS Mapping tile install | `viewer/tabs/psnm-utility-tab.js` | `1dafa151f9ac18d4376ec2471c669d77c8f23ba5` |
| PSNM overlay/context loader | `viewer/tabs/psnm-utility/psnm-context-actions.js` | `ae123dfb9be6747aa5642a14a23960d9dd6e6658` |
| PS Mapping UI | `viewer/tabs/ps-mapping-utility-tab.js` | `4fffc49b7f2132504494818cba837dccb3e5bb37` |
| PS Mapping resolver | `viewer/tabs/ps-mapping-utility/ps-mapping-engine.js` | `53d4c5db0d26dff83454c1edaf21a1d9e40ea83d` |
| Shared formatter asset | `viewer/utils/formatter.js` | `e37c1bfed10d03be957e9f3f27e39e7f3bca7883` |

Backup branch created during formatter/app-shell recovery:

```text
backup/formatter-pre-fix-v2 -> 2e87830fcc0a9939eb9b554ab9cf706f1699aefb
```

---

# 1. PSNM route stabilization shim

## Problem

PSNM popup became unstable/no-response after layered phase overlays were loaded together. The safest route was to keep the old stable v6 matcher and add only bounded helper modules.

## Current code diff pattern

```diff
- import './psnm-utility/psnm-phase-suite.js?...';
- import './psnm-utility/psnm-ui-p2-enhancements.js?...';
- import './psnm-utility/psnm-phase4c-hardening.js?...';
- import './psnm-utility/psnm-phase4d-persistence.js?...';
- export { renderPSNM_UtilityTab } from './psnm-utility-tab-v7.js?...';
+ // Stable route: PSNM core v6 only.
+ // Overlay modules are temporarily disabled after popup hang/no-response report.
+ // These lightweight modules use bounded event handlers only; no MutationObserver.
+ import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
+ import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
+ import { renderPSNM_UtilityTab as renderPSNMCoreUtilityTab } from './psnm-utility-tab-v6.js?v=20260609-psnm-v6-stable-1';
+ import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260610-psmap-support-1';
+
+ export function renderPSNM_UtilityTab(container, ctx = {}) {
+   const destroyCore = renderPSNMCoreUtilityTab(container, ctx);
+   installPsMappingUtilityTile(container, ctx);
+   return () => {
+     try { destroyCore?.(); } catch {}
+   };
+ }
```

## Classification

- Type: workaround / route stabilization.
- Keep until v6 core is refactored or overlays are rewritten with deterministic lifecycle cleanup.

---

# 2. PSNM contextual action visibility shim

## Problem

`Resolve Master Tables` and `Run Match` were visible in non-relevant tabs, creating wrong user flow.

## Current code diff pattern

```diff
+ import './psnm-anchor-selection.js?v=20260609-anchor-selection-1';
+ import './psnm-auto-anchor.js?v=20260609-auto-anchor-1';
+ import './psnm-auto-datum-groups.js?v=20260609-auto-datum-groups-1';
+ import './psnm-axis-auto-anchor-benchmark.js?v=20260610-axis-benchmark-1';
+
+ .psnm-modal .psnm-statusbar [data-psnm-action="resolveMasters"],
+ .psnm-modal .psnm-statusbar [data-psnm-action="runMatch"]{
+   display:none!important;
+ }
+
+ .psnm-modal:has([data-psnm-tab="source"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
+   display:inline-flex!important;
+ }
+
+ .psnm-modal:has([data-psnm-tab="master"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
+   display:inline-flex!important;
+ }
+
+ .psnm-modal:has([data-psnm-tab="setup"].active) .psnm-statusbar [data-psnm-action="runMatch"]{
+   display:inline-flex!important;
+ }
```

## Classification

- Type: UI shim.
- Uses CSS `:has()`. Works in modern Chromium. If older browser support is needed, replace with explicit tab-change event handling.

---

# 3. PSNM manual anchor guard

## Problem

v6 core auto-selected default anchors. Requirement changed: user must manually select anchors, except saved local-storage values may be restored.

## Code diff pattern

```diff
+ const STORAGE_KEY = 'psnm.workbench.lastSourceSetup.v1';
+
+ function ensureBlankOption(select, label) {
+   let option = select.querySelector('option[value=""]');
+   if (!option) {
+     option = document.createElement('option');
+     option.value = '';
+     option.textContent = label;
+     select.insertBefore(option, select.firstChild);
+   }
+ }
+
+ function applyPolicy(modal) {
+   ensureBlankOption(anchorPsSelect, 'Select Anchor PS manually');
+   ensureBlankOption(anchorNodeSelect, 'Select Anchor Node manually');
+   restoreSavedManualAnchorsOrBlank();
+ }
+
+ document.addEventListener('click', (event) => {
+   const run = event.target.closest?.('[data-psnm-action="runMatch"]');
+   if (!run) return;
+   if (!anchorPsSelect.value || !anchorNodeSelect.value) {
+     event.preventDefault();
+     event.stopImmediatePropagation();
+     showBanner('Run blocked: select Anchor PS and Anchor Node manually. Defaults are disabled; only a saved local-storage anchor can be restored.');
+   }
+ }, true);
```

## Classification

- Type: safety shim.
- Important caveat: v6 core may still internally compute defaults. This shim blocks user `Run Match` and visual defaults, but a native fix should remove defaulting inside `psnm-utility-tab-v6.js`.

---

# 4. PSNM localStorage anchor preservation patch

## Problem

The persistence module wrote to `psnm.workbench.lastSourceSetup.v1` and deleted the `manualAnchors` object saved by the anchor guard.

## Code diff pattern

```diff
+ function readSnapshot() {
+   try {
+     const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
+     return parsed?.version === 1 ? parsed : { version: 1 };
+   } catch {
+     return { version: 1 };
+   }
+ }
+
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
+   ...previous,
    version: 1,
    savedAt: new Date().toISOString(),
    source: sourceValues(current),
    setup: setupValues(current),
+   manualAnchors: previous.manualAnchors || null,
  }));
```

## Classification

- Type: bug fix / compatibility patch.
- Keep.

---

# 5. PSNM lite persistence + transformed Table-2 preview

## Problem

User wanted the last entered PSNM data restored and a transformed Table-2 preview based on anchors.

## Code diff pattern

```diff
+ import './psnm-utility/psnm-lite-persistence-transform-preview.js?v=20260609-lite-persist-preview-2';
+
+ // In helper module:
+ // - save [data-source] and [data-setup] to localStorage
+ // - skip volatile anchor values from generic setup persistence
+ // - render transformed Table-2 preview into live modal
+ // - use liveModal() because v6 replaces modal DOM via outerHTML
+
+ function liveModal() {
+   return document.querySelector('[data-psnm="modal"]');
+ }
+
+ function renderTransformPreview(modal = null) {
+   const current = modal && modal.isConnected ? modal : liveModal();
+   // preview formula: E=X+datumE, U=Y+datumU, S=Z+datumS
+ }
```

## Classification

- Type: feature shim around v6.
- Caveat: preview is still the legacy same-axis transform and is not the axis-mapped benchmark matcher.

---

# 6. PSNM parser hardening patches

## Problems fixed

- Headerless Table-2 `Node X Y Z` rows were not parsed.
- Missing bore was coerced to zero due to `Number(null) === 0`.
- Unresolved coordinates showed `0.000` instead of blank/dash.
- Benchmark Table-1 used `E/N/U/bore`; master resolver expected older formats.
- Table-2 `dia` needed OD-to-DN fallback when Table-3 was blank.

## Code diff patterns

```diff
+ // Headerless Table-2 fallback
+ function PSNM_parseTable2Fallback(text, logger) {
+   // Parse: Node, X, Y, Z, optional Bore, optional Mandatory
+ }
+
+ let table2Rows = PSNM_parseNodeRows(table2Text, logger);
+ if (!table2Rows.length && String(table2Text || '').trim()) {
+   table2Rows = PSNM_parseTable2Fallback(table2Text, logger);
+ }
```

```diff
- const directBoreMm = Number(row.directBoreMm);
+ function PSNM_optionalNumber(value) {
+   const text = String(value ?? '').trim();
+   if (!text || text === '-') return null;
+   const n = Number(text.replace(/,/g, ''));
+   return Number.isFinite(n) ? n : null;
+ }
```

```diff
- return Number(value).toFixed(3);
+ return value == null || value === '' || !Number.isFinite(Number(value)) ? '-' : Number(value).toFixed(3);
```

```diff
+ // Table-1 benchmark E/N/U support
+ const nOrS = byHeader.s || byHeader.south || byHeader.n || byHeader.north || byHeader.northing;
+ position = `E ${e}mm S ${nOrS}mm U ${u}mm`;
```

```diff
+ // Table-2 dia/od fallback when Table-3 is blank
+ const table2Od = table2OdFallback.get(node) ?? null;
+ const table3Od = odByNode.get(node) ?? table2Od ?? null;
+ const table3DerivedBore = table3Od == null ? null : PSNM_boreFromOdMmLoose(table3Od);
```

## Classification

- Type: parser hardening / data compatibility fixes.
- Keep.

---

# 7. PSNM auto anchor and auto datum groups

## Problem

Approx 1/2/3 did not trigger because the selected anchor placed rows far outside tolerance. User needed a way to search anchors instead of guessing.

## Code diff pattern

```diff
+ import './psnm-auto-anchor.js?v=20260609-auto-anchor-1';
+ import './psnm-auto-datum-groups.js?v=20260609-auto-datum-groups-1';
+
+ // Single-anchor search:
+ // for each PS_i x Node_j:
+ //   datumE = PS.E - Node.X
+ //   datumU = PS.U - Node.Y
+ //   datumS = PS.S - Node.Z
+ //   transform all nodes and score Exact/A1/A2/A3 coverage
+
+ // Multi-datum search:
+ while (remainingPs.length && remainingNodes.length && groupCount < MAX_GROUPS) {
+   const best = findBestAnchor(remainingPs, remainingNodes, options);
+   if (!best || !best.accepted.length) break;
+   groups.push(best);
+   removeMatchedPsAndNodes(best.accepted);
+ }
```

## Classification

- Type: diagnostic / candidate-search feature.
- Caveat: initially same-axis only. Axis-mapped benchmark module was added separately.

---

# 8. PSNM axis-mapped benchmark auto anchor

## Problem

Benchmark data was not a pure same-axis translation. Correct transform was:

```text
E = Z + 20000
N = X + 5000
U = Y + 100000
```

## Code diff pattern

```diff
+ import './psnm-axis-auto-anchor-benchmark.js?v=20260610-axis-benchmark-1';
+
+ // Search axis permutations/signs:
+ const AXIS_PERMUTATIONS = permutations(['x', 'y', 'z']);
+ const SIGNS = [-1, 1];
+
+ function transformNode(node, mapping, offset) {
+   return {
+     e: mapping.signE * node[mapping.axisE] + offset.e,
+     s: mapping.signN * node[mapping.axisN] + offset.s,
+     u: mapping.signU * node[mapping.axisU] + offset.u,
+   };
+ }
```

## Classification

- Type: benchmark-specific feature / validation aid.
- Keep while benchmark remains a required test. Later unify into the main matcher if axis permutations are a real production requirement.

---

# 9. PS Mapping Utility tile added under Utilities

## Problem

A new, independent utility was needed for string/table PS mapping. It is not coordinate matching.

## Current code diff pattern

```diff
+ import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260610-psmap-support-1';
+
  export function renderPSNM_UtilityTab(container, ctx = {}) {
    const destroyCore = renderPSNMCoreUtilityTab(container, ctx);
+   installPsMappingUtilityTile(container, ctx);
    return () => {
      try { destroyCore?.(); } catch {}
    };
  }
```

## Classification

- Type: new utility feature.
- Integration choice: mounted through existing Utilities wrapper to avoid finding/reworking a separate global utility registry.

---

# 10. PS Mapping resolver engine

## Problem

Map `PSNO_Model` to `Node` using Table-1 `PS No -> Node`, optional dia, line number, tags, and duplicate resolution.

## Current code diff pattern

```diff
+ const DEFAULT_OPTIONS = {
+   boreMode: 'prefer',
+   lineMode: 'prefer',
+   supportMode: 'prefer',
+   odToleranceMm: 1.5,
+   allowRawDiaMatch: true,
+   allowDnMatch: true,
+   allowDuplicateAssignment: true,
+ };
+
+ export function normalizePsNo(rawValue) {
+   const raw = String(rawValue ?? '').trim();
+   const [beforeTag, ...tagParts] = raw.split('|');
+   const tag = tagParts.length ? tagParts.join('|').trim() : '';
+   let clean = String(beforeTag ?? '').trim();
+   const isDatum = /\/\s*DATUM\b/i.test(clean);
+   clean = clean.replace(/\/\s*DATUM\b/gi, '').replace(/\.\d+\b/g, '').trim();
+   const basePsMatch = clean.match(/\bPS[-_ ]?\d+\b/i);
+   const basePs = basePsMatch ? basePsMatch[0].toUpperCase().replace(/\s+/g, '').replace('_', '-') : clean.toUpperCase();
+   const exactRawKey = raw.toUpperCase().replace(/\s+/g, '');
+   return { raw, exactRawKey, basePs, isDatum, tag };
+ }
```

```diff
+ export function deriveDnFromOd(od) {
+   // OD 273/273.1 -> DN250, 168.3 -> DN150, 114.3 -> DN100, 88.9 -> DN80, etc.
+   const tolerance = Math.max(1.5, Math.abs(best.od) * 0.006);
+   return bestErr <= tolerance ? best.dn : null;
+ }
```

```diff
+ function compareCandidates(a, b) {
+   return a.psBasisRank - b.psBasisRank
+     || a.boreRank - b.boreRank
+     || a.supportRank - b.supportRank
+     || a.lineRank - b.lineRank
+     || a.warnings.length - b.warnings.length
+     || a.table1Row - b.table1Row
+     || natural(a.node, b.node);
+ }
```

## Classification

- Type: new resolver.
- Key rule: Tag is output metadata from Table-1 only. Tag does not score.

---

# 11. PS Mapping support-match extension

## Problem

Table-2 can have multiple model PS rows matching the same node, differentiated by support type in `DTXR`. Need Table-1C `Node -> ISONOTE` support comparison.

## Current code diff pattern

```diff
+ export function normalizeSupportTypes(value) {
+   const cleaned = String(value ?? '')
+     .replace(/\[[^\]]*GAP[^\]]*\]/gi, ' ')
+     .toUpperCase();
+   const types = new Set();
+   if (/\bPIPE\s+REST\b|\bREST\b|\bXRT\b/.test(cleaned)) types.add('REST');
+   if (/\bGUIDE\b/.test(cleaned)) types.add('GUIDE');
+   if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bPIPE\s+STOP\b|\bSTOP\b/.test(cleaned)) types.add('LINE_STOP');
+   return [...types];
+ }
```

```diff
+ function parseTable1C(text, log) {
+   // Required columns: Node, ISONOTE
+   // Stores: node, raw isonote, supportTypes
+ }
+
+ function parseTable2(text, log) {
+   const dtxrIdx = idx(headers, ['dtxr', 'dtxr optional', 'dtxr(optional)', 'support', 'support note']);
+   const dtxr = dtxrIdx >= 0 ? String(cells[dtxrIdx] ?? '').trim() : '';
+   const supportTypesRequested = normalizeSupportTypes(dtxr);
+ }
```

```diff
+ function evaluateSupport(modelTypes, nodeTypes, options) {
+   if (options.supportMode === 'ignore') return { basis: 'SUPPORT_IGNORED', matchText: '', rank: 5, eligible: true, matchedTypes: [] };
+   if (!requested.length) return { basis: 'SUPPORT_NOT_REQUESTED', matchText: '', rank: 4, eligible: true, matchedTypes: [] };
+   if (!available.length) return { basis: 'SUPPORT_MISSING', matchText: '', rank: 8, eligible: options.supportMode !== 'strict', matchedTypes: [] };
+   const matchedTypes = requested.filter((type) => available.includes(type));
+   if (matchedTypes.length) return { basis: `SUPPORT_${matchedTypes.join('_')}`, matchText: supportMatchText(matchedTypes), rank: 0, eligible: true, matchedTypes };
+   return { basis: 'SUPPORT_CONFLICT', matchText: '', rank: 9, eligible: options.supportMode !== 'strict', matchedTypes: [] };
+ }
```

```diff
+ function canUseCandidate(candidate, usedRefs) {
+   if (!usedRefs.has(candidate.refId)) return true;
+   return candidate.modelSupportTypes?.length > 0;
+ }
+
+ if (reused) {
+   selected.basis = `${selected.basis} + MULTI_SUPPORT_NODE`;
+   selected.warnings.push(selected.supportMatch ? 'NODE_REUSED_FOR_SUPPORT' : 'NODE_REUSED_SUPPORT_REVIEW');
+ }
```

## Classification

- Type: feature extension + duplicate-resolution workaround.
- Caveat: same node reuse is currently allowed for any model row with requested support types, even if `SUPPORT_CONFLICT` in prefer mode. Review before strict engineering output.

---

# 12. PS Mapping UI modal

## Problem

Need user-facing source tables, resolver setup, output, candidate matrix, user log, and debug log.

## Current code diff pattern

```diff
+ function defaultState() {
+   return {
+     activeTab: 'source',
+     source: {
+       table1: PS_MAPPING_SAMPLE_TABLE1,
+       table1A: PS_MAPPING_SAMPLE_TABLE1A,
+       table1B: PS_MAPPING_SAMPLE_TABLE1B,
+       table1C: PS_MAPPING_SAMPLE_TABLE1C,
+       table2: PS_MAPPING_SAMPLE_TABLE2,
+     },
+     options: { boreMode: 'prefer', lineMode: 'prefer', supportMode: 'prefer', odToleranceMm: 1.5, allowRawDiaMatch: true, allowDnMatch: true, allowDuplicateAssignment: true },
+     result: null,
+   };
+ }
```

```diff
+ <textarea data-psmap-source="table1C">${h(state.source.table1C)}</textarea>
+ <select data-psmap-option="supportMode">
+   <option value="prefer">Prefer</option>
+   <option value="strict">Strict</option>
+   <option value="ignore">Ignore</option>
+ </select>
+
+ // Output columns
+ Enabled | PSNO_Model | Node | Tag | Support match | Basis | Confidence | Warnings
+
+ // Candidate Matrix columns
+ PSNO_Model | Candidate Node | Table-1 PS No | Tag | PS Basis | Bore Basis | Support Basis | Support match | Line Basis | Eligible | Selected | Reason
```

## Classification

- Type: new UI feature.
- Keep.

---

# 13. Formatter 503 mitigation

## Problem

Browser returned `503 Service Unavailable` for `formatter.js`. File existed, so root cause was likely static host/CDN cache/deploy inconsistency, not missing source.

## Code diff pattern

```diff
+ /**
+  * formatter.js — Number formatting and unit conversion helpers.
+  * Asset version: 20260610-format-1.
+  */
```

```diff
- import { fmt } from '../utils/formatter.js';
+ import { fmt } from '../utils/formatter.js?v=20260610-format-1';
```

```diff
- import { pipeLength } from './formatter.js';
+ import { pipeLength } from './formatter.js?v=20260610-format-1';
```

## Classification

- Type: cache-bust workaround / asset republish.
- Keep only as long as static deploy cache is unreliable. It is safe but not a structural fix.

---

# 14. App shell `init()` compatibility restore

## Problem

`viewer/index.html` imported `init` from `core/app.js`, but `app.js` no longer exported it.

## Code diff pattern

```diff
+ let mountedDestroy = null;
+
+ export async function init(shell) {
+   if (mountedDestroy) {
+     try { mountedDestroy(); } catch (error) { console.warn('Previous app mount cleanup failed', error); }
+     mountedDestroy = null;
+   }
+   mountedDestroy = await mountApp(resolveShellRefs(shell));
+   return mountedDestroy;
+ }
```

## Classification

- Type: backward-compatibility shim.
- Keep unless `index.html` boot path is intentionally changed to call `mountApp` directly.

---

# 15. App shell tab-bar rendering restore

## Problem

Page loaded but header tabs were missing because `index.html` had an empty `<nav id="tab-bar"></nav>` and current `mountApp()` only bound clicks to existing buttons.

## Current code diff pattern

```diff
+ const TABS = [
+   { id: 'viewer3d', configKeys: ['viewer3d', 'geometry'], label: '3D Viewer', render: renderViewer3D },
+   { id: 'viewer3d-rvm', configKeys: ['viewer3d-rvm', 'rvm'], label: '3D RVM Viewer', render: renderViewer3DRvm },
+   ...
+   { id: 'psnm-utility', configKeys: ['psnm-utility', 'psnmUtility', 'utilities'], label: 'Utilities', render: renderPSNM_UtilityTab },
+ ];
+
+ function buildTabBar() {
+   if (!shellRefs?.nav) return;
+   shellRefs.nav.innerHTML = visibleTabs.map((tab) => (
+     `<button type="button" class="tab-btn" data-tab="${h(tab.id)}">${h(tab.label)}</button>`
+   )).join('');
+ }
+
+ export async function mountApp(shell) {
+   loadStickyState();
+   shellRefs = resolveShellRefs(shell);
+   visibleTabs = await loadVisibleTabs();
+   buildTabBar();
+   bindNavClick();
+   bindSwitchEvent();
+   initDevDebugWindow();
+   renderActiveTab(resolveInitialTabId());
+ }
```

## Classification

- Type: regression fix.
- Keep.

---

# 16. Cache-key bumps / module versioning workaround

## Problem

Several static modules were cached during rapid deployment, so new code did not load despite commits.

## Code diff pattern

```diff
- import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260608-nps-fix-1';
+ import { renderPSNM_UtilityTab } from '../tabs/psnm-utility-tab.js?v=20260610-psnm-15';
```

```diff
- import './psnm-utility/psnm-context-actions.js?v=20260609-context-actions-1';
+ import './psnm-utility/psnm-context-actions.js?v=20260610-context-actions-2';
```

```diff
- import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260610-psmap-1';
+ import { installPsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260610-psmap-support-1';
```

## Classification

- Type: static-host cache workaround.
- Long-term improvement: centralize a build/version constant or use bundler hashing instead of manual query strings.

---

# 17. Known unresolved / review items

These are deliberately documented because they are not fully solved by the patches above.

```diff
+ // PSNM manual-anchor guard is UI-level only.
+ // Native v6 should be patched to stop internal default anchor selection.
```

```diff
+ // PSNM lite transform preview is same-axis only.
+ // Axis-mapped benchmark panel is separate and does not replace v6 Run Match output.
```

```diff
+ // PS Mapping same-node reuse currently allows support-requested rows to reuse a node.
+ // In supportMode='prefer', SUPPORT_CONFLICT rows can still map with warning.
+ // For engineering-certified output, use supportMode='strict' or harden canUseCandidate().
```

```diff
+ // Cache-key query strings are scattered manually.
+ // Prefer build-generated asset hashes in a future cleanup.
```

---

# 18. High-value cleanup backlog

1. Replace PSNM anchor UI shim with native v6 anchor-state validation.
2. Fold axis-mapped Auto Anchor into main PSNM matcher only if production data requires axis permutations.
3. Add tests for PS Mapping resolver:
   - tag extraction from Table-1 only;
   - OD-to-DN bore matching;
   - duplicate PS assignment;
   - Table-1C support matching;
   - same-node multi-support reuse;
   - strict/prefer/ignore support modes.
4. Replace manual query-string cache bumps with hashed asset names or a version manifest.
5. Decide whether legacy PSNM overlay imports in `app.js` should be physically removed once no-op behavior is confirmed.

---

# 19. Smoke-check commands / manual checks

```text
Hard refresh browser.
Open app.
Verify header tabs render.
Open Utilities.
Verify PSNM Matcher still opens.
Verify PS Mapping Utility tile opens.
Run PS Mapping sample.
Expected: output table includes PSNO_Model, Node, Tag, Support match, Basis.
Open Candidate Matrix and Debug Log.
```

---

End of ledger.
