"""Galvaniy Labs Backend — Prompt Templates.

Ported from services/promptTemplates.ts.
Shared prompt templates used by both Gemini and custom API providers.
"""


def get_system_role(experiment_code: str) -> str:
    """Main system role/persona for AI generation."""
    return (
        f'You are an expert Laboratory Assistant. Generate a comprehensive lab report '
        f'describing a COMPLETED experiment for "{experiment_code}". '
        f'Write in past tense as if the experiment has already been performed.'
    )


JSON_FORMAT_INSTRUCTIONS = """
### STRICT JSON FORMAT REQUIRED
Return ONLY valid JSON matching the provided schema/example structure.
Do not include markdown formatting like ```json.
Do not include any text before or after the JSON object.
"""


def get_text_content_instructions(experiment_code: str) -> str:
    """Instructions for generating the text content section."""
    return f"""
SEARCH the manual for experiment code "{experiment_code}".
Generate a lab report for a COMPLETED experiment. Use PAST TENSE throughout.

Generate the following sections in academic format:

1. **Title**: Full experiment title
2. **Date**: Use placeholder "[Date: DD/MM/YYYY]"
3. **Partners**: Use placeholder "[Partners: Student names]"
4. **Objectives**: Array of experiment aims (keep infinitive form: "To determine...", "To investigate...")
5. **Theory**: Comprehensive background explaining the physics/science principles
6. **Apparatus**: List of equipment used in the experiment
7. **Procedure**: Steps describing what WAS DONE in past tense (passive voice preferred)
   - Example: "The liquid was heated to 60°C" NOT "Heat the liquid to 60°C"
   - Example: "The temperature was recorded every minute" NOT "Record the temperature"
   - Example: "The apparatus was set up as shown in Figure X" NOT "Set up the apparatus"
8. **Precautions**: Safety measures and experimental precautions that were taken
   - Include relevant safety risks (burns, spillage, fragile equipment, electrical hazards, etc.)
   - Example: "Care was taken to avoid contact with hot surfaces"
9. **Discussion**: Interpretation of results, comparison with theoretical values, significance of findings
10. **Sources of Error**: Numbered list of error sources (separate from discussion)
    - Physical factors (draughts, air currents, evaporation, heat loss, friction, etc.)
    - Measurement errors (instrument lag, parallax errors, timing errors, calibration issues, etc.)
    - Human factors (reaction time, reading errors, etc.)
11. **Conclusion**: Past-tense summary of what was achieved and verified
    - Example: "The experiment successfully verified..." NOT "This experiment verifies..."
12. **References**: Array of reference sources (always include the lab manual)
13. **Questions**: If present in manual, include questions with answers

CRITICAL REQUIREMENTS:
- Write procedure in PAST TENSE as if experiment was already completed
- Use passive voice where appropriate: "was measured", "were recorded", "was observed"
- Conclusion should reflect on what WAS accomplished, not what WILL BE accomplished
- Follow any specific formatting guidelines mentioned in the uploaded manual
"""


def get_data_logic_instructions(experiment_code: str) -> str:
    """Instructions for generating the data & logic section."""
    return f"""
SEARCH the manual for experiment code "{experiment_code}".
Focus on DATA COLLECTION and ANALYSIS.

1. **Tables**: Generate tables for ALL measurements described in the procedure.
   - **Header Format**: ["Parameter", "Value", "Error", "Unit"] for single values.
   - **Series Data**: Use specific headers (e.g., ["Volts (V)", "Amps (A)"]).
   - **Content**: Fill with 5 rows of REALISTIC DUMMY DATA (with noise) that fits the theory.
   - **IMPORTANT**: All cell values in 'rows' must be STRINGS. Convert numbers to strings.
   
2. **Calculation Script (JavaScript)**:
   - **IMPORTANT**: Return this as "calculationScriptLines" (Array of Strings).
   - Each string is a line of code. Do not use a single string field.
   - Input: 'tables' array. 
   - Logic: Parse values using 'parseFloat' since they are strings, perform physics calculations.
   - Output: Return object matching placeholders in analysisTemplate.
   
3. **Analysis Template**:
   - Text summary with {{{{placeholder}}}} for calculated results.
   
4. **Graph Config** (Optional):
   - If a graph is standard for this experiment, provide config.
"""


