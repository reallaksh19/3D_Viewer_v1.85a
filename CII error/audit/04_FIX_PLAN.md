# Fix Plan — Restore Geometry & Support Continuity (G1–G5)

**Principles (per request):** no hard-coded fixes; every default lives in an existing config
surface (`inputxml_bookmark.py` defaults, `inputxml_to_cii2019_config.json`, or the Support-Type-Rules
UI) and is overridable; no mock/synthetic data — values are derived from the source `ATTRIBUTE.TXT`
attributes or from a user-supplied reference/config.

Grounding: the pipeline is
`rmss-attribute-parser.js (StagedJSON) → scripts/stagedjson_to_inputxml.py (InputXML)
→ scripts/inputxml_to_cii2019.py (CII)`, driven by `tabs/model-converters-tab.js`.
The CII writer **already** supports `NODENAME` and `RESTRANT` (`inputxml_to_cii2019.py`,
`RestraintAux`, `nodename_payload`, config keys `nodename`/`restraint`) — they arrive empty because
the upstream InputXML carries no support rows and blank `NAME=`. Most work is wiring, not new format code.

---

## G4 — Map real supports to RESTRAINT/RESTRANT *(Critical)*

**Root cause (in code):** `scripts/stagedjson_to_inputxml.py:308` — `if typ in ('OLET','SUPPORT'): … continue`
drops every `SUPPORT` child. Only synthetic open-end anchors survive (`detect_anchors`,
`emit_restraint_slots`). Source supports (`CMPSUPTYPE`×2868, `MDSSUPPTYPE`×2085, `GUIDE`×1119) never
reach the InputXML.

**Approach (no hardcoding, no mock):**
1. **Resolve kind where the rules already live.** In `tabs/model-converters-tab.js`, the support kind is
   already computed via `resolveKindFromAttrs` (`_supportKindForOutput`, lines 1509–1515) using the
   configurable Support-Type-Rules. Extend the StagedJSON build (`converters/rmss-attribute-parser.js`)
   so each `SUPPORT`/`ATTA` node **retains** its raw support attributes **and** the resolved
   `{primaryKind, kinds[], dofs}` from `resolveKindDescriptor` (`support/SupportKindResolver.js`). No
   value is invented — kind comes from the attributes via the existing rule engine.
2. **Emit RESTRAINT in `stagedjson_to_inputxml.py`.** Replace the blanket `SUPPORT` drop with: snap the
   support POS to the nearest model node, then for each resolved DOF emit a `<RESTRAINT>` slot on that
   element. Map kind→CAESAR restraint `TYPE` and stiffness via a **new config block**
   `restraint_kind_map` in `inputxml_bookmark.py`/bookmark JSON (e.g. `ANCHOR/X/Y/Z/GUI/LIM` →
   type code + stiffness). Default rows are the catalog mapping, fully overridable; the existing
   `anchor_stiffness` default (9.41952e+19) is reused, not duplicated.
3. **Let the existing CII path carry them through.** `inputxml_to_cii2019.py` already converts
   `RESTRAINT` slots → `RESTRANT` aux blocks (`RestraintTypeMappingPolicy`, config key `restraint`).
   Add the kind→CII-type mapping there only if the InputXML `TYPE` needs translating; prefer
   `explicit_map` policy driven by config over inlined constants.
4. **Update counts.** `NUMREST` in `<PIPINGMODEL>` and the CII `CONTROL` line are already derived from
   the emitted rows — verify they recompute (no literal counts).

**Done when:** restrained-node count tracks the source support set (reference ≈117), stiffness families
(rigid 9.42e19 + directional) appear, and `RESTRANT` 2nd field (type) is populated from resolved kind.

---

## G1 — Exact branch selection (incl. dropped `S8810103`) *(High)*

**Root cause:** selection is pipe-level (pulls every child branch: B8–B11), and the single 8″ branch
`/ASIM-1885-8"-S8810103-91261M7-HC/B1` present in `ATTRIBUTE.TXT` is absent from the StagedJSON — a
routing drop in `rmss-attribute-parser.js` (`parseRmssStructuralMembers` / `selectExactPortPair`).

