# PCF SYNTAX MASTER & SMART FIXER — Consolidated Reference v2.0

**Single-source-of-truth for AI coding agents building PCF Validator, Fixer, and Smart Fix applications.**

**Consolidates:**
- PCF Syntax Master v1.2 (format rules, formulas, fallbacks, config)
- Smart PCF Fixer Rules v1.0 (chain walker, 57 rules, 4-tier fix system)
- Smart Fix Add-On WI (implementation code for existing app integration)
- Agent Clarifications (V1–V20 full logic, project setup, libraries, vector math)

**Document ID:** PCF-MASTER-002 Rev.0
**For:** AI Coding Agent
**File Format:** Windows CRLF

---

# TABLE OF CONTENTS

## PART A — PCF FORMAT RULES (Syntax Master v1.2)
- A§0. File Format Rule
- A§1. PCF File Structure
- A§2. Pipeline-Reference Logic
- A§3. Message-Square Universal Comment Syntax
- A§4. Component Keyword Mapping
- A§5. Geometry Lines Per Component
- A§6. Component-Attribute (CA) Lines
- A§7. SKEY Rules
- A§8. Formulas — Calculated Columns
- A§9. Fallback Rules
- A§9A. BRLEN Fallback Database
- A§10. Smart Parser — Bi-Directional Sync
- A§11. Reducer Detection Logic
- A§12. Support Block Rules
- A§13. Data Table Column Reference with Aliases
- A§14. PCF Generation Pseudocode
- A§15. Coordinate Format Summary
- A§16. Indent and Spacing Rules
- A§17. Bend Angle Calculation
- A§18. Validation Checklist (V1–V20)
- A§19. Quick Reference Block Templates
- A§20. Message-Square Formula
- A§21. Config Tab Summary

## PART B — SMART FIXER RULES (Chain Walker v1.0)
- B§1. Chain Walker Architecture
- B§2. Rule Categories (57 rules, 9 categories)
- B§3. Geometric Sanity Rules (R-GEO)
- B§4. Topological Checks (R-TOP)
- B§5. Chain Continuity Rules (R-CHN)
- B§6. Gap Analysis Rules (R-GAP)
- B§7. Overlap Analysis Rules (R-OVR)
- B§8. Branch-Specific Rules (R-BRN)
- B§9. Spatial Reasoning Rules (R-SPA)
- B§10. Data Quality Rules (R-DAT)
- B§11. Chain Aggregate Rules (R-AGG)
- B§12. Fix Application Engine
- B§12A. Fixing Action Preview Protocol
- B§13. Auto-Fix Tier Classification
- B§14. Config Parameters for Smart Fixer
- B§15. Integration with Processing Pipeline
- B§16. Rule Quick Reference (all 57 rules)

## PART C — IMPLEMENTATION (Smart Fix Add-On)
- C§1. Integration Point
- C§2. New State Additions
- C§3. New Module Structure
- C§4. Vector Math Utilities (Region A)
- C§5. Connectivity Graph Builder (Region B)
- C§6. Chain Walker (Region C)
- C§7. Element Axis Detector (Region D)
- C§8. Gap/Overlap Analyzer (Region E)
- C§9. Rule Engine (Region F)
- C§10. Fix Application Engine (Region G)
- C§11. Fixing Action Descriptor (Region H)
- C§12. Smart Fix Orchestrator (Region I)
- C§13. UI Integration (Region J)
- C§14. Complete Workflow
- C§15. Anti-Drift Rules
- C§16. Size Estimate

## PART D — AGENT CLARIFICATIONS
- D§1. Project Setup
- D§2. Library Choices
- D§3. Fuzzy String Matching
- D§4. Validation Rules V1–V20 (Complete Logic)
- D§5. Vector Math Specification

---

# ═══════════════════════════════════════════════════════════
# PART A — PCF FORMAT RULES
# Source: PCF Syntax Master v1.2
# ═══════════════════════════════════════════════════════════


## 0. FILE FORMAT RULE

**All PCF output files MUST use Windows line endings (CRLF = `\r\n`).**

```python
with open("output.pcf", "w", newline="\r\n") as f:
    f.write(pcf_content)
```

---

## 1. PCF FILE STRUCTURE

```
ISOGEN-FILES ISOGEN.FLS
UNITS-BORE MM
UNITS-CO-ORDS MM
UNITS-WEIGHT KGS
UNITS-BOLT-DIA MM
UNITS-BOLT-LENGTH MM
PIPELINE-REFERENCE <pipeline_ref>
    PROJECT-IDENTIFIER P1
    AREA A1

<COMPONENT BLOCK 1>
<COMPONENT BLOCK 2>
...
```

### 1.1 Header Section (Rows 1–7 in Data Table)

| # | Type | TEXT | Notes |
|---|------|------|-------|
| 1 | ISOGEN-FILES | ISOGEN.FLS | Fixed |
| 2 | UNITS-BORE | MM | Fixed |
| 3 | UNITS-CO-ORDS | MM | Fixed |
| 4 | UNITS-WEIGHT | KGS | Fixed |
| 5 | UNITS-BOLT-DIA | MM | Fixed |
| 6 | UNITS-BOLT-LENGTH | MM | Fixed |
| 7 | PIPELINE-REFERENCE | *(see §2)* | Derived |

### 1.2 Component Block Pattern

```
MESSAGE-SQUARE
    <one-liner comment text>
<COMPONENT_KEYWORD>
    <geometry lines>
    <SKEY line>           ← angle-bracket syntax
    <CA lines>            ← optional
```

**Rule:** Every component row in the Data Table produces exactly **one MESSAGE-SQUARE block + one COMPONENT block** — including SUPPORT (see §12).

---

## 2. PIPELINE-REFERENCE LOGIC

The `PIPELINE-REFERENCE` value is determined by priority:

1. **If Line Number is available** in the Data Table (column `PIPELINE-REFERENCE`): Use it directly with `export` prefix → `export <LineNo>`
2. **Fallback:** Use the source **filename without extension** → `export <filename_without_ext>`

```
PIPELINE-REFERENCE export 12-HC-1234-1A1-N
    PROJECT-IDENTIFIER P1
    AREA A1
```

**Note:** `PIPELINE-REFERENCE` also appears as a sub-line within PIPE component blocks — see §5.3.

---

## 3. MESSAGE-SQUARE — UNIVERSAL COMMENT SYNTAX

Each component (including SUPPORT) is preceded by a `MESSAGE-SQUARE` block.

### 3.1 Generic Syntax (Non-SUPPORT Components)

```
MESSAGE-SQUARE
    <Type>, <Material>, LENGTH=<Len>MM, <Direction>, RefNo:=<RefNo>, SeqNo:<SeqNo>[, BrLen=<BrLen>MM][, Bore=<Bore>]
```

| Token | Source Column | Include When |
|-------|-------------|--------------|
| `Type` | Type (col 2) | Always |
| `Material` | CA 3 (col 16) | If non-blank |
| `LENGTH=<val>MM` | LEN 1/2/3 (first non-zero) | If any LEN is non-zero |
| `Direction` | AXIS 1/2/3 (matching LEN) | If LEN is non-zero |
| `RefNo:=<val>` | CA 97, fallback REF NO. | Always |
| `SeqNo:<val>` | CA 98, fallback CSV SEQ NO | Always |
| `BrLen=<val>MM` | BRLEN (col 33) | Only for TEE/OLET |
| `Bore=<val>` | BORE (col 6) | Only for REDUCER (both bores) |

**Omission rule:** If a heading's data is blank/zero/NaN, skip that token entirely.

### 3.2 SUPPORT MESSAGE-SQUARE Syntax

```
MESSAGE-SQUARE
    SUPPORT, RefNo:=<RefNo>, SeqNo:<SeqNo>, <SUPPORT_NAME>, <SUPPORT_GUID>
```

For SUPPORT: `Material`, `LENGTH`, and `Direction` tokens are **not applicable** — omit them. Include only Type, RefNo, SeqNo, SUPPORT_NAME, and SUPPORT_GUID.

### 3.3 Direction Mapping (Axis Values)

| Delta Sign | Axis | Direction Label |
|-----------|------|----------------|
| ΔX > 0 | X | EAST |
| ΔX < 0 | X | WEST |
| ΔY > 0 | Y | NORTH |
| ΔY < 0 | Y | SOUTH |
| ΔZ > 0 | Z | UP |
| ΔZ < 0 | Z | DOWN |

---

## 4. COMPONENT KEYWORD MAPPING

**All lookups are CASE-INSENSITIVE.** Normalize input to uppercase before matching.

| PCF Keyword | Data Table Type Code | CSV Type Codes |
|-------------|---------------------|----------------|
| PIPE | PIPE | BRAN, PIPE |
| BEND | BEND | ELBO, BEND |
| TEE | TEE | TEE |
| FLANGE | FLANGE | FLAN |
| VALVE | VALVE | VALV |
| OLET | OLET | OLET |
| REDUCER-CONCENTRIC | REDUCER-CONCENTRIC | REDC, REDU |
| REDUCER-ECCENTRIC | REDUCER-ECCENTRIC | REDE |
| SUPPORT | SUPPORT | ANCI, SUPPORT |

```python
def map_to_pcf_keyword(type_code):
    key = type_code.strip().upper()
    mapping = {
        "PIPE": "PIPE", "BRAN": "PIPE",
        "BEND": "BEND", "ELBO": "BEND",
        "TEE": "TEE",
        "FLANGE": "FLANGE", "FLAN": "FLANGE",
        "VALVE": "VALVE", "VALV": "VALVE",
        "OLET": "OLET",
        "REDC": "REDUCER-CONCENTRIC", "REDU": "REDUCER-CONCENTRIC",
        "REDE": "REDUCER-ECCENTRIC",
        "ANCI": "SUPPORT", "SUPPORT": "SUPPORT",
    }
    return mapping.get(key, None)  # None = unknown type, flag warning
```

---

## 5. GEOMETRY LINES — PER COMPONENT

### 5.1 Coordinate Token Format — DECIMAL CONSISTENCY RULE

Every coordinate line outputs **4 space-separated tokens**: `X  Y  Z  Bore`

**CRITICAL: Bore MUST use the same decimal precision as X, Y, Z.** Either ALL `.1` or ALL `.4`.

| Precision Mode | Example |
|---------------|---------|
| 4-decimal | `96400.0000 17986.4000 101968.0000 400.0000` |
| 1-decimal | `96400.0 17986.4 101968.0 400.0` |

Global config — once chosen, applies everywhere.

### 5.2 Zero-Coordinate Prohibition

**NO spatial coordinate (X, Y, Z) in any EP, CP, BP, or CO-ORDS may be (0, 0, 0).**

Individual axes CAN be zero (e.g., `(0, 5000, 3000)` is valid). Only all-three-zero is prohibited.

### 5.3 Component Geometry Templates

#### PIPE / BRANCH PIPE

```
PIPE
    END-POINT    96400.0000 17840.4000 101968.0000 400.0000
    END-POINT    96400.0000 17186.4000 101968.0000 400.0000
    PIPELINE-REFERENCE export 12-HC-1234-1A1-N
```

- Two END-POINT lines.
- **`PIPELINE-REFERENCE`** is applicable to PIPE only — populate **only if available** in the Data Table or imported data. If not available, omit the line entirely.
- No `<SKEY>` (unless overridden).
- No CA8 (weight) for pipes.

#### FLANGE

```
FLANGE
    END-POINT    96400.0000 17986.4000 101968.0000 400.0000
    END-POINT    96400.0000 17840.4000 101968.0000 400.0000
    <SKEY>  FLWN
```

#### VALVE

```
VALVE
    END-POINT    96400.0000 16586.4000 102619.0000 350.0000
    END-POINT    96400.0000 16586.4000 103384.0000 350.0000
    <SKEY>  VBFL
```

#### BEND / ELBOW

```
BEND
    END-POINT    96400.0000 16586.4000 103827.0000 350.0000
    END-POINT    95867.0000 16586.4000 104360.0000 350.0000
    CENTRE-POINT 96400.0000 16586.4000 104360.0000 350.0000
    <SKEY>  BEBW
```

- **CP must NOT equal EP1 or EP2.**
- CP bore must match EP bore.

#### TEE

```
TEE
    END-POINT     96400.0000 16891.4000 101968.0000 400.0000
    END-POINT     96400.0000 16281.4000 101968.0000 400.0000
    CENTRE-POINT  96400.0000 16586.4000 101968.0000 400.0000
    BRANCH1-POINT 96400.0000 16586.4000 102273.0000 350.0000
    <SKEY>  TEBW
```

- **CP = midpoint(EP1, EP2).** CP bore = EP bore.

#### OLET

```
OLET
    CENTRE-POINT  50000.0000 12500.0000 8000.0000 400.0000
    BRANCH1-POINT 50000.0000 12500.0000 8180.0000 100.0000
    <SKEY>  OLWL
```

- **NO END-POINT lines.**

#### REDUCER-CONCENTRIC

```
REDUCER-CONCENTRIC
    END-POINT    96400.0000 17000.0000 101968.0000 400.0000
    END-POINT    96400.0000 16800.0000 101968.0000 350.0000
    <SKEY>  RCBW
```

#### REDUCER-ECCENTRIC

```
REDUCER-ECCENTRIC
    END-POINT    96400.0000 17000.0000 101968.0000 400.0000
    END-POINT    96400.0000 16800.0000 101968.0000 350.0000
    <SKEY>  REBW
    FLAT-DIRECTION  DOWN
```

#### SUPPORT

```
SUPPORT
    CO-ORDS    96400.0000 17186.4000 101968.0000 0.0000
    <SUPPORT_NAME>    CA150
    <SUPPORT_GUID>    UCI:PS00178.1
```

- Bore = `0` (formatted to match decimal precision).
- **NO CA lines.**
- `<SUPPORT_GUID>` prefix `UCI:` is **standard and mandatory**.
- See §12 for full SUPPORT config rules.

### 5.4 BEND Special Attributes

| Attribute | Rule |
|-----------|------|
| ANGLE | If `angleFormat = "hundredths"` → degrees × 100 integer. If `"degrees"` (default) → decimal. |
| BEND-RADIUS | From CSV/config Radius column if available. |

---

## 6. COMPONENT-ATTRIBUTE (CA) LINES

### 6.1 CA Definitions

| CA# | Content | Unit Pattern | Example |
|-----|---------|-------------|---------|
| CA1 | Design Pressure | `<val> KPA` | `700 KPA` |
| CA2 | Design Temperature | `<val> C` | `120 C` |
| CA3 | Material Grade | plain text | `A106-B` |
| CA4 | Wall Thickness | `<val> MM` | `9.53 MM` |
| CA5 | Corrosion Allowance | `<val> MM` | `0 MM` |
| CA6 | Insulation Density | `<val> KG/M3` | `210 KG/M3` |
| CA7 | (User-defined) | varies | — |
| CA8 | Component Weight | `<val> KG` | `100 KG` |
| CA9 | Fluid Density | `<val> KG/M3` | `1000 KG/M3` |
| CA10 | Test Pressure | `<val> KPA` | `1500 KPA` |
| CA97 | Reference Number | `=<RefNo>` | `=67130482/1666` |
| CA98 | Sequence Number | plain number | `4` |

### 6.2 CA Rules

1. **CA1–CA10 are NOT mandatory.** If blank, omit the line.
2. **CA97/CA98** fallback: CA97→REF NO., CA98→CSV SEQ NO.
3. **CA8** only for FLANGE, VALVE, fittings. Never PIPE or SUPPORT.
4. **SUPPORT has NO CA lines at all.**

---

## 7. `<SKEY>` RULES

PCF keyword is `<SKEY>` (with angle brackets).

| Component | Mandatory? | Common Values |
|-----------|-----------|---------------|
| PIPE | No | — |
| FLANGE | Yes | FLWN, FLSO, FLBL, FLLJ |
| VALVE | Yes | VBFL, VGAT, VGLB, VCHK, VBAL |
| BEND | Yes | BEBW, BESW |
| TEE | Yes | TEBW, TESW |
| OLET | Yes | OLWL, OLSO |
| REDUCER-C | Yes | RCBW |
| REDUCER-E | Yes | REBW |
| SUPPORT | No | — |

---

## 8. FORMULAS — CALCULATED COLUMNS

### 8.1 LEN and AXIS from Coordinates

```
DELTA_X = EP2.x - EP1.x    →  LEN1 = DELTA_X (if ≠ 0), AXIS1 = East/West
DELTA_Y = EP2.y - EP1.y    →  LEN2 = DELTA_Y (if ≠ 0), AXIS2 = North/South
DELTA_Z = EP2.z - EP1.z    →  LEN3 = DELTA_Z (if ≠ 0), AXIS3 = Up/Down
```

### 8.2 BI-DIRECTIONAL CALCULATION (EP ↔ LEN ↔ DELTA)

**Any one of the three sets can derive the other two:**

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ EP1, EP2 │ ──► │ DELTA_X  │ ──► │ LEN1     │
│          │ ◄── │ DELTA_Y  │ ◄── │ AXIS1    │
│          │     │ DELTA_Z  │     │ LEN2...  │
└──────────┘     └──────────┘     └──────────┘
```

**Path A: EPs available → Calculate DELTA and LEN/AXIS**

```python
delta_x = EP2.x - EP1.x
delta_y = EP2.y - EP1.y
delta_z = EP2.z - EP1.z

LEN1 = delta_x if delta_x != 0 else None
AXIS1 = "East" if delta_x > 0 else "West" if delta_x < 0 else None
# Same for LEN2/AXIS2 (Y) and LEN3/AXIS3 (Z)
```

**Path B: DELTA available → Calculate LEN/AXIS and EPs**

```python
LEN1 = delta_x  # (signed)
AXIS1 = "East" if delta_x > 0 else "West" if delta_x < 0 else None

# EPs via chaining (first element starts at origin or given start):
EP2.x = EP1.x + delta_x
EP2.y = EP1.y + delta_y
EP2.z = EP1.z + delta_z
```

**Path C: LEN/AXIS available → Calculate DELTA and EPs**

```python
def axis_to_sign(axis):
    return {"East":+1, "West":-1, "North":+1, "South":-1, "Up":+1, "Down":-1}[axis]

delta_x = abs(LEN1) * axis_to_sign(AXIS1) if LEN1 else 0
delta_y = abs(LEN2) * axis_to_sign(AXIS2) if LEN2 else 0
delta_z = abs(LEN3) * axis_to_sign(AXIS3) if LEN3 else 0

EP2 = (EP1.x + delta_x, EP1.y + delta_y, EP1.z + delta_z)
```

**Chaining for EP generation:** First element EP1 starts at origin `(0, 0, 0)` — *but only if no absolute coordinates are provided.* Each subsequent element's EP1 = previous element's EP2 (elemental connectivity).

### 8.3 BRLEN (Branch Length for TEE/OLET)

```
BRLEN = magnitude(BP - CP)
      = sqrt((bp_x - cp_x)² + (bp_y - cp_y)² + (bp_z - cp_z)²)
```

**If BRLEN is missing, use the dimension database fallback — see §9A.**

### 8.4 DIAMETER and WALL_THICK

```
DIAMETER = BORE (column 6)
WALL_THICK = CA4 (column 17)
```

### 8.5 Pointer Columns (BEND_PTR, RIGID_PTR, INT_PTR)

| Pointer | Increments When To-Component Is |
|---------|-------------------------------|
| BEND_PTR | BEND |
| RIGID_PTR | FLANGE or VALVE |
| INT_PTR | TEE or OLET |

---

## 9. FALLBACK RULES

### 9.1 Centre-Point (CP) Fallback

**TEE:** `CP = midpoint(EP1, EP2)`. CP bore = EP bore.
**BEND:** Requires bend radius — see §10.5.4. Cannot use midpoint.

### 9.2 Branch-Point (BP) Fallback

`BP = CP + BRLEN * direction_unit_vector`

If BRLEN missing → use §9A database. If direction unknown → flag incomplete.

### 9.3 OLET CP/BP Fallback

CP = point on parent pipe axis. CP bore = parent pipe bore.
BP bore = olet branch bore from Data Table.

### 9.4 Bore Fallback for CP

`CP_bore = EP1_bore` (for both BEND and TEE).

### 9.5 REF NO. / CA97 / CA98 Fallback

```
CA97 → REF NO. → "<PipelineRef>_<RowNumber>"
CA98 → CSV SEQ NO → running row counter
REF NO. → if blank, use CSV SEQ NO
```

### 9.6 Branch Bore Fallback

**When branch bore is unavailable or undetectable:**

| Component | Fallback Rule |
|-----------|--------------|
| TEE | Branch bore = Header bore (equal tee assumed) |
| OLET | Branch bore = 50 mm (default minimum) |

---

## 9A. BRLEN FALLBACK DATABASE (Config Tab)

When BRLEN is not available in the Data Table, look up from these standard dimension tables. All values stored in Config as editable tables.

### 9A.1 Equal Tee — ASME B16.9 (BRLEN = M)

Source: ASME B16.9 Straight Tee Dimensions

`BRLEN = M` (Centre-to-End, Outlet) in mm.

| NPS (inch) | Bore (mm) | OD (mm) | C (mm) | **M (mm)** |
|-----------|----------|--------|--------|-----------|
| 1/2 | 15 | 21.3 | 25 | **25** |
| 3/4 | 20 | 26.7 | 29 | **29** |
| 1 | 25 | 33.4 | 38 | **38** |
| 1-1/4 | 32 | 42.2 | 48 | **48** |
| 1-1/2 | 40 | 48.3 | 57 | **57** |
| 2 | 50 | 60.3 | 64 | **64** |
| 2-1/2 | 65 | 73.0 | 76 | **76** |
| 3 | 80 | 88.9 | 86 | **86** |
| 3-1/2 | 90 | 101.6 | 95 | **95** |
| 4 | 100 | 114.3 | 105 | **105** |
| 5 | 125 | 141.3 | 124 | **124** |
| 6 | 150 | 168.3 | 143 | **143** |
| 8 | 200 | 219.1 | 178 | **178** |
| 10 | 250 | 273.1 | 216 | **216** |
| 12 | 300 | 323.9 | 254 | **254** |
| 14 | 350 | 355.6 | 279 | **279** |
| 16 | 400 | 406.4 | 305 | **305** |
| 18 | 450 | 457.2 | 343 | **343** |
| 20 | 500 | 508.0 | 381 | **381** |
| 24 | 600 | 610.0 | 432 | **432** |
| 30 | 750 | 762.0 | 559 | **559** |
| 36 | 900 | 914.0 | 660 | **660** |
| 42 | 1050 | 1067.0 | 762 | **762** |
| 48 | 1200 | 1219.0 | 864 | **864** |

**Lookup logic:** Match on header bore (NPS). For equal tee, `M = BRLEN`. For reducing tee, M varies — use reducing tee table below.

### 9A.2 Reducing Tee — ASME B16.9 (BRLEN = M)

For reducing tees, M depends on both header size and branch size. Representative values (mm):

| Header NPS | Branch NPS | **M (mm)** |
|-----------|-----------|-----------|
| 4 × 4 × 3 | 4 / 3 | **102** |
| 4 × 4 × 2 | 4 / 2 | **95** |
| 6 × 6 × 4 | 6 / 4 | **130** |
| 6 × 6 × 3 | 6 / 3 | **124** |
| 8 × 8 × 6 | 8 / 6 | **168** |
| 8 × 8 × 4 | 8 / 4 | **156** |
| 10 × 10 × 8 | 10 / 8 | **206** |
| 10 × 10 × 6 | 10 / 6 | **194** |
| 12 × 12 × 10 | 12 / 10 | **244** |
| 12 × 12 × 8 | 12 / 8 | **232** |
| 12 × 12 × 6 | 12 / 6 | **219** |
| 14 × 14 × 10 | 14 / 10 | **264** |
| 14 × 14 × 8 | 14 / 8 | **254** |
| 16 × 16 × 12 | 16 / 12 | **295** |
| 16 × 16 × 10 | 16 / 10 | **283** |
| 18 × 18 × 14 | 18 / 14 | **330** |
| 18 × 18 × 12 | 18 / 12 | **321** |
| 20 × 20 × 16 | 20 / 16 | **368** |
| 20 × 20 × 14 | 20 / 14 | **356** |
| 24 × 24 × 20 | 24 / 20 | **419** |
| 24 × 24 × 16 | 24 / 16 | **406** |

**Config note:** This table is editable in the Config tab. Users can add project-specific sizes.

### 9A.3 Weldolet — Schedule STD Dimensions (BRLEN Formula)

Source: MSS SP-97 / Manufacturer standards

**Formula:** `BRLEN = A + 0.5 × Header_Bore_OD`

Where `A` = height of weldolet (from pipe surface to branch end).

| Header NPS | Branch NPS | A (mm) | Header OD (mm) | **BRLEN (mm)** |
|-----------|-----------|--------|---------------|----------------|
| 2 | 3/4 | 38.1 | 60.3 | **68.3** |
| 2 | 1 | 38.1 | 60.3 | **68.3** |
| 3 | 1 | 44.4 | 88.9 | **88.9** |
| 3 | 1-1/2 | 44.4 | 88.9 | **88.9** |
| 3 | 2 | 50.8 | 88.9 | **95.3** |
| 4 | 1 | 50.8 | 114.3 | **108.0** |
| 4 | 1-1/2 | 50.8 | 114.3 | **108.0** |
| 4 | 2 | 57.2 | 114.3 | **114.4** |
| 4 | 3 | 63.5 | 114.3 | **120.7** |
| 6 | 1 | 57.2 | 168.3 | **141.4** |
| 6 | 2 | 63.5 | 168.3 | **147.7** |
| 6 | 3 | 76.2 | 168.3 | **160.4** |
| 6 | 4 | 82.6 | 168.3 | **166.8** |
| 8 | 2 | 69.8 | 219.1 | **179.4** |
| 8 | 3 | 82.6 | 219.1 | **192.2** |
| 8 | 4 | 88.9 | 219.1 | **198.5** |
| 8 | 6 | 101.6 | 219.1 | **211.2** |
| 10 | 2 | 76.2 | 273.1 | **212.8** |
| 10 | 3 | 88.9 | 273.1 | **225.5** |
| 10 | 4 | 95.2 | 273.1 | **231.8** |
| 10 | 6 | 108.0 | 273.1 | **244.6** |
| 10 | 8 | 127.0 | 273.1 | **263.6** |
| 12 | 2 | 82.6 | 323.9 | **244.6** |
| 12 | 3 | 95.2 | 323.9 | **257.2** |
| 12 | 4 | 101.6 | 323.9 | **263.6** |
| 12 | 6 | 114.3 | 323.9 | **276.3** |
| 12 | 8 | 133.4 | 323.9 | **295.4** |
| 12 | 10 | 152.4 | 323.9 | **314.4** |
| 14 | 3 | 101.6 | 355.6 | **279.4** |
| 14 | 4 | 108.0 | 355.6 | **285.8** |
| 14 | 6 | 120.6 | 355.6 | **298.4** |
| 14 | 8 | 139.7 | 355.6 | **317.5** |
| 14 | 10 | 158.8 | 355.6 | **336.6** |
| 16 | 3 | 108.0 | 406.4 | **311.2** |
| 16 | 4 | 114.3 | 406.4 | **317.5** |
| 16 | 6 | 127.0 | 406.4 | **330.2** |
| 16 | 8 | 146.0 | 406.4 | **349.2** |
| 16 | 10 | 165.1 | 406.4 | **368.3** |
| 16 | 12 | 184.2 | 406.4 | **387.4** |

**Lookup logic:**

```python
def weldolet_brlen(header_nps, branch_nps, config_table):
    """Look up A from config table, compute BRLEN."""
    row = config_table.lookup(header_nps, branch_nps)
    if row:
        return row.A + 0.5 * row.header_OD
    else:
        # Interpolation or flag as missing
        return None
