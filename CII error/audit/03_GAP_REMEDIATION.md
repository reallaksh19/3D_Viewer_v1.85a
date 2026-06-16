# Gap Analysis & Remediation Plan

How to close the five defects (G1–G5) so the pipeline output matches
`1885-GH-TYP-04-STEAM-02.{xml,cii}` on geometry & support continuity.
Ordered by impact / effort.

---

## G4 — Supports not mapped to `RESTRANT` *(Critical)*
**Symptom:** reference 117 restraint rows → ours 2 (end anchors only).
**Root cause:** the support data lives on `ATTA` elements as `CMPSUPTYPE` (×2868),
`MDSSUPPTYPE` (×2085), `GUIDE` (×1119), `SUPPORT` (×835), but the
StagedJSON→XML pass never turns those into `<RESTRAINT>` rows. A resolver already exists
(`viewer/support/SupportKindResolver.js` → `resolveKindFromAttrs`, see
`docs/support-kind-resolution.md`) but the **Model Converter conversion route does not call it
to emit restraints** — it only carries supports for the 3D *symbol* render.
**Fix:**
1. In the staged‑JSON build (`viewer/converters/rmss-attribute-parser.js`), keep each `ATTA`'s
   `CMPSUPTYPE`/`MDSSUPPTYPE`/`GUIDE`/`SUPPORT` attributes and its owning branch + position.
2. In StagedJSON→XML, for every retained `ATTA`, call `resolveKindDescriptor(attrs)` to get
   `{primaryKind, kinds[], dofs}` and emit one `<RESTRAINT NODE=… TYPE=… STIFFNESS=…/>` per DOF at the
   nearest model node. Map kind→CAESAR restraint TYPE (ANCHOR/X/Y/Z/GUI/LIM…) and stiffness
   (rigid 9.42e19 vs directional 1.75e12, matching the reference values).
3. Update `NUMREST` in `PIPINGMODEL`.
**Validates when:** restrained‑node count ≈ 117 and stiffness families (9.4e19 / 1.75e12) appear.

---

## G1 — Wrong branch selection *(High)*
**Symptom:** `S8810103/B1` and `S8810101/B1,B6` missing; `S88112`/`S8811951` carry extra siblings (B8–B11).
**Root cause:** selection is by **S‑number (pipe), which then includes every child branch**, while the
reference stress model is a **curated branch subset** forming one continuous run.
**Fix:**
1. Confirm `S8810103` is actually selected — it is present in `ATTRIBUTE.TXT`
   (`/ASIM-1885-8"-S8810103-91261M7-HC/B1`) but absent from the staged JSON, so the routing for a
   single‑branch 8″ pipe is dropping it. Trace `parseRmssStructuralMembers` /
   `selectExactPortPair` in `viewer/converters/rmss-attribute-parser.js` for that branch.
2. Allow **branch‑level** selection (not just pipe‑level) so the model can match the reference's
   exact 12‑branch set instead of all siblings.
3. Re‑run with selection = {S8810101/B1,B6,B7; S8810111/B1,B2; S88112/B1,B2,B6; S8810103/B1;
   S8811951/B2,B3,B7} → ELEMENTS should reach 274.
**Validates when:** ELEMENTS = 274, BEND = 24 (strict CII continuity).

---

## G2 — Site datum offset not applied *(High)*
**Symptom:** positions match the reference only after a constant translation ≈ (150500, 43000, **100000**) mm.
**Root cause:** the SITE element carries `POS:= E 0 N 0 U 100000mm` (and intermediate ZONE/PIPE datums);
AVEVA bakes the full datum chain into absolute coordinates, our pipeline emits **local** coordinates.
**Fix:** in StagedJSON→XML coordinate assembly, accumulate the `POS`/`ORI` of every owning element
(SITE→ZONE→PIPE→BRANCH) and add the datum translation before writing `UXML_GEOM`/deltas. The `U 100000mm`
SITE datum is the dominant term.
**Validates when:** direct (zero‑offset) `<Position>` overlap with the reference jumps from 0 to ~all
shared points.

---

## G3 — Vertical‑axis convention (Y↔Z) in CII *(High)*
**Symptom:** element Σ\|dy\| and Σ\|dz\| are swapped vs the reference; model rotated 90° about X.
**Root cause:** AVEVA `psi2cii` maps PDMS **Up→CAESAR‑II Y** (Y is CAESAR's vertical axis); our
XML→CII converter keeps **Up→Z** while declaring `NORTH_Y="1"`.
**Fix:** in the InputXML→CII converter (`viewer/converters/py-worker.js` / invocation builder), apply the
CAESAR‑II axis map **Up→Y, North→Z (or per project convention)** consistently to element deltas, bend
nodes, restraint cosines and SIF, OR set `NORTH_Z="1"` and keep Z‑vertical — but it must match the
reference's choice (Y‑vertical). Pick one convention and transform *all* vectors with it.
**Validates when:** Σ\|dy\| ≈ 14 k (small, vertical) and Σ\|dz\| ≈ 69 k, matching the reference.

---

## G5 — `NODENAME` section dropped *(Medium)*
**Symptom:** no `#$ NODENAME` block; reference has 125 names.
**Root cause:** `PIPINGELEMENT NAME=""` is empty from the XML stage because `ComponentRefNo`/PDMS names
are not propagated (Report 1 §2), so the CII writer has nothing to emit.
**Fix:**
1. Carry the PDMS component name / `ComponentRefNo` into `PIPINGELEMENT NAME=` (and per‑node tag) during
   StagedJSON→XML.
2. In XML→CII, emit a `#$ NODENAME` block writing the from/to name pair for every node (the reference
   format is two 25‑char columns). Generate `PS-xxxxx/DATUM`, `PS-xxxxx.n` style names if PDMS names are
   absent, to preserve continuity.
**Validates when:** `#$ NODENAME` present with one row per node.

---

## Suggested execution order
1. **G1** (re‑select exact branches) — unlocks correct ELEMENT/BEND/SIF counts.
2. **G2 + G3** (datum + axis transform) — geometry becomes positionally and rotationally equal.
3. **G4** (supports) — restores the 117 restraints; biggest analysis‑fidelity win.
4. **G5** (node names) — restores traceability.

## Regression check (add as a converter test)
Re‑run `ATTRIBUTE.TXT` with the exact 5‑item/12‑branch selection and assert against the reference:
`NUMELT=274, NUMBEND=24, NUMREST≈117, NODENAME present, Σ|dy|≈14k`. Wire it next to
`viewer/tests/stagedjson-xml-preserves-fittings.test.js`.
