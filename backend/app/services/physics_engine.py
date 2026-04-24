"""Galvaniy Labs Backend — Physics Engine Bridge.

Calls the TypeScript physics engine CLI to get deterministic
experimental data for built-in experiment kits.

When a kit is available, the engine provides:
- Pre-computed data tables with realistic noise
- Experiment controls and procedure steps

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


async def get_engine_data(experiment_code: str) -> Optional[Dict[str, Any]]:
    """Run the physics engine CLI and return deterministic experiment data.

    Args:
        experiment_code: The experiment code (e.g., "A-2", "F-18").

    Returns:
        Dict with engine data if a built-in kit exists, None otherwise.
    """
    cli_path = os.path.join(_PROJECT_ROOT, "engine", "cli.ts")

    if not os.path.exists(cli_path):
        logger.warning(f"[PhysicsEngine] CLI not found at {cli_path}")
        return None

    try:
        proc = await asyncio.create_subprocess_exec(
            "npx", "tsx", cli_path, experiment_code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=_PROJECT_ROOT,
        )

        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)

        if proc.returncode != 0:
            logger.warning(
                f"[PhysicsEngine] CLI failed for {experiment_code}: "
                f"exit={proc.returncode}, stderr={stderr.decode()[:200]}"
            )
            return None

        data = json.loads(stdout.decode())

        if not data.get("available"):
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

    except asyncio.TimeoutError:
        logger.error(f"[PhysicsEngine] CLI timed out for {experiment_code}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"[PhysicsEngine] Invalid JSON from CLI: {e}")
        return None
    except FileNotFoundError:
        logger.warning("[PhysicsEngine] npx/tsx not found — is Node.js installed?")
        return None
    except Exception as e:
        logger.error(f"[PhysicsEngine] Unexpected error: {e}")
        return None


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