**Approach:**
1. Add **branch-level selection** to the converter UI/options (`model-converters-tab.js`) so the user can
   pick the exact branch set (the reference's 12 branches) instead of whole pipes. Selection list is
   built from parsed branches — no hardcoded names.
2. **Trace the S8810103 drop:** instrument `selectExactPortPair`/port-pairing for a single-branch 8″ pipe;
   it is likely being filtered when a branch has no sibling to pair. Fix the routing so a lone branch is
   retained. Add a converter test asserting every *selected* branch appears in StagedJSON.

**Done when:** with the 12-branch selection, StagedJSON/InputXML/CII reach `NUMELT=274`, `NUMBEND=24`.

---

## G2 — Apply the datum/transform chain (no hard-coded offset) *(High)*

**Root cause:** positions are read straight from attribute `POS` (`pt()` in
`stagedjson_to_inputxml.py`); the SITE/ZONE/PIPE datum chain (SITE `POS:= … U 100000mm`, plus `ORI`) is
never composed in, so output is local. The empirical ≈100 000 mm vertical offset is exactly that SITE
datum — it must be **read from the source**, not pasted in.

**Approach:**
1. In `rmss-attribute-parser.js`, while walking the SITE→ZONE→PIPE→BRANCH hierarchy, accumulate each
   owner's `POS` translation and `ORI` rotation into a world transform and store it on the StagedJSON
   (so the Python stage stays presentation-only). Values come solely from parsed attributes.
2. Add a config toggle `apply_world_datum` (default **on**, overridable) in the converter options so users
   who want local coordinates can disable it. No literal offsets anywhere.

**Done when:** zero-offset `<Position>` overlap with the reference jumps from 0 to all shared points.

---

## G3 — Vertical-axis convention, configurable *(High)*

**Root cause:** AVEVA `psi2cii` maps PDMS *Up→CAESAR Y* (Y vertical); our chain keeps *Up→Z* while the
InputXML header declares `NORTH_Y="1"`. The mapping exists as config (`InputXmlDefaults.north_x/y/z`,
plus a `coords` block in `inputxml_to_cii2019_config.json`) but is **not applied** to the geometry
vectors.

**Approach:**
1. Introduce a single configurable `vertical_axis` / axis-map default (extend `InputXmlDefaults`; default
   = match AVEVA `psi2cii` = Up→Y) and apply **one** consistent transform to all vectors — element
   deltas, bend nodes, restraint cosines, SIF, coords — at the InputXML→CII boundary (or once at
   StagedJSON→InputXML). Keep `north_*` consistent with the chosen axis.
2. No swap is hardcoded; the transform is parameterised by the config axis map, so a project using
   Z-vertical can set it without code changes.

**Done when:** element delta sums match the reference orientation (Σ|dy|≈14k vertical, Σ|dz|≈69k), i.e.
Y becomes the small/vertical axis.

---

## G5 — Populate NODENAME end-to-end *(Medium)*

**Root cause:** `stagedjson_to_inputxml.py` writes `PIPINGELEMENT NAME=""`; with no names upstream,
`inputxml_to_cii2019.py` emits an empty `NODENAME`. (The AVEVA-native `xml_to_cii2019.py` already builds
NODENAME from `<NodeName>` — proof the format path works.)

**Approach:**
1. Carry the PDMS component name / `ComponentRefNo` from the attributes into StagedJSON, then into
   `PIPINGELEMENT NAME=` and a per-node tag in `stagedjson_to_inputxml.py`. Real source names only.
2. In `inputxml_to_cii2019.py`, populate `nodename_payload` from those names (config key `nodename`
   already exists). Where a node truly has no source name, fall back to a **derived, deterministic**
   tag from the node number (configurable prefix; not mock data — a label, like AVEVA's `PS-xxxxx`).

**Done when:** `#$ NODENAME` present with one row per node, names sourced from attributes.

---

## Sequencing & verification

1. **G1** (exact branches) → unlocks correct element/bend/SIF counts.
2. **G2 + G3** (datum + axis) → geometry becomes positionally and rotationally equal.
3. **G4** (supports) → restores ~117 restraints (largest fidelity win).
4. **G5** (node names) → restores traceability.

**Regression test (real data, committed fixture):** add `viewer/converters/scripts/psi116_regression_1885.py`
(mirroring the existing `psi116_regression_bm1.py`) that runs the full chain on the committed `ATTRIBUTE.TXT`
with the 12-branch selection and asserts against the reference CII:
`NUMELT=274, NUMBEND=24, NUMREST≈117, NODENAME present, Σ|dy|≈14k`. Uses the real benchmark files in
`CII error/` — no mocks.

**Config surfaces touched (all overridable, nothing inlined):**
`inputxml_bookmark.py` (`InputXmlDefaults` + new `restraint_kind_map`, `vertical_axis`,
`apply_world_datum`, OD/schedule table), `inputxml_to_cii2019_config.json`
(`nodename`/`restraint`/`coords`), and the Support-Type-Rules UI in `model-converters-tab.js`.

**Bonus (de-hardcode existing):** replace the literal `OD_TABLE = {750:762.0, …}` in
`stagedjson_to_inputxml.py:56` with a configurable OD/schedule table loaded from a data file, so OD is
derived from a real, complete schedule rather than a 4-entry inline subset.