```

### 9A.4 BRLEN Fallback Priority

```
1. BRLEN from Data Table (direct value)
2. BRLEN calculated from BP − CP coordinates
3. TEE: Look up M from §9A.1 (equal) or §9A.2 (reducing)
4. OLET: Calculate A + 0.5 × Header OD from §9A.3
5. If all fail → flag as incomplete data
```

---

## 10. SMART PARSER — BI-DIRECTIONAL SYNC

### 10.1 Mode A: EP1/EP2 Available → Calculate LEN/AXIS/Delta

See §8.2 Path A.

### 10.2 Mode B: Delta Available → Calculate LEN/AXIS and EPs

See §8.2 Path B.

### 10.3 Mode C: LEN/AXIS Available → Calculate DELTA and EPs

See §8.2 Path C.

### 10.4 Elemental Connectivity (Chaining Rule)

**Rule:** EP1[current] = EP2[previous connected element].

**TEE branching:**

```
TEE.BP  →  next_branch_pipe.EP1
TEE.EP2 →  next_header_pipe.EP1
```

### 10.5 CP/BP Calculation for TEE/BEND/OLET — WITH WORKED EXAMPLES

*(Retained from v1.1 — see full worked examples in §10.5.1 through §10.5.4 of v1.1)*

#### 10.5.1 TEE — CP = midpoint(EP1, EP2)

```
CP = ((EP1.x+EP2.x)/2, (EP1.y+EP2.y)/2, (EP1.z+EP2.z)/2)
CP_bore = EP1_bore
```

**Example:**

```
EP1 = (96400.0, 16891.4, 101968.0) Bore=400
EP2 = (96400.0, 16281.4, 101968.0) Bore=400
CP  = (96400.0, 16586.4, 101968.0) Bore=400 ✓
```

#### 10.5.2 TEE/OLET — BP Estimation

BP = CP + BRLEN × branch_unit_vector (perpendicular to header).

| Branch Direction | BP Calculation |
|-----------------|----------------|
| East (+X) | `BP = (CP.x + BRLEN, CP.y, CP.z)` |
| West (−X) | `BP = (CP.x − BRLEN, CP.y, CP.z)` |
| North (+Y) | `BP = (CP.x, CP.y + BRLEN, CP.z)` |
| South (−Y) | `BP = (CP.x, CP.y − BRLEN, CP.z)` |
| Up (+Z) | `BP = (CP.x, CP.y, CP.z + BRLEN)` |
| Down (−Z) | `BP = (CP.x, CP.y, CP.z − BRLEN)` |

**Example — branch Up, BRLEN=305:**

```
CP = (96400.0, 16586.4, 101968.0)
BP = (96400.0, 16586.4, 102273.0)  Bore=350 ✓
```

#### 10.5.3 OLET — CP from parent pipe, BP via BRLEN

```
CP = tap point on parent pipe axis, Bore = parent bore
BP = CP + BRLEN × branch_direction, Bore = branch bore (default 50 if unknown)
```

#### 10.5.4 BEND — CP at corner intersection

For 90° bends: CP shares one coord with EP1 and another with EP2.

```
EP1=(96400.0, 16586.4, 103827.0), EP2=(95867.0, 16586.4, 104360.0)
Incoming: +Z, Outgoing: −X
CP.x = EP1.x = 96400.0
CP.z = EP2.z = 104360.0
CP.y = EP1.y = 16586.4
CP = (96400.0, 16586.4, 104360.0)  R=533 ✓
```

**Validation:** dist(CP,EP1) = dist(CP,EP2) = bend_radius.

---

## 11. REDUCER DETECTION LOGIC

```python
def detect_reducer(bore1, bore2, csv_type):
    if bore1 == bore2: return "DATA_ERROR"
    key = csv_type.strip().upper()
    if key in ("REDE",): return "REDUCER-ECCENTRIC"
    return "REDUCER-CONCENTRIC"
```

---

## 12. SUPPORT BLOCK RULES

### 12.1 SUPPORT PCF Output

SUPPORT **does** get a MESSAGE-SQUARE block (unlike v1.0/v1.1):

```
MESSAGE-SQUARE
    SUPPORT, RefNo:=67130482/SP001, SeqNo:13, CA150, UCI:PS00178.1
SUPPORT
    CO-ORDS    96400.0000 17186.4000 101968.0000 0.0000
    <SUPPORT_NAME>    CA150
    <SUPPORT_GUID>    UCI:PS00178.1
```

### 12.2 MESSAGE-SQUARE for SUPPORT

Uses the universal syntax minus the inapplicable tokens:

```
MESSAGE-SQUARE
    SUPPORT, RefNo:=<RefNo>, SeqNo:<SeqNo>, <SUPPORT_NAME_Value>, <SUPPORT_GUID_Value>
```

**NOT included:** Material, LENGTH, Direction (not applicable to a point restraint).

### 12.3 SUPPORT Mapping Logic (Config Tab)

The Config tab controls how `<SUPPORT_NAME>` and `<SUPPORT_GUID>` are derived from the Data Table's Friction and Gap properties.

**Config Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  SUPPORT MAPPING CONFIGURATION                          │
├─────────────────────────────────────────────────────────┤
│  GUID Source Column:   [SUPPORT GUID]  ← editable       │
│  GUID Prefix:          UCI:            ← mandatory       │
│  Fallback Name:        RST             ← editable        │
├─────────────────────────────────────────────────────────┤
│  MAPPING BLOCKS:                                         │
│                                                          │
│  Block 1: Friction = Empty or 0.3  AND  Gap = Empty      │
│    → <SUPPORT_NAME> = "ANC"  (Anchor)                    │
│    → <SUPPORT_GUID> = UCI:<NodeName>                     │
│                                                          │
│  Block 2: Friction = 0.15                                │
│    → <SUPPORT_NAME> = "GDE"  (Guide)                     │
│    → <SUPPORT_GUID> = UCI:<NodeName>                     │
│                                                          │
│  Block 3: Friction = 0.3  AND  Gap > 0                   │
│    → <SUPPORT_NAME> = "RST"  (Restraint with Gap)        │
│    → <SUPPORT_GUID> = UCI:<NodeName>                     │
│                                                          │
│  Fallback (no match):                                    │
│    → <SUPPORT_NAME> = config.fallback_name ("RST")       │
│    → <SUPPORT_GUID> = UCI:<NodeName>                     │
└─────────────────────────────────────────────────────────┘
```

**Mapping Pseudocode:**

```python
def resolve_support(friction, gap, node_name, config):
    guid = f"UCI:{node_name}"  # Prefix always "UCI:"
    
    if (friction is None or friction == "" or friction == 0.3) and (gap is None or gap == ""):
        name = "ANC"
    elif friction == 0.15:
        name = "GDE"
    elif friction == 0.3 and gap is not None and float(gap) > 0:
        name = "RST"
    else:
        name = config.support_fallback_name  # default "RST"
    
    return name, guid
```

**All mapping blocks, fallback name, and GUID prefix are editable in Config.**

### 12.4 SUPPORT Key Differences Summary

| Feature | Other Components | SUPPORT |
|---------|-----------------|---------|
| Geometry | Element (2+ points) | **Single point (CO-ORDS)** |
| Bore | Actual | **Always 0** |
| CA lines | Optional | **NONE** |
| MESSAGE-SQUARE | Yes (with Material/Length) | **Yes (without Material/Length)** |
| `<SUPPORT_GUID>` prefix | N/A | **UCI: (mandatory)** |

---

## 13. DATA TABLE COLUMN REFERENCE — WITH ALIASES AND SMART RULES

### 13.1 Column Alias System (Config Tab)

Each column has a canonical name and a list of **aliases** for fuzzy header matching. All aliases are **editable in Config**.

| Col | Canonical Name | Default Aliases (Config — Editable) | Smart Rule |
|-----|---------------|-------------------------------------|------------|
| 0 | # | `#, Row, Row No, RowNo, Row Number, SN, S.N., S.No, S No` | Optional |
| 1 | CSV SEQ NO | `CSV SEQ NO, SEQ NO, Seq No, SL.NO, Sl No, SL NO, SeqNo, Seq, Sequence, Sequence No, Item No` | If blank → use running row number |
| 2 | Type | `Type, Component, Comp Type, CompType, Component Type, Fitting, Item` | **Mandatory** |
| 3 | TEXT | `TEXT, Text, Description, Desc, Comment, MSG` | If blank → auto-create from MESSAGE-SQUARE formula (§3) |
| 4 | PIPELINE-REFERENCE | `PIPELINE-REFERENCE, Pipeline Ref, Line No, Line Number, Line No., LineNo, PIPE, Pipe Line` | Header rows + PIPE component only. Use if matched. |
| 5 | REF NO. | `REF NO., Ref No, RefNo, Reference No, Reference Number, Ref, Tag No, TagNo` | If blank → use CSV SEQ NO |
| 6 | BORE | `BORE, Bore, NPS, Nominal Bore, Dia, Diameter, Size, Pipe Size, DN` | **Mandatory.** Ensure mm unit — if `≤ 48` and appears to be inches, convert: `bore_mm = bore_in × 25.4` |
| 7 | EP1 COORDS | `EP1 COORDS, EP1, Start Point, From, From Coord, Start Coord, EP1_X EP1_Y EP1_Z` | If blank but LEN/DELTA available → calculate (§8.2). First element at `(0,0,0)` for delta-only input. |
| 8 | EP2 COORDS | `EP2 COORDS, EP2, End Point, To, To Coord, End Coord, EP2_X EP2_Y EP2_Z` | Same derivation logic as EP1 |
| 9 | CP COORDS | `CP COORDS, CP, Centre Point, Center Point, Centre, Center, CenterPt` | Mandatory for TEE/BEND |
| 10 | BP COORDS | `BP COORDS, BP, Branch Point, Branch, Branch1, BranchPt` | Mandatory for TEE/OLET |
| 11 | SKEY | `SKEY, Skey, S-Key, Component Key, Fitting Key` | Mandatory for FLANGE/VALVE/BEND/TEE/OLET/REDUCER |
| 12 | SUPPORT COOR | `SUPPORT COOR, Support Coord, Support Point, Restraint Coord, RestPt` | Mandatory for SUPPORT |
| 13 | SUPPORT GUID | `SUPPORT GUID, Support GUID, GUID, Node Name, NodeName, UCI` | Optional |
| 14–23 | CA 1–10 | `CA1, CA 1, Attr1, Attribute 1, Attribute1, ...` (pattern for each) | Optional |
| 24 | CA 97 | `CA97, CA 97, Ref No Attr, RefAttr` | Fallback: = REF NO. |
| 25 | CA 98 | `CA98, CA 98, Seq No Attr, SeqAttr` | Fallback: = CSV SEQ NO |
| 26 | Fixing Action | `Fixing Action, Fix, Action, FixAction, Overlap, Gap Fill` | Optional |
| 27 | LEN 1 | `LEN 1, Len1, Length X, LenX, Dx, DX, Delta X, DeltaX` | Calculated. Bi-directional with EP/DELTA. |
| 28 | AXIS 1 | `AXIS 1, Axis1, Dir X, DirX, Direction X` | Calculated |
| 29–32 | LEN 2, AXIS 2, LEN 3, AXIS 3 | *(same pattern as LEN1/AXIS1 for Y and Z)* | Calculated |
| 33 | BRLEN | `BRLEN, BrLen, Branch Length, Branch Len, Br Len` | Calculated or from §9A database |
| 34–36 | DELTA_X/Y/Z | `DELTA_X, DeltaX, Delta X, Dx, dX, ...` | Bi-directional with EP/LEN |
| 37 | DIAMETER | `DIAMETER, Dia, OD, Outer Diameter` | = BORE |
| 38 | WALL_THICK | `WALL_THICK, Wall Thick, WT, Wall Thickness, Thk` | = CA4 |
| 39–41 | BEND_PTR, RIGID_PTR, INT_PTR | *(as named)* | Calculated counters |

### 13.2 Fuzzy Header Matching Logic

When importing an Excel file, the parser must match column headers to canonical names using fuzzy matching:

```python
import re
from difflib import SequenceMatcher

def normalize(text):
    """Lowercase, strip whitespace, remove special chars."""
    return re.sub(r'[^a-z0-9]', '', str(text).lower().strip())

def fuzzy_match_header(header_text, alias_config, threshold=0.75):
    """
    Match a header cell to a canonical column name.
    alias_config: dict of {canonical_name: [alias1, alias2, ...]}
    Returns: canonical_name or None
    """
    norm_header = normalize(header_text)
    
    # Pass 1: Exact match on normalized aliases
    for canonical, aliases in alias_config.items():
        for alias in aliases:
            if normalize(alias) == norm_header:
                return canonical
    
    # Pass 2: Substring containment
    for canonical, aliases in alias_config.items():
        for alias in aliases:
            norm_alias = normalize(alias)
            if norm_alias in norm_header or norm_header in norm_alias:
                return canonical
    
    # Pass 3: Fuzzy ratio (SequenceMatcher)
    best_match = None
    best_score = 0
    for canonical, aliases in alias_config.items():
        for alias in aliases:
            score = SequenceMatcher(None, norm_header, normalize(alias)).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = canonical
    
    return best_match  # None if no match above threshold
```

**Config display:** The alias list is shown in the Config tab as an editable table. Users can add project-specific short forms, alternative spellings, or different languages.

### 13.3 Bore Unit Detection and Conversion

```python
def ensure_bore_mm(bore_value, unit_hint=None):
    """
    If bore appears to be in inches (≤ 48 and not a standard mm value),
    convert to mm. Standard mm bores: 15, 20, 25, 32, 40, 50, 65, 80, 90,
    100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 750, 900, 1050, 1200
    """
    standard_mm = {15,20,25,32,40,50,65,80,90,100,125,150,200,250,300,
                   350,400,450,500,600,750,900,1050,1200}
    
    val = float(bore_value)
    
    if unit_hint == "in" or unit_hint == "inch":
        return val * 25.4
    
    if val <= 48 and val not in standard_mm:
        # Likely inches → convert
        return val * 25.4
    
    return val  # Already mm
```

### 13.4 EP/DELTA/LEN Bi-Directional Auto-Calculation

On import, the Smart Parser checks which data is available and fills the rest:

```python
def auto_calculate_coordinates(row, prev_ep2=None):
    """
    Given a row, determine what's available and compute the rest.
    Priority: EP1/EP2 > DELTA_X/Y/Z > LEN1+AXIS1 / LEN2+AXIS2 / LEN3+AXIS3
    """
    has_eps = row.EP1 is not None and row.EP2 is not None
    has_deltas = row.DELTA_X is not None  # at least one delta
    has_lens = row.LEN1 is not None or row.LEN2 is not None or row.LEN3 is not None
    
    if has_eps:
        # Path A: Calculate deltas and lens from EPs
        row.DELTA_X = row.EP2.x - row.EP1.x
        row.DELTA_Y = row.EP2.y - row.EP1.y
        row.DELTA_Z = row.EP2.z - row.EP1.z
        row.LEN1, row.AXIS1 = delta_to_len_axis(row.DELTA_X, "X")
        row.LEN2, row.AXIS2 = delta_to_len_axis(row.DELTA_Y, "Y")
        row.LEN3, row.AXIS3 = delta_to_len_axis(row.DELTA_Z, "Z")
    
    elif has_deltas:
        # Path B: Calculate EPs and lens from deltas
        row.EP1 = prev_ep2 if prev_ep2 else (0, 0, 0)
        row.EP2 = (row.EP1.x + (row.DELTA_X or 0),
                   row.EP1.y + (row.DELTA_Y or 0),
                   row.EP1.z + (row.DELTA_Z or 0))
        row.LEN1, row.AXIS1 = delta_to_len_axis(row.DELTA_X, "X")
        row.LEN2, row.AXIS2 = delta_to_len_axis(row.DELTA_Y, "Y")
        row.LEN3, row.AXIS3 = delta_to_len_axis(row.DELTA_Z, "Z")
    
    elif has_lens:
        # Path C: Calculate deltas and EPs from LEN/AXIS
        row.DELTA_X = len_axis_to_delta(row.LEN1, row.AXIS1)
        row.DELTA_Y = len_axis_to_delta(row.LEN2, row.AXIS2)
        row.DELTA_Z = len_axis_to_delta(row.LEN3, row.AXIS3)
        row.EP1 = prev_ep2 if prev_ep2 else (0, 0, 0)
        row.EP2 = (row.EP1.x + row.DELTA_X,
                   row.EP1.y + row.DELTA_Y,
                   row.EP1.z + row.DELTA_Z)

def delta_to_len_axis(delta, axis_label):
    if delta is None or delta == 0:
        return None, None
    axis_map = {"X": ("East","West"), "Y": ("North","South"), "Z": ("Up","Down")}
    pos, neg = axis_map[axis_label]
    return delta, pos if delta > 0 else neg

def len_axis_to_delta(length, axis):
    if length is None or axis is None:
        return 0
    sign = {"East":+1,"West":-1,"North":+1,"South":-1,"Up":+1,"Down":-1}
    return abs(length) * sign.get(axis, 0)
```

---

## 14. PCF GENERATION PSEUDOCODE

```python
def generate_pcf(data_table, config):
    lines = []
    dec = config.decimals  # 1 or 4
    
    # === HEADER ===
    lines.append("ISOGEN-FILES ISOGEN.FLS")
    lines.append("UNITS-BORE MM")
    lines.append("UNITS-CO-ORDS MM")
    lines.append("UNITS-WEIGHT KGS")
    lines.append("UNITS-BOLT-DIA MM")
    lines.append("UNITS-BOLT-LENGTH MM")
    lines.append(f"PIPELINE-REFERENCE {resolve_pipeline_ref(config)}")
    lines.append("    PROJECT-IDENTIFIER P1")
    lines.append("    AREA A1")
    lines.append("")
    
    for row in data_table.component_rows():
        comp_type = row.Type.strip().upper()
        
        # MESSAGE-SQUARE for ALL components (including SUPPORT)
        msg = build_message_square(row, comp_type)
        lines.append("MESSAGE-SQUARE  ")
        lines.append(f"    {msg}")
        
        if comp_type == "SUPPORT":
            name, guid = resolve_support(row.friction, row.gap, row.node_name, config)
            lines.append("SUPPORT")
            lines.append(f"    CO-ORDS    {fmt_coord(row.coor, 0, dec)}")
            lines.append(f"    <SUPPORT_NAME>    {name}")
            lines.append(f"    <SUPPORT_GUID>    {guid}")
            lines.append("")
            continue
        
        pcf_kw = map_to_pcf_keyword(comp_type)
        lines.append(pcf_kw)
        
        # GEOMETRY
        if comp_type == "OLET":
            lines.append(f"    CENTRE-POINT  {fmt_coord(row.CP, row.main_bore, dec)}")
            lines.append(f"    BRANCH1-POINT {fmt_coord(row.BP, row.branch_bore, dec)}")
        else:
            lines.append(f"    END-POINT    {fmt_coord(row.EP1, row.bore, dec)}")
            lines.append(f"    END-POINT    {fmt_coord(row.EP2, row.bore, dec)}")
            if comp_type in ("BEND", "TEE"):
                cp = row.CP if row.CP else calc_cp(row, comp_type)
                lines.append(f"    CENTRE-POINT  {fmt_coord(cp, row.bore, dec)}")
            if comp_type == "TEE":
                lines.append(f"    BRANCH1-POINT {fmt_coord(row.BP, row.branch_bore, dec)}")
        
        # PIPELINE-REFERENCE for PIPE only
        if comp_type == "PIPE" and row.pipeline_ref:
            lines.append(f"    PIPELINE-REFERENCE {row.pipeline_ref}")
        
        if row.skey:
            lines.append(f"    <SKEY>  {row.skey}")
        
        if comp_type == "BEND" and row.angle:
            lines.append(f"    ANGLE  {format_angle(row.angle, config.angleFormat)}")
        if comp_type == "BEND" and row.bend_radius:
            lines.append(f"    BEND-RADIUS  {row.bend_radius}")
        if comp_type == "REDUCER-ECCENTRIC" and row.flat_direction:
            lines.append(f"    FLAT-DIRECTION  {row.flat_direction}")
        
        for ca_num in [1,2,3,4,5,6,7,8,9,10,97,98]:
            val = row.get_ca(ca_num)
            if val is not None and val != "":
                lines.append(f"    COMPONENT-ATTRIBUTE{ca_num}    {val}")
        
        lines.append("")
    
    return "\r\n".join(lines)
```

---

## 15. COORDINATE FORMAT — SUMMARY

**Decimal consistency mandatory.** All X, Y, Z AND Bore use same precision.

| 4-decimal | `96400.0000 17986.4000 101968.0000 400.0000` |
|-----------|----------------------------------------------|
| 1-decimal | `96400.0 17986.4 101968.0 400.0` |

---

## 16. INDENT AND SPACING RULES

| Line Type | Indent |
|-----------|--------|
| Top-level keyword (PIPE, FLANGE, etc.) | 0 |
| Geometry lines (END-POINT, CENTRE-POINT, CO-ORDS) | 4 spaces |
| `<SKEY>`, ANGLE, BEND-RADIUS, FLAT-DIRECTION | 4 spaces |
| COMPONENT-ATTRIBUTE lines | 4 spaces |
| PIPELINE-REFERENCE (in PIPE block) | 4 spaces |
| PROJECT-IDENTIFIER, AREA | 4 spaces |
| MESSAGE-SQUARE text content | 4 spaces |
| SUPPORT sub-lines | 4 spaces |

**Line endings:** Windows CRLF (`\r\n`) always.

---

## 17. BEND ANGLE CALCULATION

```python
v1 = EP1 - CP
v2 = EP2 - CP
cos_angle = dot(v1, v2) / (mag(v1) * mag(v2))
angle_deg = acos(cos_angle) * 180 / pi

if config.angleFormat == "hundredths":
    output = int(angle_deg * 100)
else:  # "degrees" (default/CAESAR II)
    output = f"{angle_deg:.4f}"
```

---

## 18. VALIDATION CHECKLIST

