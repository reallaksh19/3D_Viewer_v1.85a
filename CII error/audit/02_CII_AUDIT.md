# Audit Report 2 — InputXML → CII (2019) vs `1885-GH-TYP-04-STEAM-02.cii`

> Scope (as requested): geometry blocks `ELEMENTS, BEND, SIF&TEES` (no number may differ) and
> support `NODENAME` / `RESTRANT` (restraint *type* 2nd field and process parameters may differ).

Both files are the same CII neutral format (`#$ VERSION 5.0 / 11.0 / 1252`), so this is a true
block‑for‑block comparison.

## 1. Section inventory

| `#$` Section | Reference | Our CII | Note |
|---|---|---|---|
| ELEMENTS | **274** | **226** | ❌ 48 elements short |
| BEND | **24** | **21** | ❌ 3 bends short |
| RIGID | (152/4 ctrl) | 67 | weights null |
| **NODENAME** | **125 names** | **section absent (0)** | ❌ G5 |
| **RESTRANT** | **117 DOF rows** | **2 rows** | ❌ G4 |
| SIF&TEES | **20** | **22** | ⚠ count differs (+2) and nodes differ |
| CONTROL (NUMELT…) | `274 … 24 … 117 … 20` | `226 … 21 … 2 …` | mirrors the above |

> Requirement was *"no number can be different"* for ELEMENTS/BEND/SIF&TEES — **all three differ**, so
> the geometry block fails the strict continuity test, driven by the branch‑selection defect (G1).

## 2. Geometry orientation (defect G3)
Sum of absolute element deltas per axis:

| | Σ\|dx\| | Σ\|dy\| | Σ\|dz\| |
|---|---|---|---|
| Reference CII | 79 034 | **14 318** | **69 203** |
| Our CII | 77 882 | **56 861** | **12 894** |

- `dx` agrees (≈ 78–79 k).
- `dy` and `dz` are **swapped**: the reference's smallest‑motion axis (vertical, const) is **Y**; ours is **Z**.
- AVEVA `psi2cii` maps PDMS **Up → CAESAR‑II Y** (Y is the CAESAR vertical axis). Our converter keeps
  **Up → Z** and even declares `NORTH_Y="1"` in the InputXML header.
- Net effect: the model is **rotated 90° about X** relative to the reference / to CAESAR's expectation.
  Self‑consistent internally, but supports, gravity and any axis‑specific restraint would be mis‑oriented.

## 3. NODENAME (defect G5)
Reference `#$ NODENAME` (lines ~4180–4332) carries 125 PDMS names (`PS-12060/DATUM`, `PS-12060.1`, …),
giving every node a traceable identity and preserving branch continuity across the model.
Our CII has **no `#$ NODENAME` block** — the `PIPINGELEMENT NAME=""` were empty at XML stage (Report 1 §2),
so nothing to emit. Continuity/traceability of nodes is lost.

## 4. RESTRANT / supports (defect G4 — critical)
| | Reference | Our CII |
|---|---|---|
| Restraint DOF rows | **117** | **2** |
| Distinct restrained nodes | ~117 (10,30,50,90,110,170,…,2690) | **2** (10, 1340) |
| Nature | mix of anchors, rests, guides, line‑stops (stiffness 9.4e19 anchors **and** 1.75e12 directional) | both `9.419520E+19` **rigid anchors** = synthetic open‑end anchors only |

- The two restraints we emit are the auto‑anchors at the two free ends — **no real support was mapped**.
- The source `ATTRIBUTE.TXT` *does* carry support data: `CMPSUPTYPE` ×2868, `MDSSUPPTYPE` ×2085,
  `GUIDE` ×1119, `SUPPORT` ×835, on the 4110 `ATTA` elements. None of it reaches `RESTRANT`.
- `2nd field` (restraint type) and process params were allowed to differ — but here the **rows themselves
  are absent**, which is a continuity failure, not a tolerance difference.

## 5. BEND / SIF&TEES detail
- **BEND:** ref 24 vs ours 21. Bends present *within included branches* carry correct radius/angle
  (e.g. `229.0 … -2.0202`, `381.0 … -2.0202`); the 3 missing bends belong to the missing branches (G1).
- **SIF&TEES:** ref 20 vs ours 22. Different node membership (ref nodes 130,140,160,240,700…; ours
  50,60,110,120,350…), again because element node numbering diverges with the different branch set, and
  ours injects SIFs at OLET/TEE elements that the reference treats differently. `SIF1/SIF2/TYPE` are null
  in ours.

## 6. Conclusion (CII stage)
Within an included branch the geometric primitives (ELEMENT deltas, BEND radii, SIF placement) are
reproduced, but the CII **fails every strict continuity criterion**: element/bend/SIF counts differ (G1),
the model is rotated by the **Y↔Z vertical‑axis mismatch** (G3), **NODENAME is missing** (G5) and **115 of
117 supports are missing** (G4). The CII is therefore not analysis‑equivalent to the AVEVA reference.
