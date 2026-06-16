# XML -> CII(2019) Complete Fix Plan

Branch: `fix/xml-cii-2019-complete`

## Phase 1 - Converter correctness

**Goal:** make generated CII consume enriched XML correctly.

**Implemented:**

- Route XML->CII(2019) through `xml_to_cii2019_patched.py`.
- Publish `Temperature1..9` and `Pressure1..9` into the CII `ELEMENTS` block.
- Add default ON behavior for `Use Restraint type based on Json`.
- ON: derive restraints from `DTXR_PS` / `DTXR_POS` keywords and ignore XML `<Restraint>`.
- OFF: merge XML `<Restraint>` rows with DTXR-derived restraints.

**Pass criteria:**

- CII element position 10 = T1, 11 = T2, 12 = T3.
- DTXR text containing `REST/SHOE/GUIDE/LIMIT/LINESTOP/ANCHOR` creates matching restraint rows.
- Original XML `<Restraint><Type>Z</Type>` is ignored when the option is ON.

## Phase 2 - Master/process temperature mapping

**Goal:** avoid wrong line-list column assignment for T1/T2/T3.

**Implemented:**

- Runtime normalization of `supportConfigJson.linelist.fieldMap` before enrichment/run.
- Header rule:
  - T1: `Temp Max`, `Temperature Max`, case-insensitive and punctuation-tolerant.
  - T2: plain `Temp` / `Temperature`, only when header does not contain Max/Min.
  - T3: `Temp Min`, `Temperature Min`, `Temp. Min`, case-insensitive and punctuation-tolerant.

**Pass criteria:**

- A line-list with `Temp Max`, `Temp`, `Temp Min` maps to `t1`, `t2`, `t3` respectively.
- A plain `Temp` column is not stolen by T1 or T3.
- `Temp Max` is never mapped as T2.

## Phase 3 - UI workflow and preview usability

**Goal:** make the XML->CII workflow usable without column overlap or hidden options.

**Implemented:**

- Visible checkbox: `Use Restraint type based on Json`.
- Checkbox persists in `localStorage` and is injected into worker requests.
- Workflow tab order moves `4A Weight Match` before `5 Run`.
- Preview, diagnostics, and 4A tables are horizontally scrollable and column-resizable.

**Pass criteria:**

- Checkbox appears in converter options and workflow run options.
- Toggling OFF sends `useRestraintTypeBasedOnJson: false` to the worker.
- 4A tab is visually before 5 Run.
- Wide preview tables no longer overlap columns.

## Phase 4 - 4A Weight Match and review popup DTXR correctness

**Goal:** display the same support description used in enriched XML.

**Implemented:**

- 4A / review DTXR cells are updated from XML `<DTXR_POS>` when present.
- If source XML has no `DTXR_POS`, the UI derives the same position-based DTXR using staged JSON `POSI` and the existing offset/tolerance.
- Candidate buttons are augmented with additional matching master candidates where local weight master data is available.

**Pass criteria:**

- 4A DTXR column shows the `DTXR_POS`-based text for matching node/position.
- The `Rigid Weights Need Review` table uses the same DTXR cell enhancement.
- Multiple candidates such as `VLV3-1`, `VLV5`, `VLV3`, `VLV1`, `VLV2` remain visible as selectable suggestions when present in the master data.

## Phase 5 - Validation gate

**Manual/browser checks still required in the target browser:**

1. Load XML + staged JSON.
2. Open XML->CII(2019) workflow.
3. Confirm 4A appears before 5 Run.
4. Confirm checkbox default ON.
5. Run preview/4A and verify DTXR column from `DTXR_POS`.
6. Generate CII and confirm T1/T2/T3 values are present in ELEMENTS positions 10/11/12.

GitHub status checks were not configured for the latest branch commits at the time of this patch.
