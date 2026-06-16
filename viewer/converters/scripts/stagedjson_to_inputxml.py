#!/usr/bin/env python3
"""Convert a managed-stage hierarchy JSON to CAESAR II InputXML format.

Element mapping rules
---------------------
PIPE / REDU / TEE  -> 1 PIPINGELEMENT
FLAN               -> 1 PIPINGELEMENT with RIGID child
GASK between FLANs -> 1 PIPINGELEMENT with RIGID child (standalone joint)
GASK adj to PIPE   -> absorbed into that PIPE; PIPE becomes RIGID
ELBO / BEND        -> 2 PIPINGELEMENT records:
                        arm1 (apos->cpos)  carries the BEND child
                        arm2 (cpos->lpos)  plain element
OLET               -> dropped; adds SIF slot to the preceding element
SUPPORT            -> dropped (no RESTRAINT emitted)
BRANCH headers     -> skipped
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field, fields
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from inputxml_bookmark import InputXmlDefaults, load_defaults, SENTINEL
import support_restraint as support_restraint_mod

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def pt(v):
    if isinstance(v, dict):
        return (float(v.get('x', v.get('X', 0))),
                float(v.get('y', v.get('Y', 0))),
                float(v.get('z', v.get('Z', 0))))
    return None


def vsub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def vadd(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def vlen(a): return math.sqrt(a[0]**2 + a[1]**2 + a[2]**2)


def map_axes(x, y, z, vertical_axis: str):
    """Map PDMS (E=X, N=Y, U=Z) into the CAESAR frame (G3).

    'Y' (default, AVEVA): vertical/Up on Y -> (X=E, Y=U, Z=N).
    'Z' (legacy): identity.
    """
    if str(vertical_axis).upper() == 'Z':
        return (x, y, z)
    return (x, z, y)


def transform_coordinates(data, defaults: InputXmlDefaults):
    """Recursively apply world datum (G2) + axis map (G3) to every {x,y,z} dict
    in the staged hierarchy, in place. Datum is added in the PDMS frame, then the
    axis map is applied. Relative deltas are datum-invariant; only the absolute
    placement and axis orientation change."""
    de, dn, du = defaults.datum_e, defaults.datum_n, defaults.datum_u
    axis = defaults.vertical_axis
    if axis.upper() == 'Z' and de == 0.0 and dn == 0.0 and du == 0.0:
        return data  # identity: nothing to do

    def has_xyz(d):
        return isinstance(d, dict) and (
            ('x' in d and 'y' in d and 'z' in d) or ('X' in d and 'Y' in d and 'Z' in d))

    def walk(node):
        if isinstance(node, dict):
            if has_xyz(node):
                kx, ky, kz = ('x', 'y', 'z') if 'x' in node else ('X', 'Y', 'Z')
                x = float(node[kx]) + de
                y = float(node[ky]) + dn
                z = float(node[kz]) + du
                mx, my, mz = map_axes(x, y, z, axis)
                node[kx], node[ky], node[kz] = mx, my, mz
                return
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    return data


def derive_north(defaults: InputXmlDefaults):
    """Return (north_x, north_y, north_z) consistent with vertical_axis unless
    the caller opted out of derivation."""
    if not defaults.derive_north_from_axis:
        return defaults.north_x, defaults.north_y, defaults.north_z
    if str(defaults.vertical_axis).upper() == 'Z':
        # Up=Z -> North on Y.
        return '0', '1', '0'
    # Up=Y (AVEVA) -> North maps to Z.
    return '0', '0', '1'


def mm_val(s):
    import re
    if s is None:
        return None
    m = re.search(r'[-+]?\d+(?:\.\d+)?', str(s).replace('mm', '').replace('MM', ''))
    return float(m.group()) if m else None


OD_TABLE = {750: 762.0, 600: 610.0, 400: 406.4, 100: 114.3}


def od_from_bore(bore_mm):
    if bore_mm is None:
        return None
    for k, v in OD_TABLE.items():
        if abs(bore_mm - k) <= 25:
            return v
    return bore_mm


def encode_delta(dx, dy, dz, threshold=0.5):
    """Replace near-zero axis movements with SENTINEL."""
    return (
        dx if abs(dx) >= threshold else SENTINEL,
        dy if abs(dy) >= threshold else SENTINEL,
        dz if abs(dz) >= threshold else SENTINEL,
    )

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Element:
    from_node: int
    to_node: int
    dx: float
    dy: float
    dz: float
    diameter: float        # explicit OD or SENTINEL
    wall: float            # explicit or SENTINEL
    temp1: float           # explicit or SENTINEL
    modulus: float
    hot_mod1: float
    rigid: bool = False
    bend_radius: float = SENTINEL
    bend_mid_node: int = -1
    sif_node: int = -1
    rest_node: int = -1
    source_type: str = 'PIPE'
    # Restraints derived from SUPPORT components (G4). Each entry:
    #   {node, type, stiffness, gap, friction}
    restraints: list = field(default_factory=list)
    # Stress node names carried for NODENAME emission (G5).
    from_name: str = ''
    to_name: str = ''

# ---------------------------------------------------------------------------
# Node allocator
# ---------------------------------------------------------------------------

class NodeAllocator:
    def __init__(self, start: int = 10, step: int = 10):
        self._map: dict[tuple, int] = {}
        self._point_by_node: dict[int, tuple] = {}
        self._cur = start
        self._step = step

    def alloc(self) -> int:
        n = self._cur
        self._cur += self._step
        return n

    def alloc_mid(self, to_node: int) -> int:
        return to_node - 1

    def get_or_alloc(self, xyz) -> int:
        key = tuple(round(c) for c in xyz)
        if key not in self._map:
            node = self.alloc()
            self._map[key] = node
            self._point_by_node[node] = xyz
        return self._map[key]

    def set_node_point(self, node: int, xyz) -> None:
        self._point_by_node[node] = xyz

    def point_for_node(self, node: int):
        return self._point_by_node.get(node)

# ---------------------------------------------------------------------------
# Branch processor
# ---------------------------------------------------------------------------

def _bore_od(attrs, branch_bore):
    raw = (attrs.get('ABORE') or attrs.get('HBOR') or
           attrs.get('LBORE') or attrs.get('BORE') or branch_bore)
    bore = mm_val(raw)
    return od_from_bore(bore)


def _cpos(attrs):
    for k in ('CPOS', 'POS', 'CENTRE', 'CENTER', 'CENTREPOINT', 'CENTERPOINT', 'CP'):
        v = attrs.get(k)
        if v is not None:
            p = pt(v)
            if p:
                return p
    return None


def process_branch(branch: dict, na: NodeAllocator, defaults: InputXmlDefaults,
                   first_element_index: int, node_refs: dict[str, dict[str, object]]) -> list[Element]:
    """Convert one branch's children to Element records."""
    children = branch.get('children', [])
    branch_bore = branch.get('bore') or branch.get('attributes', {}).get('HBOR')
    elements: list[Element] = []
    pending_sif = False   # set when OLET follows; applies to NEXT emitted element
    pending_sif_ref: str | None = None
    pending_sif_point = None

    # Look ahead: find GASK positions and their neighbours to decide absorption
    gask_fate: dict[int, str] = {}  # index -> 'absorb_prev', 'absorb_next', 'standalone'
    for i, child in enumerate(children):
        if child.get('type') != 'GASK':
            continue
        prev_t = children[i - 1].get('type') if i > 0 else None
        next_t = children[i + 1].get('type') if i + 1 < len(children) else None
        prev_raw = ''
        if i > 0:
            prev_raw = str(children[i - 1].get('attributes', {}).get('RAW_TYPE', '')).upper()
        if prev_raw in ('FBLI', 'FBLIND', 'BLIND'):
            gask_fate[i] = 'absorb_prev'
        elif prev_t == 'FLAN' and next_t == 'FLAN':
            gask_fate[i] = 'standalone'
        elif prev_t == 'PIPE' or next_t == 'PIPE':
            # Absorb into whichever PIPE is adjacent (prefer next PIPE)
            gask_fate[i] = 'absorb_next' if next_t == 'PIPE' else 'absorb_prev'
        elif prev_t == 'FLAN':
            gask_fate[i] = 'absorb_prev'
        else:
            gask_fate[i] = 'absorb_next'

    # Pre-calculate GASK lengths to add to absorbing elements
    gask_add_to: dict[int, float] = {}  # target child index -> mm to add to its length
    for gi, fate in gask_fate.items():
        ga = children[gi].get('attributes', {})
        gapos = pt(ga.get('APOS'))
        glpos = pt(ga.get('LPOS'))
        glen_vec = vsub(glpos, gapos) if gapos and glpos else (0, 0, 0)
        if fate == 'absorb_prev' and gi > 0:
            gask_add_to[gi - 1] = gask_add_to.get(gi - 1, 0)  # just mark (handled below)
        elif fate == 'absorb_next' and gi + 1 < len(children):
            gask_add_to[gi + 1] = gask_add_to.get(gi + 1, 0)

    # Build list of GASK offsets for absorbed GASKs
    absorbed_gask_lpos: dict[int, tuple] = {}  # absorbing child index -> adjusted lpos
    for gi, fate in gask_fate.items():
        ga = children[gi].get('attributes', {})
        glpos = pt(ga.get('LPOS')) or pt(ga.get('APOS'))
        gapos = pt(ga.get('APOS')) or glpos
        if fate == 'absorb_prev' and gi > 0:
            # The GASK lpos overrides the prev element's lpos (extends it)
            prev_a = children[gi - 1].get('attributes', {})
            prev_lpos = pt(prev_a.get('LPOS'))
            # absorbed_gask_lpos[gi-1] = glpos  # extend prev element to gask lpos
            pass  # length already combined via deltas below
        elif fate == 'absorb_next' and gi + 1 < len(children):
            # The GASK apos overrides the next element's apos (the pipe starts earlier)
            absorbed_gask_lpos[gi + 1] = gapos  # next element's effective apos = gask's apos

    prev_od: float | None = None
    is_first_of_model = (first_element_index == 0)
    route_support_points = []
    for child in children:
        attrs = child.get('attributes', {})
        if child.get('type') == 'SUPPORT' and attrs.get('ROUTE_SPLIT_POINT') == 'true':
            support_point = pt(attrs.get('POS')) or pt(attrs.get('BPOS')) or pt(attrs.get('APOS')) or pt(attrs.get('LPOS'))
            if support_point is not None:
                route_support_points.append(support_point)
    route_mode = bool(route_support_points)
    route_cursor = None

    def next_non_support_index(start: int) -> int | None:
        for idx in range(start, len(children)):
            if children[idx].get('type') != 'SUPPORT':
                return idx
        return None

    def route_splits_between(start, end) -> list[tuple[float, tuple]]:
        axis = vsub(end, start)
        axis_len2 = sum(v * v for v in axis)
        if axis_len2 <= 1e-9:
            return []
        splits = []
        seen = set()
        for point in route_support_points:
            rel = vsub(point, start)
            t = sum(rel[i] * axis[i] for i in range(3)) / axis_len2
            if t <= 1e-6 or t >= 1 - 1e-6:
                continue
            projected = tuple(start[i] + axis[i] * t for i in range(3))
            if vlen(vsub(point, projected)) > 25.0:
                continue
            key = tuple(round(v, 3) for v in projected)
            if key in seen:
                continue
            seen.add(key)
            splits.append((t, projected))
        return sorted(splits, key=lambda item: item[0])

    def append_route_segment(start, end, od, bend_radius: float = SENTINEL,
                             source_type: str = 'PIPE') -> Element | None:
        nonlocal prev_od
        if start is None or end is None or vlen(vsub(end, start)) <= 1.0:
            return None
        elem_idx = first_element_index + len(elements)
        temp1_val = _temp_for(elem_idx, defaults)
        wall_val = defaults.wall_thickness if elem_idx == 0 else SENTINEL
        hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus
        diam = SENTINEL
        if od is not None and od != SENTINEL:
            if prev_od is None or abs(od - prev_od) > 0.5:
                diam = od
        fn = na.get_or_alloc(start)
        tn = na.get_or_alloc(end)
        dx, dy, dz = encode_delta(*vsub(end, start))
        bend_mid = na.alloc_mid(tn) if bend_radius != SENTINEL else -1
        e = Element(
            from_node=fn, to_node=tn,
            dx=dx, dy=dy, dz=dz,
            diameter=diam, wall=wall_val, temp1=temp1_val,
            modulus=defaults.modulus, hot_mod1=hot1,
            rigid=False,
            bend_radius=bend_radius,
            bend_mid_node=bend_mid,
            source_type='BEND' if bend_radius != SENTINEL else source_type,
        )
        elements.append(e)
        if od is not None and od != SENTINEL:
            prev_od = od
        return e

    i = 0
    while i < len(children):
        child = children[i]
        typ = child.get('type', 'UNKNOWN').upper()
        attrs = child.get('attributes', {})

        # --- GASK handling ---
        if typ == 'GASK':
            fate = gask_fate.get(i, 'standalone')
            if fate == 'standalone':
                apos_raw = pt(attrs.get('APOS'))
                lpos_raw = pt(attrs.get('LPOS'))
                od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL
                _emit_gask(elements, apos_raw, lpos_raw, od, prev_od, na,
                           defaults, first_element_index + len(elements), pending_sif)
                route_cursor = lpos_raw
                pending_sif = False
                if od is not None and od != SENTINEL:
                    prev_od = od
            # absorbed GASKs skipped here (handled by the absorbing element)
            i += 1
            continue

        # --- OLET/SUPPORT: drop ---
        if typ in ('OLET', 'SUPPORT'):
            if typ == 'OLET':
                pending_sif = True
                pending_sif_ref = str(attrs.get('REF') or attrs.get('NAME') or '').strip() or None
                pending_sif_point = pt(attrs.get('POS')) or pt(attrs.get('APOS')) or pt(attrs.get('LPOS'))
            i += 1
            continue

        if typ == 'PIPE':
            next_idx_for_olet = next_non_support_index(i + 1)
            next_child_for_olet = children[next_idx_for_olet] if next_idx_for_olet is not None else None
            if next_child_for_olet and next_child_for_olet.get('type') == 'OLET':
                apos_raw = route_cursor if route_cursor is not None else pt(attrs.get('APOS'))
                lpos_raw = pt(attrs.get('LPOS'))
                olet_attrs = next_child_for_olet.get('attributes', {})
                olet_point = pt(olet_attrs.get('POS')) or pt(olet_attrs.get('APOS')) or pt(olet_attrs.get('LPOS'))
                if apos_raw is not None and lpos_raw is not None and olet_point is not None and vlen(vsub(lpos_raw, olet_point)) < 1.0:
                    od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL
                    delta = vsub(lpos_raw, apos_raw)
                    dx, dy, dz = encode_delta(*delta)
                    diam = SENTINEL
                    if od is not None and od != SENTINEL:
                        if prev_od is None or abs(od - prev_od) > 0.5:
                            diam = od
                    elem_idx = first_element_index + len(elements)
                    temp1_val = _temp_for(elem_idx, defaults)
                    wall_val = defaults.wall_thickness if elem_idx == 0 else SENTINEL
                    hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus
                    fn = na.get_or_alloc(apos_raw)
                    tn = na.get_or_alloc(lpos_raw)
                    elements.append(Element(
                        from_node=fn, to_node=tn,
                        dx=dx, dy=dy, dz=dz,
                        diameter=diam, wall=wall_val, temp1=temp1_val,
                        modulus=defaults.modulus, hot_mod1=hot1,
                        sif_node=tn,
                        source_type='OLET',
                    ))
                    olet_ref = str(olet_attrs.get('REF') or olet_attrs.get('NAME') or '').strip() or None
                    if olet_ref:
                        node_refs[olet_ref] = {'node': tn, 'point': olet_point}
                    if od is not None and od != SENTINEL:
                        prev_od = od
                    route_cursor = lpos_raw
                    pending_sif = False
                    pending_sif_ref = None
                    pending_sif_point = None
                    i = next_idx_for_olet + 1
                    continue

        if route_mode and typ == 'PIPE':
            apos_raw = route_cursor if route_cursor is not None else pt(attrs.get('APOS'))
            lpos_raw = pt(attrs.get('LPOS'))
            if apos_raw is None or lpos_raw is None:
                i += 1
                continue

            next_idx = next_non_support_index(i + 1)
            next_child = children[next_idx] if next_idx is not None else None
            next_type = str(next_child.get('type', '')).upper() if next_child else ''
            if next_child and next_type in ('ELBO', 'BEND'):
                next_attrs = next_child.get('attributes', {})
                bend_end = _cpos(next_attrs) or pt(next_attrs.get('APOS'))
                bend_start = pt(next_attrs.get('APOS'))
                bend_lpos = pt(next_attrs.get('LPOS'))
                if bend_end is None:
                    i += 1
                    continue
                bend_radius_val = SENTINEL
                if bend_start is not None:
                    bend_radius_val = vlen(vsub(bend_end, bend_start))
                if (bend_radius_val == SENTINEL or bend_radius_val < 0.1) and bend_lpos is not None:
                    bend_radius_val = vlen(vsub(bend_lpos, bend_end))
                if bend_radius_val < 0.1:
                    bend_radius_val = SENTINEL
                od = _bore_od(next_attrs, branch_bore) or _bore_od(attrs, branch_bore) or prev_od or SENTINEL
                segment_start = apos_raw
                for _, split_point in route_splits_between(apos_raw, bend_end):
                    append_route_segment(segment_start, split_point, od)
                    segment_start = split_point
                append_route_segment(segment_start, bend_end, od, bend_radius_val, 'BEND')
                route_cursor = bend_end
                pending_sif = False
                pending_sif_ref = None
                pending_sif_point = None
                i = next_idx + 1
                continue

            od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL
            segment_start = apos_raw
            for _, split_point in route_splits_between(apos_raw, lpos_raw):
                append_route_segment(segment_start, split_point, od)
                segment_start = split_point
            append_route_segment(segment_start, lpos_raw, od)
            route_cursor = lpos_raw
            i += 1
            continue

        # --- ELBO / BEND: arm1 (with BEND child) + arm2 (plain) ---
        if typ in ('ELBO', 'BEND'):
            apos_raw = pt(attrs.get('APOS'))
            lpos_raw = pt(attrs.get('LPOS'))
            cpos_raw = _cpos(attrs)
            if cpos_raw is None:
                cpos_raw = apos_raw
            od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL

            arm1_delta = vsub(cpos_raw, apos_raw)
            arm2_delta = vsub(lpos_raw, cpos_raw)

            # Zero-delta BEND: apos==cpos==lpos (anchor/stub marker)
            # Emit ONE element (arm1 only) with radius=0 BEND child.
            # Update the position map so the next element starts at the new node.
            is_zero_delta = vlen(arm1_delta) < 1.0 and vlen(arm2_delta) < 1.0

            bend_radius_val = vlen(arm1_delta)
            if bend_radius_val < 0.1:
                bend_radius_val = vlen(arm2_delta)
            # For zero-delta BENDs keep radius as 0.0 (not SENTINEL) so BEND child is emitted.
            if bend_radius_val < 0.1 and not is_zero_delta:
                bend_radius_val = SENTINEL

            fn1 = na.get_or_alloc(apos_raw)
            tn1 = na.alloc()
            na.set_node_point(tn1, cpos_raw)
            bend_mid = na.alloc_mid(tn1)

            dx1, dy1, dz1 = encode_delta(*arm1_delta)

            diam1 = od if (prev_od is None or (od is not None and abs(od - prev_od) > 0.5)) else SENTINEL
            elem_idx = first_element_index + len(elements)
            temp1_val = _temp_for(elem_idx, defaults)
            wall1 = defaults.wall_thickness if elem_idx == 0 else SENTINEL

            hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus

            e1 = Element(
                from_node=fn1, to_node=tn1,
                dx=dx1, dy=dy1, dz=dz1,
                diameter=diam1, wall=wall1, temp1=temp1_val,
                modulus=defaults.modulus, hot_mod1=hot1,
                rigid=False,
                bend_radius=bend_radius_val,
                bend_mid_node=bend_mid,
                sif_node=tn1 if pending_sif else -1,
                source_type='BEND',
            )
            elements.append(e1)
            if pending_sif and pending_sif_ref:
                node_refs[pending_sif_ref] = {'node': tn1, 'point': pending_sif_point}
            pending_sif = False
            pending_sif_ref = None
            pending_sif_point = None
            if od is not None and od != SENTINEL:
                prev_od = od

            if is_zero_delta:
                # Update position map: next element at same position → gets tn1
                na._map[tuple(round(c) for c in apos_raw)] = tn1
                na.set_node_point(tn1, apos_raw)
                if route_mode:
                    tn2 = na.alloc()
                    na.set_node_point(tn2, apos_raw)
                    elements.append(Element(
                        from_node=tn1, to_node=tn2,
                        dx=SENTINEL, dy=SENTINEL, dz=SENTINEL,
                        diameter=SENTINEL, wall=SENTINEL, temp1=SENTINEL,
                        modulus=defaults.modulus, hot_mod1=defaults.modulus,
                        rigid=False,
                        source_type='BEND',
                    ))
                    na._map[tuple(round(c) for c in apos_raw)] = tn2
                route_cursor = apos_raw
                i += 1
                continue

            # arm2: plain element, no BEND child
            fn2 = tn1
            tn2 = na.get_or_alloc(lpos_raw)
            dx2, dy2, dz2 = encode_delta(*arm2_delta)
            e2 = Element(
                from_node=fn2, to_node=tn2,
                dx=dx2, dy=dy2, dz=dz2,
                diameter=SENTINEL, wall=SENTINEL, temp1=SENTINEL,
                modulus=defaults.modulus, hot_mod1=defaults.modulus,
                rigid=False,
                source_type='PIPE',
            )
            elements.append(e2)
            route_cursor = lpos_raw
            i += 1
            continue

        # --- Regular element (PIPE / FLAN / REDU / TEE / ...) ---
        apos_raw = pt(attrs.get('APOS'))
        lpos_raw = pt(attrs.get('LPOS'))
        if apos_raw is None or lpos_raw is None:
            i += 1
            continue

        if typ == 'TEE':
            cpos_raw = _cpos(attrs) or apos_raw
            od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL

            fn1 = na.get_or_alloc(apos_raw)
            tn1 = na.alloc()
            na.set_node_point(tn1, cpos_raw)
            dx1, dy1, dz1 = encode_delta(*vsub(cpos_raw, apos_raw))
            elem_idx = first_element_index + len(elements)
            temp1_val = _temp_for(elem_idx, defaults)
            wall_val = defaults.wall_thickness if elem_idx == 0 else SENTINEL
            hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus
            diam1 = od if (prev_od is None or (od is not None and abs(od - prev_od) > 0.5)) else SENTINEL
            elements.append(Element(
                from_node=fn1, to_node=tn1,
                dx=dx1, dy=dy1, dz=dz1,
                diameter=diam1, wall=wall_val, temp1=temp1_val,
                modulus=defaults.modulus, hot_mod1=hot1,
                sif_node=tn1,
                source_type='TEE',
            ))

            merged_lpos = lpos_raw
            skip_to = i + 1
            merged_sif_ref = None
            merged_sif_point = None
            if skip_to < len(children) and children[skip_to].get('type') == 'PIPE':
                next_attrs = children[skip_to].get('attributes', {})
                next_apos = pt(next_attrs.get('APOS'))
                next_lpos = pt(next_attrs.get('LPOS'))
                if next_apos and next_lpos and vlen(vsub(next_apos, lpos_raw)) < 1.0:
                    merged_lpos = next_lpos
                    skip_to += 1
                    if skip_to < len(children) and children[skip_to].get('type') == 'OLET':
                        olet_attrs = children[skip_to].get('attributes', {})
                        olet_point = (
                            pt(olet_attrs.get('POS')) or
                            pt(olet_attrs.get('APOS')) or
                            pt(olet_attrs.get('LPOS'))
                        )
                        if olet_point and vlen(vsub(olet_point, merged_lpos)) < 1.0:
                            merged_sif_ref = str(
                                olet_attrs.get('REF') or olet_attrs.get('NAME') or ''
                            ).strip() or None
                            merged_sif_point = olet_point
                            skip_to += 1

            fn2 = tn1
            tn2 = na.get_or_alloc(merged_lpos)
            dx2, dy2, dz2 = encode_delta(*vsub(merged_lpos, cpos_raw))
            e2 = Element(
                from_node=fn2, to_node=tn2,
                dx=dx2, dy=dy2, dz=dz2,
                diameter=SENTINEL, wall=SENTINEL, temp1=SENTINEL,
                modulus=defaults.modulus, hot_mod1=defaults.modulus,
                sif_node=tn2 if merged_sif_ref else -1,
                source_type='OLET' if merged_sif_ref else 'TEE',
            )
            elements.append(e2)
            if merged_sif_ref:
                node_refs[merged_sif_ref] = {'node': tn2, 'point': merged_sif_point}
            if od is not None and od != SENTINEL:
                prev_od = od
            route_cursor = merged_lpos
            pending_sif = False
            pending_sif_ref = None
            pending_sif_point = None
            i = skip_to
            continue

        # Check if a GASK is absorbed INTO this element
        make_rigid = (typ == 'FLAN')
        effective_apos = apos_raw
        effective_lpos = lpos_raw

        # Absorb preceding GASK (fate=absorb_next for GASK at i-1)
        if i > 0 and children[i - 1].get('type') == 'GASK':
            gi = i - 1
            if gask_fate.get(gi) == 'absorb_next':
                ga = children[gi].get('attributes', {})
                effective_apos = pt(ga.get('APOS')) or apos_raw
                make_rigid = True

        # Absorb following GASK (fate=absorb_prev for GASK at i+1)
        if i + 1 < len(children) and children[i + 1].get('type') == 'GASK':
            gi = i + 1
            if gask_fate.get(gi) == 'absorb_prev':
                ga = children[gi].get('attributes', {})
                effective_lpos = pt(ga.get('LPOS')) or lpos_raw
                make_rigid = True

        # Also absorb a GASK further along if this PIPE is sandwiched
        # e.g. FLAN GASK PIPE GASK => PIPE absorbs both GASKs
        # handled by: look for GASKs at i-1 and i+1 simultaneously
        if (i > 0 and children[i - 1].get('type') == 'GASK' and
                i + 1 < len(children) and children[i + 1].get('type') == 'GASK'):
            gi_prev = i - 1
            gi_next = i + 1
            if (gask_fate.get(gi_prev) in ('absorb_next',) and
                    gask_fate.get(gi_next) in ('absorb_prev',)):
                ga_prev = children[gi_prev].get('attributes', {})
                ga_next = children[gi_next].get('attributes', {})
                effective_apos = pt(ga_prev.get('APOS')) or effective_apos
                effective_lpos = pt(ga_next.get('LPOS')) or effective_lpos
                make_rigid = True

        od = _bore_od(attrs, branch_bore) or prev_od or SENTINEL
        delta = vsub(effective_lpos, effective_apos)
        dx, dy, dz = encode_delta(*delta)

        diam = SENTINEL
        if od is not None and od != SENTINEL:
            if prev_od is None or abs(od - prev_od) > 0.5:
                diam = od

        elem_idx = first_element_index + len(elements)
        temp1_val = _temp_for(elem_idx, defaults)
        wall_val = defaults.wall_thickness if elem_idx == 0 else SENTINEL

        hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus

        significant_axes = [
            (axis, abs(value), value)
            for axis, value in enumerate(delta)
            if abs(value) >= 0.5
        ]
        if make_rigid and elem_idx == 0 and len(significant_axes) > 1:
            significant_axes.sort(key=lambda item: item[1])
            minor_axis = significant_axes[0][0]
            split_point = list(effective_apos)
            split_point[minor_axis] = effective_lpos[minor_axis]
            split_point_tuple = tuple(split_point)

            fn1 = na.get_or_alloc(effective_apos)
            tn1 = na.alloc()
            na.set_node_point(tn1, split_point_tuple)
            dx1, dy1, dz1 = encode_delta(*vsub(split_point_tuple, effective_apos))
            elements.append(Element(
                from_node=fn1, to_node=tn1,
                dx=dx1, dy=dy1, dz=dz1,
                diameter=diam, wall=wall_val, temp1=temp1_val,
                modulus=defaults.modulus, hot_mod1=hot1,
                rigid=False,
                source_type=typ,
            ))

            dx2, dy2, dz2 = encode_delta(*vsub(effective_lpos, split_point_tuple))
            tn2 = na.get_or_alloc(effective_lpos)
            elements.append(Element(
                from_node=tn1, to_node=tn2,
                dx=dx2, dy=dy2, dz=dz2,
                diameter=SENTINEL, wall=SENTINEL, temp1=SENTINEL,
                modulus=defaults.modulus, hot_mod1=defaults.modulus,
                rigid=True,
                source_type=typ,
            ))
            pending_sif = False
            pending_sif_ref = None
            pending_sif_point = None
            if od is not None and od != SENTINEL:
                prev_od = od
            route_cursor = effective_lpos
            i += 1
            continue

        # SIF for TEE
        sif_node_val = -1
        if typ == 'TEE':
            # SIF at the TO_NODE (junction)
            sif_node_val = -2  # placeholder: resolved after node alloc

        fn = na.get_or_alloc(effective_apos)
        tn = na.get_or_alloc(effective_lpos)

        if sif_node_val == -2:
            sif_node_val = tn

        e = Element(
            from_node=fn, to_node=tn,
            dx=dx, dy=dy, dz=dz,
            diameter=diam, wall=wall_val, temp1=temp1_val,
            modulus=defaults.modulus, hot_mod1=hot1,
            rigid=make_rigid,
            sif_node=sif_node_val if (typ == 'TEE' or pending_sif) else -1,
            source_type='OLET' if pending_sif else typ,
        )
        if pending_sif and sif_node_val == -1:
            e.sif_node = tn
        elements.append(e)
        if pending_sif and pending_sif_ref and e.sif_node > 0:
            node_refs[pending_sif_ref] = {'node': e.sif_node, 'point': pending_sif_point}
        pending_sif = False
        pending_sif_ref = None
        pending_sif_point = None

        if od is not None and od != SENTINEL:
            prev_od = od
        route_cursor = effective_lpos
        i += 1

    tref = str(branch.get('attributes', {}).get('TREF') or '').strip()
    if tref.startswith('=') and tref in node_refs:
        _merge_tail_to_ref(elements, na, node_refs[tref])
    return elements


