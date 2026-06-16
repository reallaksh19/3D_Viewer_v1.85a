# BM8 / 1885-GH-TYP-04-STEAM-02 — Model Converter Audit (Summary)

**Date:** 2026-06-03
**Source bundle:** `CII error/BM8.zip`
**Pipeline under audit:** `ATTRIBUTE.TXT → StagedJSON → InputXML (CAESAR II) → CII (2019)`
**Reference (AVEVA PSI / psi2cii):** `1885-GH-TYP-04-STEAM-02.xml`, `1885-GH-TYP-04-STEAM-02.cii`

## Requested selection
`S8810101`, `S8810111`, `S88112`, `S8810103`, `S8811951`

## Artifacts compared
| Stage | Our pipeline output | Reference (AVEVA) |
|---|---|---|
| Staged JSON | `ATTRIBUTE_managed_stage_1885_Steam.json` | — |
| InputXML | `..._stagedjson_to_inputxml.xml` (CAESAR II `Input` schema) | `1885-GH-TYP-04-STEAM-02.xml` (AVEVA `PipeStressExport`, `pipeStress116.xsd`) |
| CII | `..._inputxml_to_cii2019.cii` | `1885-GH-TYP-04-STEAM-02.cii` |

## Headline verdict
The pipeline produces a **structurally valid but materially incomplete** model. Geometry of the
branches that *are* included is largely faithful (same shape, same diameters/wall, bends and SIF
present), but four classes of defects break geometry/support **continuity** against the reference:

| # | Defect | Severity | Where |
|---|---|---|---|
| G1 | **`S8810103` branch (and `S8810101/B1,B6`) missing**; staged JSON also pulls in extra sibling branches (`B8–B11`) not in the reference stress model | **High** | StagedJSON selection |
| G2 | **Site datum offset not applied** — output is in *local* coordinates; absolute position differs from AVEVA by ≈ (150500, 43000, **100000**) mm. The 100 000 mm is the SITE `U 100000mm` datum. | **High** | StagedJSON→XML |
| G3 | **Vertical-axis convention mismatch in CII** — AVEVA `psi2cii` remaps PDMS *Up→CAESAR Y* (Y‑vertical, standard CAESAR II); our converter keeps *Up→Z*. Element delta sums show Y and Z swapped. | **High** | XML→CII |
| G4 | **Supports not extracted** — reference CII has **117** restraint DOF rows over ~117 nodes; ours has **2** (just the rigid end‑anchors). Source `CMPSUPTYPE`/`MDSSUPPTYPE`/`GUIDE` attributes are present but never mapped to `RESTRANT`. | **Critical** | ATTRIBUTE→…→CII |
| G5 | **`NODENAME` section dropped** — reference CII carries 125 PDMS node names (traceability/continuity); ours emits no `#$ NODENAME` block at all. | **Medium** | XML→CII |

Detailed evidence: see `01_XML_AUDIT.md` and `02_CII_AUDIT.md`.
Remediation plan: see `03_GAP_REMEDIATION.md`.
