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
    get_lab_config_instructions,
    JSON_EXAMPLES,
)
from app.services.lab_config_service import normalize_lab_config
from app.services.report_validator import validate_report
from app.services.physics_engine import get_engine_data, format_engine_tables_for_prompt

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _clean_json_response(text: str) -> str:
    """Clean AI response text to extract valid JSON."""
    # Find JSON boundaries
    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    # Remove control characters
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)

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
            response = await client.aio.models.generate_content(
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

    lab_config_coro = None if engine_data else _generate_section(
        client, enriched_manual, experiment_code,
        "Lab Config", JSON_EXAMPLES["lab_config"],
        get_lab_config_instructions(experiment_code),
    )

    if parallel:
        if lab_config_coro:
            text_json, data_json, sim_json, lab_config_json = await asyncio.gather(
                text_coro, data_coro, sim_coro, lab_config_coro
            )
        else:
            text_json, data_json, sim_json = await asyncio.gather(
                text_coro, data_coro, sim_coro
            )
            lab_config_json = None
    else:
        text_json = await text_coro
        data_json = await data_coro
        sim_json = await sim_coro
        lab_config_json = await lab_config_coro if lab_config_coro else None

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
        # Engine-powered reports should not execute AI-provided canvas code in the preview.
        full_report["simulationScript"] = ""
        # Tag the report as engine-powered
        full_report["enginePowered"] = True
        full_report["engineKit"] = engine_data.get("name", experiment_code)
        full_report["engineCategory"] = engine_data.get("category", "unknown")
        full_report["labConfig"] = engine_data.get("labConfig")
        logger.info(f"[Gemini] ✅ Report enhanced with physics engine data")
    elif lab_config_json:
        full_report["labConfig"] = normalize_lab_config(lab_config_json, experiment_code)

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


async def generate_lab_config(
    client: genai.Client,
    manual_text: str,
    experiment_code: str,
) -> Dict[str, Any]:
    """Generate a structured LabConfig object from the manual."""
    raw = await _generate_section(
        client,
        manual_text,
        experiment_code,
        "Lab Config",
        JSON_EXAMPLES["lab_config"],
        get_lab_config_instructions(experiment_code),
    )
    return normalize_lab_config(raw, experiment_code)

async def chat_with_assistant(
    client: genai.Client,
    experiment_code: str,
    message: str,
    chat_history: list[dict],
    lab_state: dict | None = None,
) -> dict:
    """Chat with the AI lab assistant. Returns structured JSON with reply + actions."""
    from app.services.ai_core import generate_with_fallback

    state_desc = ""
    if lab_state:
        placed = lab_state.get("placedComponents", [])
        controls = lab_state.get("controlValues", {})
        data_count = lab_state.get("dataCount", 0)
        is_running = lab_state.get("isRunning", False)
        state_desc = f"""
CURRENT LAB STATE:
- Placed on bench: {', '.join(placed) if placed else 'Nothing yet'}
- Control values: {controls}
- Data points collected: {data_count}
- Simulation running: {is_running}
"""

    system_instruction = f"""You are Dr. E. Vance, a highly intelligent virtual lab instructor at Galvaniy Labs.
You are guiding a student through the physics experiment {experiment_code} (Simple Pendulum).

{state_desc}

AVAILABLE APPARATUS IDs: retort_stand, meter_ruler, stopwatch, bob, string
AVAILABLE CONTROL IDs: length (0.2-1.2 m), amplitude (2-15 degrees), numOscillations (5-20)

You MUST respond with VALID JSON only. No markdown, no code fences, no extra text.
Your response must be a JSON object with these fields:

{{
  "reply": "Your conversational message to the student (string)",
  "actions": [
    // Array of action objects. Can be empty []. Available types:
    // {{"type": "highlight_tray", "target": "<apparatus_id>"}} - Pulse-glow an item in the equipment tray
    // {{"type": "highlight_canvas", "target": "<apparatus_id>"}} - Glow an item on the canvas
    // {{"type": "set_control", "target": "<control_id>", "value": <number>}} - Adjust a slider
    // {{"type": "place_apparatus", "target": "<apparatus_id>"}} - Auto-place an apparatus on the bench
    // {{"type": "start_simulation"}} - Press Play
    // {{"type": "stop_simulation"}} - Press Pause
    // {{"type": "record_data"}} - Record current measurement
    // {{"type": "open_drawer", "target": "data|graph|procedure|sessions"}} - Open a drawer tab
  ],
  "awaitAction": true/false  // true = show "Next Step" button, wait for user before continuing
}}

RULES:
1. Focus ONLY on {experiment_code}. Politely redirect off-topic questions.
2. Be concise, encouraging, and clear. Students are high school / early college level.
3. When the student says "guide me" or "help me set up", walk them through step-by-step, one action at a time with awaitAction=true.
4. When the student says "show me" or "demonstrate", perform the actions yourself using place_apparatus, set_control, start_simulation, record_data etc. with awaitAction=false for automated steps.
5. Use highlights to draw attention to the relevant apparatus.
6. If the student seems stuck, look at the lab state and suggest the next logical step.
7. For "show me" mode, demonstrate the FULL experiment: place all apparatus, set length to 0.30m, start simulation, record data, then repeat for 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00m.
8. When demonstrating, emit actions in batches that make sense together (e.g. set_control + start_simulation + record_data for each length).
9. ALWAYS return valid JSON. Never wrap in markdown code blocks.
"""

    # Build conversation context
    context_parts = []
    for msg in chat_history:
        role_label = "Student" if msg["role"] == "user" else "Dr. Vance"
        context_parts.append(f"{role_label}: {msg['content']}")
    context_parts.append(f"Student: {message}")
    context_parts.append("Dr. Vance (respond with JSON only):")
    full_prompt = "\n".join(context_parts)

    try:
        raw_text = await generate_with_fallback(
            prompt=full_prompt,
            system_instruction=system_instruction,
            response_mime_type="application/json",
        )

        # Parse JSON response
        import json
        # Strip markdown code fences if the AI adds them anyway
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        parsed = json.loads(cleaned)

        # Validate structure
        result = {
            "reply": parsed.get("reply", "I'm not sure how to help with that."),
            "actions": parsed.get("actions", []),
            "awaitAction": parsed.get("awaitAction", False),
        }

        return result

    except json.JSONDecodeError as e:
        logger.warning(f"[Assistant] Failed to parse AI JSON: {e}. Raw: {raw_text[:200]}")
        return {
            "reply": raw_text if raw_text else "Sorry, I had trouble forming a response.",
            "actions": [],
            "awaitAction": False,
        }
    except Exception as e:
        logger.error(f"[Assistant] All providers failed: {e}")
        raise ValueError("Dr. Vance is temporarily unavailable. Please try again in a moment.")



