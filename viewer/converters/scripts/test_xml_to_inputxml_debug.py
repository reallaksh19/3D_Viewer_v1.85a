import importlib.util
import pathlib
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location("xml_to_inputxml_debug", ROOT / "xml_to_inputxml_debug.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

ACTUAL_XML = REPO / "CII error" / "BM8" / "1885" / "1885-GH-TYP-04-STEAM-02.xml"
ACTUAL_JSON = REPO / "CII error" / "1885s.json"


def _cfg():
    return {
        "insulationDensityDefault": 210,
        "dtxrPositionOffset": {"enabled": True, "xOffset": 150500, "yOffset": 43000, "zOffset": 100000, "tolerance": 0.5},
        "linelist": {
            "lineKeyTokenPositions": "4",
            "masterRows": [
                {"lineNo": "S8810101", "__EMPTY_12": "Density", "__EMPTY_14": "Mixed kg/m³", "__EMPTY_23": "Pressure Min kPa(g)", "__EMPTY_24": "Temp Max ºC", "__EMPTY_25": "Temp Min ºC", "__EMPTY_28": "Insulation Thickness [mm]", "__EMPTY_32": "Test Pressure"},
                {"lineNo": "S8810101", "__EMPTY_12": "Gas kg/m³", "__EMPTY_14": "-", "__EMPTY_23": "FV", "__EMPTY_24": "82", "__EMPTY_25": "0", "__EMPTY_28": "50", "__EMPTY_32": "kPa(g)"},
                {"lineNo": "S8810101", "__EMPTY_12": "8.44", "__EMPTY_14": "42.8", "__EMPTY_23": "0", "__EMPTY_24": "260", "__EMPTY_25": "5", "__EMPTY_28": "40", "__EMPTY_32": "15000"},
            ],
            "fieldMap": {},
        },
    }


def _text(parent, name):
    child = parent.find(name)
    return (child.text or '').strip() if child is not None else ''


def test_xml_to_cii_enriched_inputxml_debug_export_contains_explicit_fields(tmp_path):
    cfg = _cfg()
    mod.patched._normalize_process_field_map(cfg)
    assert cfg["linelist"]["fieldMap"]["hydroPressure"] == "__EMPTY_32"
    enriched = mod.patched._maybe_enrich_from_staged_json(ACTUAL_XML, ACTUAL_JSON, cfg)
    final_xml = mod.patched._apply_process_data_to_xml(enriched, cfg)
    tree = mod._inputxml_from_final_xml(final_xml, cfg, use_json_restraints=True)
    out = tmp_path / "enriched.input.xml"
    tree.write(out, encoding="unicode", xml_declaration=True)
    root = ET.parse(out).getroot()
    assert root.tag == "CAESARII"
    model = root.find("PIPINGMODEL")
    assert model is not None
    elements = model.findall("PIPINGELEMENT")
    assert len(elements) > 0
    assert int(model.attrib["NUMELEMENTS"]) == len(elements)
    assert int(model.attrib["NUMREST"]) > 0

    element_to_30 = next((el for el in elements if el.attrib.get("TO_NODE") == "30"), None)
    assert element_to_30 is not None
    assert element_to_30.attrib["DIAMETER"] == "273"
    assert "WALL_THICK" in element_to_30.attrib
    assert "INSUL_THICK" in element_to_30.attrib
    assert element_to_30.attrib["TEMP_EXP_C1"] == "82"
    assert element_to_30.attrib["TEMP_EXP_C3"] == "5"
    assert element_to_30.attrib["PRESSURE_C1"] == "0"
    assert element_to_30.attrib["FLUID_DENSITY"] == "0.0000428"
    assert element_to_30.attrib["INSUL_DENSITY"] == "0.00021"
    assert element_to_30.attrib["HYDRO_PRESSURE"] == "15000"

    assert _text(element_to_30, "Point_properties_basis") == "TO"
    assert _text(element_to_30, "ComponentType") == "ATTA"
    assert _text(element_to_30, "Position") == "593473.15 -1120710.00 103209.55"
    assert "GUIDE PDO-TYPE-603" in _text(element_to_30, "DTXR_PS")
    assert "Pipe Rest XRT01" in _text(element_to_30, "DTXR_POS")

    restraint_types = [int(float(rest.attrib["TYPE"])) for rest in element_to_30.findall("RESTRAINT")]
    assert 14 in restraint_types
    assert 3 not in restraint_types
    assert 19 not in restraint_types
    assert element_to_30.find("RIGID") is None