def get_simulation_instructions(experiment_code: str) -> str:
    """Instructions for generating the simulation section."""
    return f"""
Create a HTML5 Canvas Visualization for experiment "{experiment_code}".

CRITICAL: The simulation MUST visually represent THIS SPECIFIC experiment's apparatus and setup.
DO NOT generate generic or unrelated physics simulations.

1. **Understand the Experiment First**:
   - Read the procedure and apparatus sections carefully
   - Identify what is being measured and how
   - Identify the physical setup (e.g., wire stretching, light rays, circuits, pendulum)

2. **Simulation Script**:
   - **IMPORTANT**: Return this as "simulationScriptLines" (Array of Strings).
   - Each string is a single line of code. DO NOT put newline characters inside strings.
   - DO NOT use template literals (backticks `) or string interpolation (${...}) as it breaks JSON parsing. Use string concatenation (+) instead.
   - JS function body: (ctx, width, height, frame, params) => void.
   - Visualize the ACTUAL apparatus setup for THIS experiment
   - Use 'params' object for interactive controls
   - Keep it simple and visual. NO COMMENTS. KEEP UNDER 30 LINES OF CODE.
   
   Examples of experiment-specific visualizations:
   - Wire/Spring experiments: Draw vertical wire, hanging mass, show extension
   - Optics: Draw light rays, lenses, mirrors, focal points
   - Electricity: Draw circuit components, current flow indicators
   - Pendulum: Draw string, bob, show oscillation
   - Magnetic field: Draw coils, compass, field lines

3. **Controls**:
   - Array of sliders to control THE ACTUAL EXPERIMENT VARIABLES
   - Controls MUST match what is measured in this specific experiment
   - BAD example for wire stretching: "Current (I)", "Voltage (V)"
   - GOOD example for wire stretching: "Load (kg)", "Wire Length (m)", "Wire Diameter (mm)"
   
   Control requirements:
   - id: descriptive parameter name (e.g., "load", "length", "angle")
   - label: clear description matching experiment (e.g., "Applied Load")
   - min/max/val: realistic ranges for this experiment
   - unit: correct SI units matching the measurement

VALIDATION CHECKLIST:
✓ Does the visualization show the apparatus described in the procedure?
✓ Do the controls match the variables measured in the experiment?
✓ Are the physics equations specific to THIS experiment type?
✓ Would a student recognize this as the correct experiment setup?
"""


def get_lab_config_instructions(experiment_code: str) -> str:
    """Instructions for generating a structured LabConfig section."""
    return f"""
SEARCH the manual for experiment code "{experiment_code}".
Generate a structured LabConfig JSON object for the experiment.

Requirements:
1. Prefer a built-in kit when the apparatus clearly matches a known first-year physics setup.
2. If the experiment is physics-based but not built-in, output a composable configuration with:
   - kitId
   - tier
   - controls
   - instruments
   - tables
   - procedure
3. If the experiment is outside the physics engine scope, output a legacy configuration with:
   - tier: "legacy"
   - legacySimulationScript omitted or empty
   - simple controls/tables/procedure so the UI can still render
4. Keep all values realistic for the experiment.
"""


# JSON examples for each section
JSON_EXAMPLES = {
    "text_content": """{
  "title": "Experiment Title",
  "date": "[Date: DD/MM/YYYY]",
  "partners": "[Partners: Student Names]",
  "objectives": ["To investigate...", "To determine..."],
  "apparatus": ["Item 1", "Item 2"],
  "theory": "Theory text explaining the scientific principles...",
  "procedure": ["The apparatus was set up as shown in Figure 1.", "The measurement was taken using...", "The data was recorded in Table 1."],
  "precautions": ["Care was taken to avoid burns from hot surfaces", "The setup was ensured to be stable to prevent spillage"],
  "discussion": "The results indicate that... The deviation from theoretical values can be attributed to...",
  "sourcesOfError": ["Draughts and air currents affecting heat transfer", "Thermometer lag causing measurement delay", "Evaporation of the liquid"],
  "conclusion": "The experiment successfully verified... The objective was achieved...",
  "references": ["Lab Manual 2025 Edition", "University Physics by Young & Freedman"],
  "questions": [{"question": "Q1?", "answer": "A1"}]
}""",
    "data_logic": """{
  "tables": [{ "title": "Table 1", "headers": ["Col 1", "Col 2"], "rows": [["1", "2"], ["3", "4"]] }],
  "calculationScriptLines": [
      "const r = tables[0].rows[0];",
      "return { res: parseFloat(r[1]) * 2 };"
  ],
  "analysisTemplate": "Result: {{res}} units",
  "graphConfig": { "tableIndex": 0, "xColumnIndex": 0, "yColumnIndex": 1, "title": "A vs B" }
}""",
    "simulation": """{
  "simulationScriptLines": [
      "ctx.fillStyle='red';",
      "ctx.fillRect(10,10,50,50);"
  ],
  "controls": [{ "id": "mass", "label": "Mass", "min": 0, "max": 10, "val": 5, "unit": "kg" }]
}""",
    "lab_config": """{
  "experimentCode": "A-2",
  "experimentTitle": "Simple Pendulum",
  "kitId": "SimplePendulum",
  "tier": "builtin",
  "controls": [],
  "instruments": [],
  "tables": [],
  "procedure": []
}""",
}


def build_section_prompt(
    experiment_code: str,
    section_name: str,
    instructions: str,
    json_example: str,
    context_type: str = "PDF Manual",
) -> str:
    """Build the full prompt for a section."""
    return f"""
{get_system_role(experiment_code)}
Your task is to generate the "{section_name}" section for the requested experiment using the attached {context_type}.

{instructions}

{JSON_FORMAT_INSTRUCTIONS}

### JSON FORMAT EXAMPLE:
{json_example}
"""
