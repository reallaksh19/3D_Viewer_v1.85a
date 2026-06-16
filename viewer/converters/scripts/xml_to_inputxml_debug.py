#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import xml_to_cii2019 as base
import xml_to_cii2019_patched as patched

POINT_FIELDS = ("ComponentType", "DTXR_POS", "DTXR_PS", "PipingClass", "Rating", "Position")


def _safe_text(value: object) -> str:
    return "" if value is None else str(value).strip()


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[1] if tag.startswith("{") else tag


def _namespace(tag: str) -> str:
    return tag[1:].split("}", 1)[0] if tag.startswith("{") else ""


def _q(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}" if namespace else name


def _child_text(parent: ET.Element | None, namespace: str, name: str) -> str:
    if parent is None:
        return ""
    child = parent.find(_q(namespace, name))
    return _safe_text(child.text if child is not None else "")


def _fmt(value: float | int | None, decimals: int = 6) -> str:
    if value is None:
        return "-1.0101"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "-1.0101"
    if not math.isfinite(number):
        return "-1.0101"
    if abs(number - round(number)) < 1e-9:
        return str(int(round(number)))
    text = f"{number:.{decimals}f}".rstrip("0").rstrip(".")
    return text or "0"


def _case(values: tuple[float, ...], index: int) -> float:
    if index < len(values):
        value = values[index]
        if abs(value - patched.SENTINEL_TEMPERATURE) > 1e-9:
            return value
    return -1.0101


def _edge_delta(edge: base.Edge) -> tuple[float, float, float]:
    mapped_from = base._map_position_to_cii(edge.from_node.position)
    mapped_to = base._map_position_to_cii(edge.to_node.position)
    return tuple(mapped_to[i] - mapped_from[i] for i in range(3))


def _inputxml_friction_value(restraint: base.RestraintSpec, support_config: dict[str, Any]) -> float:
    if patched._truthy(support_config.get("useFrictionSentinelForNonYSupports", True)) and restraint.type_code != 14:
        return -1.0101
    return restraint.friction


def _component_type_to_xml_type(component_type: str, support_config: dict[str, Any]) -> str:
    comp = _safe_text(component_type).upper()
    component_map = support_config.get("componentTypeToXmlType", {})
    if isinstance(component_map, dict):
        mapped = _safe_text(component_map.get(comp) or component_map.get(component_type))
        if mapped:
            return mapped.upper()
    if comp == "ANCI":
        return "+Y"
    return ""


def _component_type_restraint_specs(document: base.XmlDocument, support_config: dict[str, Any]) -> dict[int, tuple[base.RestraintSpec, ...]]:
    stiffness = patched._to_float(support_config.get("defaultStiffness"), base.DEFAULT_LINEAR_STIFFNESS)
    gap = patched._to_float(support_config.get("defaultGap"), 0.0)
    friction = patched._to_float(support_config.get("defaultFriction"), 0.3)
    specs: dict[int, tuple[base.RestraintSpec, ...]] = {}
    for branch in document.branches:
        for node in branch.nodes:
            if node.node_number is None or node.node_number <= 0:
                continue
            xml_type = _component_type_to_xml_type(node.component_type, support_config)
            if not xml_type:
                continue
            specs[node.node_number] = (
                base.RestraintSpec(
                    type_code=base._restraint_type_to_code(xml_type),
                    stiffness=stiffness,
                    gap=gap,
                    friction=friction,
                    is_open_end=False,
                ),
            )
    return specs


def _merge_spec_maps(*maps: dict[int, tuple[base.RestraintSpec, ...]]) -> dict[int, tuple[base.RestraintSpec, ...]]:
    merged: dict[int, tuple[base.RestraintSpec, ...]] = {}
    for spec_map in maps:
        for node_number, specs in spec_map.items():
            merged[node_number] = patched._merge_specs(merged.get(node_number, tuple()), specs)
    return merged


def _add_restraint(parent: ET.Element, restraint: base.RestraintSpec, node_number: int, support_config: dict[str, Any]) -> None:
    fric = _inputxml_friction_value(restraint, support_config)
    ET.SubElement(parent, "RESTRAINT", {
        "NUM": "1",
        "NODE": _fmt(node_number),
        "TYPE": _fmt(restraint.type_code),
        "STIFFNESS": _fmt(restraint.stiffness),
        "GAP": _fmt(restraint.gap),
        "FRIC_COEF": _fmt(fric),
        "CNODE": "0",
        "XCOSINE": "-1.0101",
        "YCOSINE": "-1.0101",
        "ZCOSINE": "-1.0101",
        "TAG": "ANCI/DTXR-derived",
        "GUID": "",
    })