| # | Check | Rule | Severity |
|---|-------|------|----------|
| V1 | **No (0,0,0) coords** | EP1, EP2, CP, BP, CO-ORDS — all three spatial values cannot be zero | ERROR |
| V2 | **Decimal consistency** | Every token (X, Y, Z, Bore) same precision | ERROR |
| V3 | **Bore consistency** | REDUCER: EP1_bore ≠ EP2_bore. Others: EP1_bore == EP2_bore | ERROR |
| V4 | **BEND: CP ≠ EP1** | Degenerate bend check | ERROR |
| V5 | **BEND: CP ≠ EP2** | Degenerate bend check | ERROR |
| V6 | **BEND: CP not collinear** | CP not on EP1–EP2 line | ERROR |
| V7 | **BEND: CP equidistant** | dist(CP,EP1) ≈ dist(CP,EP2) = R | WARNING |
| V8 | **TEE: CP = midpoint** | CP = (EP1+EP2)/2 | ERROR |
| V9 | **TEE: CP bore = EP bore** | Must match | ERROR |
| V10 | **TEE: BP perpendicular** | (BP−CP) ⊥ (EP2−EP1) | WARNING |
| V11 | **OLET: no EPs** | Must have CP+BP only | ERROR |
| V12 | **SUPPORT: no CAs** | CO-ORDS only, no COMPONENT-ATTRIBUTE | ERROR |
| V13 | **SUPPORT: bore = 0** | Formatted to decimal precision | ERROR |
| V14 | **`<SKEY>` presence** | Mandatory for FLANGE/VALVE/BEND/TEE/OLET/REDUCER | WARNING |
| V15 | **Coordinate continuity** | EP1[n] ≈ EP2[n-1] | WARNING |
| V16 | **CA8 scope** | Only FLANGE/VALVE. Never PIPE/SUPPORT | WARNING |
| V17 | **CRLF** | File uses `\r\n` throughout | ERROR |
| V18 | **Bore unit** | All bores in mm. Flag if ≤ 48 and not standard mm | WARNING |
| V19 | **SUPPORT MESSAGE-SQUARE** | Must be present, must not contain Material/Length/Direction | WARNING |
| V20 | **GUID prefix** | `<SUPPORT_GUID>` must start with `UCI:` | ERROR |

---

## 19. QUICK REFERENCE — BLOCK TEMPLATES

### PIPE (with optional PIPELINE-REFERENCE)
```
MESSAGE-SQUARE
    PIPE, A106-B, LENGTH=654MM, SOUTH, RefNo:=67130482/1666_pipe, SeqNo:5
PIPE
    END-POINT    96400.0000 17840.4000 101968.0000 400.0000
    END-POINT    96400.0000 17186.4000 101968.0000 400.0000
    PIPELINE-REFERENCE export 12-HC-1234-1A1-N
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
    COMPONENT-ATTRIBUTE98    5
```

### FLANGE
```
MESSAGE-SQUARE
    FLANGE, A106-B, LENGTH=146MM, SOUTH, RefNo:=67130482/1666, SeqNo:4
FLANGE
    END-POINT    96400.0000 17986.4000 101968.0000 400.0000
    END-POINT    96400.0000 17840.4000 101968.0000 400.0000
    <SKEY>  FLWN
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
    COMPONENT-ATTRIBUTE8    100 KG
    ...
    COMPONENT-ATTRIBUTE98    4
```

### BEND
```
MESSAGE-SQUARE
    BEND, A106-B, LENGTH=754MM, UP, RefNo:=67130482/1164, SeqNo:33
BEND
    END-POINT    96400.0000 16586.4000 103827.0000 350.0000
    END-POINT    95867.0000 16586.4000 104360.0000 350.0000
    CENTRE-POINT 96400.0000 16586.4000 104360.0000 350.0000
    <SKEY>  BEBW
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
```

### TEE
```
MESSAGE-SQUARE
    TEE, A106-B, LENGTH=610MM, SOUTH, RefNo:=67130482/1667, SeqNo:7, BrLen=305MM
TEE
    END-POINT     96400.0000 16891.4000 101968.0000 400.0000
    END-POINT     96400.0000 16281.4000 101968.0000 400.0000
    CENTRE-POINT  96400.0000 16586.4000 101968.0000 400.0000
    BRANCH1-POINT 96400.0000 16586.4000 102273.0000 350.0000
    <SKEY>  TEBW
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
```

### OLET
```
MESSAGE-SQUARE
    OLET, A106-B, BrLen=180MM, UP, RefNo:=XXX, SeqNo:10
OLET
    CENTRE-POINT  50000.0000 12500.0000 8000.0000 400.0000
    BRANCH1-POINT 50000.0000 12500.0000 8180.0000 100.0000
    <SKEY>  OLWL
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
```

### REDUCER-CONCENTRIC
```
MESSAGE-SQUARE
    REDUCER-CONCENTRIC, A106-B, LENGTH=200MM, SOUTH, RefNo:=XXX, SeqNo:10, Bore=400/350
REDUCER-CONCENTRIC
    END-POINT    96400.0000 17000.0000 101968.0000 400.0000
    END-POINT    96400.0000 16800.0000 101968.0000 350.0000
    <SKEY>  RCBW
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
```

### REDUCER-ECCENTRIC
```
MESSAGE-SQUARE
    REDUCER-ECCENTRIC, A106-B, LENGTH=200MM, SOUTH, RefNo:=XXX, SeqNo:12, Bore=400/350
REDUCER-ECCENTRIC
    END-POINT    96400.0000 17000.0000 101968.0000 400.0000
    END-POINT    96400.0000 16800.0000 101968.0000 350.0000
    <SKEY>  REBW
    FLAT-DIRECTION  DOWN
    COMPONENT-ATTRIBUTE1    700 KPA
    ...
```

### SUPPORT (with MESSAGE-SQUARE)
```
MESSAGE-SQUARE
    SUPPORT, RefNo:=67130482/SP001, SeqNo:13, CA150, UCI:PS00178.1
SUPPORT
    CO-ORDS    96400.0000 17186.4000 101968.0000 0.0000
    <SUPPORT_NAME>    CA150
    <SUPPORT_GUID>    UCI:PS00178.1
```

---

## 20. MESSAGE-SQUARE FORMULA (MACHINE-PARSEABLE)

```python
def build_message_square(row, comp_type):
    tokens = []
    tokens.append(comp_type)
    
    if comp_type == "SUPPORT":
        # SUPPORT: no Material, Length, Direction
        ref = row.CA97 or row.REF_NO or ""
        seq = row.CA98 or row.CSV_SEQ_NO or ""
        if ref:   tokens.append(f"RefNo:{ref}")
        if seq:   tokens.append(f"SeqNo:{seq}")
        if row.support_name: tokens.append(row.support_name)
        if row.support_guid: tokens.append(row.support_guid)
        return ", ".join(tokens)
    
    # Non-SUPPORT components
    if row.CA3:       tokens.append(row.CA3)
    
    length = abs(row.LEN1 or row.LEN2 or row.LEN3 or 0)
    axis = row.AXIS1 or row.AXIS2 or row.AXIS3 or ""
    if length:        tokens.append(f"LENGTH={int(length)}MM")
    if axis:          tokens.append(axis.upper())
    
    ref = row.CA97 or row.REF_NO or ""
    seq = row.CA98 or row.CSV_SEQ_NO or ""
    if ref:           tokens.append(f"RefNo:{ref}")
    if seq:           tokens.append(f"SeqNo:{seq}")
    
    if row.BRLEN:     tokens.append(f"BrLen={int(abs(row.BRLEN))}MM")
    
    if "REDUCER" in comp_type and row.bore_large and row.bore_small:
        tokens.append(f"Bore={row.bore_large}/{row.bore_small}")
    
    if row.CA8:       tokens.append(f"Wt={row.CA8}")
    
    return ", ".join(tokens)
```

---

## 21. CONFIG TAB — SUMMARY OF EDITABLE SETTINGS

| Config Section | Key Settings |
|---------------|-------------|
| **General** | Decimal precision (1 or 4), Angle format (degrees/hundredths), CRLF mode |
| **Pipeline Ref** | Default filename, PROJECT-IDENTIFIER, AREA |
| **Column Aliases** | Full alias list per canonical column name (§13.1) |
| **Fuzzy Match** | Threshold (default 0.75), enable/disable passes |
| **SUPPORT Mapping** | Mapping blocks (Friction/Gap → Name), Fallback Name, GUID prefix ("UCI:") |
| **BRLEN Database** | Equal Tee M table (§9A.1), Reducing Tee M table (§9A.2), Weldolet A table (§9A.3) |
| **Branch Bore Fallback** | TEE default = header bore, OLET default = 50 mm |
| **Bore Unit** | Auto-detect inch vs mm, standard mm bore list |
| **Component Mapping** | Type code → PCF keyword (case-insensitive, §4) |

---

*End of PCF Syntax Master v1.2*


---

# ═══════════════════════════════════════════════════════════
# PART B — SMART FIXER RULES
# Source: Smart PCF Fixer — Chain Walker Rule Engine v1.0
# ═══════════════════════════════════════════════════════════

## 0. PURPOSE AND PHILOSOPHY

Traditional PCF fixers process coordinates point-by-point. They see numbers. They miss intent.

The Smart Fixer processes **element-by-element**, walking the piping route like a human engineer would — carrying forward the knowledge of which direction the pipe is traveling, what bore it is, what material it's made of, and what the last fitting was.

This document defines:

- **The Chain Walker** — the traversal engine that walks element chains.
- **60+ rules** organized into 9 categories.
- **4-tier auto-fix classification** — what gets fixed silently, what gets logged, what gets flagged.

**Core principle:** The program must think in **elements and routes**, not in **points and distances**.

---

## 1. CHAIN WALKER ARCHITECTURE

### 1.1 Why Walk, Not Scan

| Point-by-Point (Traditional) | Chain Walker (Smart Fixer) |
|------------------------------|---------------------------|
| Sees EP2 and EP1 as two coordinates | Sees "Pipe-5 exits South, Pipe-6 enters South" |
| Gap = distance between points | Gap = axial shortfall along travel direction |
| No concept of routing direction | Carries travel_axis and travel_direction |
| Cannot distinguish axial vs lateral gap | Decomposes gap relative to travel context |
| Treats all elements the same | Knows PIPE is flexible, fittings are rigid |
| Doesn't detect fold-back | Detects direction reversal on same axis |
| Handles branches confusingly | Forks cleanly at TEE, walks each branch |

### 1.2 The Walk Context Object

At every step of the walk, the walker carries a context:

```
WalkContext:
  travel_axis:      "X" | "Y" | "Z" | null
  travel_direction: +1 | -1 | null
  current_bore:     number (mm)
  current_material: string (CA3)
  current_pressure: string (CA1)
  current_temp:     string (CA2)
  chain_id:         string (header vs branch identifier)
  cumulative_vector: {x, y, z}  (running sum of all element vectors)
  pipe_length_sum:  number (total pipe length in chain so far)
  last_fitting_type: string (previous non-pipe component type)
  elevation:        number (current Z for horizontal runs)
  depth:            number (branch nesting level, 0=main header)
```

### 1.3 Building the Connectivity Graph

Before walking, construct the graph:

```
ALGORITHM: build_connectivity_graph(components)

Input:  Unordered list of parsed components
Output: Directed graph of element connections + list of chain start terminals

Step 1: INDEX all connection points
  For each component:
    - PIPE/FLANGE/VALVE/REDUCER: entry=EP1, exit=EP2
    - BEND:  entry=EP1, exit=EP2 (CP is internal, not a connection)
    - TEE:   entry=EP1, exit=EP2 (header), branch_exit=BP
    - OLET:  parent_attach=CP, branch_exit=BP (no entry/exit in header sense)
    - SUPPORT: position only, not a flow element

  Build spatial index:
    entry_map[snap(EP1)] → component  (for each component with EP1)

Step 2: MATCH exits to entries
  For each component's exit point (EP2, or BP for TEE branch):
    Search entry_map for nearest EP1 within tolerance (default 25mm)
    If found: create directed edge (current → next)
    If not found: mark as chain terminal (dead end or boundary)

Step 3: IDENTIFY chain start terminals
  Terminals are components whose EP1 has no incoming connection.
  Typical terminals: first flange, nozzle connection, open pipe end.
  
  Sort terminals by:
    1. Components with SKEY matching nozzle/flange patterns (preferred start)
    2. Components with lowest sequence number
    3. Components at extremes of coordinate space

Step 4: HANDLE TEE branching
  For each TEE:
    - Header connection: EP2 → next header element (already matched in Step 2)
    - Branch connection: BP → next branch element (match BP to entry_map)
    - Store branch_start as a deferred chain to walk later

Step 5: DETECT orphans
  Any component not reachable from any terminal → orphan element.
  Flag immediately.

Return: { graph, terminals, orphans, tee_branches }
```

### 1.4 The Walk Algorithm

```
ALGORITHM: walk_chain(start_terminal, graph, context)

Input:  Starting component, connectivity graph, initial WalkContext
Output: Ordered ChainLink list with gap analysis and fix actions

chain = []
current = start_terminal
visited = set()

WHILE current is not null AND current.id not in visited:
  
  visited.add(current.id)
  
  // ─── A. DETECT ELEMENT AXIS ───
  elem_axis, elem_dir = detect_element_axis(current)
  
  // ─── B. PRE-RULES: Check element itself ───
  Run element-level rules:
    R-GEO-01: Micro-element check (< 6mm)
    R-GEO-04: Fitting dimension sanity
    R-GEO-05: Bend radius sanity
    R-GEO-06: Valve face-to-face check
    R-DAT-01: Coordinate precision consistency
    R-DAT-02: Suspicious round numbers
  
  // ─── C. AXIS CONTINUITY CHECK ───
  IF context.travel_axis is set AND elem_axis is set:
    IF elem_axis != context.travel_axis:
      IF current.type NOT IN (BEND, TEE):
        Flag R-CHN-01: "Axis change without bend"
  
  // ─── D. BORE CONTINUITY CHECK ───
  IF current.bore != context.current_bore:
    IF previous element was NOT a REDUCER:
      Flag R-GEO-02: "Missing reducer"
  
  // ─── E. MATERIAL/DESIGN CONTINUITY ───
  Run continuity rules:
    R-DAT-03: Material continuity
    R-DAT-04: Design condition continuity
  
  // ─── F. UPDATE CONTEXT ───
  IF elem_axis:
    context.travel_axis = elem_axis
    context.travel_direction = elem_dir
  context.current_bore = current.bore (or EP2 bore for reducer)
  context.current_material = current.ca[3]
  context.cumulative_vector += element_vector(current)
  IF current.type == "PIPE":
    context.pipe_length_sum += element_length(current)
  IF current.type NOT IN ("PIPE", "SUPPORT"):
    context.last_fitting_type = current.type
  
  // ─── G. FIND NEXT ELEMENT ───
  next = graph.get_next(current)
  gap_vector = null
  IF next:
    gap_vector = next.entry_point - current.exit_point
  
  // ─── H. GAP/OVERLAP ANALYSIS ───
  fix_action = null
  IF gap_vector:
    fix_action = analyze_gap_with_context(
      gap_vector, context, current, next
    )
  
  // ─── I. RECORD CHAIN LINK ───
  chain.append(ChainLink(
    element = current,
    context_snapshot = copy(context),
    gap_to_next = gap_vector,
    fix_action = fix_action,
    next_element = next
  ))
  
  // ─── J. BRANCH HANDLING ───
  IF current.type == "TEE":
    branch_start = graph.get_branch(current)
    IF branch_start AND branch_start.id NOT IN visited:
      branch_context = copy(context)
      branch_context.travel_axis = detect_branch_axis(current)
      branch_context.travel_direction = detect_branch_direction(current)
      branch_context.current_bore = current.branchBore
      branch_context.depth += 1
      branch_context.chain_id = context.chain_id + ".B" + str(branch_count)
      
      branch_chain = walk_chain(branch_start, graph, branch_context)
      chain[-1].branch_chain = branch_chain
  
  // ─── K. ADVANCE ───
  current = next

END WHILE

// ─── L. POST-WALK AGGREGATE CHECKS ───
Run chain-level rules:
  R-AGG-01: Total pipe length sanity
  R-AGG-02: Minimum tangent between bends
  R-AGG-03: Route closure check
  R-AGG-04: Dead-end detection (on last element)
  R-AGG-05: Flange pair completeness

RETURN chain
```

### 1.5 The Complete Walk Sequence (Visualized)

For a typical pipeline:

```
MAIN WALK:

  Terminal → Flange-1 ──────────────────────────────── context: Y-axis, South
       │
       ▼
  Pipe-1 (654mm South) ────────────────────────────── check gap: 0mm ✓
       │
       ▼
  [SUPPORT noted at Y=17186.4] ────────────────────── R-SPA-03: on pipe axis? ✓
       │
       ▼
  Pipe-2 (295mm South) ────────────────────────────── check gap: 0mm ✓
       │
       ▼
  Tee-1 ───┬─── header continues South ────────────── context stays Y, South
            │
            └─── BRANCH FORK → queue branch walk
       │
       ▼  (header)
  Pipe-3 (500mm South) ────────────────────────────── check gap: 0mm ✓
       │
       ▼
  Flange-2 → Flange-3 → END ──────────────────────── R-AGG-04: flange terminal ✓
  
  
BRANCH WALK (from Tee-1 BP):

  context: Z-axis, Up, bore=350, depth=1

  Pipe-4 (505mm Up) ──────────────────────────────── same axis ✓
       │
       ▼
  Flange-4 (146mm Up) ────────────────────────────── R-TOP-04: paired? check
       │
       ▼
  Valve-1 (765mm Up) ─────────────────────────────── R-TOP-05: flanges on sides? ✓
       │
       ▼
  Flange-5 (143mm Up) ────────────────────────────── R-TOP-04: paired ✓
       │
       ▼
  Pipe-5 (150mm Up) → Pipe-6 (150mm Up) ──────────── R-SPA-04: collinear merge? 
       │
       ▼
  Bend-1 (turn Up→West) ──────────────────────────── axis change at bend ✓
       │                                               context → X-axis, West
       ▼
  Flange-6 (146mm West) → END ────────────────────── R-AGG-04: flange terminal ✓
```

---

## 2. RULE CATEGORIES

Rules are organized into 9 categories:

| Prefix | Category | Count |
|--------|----------|-------|
| R-GEO | Geometric Sanity | 8 rules |
| R-TOP | Topological Checks | 7 rules |
| R-CHN | Chain Continuity | 6 rules |
| R-GAP | Gap Analysis | 8 rules |
| R-OVR | Overlap Analysis | 6 rules |
| R-BRN | Branch-Specific | 5 rules |
| R-SPA | Spatial Reasoning | 5 rules |
| R-DAT | Data Quality | 6 rules |
| R-AGG | Chain Aggregate | 6 rules |

**Total: 57 rules**

---

## 3. GEOMETRIC SANITY RULES (R-GEO)

### R-GEO-01: Micro-Element Deletion

```
IF element.type == "PIPE" AND element_length(element) < 6.0mm:
  ACTION: DELETE element
  TIER: 1 (auto-fix silently)
  LOG: "[Fix] Deleted micro-pipe at Row {n}: length {len}mm < 6mm threshold."

IF element.type != "PIPE" AND element_length(element) < 1.0mm:
  ACTION: FLAG for review (cannot delete a fitting)
  TIER: 4 (error, no auto-fix)
  LOG: "[Error] Row {n}: {type} has near-zero length ({len}mm). Coordinate error."
```

**Rationale:** Micro-pipes arise from modeling artifacts — tiny slivers at intersections. They serve no structural or routing purpose and cause problems in stress analysis.

### R-GEO-02: Bore Continuity Along Chain

```
AT each chain step, compare current.bore vs context.current_bore:

IF bore changes AND previous element is NOT REDUCER-CONCENTRIC/ECCENTRIC:
  IF bore change matches a known reducer size pair (config table):
    ACTION: FLAG as missing reducer
    TIER: 4 (error)
    LOG: "[Error] Row {n}: Bore changes {old}→{new} without reducer. 
           Insert REDUCER between Row {n-1} and Row {n}."
  ELSE:
    ACTION: FLAG as data error
    TIER: 4 (error)
    LOG: "[Error] Row {n}: Unexpected bore change {old}→{new}. 
           Not a standard reducer size pair."
```

**Rationale:** Bore can only physically change at a reducer. Any other bore change along a chain indicates a missing component or data error.

### R-GEO-03: Single-Axis Element Rule

```
FOR element WHERE type IN (PIPE, FLANGE, VALVE, REDUCER):
  deltas = decompose(EP2 - EP1)
  non_zero_axes = [axis for axis in deltas if abs(delta) > 0.5mm]
  
  IF len(non_zero_axes) > 1:
    dominant = axis with max(abs(delta))
    minor_axes = all other non-zero axes
    total_minor = sum of abs(minor deltas)
    
    IF total_minor < 2.0mm:
      ACTION: SNAP minor axes to zero (align to dominant axis)
      TIER: 2 (auto-fix with log)
      LOG: "[Fix] Row {n}: {type} had {total_minor:.1f}mm off-axis drift. 
             Snapped to pure {dominant}-axis."
    ELSE:
      ACTION: FLAG as diagonal element
      TIER: 4 (error)
      LOG: "[Error] Row {n}: {type} runs diagonally across {axes}. 
             Pipes and fittings must align to a single global axis."
```

**Rationale:** In plant piping, straight elements (pipes, flanges, valves, reducers) run along a single global axis. Diagonal elements are data errors except in extremely rare cases (which the engineer can manually accept).

### R-GEO-04: Fitting Dimension Sanity

```
FOR element WHERE type IN (FLANGE, VALVE, TEE, BEND, REDUCER):
  measured_length = element_length(element)
  catalog_range = config.catalog_dimensions[type][bore]
  
  IF catalog_range is defined:
    IF measured_length < catalog_range.min * 0.8:
      ACTION: FLAG as undersized
      TIER: 3 (warning)
      LOG: "[Warning] Row {n}: {type} length {measured}mm is {pct}% below 
             catalog minimum {min}mm for bore {bore}."
    
    IF measured_length > catalog_range.max * 1.2:
      ACTION: FLAG as oversized
      TIER: 3 (warning)
      LOG: "[Warning] Row {n}: {type} length {measured}mm is {pct}% above 
             catalog maximum {max}mm for bore {bore}."
```

**Rationale:** Every fitting has a known dimension range from standards (B16.5 flanges, API 600 valves, B16.9 tees). Deviations beyond 20% indicate coordinate errors.

### R-GEO-05: Bend Radius Sanity

```
FOR element WHERE type == "BEND":
  R_measured = distance(CP, EP1)  // should equal distance(CP, EP2)
  R_15D = 1.5 * config.pipe_OD[bore]   // long radius
  R_10D = 1.0 * config.pipe_OD[bore]   // short radius
  
  // Check CP equidistant
  R_to_EP1 = distance(CP, EP1)
  R_to_EP2 = distance(CP, EP2)
  IF abs(R_to_EP1 - R_to_EP2) > 1.0mm:
    LOG: "[Error] Row {n}: BEND CP not equidistant from EPs. 
           dist(CP,EP1)={R1:.1f}, dist(CP,EP2)={R2:.1f}."
    TIER: 4
  
  // Check against standard radii
  IF abs(R_measured - R_15D) < R_15D * 0.05:
    LOG: "[Info] Row {n}: BEND radius {R:.1f}mm matches 1.5D ({R15:.1f}mm)."
  ELIF abs(R_measured - R_10D) < R_10D * 0.05:
    LOG: "[Info] Row {n}: BEND radius {R:.1f}mm matches 1.0D ({R10:.1f}mm)."
  ELSE:
    LOG: "[Warning] Row {n}: BEND radius {R:.1f}mm does not match 
           standard 1.5D ({R15:.1f}) or 1.0D ({R10:.1f}). Non-standard bend?"
    TIER: 3
```

### R-GEO-06: Valve Face-to-Face Check

```
FOR element WHERE type == "VALVE":
  measured_ftf = element_length(element)
  catalog_ftf = config.valve_ftf[skey][bore][class]
  
  IF catalog_ftf is defined AND abs(measured_ftf - catalog_ftf) > catalog_ftf * 0.1:
    LOG: "[Warning] Row {n}: Valve face-to-face {measured}mm vs catalog {catalog}mm 
           for {skey} bore {bore}. Deviation > 10%."
    TIER: 3
```

### R-GEO-07: Zero-Length Element

```
FOR any element:
  IF element_length(element) == 0 (EP1 == EP2):
    IF type == "SUPPORT":
      SKIP (supports are point elements)
    ELIF type == "OLET":
      SKIP (olets use CP/BP, not EPs)
    ELSE:
      LOG: "[Error] Row {n}: {type} has zero length (EP1 = EP2). 
             Coordinate error or duplicate."
      TIER: 4
```

### R-GEO-08: Coordinate Magnitude Sanity

```
FOR any coordinate value (X, Y, or Z) in any EP/CP/BP/COOR:
  IF abs(value) > 500000:
    LOG: "[Warning] Row {n}: Coordinate magnitude {value:.0f}mm 
           (={value/1000:.1f}m) seems unusually large. Verify units."
    TIER: 3
  
  IF value == 0.0 and this is the ONLY axis that is zero:
    SKIP (single zero axis is fine)
  
  IF all three spatial values == 0.0:
    LOG: "[Error] Row {n}: Coordinate (0,0,0) — prohibited."
    TIER: 4
```

---

## 4. TOPOLOGICAL CHECKS (R-TOP)

### R-TOP-01: Dead-End Detection

```
AT chain terminal (last element in walk):
  IF element.type == "PIPE":
    // Pipe ending without a fitting = suspicious
    LOG: "[Warning] Chain {id} ends at bare PIPE (Row {n}). 
           Expected terminal fitting (flange, cap, nozzle)."
    TIER: 3
  
  ELIF element.type IN ("FLANGE", "VALVE"):
    LOG: "[Info] Chain {id} terminates at {type} (Row {n}). Normal terminal."
    TIER: — (info only)
  
  ELSE:
    LOG: "[Warning] Chain {id} ends at {type} (Row {n}). 
           Unusual terminal. Verify connection."
    TIER: 3
```

### R-TOP-02: Orphan Element Detection

```
AFTER all chains are walked:
  orphans = all_components - visited_components
  
  FOR each orphan:
    LOG: "[Error] Row {n}: {type} is an orphan — not connected to any chain. 
           Likely modeling error or missing connection."
    TIER: 4
```

### R-TOP-03: Duplicate Element Detection

```
FOR each pair of components (i, j) where i < j:
  IF same type AND coords_approx_equal(i.EP1, j.EP1, tol=2mm) 
                AND coords_approx_equal(i.EP2, j.EP2, tol=2mm):
    LOG: "[Error] Row {i} and Row {j}: Duplicate {type} elements 
           occupying same spatial extent. Delete one."
    ACTION: Mark j as candidate for deletion
    TIER: 4 (flag, do not auto-delete — let user choose which)
```

### R-TOP-04: Flange Pair Check

```
DURING walk, track flanges:
  IF current.type == "FLANGE" AND NOT is_terminal(current, chain):
    // Mid-chain flange — should have a mating flange adjacent
    prev = chain[n-1].element (if exists)
    next = chain[n+1].element (if exists)
    
    IF prev.type != "FLANGE" AND next.type != "FLANGE":
      LOG: "[Warning] Row {n}: Mid-chain FLANGE has no mating flange. 
             Flange joints require a pair."
      TIER: 3
    
    IF prev.type == "FLANGE":
      // Verify they are face-to-face (EP2 of prev = EP1 of current, ~0mm gap)
      IF gap > 3mm:
        LOG: "[Warning] Row {n}: Flange pair gap {gap:.1f}mm. 
               Expected face-to-face contact."
        TIER: 3
```

### R-TOP-05: Valve Flange Sandwich Check

```
DURING walk:
  IF current.type == "VALVE" AND current.skey starts with "VB" (flanged valve):
    prev = previous non-pipe element in chain (skip pipes)
    next = next non-pipe element in chain (skip pipes)
    
    IF prev.type != "FLANGE":
      LOG: "[Warning] Row {n}: Flanged valve ({skey}) has no upstream flange. 
             Expected flange before flanged valve."
      TIER: 3
    
    IF next.type != "FLANGE":
      LOG: "[Warning] Row {n}: Flanged valve ({skey}) has no downstream flange. 
             Expected flange after flanged valve."
      TIER: 3
```

### R-TOP-06: Support On-Pipe Validation

```
FOR each SUPPORT in the chain:
  Find the pipe element whose axis the support should lie on:
    - Search adjacent pipes in the chain
    - Project support CO-ORDS onto pipe axis (EP1→EP2 line)
    - Calculate perpendicular distance from support to pipe axis
  
  IF perpendicular_distance > 5mm:
    LOG: "[Error] Row {n}: SUPPORT is {dist:.1f}mm off the pipe axis. 
           Support must lie on or near a pipe."
    TIER: 4
  
  // Check if support falls between pipe EP1 and EP2 (not outside)
  IF projection_parameter < 0 OR projection_parameter > 1:
    LOG: "[Warning] Row {n}: SUPPORT projects outside the adjacent pipe extent. 
           Verify support location."
    TIER: 3
```

### R-TOP-07: Tee Centre-Point On-Header

```
FOR each TEE:
  // CP must lie on EP1→EP2 segment
  t = project_point_onto_line(CP, EP1, EP2)
  
  IF t < -0.01 OR t > 1.01:
    LOG: "[Error] Row {n}: TEE centre-point is outside the header 
           EP1→EP2 segment (t={t:.3f}). CP must lie between EP1 and EP2."
    TIER: 4
  
  IF abs(t - 0.5) > 0.02:
    LOG: "[Warning] Row {n}: TEE centre-point is not at midpoint 
           (t={t:.3f}, expected 0.5). Standard tees have CP at centre."
    TIER: 3
```

---

## 5. CHAIN CONTINUITY RULES (R-CHN)

### R-CHN-01: Axis Change Without Bend

```
DURING walk, when travel_axis changes:
  IF causing element is NOT BEND and NOT TEE branch entry:
    LOG: "[Error] Row {n}: Travel axis changed from {old_axis} to {new_axis} 
           at {type}. Only BENDs and TEE branches can change axis. 
           Missing BEND between Row {n-1} and Row {n}?"
    TIER: 4
```

**Rationale:** The most common cause of broken PCFs. A pipe appears to turn a corner because coordinates are wrong, not because there's actually a turn.

### R-CHN-02: Fold-Back Detection

```
DURING walk:
  IF context.travel_axis == elem_axis AND context.travel_direction != elem_dir:
    // Same axis, reversed direction = fold-back
    
    IF current.type == "PIPE":
      fold_length = element_length(current)
      IF fold_length < 25mm:
        ACTION: DELETE fold-back pipe
        TIER: 2 (auto-fix with log)
        LOG: "[Fix] Row {n}: Fold-back pipe ({fold_length:.1f}mm) on 
               {axis}-axis deleted."
      ELSE:
        ACTION: FLAG for review
        TIER: 4 (error)
        LOG: "[Error] Row {n}: Pipe folds back {fold_length:.1f}mm on 
               {axis}-axis. Too large to auto-delete. Manual review needed."
    
    ELIF current.type == "BEND":
      // 180° return bend — check if intentional
      LOG: "[Info] Row {n}: 180° return bend detected on {axis}-axis. 
             Verify this is intentional (U-bend / expansion loop)."
      TIER: — (info)
    
    ELSE:
      LOG: "[Error] Row {n}: {type} reverses direction on {axis}-axis. 
             Fittings cannot fold back."
      TIER: 4
```

### R-CHN-03: Elbow-Elbow Proximity

```
DURING walk:
  IF current.type == "BEND" AND context.last_fitting_type == "BEND":
    // Two bends with no pipe between them
    prev_bend = find_previous_bend(chain)
    pipe_between = total_pipe_length_between(prev_bend, current)
    
    IF pipe_between == 0:
      LOG: "[Warning] Row {n}: Two adjacent bends with no pipe between them. 
             Compound bend or modeling error? Verify."
      TIER: 3
    ELIF pipe_between < 1.0 * config.pipe_OD[bore]:
      LOG: "[Warning] Row {n}: Only {pipe_between:.0f}mm pipe between bends. 
             Minimum tangent for stress analysis may not be met."
      TIER: 3
```

### R-CHN-04: Sequence Number Ordering

```
DURING walk:
  IF current.csvSeqNo < previous.csvSeqNo AND both are valid numbers:
    LOG: "[Info] Row {n}: Sequence number {curr_seq} is less than 
           previous {prev_seq}. Data ordering may not match routing direction."
    TIER: — (info)
    
    // Count total reversals in chain
    AT end of chain:
    IF reversal_count > chain_length * 0.3:
      LOG: "[Warning] Chain {id}: {pct}% of sequence numbers are out of order. 
             Consider re-sequencing to match routing direction."
      TIER: 3
```

### R-CHN-05: Elevation Drift in Horizontal Runs

```
DURING walk on a horizontal run (travel_axis = X or Y):
  Track Z values across consecutive elements.
  
  IF all Z values in the last N elements are within 2mm of each other:
    // Stable horizontal run — check for drift
    median_Z = median of recent Z values
    
    IF abs(current.ep1.z - median_Z) > 2mm AND abs(current.ep1.z - median_Z) < 10mm:
      // Small drift — snap to median
      ACTION: SNAP Z to median_Z
      TIER: 2 (auto-fix with log)
      LOG: "[Fix] Row {n}: Z drifted to {z:.1f} (median {med:.1f}). 
             Snapped to {med:.1f} for horizontal run consistency."
    
    ELIF abs(current.ep1.z - median_Z) >= 10mm:
      // Large Z change in a horizontal run — intentional slope or error?
      LOG: "[Warning] Row {n}: Z changes by {delta:.1f}mm in horizontal run. 
             Intentional slope or elevation error?"
      TIER: 3
```

### R-CHN-06: Shared-Axis Coordinate Snapping

```
FOR two consecutive elements on the same travel_axis:
  // The two non-travel coordinates should match exactly.
  // E.g., if travelling along Y, then X and Z should be identical.
  
  non_travel_axes = axes other than travel_axis
  
  FOR each non_travel_axis:
    val_prev = previous.exit_point[axis]
    val_curr = current.entry_point[axis]
    drift = abs(val_curr - val_prev)
    
    IF drift > 0.1mm AND drift < 2.0mm:
      ACTION: SNAP to previous value
      TIER: 1 (auto-fix silently)
      LOG: "[Fix] Row {n}: {axis} drifted {drift:.1f}mm on shared axis. 
             Snapped to {val_prev:.1f}."
    
    ELIF drift >= 2.0mm AND drift < 10.0mm:
      ACTION: SNAP with warning
      TIER: 2 (auto-fix with log)
      LOG: "[Fix] Row {n}: {axis} drifted {drift:.1f}mm. Snapped to {val_prev:.1f}. 
             Verify this is not an intentional offset."
    
    ELIF drift >= 10.0mm:
      ACTION: FLAG — do not auto-fix
      TIER: 4 (error)
      LOG: "[Error] Row {n}: {axis} offset {drift:.1f}mm from previous element. 
             Too large for auto-snap. Lateral offset or data error."
```

---

## 6. GAP ANALYSIS RULES (R-GAP)

### R-GAP-01: Zero/Negligible Gap

```
gap_magnitude = sqrt(gx² + gy² + gz²)

IF gap_magnitude < 1.0mm:
  ACTION: OK — no fix needed
  TIER: 1 (silent)
  IF gap_magnitude > 0.1mm:
    // Snap to close the micro-gap
    ACTION: Extend current EP2 to match next EP1
    LOG: "[Fix] Row {n}→{n+1}: Micro-gap {gap:.2f}mm closed by snapping."
```

### R-GAP-02: Single-Axis Gap Along Travel (≤ 25mm)

```
gap_axes = decompose(gap_vector, threshold=0.5mm)

IF len(gap_axes) == 1 AND gap_axes[0].axis == context.travel_axis:
  gap_delta = gap_axes[0].delta
  
  IF abs(gap_delta) <= 25.0mm:
    IF gap_delta * context.travel_direction > 0:
      // Gap in travel direction — insert filler pipe
      ACTION: GAP_FILL_AUTO
      TIER: 2 (auto-fix with log)
      LOG: "[Fix] Row {n}→{n+1}: {abs(gap_delta):.1f}mm gap along 
             {axis}-axis {direction}. Filled with pipe."
    ELSE:
      // Gap in reverse direction — this IS an overlap (see R-OVR rules)
      Delegate to overlap rules.
```

### R-GAP-03: Single-Axis Gap Along Travel (> 25mm)

```
IF len(gap_axes) == 1 AND gap_axes[0].axis == context.travel_axis:
  IF abs(gap_delta) > 25.0mm AND abs(gap_delta) <= 100.0mm:
    ACTION: FLAG for review, suggest pipe fill
    TIER: 3 (warning)
    LOG: "[Warning] Row {n}→{n+1}: {abs(gap_delta):.1f}mm gap along 
           {axis}-axis. Exceeds 25mm auto-fill. Fill with pipe? (manual confirm)"
  
  IF abs(gap_delta) > 100.0mm:
    ACTION: FLAG as major gap
    TIER: 4 (error)
    LOG: "[Error] Row {n}→{n+1}: {abs(gap_delta):.1f}mm gap along 
           {axis}-axis. Major gap — likely missing component(s)."
```

### R-GAP-04: Single-Axis Gap on Non-Travel Axis (Lateral Gap)

```
IF len(gap_axes) == 1 AND gap_axes[0].axis != context.travel_axis:
  // Lateral offset — pipe has shifted sideways
  lateral_delta = abs(gap_axes[0].delta)
  
  IF lateral_delta < 2.0mm:
    ACTION: SNAP (align coordinates)
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n}→{n+1}: Lateral offset {lateral_delta:.1f}mm on 
           {axis}-axis (travel is {travel_axis}). Snapped to align."
  ELSE:
    ACTION: FLAG — lateral shift
    TIER: 4 (error)
    LOG: "[Error] Row {n}→{n+1}: Lateral offset {lateral_delta:.1f}mm on 
           {axis}-axis. Pipe has shifted sideways. Manual review required."
```

### R-GAP-05: Multi-Axis Gap — Negligible Lateral

```
IF len(gap_axes) >= 2:
  along_travel = component of gap along context.travel_axis
  lateral_total = sum of abs(components on other axes)
  
  IF lateral_total < 2.0mm AND abs(along_travel) <= 25.0mm:
    // Lateral is noise, treat as pure axial gap
    ACTION: GAP_FILL_AUTO + SNAP lateral
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n}→{n+1}: Multi-axis gap (axial={along:.1f}mm, 
           lateral={lat:.1f}mm). Lateral snapped, axial filled with pipe."
```

### R-GAP-06: Multi-Axis Gap — Significant Components

```
IF len(gap_axes) >= 2:
  IF lateral_total >= 2.0mm OR abs(along_travel) > 25.0mm:
    ACTION: FLAG — rigorous check required
    TIER: 4 (error)
    LOG: "[Error] Row {n}→{n+1}: Multi-axis gap ({format_gap(gap_axes)}). 
           Cannot auto-fill. Rigorous manual review required."
```

### R-GAP-07: Gap at TEE Header Junction

```
IF next.type == "TEE" OR current.type == "TEE":
  // Gap near tees is often caused by not accounting for tee C dimension
  tee = whichever is the TEE
  C_dimension = config.tee_C_dimension[tee.bore]
  
  IF C_dimension AND abs(gap_magnitude - C_dimension * 0.5) < 5mm:
    LOG: "[Info] Row {n}: Gap near TEE ({gap:.1f}mm) approximately equals 
           half the tee C dimension ({C_half:.1f}mm). 
           Likely tee body not accounted for in pipe length."
    ACTION: Adjust pipe length to account for tee C
    TIER: 2
```

### R-GAP-08: Only Pipes Fill Gaps

```
CRITICAL RULE — enforced in all gap-fill actions:

  When inserting a filler element:
    - ALWAYS create a PIPE element.
    - NEVER create a fitting (flange, valve, bend, etc.) to fill a gap.
    - Filler pipe inherits bore, material (CA3), design conditions (CA1, CA2) 
      from the upstream element.
    - Filler pipe gets a generated RefNo: "{upstream_ref}_GapFill"
    - Filler pipe is tagged with Fixing Action = "GAPFILLING"
    - LOG: "[Fix] Injected gap-fill PIPE: {length:.1f}mm {axis} {direction}, 
             bore={bore}, after Row {n}."
```

---

## 7. OVERLAP ANALYSIS RULES (R-OVR)

### R-OVR-01: Simple Axial Overlap on Pipe

```
IF gap is negative (overlap) along travel_axis:
  overlap = abs(gap_delta)
  
  IF current.type == "PIPE" AND overlap <= 25.0mm:
    ACTION: TRIM current pipe EP2 back by overlap amount
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n}: Pipe trimmed by {overlap:.1f}mm to resolve 
           {axis}-axis overlap with Row {n+1}."
    
    // Update EP2:
    current.ep2[travel_axis] -= overlap * travel_direction
  
  ELIF current.type == "PIPE" AND overlap > 25.0mm:
    ACTION: FLAG — large overlap
    TIER: 3 (warning)
    LOG: "[Warning] Row {n}: Pipe overlaps next element by {overlap:.1f}mm. 
           Exceeds 25mm auto-trim threshold. Manual review."
```

### R-OVR-02: Overlap Where Current is a Fitting (Rigid)

```
IF gap is negative AND current.type NOT IN ("PIPE"):
  // Cannot trim a fitting — it has fixed catalog dimensions
  
  IF next.type == "PIPE":
    // Try trimming the NEXT pipe instead
    ACTION: TRIM next pipe EP1 forward by overlap amount
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n+1}: Pipe trimmed at start by {overlap:.1f}mm to resolve 
           overlap with upstream {type} (Row {n})."
  ELSE:
    // Both are rigid — cannot auto-fix
    ACTION: FLAG
    TIER: 4 (error)
    LOG: "[Error] Row {n}→{n+1}: Rigid-on-rigid overlap ({current.type} → 
           {next.type}). Neither can be trimmed. {overlap:.1f}mm overlap. 
           Requires coordinate correction."
```

### R-OVR-03: Rigid-on-Rigid Overlap

```
IF current.type NOT IN ("PIPE") AND next.type NOT IN ("PIPE"):
  ACTION: NEVER auto-fix
  TIER: 4 (error)
  LOG: "[Error] Row {n}→{n+1}: {current.type} overlaps {next.type} by 
         {overlap:.1f}mm. Both are rigid fittings with catalog dimensions. 
         Cannot trim either. Investigate pipe between them or coordinate error."
```

### R-OVR-04: Enveloping Overlap

```
// Element B starts before Element A ends AND extends past A's extent
// This means B's EP1 is "behind" A's EP1 in travel direction

IF next.ep1 is "behind" current.ep1 in travel direction:
  // B starts before A even begins — complete spatial overlap
  ACTION: FLAG as major error
  TIER: 4 (error)
  LOG: "[Error] Row {n+1} ({next.type}) envelops Row {n} ({current.type}). 
         Elements are spatially stacked. One is likely misplaced entirely."
```

### R-OVR-05: Overlap at Tee Boundaries

```
IF current.type == "PIPE" AND next.type == "TEE":
  overlap = abs(gap_delta)
  tee_half_C = config.tee_C_dimension[next.bore] / 2
  
  IF abs(overlap - tee_half_C) < 3mm:
    // Overlap equals tee half-body — pipe wasn't trimmed for tee insertion
    ACTION: TRIM pipe by tee half-C
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n}: Pipe trimmed by {tee_half_C:.1f}mm 
           (half tee C dimension) to accommodate TEE at Row {n+1}."
  ELSE:
    // Overlap doesn't match tee dimension — something else is wrong
    LOG: "[Warning] Row {n}: Pipe overlaps TEE by {overlap:.1f}mm 
           (tee half-C = {tee_half_C:.1f}mm). Non-standard overlap."
    TIER: 3
```

### R-OVR-06: Overlap Creates Negative Pipe Length

```
AFTER trimming a pipe (R-OVR-01 or R-OVR-02):
  remaining_length = element_length(trimmed_pipe)
  
  IF remaining_length < 0:
    // Trimming would make pipe go negative — pipe is entirely inside overlap
    ACTION: DELETE the pipe entirely
    TIER: 2 (auto-fix with log)
    LOG: "[Fix] Row {n}: Pipe entirely consumed by overlap ({overlap:.1f}mm > 
           original length {original:.1f}mm). Pipe deleted."
  
  ELIF remaining_length < 6.0mm:
    // After trimming, pipe is micro-sized — delete it (R-GEO-01)
    ACTION: DELETE
    TIER: 2
    LOG: "[Fix] Row {n}: Pipe reduced to {remaining:.1f}mm after trim. 
           Below 6mm threshold. Deleted."
```

---

## 8. BRANCH-SPECIFIC RULES (R-BRN)

### R-BRN-01: Branch Bore Cannot Exceed Header Bore

```
FOR each TEE:
  IF branchBore > bore (header bore):
    LOG: "[Error] Row {n}: TEE branch bore ({branchBore}mm) exceeds 
           header bore ({bore}mm). Header and branch may be swapped, 
           or tee data is corrupt."
    TIER: 4
```

### R-BRN-02: Olet Size Ratio Check

```
FOR each OLET:
  ratio = branchBore / bore  (branch / header)
  
  IF ratio > 0.5:
    LOG: "[Warning] Row {n}: OLET branch/header ratio = {ratio:.2f} (> 0.5). 
           Consider using a TEE instead of olet for this size combination."
    TIER: 3
  
  IF ratio > 0.8:
    LOG: "[Error] Row {n}: OLET branch/header ratio = {ratio:.2f} (> 0.8). 
           Olets are not suitable for near-equal bore ratios. Use TEE."
    TIER: 4
```

### R-BRN-03: Branch Direction Must Differ From Header

```
FOR each TEE:
  header_axis = detect_element_axis(TEE using EP1, EP2)
  branch_vector = BP - CP
  branch_axis = dominant_axis(branch_vector)
  
  IF branch_axis == header_axis:
    LOG: "[Error] Row {n}: TEE branch axis ({branch_axis}) is same as 
           header axis ({header_axis}). Branch must be perpendicular to header."
    TIER: 4
```

### R-BRN-04: Branch Perpendicularity

```
FOR each TEE:
  header_vec = normalize(EP2 - EP1)
  branch_vec = normalize(BP - CP)
  
  dot_product = dot(header_vec, branch_vec)
  angle_from_perpendicular = abs(acos(abs(dot_product)) - pi/2) in degrees
  
  IF angle_from_perpendicular > 5.0 degrees:
    LOG: "[Warning] Row {n}: TEE branch is {angle:.1f}° from perpendicular 
           to header. Expected 90°. Wye fitting or data error?"
    TIER: 3
  
  IF angle_from_perpendicular > 15.0 degrees:
    LOG: "[Error] Row {n}: TEE branch is {angle:.1f}° from perpendicular. 
           Severely non-perpendicular. Data error."
    TIER: 4
```

### R-BRN-05: Branch Chain Continuation Validation

```
AFTER walking a branch chain from TEE BP:
  branch_first = first element in branch chain
  
  IF distance(TEE.BP, branch_first.EP1) > 25mm:
    LOG: "[Error] Row {n}: TEE branch point does not connect to next branch 
           element. Gap = {gap:.1f}mm. Branch chain may be broken."
    TIER: 4
  
  // Also check bore continuity at branch start
  IF branch_first.bore != TEE.branchBore:
    LOG: "[Warning] Row {n}: TEE branch bore ({TEE.branchBore}mm) does not 
           match first branch element bore ({branch_first.bore}mm)."
    TIER: 3
```

---

## 9. SPATIAL REASONING RULES (R-SPA)

### R-SPA-01: Elevation Consistency in Horizontal Runs

*(See R-CHN-05 — duplicated here for completeness under spatial category)*

Track Z across horizontal runs. Snap drifts < 2mm. Warn on drifts 2–10mm. Error on > 10mm.

### R-SPA-02: Coordinate Snapping on Shared Axes

*(See R-CHN-06 — duplicated here)*

When two elements share a travel axis, their non-travel coordinates must match. Snap < 2mm, warn 2–10mm, error > 10mm.

### R-SPA-03: Gravity-Aware Support Placement

```
FOR each SUPPORT:
  // Determine if support is on a vertical run
  adjacent_pipe = find_containing_pipe(support.coor, chain)
  
  IF adjacent_pipe:
    pipe_axis = detect_element_axis(adjacent_pipe)
    
    IF pipe_axis == "Z":
      LOG: "[Warning] Row {n}: Support on vertical pipe run ({axis}-axis). 
             Verify support type is appropriate for vertical loading 
             (e.g., trunnion, spring hanger, not a simple rest)."
      TIER: 3
```

### R-SPA-04: Collinear Pipe Merging Suggestion

```
FOR two adjacent PIPE elements:
  IF same travel_axis AND same travel_direction 
     AND gap < 1.0mm (or zero)
     AND same bore AND same CA3 AND same CA4 AND same CA1 AND same CA2:
    
    combined_length = element_length(pipe1) + element_length(pipe2)
    
    LOG: "[Info] Row {n} and Row {n+1}: Two collinear pipes with identical 
           properties. Can be merged into single {combined_length:.0f}mm pipe. 
           (Not auto-merged — may have deliberate stress analysis node points.)"
    TIER: — (info/suggestion only, never auto-merge)
```

### R-SPA-05: Suspicious Placeholder Coordinates

```
FOR any coordinate value:
  suspicious_values = [0.0, 100000.0, 99999.0, 999999.0, -1.0, 1.0]
  
  IF value IN suspicious_values AND value appears as X, Y, or Z:
    // Check if the value is consistent with adjacent elements
    IF adjacent elements do NOT have similar values in this axis:
      LOG: "[Warning] Row {n}: Coordinate {axis}={value:.0f} looks like a 
             placeholder or default value. Adjacent elements use {axis}≈{avg:.0f}."
      TIER: 3
```

---

## 10. DATA QUALITY RULES (R-DAT)

### R-DAT-01: Coordinate Precision Consistency

```
FOR all elements in a chain:
  // Check how many decimal places each coordinate uses
  precisions = set()
  FOR each coordinate value:
    decimal_places = count_decimal_places(value)
    precisions.add(decimal_places)
  
  IF len(precisions) > 1:
    dominant_precision = mode(all_precisions)
    outlier_rows = rows where precision != dominant_precision
    
    FOR each outlier:
      LOG: "[Warning] Row {n}: Coordinate precision ({prec} decimals) differs 
             from chain standard ({dominant} decimals). 
             Possible data source inconsistency."
      TIER: 3
```

### R-DAT-02: Suspicious Round Numbers

*(See R-GEO-08 — the coordinate magnitude and placeholder check)*

### R-DAT-03: Material Continuity

```
DURING walk:
  IF current.ca[3] != context.current_material AND both are non-empty:
    IF previous element is FLANGE or VALVE:
      // Material change at a joint — acceptable
      LOG: "[Info] Row {n}: Material changes from {old} to {new} at 
             {prev_type} joint. Verified transition point."
    ELSE:
      LOG: "[Warning] Row {n}: Material changes from {old} to {new} 
             mid-pipe (no flange/joint between). 
             Possible data merge from different line numbers."
      TIER: 3
```

### R-DAT-04: Design Condition Continuity