def _merge_tail_to_ref(elements: list[Element], na: NodeAllocator, node_ref: dict[str, object]) -> None:
    """Merge a plain branch tail into the referenced OLET/SIF node."""
    if not elements:
        return
    ref_node = node_ref.get('node')
    ref_point = node_ref.get('point')
    if not isinstance(ref_node, int) or ref_point is None:
        return
    last = elements[-1]
    if (
        last.bend_radius == SENTINEL and not last.rigid and
        last.sif_node <= 0 and last.rest_node <= 0
    ):
        start_point = na.point_for_node(last.from_node)
        if start_point is None:
            return
        dx, dy, dz = encode_delta(*vsub(ref_point, start_point))
        last.to_node = ref_node
        last.dx = dx
        last.dy = dy
        last.dz = dz
        return
    if len(elements) < 2:
        return
    prev = elements[-2]
    if (
        prev.bend_radius != SENTINEL or prev.rigid or prev.sif_node > 0 or prev.rest_node > 0 or
        last.bend_radius != SENTINEL or last.rigid or last.sif_node > 0 or last.rest_node > 0
    ):
        return
    start_point = na.point_for_node(prev.from_node)
    if start_point is None:
        return
    dx, dy, dz = encode_delta(*vsub(ref_point, start_point))
    prev.to_node = ref_node
    prev.dx = dx
    prev.dy = dy
    prev.dz = dz
    elements.pop()


