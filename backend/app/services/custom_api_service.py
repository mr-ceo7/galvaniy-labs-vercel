"""Galvaniy Labs Backend — Custom API Service.

Routes generation requests to an external API endpoint instead of the internal Gemini client.
"""

import asyncio
import json
import re
import logging
import httpx
from typing import Any, Dict

from app.services.prompt_templates import (
    build_section_prompt,
    get_text_content_instructions,
    get_data_logic_instructions,
    get_simulation_instructions,
    JSON_EXAMPLES,
)
from app.services.report_validator import validate_report

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _clean_json_response(text: str) -> str:
    """Clean AI response text to extract valid JSON."""
    text = text.replace("```json", "").replace("```", "")

    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace != -1 and last_brace != -1:
        text = text[first_brace : last_brace + 1]

    text = re.sub(r"[\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)

    return text


async def _upload_manual(api_url: str, manual_text: str) -> str:
    """Uploads the manual text to the custom API and returns the filename/reference."""
    url = f"{api_url.rstrip('/')}/api/upload"
    
    # Create a dummy text file from the manual content
    files = {
        'file': ('manual.txt', manual_text.encode('utf-8'), 'text/plain')
    }
    data = {
        'context_mode': 'false'
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, data=data, files=files)
        response.raise_for_status()
        result = response.json()
        
        return result.get('extracted_txt', result.get('filename'))


async def _generate_section(
    api_url: str,
    uploaded_filename: str,
    experiment_code: str,
    section_name: str,
    json_example: str,
    instructions: str,
) -> Dict[str, Any]:
    """Generate a single report section via Custom API."""
    prompt = build_section_prompt(
        experiment_code, section_name, instructions, json_example, "uploaded manual"
    )

    url = f"{api_url.rstrip('/')}/api/generate"
    payload = {
        "prompt": prompt,
        "files": [uploaded_filename],
        "stream": False
    }

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()

            # Sometimes the custom API wraps in 'response', sometimes it's direct
            text = result.get('response', result)
            if not isinstance(text, str):
                text = json.dumps(text)

            if not text:
                raise ValueError("Empty response from API")

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
                        f"Failed to parse {section_name} JSON. The Custom API generated invalid format."
                    )

        except Exception as e:
            logger.error(f"[{section_name}] Custom API Generation Failed (Attempt {attempt}): {e}")
            if attempt == MAX_ATTEMPTS:
                raise
            await asyncio.sleep(attempt * 1.0)

    raise ValueError(f"Failed to generate {section_name} after {MAX_ATTEMPTS} attempts")


async def generate_lab_report(
    api_url: str,
    manual_text: str,
    experiment_code: str,
    parallel: bool = True,
) -> str:
    """Generate a complete lab report using the Custom API."""
    logger.info(f"[Custom API] Starting {'parallel' if parallel else 'sequential'} generation for {experiment_code}")

    if not api_url:
        raise ValueError("Custom API URL is not configured in Admin settings.")

    # 1. Upload manual to custom API
    logger.info("[Custom API] Uploading manual...")
    uploaded_filename = await _upload_manual(api_url, manual_text)
    logger.info(f"[Custom API] Manual uploaded as: {uploaded_filename}")

    # 2. Define section generation tasks
    text_coro = _generate_section(
        api_url, uploaded_filename, experiment_code,
        "Text Content", JSON_EXAMPLES["text_content"],
        get_text_content_instructions(experiment_code),
    )

    data_coro = _generate_section(
        api_url, uploaded_filename, experiment_code,
        "Data & Logic", JSON_EXAMPLES["data_logic"],
        get_data_logic_instructions(experiment_code),
    )

    sim_coro = _generate_section(
        api_url, uploaded_filename, experiment_code,
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

    # 3. Post-processing: Convert script line arrays to joined strings
    if isinstance(data_json.get("calculationScriptLines"), list):
        data_json["calculationScript"] = "\n".join(data_json.pop("calculationScriptLines"))

    if isinstance(sim_json.get("simulationScriptLines"), list):
        sim_json["simulationScript"] = "\n".join(sim_json.pop("simulationScriptLines"))

    # 4. Merge all sections
    full_report = {**text_json, **data_json, **sim_json}

    # 5. Validate
    validation = validate_report(full_report, experiment_code)
    if not validation.valid:
        if validation.warnings:
            logger.warning(f"Report Validation Warnings: {validation.warnings}")
        if validation.errors:
            raise ValueError(f"Generated report invalid: {', '.join(validation.errors)}")

    if validation.warnings:
        logger.warning(f"Report Validation Warnings: {validation.warnings}")

    return json.dumps(full_report)