def _node_meta(final_xml: Path) -> tuple[dict[int, dict[str, str]], dict[str, dict[str, str]], dict[str, float]]:
    root = ET.parse(final_xml).getroot()
    namespace = _namespace(root.tag)
    by_number: dict[int, dict[str, str]] = {}
    by_name: dict[str, dict[str, str]] = {}
    hydro_by_branch: dict[str, float] = {}
    for branch in root.iter():
        if _local_name(branch.tag) != "Branch":
            continue
        pressure = branch.find(_q(namespace, "Pressure"))
        hydro_by_branch[_child_text(branch, namespace, "Branchname")] = patched._to_float(_child_text(pressure, namespace, "HydroPressure"), 0.0)
    for node in root.iter():
        if _local_name(node.tag) != "Node":
            continue
        meta = {field: _child_text(node, namespace, field) for field in POINT_FIELDS}
        name = _child_text(node, namespace, "NodeName")
        number_text = _child_text(node, namespace, "NodeNumber")
        try:
            number = int(float(number_text))
        except ValueError:
            number = None
        if number is not None:
            by_number[number] = meta
        if name:
            by_name[name] = meta
    return by_number, by_name, hydro_by_branch


def _point_meta(edge: base.Edge, by_number: dict[int, dict[str, str]], by_name: dict[str, dict[str, str]]) -> tuple[str, dict[str, str]]:
    meta = by_number.get(edge.to_node.node_number) or by_name.get(edge.to_node.node_name)
    if meta:
        return "TO", meta
    return "FROM", by_number.get(edge.from_node.node_number) or by_name.get(edge.from_node.node_name) or {}


def _add_point_properties(element: ET.Element, edge: base.Edge, by_number: dict[int, dict[str, str]], by_name: dict[str, dict[str, str]]) -> None:
    basis, meta = _point_meta(edge, by_number, by_name)
    ET.SubElement(element, "Point_properties_basis").text = basis
    fallback_position = edge.to_node.position if basis == "TO" else edge.from_node.position
    fallback_component = edge.to_node.component_type if basis == "TO" else edge.from_node.component_type
    fallback = {
        "ComponentType": fallback_component,
        "Position": " ".join(_fmt(value, 6) for value in fallback_position),
    }
    for field in POINT_FIELDS:
        value = _safe_text(meta.get(field)) or _safe_text(fallback.get(field))
        if value:
            ET.SubElement(element, field).text = value


