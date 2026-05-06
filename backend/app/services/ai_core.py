"""Galvaniy Labs Backend — AI Core Service (Smartify-style Rotational Keys).

Implements the same multi-key rotation + model fallback + custom URL pattern
used in the Smartify project, adapted for the Python backend using google-genai.

Priority flow (configurable via AI_PRIORITY env var):
  gemini (default): Try all Gemini keys → fall back to Custom API
  custom:           Try Custom API first → fall back to Gemini keys
"""

import asyncio
import logging
from typing import Optional, List

import httpx
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

# Model priority list (same order as Smartify)
CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


async def _generate_with_key(
    api_key: str,
    prompt: str,
    key_index: int,
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
    max_output_tokens: int = 8192,
) -> str:
    """Try all candidate models with a single API key.
    
    If a key is invalid, raises immediately.
    If all models fail for other reasons, raises after exhausting all models.
    """
    client = genai.Client(api_key=api_key)

    for model_name in CANDIDATE_MODELS:
        try:
            logger.info(f"[AI Core] Trying Key #{key_index + 1} with Model: {model_name}")
            
            config_kwargs = {"max_output_tokens": max_output_tokens}
            if system_instruction:
                config_kwargs["system_instruction"] = system_instruction
            if response_mime_type:
                config_kwargs["response_mime_type"] = response_mime_type
            
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(**config_kwargs),
            )

            text = response.text
            if text:
                logger.info(f"[AI Core] ✅ Success! Key #{key_index + 1} ({model_name})")
                return text

        except Exception as e:
            error_msg = str(e).lower()
            # If the key itself is invalid, don't try more models with it
            if "api key not valid" in error_msg or "permission denied" in error_msg:
                logger.warning(f"[AI Core] Key #{key_index + 1} is invalid, skipping all models")
                raise ValueError(f"Invalid Key #{key_index + 1}")
            # Other errors (overloaded, quota, etc.) → try next model
            logger.warning(f"[AI Core] {model_name} failed with Key #{key_index + 1}: {e}")

    raise RuntimeError(f"All models failed for Key #{key_index + 1}")


async def _call_gemini_rotational(
    prompt: str,
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
    max_output_tokens: int = 8192,
) -> str:
    """Try all API keys in rotation. Each key tries all candidate models."""
    settings = get_settings()
    keys = settings.all_api_keys

    if not keys:
        raise RuntimeError("No Gemini API keys configured.")

    logger.info(f"[AI Core] Starting Gemini rotation with {len(keys)} key(s)")

    for i, key in enumerate(keys):
        try:
            return await _generate_with_key(
                api_key=key,
                prompt=prompt,
                key_index=i,
                system_instruction=system_instruction,
                response_mime_type=response_mime_type,
                max_output_tokens=max_output_tokens,
            )
        except ValueError:
            # Invalid key — skip to next
            continue
        except RuntimeError:
            # All models failed for this key — try next key
            continue

    raise RuntimeError(f"All {len(keys)} API keys exhausted.")


async def _call_custom_api(
    prompt: str,
    system_instruction: Optional[str] = None,
) -> str:
    """Fall back to the Custom API (same pattern as Smartify's callCustomFallback)."""
    settings = get_settings()
    custom_url = settings.custom_api_url

    if not custom_url:
        raise RuntimeError("Custom API URL not configured.")

    effective_url = custom_url.rstrip("/")
    logger.info(f"[AI Core] ⚠️ Attempting fallback to Custom API ({effective_url})...")

    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

    payload = {
        "prompt": full_prompt,
        "files": [],
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{effective_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        text = data.get("response", "")
        if not text:
            raise ValueError("Empty response from Custom API")

        logger.info("[AI Core] ✅ Success with Custom API!")
        return text

    except Exception as e:
        logger.error(f"[AI Core] Custom API fallback failed: {e}")
        raise RuntimeError(f"Custom API error: {e}")


async def generate_with_fallback(
    prompt: str,
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
    max_output_tokens: int = 8192,
) -> str:
    """Unified generator: tries Gemini keys (rotational) then Custom API, or vice-versa.
    
    Mirrors Smartify's generateWithFallback() exactly:
    - AI_PRIORITY=gemini → Gemini first, Custom fallback
    - AI_PRIORITY=custom → Custom first, Gemini fallback
    """
    settings = get_settings()
    priority = settings.ai_priority.lower().strip()
    use_custom_first = priority == "custom"

    logger.info(f"[AI Core] Starting generation. Priority: {priority.upper()}")

    if use_custom_first:
        try:
            return await _call_custom_api(prompt, system_instruction)
        except Exception as custom_err:
            logger.warning(f"[AI Core] Custom API failed (priority), failing over to Gemini... ({custom_err})")
            return await _call_gemini_rotational(
                prompt, system_instruction, response_mime_type, max_output_tokens
            )
    else:
        try:
            return await _call_gemini_rotational(
                prompt, system_instruction, response_mime_type, max_output_tokens
            )
        except Exception as sdk_err:
            logger.warning(f"[AI Core] Gemini failed (priority), failing over to Custom API... ({sdk_err})")
            return await _call_custom_api(prompt, system_instruction)


async def chat_with_fallback(
    message: str,
    chat_history: list[dict],
    system_instruction: str,
) -> str:
    """Chat-style generation with rotational keys + custom fallback.
    
    Builds the chat context into a single prompt for maximum compatibility.
    """
    # Build conversation context as a single prompt
    context_parts = []
    for msg in chat_history:
        role_label = "Student" if msg["role"] == "user" else "Dr. Vance"
        context_parts.append(f"{role_label}: {msg['content']}")
    
    context_parts.append(f"Student: {message}")
    context_parts.append("Dr. Vance:")

    full_prompt = "\n".join(context_parts)

    return await generate_with_fallback(
        prompt=full_prompt,
        system_instruction=system_instruction,
    )
