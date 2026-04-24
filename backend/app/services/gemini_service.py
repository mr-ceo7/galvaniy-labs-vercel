"""Galvaniy Labs Backend — Gemini AI Service.

Ported from services/geminiService.ts.
Generates lab reports using Google Gemini API with parallel section generation.
"""

import asyncio
import json
import re
import logging
from typing import Any, Dict, Optional

from google import genai
from google.genai import types

from app.services.prompt_templates import (
    build_section_prompt,
    get_text_content_instructions,
    get_data_logic_instructions,
    get_simulation_instructions,
    JSON_EXAMPLES,
)
from app.services.report_validator import validate_report
from app.services.physics_engine import get_engine_data, format_engine_tables_for_prompt

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _clean_json_response(text: str) -> str:
    """Clean AI response text to extract valid JSON."""
    # Remove markdown code fences
    text = text.replace("```json", "").replace("```", "")

    # Find JSON boundaries
    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace != -1 and last_brace != -1:
        text = text[first_brace : last_brace + 1]

    # Remove control characters
    text = re.sub(r"[\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)

    return text


async def _generate_section(
    client: genai.Client,
    manual_context: str,
    experiment_code: str,
    section_name: str,
    json_example: str,
    instructions: str,
) -> Dict[str, Any]:
    """Generate a single report section with retry logic.

    Args:
        client: Gemini client instance.
        manual_context: The lab manual text content.
        experiment_code: The experiment identifier.
        section_name: Name of the section being generated.
        json_example: Example JSON structure for the section.
        instructions: Detailed instructions for generation.

    Returns:
        Parsed JSON dictionary of the generated section.

    Raises:
        Exception: If generation fails after MAX_ATTEMPTS.
    """
    prompt = build_section_prompt(
        experiment_code, section_name, instructions, json_example, "PDF Manual"
    )

    full_prompt = f"Lab Manual Content:\n\n{manual_context}\n\n---\n\n{prompt}"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    max_output_tokens=8192,
                ),
            )

            text = response.text
            if not text:
                raise ValueError("Empty response from AI")

            text = _clean_json_response(text)

            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict) and parsed.get("error"):
                    raise ValueError(parsed["error"])
                return parsed
            except json.JSONDecodeError:
                logger.warning(
                    f"[{section_name}] JSON Parse Error (Attempt {attempt}): "
                    f"{text[:100]}...{text[-100:]}"
                )
                if attempt == MAX_ATTEMPTS:
                    raise ValueError(
                        f"Failed to parse {section_name} JSON. The AI generated invalid format."
                    )

        except Exception as e:
            logger.error(f"[{section_name}] Generation Failed (Attempt {attempt}): {e}")
            if attempt == MAX_ATTEMPTS:
                raise

    # Should not reach here but satisfy type checker
    raise ValueError(f"Failed to generate {section_name} after {MAX_ATTEMPTS} attempts")


async def generate_lab_report(
    client: genai.Client,
    manual_text: str,
    experiment_code: str,
    parallel: bool = True,
) -> str:
    """Generate a complete lab report using Gemini AI.

    Generates three sections (text content, data & logic, simulation)
    either in parallel or sequentially, then merges and validates them.

    Args:
        client: Gemini client instance.
        manual_text: Combined text from all manual pages.
        experiment_code: The experiment code (e.g., "A-2").
        parallel: Whether to generate sections in parallel.

    Returns:
        JSON string of the complete validated report.

    Raises:
        ValueError: If the report fails validation with errors.
    """
    logger.info(f"[Gemini] Starting {'parallel' if parallel else 'sequential'} generation for {experiment_code}")

    # ── Physics Engine Integration ──────────────────────────────
    # Try to get deterministic data from the physics engine first.
    # If a built-in kit exists, we inject real physics data into the
    # AI prompt so it writes analysis based on actual measurements.
    engine_data = await get_engine_data(experiment_code)
    engine_context = ""
    if engine_data:
        engine_context = (
            "\n\n--- PHYSICS ENGINE DATA (MANDATORY) ---\n"
            + format_engine_tables_for_prompt(engine_data)
            + "\n--- END PHYSICS ENGINE DATA ---\n"
            "\nIMPORTANT: The data tables above were generated by a precision "
            "physics simulation engine. You MUST use these EXACT values in your "
            "tables and reference them in your analysis and discussion. Do NOT "
            "make up different numbers.\n"
        )
        logger.info(f"[Gemini] Injecting physics engine data for {experiment_code}")

    # Append engine context to manual text for all sections
    enriched_manual = manual_text + engine_context

    # Define section generation tasks
    text_coro = _generate_section(
        client, enriched_manual, experiment_code,
        "Text Content", JSON_EXAMPLES["text_content"],
        get_text_content_instructions(experiment_code),
    )

    data_coro = _generate_section(
        client, enriched_manual, experiment_code,
        "Data & Logic", JSON_EXAMPLES["data_logic"],
        get_data_logic_instructions(experiment_code),
    )

    sim_coro = _generate_section(
        client, enriched_manual, experiment_code,
        "Simulation", JSON_EXAMPLES["simulation"],
        get_simulation_instructions(experiment_code),
    )

    if parallel:
        text_json, data_json, sim_json = await asyncio.gather(
            text_coro, data_coro, sim_coro
        )
    else:
        text_json = await text_coro
        data_json = await data_coro
        sim_json = await sim_coro

    # Post-processing: Convert script line arrays to joined strings
    if isinstance(data_json.get("calculationScriptLines"), list):
        data_json["calculationScript"] = "\n".join(data_json.pop("calculationScriptLines"))

    if isinstance(sim_json.get("simulationScriptLines"), list):
        sim_json["simulationScript"] = "\n".join(sim_json.pop("simulationScriptLines"))

    # Merge all sections
    full_report = {**text_json, **data_json, **sim_json}

    # ── Inject engine data into final report ──────────────────────
    if engine_data:
        # Replace AI-generated tables with deterministic engine tables
        full_report["tables"] = engine_data["tables"]
        # Replace AI controls with engine controls
        full_report["controls"] = engine_data.get("controls", full_report.get("controls", []))
        # Tag the report as engine-powered
        full_report["enginePowered"] = True
        full_report["engineKit"] = engine_data.get("name", experiment_code)
        full_report["engineCategory"] = engine_data.get("category", "unknown")
        logger.info(f"[Gemini] ✅ Report enhanced with physics engine data")

    # Validate
    validation = validate_report(full_report, experiment_code)
    if not validation.valid:
        if validation.warnings:
            logger.warning(f"Report Validation Warnings: {validation.warnings}")
        if validation.errors:
            raise ValueError(f"Generated report invalid: {', '.join(validation.errors)}")

    if validation.warnings:
        logger.warning(f"Report Validation Warnings: {validation.warnings}")

    return json.dumps(full_report)