```
DURING walk:
  IF current.ca[1] != context.current_pressure OR current.ca[2] != context.current_temp:
    IF both are non-empty and differ:
      LOG: "[Warning] Row {n}: Design conditions change. 
             Pressure: {old_p}→{new_p}, Temp: {old_t}→{new_t}. 
             Verify this is not a data merge from different line specs."
      TIER: 3
```

### R-DAT-05: CA8 Weight Scope

```
FOR each element:
  IF ca[8] is populated AND type IN ("PIPE", "SUPPORT"):
    LOG: "[Warning] Row {n}: CA8 (weight) is populated for {type}. 
           CA8 should only be on fittings (FLANGE, VALVE, etc.)."
    ACTION: Consider removing CA8 for PIPE/SUPPORT
    TIER: 3
  
  IF ca[8] is NOT populated AND type IN ("FLANGE", "VALVE"):
    LOG: "[Info] Row {n}: {type} has no CA8 (weight). 
           Consider adding component weight for analysis."
    TIER: — (info)
```

### R-DAT-06: SKEY Consistency with Component Type

```
FOR each element with skey:
  expected_prefix = {
    "FLANGE": ["FL"],
    "VALVE": ["V"],
    "BEND": ["BE"],
    "TEE": ["TE"],
    "OLET": ["OL"],
    "REDUCER-CONCENTRIC": ["RC"],
    "REDUCER-ECCENTRIC": ["RE"],
  }
  
  prefixes = expected_prefix.get(type, [])
  IF prefixes AND NOT any(skey.startswith(p) for p in prefixes):
    LOG: "[Warning] Row {n}: SKEY '{skey}' does not match expected prefix 
           for {type} (expected: {prefixes}). Wrong SKEY or wrong type?"
    TIER: 3
```

---

## 11. CHAIN AGGREGATE RULES (R-AGG)

### R-AGG-01: Total Pipe Length Sanity

```
AT end of chain walk:
  total_pipe_length = context.pipe_length_sum
  
  // Check for zero or negative total
  IF total_pipe_length <= 0:
    LOG: "[Error] Chain {id}: Total pipe length is {total:.0f}mm (≤ 0). 
           Chain has no effective piping. Fundamentally broken."
    TIER: 4
  
  // Check pipe-to-fitting ratio
  total_chain_length = magnitude(context.cumulative_vector)
  total_fitting_length = total_chain_length - total_pipe_length
  
  IF total_chain_length > 0 AND total_pipe_length / total_chain_length < 0.1:
    LOG: "[Warning] Chain {id}: Pipe is only {pct:.0f}% of total chain length. 
           Unusually high fitting density. Verify data."
    TIER: 3
```

### R-AGG-02: Minimum Tangent Between Bends

```
DURING walk, track distance since last bend:
  pipe_since_bend = pipe length accumulated since last BEND
  
  AT each new BEND:
    min_tangent = 1.0 * config.pipe_OD[bore]  // 1D minimum tangent
    
    IF pipe_since_bend < min_tangent AND pipe_since_bend > 0:
      LOG: "[Warning] Row {n}: Only {pipe_since_bend:.0f}mm straight pipe 
             before this bend. Minimum tangent for stress analysis is 
             {min_tangent:.0f}mm (1D). May cause flexibility analysis issues."
      TIER: 3
    
    pipe_since_bend = 0  // reset counter
```

### R-AGG-03: Route Closure Check

```
AT end of chain walk:
  // If chain connects two known terminal points (nozzles, tie-ins):
  start_point = chain[0].element.ep1
  end_point = chain[-1].element.ep2 (or last exit point)
  
  expected_vector = end_point - start_point
  actual_vector = context.cumulative_vector
  
  closure_error = magnitude(expected_vector - actual_vector)
  
  IF closure_error > 5.0mm:
    LOG: "[Warning] Chain {id}: Route closure error = {error:.1f}mm. 
           Sum of element vectors does not close to terminal points. 
           Cumulative coordinate drift detected.
           Expected: ({ex:.1f}, {ey:.1f}, {ez:.1f})
           Actual:   ({ax:.1f}, {ay:.1f}, {az:.1f})
           Error:    ({dx:.1f}, {dy:.1f}, {dz:.1f})"
    TIER: 3
  
  IF closure_error > 50.0mm:
    // Upgrade to error
    LOG: "[Error] Chain {id}: Route closure error = {error:.1f}mm. 
           Major cumulative error — missing elements or coordinate errors."
    TIER: 4
```

### R-AGG-04: Dead-End Detection

*(See R-TOP-01 — applied at chain end)*

### R-AGG-05: Flange Pair Completeness

```
AT end of chain walk:
  // Count all flanges in chain
  flanges = [link for link in chain if link.element.type == "FLANGE"]
  terminal_flanges = flanges at chain start or end
  mid_flanges = flanges not at terminals
  
  // Mid-chain flanges should come in pairs
  IF len(mid_flanges) % 2 != 0:
    LOG: "[Warning] Chain {id}: Odd number of mid-chain flanges ({count}). 
           Flange joints require pairs. One mating flange may be missing."
    TIER: 3
```

### R-AGG-06: Component Count Sanity

```
AT end of chain walk:
  // Very short chains with many fittings are suspicious
  IF len(chain) <= 2 AND all elements are fittings (no pipes):
    LOG: "[Warning] Chain {id}: Chain has only fittings, no pipe. 
           Missing pipe elements between fittings?"
    TIER: 3
  
  // Very long chains with no supports
  support_count = count supports in chain
  chain_length_m = magnitude(cumulative_vector) / 1000
  
  IF chain_length_m > 10.0 AND support_count == 0:
    LOG: "[Warning] Chain {id}: {chain_length_m:.1f}m of piping with 
           no supports. Verify support data is included."
    TIER: 3
```

---

## 12. FIX APPLICATION ENGINE

### 12.1 Fix Priority Order

When multiple fixes apply to the same region, apply in this order:

```
Priority 1: DELETE micro-elements (R-GEO-01) — remove noise first
Priority 2: DELETE fold-backs (R-CHN-02) — remove reversed elements
Priority 3: SNAP coordinates (R-CHN-06, R-GAP-01) — align axes
Priority 4: TRIM overlaps (R-OVR-01, R-OVR-02) — resolve overlaps
Priority 5: FILL gaps (R-GAP-02, R-GAP-05) — insert filler pipes
Priority 6: RECALCULATE derived data (LEN, AXIS, DELTA, BRLEN, pointers)
```

### 12.2 Fix Application Rules

```
RULE F-01: Only PIPE elements can be created, trimmed, or deleted by auto-fix.
RULE F-02: Fittings (FLANGE, VALVE, BEND, TEE, OLET, REDUCER) are RIGID. 
            Their coordinates come from catalog dimensions. Never modify fitting length.
RULE F-03: When trimming a pipe, adjust EP2 (exit end) by default, not EP1 
            (to preserve the connection with the upstream element).
RULE F-04: When a pipe is trimmed to below 6mm, delete it entirely (triggers R-GEO-01).
RULE F-05: When inserting a filler pipe, inherit ALL properties 
            (bore, CA1-CA10 except CA8, material) from the upstream element.
RULE F-06: Filler pipes get Fixing Action = "GAPFILLING".
RULE F-07: Deleted elements get Fixing Action = "DELETED".
RULE F-08: Trimmed elements get Fixing Action = "TRIMMED".
RULE F-09: After all fixes, re-run coordinate calculations (§8.2 of PCF Syntax Master)
            to ensure LEN, AXIS, DELTA, and BRLEN are consistent.
RULE F-10: After all fixes, re-run validation checklist (V1-V20 of PCF Syntax Master)
            to verify no fixes introduced new errors.
```

### 12.3 Filler Pipe Template

```
When creating a gap-filler PIPE:

  csvSeqNo:     "{upstream_seq}.GF"
  type:         "PIPE"
  refNo:        "{upstream_ref}_GapFill"
  bore:         (from upstream element)
  ep1:          (upstream element EP2 — the gap start)
  ep2:          (downstream element EP1 — the gap end)
  skey:         null
  ca[1..10]:    (copy from upstream, except CA8 = null)
  ca[97]:       "={refNo}"
  ca[98]:       "{csvSeqNo}"
  fixingAction: "GAPFILLING"
  _logTags:     ["Calculated"]
```

---

## 13. AUTO-FIX TIER CLASSIFICATION

### Tier 1 — Auto-Fix Silently

Fixes so minor they need no user attention. Applied automatically, logged for record only.

| Rule | Fix |
|------|-----|
| R-GAP-01 | Close micro-gaps < 1mm by snapping |
| R-CHN-06 (< 2mm) | Snap shared-axis drift < 2mm |
| R-GEO-01 (< 6mm pipe) | Delete micro-pipes silently |

### Tier 2 — Auto-Fix With Log

Fixes that are safe but the user should know about. Applied automatically, prominently logged.

| Rule | Fix |
|------|-----|
| R-GAP-02 | Fill axial gaps ≤ 25mm with pipe |
| R-GAP-05 | Fill multi-axis gap where lateral < 2mm |
| R-GAP-07 | Adjust pipe for tee C dimension |
| R-OVR-01 | Trim pipe overlap ≤ 25mm |
| R-OVR-02 | Trim adjacent pipe when fitting overlaps |
| R-OVR-05 | Trim pipe for tee half-C |
| R-OVR-06 | Delete pipe consumed by overlap |
| R-CHN-02 (< 25mm) | Delete small fold-back pipes |
| R-CHN-05 (< 2mm) | Snap Z-drift in horizontal runs |
| R-CHN-06 (2–10mm) | Snap shared-axis drift with warning |
| R-GEO-03 (< 2mm) | Snap minor off-axis drift on elements |

### Tier 3 — Flag as Warning

Issues that may need attention but are not critical errors.

