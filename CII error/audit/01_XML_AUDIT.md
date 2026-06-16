# Audit Report 1 — StagedJSON → XML vs `1885-GH-TYP-04-STEAM-02.xml`

> Scope (as requested): geometry & support‑point continuity only, on the fields
> `NodeName, Endpoint, Rigid, ComponentType, Weight, ComponentRefNo, ConnectionType,
> OutsideDiameter, WallThickness, CorrosionAllowance, InsulationThickness, Position,
> BendRadius, SIF`. NodeNumber / default pressure / temperature deliberately ignored.

## 0. Schema reality check (important)
The two XMLs are **not the same schema**, so the requested fields exist on only one side:

| | Reference | Our output |
|---|---|---|
| Root | `<PipeStressExport xmlns="…pipeStress116.xsd">` | `<CAESARII … XML_TYPE="Input">` |
| Unit of data | `<Branch>/<Node>` with the 14 named fields | `<PIPINGELEMENT>` with `DELTA_X/Y/Z`, `DIAMETER`, `WALL_THICK`, plus `BEND/SIF/RIGID/RESTRAINT` children and a `UXML_GEOM` comment carrying absolute coords |

So the comparison below is **field‑equivalent**, mapping each reference field to its CAESAR‑II carrier,
not a literal tag‑for‑tag diff.

## 1. Counts

| Item | Reference (`PipeStressExport`) | Our XML (`CAESARII Input`) |
|---|---|---|
| Branches | 12 | flat element list (branch identity lost) |
| `<Node>` / `PIPINGELEMENT` | 526 nodes | 226 elements |
| `Rigid` markers | 47 | 67 `RIGID` |
| `BEND` | 72 `BendType` | 21 `BEND` |
| `SIF` carriers | 526 (field per node) | 44 `SIF` rows |

## 2. Field-by-field

| Field | Reference carrier | Our carrier | Continuity verdict |
|---|---|---|---|
| **NodeName** | `<NodeName>` (mostly blank in ref, populated in NODENAME at CII stage) | `PIPINGELEMENT NAME=""` — always empty | ⚠ Names not propagated (feeds G5) |
| **Endpoint** | `<Endpoint>` 0/1 flag | implicit (FROM/TO node) | ✅ topology preserved for included branches |
| **Rigid** | `<Rigid>` | `<RIGID WEIGHT TYPE>` | ⚠ present but **WEIGHT=-1.0101 (null)** and `TYPE="Unspecified"` everywhere — rigid *weights* not carried |
| **ComponentType** | BRAN/ELBO/OLET/GASK/FLAN/RIGID/VALV/REDU/INST/TEE/PCOM/ATTA | `UXML_GEOM TYPE=`: PIPE/FLAN/BEND/VALV/OLET/INST/TEE/REDU | ✅ component classes map; ATTA(182) intentionally collapsed into runs; GASK→not represented |
| **Weight** | `<Weight>` | `RIGID WEIGHT` | ❌ all null (`-1.0101`) |
| **ComponentRefNo** | `=1006649732/####` PDMS ref | — (no carrier) | ❌ PDMS ref dropped — traceability lost |
| **ConnectionType** | BRAN/… | — | ❌ no carrier |
| **OutsideDiameter** | `<OutsideDiameter>` (e.g. 273) | `DIAMETER` (150 = bore, mm) | ⚠ ref carries **OD**, ours carries **bore/nominal** — different basis |
| **WallThickness** | `<WallThickness>` | `WALL_THICK` | ⚠ present but mostly `-1.0101` after first element of a branch (only first element seeded) |
| **CorrosionAllowance** | `<CorrosionAllowance>` (0) | `CORR_ALLOW="-1.0101"` | ❌ null |
| **InsulationThickness** | `<InsulationThickness>` (120) | `INSUL_THICK="-1.0101"` | ❌ null — insulation not carried |
| **Position** | `<Position>` absolute XYZ | `UXML_GEOM FROM/TO` absolute XYZ | ⚠ shape matches, **datum offset wrong** (see §3) |
| **BendRadius** | `<BendRadius>` | `BEND RADIUS` | ✅ radii carried (e.g. 229, 381) |
| **SIF** | `<SIF>` per node | `SIF` rows | ⚠ rows exist but `SIF1/SIF2/TYPE` all null `-1.0101` |

## 3. Geometry continuity test (Position)
Method: extracted all unique `<Position>` points (ref, 267) and all `UXML_GEOM` FROM/TO points
(ours, 230); searched axis‑permutation + translation that maximises overlap.

- **Direct match: 0 points.**
- **Best fit: identity axes (no swap, no sign change) + translation (150500, 43000, 99999.9) → 103 points coincide.**

Interpretation:
- The **axis convention is the same at XML level** (no rotation), so branch *shape* is preserved.
- A constant **translation of ≈ 100 000 mm in the vertical** (plus N/E offsets) is missing. This is exactly
  the PDMS SITE datum `POS:= E 0 N 0 U 100000mm`. **Our pipeline emits local coordinates; AVEVA emits
  datum‑shifted absolutes.** → defect **G2**.
- Only 103/267 match because the branch *sets differ* (see §4), so the non‑overlapping points are
  branches present in one file but not the other.

## 4. Branch-set continuity (defect G1)

| S‑number | Reference branches | Our staged/XML branches |
|---|---|---|
| S8810101 | B1, B6, **B7** | B7 only |
| S8810111 | B1, B2 | B1, B2 ✅ |
| S88112 | B1, B2, B6 | B1…B10 (supersets) |
| **S8810103** | **B1** | **— absent —** |
| S8811951 | B2, B3, B7 | B2…B11 (supersets) |

- `S8810103/B1` exists in `ATTRIBUTE.TXT` (single 8″ branch) and in the reference, but is **missing** from
  the staged JSON → it was never selected/routed.
- For S88112 / S8811951 the staged JSON pulled **all sibling branches** (B8–B11) rather than the curated
  stress‑model subset, so the model is both *missing* required branches and *carrying* extra ones.

## 5. Conclusion (XML stage)
Geometry **shape and connectivity of the included branches is faithful** (identity axes, correct bend radii,
correct relative deltas). Continuity is broken by: wrong **branch selection** (G1), missing **site datum**
(G2), and **null physical attributes** (OD basis, wall after first element, insulation, weights,
corrosion, component ref). NodeName and ComponentRefNo are not carried, which becomes the CII NODENAME gap.
