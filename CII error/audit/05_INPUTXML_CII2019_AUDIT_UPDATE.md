# Audit Update — InputXML -> CII(2019) and XML->CII Enriched InputXML Path

Date: 2026-06-07

Branch: `fix/xml-cii-enriched-inputxml-download`

Backup branch: `backup/inputxml-cii2019-before-enriched-inputxml`

## Scope

This update covers two related but distinct converter profiles:

1. `InputXML -> CII(2019)` via `viewer/converters/scripts/inputxml_to_cii2019.py`.
2. `XML -> CII(2019)` via `viewer/converters/scripts/xml_to_cii2019_patched.py`, now with an additional enriched InputXML debug/download artifact.

## Findings confirmed

### InputXML -> CII(2019)

The active InputXML converter is structurally stronger than the older XML direct paths for CII section integrity because it uses:

- `cii2019_section_rules.py` for section order and row-count validation.
- `cii2019_hanger_miscel_control.py` and `cii2019_miscel_hardener.py` for hanger/MISCEL_1 consistency.
- `cii2019_displmnt_sync.py` and `cii_syntax_check_2019.py` in the worker post-process path.

Known limitations remain:

- Header override CLI arguments are accepted but not fully reflected in the VERSION payload.
- The active InputXML parser currently models only `TEMP_EXP_C1..C3` for the main writer path.
- Pressure defaults are accepted but historically documented as not emitted by the main InputXML CII profile.
- Analysis equivalence still depends on upstream branch selection, world datum, Y/Z convention, NODENAME propagation and support extraction.

### XML -> CII(2019)

The XML direct path is still the production CII output path for PSI116/enriched XML, but the enriched XML is harder for users to debug because the CII element fields are implicit across branch/node constructs.

The new enriched InputXML debug artifact resolves this usability gap by exposing the post-enrichment model in a CAESARII/PIPINGMODEL structure:

- One `PIPINGELEMENT` per final edge.
- Explicit `FROM_NODE`, `TO_NODE`, `DELTA_X`, `DELTA_Y`, `DELTA_Z`.
- Explicit `DIAMETER`, `WALL_THICK`, `INSUL_THICK`, `CORR_ALLOW`.
- Explicit `TEMP_EXP_C1..C9`, `PRESSURE_C1..C9`, `MATERIAL_NUM`, `FLUID_DENSITY`.
- Child `RIGID`, `BEND`, `SIF`, and DTXR-derived `RESTRAINT` rows where available.

## Design decision

Agreed: creating enriched InputXML after XML enrichment is a valuable alternative/debug path.

Reasoning:

- CAESAR InputXML fields correspond closely to CII ELEMENT and auxiliary records.
- It allows user-level inspection before irreversible fixed-width CII serialization.
- It exposes mistakes in enrichment, axis mapping, material, wall thickness, support mapping and process cases earlier than CII diffing.
- It can later become an alternate conversion pipeline: XML -> enriched InputXML -> CII(2019), using `inputxml_to_cii2019.py` as a stricter second-stage writer.

## Implemented in this branch

- Added `viewer/converters/scripts/xml_to_inputxml_debug.py`.
- Added worker post-process hook for XML->CII to return a fourth downloadable artifact: `*_xml_to_cii2019_enriched.input.xml`.
- Added `viewer/converters/scripts/test_xml_to_inputxml_debug.py` to validate the BM8 actual file path.
- Updated `.github/workflows/xml-cii-bm8-validation.yml` to run the new test.
- Added backup manifest under `backups/inputxml_cii2019_before_enriched_inputxml/BACKUP_MANIFEST.md`.

## Better plan / value addition

Recommended staged upgrade:

1. Keep XML->CII direct writer as the production output until parity is proven.
2. Add enriched InputXML as a mandatory debug artifact for every XML->CII run.
3. Add an optional second-stage comparator: run enriched InputXML through `inputxml_to_cii2019.py` and compare key CII section metrics against the direct XML->CII writer.
4. Only promote XML -> enriched InputXML -> CII as the default path after metrics match for ELEMENTS, RESTRANT, RIGID, SIF&TEES, REDUCERS, MISCEL_1 and UNITS across BM8 and benchmark folders.

## Acceptance checks

- XML->CII output remains unchanged except additional output artifact.
- Enriched InputXML root is `CAESARII` with `PIPINGMODEL`.
- BM8 actual XML/JSON path emits DTXR-derived `+Y` support as a numeric CAESAR restraint type, not bare `Y`.
- BM8 actual path preserves wall thickness, process temperatures, pressure and fluid density in explicit InputXML attributes.
- GitHub workflow validates CII output, NPS master parsing and enriched InputXML debug export.
