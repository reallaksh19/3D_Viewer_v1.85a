# Code Changes

## UXML CL1
- Added CL1 route-package, package snapshot, replay validator, and workbench summary layers.
- Wired the Universal XML Converter tab to the CL1 pipeline stages and updated certification coverage.

## RVM JSON -> PCF
- Changed Generate PCF readiness handling to require an explicit readiness check before export.
- Added UXML roundtrip contract and generate-button smoke coverage.

## XML Compare
- Added the normal 3D Viewer XML Compare tab, styling, and tab registration.
- Fixed the compare dataset normalizer alias bug (`buildXmlDataset` -> `buildDataset`).
- Added X12/X13 compare behavior and UI-marker certification tests plus a runner.

## Viewer Fixes
- Grouped repeated validation diagnostics in the RVM extract diagnostics panel.
- Replaced readiness skip selection with a single "Skip all Errors" toggle and added skip-all readiness behavior.
- Suppressed invalid piping-class override noise when the previous class is not a known master value.
- Changed support symbol scaling so the multiplier affects rendered size and forced a viewer refresh after scale changes.
- Forced 3D length labels to refresh immediately when the length toggle changes.

## PCFX Branch Recovery
- Recovered TEE/OLET branch geometry when PCF blocks carry three END-POINT rows without an explicit BRANCH1-POINT.
- Preserved branch geometry through canonical PCFX conversion and viewer mapping with a `branchPoint` alias.
- Added a focused PCF -> JSON roundtrip test for TEE/OLET third-port recovery.

## RVM Validate
- Removed the live Validate dependency on `_groupDiagnosticsForDisplay` by using local grouping logic in the diagnostics panel and validation flow.

## Viewer3D Length Labels
- Added a public `refreshLengthLabels()` hook on `PcfViewer3D` so length overlay rows rebuild after toggles and gap changes.
- Wired length, gap, and verification UI changes to refresh the overlay layer without requiring a full rerender when possible.
- Added the settings-panel refresh after overlay-only length updates so the live UI stays in sync.
- Added a regression test for the length-label refresh wiring.

## UXML InputXML Geometry Preview
- Added CAESAR `PIPINGELEMENT` normalization with inherited diameter handling and bidirectional node-coordinate reconstruction.
- Added UXML geometry preview stage and SVG preview panel in the Universal XML Converter tab.
- Preserved staged JSON absolute APOS/LPOS geometry in generated InputXML through `UXML_GEOM` XML comments and consumed those comments for exact preview placement.
- Blocked downstream face/topology/CL1 stages when UXML validation has blockers instead of allowing partial topology to pass.
- Changed UXML geometry preview from a single 2D projection to isometric plus XY/XZ/YZ views so Z-heavy branch drops do not collapse visually.
- Flagged delta-only InputXML preview as fallback-only when no `UXML_GEOM` absolute coordinates are available.
- Added preview-only rotate/flip controls for UXML geometry snapshots without mutating source coordinates.
- Preserved staged JSON TEE/OLET source type hints in generated InputXML metadata and surfaced component-type counts/markers in UXML preview.

## UXML Upstream InputXML Audit
- Relaxed PDF Input Echo detection to accept CAESAR reports that expose `INPUT LISTING` plus `PIPE DATA`.
- Extended PDF metric-unit parsing for diameter, pressure, modulus, hot modulus, and density fields.
- Added PDF reconstructed `UXML_GEOM` comments so PDF-generated InputXML carries UXML preview coordinates.
- Preserved CAESAR SIF branch fitting identity by mapping suffix-bearing `Welding Tee` labels and UXML SIF type codes.
- Updated REV staged hierarchy loading so two-point REV `BRAN/OLET` components populate `CPOS` and `BPOS` instead of losing the branch point.

## UXML Source Intake and Viewer3D Toggle
- Added a dedicated browser converter executor module for UXML intake bridge calls (`pdf_to_inputxml`, `stagedjson_to_inputxml`) without touching topology builders.
- Extended 3D Viewer imports with a `Use UXML topobuilder` toggle (default `false`) and routed PCF/raw imports through UXML intake only when enabled.
- Added AVEVA XML guard on the UXML intake route in 3D Viewer so Standard XML AVEVA files stay on the existing direct import path.
- Extended raw import picker to accept staged JSON (`.json`) for toggle-enabled UXML intake routing.
- Added regression coverage for the new toggle wiring and intake route contract in `viewer/tests/unit/viewer3d-uxml-topobuilder-toggle.test.js`.

## UXML Import Audit Coverage
- Added a focused import-audit test suite for source intake completeness and ownership boundaries across PCF, PDF, staged JSON, InputXML, and Standard XML routes.
- Verified existing-converter bridge selection for PDF (`pdf_to_inputxml`) and staged JSON (`stagedjson_to_inputxml`) with converter-injected runs.
- Verified direct normalization routes remain import-only and do not emit PCF/master side effects.
- Verified `AUTO` source mode correctly detects staged JSON and triggers `Run existing converter` through `stagedjson_to_inputxml`.

## InputXML to CII 2019 RESTRANT Support Mapper
- Added the requested `inputxml_to_cii2019_beforesupportmapper.py` backup beside the active converter.
- Changed `RESTRAINT` conversion so each piping element emits one 24-line `RESTRANT` auxiliary block with six numeric restraint slots followed by six support tag/GUID string pairs.
- Preserved XML `RESTRAINT/NUM` slot positions and support `TAG`/`GUID` values in the neutral file output.
- Removed the legacy `TYPE=2 -> TYPE=4` remap and validates emitted restraint type codes as CAESAR integer values from 1 to 62.

## XML->CII(2019) restraint codes, weights, and workflow UX
- Mapped signed restraint axes to their literal CAESAR II type codes (e.g. `+Y` -> 14, `-Z` -> 18) in `xml_to_cii2019.py`; bare axes keep the documented XML->CII frame map.
- Added a `--weight-scale` option to `xml_to_cii2019.py` and a default-ON "kg -> N (×10)" checkbox so component weights convert from kgf to Newtons during enriched-XML -> CII.
- Made `model-converters` localStorage persistence resilient: large imported master tables are dropped from the persisted copy (they reload from source / can be exported) so it never throws `QuotaExceededError`.
- Fixed the 7 Config tab freeze by populating the editor via `textarea.value` after paint instead of escaping/parsing multi-MB JSON through `innerHTML`.
- Replaced the 4 Diagnostics wall-of-buttons + per-type tables with a single adaptive table plus a category filter and free-text search (empty columns hidden).
- Added horizontal scroll to the Output and enrichment-diagnostics panels, and a draggable divider between the Geometry Preview and Logs panels (position persisted).
- Added a 5A Weight Match workflow tab: review approximate weights (rating ×3, bore ×2, length ×1) with a preferred ★ choice (exact bore+rating, weight linearly scaled to actual length); Run now opens the review, then Finalize and Run launches the conversion.

## XML->CII(2019) restraint revalidation and config editor performance
- Restraints now revalidate against staged JSON support kinds instead of trusting the XML type: Shoe/REST/Wear-Plate(WP)/Base-Plate(BP) -> REST -> `+Y`, with the staged `SUPPORT_KIND` trusted first and a keyword fallback for raw AVEVA data (fixes wear plates that previously went unclassified).
- The support-match diagnostic now records the original XML restraint types alongside the staged-derived types so the revalidation is visible.
- The 7 Config editor loads a compact view with the bulky master tables hidden (placeholder), so multi-MB configs open instantly without freezing the page; saving re-merges the hidden rows and Export/Import use the full config.

## XML->CII(2019) operating pressure P1 and fluid density
- Emit operating pressure P1 to the element block using the same path as temperature T1 (T1 at element row 2 col 4; P1 at element row 4 col 1, matching the CAESAR II T1-T9 / P1-P9 ordering anchored from the benchmark element layout). Zero pressure stays byte-identical to the previous output, so existing benchmarks are unaffected.
- Emit branch FluidDensity to element-block position 32 (row 6, col 2). Zero density stays byte-identical to the previous output.

## XML->CII(2019) restraint match priority + 5A weight review for rigids
- Restraint revalidation matches the staged support by PS-tag first, then falls back to coordinate proximity (the XML restraint type is not trusted). Fixes vertical rests like node 580 (faulty XML `Z`) resolving to the staged REST/GUIDE/LINESTOP -> `+Y/GUI/LIM` (CII 14/8/9).
- 5A Weight Match now lists zero-weight rigids that were previously hidden: element length is computed as the forward span to the next positive-numbered node (the CII keeps only positive NodeNumbers; `-1` fittings such as GASK/FLAN are collapsed), so a branch-connection valve like node 1170 gets its true 150.2 mm length instead of 0. Dangling end-of-branch occurrences and `-1` fitting nodes are excluded, and a genuinely zero-length valve still appears for manual weight entry.
