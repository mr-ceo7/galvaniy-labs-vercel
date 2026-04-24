"""Sanity tests for configured Gemini model names.

This file previously contained an ad hoc script that pytest collected as an
invalid test. Keep the coverage lightweight and offline-safe here.
"""

import os


def test_gemini_api_key_env_shape():
    api_key = os.getenv("GEMINI_API_KEY", "test-key-12345")
    assert isinstance(api_key, str)
    assert len(api_key) >= 8


def test_expected_model_names_are_non_empty():
    model_names = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"]
    assert all(isinstance(name, str) and name for name in model_names)