| Rule | Issue |
|------|-------|
| R-GAP-03 | Axial gap 25–100mm (suggest fill, don't auto-fix) |
| R-OVR-01 (> 25mm) | Large pipe overlap |
| R-GEO-04 | Fitting dimension deviation > 20% |
| R-GEO-05 | Non-standard bend radius |
| R-GEO-06 | Valve face-to-face mismatch |
| R-CHN-03 | Adjacent bends without adequate tangent |
| R-CHN-05 (2–10mm) | Moderate elevation drift |
| R-TOP-01 | Dead end at bare pipe |
| R-TOP-04 | Missing mating flange |
| R-TOP-05 | Flanged valve without adjacent flanges |
| R-BRN-02 (ratio > 0.5) | Olet where tee might be better |
| R-DAT-01 | Precision inconsistency |
| R-DAT-03 | Material change without joint |
| R-DAT-04 | Design condition discontinuity |
| R-DAT-06 | SKEY prefix mismatch |
| R-AGG-01 | Low pipe-to-fitting ratio |
| R-AGG-02 | Short tangent between bends |
| R-AGG-03 (5–50mm) | Route closure error |
| R-AGG-05 | Odd number of mid-chain flanges |
| R-AGG-06 | No supports on long chain |
| R-SPA-03 | Support on vertical run |
| R-SPA-05 | Suspicious placeholder coordinate |

### Tier 4 — Flag as Error (No Auto-Fix)

Critical issues requiring human intervention.

| Rule | Issue |
|------|-------|
| R-GAP-03 (> 100mm) | Major gap — missing components |
| R-GAP-04 | Lateral offset > 2mm |
| R-GAP-06 | Multi-axis gap with significant components |
| R-OVR-03 | Rigid-on-rigid overlap |
| R-OVR-04 | Enveloping overlap |
| R-GEO-01 (fitting) | Near-zero-length fitting |
| R-GEO-02 | Missing reducer at bore change |
| R-GEO-03 (> 2mm) | Diagonal pipe element |
| R-GEO-07 | Zero-length element |
| R-GEO-08 | Coordinate (0,0,0) |
| R-CHN-01 | Axis change without bend |
| R-CHN-02 (> 25mm) | Large fold-back pipe |
| R-CHN-06 (> 10mm) | Large lateral offset between consecutive elements |
| R-TOP-02 | Orphan element |
| R-TOP-03 | Duplicate element |
| R-TOP-06 | Support off pipe axis |
| R-TOP-07 | Tee CP outside header segment |
| R-BRN-01 | Branch bore > header bore |
| R-BRN-02 (ratio > 0.8) | Olet at near-equal bore |
| R-BRN-03 | Branch same axis as header |
| R-BRN-04 (> 15°) | Severely non-perpendicular branch |
| R-BRN-05 | Branch chain disconnected from tee BP |
| R-AGG-03 (> 50mm) | Major route closure error |

---

## 14. CONFIG PARAMETERS FOR SMART FIXER

All thresholds are editable in the Config tab:

```
smartFixer: {
  // Connectivity
  connectionTolerance: 25.0,       // mm — max distance to consider two points "connected"
  gridSnapResolution: 1.0,         // mm — spatial index grid cell size
  
  // Micro-element
  microPipeThreshold: 6.0,         // mm — pipes below this are deleted
  microFittingThreshold: 1.0,      // mm — fittings below this are flagged
  
  // Gap thresholds
  negligibleGap: 1.0,              // mm — gaps below this are snapped silently
  autoFillMaxGap: 25.0,            // mm — axial gaps up to this are auto-filled
  reviewGapMax: 100.0,             // mm — gaps up to this are warned; above = error
  
  // Overlap thresholds
  autoTrimMaxOverlap: 25.0,        // mm — pipe overlaps up to this are auto-trimmed
  
  // Snapping thresholds
  silentSnapThreshold: 2.0,        // mm — drift below this snapped silently
  warnSnapThreshold: 10.0,         // mm — drift below this snapped with warning
  
  // Fold-back
  autoDeleteFoldbackMax: 25.0,     // mm — fold-back pipes up to this are deleted
  
  // Axis detection
  offAxisThreshold: 0.5,           // mm — deltas below this are treated as zero
  diagonalMinorThreshold: 2.0,     // mm — minor axis deltas below this are snapped
  
  // Fitting dimensions
  fittingDimensionTolerance: 0.20, // 20% deviation from catalog triggers warning
  
  // Bend
  bendRadiusTolerance: 0.05,       // 5% deviation from 1.0D or 1.5D
  
  // Tangent
  minTangentMultiplier: 1.0,       // minimum tangent = multiplier × OD
  
  // Route closure
  closureWarningThreshold: 5.0,    // mm
  closureErrorThreshold: 50.0,     // mm
  
  // Bore
  maxBoreForInchDetection: 48,     // bore values ≤ this may be inches
  
  // Branch
  oletMaxRatioWarning: 0.5,        // branch/header ratio above this = warning
  oletMaxRatioError: 0.8,          // branch/header ratio above this = error
  branchPerpendicularityWarn: 5.0, // degrees from 90°
  branchPerpendicularityError: 15.0,
  
  // Elevation
  horizontalElevationDrift: 2.0,   // mm — Z drift in horizontal run
  
  // Aggregate
  minPipeRatio: 0.10,              // minimum pipe / total chain length ratio
  noSupportAlertLength: 10000.0,   // mm (10m) — warn if no supports above this
}
```

---

## 15. INTEGRATION WITH WORK INSTRUCTION

### 15.1 Processing Pipeline Update

The Smart Fixer inserts into the PCF Validator processing pipeline (WI-PCF-VALIDATOR-001) as follows:

```
Step 1:  Parse MESSAGE-SQUARE → pre-populate Data Table
Step 2:  Cross-verify MESSAGE-SQUARE vs Component Data
Step 3:  Fill missing identifiers
Step 4:  Bore unit conversion

  ┌──────────────────────────────────────────────────────┐
  │  NEW: Step 4A — BUILD CONNECTIVITY GRAPH (§1.3)      │
  │  NEW: Step 4B — WALK ALL CHAINS (§1.4)               │
  │  NEW: Step 4C — RUN ALL 57 RULES (§3–§11)            │
  │  NEW: Step 4D — APPLY TIER 1 + TIER 2 FIXES (§12)   │
  │  NEW: Step 4E — LOG ALL TIER 3 + TIER 4 FINDINGS     │
  └──────────────────────────────────────────────────────┘

Step 5:  Bi-directional coordinate calculation (RECALC after fixes)
Step 6:  CP/BP calculation
Step 7:  BRLEN fallback lookup
Step 8:  Branch bore fallback
Step 9:  SUPPORT mapping
Step 10: Pointer calculation
Step 11: MESSAGE-SQUARE regeneration
Step 12: Run Validation Checklist (V1–V20)
Step 13: Generate tally
```

### 15.2 Debug Tab Enhancement

The Debug tab's log table gains new columns for Smart Fixer output:

| Column | Description |
|--------|-------------|
| Chain | Chain ID (e.g., "Header", "Branch-1") |
| Walk Step | Position in chain walk (1, 2, 3...) |
| Rule | Rule ID (e.g., "R-GAP-02") |
| Tier | 1, 2, 3, or 4 |
| Fix Applied? | ✓ (Tier 1/2) or ✗ (Tier 3/4) |

### 15.3 Tally Table Enhancement

Add Smart Fixer summary to tally:

```
┌──────────────────────────┬───────────┐
│ Smart Fixer Summary      │ Count     │
├──────────────────────────┼───────────┤
│ Chains found             │     2     │
│ Total elements walked    │    17     │
│ Orphan elements          │     0     │
│ ─────────────────────────│───────────│
│ Tier 1 fixes (silent)    │     3     │
│ Tier 2 fixes (logged)    │     1     │
│ Tier 3 warnings          │     2     │
│ Tier 4 errors            │     0     │
│ ─────────────────────────│───────────│
│ Pipes inserted (gap fill)│     1     │
│ Pipes deleted (micro)    │     0     │
│ Pipes trimmed (overlap)  │     1     │
│ Coordinates snapped      │     3     │
│ ─────────────────────────│───────────│
│ Route closure error (mm) │     0.3   │
└──────────────────────────┴───────────┘
```

---

## 16. RULE QUICK REFERENCE (SORTED BY ID)

| ID | Category | Brief Description | Tier |
|----|----------|-------------------|------|
| R-GEO-01 | Geometric | Micro-element deletion (< 6mm pipe, < 1mm fitting) | 1/4 |
| R-GEO-02 | Geometric | Bore continuity — missing reducer | 4 |
| R-GEO-03 | Geometric | Single-axis element rule — diagonal detection | 2/4 |
| R-GEO-04 | Geometric | Fitting dimension sanity vs catalog | 3 |
| R-GEO-05 | Geometric | Bend radius vs 1.0D / 1.5D | 3 |
| R-GEO-06 | Geometric | Valve face-to-face check | 3 |
| R-GEO-07 | Geometric | Zero-length element | 4 |
| R-GEO-08 | Geometric | Coordinate magnitude / (0,0,0) check | 3/4 |
| R-TOP-01 | Topological | Dead-end detection | 3 |
| R-TOP-02 | Topological | Orphan element detection | 4 |
| R-TOP-03 | Topological | Duplicate element detection | 4 |
| R-TOP-04 | Topological | Flange pair check | 3 |
| R-TOP-05 | Topological | Valve flange sandwich | 3 |
| R-TOP-06 | Topological | Support on-pipe validation | 4 |
| R-TOP-07 | Topological | Tee CP on header segment | 4 |
| R-CHN-01 | Chain | Axis change without bend | 4 |
| R-CHN-02 | Chain | Fold-back detection | 2/4 |
| R-CHN-03 | Chain | Elbow-elbow proximity | 3 |
| R-CHN-04 | Chain | Sequence number ordering | Info |
| R-CHN-05 | Chain | Elevation drift in horizontal runs | 2/3 |
| R-CHN-06 | Chain | Shared-axis coordinate snapping | 1/2/4 |
| R-GAP-01 | Gap | Zero/negligible gap (< 1mm) | 1 |
| R-GAP-02 | Gap | Single-axis gap along travel ≤ 25mm | 2 |
| R-GAP-03 | Gap | Single-axis gap along travel > 25mm | 3/4 |
| R-GAP-04 | Gap | Lateral gap on non-travel axis | 2/4 |
| R-GAP-05 | Gap | Multi-axis gap, negligible lateral | 2 |
| R-GAP-06 | Gap | Multi-axis gap, significant components | 4 |
| R-GAP-07 | Gap | Gap at tee header junction | 2 |
| R-GAP-08 | Gap | Only pipes fill gaps | — (rule) |
| R-OVR-01 | Overlap | Simple axial overlap on pipe | 2/3 |
| R-OVR-02 | Overlap | Overlap where current is rigid | 2/4 |
| R-OVR-03 | Overlap | Rigid-on-rigid overlap | 4 |
| R-OVR-04 | Overlap | Enveloping overlap | 4 |
| R-OVR-05 | Overlap | Overlap at tee boundaries | 2/3 |
| R-OVR-06 | Overlap | Overlap creates negative pipe | 2 |
| R-BRN-01 | Branch | Branch bore > header bore | 4 |
| R-BRN-02 | Branch | Olet size ratio check | 3/4 |
| R-BRN-03 | Branch | Branch direction = header direction | 4 |
| R-BRN-04 | Branch | Branch perpendicularity | 3/4 |
| R-BRN-05 | Branch | Branch chain continuation | 4 |
| R-SPA-01 | Spatial | Elevation consistency | 2/3 |
| R-SPA-02 | Spatial | Coordinate snapping on shared axes | 1/2/4 |
| R-SPA-03 | Spatial | Gravity-aware support placement | 3 |
| R-SPA-04 | Spatial | Collinear pipe merge suggestion | Info |
| R-SPA-05 | Spatial | Suspicious placeholder coordinates | 3 |
| R-DAT-01 | Data Quality | Coordinate precision consistency | 3 |
| R-DAT-02 | Data Quality | Suspicious round numbers | 3 |
| R-DAT-03 | Data Quality | Material continuity | 3 |
| R-DAT-04 | Data Quality | Design condition continuity | 3 |
| R-DAT-05 | Data Quality | CA8 weight scope | 3 |
| R-DAT-06 | Data Quality | SKEY prefix mismatch | 3 |
| R-AGG-01 | Aggregate | Total pipe length sanity | 3/4 |
| R-AGG-02 | Aggregate | Minimum tangent between bends | 3 |
| R-AGG-03 | Aggregate | Route closure check | 3/4 |
| R-AGG-04 | Aggregate | Dead-end detection | 3 |
| R-AGG-05 | Aggregate | Flange pair completeness | 3 |
| R-AGG-06 | Aggregate | Component count sanity | 3 |

---

*End of Smart PCF Fixer — Chain Walker Rule Engine v1.0*


---

## B§12A. FIXING ACTION PREVIEW PROTOCOL

Before applying any Tier 2, 3, or 4 fix, populate the Data Table's "Fixing Action" column with a human-readable preview.

### Format Per Cell

```
Line 1: ACTION_VERB [Rule-ID]: Brief description
Line 2+: Details with coordinates, measurements
```

### Action Verbs (Mapped to Rules)

| Verb | Rules | Tier | Meaning |
|------|-------|------|---------|
| SNAP | R-GAP-01, R-CHN-06 | 1–2 | Align coordinates by snapping endpoints |
| INSERT | R-GAP-02, R-GAP-05, R-GAP-07 | 2 | Create new filler PIPE element |
| TRIM | R-OVR-01, R-OVR-02, R-OVR-05 | 2 | Shorten a PIPE element |
| DELETE | R-GEO-01, R-CHN-02, R-OVR-06 | 1–2 | Remove micro-pipe or fold-back |
| REVIEW | All Tier 3 rules | 3 | Warning requiring manual attention |
| ERROR | All Tier 4 rules | 4 | Critical issue, no auto-fix |

### Example Outputs

```
INSERT [R-GAP-02]: Fill 15.2mm axial gap along Y-South
  New PIPE: EP1=(96400.0, 17186.4, 101968.0) → EP2=(96400.0, 17171.2, 101968.0)
  Length: 15.2mm, Bore: 400.0mm, Inherited from Row 5

TRIM [R-OVR-01]: Reduce PIPE EP2 by 8.3mm along Y-South
  EP2 moves: (96400.0, 17178.1, 101968.0) → (96400.0, 17186.4, 101968.0)
  Overlap with Row 7 (TEE) resolved

DELETE [R-GEO-01]: Remove PIPE at Row 14
  Length: 2.3mm, Bore: 400.0mm
  Reason: Micro-element below 6mm threshold

ERROR [R-OVR-03]: 12.5mm rigid-on-rigid overlap
  FLANGE (Row 11) overlaps FLANGE (Row 15)
  Cannot auto-fix — both are catalog-dimension fittings

REVIEW [R-GAP-03]: 45.0mm gap along +Y(North)
  Exceeds 25mm auto-fill threshold
  Manual review required — suggest pipe fill
```

### Lifecycle

```
1. Smart Fix runs → populate Fixing Action column for all affected rows
2. User reviews in Data Table:
     Green (Tier 1): auto-fix applied silently
     Amber (Tier 2): auto-fix proposed, visible in column
     Orange (Tier 3): warning, no auto-fix
     Red (Tier 4): error, needs manual attention
3. User clicks [Apply Fixes]:
     Tier 1 + Tier 2 fixes execute
4. After fix applied:
     Clear Fixing Action text on fixed rows
     Change cell background to cyan (modified/calculated)
5. Re-run validation to confirm no new issues introduced
```

### Cell Styling by Tier

| Tier | Background | Border-Left | Badge |
|------|-----------|-------------|-------|
| 1 | #D4EDDA (green-50) | #28A745 | AUTO T1 |
| 2 | #FFF3CD (amber-50) | #FFC107 | FIX T2 |
| 3 | #FFE5D0 (orange-50) | #FD7E14 | REVIEW T3 |
| 4 | #F8D7DA (red-50) | #DC3545 | ERROR T4 |

---

# ═══════════════════════════════════════════════════════════
# PART C — IMPLEMENTATION (Smart Fix Add-On)
# Source: WI-PCF-SMARTFIX-001 Rev.0
# ═══════════════════════════════════════════════════════════

---

## 0. SCOPE AND CONTEXT

This Work Instruction directs an AI agent to implement the **Smart PCF Fixer** as an add-on module to the existing PCF Validator and Fixer web application.

### What Already Exists

The base app (per WI-PCF-VALIDATOR-001) provides:

- PCF text import and parsing
- Excel/CSV import with fuzzy header matching
- Data Table display with 42 columns
- Config tab with all settings (decimals, aliases, BRLEN database, etc.)
- Debug tab with log and tally
- Output tab with PCF preview and export
- Basic validation (V1–V20)
- Basic error fixing (Steps 1–13: identifiers, bore conversion, coordinate calc, CP/BP, BRLEN, pointers, MESSAGE-SQUARE)

### What This Add-On Provides

A **[Smart Fix]** button that, when clicked:

1. Builds a connectivity graph from the Data Table.
2. Walks element chains carrying travel context.
3. Runs 57 rules (R-GEO through R-AGG) from the Smart Fixer Rules.
4. Populates the **"Fixing Action"** column with previews of proposed fixes.
5. User reviews proposed fixes in the Data Table.
6. User clicks **[Apply Fixes]** to execute approved Tier 1 + Tier 2 fixes.
7. Data Table updates with corrected values (highlighted cells).
8. PCF regenerates from the updated Data Table.

**This add-on does NOT replace the existing fixer steps.** It inserts AFTER Step 4 (bore conversion) and BEFORE Step 5 (coordinate recalculation) in the processing pipeline.

---

## 1. INTEGRATION POINT

### 1.1 Pipeline Position

```
EXISTING PIPELINE:
  Step 1:  Parse MESSAGE-SQUARE
  Step 2:  Cross-verify MSG vs Component Data
  Step 3:  Fill missing identifiers
  Step 4:  Bore unit conversion
                                          ┌─────────────────────────┐
  ──────── [Smart Fix] button click ────► │  Step 4A: Build Graph   │
                                          │  Step 4B: Walk Chains   │
                                          │  Step 4C: Run 57 Rules  │
                                          │  Step 4D: Populate       │
                                          │    Fixing Action column  │
                                          │  Step 4E: User Reviews   │
                                          │  Step 4F: [Apply Fixes]  │
                                          │    Execute Tier 1+2      │
                                          └─────────┬───────────────┘
                                                    │
  Step 5:  Bi-directional coordinate recalc ◄───────┘  (re-run after fixes)
  Step 6:  CP/BP calculation
  Step 7:  BRLEN fallback
  Step 8:  Branch bore fallback
  Step 9:  SUPPORT mapping
  Step 10: Pointer calculation
  Step 11: MESSAGE-SQUARE regeneration
  Step 12: Validation V1–V20
  Step 13: Tally
```

### 1.2 UI Integration

```
EXISTING HEADER BAR:
  [Import PCF ▼]  [Import Excel/CSV ▼]     App Title

UPDATED HEADER BAR:
  [Import PCF ▼]  [Import Excel/CSV ▼]     App Title

EXISTING STATUS BAR:
  "Ready"   [Export Data Table ↓]  [Export PCF ↓]  [Run Validator ▶]

UPDATED STATUS BAR:
  "Ready"   [Export Data Table ↓]  [Export PCF ↓]  [Run Validator ▶]  [Smart Fix 🔧]  [Apply Fixes ✓]
                                                                       ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^
                                                                       NEW              NEW (disabled
                                                                                        until Smart Fix
                                                                                        has run)
```

### 1.3 Button States

| App State | [Smart Fix] | [Apply Fixes] |
|-----------|------------|---------------|
| No data loaded | Disabled | Disabled |
| Data Table populated (no smart fix run) | **Enabled** | Disabled |
| Smart Fix running | Disabled (spinner) | Disabled |
| Smart Fix complete (Fixing Actions populated) | Enabled (re-run) | **Enabled** |
| Apply Fixes running | Disabled | Disabled (spinner) |
| Fixes applied | **Enabled** (re-run) | Disabled |

---

## 2. NEW STATE ADDITIONS

Add these to the existing `useReducer` state:

```javascript
// Add to initialState:
{
  // ...existing state...

  // Smart Fixer state
  smartFix: {
    status: "idle",              // "idle" | "running" | "previewing" | "applying" | "applied"
    graph: null,                 // Connectivity graph object
    chains: [],                  // Array of walked chain results
    proposedFixes: [],           // Array of { ruleId, tier, rowIndex, action, description }
    appliedFixes: [],            // Array of applied fix records (for undo/audit)
    chainSummary: null,          // { chainCount, elementsWalked, orphans, ... }
    fixSummary: null,            // { tier1: n, tier2: n, tier3: n, tier4: n, inserted: n, ... }
  }
}
```

Add `fixingAction` field to each Data Table row object:

```javascript
// Extend existing row schema:
{
  // ...existing fields...
  fixingAction: null,            // String: human-readable fix preview (or null)
  fixingActionTier: null,        // Number: 1, 2, 3, or 4 (or null)
  fixingActionRuleId: null,      // String: "R-GAP-02", "R-OVR-01", etc. (or null)
}
```

---

## 3. NEW MODULES TO CREATE

### 3.1 File Structure

Create these as separate functions/sections within the existing single-file app, or as clearly demarcated code regions:

```
NEW CODE REGIONS (within existing .jsx):

  // ══════════════════════════════════════════════
  // SMART FIXER — CHAIN WALKER ENGINE
  // ══════════════════════════════════════════════

  Region A: Vector Math Utilities        (~40 lines)
  Region B: Connectivity Graph Builder   (~120 lines)
  Region C: Chain Walker                 (~200 lines)
  Region D: Element Axis Detector        (~60 lines)
  Region E: Gap/Overlap Analyzer         (~180 lines)
  Region F: Rule Engine (57 rules)       (~400 lines)
  Region G: Fix Application Engine       (~150 lines)
  Region H: Fixing Action Descriptor     (~80 lines)
  Region I: Smart Fix Orchestrator       (~60 lines)
  Region J: UI Components (button, etc.) (~100 lines)

  Estimated total: ~1,400 lines added
```

---

## 4. REGION A: VECTOR MATH UTILITIES

```javascript
// ══════════════════════════════════════════════
// SMART FIXER — VECTOR MATH
// ══════════════════════════════════════════════

const vec = {
  sub:   (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add:   (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
  dot:   (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  mag:   (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  normalize: (v) => {
    const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return m > 0 ? { x: v.x / m, y: v.y / m, z: v.z / m } : { x: 0, y: 0, z: 0 };
  },
  dist:  (a, b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2),
  mid:   (a, b) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2 }),
  approxEqual: (a, b, tol = 1.0) =>
    Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.z - b.z) <= tol,
  isZero: (v) => v.x === 0 && v.y === 0 && v.z === 0,
};
```

---

## 5. REGION B: CONNECTIVITY GRAPH BUILDER

### 5.1 Algorithm

```javascript
function buildConnectivityGraph(dataTable, config) {
  const tolerance = config.smartFixer?.connectionTolerance ?? 25.0;
  const gridSnap = config.smartFixer?.gridSnapResolution ?? 1.0;

  // Snap coordinate to grid for indexing
  const snap = (coord) => ({
    x: Math.round(coord.x / gridSnap) * gridSnap,
    y: Math.round(coord.y / gridSnap) * gridSnap,
    z: Math.round(coord.z / gridSnap) * gridSnap,
  });
  const coordKey = (c) => `${c.x},${c.y},${c.z}`;

  // Step 1: Classify connection points per component
  const components = dataTable
    .filter(row => row.type && !["ISOGEN-FILES","UNITS-BORE","UNITS-CO-ORDS",
      "UNITS-WEIGHT","UNITS-BOLT-DIA","UNITS-BOLT-LENGTH",
      "PIPELINE-REFERENCE","MESSAGE-SQUARE"].includes(row.type.toUpperCase()))
    .map(row => ({
      ...row,
      entryPoint: getEntryPoint(row),
      exitPoint: getExitPoint(row),
      branchExitPoint: getBranchExitPoint(row), // null except for TEE
    }));

  // Step 2: Build entry-point spatial index
  const entryIndex = new Map();
  for (const comp of components) {
    if (comp.entryPoint && !vec.isZero(comp.entryPoint)) {
      const key = coordKey(snap(comp.entryPoint));
      if (!entryIndex.has(key)) entryIndex.set(key, []);
      entryIndex.get(key).push(comp);
    }
  }

  // Step 3: Match exits to entries (build edges)
  const edges = new Map();      // comp._rowIndex → next comp
  const branchEdges = new Map(); // comp._rowIndex → branch start comp (TEE only)
  const hasIncoming = new Set(); // row indices that have an incoming connection

  for (const comp of components) {
    if (!comp.exitPoint || vec.isZero(comp.exitPoint)) continue;

    const match = findNearestEntry(comp.exitPoint, entryIndex, snap, coordKey, tolerance, comp._rowIndex);
    if (match) {
      edges.set(comp._rowIndex, match);
      hasIncoming.add(match._rowIndex);
    }

    // Branch edge for TEE
    if (comp.branchExitPoint && !vec.isZero(comp.branchExitPoint)) {
      const brMatch = findNearestEntry(comp.branchExitPoint, entryIndex, snap, coordKey, tolerance, comp._rowIndex);
      if (brMatch) {
        branchEdges.set(comp._rowIndex, brMatch);
        hasIncoming.add(brMatch._rowIndex);
      }
    }
  }

  // Step 4: Find chain terminals (no incoming connection)
  const terminals = components.filter(c =>
    !hasIncoming.has(c._rowIndex) && c.type !== "SUPPORT"
  );

  // Step 5: Find orphans (will be detected after walking)
  // (Deferred — orphans = components not visited by any chain walk)

  return {
    components,
    edges,         // rowIndex → next component
    branchEdges,   // rowIndex → branch start component
    terminals,
    entryIndex,
  };
}
```

### 5.2 Helper Functions

```javascript
function getEntryPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "SUPPORT") return row.supportCoor || null;
  if (t === "OLET")    return row.cp || null;  // OLET enters at CP
  return row.ep1 || null;
}

function getExitPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "SUPPORT") return null;            // SUPPORT has no exit
  if (t === "OLET")    return row.bp || null;  // OLET exits at BP
  return row.ep2 || null;
}

function getBranchExitPoint(row) {
  const t = (row.type || "").toUpperCase();
  if (t === "TEE") return row.bp || null;      // TEE branches at BP
  return null;
}

function findNearestEntry(exitCoord, entryIndex, snap, coordKey, tolerance, excludeRowIndex) {
  // Search in snapped grid neighborhood
  const snapped = snap(exitCoord);
  const key = coordKey(snapped);

  // Direct grid hit
  const candidates = entryIndex.get(key) || [];
  let best = null;
  let bestDist = tolerance + 1;

  for (const cand of candidates) {
    if (cand._rowIndex === excludeRowIndex) continue;
    const d = vec.dist(exitCoord, cand.entryPoint);
    if (d < bestDist) { bestDist = d; best = cand; }
  }

  // Also search adjacent grid cells (±1 step) for near-misses
  if (!best) {
    const step = snap({ x: 1, y: 1, z: 1 }).x; // gridSnap value
    for (let dx = -step; dx <= step; dx += step) {
      for (let dy = -step; dy <= step; dy += step) {
        for (let dz = -step; dz <= step; dz += step) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nk = coordKey({
            x: snapped.x + dx, y: snapped.y + dy, z: snapped.z + dz
          });
          for (const cand of (entryIndex.get(nk) || [])) {
            if (cand._rowIndex === excludeRowIndex) continue;
            const d = vec.dist(exitCoord, cand.entryPoint);
            if (d < bestDist) { bestDist = d; best = cand; }
          }
        }
      }
    }
  }

  return best;
}
```

---

## 6. REGION C: CHAIN WALKER

### 6.1 Main Walk Function

```javascript
function walkAllChains(graph, config, log) {
  const visited = new Set();
  const allChains = [];

  // Walk from each terminal
  for (const terminal of graph.terminals) {
    if (visited.has(terminal._rowIndex)) continue;

    const context = createInitialContext(terminal, allChains.length);
    const chain = walkChain(terminal, graph, context, visited, config, log);
    allChains.push(chain);
  }

  // Detect orphans
  const orphans = graph.components.filter(c =>
    !visited.has(c._rowIndex) && c.type !== "SUPPORT"
  );
  for (const orphan of orphans) {
    log.push({
      type: "Error", ruleId: "R-TOP-02", tier: 4,
      row: orphan._rowIndex,
      message: `Orphan: ${orphan.type} (Row ${orphan._rowIndex}) not connected to any chain.`
    });
  }

  return { chains: allChains, orphans };
}

function createInitialContext(startElement, chainIndex) {
  return {
    travelAxis: null,
    travelDirection: null,
    currentBore: startElement.bore || 0,
    currentMaterial: startElement.ca?.[3] || "",
    currentPressure: startElement.ca?.[1] || "",
    currentTemp: startElement.ca?.[2] || "",
    chainId: `Chain-${chainIndex + 1}`,
    cumulativeVector: { x: 0, y: 0, z: 0 },
    pipeLengthSum: 0,
    lastFittingType: null,
    elevation: startElement.ep1?.z || 0,
    depth: 0,
    pipeSinceLastBend: Infinity, // large initial value
  };
}
```

### 6.2 Single Chain Walk

```javascript
function walkChain(startElement, graph, context, visited, config, log) {
  const chain = [];
  let current = startElement;
  let prevElement = null;

  while (current && !visited.has(current._rowIndex)) {
    visited.add(current._rowIndex);
    const type = (current.type || "").toUpperCase();

    // Skip SUPPORTs in the chain walk (they are point elements, not flow elements)
    // But still validate them
    if (type === "SUPPORT") {
      runSupportRules(current, chain, context, config, log);
      current = graph.edges.get(current._rowIndex) || null;
      continue;
    }

    // ─── A. DETECT ELEMENT AXIS ───
    const [elemAxis, elemDir] = detectElementAxis(current, config);

    // ─── B. RUN ELEMENT-LEVEL RULES ───
    runElementRules(current, context, prevElement, elemAxis, elemDir, config, log);

    // ─── C. UPDATE CONTEXT ───
    if (elemAxis) {
      context.travelAxis = elemAxis;
      context.travelDirection = elemDir;
    }
    if (current.bore) context.currentBore = current.bore;
    if (current.ca?.[3]) context.currentMaterial = current.ca[3];
    const elemVec = getElementVector(current);
    context.cumulativeVector = vec.add(context.cumulativeVector, elemVec);
    if (type === "PIPE") {
      const len = vec.mag(elemVec);
      context.pipeLengthSum += len;
      context.pipeSinceLastBend += len;
    }
    if (type === "BEND") context.pipeSinceLastBend = 0;
    if (!["PIPE", "SUPPORT"].includes(type)) context.lastFittingType = type;

    // ─── D. FIND NEXT ELEMENT AND ANALYZE GAP ───
    const nextElement = graph.edges.get(current._rowIndex) || null;
    let gapVector = null;
    let fixAction = null;

    if (nextElement) {
      const exitPt = getExitPoint(current);
      const entryPt = getEntryPoint(nextElement);
      if (exitPt && entryPt) {
        gapVector = vec.sub(entryPt, exitPt);
        fixAction = analyzeGap(gapVector, context, current, nextElement, config, log);
      }
    }

    // ─── E. RECORD CHAIN LINK ───
    chain.push({
      element: current,
      elemAxis,
      elemDir,
      travelAxis: context.travelAxis,
      travelDirection: context.travelDirection,
      gapToNext: gapVector,
      fixAction,
      nextElement,
      branchChain: null,
    });

    // ─── F. BRANCH HANDLING (TEE) ───
    if (type === "TEE") {
      const branchStart = graph.branchEdges.get(current._rowIndex);
      if (branchStart && !visited.has(branchStart._rowIndex)) {
        const branchCtx = {
          ...structuredClone(context),
          travelAxis: detectBranchAxis(current),
          travelDirection: detectBranchDirection(current),
          currentBore: current.branchBore || current.bore,
          depth: context.depth + 1,
          chainId: `${context.chainId}.B`,
          pipeLengthSum: 0,
          cumulativeVector: { x: 0, y: 0, z: 0 },
          pipeSinceLastBend: Infinity,
        };
        const branchChain = walkChain(branchStart, graph, branchCtx, visited, config, log);
        chain[chain.length - 1].branchChain = branchChain;
      }
    }

    // ─── G. ADVANCE ───
    prevElement = current;
    current = nextElement;
  }

  // ─── H. POST-WALK AGGREGATE RULES ───
  runAggregateRules(chain, context, config, log);

  return chain;
}
```

---

## 7. REGION D: ELEMENT AXIS DETECTOR

```javascript
function detectElementAxis(element, config) {
  const threshold = config.smartFixer?.offAxisThreshold ?? 0.5;
  const type = (element.type || "").toUpperCase();

  if (type === "SUPPORT" || type === "OLET") return [null, null];

  const ep1 = element.ep1;
  const ep2 = element.ep2;
  if (!ep1 || !ep2) return [null, null];

  const dx = ep2.x - ep1.x;
  const dy = ep2.y - ep1.y;
  const dz = ep2.z - ep1.z;

  const axes = [];
  if (Math.abs(dx) > threshold) axes.push(["X", dx]);
  if (Math.abs(dy) > threshold) axes.push(["Y", dy]);
  if (Math.abs(dz) > threshold) axes.push(["Z", dz]);

  if (axes.length === 0) return [null, null];

  if (axes.length === 1) {
    return [axes[0][0], axes[0][1] > 0 ? 1 : -1];
  }

  // Multi-axis: for BEND this is expected (return outgoing axis)
  if (type === "BEND") {
    // Outgoing axis = the axis with the EP2-dominant delta
    // that differs from the incoming axis
    const sorted = [...axes].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return [sorted[0][0], sorted[0][1] > 0 ? 1 : -1];
  }

  // For straight elements (PIPE, FLANGE, VALVE, REDUCER): pick dominant axis
  const dominant = axes.reduce((a, b) => Math.abs(a[1]) > Math.abs(b[1]) ? a : b);
  return [dominant[0], dominant[1] > 0 ? 1 : -1];
}

function detectBranchAxis(teeElement) {
  if (!teeElement.bp || !teeElement.cp) return null;
  const bv = vec.sub(teeElement.bp, teeElement.cp);
  const axes = [["X", Math.abs(bv.x)], ["Y", Math.abs(bv.y)], ["Z", Math.abs(bv.z)]];
  const dominant = axes.reduce((a, b) => a[1] > b[1] ? a : b);
  return dominant[0];
}

function detectBranchDirection(teeElement) {
  if (!teeElement.bp || !teeElement.cp) return null;
  const bv = vec.sub(teeElement.bp, teeElement.cp);
  const axis = detectBranchAxis(teeElement);
  if (!axis) return null;
  return bv[axis.toLowerCase()] > 0 ? 1 : -1;
}

function getElementVector(element) {
  const type = (element.type || "").toUpperCase();
  if (type === "SUPPORT" || type === "OLET") return { x: 0, y: 0, z: 0 };
  if (!element.ep1 || !element.ep2) return { x: 0, y: 0, z: 0 };
  return vec.sub(element.ep2, element.ep1);
}
```

---

## 8. REGION E: GAP/OVERLAP ANALYZER

```javascript
function analyzeGap(gapVector, context, current, next, config, log) {
  const cfg = config.smartFixer || {};
  const negligible = cfg.negligibleGap ?? 1.0;
  const autoFillMax = cfg.autoFillMaxGap ?? 25.0;
  const reviewMax = cfg.reviewGapMax ?? 100.0;
  const autoTrimMax = cfg.autoTrimMaxOverlap ?? 25.0;
  const silentSnap = cfg.silentSnapThreshold ?? 2.0;
  const warnSnap = cfg.warnSnapThreshold ?? 10.0;

  const gapMag = vec.mag(gapVector);

  // ─── R-GAP-01: Negligible gap ───
  if (gapMag < negligible) {
    if (gapMag > 0.1) {
      return { type: "SNAP", ruleId: "R-GAP-01", tier: 1,
        description: `SNAP [R-GAP-01]: Close ${gapMag.toFixed(2)}mm micro-gap by snapping endpoints.`,
        gapVector, current, next };
    }
    return null; // Perfect connection
  }

  // Decompose gap into axes
  const axes = decomposeGap(gapVector, cfg.offAxisThreshold ?? 0.5);
  const alongTravel = axes.find(a => a.axis === context.travelAxis);
  const lateral = axes.filter(a => a.axis !== context.travelAxis);
  const totalLateral = lateral.reduce((s, a) => s + Math.abs(a.delta), 0);
  const alongDelta = alongTravel ? alongTravel.delta : 0;
  const isOverlap = alongDelta * context.travelDirection < 0; // negative gap = overlap

  // ─── OVERLAP PATH ───
  if (isOverlap && axes.length === 1 && axes[0].axis === context.travelAxis) {
    const overlapAmt = Math.abs(alongDelta);
    return analyzeOverlap(overlapAmt, context, current, next, cfg, log);
  }

  // ─── GAP PATH ───

  // Single-axis gap along travel
  if (axes.length === 1 && axes[0].axis === context.travelAxis) {
    const gapAmt = Math.abs(alongDelta);
    const dir = directionLabel(context.travelAxis, context.travelDirection);

    if (gapAmt <= autoFillMax) {
      return { type: "INSERT", ruleId: "R-GAP-02", tier: 2,
        description: buildInsertDescription(gapAmt, dir, context, current),
        gapAmount: gapAmt, fillAxis: context.travelAxis, fillDir: context.travelDirection,
        current, next };
    }
    if (gapAmt <= reviewMax) {
      return { type: "REVIEW", ruleId: "R-GAP-03", tier: 3,
        description: `REVIEW [R-GAP-03]: ${gapAmt.toFixed(1)}mm gap along ${dir}. Exceeds ${autoFillMax}mm auto-fill threshold. Manual review.`,
        current, next };
    }
    return { type: "ERROR", ruleId: "R-GAP-03", tier: 4,
      description: `ERROR [R-GAP-03]: ${gapAmt.toFixed(1)}mm gap along ${dir}. Major gap — likely missing component(s).`,
      current, next };
  }

  // Single-axis gap on NON-travel axis (lateral)
  if (axes.length === 1 && axes[0].axis !== context.travelAxis) {
    const latAmt = Math.abs(axes[0].delta);
    if (latAmt < silentSnap) {
      return { type: "SNAP", ruleId: "R-GAP-04", tier: 2,
        description: `SNAP [R-GAP-04]: Lateral offset ${latAmt.toFixed(1)}mm on ${axes[0].axis}-axis (travel is ${context.travelAxis}). Snapping to align.`,
        current, next };
    }
    return { type: "ERROR", ruleId: "R-GAP-04", tier: 4,
      description: `ERROR [R-GAP-04]: Lateral offset ${latAmt.toFixed(1)}mm on ${axes[0].axis}-axis. Pipe has shifted sideways. Manual review.`,
      current, next };
  }

  // Multi-axis gap with negligible lateral
  if (axes.length >= 2 && totalLateral < silentSnap && Math.abs(alongDelta) <= autoFillMax) {
    const gapAmt = Math.abs(alongDelta);
    const dir = directionLabel(context.travelAxis, context.travelDirection);
    return { type: "INSERT", ruleId: "R-GAP-05", tier: 2,
      description: `INSERT [R-GAP-05]: Multi-axis gap (axial=${gapAmt.toFixed(1)}mm, lateral=${totalLateral.toFixed(1)}mm). Lateral snapped, axial filled with ${gapAmt.toFixed(1)}mm pipe ${dir}.`,
      gapAmount: gapAmt, fillAxis: context.travelAxis, fillDir: context.travelDirection,
      current, next };
  }

  // Multi-axis gap with significant components
  return { type: "ERROR", ruleId: "R-GAP-06", tier: 4,
    description: `ERROR [R-GAP-06]: Multi-axis gap (${formatGapAxes(axes)}). Cannot auto-fill. Rigorous manual review required.`,
    current, next };
}

function analyzeOverlap(overlapAmt, context, current, next, cfg, log) {
  const autoTrimMax = cfg.autoTrimMaxOverlap ?? 25.0;
  const currType = (current.type || "").toUpperCase();
  const nextType = (next.type || "").toUpperCase();
  const dir = directionLabel(context.travelAxis, context.travelDirection);

  // R-OVR-03: Rigid-on-rigid
  if (currType !== "PIPE" && nextType !== "PIPE") {
    return { type: "ERROR", ruleId: "R-OVR-03", tier: 4,
      description: `ERROR [R-OVR-03]: ${currType} overlaps ${nextType} by ${overlapAmt.toFixed(1)}mm. Both are rigid fittings. Cannot auto-trim.`,
      current, next };
  }

  // R-OVR-01: Current is PIPE — trim it
  if (currType === "PIPE" && overlapAmt <= autoTrimMax) {
    return { type: "TRIM", ruleId: "R-OVR-01", tier: 2,
      description: buildTrimDescription(overlapAmt, dir, current, next, "current"),
      trimAmount: overlapAmt, trimTarget: "current",
      current, next };
  }

  // R-OVR-02: Current is rigid, next is PIPE — trim next
  if (currType !== "PIPE" && nextType === "PIPE" && overlapAmt <= autoTrimMax) {
    return { type: "TRIM", ruleId: "R-OVR-02", tier: 2,
      description: buildTrimDescription(overlapAmt, dir, current, next, "next"),
      trimAmount: overlapAmt, trimTarget: "next",
      current, next };
  }

  // Large overlap
  return { type: "REVIEW", ruleId: "R-OVR-01", tier: 3,
    description: `REVIEW [R-OVR-01]: ${overlapAmt.toFixed(1)}mm overlap between ${currType} (Row ${current._rowIndex}) and ${nextType} (Row ${next._rowIndex}). Exceeds ${autoTrimMax}mm auto-trim threshold.`,
    current, next };
}

// ─── Gap decomposition ───
function decomposeGap(gapVec, threshold) {
  const result = [];
  if (Math.abs(gapVec.x) > threshold) result.push({ axis: "X", delta: gapVec.x });
  if (Math.abs(gapVec.y) > threshold) result.push({ axis: "Y", delta: gapVec.y });
  if (Math.abs(gapVec.z) > threshold) result.push({ axis: "Z", delta: gapVec.z });
  return result;
}

function directionLabel(axis, dir) {
  const map = { X: ["+X(East)", "-X(West)"], Y: ["+Y(North)", "-Y(South)"], Z: ["+Z(Up)", "-Z(Down)"] };
  return axis ? (dir > 0 ? map[axis][0] : map[axis][1]) : "unknown";
}

function formatGapAxes(axes) {
  return axes.map(a => `${a.axis}=${a.delta.toFixed(1)}mm`).join(", ");
}
```

---

## 9. REGION F: RULE ENGINE

The rule engine is organized as three runner functions called at different points in the walk.

### 9.1 Element-Level Rules (called per element)

```javascript
function runElementRules(element, context, prevElement, elemAxis, elemDir, config, log) {
  const type = (element.type || "").toUpperCase();
  const cfg = config.smartFixer || {};
  const ri = element._rowIndex;

  // R-GEO-01: Micro-element
  if (type === "PIPE") {
    const len = vec.mag(getElementVector(element));
    if (len < (cfg.microPipeThreshold ?? 6.0) && len > 0) {
      log.push({ type: "Fix", ruleId: "R-GEO-01", tier: 1, row: ri,
        message: `DELETE [R-GEO-01]: Micro-pipe ${len.toFixed(1)}mm < ${cfg.microPipeThreshold ?? 6}mm threshold.` });
      element._proposedFix = { type: "DELETE", ruleId: "R-GEO-01", tier: 1 };
    }
  }

  // R-GEO-02: Bore continuity
  if (prevElement && element.bore !== context.currentBore) {
    const prevType = (prevElement.type || "").toUpperCase();
    if (!prevType.includes("REDUCER")) {
      log.push({ type: "Error", ruleId: "R-GEO-02", tier: 4, row: ri,
        message: `ERROR [R-GEO-02]: Bore changes ${context.currentBore}→${element.bore} without reducer.` });
    }
  }

  // R-GEO-03: Single-axis rule for straight elements
  if (["PIPE", "FLANGE", "VALVE"].includes(type) && type !== "BEND") {
    const ev = getElementVector(element);
    const nonZero = [["X", ev.x], ["Y", ev.y], ["Z", ev.z]].filter(([_, d]) => Math.abs(d) > 0.5);
    if (nonZero.length > 1) {
      const dominant = nonZero.reduce((a, b) => Math.abs(a[1]) > Math.abs(b[1]) ? a : b);
      const minorTotal = nonZero.filter(a => a[0] !== dominant[0]).reduce((s, a) => s + Math.abs(a[1]), 0);
      if (minorTotal < (cfg.diagonalMinorThreshold ?? 2.0)) {
        log.push({ type: "Fix", ruleId: "R-GEO-03", tier: 2, row: ri,
          message: `SNAP [R-GEO-03]: ${type} off-axis drift ${minorTotal.toFixed(1)}mm. Snapping to pure ${dominant[0]}-axis.` });
        element._proposedFix = { type: "SNAP_AXIS", ruleId: "R-GEO-03", tier: 2, dominantAxis: dominant[0] };
      } else {
        log.push({ type: "Error", ruleId: "R-GEO-03", tier: 4, row: ri,
          message: `ERROR [R-GEO-03]: ${type} runs diagonally (${nonZero.map(([a,d]) => `${a}=${d.toFixed(1)}`).join(", ")}). Must align to single axis.` });
      }
    }
  }

  // R-GEO-07: Zero-length element
  if (!["SUPPORT", "OLET"].includes(type) && element.ep1 && element.ep2) {
    if (vec.approxEqual(element.ep1, element.ep2, 0.1)) {
      log.push({ type: "Error", ruleId: "R-GEO-07", tier: 4, row: ri,
        message: `ERROR [R-GEO-07]: ${type} has zero length (EP1 ≈ EP2).` });
    }
  }

  // R-CHN-01: Axis change without bend
  if (context.travelAxis && elemAxis && elemAxis !== context.travelAxis) {
    if (!["BEND", "TEE"].includes(type)) {
      log.push({ type: "Error", ruleId: "R-CHN-01", tier: 4, row: ri,
        message: `ERROR [R-CHN-01]: Axis changed ${context.travelAxis}→${elemAxis} at ${type}. Missing BEND?` });
    }
  }

  // R-CHN-02: Fold-back
  if (context.travelAxis && elemAxis === context.travelAxis && elemDir !== context.travelDirection) {
    if (type === "PIPE") {
      const foldLen = vec.mag(getElementVector(element));
      if (foldLen < (cfg.autoDeleteFoldbackMax ?? 25.0)) {
        log.push({ type: "Fix", ruleId: "R-CHN-02", tier: 2, row: ri,
          message: `DELETE [R-CHN-02]: Fold-back pipe ${foldLen.toFixed(1)}mm on ${elemAxis}-axis.` });
        element._proposedFix = { type: "DELETE", ruleId: "R-CHN-02", tier: 2 };
      } else {
        log.push({ type: "Error", ruleId: "R-CHN-02", tier: 4, row: ri,
          message: `ERROR [R-CHN-02]: Fold-back ${foldLen.toFixed(1)}mm on ${elemAxis}-axis. Too large to auto-delete.` });
      }
    } else if (type !== "BEND") {
      log.push({ type: "Error", ruleId: "R-CHN-02", tier: 4, row: ri,
        message: `ERROR [R-CHN-02]: ${type} reverses direction on ${elemAxis}-axis.` });
    }
  }

  // R-CHN-03: Elbow-elbow proximity
  if (type === "BEND" && context.lastFittingType === "BEND") {
    if (context.pipeSinceLastBend < (cfg.minTangentMultiplier ?? 1.0) * (element.bore || 0) * 0.0254) {
      // Using OD approximation; for real impl use config.pipe_OD[bore]
      log.push({ type: "Warning", ruleId: "R-CHN-03", tier: 3, row: ri,
        message: `WARNING [R-CHN-03]: Only ${context.pipeSinceLastBend.toFixed(0)}mm pipe between bends. Short tangent.` });
    }
  }

  // R-CHN-06: Shared-axis coordinate snapping
  if (prevElement && context.travelAxis && elemAxis === context.travelAxis) {
    const exitPt = getExitPoint(prevElement);
    const entryPt = getEntryPoint(element);
    if (exitPt && entryPt) {
      const nonTravelAxes = ["X", "Y", "Z"].filter(a => a !== context.travelAxis);
      for (const axis of nonTravelAxes) {
        const key = axis.toLowerCase();
        const drift = Math.abs(entryPt[key] - exitPt[key]);
        if (drift > 0.1 && drift < (cfg.silentSnapThreshold ?? 2.0)) {
          log.push({ type: "Fix", ruleId: "R-CHN-06", tier: 1, row: ri,
            message: `SNAP [R-CHN-06]: ${axis} drifted ${drift.toFixed(1)}mm. Silent snap.` });
        } else if (drift >= (cfg.silentSnapThreshold ?? 2.0) && drift < (cfg.warnSnapThreshold ?? 10.0)) {
          log.push({ type: "Fix", ruleId: "R-CHN-06", tier: 2, row: ri,
            message: `SNAP [R-CHN-06]: ${axis} drifted ${drift.toFixed(1)}mm. Snap with warning.` });
        } else if (drift >= (cfg.warnSnapThreshold ?? 10.0)) {
          log.push({ type: "Error", ruleId: "R-CHN-06", tier: 4, row: ri,
            message: `ERROR [R-CHN-06]: ${axis} offset ${drift.toFixed(1)}mm. Too large to snap.` });
        }
      }
    }
  }

  // R-DAT-03: Material continuity
  if (context.currentMaterial && element.ca?.[3] && element.ca[3] !== context.currentMaterial) {
    const prevType = prevElement ? (prevElement.type || "").toUpperCase() : "";
    if (!["FLANGE", "VALVE"].includes(prevType)) {
      log.push({ type: "Warning", ruleId: "R-DAT-03", tier: 3, row: ri,
        message: `WARNING [R-DAT-03]: Material changes ${context.currentMaterial}→${element.ca[3]} without joint.` });
    }
  }

  // R-BRN-01: Branch bore > header bore (for TEE)
  if (type === "TEE" && element.branchBore > element.bore) {
    log.push({ type: "Error", ruleId: "R-BRN-01", tier: 4, row: ri,
      message: `ERROR [R-BRN-01]: Branch bore (${element.branchBore}) > header bore (${element.bore}).` });
  }

  // R-BRN-04: Branch perpendicularity (for TEE)
  if (type === "TEE" && element.ep1 && element.ep2 && element.cp && element.bp) {
    const headerVec = vec.sub(element.ep2, element.ep1);
    const branchVec = vec.sub(element.bp, element.cp);
    const hMag = vec.mag(headerVec);
    const bMag = vec.mag(branchVec);
    if (hMag > 0 && bMag > 0) {
      const dotProd = Math.abs(vec.dot(headerVec, branchVec));
      const cosAngle = dotProd / (hMag * bMag);
      const angleDeg = Math.acos(Math.min(cosAngle, 1.0)) * 180 / Math.PI;
      const offPerp = Math.abs(90 - angleDeg);
      if (offPerp > (cfg.branchPerpendicularityError ?? 15.0)) {
        log.push({ type: "Error", ruleId: "R-BRN-04", tier: 4, row: ri,
          message: `ERROR [R-BRN-04]: Branch ${offPerp.toFixed(1)}° from perpendicular.` });
      } else if (offPerp > (cfg.branchPerpendicularityWarn ?? 5.0)) {
        log.push({ type: "Warning", ruleId: "R-BRN-04", tier: 3, row: ri,
          message: `WARNING [R-BRN-04]: Branch ${offPerp.toFixed(1)}° from perpendicular.` });
      }
    }
  }

  // R-DAT-06: SKEY prefix consistency
  if (element.skey) {
    const prefixMap = { FLANGE: "FL", VALVE: "V", BEND: "BE", TEE: "TE", OLET: "OL" };
    const expected = prefixMap[type];
    if (expected && !element.skey.startsWith(expected)) {
      log.push({ type: "Warning", ruleId: "R-DAT-06", tier: 3, row: ri,
        message: `WARNING [R-DAT-06]: SKEY '${element.skey}' prefix mismatch for ${type} (expected '${expected}...').` });
    }
  }
}
```

### 9.2 Support-Specific Rules

```javascript
function runSupportRules(support, chain, context, config, log) {
  const ri = support._rowIndex;
  const coor = support.supportCoor;
  if (!coor) return;

  // R-TOP-06: Support on-pipe validation
  // Find nearest pipe in chain and check perpendicular distance
  let minDist = Infinity;
  for (const link of chain) {
    if ((link.element.type || "").toUpperCase() !== "PIPE") continue;
    const ep1 = link.element.ep1;
    const ep2 = link.element.ep2;
    if (!ep1 || !ep2) continue;

    const pipeVec = vec.sub(ep2, ep1);
    const pipeLen = vec.mag(pipeVec);
    if (pipeLen < 0.1) continue;

    const toSupport = vec.sub(coor, ep1);
    const t = vec.dot(toSupport, pipeVec) / (pipeLen * pipeLen);
    const projection = vec.add(ep1, vec.scale(pipeVec, Math.max(0, Math.min(1, t))));
    const perpDist = vec.dist(coor, projection);

    if (perpDist < minDist) minDist = perpDist;
  }

  if (minDist > 5.0 && minDist < Infinity) {
    log.push({ type: "Error", ruleId: "R-TOP-06", tier: 4, row: ri,
      message: `ERROR [R-TOP-06]: Support is ${minDist.toFixed(1)}mm off the nearest pipe axis.` });
  }

  // R-SPA-03: Support on vertical run
  if (context.travelAxis === "Z") {
    log.push({ type: "Warning", ruleId: "R-SPA-03", tier: 3, row: ri,
      message: `WARNING [R-SPA-03]: Support on vertical pipe run. Verify support type.` });
  }
}
```

### 9.3 Aggregate Rules (called after full chain walk)

```javascript
function runAggregateRules(chain, context, config, log) {
  const cfg = config.smartFixer || {};
  const chainId = context.chainId;

  // R-AGG-01: Total pipe length sanity
  if (context.pipeLengthSum <= 0 && chain.length > 0) {
    log.push({ type: "Error", ruleId: "R-AGG-01", tier: 4, row: chain[0]?.element?._rowIndex,
      message: `ERROR [R-AGG-01]: ${chainId} has zero pipe length. Fundamentally broken.` });
  }

  // R-AGG-03: Route closure check
  if (chain.length >= 2) {
    const startPt = getEntryPoint(chain[0].element);
    const endPt = getExitPoint(chain[chain.length - 1].element);
    if (startPt && endPt) {
      const expected = vec.sub(endPt, startPt);
      const actual = context.cumulativeVector;
      const error = vec.mag(vec.sub(expected, actual));
      const closureWarn = cfg.closureWarningThreshold ?? 5.0;
      const closureErr = cfg.closureErrorThreshold ?? 50.0;
      if (error > closureErr) {
        log.push({ type: "Error", ruleId: "R-AGG-03", tier: 4, row: chain[0]?.element?._rowIndex,
          message: `ERROR [R-AGG-03]: ${chainId} closure error ${error.toFixed(1)}mm.` });
      } else if (error > closureWarn) {
        log.push({ type: "Warning", ruleId: "R-AGG-03", tier: 3, row: chain[0]?.element?._rowIndex,
          message: `WARNING [R-AGG-03]: ${chainId} closure error ${error.toFixed(1)}mm.` });
      }
    }
  }

  // R-AGG-04 / R-TOP-01: Dead-end detection
  if (chain.length > 0) {
    const lastElem = chain[chain.length - 1].element;
    const lastType = (lastElem.type || "").toUpperCase();
    if (lastType === "PIPE") {
      log.push({ type: "Warning", ruleId: "R-TOP-01", tier: 3, row: lastElem._rowIndex,
        message: `WARNING [R-TOP-01]: ${chainId} ends at bare PIPE. Expected terminal fitting.` });
    }
  }

  // R-AGG-05: Flange pair completeness
  const midFlanges = chain.filter((link, i) => {
    return (link.element.type || "").toUpperCase() === "FLANGE" && i > 0 && i < chain.length - 1;
  });
  if (midFlanges.length % 2 !== 0) {
    log.push({ type: "Warning", ruleId: "R-AGG-05", tier: 3, row: midFlanges[0]?.element?._rowIndex,
      message: `WARNING [R-AGG-05]: ${chainId} has ${midFlanges.length} mid-chain flanges (odd). Missing mating flange?` });
  }

  // R-AGG-06: No supports on long chain
  const chainLenM = vec.mag(context.cumulativeVector) / 1000;
  if (chainLenM > ((cfg.noSupportAlertLength ?? 10000) / 1000)) {
    // Count supports encountered (they were skipped in walk but we can check dataTable)
    // For now, flag based on pipe length
    log.push({ type: "Warning", ruleId: "R-AGG-06", tier: 3, row: chain[0]?.element?._rowIndex,
      message: `WARNING [R-AGG-06]: ${chainId} is ${chainLenM.toFixed(1)}m long. Verify supports are included.` });
  }
}
```

---

## 10. REGION G: FIX APPLICATION ENGINE

### 10.1 Apply Fixes to Data Table

This function executes when the user clicks **[Apply Fixes]**.

```javascript
function applyFixes(dataTable, chains, config, log) {
  const applied = [];
  const newRows = [];   // Gap-filler pipes to insert
  const deleteRows = new Set(); // Row indices to delete

  // ─── Priority 1: Collect DELETEs ───
  for (const chain of chains) {
    for (const link of chain) {
      const elem = link.element;
      if (elem._proposedFix?.type === "DELETE" && elem._proposedFix.tier <= 2) {
        deleteRows.add(elem._rowIndex);
        applied.push({ ruleId: elem._proposedFix.ruleId, row: elem._rowIndex, action: "DELETE" });
        log.push({ type: "Applied", ruleId: elem._proposedFix.ruleId, row: elem._rowIndex,
          message: `APPLIED: Deleted ${elem.type} at Row ${elem._rowIndex}.` });
      }
    }
  }

  // ─── Priority 2: Collect SNAP_AXIS fixes ───
  for (const chain of chains) {
    for (const link of chain) {
      const elem = link.element;
      if (elem._proposedFix?.type === "SNAP_AXIS" && elem._proposedFix.tier <= 2) {
        const axis = elem._proposedFix.dominantAxis;
        snapToSingleAxis(elem, axis);
        markModified(elem, "ep1", "SmartFix:R-GEO-03");
        markModified(elem, "ep2", "SmartFix:R-GEO-03");
        applied.push({ ruleId: "R-GEO-03", row: elem._rowIndex, action: "SNAP_AXIS" });
      }
    }
  }

  // ─── Priority 3: Collect SNAP gap fixes ───
  for (const chain of chains) {
    for (const link of chain) {
      if (!link.fixAction) continue;
      if (link.fixAction.type === "SNAP" && link.fixAction.tier <= 2) {
        snapEndpoints(link.element, link.nextElement);
        markModified(link.element, "ep2", `SmartFix:${link.fixAction.ruleId}`);
        markModified(link.nextElement, "ep1", `SmartFix:${link.fixAction.ruleId}`);
        applied.push({ ruleId: link.fixAction.ruleId, row: link.element._rowIndex, action: "SNAP" });
      }
    }
  }

  // ─── Priority 4: Collect TRIM fixes ───
  for (const chain of chains) {
    for (const link of chain) {
      if (!link.fixAction) continue;
      if (link.fixAction.type === "TRIM" && link.fixAction.tier <= 2) {
        const target = link.fixAction.trimTarget === "current" ? link.element : link.nextElement;
        if ((target.type || "").toUpperCase() === "PIPE") {
          trimPipe(target, link.fixAction.trimAmount, link.travelAxis, link.travelDirection, link.fixAction.trimTarget);
          markModified(target, link.fixAction.trimTarget === "current" ? "ep2" : "ep1",
            `SmartFix:${link.fixAction.ruleId}`);
          applied.push({ ruleId: link.fixAction.ruleId, row: target._rowIndex, action: "TRIM" });
          log.push({ type: "Applied", ruleId: link.fixAction.ruleId, row: target._rowIndex,
            message: `APPLIED: Trimmed ${target.type} by ${link.fixAction.trimAmount.toFixed(1)}mm.` });

          // R-OVR-06: Check if trim creates micro-pipe
          const remaining = vec.mag(getElementVector(target));
          if (remaining < (config.smartFixer?.microPipeThreshold ?? 6.0)) {
            deleteRows.add(target._rowIndex);
            log.push({ type: "Applied", ruleId: "R-OVR-06", row: target._rowIndex,
              message: `APPLIED: Pipe reduced to ${remaining.toFixed(1)}mm after trim. Deleted.` });
          }
        }
      }
    }
  }

  // ─── Priority 5: Collect INSERT fixes (gap-fill pipes) ───
  for (const chain of chains) {
    for (const link of chain) {
      if (!link.fixAction) continue;
      if (link.fixAction.type === "INSERT" && link.fixAction.tier <= 2) {
        const fillerPipe = createFillerPipe(link, config);
        newRows.push({ insertAfterRow: link.element._rowIndex, pipe: fillerPipe });
        applied.push({ ruleId: link.fixAction.ruleId, row: link.element._rowIndex, action: "INSERT" });
        log.push({ type: "Applied", ruleId: link.fixAction.ruleId, row: link.element._rowIndex,
          message: `APPLIED: Inserted ${link.fixAction.gapAmount.toFixed(1)}mm gap-fill pipe after Row ${link.element._rowIndex}.` });
      }
    }
  }

  // ─── Execute changes on dataTable ───

  // 1. Remove deleted rows
  let updatedTable = dataTable.filter(row => !deleteRows.has(row._rowIndex));

  // 2. Insert new rows (gap-fill pipes)
  for (const insertion of newRows.sort((a, b) => b.insertAfterRow - a.insertAfterRow)) {
    const idx = updatedTable.findIndex(r => r._rowIndex === insertion.insertAfterRow);
    if (idx >= 0) {
      updatedTable.splice(idx + 1, 0, insertion.pipe);
    } else {
      updatedTable.push(insertion.pipe);
    }
  }

  // 3. Re-number rows
  updatedTable.forEach((row, i) => { row._rowIndex = i + 1; });

  // 4. Clear all fixingAction previews (fixes have been applied)
  updatedTable.forEach(row => {
    row.fixingAction = null;
    row.fixingActionTier = null;
    row.fixingActionRuleId = null;
  });

  return { updatedTable, applied, deleteCount: deleteRows.size, insertCount: newRows.length };
}
```

### 10.2 Helper Functions for Fix Application

```javascript
function snapEndpoints(elemA, elemB) {
  // Snap A.EP2 and B.EP1 to their midpoint
  const mid = vec.mid(getExitPoint(elemA), getEntryPoint(elemB));
  if (elemA.ep2) { elemA.ep2 = { ...mid }; }
  if (elemB.ep1) { elemB.ep1 = { ...mid }; }
}

function snapToSingleAxis(element, dominantAxis) {
  if (!element.ep1 || !element.ep2) return;
  // Zero out non-dominant deltas by projecting EP2 onto EP1's non-dominant coords
  const axes = ["x", "y", "z"];
  const domKey = dominantAxis.toLowerCase();
  for (const key of axes) {
    if (key !== domKey) {
      element.ep2[key] = element.ep1[key]; // Force alignment
    }
  }
}

function trimPipe(pipe, amount, travelAxis, travelDir, which) {
  // which: "current" = trim EP2, "next" = trim EP1
  const axisKey = travelAxis.toLowerCase();
  if (which === "current") {
    pipe.ep2[axisKey] -= amount * travelDir;
  } else {
    pipe.ep1[axisKey] += amount * travelDir;
  }
}

function createFillerPipe(chainLink, config) {
  const upstream = chainLink.element;
  const downstream = chainLink.nextElement;
  const exitPt = getExitPoint(upstream);
  const entryPt = getEntryPoint(downstream);

  return {
    _rowIndex: -1,  // Will be reassigned during re-numbering
    _modified: { ep1: "SmartFix:GapFill", ep2: "SmartFix:GapFill", type: "SmartFix:GapFill" },
    _logTags: ["Calculated"],
    csvSeqNo: `${upstream.csvSeqNo || 0}.GF`,
    type: "PIPE",
    text: "",  // Will be regenerated by MESSAGE-SQUARE step
    refNo: `${upstream.refNo || "UNKNOWN"}_GapFill`,
    bore: upstream.bore || 0,
    ep1: { ...exitPt },
    ep2: { ...entryPt },
    cp: null, bp: null, branchBore: null,
    skey: "",
    supportCoor: null, supportName: "", supportGuid: "",
    ca: { ...upstream.ca, 8: null, 97: null, 98: null }, // Inherit CAs except weight/ref/seq
    fixingAction: "GAPFILLING",
    fixingActionTier: null,
    fixingActionRuleId: null,
    // Calculated fields will be filled by Step 5 (coordinate recalc)
    len1: null, axis1: null, len2: null, axis2: null, len3: null, axis3: null,
    brlen: null, deltaX: null, deltaY: null, deltaZ: null,
    diameter: upstream.bore, wallThick: upstream.ca?.[4] || null,
    bendPtr: null, rigidPtr: null, intPtr: null,
  };
}

function markModified(row, field, reason) {
  if (!row._modified) row._modified = {};
  row._modified[field] = reason;
}
```

---

## 11. REGION H: FIXING ACTION DESCRIPTOR

### 11.1 Populate Fixing Action Column

Called after chain walking, before user review.

```javascript
function populateFixingActions(dataTable, chains, log) {
  // Clear all existing fixing actions
  for (const row of dataTable) {
    row.fixingAction = null;
    row.fixingActionTier = null;
    row.fixingActionRuleId = null;
  }

  // From chain walk: element-level proposed fixes
  for (const chain of chains) {
    for (const link of chain) {
      const elem = link.element;

      // Element-level fix (DELETE, SNAP_AXIS)
      if (elem._proposedFix) {
        const row = dataTable.find(r => r._rowIndex === elem._rowIndex);
        if (row) {
          row.fixingAction = formatProposedFix(elem._proposedFix, elem);
          row.fixingActionTier = elem._proposedFix.tier;
          row.fixingActionRuleId = elem._proposedFix.ruleId;
        }
      }

      // Gap/Overlap fix (affects current AND next element)
      if (link.fixAction) {
        const currRow = dataTable.find(r => r._rowIndex === link.element._rowIndex);
        const nextRow = link.nextElement ? dataTable.find(r => r._rowIndex === link.nextElement._rowIndex) : null;

        if (currRow && !currRow.fixingAction) {
          currRow.fixingAction = link.fixAction.description;
          currRow.fixingActionTier = link.fixAction.tier;
          currRow.fixingActionRuleId = link.fixAction.ruleId;
        }
        if (nextRow && !nextRow.fixingAction && link.fixAction.tier <= 3) {
          nextRow.fixingAction = `← ${link.fixAction.description.split('\n')[0]}`; // Abbreviated back-reference
          nextRow.fixingActionTier = link.fixAction.tier;
          nextRow.fixingActionRuleId = link.fixAction.ruleId;
        }
      }

      // Process branch chain recursively
      if (link.branchChain) {
        populateFixingActionsFromChain(dataTable, link.branchChain);
      }
    }
  }

  // Also populate from log entries for rules without direct chain-link actions
  for (const entry of log) {
    if (entry.row && entry.tier && entry.tier <= 4) {
      const row = dataTable.find(r => r._rowIndex === entry.row);
      if (row && !row.fixingAction) {
        row.fixingAction = entry.message;
        row.fixingActionTier = entry.tier;
        row.fixingActionRuleId = entry.ruleId;
      }
    }
  }
}

function formatProposedFix(fix, element) {
  const type = (element.type || "").toUpperCase();
  const ri = element._rowIndex;

  switch (fix.type) {
    case "DELETE":
      const len = element.ep1 && element.ep2 ? vec.mag(vec.sub(element.ep2, element.ep1)) : 0;
      return `DELETE [${fix.ruleId}]: Remove ${type} at Row ${ri}\n` +
             `  Length: ${len.toFixed(1)}mm, Bore: ${element.bore || 0}mm\n` +
             `  Reason: ${fix.ruleId === "R-GEO-01" ? "Micro-element below threshold" : "Fold-back element"}`;

    case "SNAP_AXIS":
      return `SNAP [${fix.ruleId}]: Align ${type} to pure ${fix.dominantAxis}-axis\n` +
             `  Row ${ri}: Off-axis components will be zeroed\n` +
             `  EP2 non-${fix.dominantAxis} coords → match EP1`;

    default:
      return `${fix.type} [${fix.ruleId}]: Row ${ri}`;
  }
}

function buildInsertDescription(gapAmt, direction, context, upstream) {
  const exitPt = getExitPoint(upstream);
  const bore = upstream.bore || 0;
  const axisKey = context.travelAxis.toLowerCase();
  const endPt = { ...exitPt };
  endPt[axisKey] += gapAmt * context.travelDirection;

  return `INSERT [R-GAP-02]: Fill ${gapAmt.toFixed(1)}mm gap along ${direction}\n` +
         `  New PIPE: EP1=(${exitPt.x.toFixed(1)}, ${exitPt.y.toFixed(1)}, ${exitPt.z.toFixed(1)})\n` +
         `          → EP2=(${endPt.x.toFixed(1)}, ${endPt.y.toFixed(1)}, ${endPt.z.toFixed(1)})\n` +
         `  Length: ${gapAmt.toFixed(1)}mm, Bore: ${bore.toFixed(1)}mm\n` +
         `  Inherited from Row ${upstream._rowIndex}`;
}

function buildTrimDescription(overlapAmt, direction, current, next, target) {
  const trimRow = target === "current" ? current : next;
  const otherRow = target === "current" ? next : current;
  return `TRIM [${target === "current" ? "R-OVR-01" : "R-OVR-02"}]: ` +
         `Reduce ${trimRow.type} by ${overlapAmt.toFixed(1)}mm along ${direction}\n` +
         `  Row ${trimRow._rowIndex}: ${target === "current" ? "EP2" : "EP1"} adjusted\n` +
         `  Overlap with ${otherRow.type} (Row ${otherRow._rowIndex}) resolved`;
}
```

---

## 12. REGION I: SMART FIX ORCHESTRATOR

The top-level function called when **[Smart Fix]** is clicked.

```javascript
function runSmartFix(dataTable, config, log) {
  log.push({ type: "Info", message: "═══ SMART FIX: Starting chain walker ═══" });

  // Step 4A: Build connectivity graph
  log.push({ type: "Info", message: "Step 4A: Building connectivity graph..." });
  const graph = buildConnectivityGraph(dataTable, config);
  log.push({ type: "Info",
    message: `Graph: ${graph.components.length} components, ${graph.terminals.length} terminals, ${graph.edges.size} connections.` });

  // Step 4B: Walk all chains
  log.push({ type: "Info", message: "Step 4B: Walking element chains..." });
  const { chains, orphans } = walkAllChains(graph, config, log);
  const totalElements = chains.reduce((s, c) => s + c.length, 0);
  log.push({ type: "Info",
    message: `Walked ${chains.length} chains, ${totalElements} elements, ${orphans.length} orphans.` });

  // Step 4C: Rules already run during walk (element + aggregate)
  // Count findings by tier
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const entry of log) {
    if (entry.tier) tierCounts[entry.tier]++;
  }
  log.push({ type: "Info",
    message: `Rules complete: Tier1=${tierCounts[1]}, Tier2=${tierCounts[2]}, Tier3=${tierCounts[3]}, Tier4=${tierCounts[4]}` });

  // Step 4D: Populate Fixing Action column
  log.push({ type: "Info", message: "Step 4D: Populating Fixing Action previews..." });
  populateFixingActions(dataTable, chains, log);

  const actionCount = dataTable.filter(r => r.fixingAction).length;
  log.push({ type: "Info",
    message: `═══ SMART FIX COMPLETE: ${actionCount} rows have proposed fixes. Review in Data Table. ═══` });

  // Build summary
  const summary = {
    chainCount: chains.length,
    elementsWalked: totalElements,
    orphanCount: orphans.length,
    tier1: tierCounts[1],
    tier2: tierCounts[2],
    tier3: tierCounts[3],
    tier4: tierCounts[4],
    rowsWithActions: actionCount,
  };

  return { graph, chains, orphans, summary };
}
```

---

## 13. REGION J: UI INTEGRATION

### 13.1 Data Table "Fixing Action" Column

Add to the Data Table tab's column list:

```javascript
// In the Data Table column definitions, add after "Fixing Action" (col 26):
{
  header: "Smart Fix Preview",
  field: "fixingAction",
  width: 320,
  render: (value, row) => {
    if (!value) return "—";

    const tierColors = {
      1: { bg: "#D4EDDA", text: "#155724", border: "#28A745", label: "AUTO" },
      2: { bg: "#FFF3CD", text: "#856404", border: "#FFC107", label: "FIX" },
      3: { bg: "#FFE5D0", text: "#856404", border: "#FD7E14", label: "REVIEW" },
      4: { bg: "#F8D7DA", text: "#721C24", border: "#DC3545", label: "ERROR" },
    };
    const colors = tierColors[row.fixingActionTier] || tierColors[3];

    return (
      <div style={
        background: colors.bg,
        color: colors.text,
        borderLeft: `3px solid ${colors.border}`,
        padding: "4px 8px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.7rem",
        lineHeight: 1.4,
        whiteSpace: "pre-wrap",
        maxWidth: 320,
      }>
        <span style={
          display: "inline-block",
          background: colors.border,
          color: "white",
          padding: "1px 6px",
          borderRadius: 3,
          fontSize: "0.6rem",
          fontWeight: 700,
          marginBottom: 2,
        }>
          {colors.label} T{row.fixingActionTier}
        </span>
        {" "}{row.fixingActionRuleId}
        <br/>
        {value}
      </div>
    );
  }
}
```

### 13.2 Buttons

```javascript
// Smart Fix button
<button
  onClick={() => {
    dispatch({ type: "SET_SMART_FIX_STATUS", status: "running" });
    const result = runSmartFix(state.dataTable, state.config, state.log);
    dispatch({ type: "SMART_FIX_COMPLETE", payload: result });
  }
  disabled={!state.dataTable.length || state.smartFix.status === "running"}
  style={ /* industrial blue button styling */ }
>
  {state.smartFix.status === "running" ? "Analyzing..." : "Smart Fix 🔧"}
</button>

// Apply Fixes button
<button
  onClick={() => {
    dispatch({ type: "SET_SMART_FIX_STATUS", status: "applying" });
    const result = applyFixes(state.dataTable, state.smartFix.chains, state.config, state.log);
    dispatch({ type: "FIXES_APPLIED", payload: result });
    // After applying: trigger Steps 5-13 (coordinate recalc, CP/BP, pointers, etc.)
  }
  disabled={state.smartFix.status !== "previewing"}
  style={ /* green button styling when enabled */ }
>
  {state.smartFix.status === "applying" ? "Applying..." : "Apply Fixes ✓"}
</button>
```

### 13.3 Reducer Actions

```javascript
case "SMART_FIX_COMPLETE":
  return {
    ...state,
    smartFix: {
      ...state.smartFix,
      status: "previewing",
      graph: action.payload.graph,
      chains: action.payload.chains,
      chainSummary: action.payload.summary,
    },
    log: [...state.log],
    // dataTable already mutated with fixingAction populated
  };

case "FIXES_APPLIED":
  return {
    ...state,
    dataTable: action.payload.updatedTable,
    smartFix: {
      ...state.smartFix,
      status: "applied",
      appliedFixes: action.payload.applied,
      fixSummary: {
        deleteCount: action.payload.deleteCount,
        insertCount: action.payload.insertCount,
        totalApplied: action.payload.applied.length,
      },
    },
  };
```

### 13.4 Debug Tab — Smart Fix Summary Panel

Add a collapsible section to the Debug tab:

```javascript
// Smart Fix Summary (shown after Smart Fix completes)
{state.smartFix.chainSummary && (
  <div style={ background: "#F0F4F8", padding: 12, borderRadius: 6, marginBottom: 12 }>
    <h4>Smart Fix Summary</h4>
    <table>
      <tbody>
        <tr><td>Chains found</td><td>{state.smartFix.chainSummary.chainCount}</td></tr>
        <tr><td>Elements walked</td><td>{state.smartFix.chainSummary.elementsWalked}</td></tr>
        <tr><td>Orphan elements</td><td>{state.smartFix.chainSummary.orphanCount}</td></tr>
        <tr style={borderTop:"1px solid #ccc"}><td>Tier 1 (auto-silent)</td>
            <td style={color:"#28A745"}>{state.smartFix.chainSummary.tier1}</td></tr>
        <tr><td>Tier 2 (auto-logged)</td>
            <td style={color:"#FFC107"}>{state.smartFix.chainSummary.tier2}</td></tr>
        <tr><td>Tier 3 (warnings)</td>
            <td style={color:"#FD7E14"}>{state.smartFix.chainSummary.tier3}</td></tr>
        <tr><td>Tier 4 (errors)</td>
            <td style={color:"#DC3545"}>{state.smartFix.chainSummary.tier4}</td></tr>
        <tr style={borderTop:"1px solid #ccc"}><td>Rows with proposed fixes</td>
            <td><b>{state.smartFix.chainSummary.rowsWithActions}</b></td></tr>
      </tbody>
    </table>
  </div>
)}
```

---

## 14. COMPLETE WORKFLOW — STEP BY STEP

```
USER ACTION                    APP BEHAVIOR
─────────────                  ────────────
1. Import PCF / Excel          → Parse into Data Table
                               → Run Steps 1-4 (basic fixes)
                               → Show Data Table

2. Click [Smart Fix 🔧]       → Step 4A: Build connectivity graph
                               → Step 4B: Walk all chains
                               → Step 4C: Run 57 rules (R-GEO..R-AGG)
                               → Step 4D: Populate "Fixing Action" column
                               → Data Table updates with colored previews
                               → Debug tab shows chain walk log
                               → [Apply Fixes] button becomes active

3. User reviews Data Table     → Scroll through "Smart Fix Preview" column
                               → Green (T1): will auto-fix silently
                               → Amber (T2): will auto-fix with log
                               → Orange (T3): warnings, no auto-fix
                               → Red (T4): errors, needs manual attention

4. Click [Apply Fixes ✓]      → Execute all Tier 1 + Tier 2 fixes:
                                  - DELETE micro-pipes, fold-backs
                                  - SNAP coordinates, close micro-gaps
                                  - TRIM pipe overlaps
                                  - INSERT gap-filler pipes
                               → Update Data Table with corrected values
                               → Highlight modified cells (cyan)
                               → Clear "Fixing Action" column on fixed rows
                               → Re-run Steps 5-13:
                                  - Coordinate recalculation
                                  - CP/BP recalculation
                                  - BRLEN lookup
                                  - Pointer recalculation
                                  - MESSAGE-SQUARE regeneration
                                  - Validation V1-V20

5. Review results              → Debug tab: full audit trail
                               → Tally: before vs after comparison
                               → Remaining T3/T4 items need manual attention

6. Click [Smart Fix 🔧] again → Re-run on corrected data (iterative)
   (optional)                  → Should find fewer issues each pass

7. Click [Export PCF ↓]       → Generate PCF from final Data Table
                               → CRLF, decimal consistency, all rules applied
```

---

## 15. ANTI-DRIFT RULES

### 15.1 Mandatory Constraints

1. **Only PIPE elements can be created, trimmed, or deleted by auto-fix.** Fittings are rigid catalog dimensions. Never modify a fitting's coordinates to resolve a gap/overlap.
2. **Component data > MESSAGE-SQUARE.** Always. Even after Smart Fix, the actual coordinates in the component block are authoritative.
3. **Fixes change the Data Table, not the PCF directly.** The PCF is always regenerated FROM the Data Table. Never edit PCF text as strings.
4. **Chain walker must carry context.** Every gap/overlap decision must use `travel_axis` and `travel_direction`. A 3mm gap along the travel axis is trivial; a 3mm gap perpendicular to it is an error. This distinction is the entire reason the chain walker exists.
5. **Tier 3 and Tier 4 findings are NEVER auto-fixed.** They populate the Fixing Action column for visibility only. The user must resolve them manually or by editing the source data and re-importing.
6. **Gap-fill pipes inherit properties.** Bore, material (CA3), design conditions (CA1, CA2), wall thickness (CA4), insulation density (CA6) — all inherited from the upstream element. CA8 (weight) is NOT inherited (pipes don't have catalog weight).
7. **After Apply Fixes, always re-run Steps 5–13.** The basic fixer must recalculate all derived fields (LEN, AXIS, DELTA, BRLEN, pointers) because coordinates have changed.
8. **`<SKEY>` not `SKEY`.** All PCF output uses angle-bracket syntax.
9. **`UCI:` prefix mandatory.** On all `<SUPPORT_GUID>` values.
10. **CRLF always.** Every PCF output uses `\r\n`.

### 15.2 Testing Checklist

| # | Test | Expected Result |
|---|------|----------------|
| T1 | Import sample PCF, click Smart Fix | Chains built, rules run, Fixing Action populated |
| T2 | PCF with 5mm axial gap | T2 INSERT: gap-fill pipe created |
| T3 | PCF with 0.5mm shared-axis drift | T1 SNAP: silently corrected |
| T4 | PCF with 30mm axial gap | T3 REVIEW: warning, no auto-fix |
| T5 | PCF with 150mm gap | T4 ERROR: major gap flagged |
| T6 | PCF with 10mm pipe overlap | T2 TRIM: pipe EP2 trimmed |
| T7 | Flange-flange overlap | T4 ERROR: rigid-on-rigid, no auto-fix |
| T8 | 3mm fold-back pipe | T2 DELETE: removed |
| T9 | Pipe changing axis without bend | T4 ERROR: R-CHN-01 flagged |
| T10 | TEE with branch bore > header | T4 ERROR: R-BRN-01 flagged |
| T11 | Orphan element (disconnected) | T4 ERROR: R-TOP-02 flagged |
| T12 | Click Apply Fixes | All T1+T2 fixes applied, Data Table updated |
| T13 | After Apply, click Smart Fix again | Fewer issues found (iterative improvement) |
| T14 | Export PCF after fixes | Clean PCF with CRLF, correct coordinates |

---

## 16. ESTIMATED SIZE AND EFFORT

| Region | Lines | Purpose |
|--------|-------|---------|
| A: Vector Math | ~40 | Pure utility functions |
| B: Connectivity Graph | ~120 | Build graph from Data Table |
| C: Chain Walker | ~200 | Walk algorithm + context management |
| D: Axis Detector | ~60 | Element axis + branch direction |
| E: Gap/Overlap Analyzer | ~180 | Core gap/overlap classification |
| F: Rule Engine | ~400 | 57 rules across 9 categories |
| G: Fix Application | ~150 | Apply Tier 1+2 fixes to Data Table |
| H: Action Descriptor | ~80 | Human-readable fix previews |
| I: Orchestrator | ~60 | Top-level Smart Fix function |
| J: UI Components | ~100 | Buttons, column render, summary panel |
| **Total** | **~1,400** | **Add to existing app** |

---

*End of Work Instruction WI-PCF-SMARTFIX-001 Rev.0*


---

# ═══════════════════════════════════════════════════════════
# PART D — AGENT CLARIFICATIONS
# Definitive answers to implementation questions
# ═══════════════════════════════════════════════════════════

## D§1. Project Setup

Initialize a **new Vite React project** from scratch:

```bash
npm create vite@latest pcf-validator -- --template react
cd pcf-validator
npm install
```

Replace `src/App.jsx` with the main component. Single entry point. No existing repo dependency.

---

## D§2. Library Choices

| Purpose | Library | Reason |
|---------|---------|--------|
| **Excel/CSV Import** (reading) | SheetJS (`xlsx`) or PapaParse | Only need to read data, not styles |
| **Excel Export** (styled) | `exceljs` | **Required** — colored cell highlighting (Amber/Cyan/Red) is a core audit feature. SheetJS free version cannot export styles. |
| **Fuzzy matching** | Custom (see D§3) | ~15 lines, no external dependency |
| **Vector math** | Custom (see D§5) | ~40 lines, no external dependency |

Install:

```bash
npm install xlsx papaparse exceljs
```

---

## D§3. Fuzzy String Matching — Custom Implementation

Write a Levenshtein distance function directly in the file (~15 lines). The fuzzy match is only Pass 3 (fallback) — Pass 1 (exact normalized) and Pass 2 (substring) handle 90% of cases.

```javascript
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
}
```

---

## D§4. Validation Rules V1–V20 — Complete Logic

Every check has explicit logic, thresholds, and severity. Implement each exactly as described.

### V1: No (0,0,0) Coordinates — ERROR

For every component, check EP1, EP2, CP, BP, and SUPPORT CO-ORDS. If all three spatial values (X, Y, Z) are zero on any **used field**, flag ERROR.

"Used field" means: EP1/EP2 for PIPE/FLANGE/VALVE/BEND/TEE/REDUCER; CP for BEND/TEE; BP for TEE/OLET; CO-ORDS for SUPPORT. Individual axes CAN be zero; only all-three-zero is prohibited.

### V2: Decimal Consistency — ERROR

Check at PCF generation time. Every coordinate token (X, Y, Z, and Bore) across the entire output must use the same number of decimal places (`config.decimals`: either 1 or 4). If any token differs, flag ERROR.

### V3: Bore Consistency — ERROR

For REDUCER types: EP1 bore must differ from EP2 bore (if equal → ERROR, not a reducer). For all other types: EP1 bore must equal EP2 bore (if different without being a reducer → ERROR).

### V4: BEND CP ≠ EP1 — ERROR

If CP coordinates exactly equal EP1 coordinates (within 0.1mm on all axes), flag ERROR (degenerate zero-radius bend).

### V5: BEND CP ≠ EP2 — ERROR

Same as V4 but comparing CP to EP2.

### V6: BEND CP Not Collinear — ERROR

Compute the cross product of vectors (EP1−CP) and (EP2−CP). If the magnitude of the cross product is near zero (< 0.001), CP lies on the EP1–EP2 line — flag ERROR (bend degenerates into a straight pipe).

```javascript
const v1 = vec.sub(ep1, cp);
const v2 = vec.sub(ep2, cp);
const cross = vec.cross(v1, v2);
if (vec.mag(cross) < 0.001) { /* ERROR: collinear */ }
```

### V7: BEND CP Equidistant — WARNING

Compute `dist(CP, EP1)` and `dist(CP, EP2)`. If they differ by more than 1.0mm, flag WARNING (bend radius inconsistency). Both distances should equal the bend radius.

### V8: TEE CP = Midpoint — ERROR

Compute expected CP as `((EP1.x+EP2.x)/2, (EP1.y+EP2.y)/2, (EP1.z+EP2.z)/2)`. If actual CP differs from expected by more than 1.0mm on any axis, flag ERROR.

### V9: TEE CP Bore = EP Bore — ERROR

The bore value at CP must equal the bore at EP1 and EP2 (all three are header bore). If CP bore differs, flag ERROR.

### V10: TEE BP Perpendicular — WARNING

Compute dot product of `(BP−CP)` and `(EP2−EP1)`. If `abs(dot) > 0.01 × mag(BP−CP) × mag(EP2−EP1)`, the branch is not perpendicular to the header — flag WARNING.

```javascript
const branchVec = vec.sub(bp, cp);
const headerVec = vec.sub(ep2, ep1);
const dotProd = Math.abs(vec.dot(branchVec, headerVec));
const threshold = 0.01 * vec.mag(branchVec) * vec.mag(headerVec);
if (dotProd > threshold) { /* WARNING: not perpendicular */ }
```

### V11: OLET No END-POINTs — ERROR

For OLET type components, verify that EP1 and EP2 are NOT populated (or are null/zero). OLET must only have CENTRE-POINT and BRANCH1-POINT. If END-POINTs exist, flag ERROR.

### V12: SUPPORT No CAs — ERROR

For SUPPORT type, verify that no COMPONENT-ATTRIBUTE lines (CA1 through CA10, CA97, CA98) are populated. If any CA is non-null/non-empty, flag ERROR.

### V13: SUPPORT Bore = 0 — ERROR

The bore token in SUPPORT CO-ORDS must be 0 (formatted to match decimal precision: `0.0000` or `0.0`). If bore is non-zero, flag ERROR.

### V14: SKEY Presence — WARNING

Check that `<SKEY>` is non-empty for: FLANGE, VALVE, BEND, TEE, OLET, REDUCER-CONCENTRIC, REDUCER-ECCENTRIC. If missing for these types, flag WARNING. PIPE and SUPPORT do not require SKEY.

### V15: Coordinate Continuity — WARNING

For each consecutive pair of connected components, check that EP1 of the current element approximately equals EP2 of the previous element (within 1.0mm tolerance on each axis). If they differ by more than tolerance, flag WARNING.

### V16: CA8 Scope — WARNING

CA8 (component weight) should only be populated for FLANGE and VALVE (and similar fittings). If CA8 is populated for PIPE or SUPPORT, flag WARNING. If CA8 is missing for FLANGE or VALVE, log INFO (not an error).

### V17: CRLF Line Endings — ERROR

At PCF generation time, verify the output string uses `\r\n` throughout. Enforced by the generator joining all lines with `\r\n`.

### V18: Bore Unit — WARNING

If any bore value is ≤ 48 and is NOT in the standard mm bore set `{15, 20, 25, 32, 40, 50, 65, 80, 90, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 750, 900, 1050, 1200}`, flag WARNING that the bore may be in inches and needs conversion (multiply by 25.4).

### V19: SUPPORT MESSAGE-SQUARE — WARNING

Every SUPPORT must have a MESSAGE-SQUARE block. The MESSAGE-SQUARE for SUPPORT must NOT contain Material, LENGTH, or Direction tokens (not applicable to point restraints). If present, flag WARNING.

### V20: GUID Prefix — ERROR

Every `<SUPPORT_GUID>` value must start with the prefix `"UCI:"`. If the prefix is missing or different, flag ERROR.

---

## D§5. Vector Math — Complete Specification

Implement as a utility object directly in the file. All inputs/outputs use `{x, y, z}` objects. Pure functions, no classes.

```javascript
const vec = {
  sub:   (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add:   (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
  dot:   (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  mag:   (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  normalize: (v) => {
    const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return m > 0 ? { x: v.x / m, y: v.y / m, z: v.z / m } : { x: 0, y: 0, z: 0 };
  },
  dist:  (a, b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2),
  mid:   (a, b) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2 }),
  approxEqual: (a, b, tol = 1.0) =>
    Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.z - b.z) <= tol,
  isZero: (v) => v.x === 0 && v.y === 0 && v.z === 0,
};
```

**Coverage:** These 11 functions handle all math needs across:
- Coordinate calculation (§8.2 bi-directional EP↔DELTA↔LEN)
- CP/BP calculation (§10.5 TEE midpoint, BEND corner)
- Validation checks (V6 collinearity via cross product, V7 equidistance, V10 perpendicularity via dot product)
- Smart Fixer gap decomposition and route closure
- Branch direction detection

---

*End of PCF Syntax Master & Smart Fixer — Consolidated Reference v2.0*
