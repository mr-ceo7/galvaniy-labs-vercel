"""Tests for Stage 4: Prompt Templates, Report Validator, and Gemini Service."""

import os
import sys
import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestPromptTemplates:
    """Test prompt template functions."""

    def test_get_system_role(self):
        from app.services.prompt_templates import get_system_role
        result = get_system_role("A-2")
        assert "A-2" in result
        assert "expert Laboratory Assistant" in result
        assert "COMPLETED" in result

    def test_get_text_content_instructions(self):
        from app.services.prompt_templates import get_text_content_instructions
        result = get_text_content_instructions("B-6")
        assert "B-6" in result
        assert "PAST TENSE" in result
        assert "Title" in result
        assert "Objectives" in result

    def test_get_data_logic_instructions(self):
        from app.services.prompt_templates import get_data_logic_instructions
        result = get_data_logic_instructions("C-1")
        assert "C-1" in result
        assert "Tables" in result
        assert "calculationScriptLines" in result

    def test_get_simulation_instructions(self):
        from app.services.prompt_templates import get_simulation_instructions
        result = get_simulation_instructions("D-3")
        assert "D-3" in result
        assert "Canvas" in result
        assert "simulationScriptLines" in result

    def test_json_examples_exist(self):
        from app.services.prompt_templates import JSON_EXAMPLES
        assert "text_content" in JSON_EXAMPLES
        assert "data_logic" in JSON_EXAMPLES
        assert "simulation" in JSON_EXAMPLES

    def test_json_examples_are_valid_json(self):
        from app.services.prompt_templates import JSON_EXAMPLES
        for key, example in JSON_EXAMPLES.items():
            parsed = json.loads(example)
            assert isinstance(parsed, dict), f"{key} example should be a dict"

    def test_build_section_prompt(self):
        from app.services.prompt_templates import build_section_prompt
        result = build_section_prompt("A-2", "Text Content", "instructions here", "{}", "PDF Manual")
        assert "A-2" in result
        assert "Text Content" in result
        assert "instructions here" in result
        assert "STRICT JSON FORMAT" in result


class TestReportValidator:
    """Test report validation logic."""

    def test_valid_report(self):
        from app.services.report_validator import validate_report
        report = {
            "title": "Test Experiment",
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
            "tables": [{"headers": ["A", "B"], "rows": [["1", "2"]]}],
            "simulationScript": "ctx.fillRect(0,0,10,10);",
        }
        result = validate_report(report, "A-1")
        assert result.valid is True
        assert len(result.errors) == 0

    def test_missing_title(self):
        from app.services.report_validator import validate_report
        report = {
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
            "tables": [{"headers": ["A"], "rows": [["1"]]}],
        }
        result = validate_report(report, "A-1")
        assert result.valid is False
        assert any("title" in e.lower() for e in result.errors)

    def test_missing_tables(self):
        from app.services.report_validator import validate_report
        report = {
            "title": "Test",
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
        }
        result = validate_report(report, "A-1")
        assert result.valid is False
        assert any("tables" in e.lower() for e in result.errors)

    def test_empty_tables_array(self):
        from app.services.report_validator import validate_report
        report = {
            "title": "Test",
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
            "tables": [],
        }
        result = validate_report(report, "A-1")
        assert result.valid is False

    def test_table_header_mismatch_warning(self):
        from app.services.report_validator import validate_report
        report = {
            "title": "Test",
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
            "tables": [{"headers": ["A", "B", "C"], "rows": [["1", "2"]]}],
            "simulationScript": "x",
        }
        result = validate_report(report, "A-1")
        assert result.valid is True
        assert len(result.warnings) > 0
        assert "columns" in result.warnings[0].lower()

    def test_missing_simulation_warning(self):
        from app.services.report_validator import validate_report
        report = {
            "title": "Test",
            "objectives": ["To test"],
            "apparatus": ["Ruler"],
            "procedure": ["Step 1"],
            "tables": [{"headers": ["A"], "rows": [["1"]]}],
        }
        result = validate_report(report, "A-1")
        assert result.valid is True
        assert any("simulation" in w.lower() for w in result.warnings)

    def test_multiple_errors(self):
        from app.services.report_validator import validate_report
        report = {}
        result = validate_report(report, "A-1")
        assert result.valid is False
        assert len(result.errors) >= 4  # title, objectives, apparatus, procedure, tables


class TestGeminiServiceHelpers:
    """Test Gemini service helper functions."""

    def test_clean_json_response_plain(self):
        from app.services.gemini_service import _clean_json_response
        text = '{"title": "Test"}'
        result = _clean_json_response(text)
        assert json.loads(result)["title"] == "Test"

    def test_clean_json_response_with_markdown(self):
        from app.services.gemini_service import _clean_json_response
        text = '```json\n{"title": "Test"}\n```'
        result = _clean_json_response(text)
        assert json.loads(result)["title"] == "Test"

    def test_clean_json_response_with_prefix(self):
        from app.services.gemini_service import _clean_json_response
        text = 'Here is the result:\n{"title": "Test"}\nDone!'
        result = _clean_json_response(text)
        assert json.loads(result)["title"] == "Test"

    def test_clean_json_response_with_control_chars(self):
        from app.services.gemini_service import _clean_json_response
        text = '{"title": "Test\x00Value"}'
        result = _clean_json_response(text)
        parsed = json.loads(result)
        assert "Test" in parsed["title"]


class TestGeminiServiceGeneration:
    """Test Gemini service report generation with mocked API."""

    @pytest.mark.asyncio
    async def test_generate_section_success(self):
        """Should successfully generate a section on first attempt."""
        from app.services.gemini_service import _generate_section

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '{"title": "Test Experiment", "objectives": ["To test"]}'
        mock_client.models.generate_content.return_value = mock_response

        result = await _generate_section(
            mock_client, "manual text", "A-2",
            "Text Content", '{"title": ""}',
            "Generate text content",
        )

        assert result["title"] == "Test Experiment"
        assert mock_client.models.generate_content.call_count == 1

    @pytest.mark.asyncio
    async def test_generate_section_retry_on_parse_error(self):
        """Should retry when JSON parse fails."""
        from app.services.gemini_service import _generate_section

        mock_client = MagicMock()
        bad_response = MagicMock()
        bad_response.text = "not valid json at all"
        good_response = MagicMock()
        good_response.text = '{"title": "Success"}'

        mock_client.models.generate_content.side_effect = [bad_response, good_response]

        result = await _generate_section(
            mock_client, "manual", "A-2",
            "Text Content", '{}', "instructions",
        )

        assert result["title"] == "Success"
        assert mock_client.models.generate_content.call_count == 2

    @pytest.mark.asyncio
    async def test_generate_section_max_retries_exceeded(self):
        """Should raise after MAX_ATTEMPTS failures."""
        from app.services.gemini_service import _generate_section

        mock_client = MagicMock()
        bad_response = MagicMock()
        bad_response.text = "garbage"
        mock_client.models.generate_content.return_value = bad_response

        with pytest.raises(ValueError, match="Failed to parse"):
            await _generate_section(
                mock_client, "manual", "A-2",
                "Section", '{}', "instructions",
            )

        assert mock_client.models.generate_content.call_count == 3

    @pytest.mark.asyncio
    async def test_generate_lab_report_parallel(self):
        """Should merge all three sections and post-process scripts."""
        from app.services.gemini_service import generate_lab_report

        mock_client = MagicMock()

        # Each call returns different section data
        responses = [
            MagicMock(text=json.dumps({
                "title": "Exp A-2",
                "objectives": ["To test"],
                "apparatus": ["Item"],
                "procedure": ["Step"],
            })),
            MagicMock(text=json.dumps({
                "tables": [{"headers": ["A"], "rows": [["1"]]}],
                "calculationScriptLines": ["const x = 1;", "return {x};"],
                "analysisTemplate": "Result: {{x}}",
            })),
            MagicMock(text=json.dumps({
                "simulationScriptLines": ["ctx.fillRect(0,0,10,10);"],
                "controls": [{"id": "mass", "label": "Mass", "min": 0, "max": 10, "val": 5, "unit": "kg"}],
            })),
        ]

        mock_client.models.generate_content.side_effect = responses

        result_json = await generate_lab_report(mock_client, "manual text", "A-2", parallel=True)
        result = json.loads(result_json)

        assert result["title"] == "Exp A-2"
        assert "calculationScript" in result
        assert "calculationScriptLines" not in result
        assert "simulationScript" in result
        assert "simulationScriptLines" not in result
        assert result["calculationScript"] == "const x = 1;\nreturn {x};"
