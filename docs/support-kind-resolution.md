# Support Kind Resolution — Consumer Inventory

Tracks every place in the codebase that resolves a support kind (REST / GUIDE / LINESTOP / LIMIT / ANCHOR / SPRING) from raw attributes or text.

## Current Status (post Phase 7)

| Consumer | File | Resolver used | CA150/CA100 handled? | Configurable? | localStorage? |
|---|---|---|---|---|---|
| 3D RVM Viewer symbols | `rvm-viewer/RvmSupportSymbols.js` | `resolveKindFromAttrs` → `RvmSupportMapper` → `resolveKindPure` | **Yes** (builtin-ca150/ca100 rules) | Yes — Mapper UI | Wrapper only |
| Model Converter pass | `tabs/model-converters-tab.js` | `resolveKindFromAttrs` → `RvmSupportMapper` → `resolveKindPure` | **Yes** | Yes — Mapper UI | Wrapper only |
| RVM Tab enrichment | `tabs/viewer3d-rvm-tab.js` | `resolveKindFromAttrs` → `RvmSupportMapper` → `resolveKindPure` | **Yes** | Yes — Mapper UI | Wrapper only |
| 3D PCF Viewer | `js/pcf2glb/glb/buildComponentObject.js` | `resolveKindPure` (Phase 3) | **Yes** (DEFAULT_RULES) | Yes — Config Tab kindMap | None — pure |
| Native InputXML support import | `parser/xml-support-builder.js` | `resolveKindPure` with legacy viewer-token adapter | **Yes** (DEFAULT_RULES) | No (stateless) | None - pure |
| Native InputXML fallback supports | `tabs/viewer3d-tab.js` | `resolveKindPure` with legacy viewer-token adapter | **Yes** (DEFAULT_RULES) | No (stateless) | None - pure |
| UXML XML import | `interchange/builders/xml/xml-support-builder.js` | `resolveKindPure` (Phase 4) | **Yes** (DEFAULT_RULES) | No (stateless) | None — pure |
| Interchange support builder | `interchange/support/support-builder.js` | `resolveKindPure` after template raw-code extraction | **Yes** (DEFAULT_RULES) | No (stateless) | None - pure |
| UXML PCF import | `interchange/builders/pcf/pcf-canonical-builder.js` | `resolveKindPure` (Phase 5) | **Yes** (DEFAULT_RULES) | No (stateless) | None — pure |
| ACCDB converter | `utils/accdb-to-pcf.js` | `resolveKindPure` (Phase 6) | **Yes** (DEFAULT_RULES) | No (stateless) | None — pure |
| Legacy PCF mapper | `pcf-legacy/pcf-engine/support-mapper.js` | Friction + gap block matching → CA name | CA150/CA100 are output names | Yes — via `rvmPcfExtract.masters` | None |

## Architecture (post Phase 7)

```
viewer/support/SupportKindResolver.js   ← pure, stateless, zero browser deps
│  resolveKindPure(attrs, { userRules, defaultRules, kindMap, defaultKind })
│  resolveKindDescriptor(attrs, options) → { primaryKind, kinds[], dofs }
│  resolveKindFromText(rawText)
│  resolveKindFromDirection(rawText)
│  DEFAULT_RULES, DEFAULT_KIND_MAP
│  splitRuleTerms, normalizeMapperFieldName, collectMapperFieldValues
│
└─► rvm-viewer/RvmSupportMapper.js      ← localStorage wrapper + UI
       resolveKindFromAttrs(attrs)
       Used by: RvmSupportSymbols, model-converters-tab, viewer3d-rvm-tab
```

## Precedence within `resolveKindPure`

1. Explicit `SUPPORT_KIND` / `SUPPORT-KIND` attribute on the element
2. `userRules` — caller-injected overrides (RvmSupportMapper user-defined rules)
3. `kindMap` — SKEY shorthand map (Config Tab entries or DEFAULT_KIND_MAP)
4. `defaultRules` — shipped DEFAULT_RULES (CA150/CA250/CA100 + CMPSUPTYPE/MDSSUPPTYPE patterns)
5. Text heuristic - keyword scan over all attribute values (incl. STOPPER -> LINESTOP, LATERAL -> GUIDE)
6. Direction heuristic - UP/DOWN -> REST; cardinal/intercardinal requires pipe axis: parallel -> LINESTOP, perpendicular -> GUIDE
7. `defaultKind`

## `resolveKindDescriptor` — Composite Support API

Returns `{ primaryKind, kinds[], dofs }`. Handles composite catalog codes where a single
component imposes multiple DOF constraints.

| SKEY  | primaryKind | kinds            | dofs                |
|-------|-------------|------------------|---------------------|
| CA100 | REST        | [REST, GUIDE]    | Fy, Fx, Fz          |
| CA150 | REST        | [REST]           | Fy                  |
| CA250 | REST        | [REST]           | Fy                  |
| Other | resolved    | [resolved]       | per-kind table      |

## Phase Completion

| Phase | Scope | Status |
|---|---|---|
| 0 | `docs/support-kind-resolution.md` — consumer inventory | Done |
| 1 | `viewer/support/SupportKindResolver.js` — pure resolver, `resolveKindFromDirection`, LATERAL | Done |
| 2 | `viewer/rvm-viewer/RvmSupportMapper.js` — wire to resolver, `BUILTIN_RULES = DEFAULT_RULES` | Done |
| 3 | `viewer/js/pcf2glb/glb/buildComponentObject.js` — replace inline kind system | Done |
| 4 | `viewer/interchange/builders/xml/xml-support-builder.js` — replace `supportKindFromRestraint` | Done |
| 4A | `viewer/parser/xml-support-builder.js` - native InputXML support path delegates to resolver and preserves viewer tokens | Done |
| 4C | `viewer/tabs/viewer3d-tab.js` - fallback support synthesis delegates to resolver and preserves viewer tokens | Done |
| 4B | `viewer/interchange/support/support-builder.js` - template raw support code resolved before canonical `supportKind` | Done |
| 5 | `viewer/interchange/builders/pcf/pcf-canonical-builder.js` — resolve + preserve `supportCode` | Done |
| 6 | `viewer/utils/accdb-to-pcf.js` — replace `_supportKindFromBlock`, hoist imports | Done |
| 7 | LINESTOP/LIMIT renderer in `buildSupportProxy`; `resolveKindDescriptor` composite API | Done |
