"""Helpers for normalizing AI-generated lab config payloads."""

from typing import Any, Dict, List, Optional


def infer_lab_category(experiment_code: str) -> str:
    """Infer a broad category from the experiment code prefix."""
    normalized = experiment_code.strip().upper().replace(" ", "")
    if "-" not in normalized and len(normalized) > 1:
        normalized = normalized.replace(normalized[0], f"{normalized[0]}-", 1)

    prefix = normalized.split("-")[0]
    return {
        "A": "mechanics",
        "B": "measurement",
        "C": "heat",
        "D": "waves",
        "E": "optics",
        "F": "electricity",
        "N": "nuclear",
        "S": "renewable",
    }.get(prefix, "measurement")


def normalize_lab_config(raw: Optional[Dict[str, Any]], experiment_code: str) -> Dict[str, Any]:
    """Normalize partially structured LabConfig output into a stable shape."""
    normalized_code = experiment_code.strip().upper().replace(" ", "")
    if "-" not in normalized_code and len(normalized_code) > 1:
        normalized_code = normalized_code.replace(normalized_code[0], f"{normalized_code[0]}-", 1)

    data = raw or {}
    tier = data.get("tier", "composable")
    if tier not in {"builtin", "composable", "legacy"}:
        tier = "composable"

    controls = data.get("controls") if isinstance(data.get("controls"), list) else []
    instruments = data.get("instruments") if isinstance(data.get("instruments"), list) else []
    tables = data.get("tables") if isinstance(data.get("tables"), list) and data.get("tables") else [{
        "id": f"{normalized_code.lower()}_generated",
        "title": "Generated Data",
        "headers": ["Input", "Response"],
        "rows": 6,
    }]
    procedure = data.get("procedure") if isinstance(data.get("procedure"), list) and data.get("procedure") else [
        {"index": 0, "instruction": "Adjust the apparatus to the initial condition.", "expectedAction": "adjust"},
        {"index": 1, "instruction": "Take a measurement and record the result.", "expectedAction": "measure"},
        {"index": 2, "instruction": "Repeat for additional settings to complete the table.", "expectedAction": "record"},
    ]

    return {
        "experimentCode": data.get("experimentCode", normalized_code),
        "experimentTitle": data.get("experimentTitle", f"Generated {normalized_code} Experiment"),
        "kitId": data.get("kitId", "ComposableKit" if tier != "legacy" else "LegacySimAdapter"),
        "tier": tier,
        "category": data.get("category", infer_lab_category(normalized_code)),
        "controls": controls,
        "instruments": instruments,
        "tables": tables,
        "procedure": procedure,
        "legacySimulationScript": data.get("legacySimulationScript", "") if tier == "legacy" else "",
    }
