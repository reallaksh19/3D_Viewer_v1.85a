# XML -> CII(2019) RCA and Phase Fix Log

Branch: `fix/xml-cii-fuzzy-density-node-weight`

## RCA

The line-list fuzzy mapper was scoring column names and early sample values too broadly:

- `T3` could be mapped to `Pressure Min kPa(g)` because the old logic treated `Min` as a sufficient hint.
- `InsThk` could be mapped to `Insulation Type` because the old logic treated `Insulation` as sufficient without requiring `Thickness/Thk/mm`.
- `Density Gas` was missed when the label was split across two label rows: first row `Density`, second row `Gas kg/m³`.
- `Density Mixed` was not preferred when `Mixed kg/m³` existed separately.

The fix is not based on `__EMPTY_23`, `__EMPTY_24`, etc. It scores each candidate column using semantic evidence from the column key plus the first label/sample rows.

## Phase 1 - Semantic fuzzy mapper

Implemented in:

- `viewer/converters/scripts/xml_to_cii2019_patched.py`
- `viewer/tabs/model-converters-ui-enhancements.js`

Rules:

- `T1`: requires temperature token + max/maximum; rejects pressure columns.
- `T2`: requires temperature token and rejects max/min/pressure.
- `T3`: requires temperature token + min/minimum; rejects pressure columns.
- `InsThk`: requires insulation + thickness/thk/mm and rejects type-only columns.
- `Density Gas`: accepts split labels like `Density` + `Gas kg/m³`.
- `Density Mixed`: accepts `Mixed kg/m³` / mixed-density semantics.

## Phase 2 - Insulation density

Implemented:

- UI textbox default = `210 kg/m³` near workflow mapping controls.
- Config key: `insulationDensityDefault`.
- Final XML normalization sets `<InsulationDensity>210</InsulationDensity>` only when branch/node insulation thickness is `>= 50 mm`; otherwise it writes `0`.
- CII writer emits insulation density at ELEMENT block position 31.

## Phase 3 - Weight and preview corrections

Implemented:

- Final XML normalization clears auto-populated weights for non-weight-bearing geometry types: `TEE`, `REDU`, `REE`, `BEND`, `ELBO`.
- 3 Preview UI marks these protected types as `not used` instead of showing valve/flange-derived weights.
- 3 Preview node-weight table gets a `DTXR` column populated from `DTXR_POS` / staged JSON position match.
- 4A has a fallback note for RIGID rows seen in 3 Preview with multiple candidate weights but missing from the 4A table.

## Phase 4 - Node numbering cleanup

Implemented:

- After final enrichment, any node with `NodeNumber=-1`, `ElementLengthMm>0`, and `ComponentType=FLAN/RIGID` is assigned a positive node number.
- Preferred numbering:
  - succeeding positive node minus 1,
  - otherwise preceding positive node plus 1,
  - otherwise 10000-series fallback.
- Adjacent `-1` nodes are ignored as preceding/succeeding anchors.

## Phase 5 - Tests

Added:

- `viewer/converters/scripts/test_xml_to_cii2019_patched_process.py`

Covered cases:

- `Pressure Min kPa(g)` does not map to T3.
- `Temp Max ºC` maps to T1.
- `Temp Min ºC` maps to T3.
- `Insulation Type` does not map to InsThk.
- `Insulation Thickness [mm]` maps to InsThk.
- Split `Density` + `Gas kg/m³` maps to Density Gas.
- `Mixed kg/m³` maps to Density Mixed.
- `-1` FLAN/RIGID node renumbering.
- REDU weight clearing.
- Insulation density population.

## Manual validation still required

Use:

- XML: `CII error/BM8/1885/1885-GH-TYP-04-STEAM-02.xml`
- JSON: `CII error/1885s.json`

Check:

1. Open XML->CII(2019) workflow.
2. Confirm T1/T3/InsThk/Density Gas/Density Mixed mapping resolves to the expected columns.
3. Confirm insulation density defaults to 210 kg/m³ and emits only when insulation thickness >= 50 mm.
4. Confirm 3 Preview node weights shows DTXR.
5. Confirm TEE/REDU/BEND weights are not populated.
6. Confirm length-bearing `-1` FLAN/RIGID nodes are renumbered before CII generation.
7. Confirm CII ELEMENT block position 31 contains insulation density and position 32 contains fluid density.