def _inputxml_from_final_xml(final_xml: Path, support_config: dict[str, Any], use_json_restraints: bool) -> ET.ElementTree:
    document = base._parse_xml_document(final_xml)
    by_number, by_name, hydro_by_branch = _node_meta(final_xml)
    insulation_density_map = patched._branch_insulation_density_map(final_xml)
    dtxr_specs, node_number_kind_map = patched._build_keyword_restraint_specs(final_xml, support_config)
    xml_specs = base._build_explicit_restraint_specs(document.branches)
    component_specs = _component_type_restraint_specs(document, support_config)
    explicit_specs = _merge_spec_maps(component_specs, dtxr_specs) if use_json_restraints else _merge_spec_maps(component_specs, xml_specs, dtxr_specs)
    root = ET.Element("CAESARII", {"XML_TYPE": "Input", "VERSION": "2019", "SOURCE": "XML->CII enriched InputXML debug export"})
    model = ET.SubElement(root, "PIPINGMODEL", {"JOBNAME": document.metadata.project_name or Path(final_xml).stem, "TIME": document.metadata.date_time, "NORTH_Y": "1", "NORTH_Z": "0", "NUMELEMENTS": "0", "NUMREST": "0"})
    element_count = 0
    restraint_count = 0
    for branch in document.branches:
        nodes = [node for node in branch.nodes if node.node_number is not None]
        for from_node, to_node in zip(nodes, nodes[1:]):
            if from_node.node_number <= 0 or to_node.node_number <= 0:
                continue
            edge = base.Edge(from_node=from_node, to_node=to_node, branch_temperature=branch.branch_temperature, branch_pressure=branch.branch_pressure, branch_fluid_density=branch.branch_fluid_density, branch_name=branch.branch_name, branch_material_number=branch.material_number)
            dx, dy, dz = _edge_delta(edge)
            material = to_node.material_code or from_node.material_code or branch.material_number
            insulation_density = insulation_density_map.get(branch.branch_name, 0.0)
            fluid_dens_val = patched._density_for_output(branch.branch_fluid_density, support_config)
            insul_dens_val = patched._density_for_output(insulation_density, support_config)
            attrs = {
                "FROM_NODE": _fmt(from_node.node_number), "TO_NODE": _fmt(to_node.node_number), "FROM_NAME": from_node.node_name, "TO_NAME": to_node.node_name,
                "LINE_ID": branch.branch_name, "DELTA_X": _fmt(dx, 4), "DELTA_Y": _fmt(dy, 4), "DELTA_Z": _fmt(dz, 4),
                "DIAMETER": _fmt(base._element_outside_diameter(edge), 5), "WALL_THICK": _fmt(from_node.wall_thickness if from_node.wall_thickness > 0 else to_node.wall_thickness, 6),
                "INSUL_THICK": _fmt(to_node.insulation_thickness, 6), "CORR_ALLOW": _fmt(to_node.corrosion_allowance, 6),
                "TEMP_EXP_C1": _fmt(_case(branch.temperatures, 0), 6), "TEMP_EXP_C2": _fmt(_case(branch.temperatures, 1), 6), "TEMP_EXP_C3": _fmt(_case(branch.temperatures, 2), 6),
                "PRESSURE_C1": _fmt(_case(branch.pressures, 0), 6), "PRESSURE_C2": _fmt(_case(branch.pressures, 1), 6), "PRESSURE_C3": _fmt(_case(branch.pressures, 2), 6),
                "MATERIAL_NUM": _fmt(material), "FLUID_DENSITY": _fmt(fluid_dens_val, 9), "INSUL_DENSITY": _fmt(insul_dens_val, 9),
                "HYDRO_PRESSURE": _fmt(hydro_by_branch.get(branch.branch_name, 0.0), 6),
            }
            for index in range(3, 9):
                attrs[f"TEMP_EXP_C{index + 1}"] = _fmt(_case(branch.temperatures, index), 6)
                attrs[f"PRESSURE_C{index + 1}"] = _fmt(_case(branch.pressures, index), 6)
            element = ET.SubElement(model, "PIPINGELEMENT", attrs)
            _add_point_properties(element, edge, by_number, by_name)
            if to_node.bend_radius > 0:
                ET.SubElement(element, "BEND", {"RADIUS": _fmt(to_node.bend_radius, 6), "TYPE": _fmt(to_node.bend_type or 0), "ANGLE1": "0", "NODE1": _fmt(to_node.node_number), "ANGLE2": "0", "NODE2": _fmt(to_node.node_number), "ANGLE3": "0", "NODE3": _fmt(to_node.node_number), "NUM_MITER": "0", "FITTINGTHICKNESS": _fmt(to_node.wall_thickness, 6), "KFACTOR": "0"})
            if to_node.rigid is not None or abs(to_node.weight) > 1e-9:
                ET.SubElement(element, "RIGID", {"WEIGHT": _fmt(to_node.weight, 6)})
            if to_node.component_type.upper() in {"TEE", "OLET", "BRAN"}:
                ET.SubElement(element, "SIF", {"NODE": _fmt(to_node.node_number)})
            for slot, restraint in enumerate(explicit_specs.get(to_node.node_number, tuple()), start=1):
                _add_restraint(element, restraint, to_node.node_number, support_config)
                element[-1].set("NUM", str(slot))
                restraint_count += 1
            element_count += 1
    model.set("NUMELEMENTS", str(element_count))
    model.set("NUMREST", str(restraint_count))
    return ET.ElementTree(root)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export XML->CII final enriched data as CAESAR InputXML.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--staged-json", required=False, type=Path, default=None)
    parser.add_argument("--support-config-json", required=False, default="")
    parser.add_argument("--use-restraint-type-based-on-json", dest="use_restraint_type_based_on_json", action="store_true", default=True)
    parser.add_argument("--no-use-restraint-type-based-on-json", dest="use_restraint_type_based_on_json", action="store_false")
    parser.add_argument("--split-condensed-valve-flange", dest="split_condensed_valve_flange", action="store_true", default=None)
    parser.add_argument("--no-split-condensed-valve-flange", dest="split_condensed_valve_flange", action="store_false")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    support_config = patched._load_support_config(args.support_config_json)
    if args.split_condensed_valve_flange is not None:
        support_config["splitCondensedValveFlange"] = bool(args.split_condensed_valve_flange)
    final_xml = patched._maybe_enrich_from_staged_json(args.input, args.staged_json, support_config)
    final_xml = patched._apply_process_data_to_xml(final_xml, support_config)
    tree = _inputxml_from_final_xml(final_xml, support_config, args.use_restraint_type_based_on_json)
    ET.indent(tree, space="  ")
    tree.write(args.output, encoding="unicode", xml_declaration=True)
    print(f"Wrote enriched InputXML debug artifact: {args.output}")


if __name__ == "__main__":
    main()