def _emit_gask(elements, apos_raw, lpos_raw, od, prev_od, na, defaults, elem_idx, pending_sif):
    if apos_raw is None or lpos_raw is None:
        return
    delta = vsub(lpos_raw, apos_raw)
    dx, dy, dz = encode_delta(*delta)
    diam = SENTINEL
    if od is not None and od != SENTINEL:
        if prev_od is None or abs(od - prev_od) > 0.5:
            diam = od
    temp1_val = _temp_for(elem_idx, defaults)
    hot1 = defaults.hot_mod1 if temp1_val == defaults.temperature1 else defaults.modulus
    fn = na.get_or_alloc(apos_raw)
    tn = na.get_or_alloc(lpos_raw)
    e = Element(
        from_node=fn, to_node=tn,
        dx=dx, dy=dy, dz=dz,
        diameter=diam, wall=SENTINEL, temp1=SENTINEL,
        modulus=defaults.modulus, hot_mod1=defaults.modulus,
        rigid=True,
        sif_node=tn if pending_sif else -1,
        source_type='GASK',
    )
    elements.append(e)


def _temp_for(elem_idx: int, defaults: InputXmlDefaults) -> float:
    if elem_idx == 0:
        return defaults.temperature1
    return SENTINEL

# ---------------------------------------------------------------------------
# Anchor/restraint decoration
# ---------------------------------------------------------------------------

def add_anchors(all_elements: list[Element], branch_anchor_indices: list[int]):
    """Mark specific element FROM or TO nodes as anchors."""
    for info in branch_anchor_indices:
        idx, node_type = info  # node_type: 'from' or 'to'
        if 0 <= idx < len(all_elements):
            node = all_elements[idx].from_node if node_type == 'from' else all_elements[idx].to_node
            all_elements[idx].rest_node = node

# ---------------------------------------------------------------------------
# XML emission
# ---------------------------------------------------------------------------

S = SENTINEL
FMT = '{:.6f}'


def f(v: float) -> str:
    return FMT.format(v)


def xml_attr(value: object) -> str:
    """Escape text for safe XML attribute/comment metadata emission."""
    return (
        str(value or '')
        .replace('&', '&amp;')
        .replace('"', '&quot;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    )


def _restraint_rows_for_element(el: Element) -> list[dict]:
    """Collect the active restraint DOF rows for an element (max 6).

    Legacy anchors (``rest_node``) are emitted as a single rigid all-DOF row
    (TYPE 0) for compatibility; support-derived restraints follow.
    """
    rows: list[dict] = []
    if el.rest_node > 0:
        rows.append({
            'node': el.rest_node, 'type': 0.0, 'stiffness': 9.41952e+19,
            'gap': None, 'friction': None,
        })
    for r in el.restraints:
        rows.append(r)
    return rows[:6]


def emit_restraint_slots(el: Element) -> list[str]:
    """Emit RESTRAINT slots only when an element is restrained.

    Compatibility rule: when present, write a full 6-slot block; populated slots
    carry their node/type/stiffness, the remainder are neutral placeholders.
    """
    rows = _restraint_rows_for_element(el)
    if not rows:
        return []
    parts: list[str] = []
    for slot in range(1, 7):
        if slot <= len(rows):
            r = rows[slot - 1]
            gap = f(r['gap']) if r.get('gap') is not None else f(S)
            fric = f(r['friction']) if r.get('friction') is not None else f(S)
            parts.append(
                f'<RESTRAINT NUM="{slot}" NODE="{f(r["node"])}" TYPE="{f(r["type"])}"'
                f' STIFFNESS="{f(r["stiffness"])}" GAP="{gap}" FRIC_COEF="{fric}"'
                f' CNODE="{f(S)}" XCOSINE="{f(S)}" YCOSINE="{f(S)}" ZCOSINE="{f(S)}"'
                f' TAG="" GUID=""/>'
            )
        else:
            parts.append(
                f'<RESTRAINT NUM="{slot}" NODE="{f(S)}" TYPE="{f(S)}"'
                f' STIFFNESS="{f(S)}" GAP="{f(S)}" FRIC_COEF="{f(S)}"'
                f' CNODE="{f(S)}" XCOSINE="{f(S)}" YCOSINE="{f(S)}" ZCOSINE="{f(S)}"'
                f' TAG="" GUID=""/>'
            )
    return parts


def emit_sif_slots(el: Element) -> list[str]:
    """Emit SIF slots only when an element has SIF data.

    Compatibility rule: when present, write a 2-slot block where slot 1 is
    populated and slot 2 is a neutral placeholder.
    """
    if el.sif_node <= 0:
        return []
    return [
        f'<SIF NODE="{f(el.sif_node)}" TYPE="{f(S)}" SIF1="{f(S)}" SIF2="{f(S)}"/>',
        f'<SIF NODE="{f(S)}" TYPE="{f(S)}" SIF1="{f(S)}" SIF2="{f(S)}"/>',
    ]


def _uxml_geom_comment(el: Element, node_points: dict[int, tuple] | None) -> str | None:
    """Return optional source-coordinate metadata for UXML preview consumers."""
    if not node_points:
        return None
    start = node_points.get(el.from_node)
    end = node_points.get(el.to_node)
    if start is None or end is None:
        return None
    return (
        f'<!-- UXML_GEOM TYPE="{xml_attr(el.source_type)}"'
        f' FROM_X="{f(start[0])}" FROM_Y="{f(start[1])}" FROM_Z="{f(start[2])}"'
        f' TO_X="{f(end[0])}" TO_Y="{f(end[1])}" TO_Z="{f(end[2])}" -->'
    )


def element_to_xml(el: Element, node_points: dict[int, tuple] | None = None) -> str:
    lines = []
    lines.append(
        f'<PIPINGELEMENT FROM_NODE="{f(el.from_node)}" TO_NODE="{f(el.to_node)}"'
        f' DELTA_X="{f(el.dx)}" DELTA_Y="{f(el.dy)}" DELTA_Z="{f(el.dz)}"'
        f' DIAMETER="{f(el.diameter)}" WALL_THICK="{f(el.wall)}"'
        f' INSUL_THICK="{f(S)}" CORR_ALLOW="{f(S)}"'
        f' TEMP_EXP_C1="{f(el.temp1)}"'
        f' TEMP_EXP_C2="{f(S)}" TEMP_EXP_C3="{f(S)}" TEMP_EXP_C4="{f(S)}"'
        f' TEMP_EXP_C5="{f(S)}" TEMP_EXP_C6="{f(S)}" TEMP_EXP_C7="{f(S)}"'
        f' TEMP_EXP_C8="{f(S)}" TEMP_EXP_C9="{f(S)}"'
        f' PRESSURE1="{f(S)}" PRESSURE2="{f(S)}" PRESSURE3="{f(S)}"'
        f' PRESSURE4="{f(S)}" PRESSURE5="{f(S)}" PRESSURE6="{f(S)}"'
        f' PRESSURE7="{f(S)}" PRESSURE8="{f(S)}" PRESSURE9="{f(S)}"'
        f' HYDRO_PRESSURE="{f(S)}"'
        f' MODULUS="{f(el.modulus)}"'
        f' HOT_MOD1="{f(el.hot_mod1)}"'
        f' HOT_MOD2="{f(el.modulus)}" HOT_MOD3="{f(el.modulus)}"'
        f' HOT_MOD4="{f(el.modulus)}" HOT_MOD5="{f(el.modulus)}"'
        f' HOT_MOD6="{f(el.modulus)}" HOT_MOD7="{f(el.modulus)}"'
        f' HOT_MOD8="{f(el.modulus)}" HOT_MOD9="{f(el.modulus)}"'
        f' POISSONS="{f(el.modulus != el.modulus and 0.0 or 0.292)}"'
        f' PIPE_DENSITY="0.007833"'
        f' INSUL_DENSITY="{f(S)}" FLUID_DENSITY="{f(S)}"'
        f' REFRACTORY_DENSITY="{f(S)}" REFRACTORY_THK="{f(S)}"'
        f' CLADDING_DEN="{f(S)}" CLADDING_THK="{f(S)}"'
        f' INSUL_CLAD_UNIT_WEIGHT="{f(S)}"'
        f' MATERIAL_NUM="1.000000" MATERIAL_NAME="LOW CARBON"'
        f' MILL_TOL_PLUS="{f(S)}" MILL_TOL_MINUS="{f(S)}"'
        f' SEAM_WELD="{f(S)}" NAME="{xml_attr(el.to_name)}"'
        f' FROM_NAME="{xml_attr(el.from_name)}" TO_NAME="{xml_attr(el.to_name)}">'
    )

    geom_comment = _uxml_geom_comment(el, node_points)
    if geom_comment:
        lines.append(geom_comment)

    if el.bend_radius != SENTINEL and el.bend_mid_node > 0:
        lines.append(
            f'<BEND RADIUS="{f(el.bend_radius)}" TYPE="{f(S)}"'
            f' ANGLE1="-2.020200" NODE1="{f(el.bend_mid_node)}"'
            f' ANGLE2="{f(S)}" NODE2="{f(S)}"'
            f' ANGLE3="{f(S)}" NODE3="{f(S)}"'
            f' NUM_MITER="{f(S)}" FITTINGTHICKNESS="{f(S)}" KFACTOR="{f(S)}"/>'
        )

    if el.rigid:
        lines.append(f'<RIGID WEIGHT="{f(S)}" TYPE="Unspecified"/>')

    lines.extend(emit_sif_slots(el))
    lines.extend(emit_restraint_slots(el))
    lines.append('</PIPINGELEMENT>')
    return '\n'.join(lines)


def build_xml(
        job_name: str,
        elements: list[Element],
        defaults: InputXmlDefaults,
        node_points: dict[int, tuple] | None = None) -> str:
    num_bend = sum(1 for e in elements if e.bend_radius != SENTINEL and e.bend_mid_node > 0)
    num_rigid = sum(1 for e in elements if e.rigid)
    num_rest = sum(1 for e in elements if e.rest_node > 0 or e.restraints)
    num_sif = sum(1 for e in elements if e.sif_node > 0)
    north_x, north_y, north_z = derive_north(defaults)

    header = (
        f'<CAESARII xmlns="COADE" VERSION="{defaults.version}" XML_TYPE="Input">'
        f'<PIPINGMODEL xmlns="" JOBNAME="{job_name}"'
        f' TIME="" ISSUE_NO=""'
        f' NUMELT="{len(elements)}" NUMNOZ="0" NOHGRS="0"'
        f' NUMBEND="{num_bend}" NUMRIGID="{num_rigid}"'
        f' NUMEXPJNT="0" NUMREST="{num_rest}" NUMFORCMNT="0"'
        f' NUMUNFLOAD="0" NUMWIND="0" NUMELEOFF="0"'
        f' NUMALLOW="0" NUMISECT="{num_sif}"'
        f' NORTH_Z="{north_z}" NORTH_Y="{north_y}"'
        f' NORTH_X="{north_x}">'
    )
    body = '\n'.join(element_to_xml(e, node_points) for e in elements)
    return header + '\n' + body + '\n</PIPINGMODEL></CAESARII>'

# ---------------------------------------------------------------------------
# Branch ordering / anchor detection
# ---------------------------------------------------------------------------

def order_branches(data: list[dict]) -> list[dict]:
    """Return branches in processing order.

    Heuristic: branches with the most PIPE children first (main run),
    then sub-branches.  The JSON order is preserved as fallback.
    """
    def pipe_count(b):
        return sum(1 for c in b.get('children', []) if c.get('type') == 'PIPE')
    return sorted(data, key=pipe_count, reverse=True)


def detect_anchors(branches: list[dict], all_elements: list[Element],
                   branch_start_indices: list[int]) -> list[tuple[int, str]]:
    """Return list of (element_index, 'from'|'to') for anchor restraints.

    Rules:
    - First element of the first (main) branch: anchor at FROM_NODE.
    - Branches that start with a zero-delta BEND anchor the zero-delta bend
      element at TO_NODE.
    - Branches terminating at external equipment anchor the last element TO_NODE.
    """
    anchors = []

    # Rule 1: very first element
    if all_elements:
        anchors.append((0, 'from'))

    branch_names = {str(branch.get('name') or '').strip() for branch in branches}

    for bi, branch in enumerate(branches):
        start_idx = branch_start_indices[bi]
        end_idx = branch_start_indices[bi + 1] - 1 if bi + 1 < len(branch_start_indices) else len(all_elements) - 1
        children = branch.get('children', [])
        # Rule 2: branch starting with zero-delta BEND.
        # Upstream normalizes raw BEND rows to ELBO while preserving RAW_TYPE.
        if children:
            first_child = children[0]
            first_type = str(first_child.get('type', '')).upper()
            first_attrs = first_child.get('attributes', {})
            raw_type = str(first_attrs.get('RAW_TYPE', '')).upper()
        else:
            first_child = {}
            first_type = ''
            first_attrs = {}
            raw_type = ''

        if first_type == 'BEND' or (first_type == 'ELBO' and raw_type == 'BEND'):
            a = first_attrs
            apos = pt(a.get('APOS'))
            lpos = pt(a.get('LPOS'))
            if apos and lpos and vlen(vsub(lpos, apos)) < 1.0:
                anchor_to_idx = start_idx
                if 0 <= anchor_to_idx < len(all_elements):
                    anchors.append((anchor_to_idx, 'to'))

        tref = str(branch.get('attributes', {}).get('TREF') or '').strip()
        if tref and not tref.startswith('=') and tref not in branch_names:
            if 0 <= end_idx < len(all_elements):
                anchors.append((end_idx, 'to'))

    # Deduplicate
    seen: set[tuple] = set()
    result = []
    for a in anchors:
        if a not in seen:
            seen.add(a)
            result.append(a)
    return result

# ---------------------------------------------------------------------------
# Main converter
# ---------------------------------------------------------------------------

def _collect_supports(branches: list[dict]) -> list[dict]:
    """Return every SUPPORT child with a resolvable position, preserving order."""
    supports = []
    for branch in branches:
        for child in branch.get('children', []):
            if child.get('type') != 'SUPPORT':
                continue
            attrs = child.get('attributes', {})
            point = (pt(attrs.get('POS')) or pt(attrs.get('BPOS'))
                     or pt(attrs.get('APOS')) or pt(attrs.get('LPOS')))
            if point is not None:
                supports.append({'attrs': attrs, 'point': point})
    return supports


def _project_onto_segment(p, a, b):
    """Project point p onto segment a->b. Return (t, projected, perp_distance)."""
    axis = vsub(b, a)
    axis_len2 = sum(v * v for v in axis)
    if axis_len2 <= 1e-9:
        return 0.0, a, vlen(vsub(p, a))
    t = sum((p[i] - a[i]) * axis[i] for i in range(3)) / axis_len2
    t_clamped = max(0.0, min(1.0, t))
    projected = tuple(a[i] + axis[i] * t_clamped for i in range(3))
    return t, projected, vlen(vsub(p, projected))


def apply_support_restraints(all_elements: list[Element], na: NodeAllocator,
                             branches: list[dict], defaults: InputXmlDefaults,
                             config: dict) -> dict:
    """Insert restraint nodes at SUPPORT locations and attach restraint DOF rows.

    Additive and localised: only elements that actually host a support are
    modified (optionally split), so geometry without supports is untouched.
    Returns statistics for logging.
    """
    stats = {'supports': 0, 'classified': 0, 'attached_existing': 0,
             'split_inserted': 0, 'unsnapped': 0, 'rows': 0}
    if not config.get('enabled', True):
        return stats

    supports = _collect_supports(branches)
    stats['supports'] = len(supports)
    snap_tol = float(config.get('snap_tolerance_mm', 25.0))
    coincide_tol = float(config.get('node_coincidence_mm', 1.0))
    anchor_stiffness = float(defaults.anchor_stiffness)

    for sup in supports:
        attrs = sup['attrs']
        rows, kind = support_restraint_mod.restraint_rows_for(attrs, config, anchor_stiffness)
        if not rows:
            continue
        stats['classified'] += 1
        p = sup['point']
        name = support_restraint_mod.support_node_name(attrs, config) or ''

        # 1) Coincides with an existing node?
        best_node, best_d = None, coincide_tol
        for node, q in na._point_by_node.items():
            d = vlen(vsub(p, q))
            if d <= best_d:
                best_node, best_d = node, d
        if best_node is not None:
            host = next((e for e in all_elements
                         if e.to_node == best_node or e.from_node == best_node), None)
            if host is not None:
                for r in rows:
                    host.restraints.append({**r, 'node': best_node})
                if name:
                    if host.to_node == best_node and not host.to_name:
                        host.to_name = name
                    elif host.from_node == best_node and not host.from_name:
                        host.from_name = name
                stats['attached_existing'] += 1
                stats['rows'] += len(rows)
                continue

        # 2) Lies on a straight element -> split and insert a node.
        target_idx, target = None, None
        for idx, e in enumerate(all_elements):
            if e.bend_radius != SENTINEL or e.rigid:
                continue  # do not split arcs / rigid joints
            a = na.point_for_node(e.from_node)
            b = na.point_for_node(e.to_node)
            if a is None or b is None:
                continue
            t, projected, perp = _project_onto_segment(p, a, b)
            if 1e-3 < t < 1 - 1e-3 and perp <= snap_tol:
                target_idx, target = idx, (e, a, b, projected)
                break
        if target is None:
            stats['unsnapped'] += 1
            continue

        e, a, b, q_point = target
        new_node = na.alloc()
        na.set_node_point(new_node, q_point)
        # Second arm continues to the original to_node.
        ndx, ndy, ndz = encode_delta(*vsub(b, q_point))
        arm2 = Element(
            from_node=new_node, to_node=e.to_node,
            dx=ndx, dy=ndy, dz=ndz,
            diameter=SENTINEL, wall=SENTINEL, temp1=SENTINEL,
            modulus=e.modulus, hot_mod1=e.hot_mod1,
            rigid=False, source_type=e.source_type,
            from_name=name, to_name=e.to_name,
        )
        # Shorten the original arm to the support node.
        e.to_name = ''
        edx, edy, edz = encode_delta(*vsub(q_point, a))
        e.dx, e.dy, e.dz = edx, edy, edz
        e.to_node = new_node
        for r in rows:
            arm2.restraints.append({**r, 'node': new_node})
        all_elements.insert(target_idx + 1, arm2)
        stats['split_inserted'] += 1
        stats['rows'] += len(rows)

    return stats


def convert(input_path: Path, output_path: Path, defaults: InputXmlDefaults,
            job_name: str | None = None, node_start: int = 10, node_step: int = 10,
            support_config: dict | None = None):
    data = json.loads(input_path.read_text(encoding='utf-8-sig'))
    if not isinstance(data, list):
        data = [data]

    # Apply world datum (G2) + vertical-axis map (G3) before any geometry is
    # derived, so deltas, node points, supports and COORDS are all consistent.
    transform_coordinates(data, defaults)

    branches = order_branches(data)
    na = NodeAllocator(node_start, node_step)

    all_elements: list[Element] = []
    branch_start_indices: list[int] = []
    node_refs: dict[str, dict[str, object]] = {}

    for branch in branches:
        branch_start_indices.append(len(all_elements))
        elems = process_branch(branch, na, defaults, len(all_elements), node_refs)
        all_elements.extend(elems)

    # Apply anchors
    anchor_specs = detect_anchors(branches, all_elements, branch_start_indices)
    add_anchors(all_elements, anchor_specs)

    # Apply supports -> restraints (G4). Additive: only support-hosting elements
    # are modified. Disabled cleanly via the support config 'enabled' flag.
    support_cfg = support_restraint_mod.merge_config(support_config)
    support_stats = apply_support_restraints(all_elements, na, branches, defaults, support_cfg)

    jn = job_name or input_path.stem
    xml = build_xml(jn, all_elements, defaults, na._point_by_node)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(xml, encoding='utf-8')

    print(f'Wrote {len(all_elements)} elements to {output_path}')
    bend_c = sum(1 for e in all_elements if e.bend_radius != SENTINEL and e.bend_mid_node > 0)
    rigid_c = sum(1 for e in all_elements if e.rigid)
    rest_c = sum(1 for e in all_elements if e.rest_node > 0 or e.restraints)
    sif_c = sum(1 for e in all_elements if e.sif_node > 0)
    if support_stats['supports']:
        print(f"  supports: scanned={support_stats['supports']} "
              f"classified={support_stats['classified']} "
              f"attached={support_stats['attached_existing']} "
              f"split={support_stats['split_inserted']} "
              f"unsnapped={support_stats['unsnapped']} "
              f"rows={support_stats['rows']}")
    print(f'  NUMELT={len(all_elements)} NUMBEND={bend_c} NUMRIGID={rigid_c} '
          f'NUMREST={rest_c} NUMISECT={sif_c}')

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description='Convert staged JSON to CAESAR II InputXML')
    p.add_argument('--input', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--bookmark', type=Path)
    p.add_argument('--support-config', type=Path,
                   help='JSON file with support->restraint classification '
                        'overrides (merged onto built-in defaults).')
    p.add_argument('--support-config-json', type=str,
                   help='Inline JSON string with support->restraint overrides '
                        '(merged onto built-in defaults; takes precedence over '
                        '--support-config).')
    p.add_argument('--node-start', type=int, default=10)
    p.add_argument('--node-step', type=int, default=10)
    p.add_argument('--job-name', type=str)
    p.add_argument('--temperature1', type=float)
    p.add_argument('--wall-thickness', type=float)
    p.add_argument('--modulus', type=float)
    p.add_argument('--material-num', type=float)
    p.add_argument('--material-name', type=str)
    p.add_argument('--version', type=str)
    # Coordinate frame (G2/G3).
    p.add_argument('--vertical-axis', choices=['Y', 'Z', 'y', 'z'],
                   help="CAESAR axis that receives PDMS Up. 'Y' = AVEVA "
                        "psi2cii convention (default); 'Z' = legacy identity.")
    p.add_argument('--datum-e', type=float, help='World datum added to PDMS E (mm).')
    p.add_argument('--datum-n', type=float, help='World datum added to PDMS N (mm).')
    p.add_argument('--datum-u', type=float, help='World datum added to PDMS U (mm).')
    # Supports (G4).
    p.add_argument('--no-supports', action='store_true',
                   help='Disable mapping SUPPORT components to restraints.')
    return p


def main():
    args = build_parser().parse_args()
    cli_overrides = {
        'temperature1': args.temperature1,
        'wall_thickness': args.wall_thickness,
        'modulus': args.modulus,
        'material_num': args.material_num,
        'material_name': args.material_name,
        'version': args.version,
        'vertical_axis': args.vertical_axis.upper() if args.vertical_axis else None,
        'datum_e': args.datum_e,
        'datum_n': args.datum_n,
        'datum_u': args.datum_u,
    }
    defaults = load_defaults(args.bookmark, cli_overrides)
    support_config = None
    if args.support_config:
        support_config = json.loads(args.support_config.read_text(encoding='utf-8'))
    if args.support_config_json:
        support_config = {**(support_config or {}), **json.loads(args.support_config_json)}
    if args.no_supports:
        support_config = {**(support_config or {}), 'enabled': False}
    convert(
        args.input, args.output, defaults,
        job_name=args.job_name,
        node_start=args.node_start,
        node_step=args.node_step,
        support_config=support_config,
    )


if __name__ == '__main__':
    main()
