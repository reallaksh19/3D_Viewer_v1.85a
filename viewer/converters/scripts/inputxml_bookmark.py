#!/usr/bin/env python3
"""Configurable defaults for CAESAR II InputXML generation.

Defaults are derived from the B7410250 benchmark (SYS-30-B7410250 [CII BENCHMARK].cii
and SYS-30-B7410250 [INPUTXML BENCHMARK]_INPUT.XML).  All values are overridable via
a bookmark JSON file or individual CLI arguments.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, fields
from pathlib import Path


SENTINEL = -1.0101


@dataclass
class InputXmlDefaults:
    # Temperature — only first element of main run is emitted; rest use sentinel
    temperature1: float = 50.0       # °C  (from B7410250 benchmark)
    temperature2: float = 0.0
    temperature3: float = 0.0

    # Pipe properties — only emitted where they change; otherwise sentinel
    wall_thickness: float = 0.01     # mm  (benchmark first-element value)

    # Material — always emitted (never sentinel)
    modulus: float = 203_395_424.0   # kPa (~203 GPa for carbon steel at ambient)
    hot_mod1: float = 201_464_896.0  # kPa at temperature1 (~201 GPa at 50 °C)
    poissons: float = 0.292
    pipe_density: float = 0.007833   # g/cc
    material_num: float = 1.0        # CAESAR II code for LOW CARBON steel
    material_name: str = 'LOW CARBON'

    # Restraint stiffness for anchor type
    anchor_stiffness: float = 9.41952e+19  # N/mm (effectively rigid)

    # Bend defaults
    bend_type: float = 0.0           # 0 = long-radius elbow
    default_bend_angle: float = 90.0  # degrees; overridden by vector geometry

    # InputXML header
    version: str = '11.00'
    north_z: str = '0'
    north_y: str = '1'
    north_x: str = '0'

    # Coordinate frame (G2/G3). PDMS uses E=X, N=Y, U=Z. CAESAR II / AVEVA
    # psi2cii place the vertical (Up) on Y. 'vertical_axis' selects which CAESAR
    # axis receives PDMS Up:
    #   'Y' -> map (E,N,U)->(X=E, Y=U, Z=N)  [AVEVA convention, default]
    #   'Z' -> identity (E,N,U)->(X,Y,Z)     [legacy / no remap]
    # The NORTH_* header is derived from this unless explicitly overridden.
    vertical_axis: str = 'Y'
    # Optional world datum (mm) added in the PDMS (E,N,U) frame before the axis
    # map. 0 = leave coordinates as authored (continuity uses relative deltas,
    # which are datum-invariant). Set these to the SITE/ZONE datum to emit
    # absolute world coordinates.
    datum_e: float = 0.0
    datum_n: float = 0.0
    datum_u: float = 0.0
    # When False, NORTH_* are taken from the explicit fields above; when True
    # they are derived from vertical_axis.
    derive_north_from_axis: bool = True


def parse_bookmark_json(path: Path) -> dict:
    """Read a JSON bookmark file and return only recognised default keys."""
    known = {f.name for f in fields(InputXmlDefaults)}
    raw = json.loads(path.read_text(encoding='utf-8'))
    return {k: v for k, v in raw.items() if k in known}


def parse_bookmark_cii(path: Path) -> dict:
    """Extract defaults from the #$ ELEMENTS section of a CII file.

    Reads wall thickness and temperature from the first data element's second
    line (format: wall insul corr temp1 temp2 temp3 ...).
    """
    text = path.read_text(encoding='utf-8', errors='replace')
    in_elements = False
    first_line1 = None
    first_line2 = None
    number_rx = re.compile(r'[-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?')

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith('#$'):
            in_elements = line.startswith('#$ ELEMENTS')
            continue
        if not in_elements or not line:
            continue
        nums = [float(x) for x in number_rx.findall(line)]
        if not nums:
            continue
        if first_line1 is None:
            first_line1 = nums  # FROM TO DX DY DZ DIAM
        elif first_line2 is None:
            first_line2 = nums  # WALL INSUL CORR TEMP1 TEMP2 TEMP3 ...
            break

    out: dict = {}
    if first_line2 and len(first_line2) >= 4:
        out['wall_thickness'] = first_line2[0]
        out['temperature1'] = first_line2[3]
        if len(first_line2) >= 5:
            out['temperature2'] = first_line2[4]
        if len(first_line2) >= 6:
            out['temperature3'] = first_line2[5]
    return out


def load_defaults(bookmark_path: Path | None, cli_overrides: dict | None = None) -> InputXmlDefaults:
    """Build InputXmlDefaults by merging bookmark file + CLI overrides.

    Priority (highest wins): CLI override > bookmark file > dataclass defaults.
    """
    merged: dict = {}

    if bookmark_path is not None:
        suffix = bookmark_path.suffix.lower()
        if suffix == '.cii':
            merged.update(parse_bookmark_cii(bookmark_path))
        elif suffix in ('.json', ''):
            merged.update(parse_bookmark_json(bookmark_path))

    if cli_overrides:
        for k, v in cli_overrides.items():
            if v is not None:
                merged[k] = v

    known = {f.name: f for f in fields(InputXmlDefaults)}
    kwargs = {}
    for k, v in merged.items():
        if k in known:
            # coerce to the field's type
            field_type = known[k].type
            try:
                if field_type in ('float', float):
                    kwargs[k] = float(v)
                elif field_type in ('str', str):
                    kwargs[k] = str(v)
                else:
                    kwargs[k] = v
            except (TypeError, ValueError):
                pass  # keep dataclass default

    return InputXmlDefaults(**kwargs)
