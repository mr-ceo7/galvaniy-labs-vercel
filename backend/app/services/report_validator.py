"""Galvaniy Labs Backend — Report Validator.

Ported from services/reportValidator.ts.
Validates the structure and data consistency of generated reports.
"""

from typing import Any, Dict, List
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    """Result of report validation."""

    valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def validate_report(report: Dict[str, Any], experiment_code: str) -> ValidationResult:
    """Validate a generated report for structural correctness.

    Args:
        report: The generated report dictionary.
        experiment_code: The experiment code that was requested.

    Returns:
        ValidationResult with errors and warnings.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Structure Validation
    if not report.get("title"):
        errors.append("Missing title")

    if not isinstance(report.get("objectives"), list):
        errors.append("Missing objectives array")

    if not isinstance(report.get("apparatus"), list):
        errors.append("Missing apparatus array")

    if not isinstance(report.get("procedure"), list):
        errors.append("Missing procedure array")

    # Validate multi-table structure
    tables = report.get("tables")
    if not isinstance(tables, list) or len(tables) == 0:
        errors.append('Missing or empty "tables" array')
    else:
        for index, table in enumerate(tables):
            if not isinstance(table.get("headers"), list):
                errors.append(f"Table {index + 1} missing headers")
            if not isinstance(table.get("rows"), list):
                errors.append(f"Table {index + 1} missing rows")

    if not report.get("simulationScript"):
        warnings.append("Missing simulationScript - Canvas will be empty")

    if errors:
        return ValidationResult(valid=False, errors=errors, warnings=warnings)

    # 2. Data Consistency Check
    if isinstance(tables, list):
        for idx, table in enumerate(tables):
            headers = table.get("headers")
            rows = table.get("rows")
            if isinstance(headers, list) and isinstance(rows, list):
                col_count = len(headers)
                mismatch = any(
                    isinstance(row, list) and len(row) != col_count for row in rows
                )
                if mismatch:
                    title = table.get("title", "Untitled")
                    warnings.append(
                        f"Table {idx + 1} ({title}) data columns do not match header count."
                    )

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )
