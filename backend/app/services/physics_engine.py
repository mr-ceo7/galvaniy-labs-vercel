"""Galvaniy Labs Backend — Physics Engine Bridge.

Runs the TypeScript physics engine through a local esbuild-backed runner.

When a kit is available, the engine provides:
- Pre-computed data tables with realistic noise
- Experiment controls and procedure steps
- Full built-in lab config for the virtual lab UI

This data replaces AI-hallucinated measurements in reports,
dramatically improving accuracy and consistency.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Resolve path relative to this file → backend/app/services → project root
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
_TS_RUNNER = os.path.join(_PROJECT_ROOT, "scripts", "run-ts-entry.mjs")


async def _run_engine_cli(experiment_code: str) -> Optional[Dict[str, Any]]:
    """Execute the TypeScript engine CLI through the local runner."""
    cli_path = os.path.join(_PROJECT_ROOT, "engine", "cli-entry.ts")

    if not os.path.exists(cli_path):
        logger.warning(f"[PhysicsEngine] CLI not found at {cli_path}")
        return None

    if not os.path.exists(_TS_RUNNER):
        logger.warning(f"[PhysicsEngine] TS runner not found at {_TS_RUNNER}")
        return None

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", _TS_RUNNER, cli_path, experiment_code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=_PROJECT_ROOT,
        )

        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=20.0)

        if proc.returncode != 0:
            logger.warning(
                f"[PhysicsEngine] CLI failed for {experiment_code}: "
                f"exit={proc.returncode}, stderr={stderr.decode()[:300]}"
            )
            return None

        return json.loads(stdout.decode())
    except asyncio.TimeoutError:
        logger.error(f"[PhysicsEngine] CLI timed out for {experiment_code}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"[PhysicsEngine] Invalid JSON from CLI: {e}")
        return None
    except FileNotFoundError:
        logger.warning("[PhysicsEngine] node not found — is Node.js installed?")
        return None
    except Exception as e:
        logger.error(f"[PhysicsEngine] Unexpected error: {e}")
        return None


async def get_engine_data(experiment_code: str) -> Optional[Dict[str, Any]]:
    """Run the physics engine CLI and return deterministic experiment data.

    Args:
        experiment_code: The experiment code (e.g., "A-2", "F-18").

    Returns:
        Dict with engine data if a built-in kit exists, None otherwise.
    """
    data = await _run_engine_cli(experiment_code)

    if not data or not data.get("available"):
        logger.info(
            f"[PhysicsEngine] No built-in kit for {experiment_code}. "
            f"Falling back to AI-only generation."
        )
        return None

    logger.info(
        f"[PhysicsEngine] ✅ Kit found: {data.get('name')} "
        f"({data.get('dataPointCount', 0)} data points)"
    )
    return data


async def get_lab_setup(experiment_code: str) -> Optional[Dict[str, Any]]:
    """Return the built-in lab config for an experiment if available."""
    data = await _run_engine_cli(experiment_code)
    if not data or not data.get("available"):
        return None
    return data.get("labConfig")


def get_fallback_lab_setup(experiment_code: str) -> Optional[Dict[str, Any]]:
    """Return a generic composable or legacy fallback lab config."""
    normalized = experiment_code.strip().upper().replace(" ", "")
    if not normalized:
        return None

    if "-" not in normalized and len(normalized) > 1:
        normalized = normalized.replace(normalized[0], f"{normalized[0]}-", 1)

    prefix = normalized.split("-")[0]
    categories = {
        "A": "mechanics",
        "B": "measurement",
        "C": "heat",
        "D": "waves",
        "E": "optics",
        "F": "electricity",
        "N": "nuclear",
        "S": "renewable",
    }
    category = categories.get(prefix)

    if category:
        return {
            "experimentCode": normalized,
            "experimentTitle": f"Composable {normalized} Experiment",
            "kitId": "ComposableKit",
            "tier": "composable",
            "controls": [
                {"id": "independent", "label": "Primary Variable", "min": 1, "max": 10, "value": 4, "step": 0.5, "unit": "u"},
                {"id": "sensitivity", "label": "Sensitivity", "min": 1, "max": 5, "value": 2, "step": 0.5, "unit": "x"},
            ],
            "instruments": [],
            "tables": [
                {
                    "id": f"{normalized.lower()}_composable",
                    "title": "Composable Data",
                    "headers": ["Input", "Response"],
                    "rows": 6,
                }
            ],
            "procedure": [
                {"index": 0, "instruction": "Adjust the primary variable to the required starting value.", "expectedAction": "adjust"},
                {"index": 1, "instruction": "Observe the simulated response and record a measurement.", "expectedAction": "measure"},
                {"index": 2, "instruction": "Repeat for several values to establish the trend.", "expectedAction": "record"},
            ],
        }

    return {
        "experimentCode": normalized,
        "experimentTitle": f"Legacy {normalized} Experiment",
        "kitId": "LegacySimAdapter",
        "tier": "legacy",
        "controls": [
            {"id": "speed", "label": "Simulation Speed", "min": 0.5, "max": 4, "value": 1, "step": 0.5, "unit": "x"},
            {"id": "intensity", "label": "Response Level", "min": 1, "max": 10, "value": 5, "step": 1, "unit": "u"},
        ],
        "instruments": [],
        "tables": [
            {
                "id": f"{normalized.lower()}_legacy",
                "title": "Legacy Fallback Data",
                "headers": ["Trial", "Value"],
                "rows": 5,
            }
        ],
        "procedure": [
            {"index": 0, "instruction": "Adjust the virtual controls to match the experiment.", "expectedAction": "adjust"},
            {"index": 1, "instruction": "Observe the fallback preview and capture representative values.", "expectedAction": "observe"},
            {"index": 2, "instruction": "Record the values in the table or report.", "expectedAction": "record"},
        ],
        "legacySimulationScript": "",
    }


def format_engine_tables_for_prompt(engine_data: Dict[str, Any]) -> str:
    """Format engine data tables as text to inject into AI prompts.

    This gives the AI the real physics data to reference when writing
    the analysis/discussion sections, so it discusses actual values
    instead of making up numbers.

    Args:
        engine_data: Dict from get_engine_data().

    Returns:
        Formatted string for prompt injection.
    """
    lines: List[str] = []
    lines.append("## PHYSICS ENGINE DATA (Use these exact values in your report)")
    lines.append(f"Experiment: {engine_data.get('name', 'Unknown')}")
    lines.append(f"Category: {engine_data.get('category', 'Unknown')}")
    lines.append("")

    for table in engine_data.get("tables", []):
        lines.append(f"### {table.get('title', 'Data Table')}")
        headers = table.get("headers", [])
        rows = table.get("rows", [])

        # Format as a text table
        lines.append(" | ".join(headers))
        lines.append(" | ".join(["---"] * len(headers)))
        for row in rows:
            lines.append(" | ".join(str(v) for v in row))
        lines.append("")

    if engine_data.get("procedure"):
        lines.append("### Procedure Steps")
        for i, step in enumerate(engine_data["procedure"], 1):
            lines.append(f"  {i}. {step}")
        lines.append("")

    return "\n".join(lines)
