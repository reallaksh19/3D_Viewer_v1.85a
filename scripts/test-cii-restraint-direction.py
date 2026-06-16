#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "viewer" / "converters" / "scripts"

import sys
sys.path.insert(0, str(SCRIPTS))

spec = importlib.util.spec_from_file_location("xml_to_cii2019_direction", SCRIPTS / "xml_to_cii2019_direction.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

base = module.base
patched = module.patched

node = ET.fromstring(
    """
    <Node>
      <Restraint>
        <Type>LIM</Type>
        <Stiffness>1.0</Stiffness>
        <Gap>0</Gap>
        <Friction>-1.0101</Friction>
        <DirectionCosineX>0.577350269</DirectionCosineX>
        <DirectionCosineY>0.577350269</DirectionCosineY>
        <DirectionCosineZ>0.577350269</DirectionCosineZ>
      </Restraint>
    </Node>
    """
)

parsed = base._parse_restraints(node, "")
assert len(parsed) == 1
assert parsed[0].type_code == 9
assert parsed[0].direction_cosines is not None
assert abs(parsed[0].direction_cosines[0] - 0.577350269) < 1e-6
assert abs(parsed[0].direction_cosines[1] - 0.577350269) < 1e-6
assert abs(parsed[0].direction_cosines[2] - 0.577350269) < 1e-6

model = SimpleNamespace(
    restraints=[
        base.AssignedRestraint(
            node_number=100,
            specs=parsed,
            position=(0.0, 0.0, 0.0),
            node_name="PS-100",
            kind="LINESTOP",
        )
    ]
)

payload = patched._patched_build_restraint_payload_factory({})(model)
assert len(payload) >= 2
line2_values = [float(value) for value in payload[1].split()[:3]]
assert abs(line2_values[0] - 0.577350269) < 1e-6
assert abs(line2_values[1] - 0.577350269) < 1e-6
assert abs(line2_values[2] - 0.577350269) < 1e-6

fallback_spec = base.RestraintSpec(
    type_code=14,
    stiffness=1.0,
    gap=0.0,
    friction=0.3,
    is_open_end=False,
)
fallback_model = SimpleNamespace(
    restraints=[
        base.AssignedRestraint(
            node_number=200,
            specs=(fallback_spec,),
            position=(0.0, 0.0, 0.0),
            node_name="PS-200",
            kind="REST",
        )
    ]
)
fallback_payload = patched._patched_build_restraint_payload_factory({})(fallback_model)
fallback_values = [float(value) for value in fallback_payload[1].split()[:3]]
assert fallback_values == [0.0, 1.0, 0.0]

print("✅ CII restraint direction-cosine regression tests passed")
