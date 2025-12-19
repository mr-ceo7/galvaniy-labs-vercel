// Shared Prompt Templates
// Modify prompts here once, and both Gemini and Custom API will use them

export interface PromptConfig {
  systemRole: string;
  jsonFormatInstructions: string;
  textContentInstructions: (experimentCode: string) => string;
  dataLogicInstructions: (experimentCode: string) => string;
  simulationInstructions: (experimentCode: string) => string;
}

// Main system role/persona
export const SYSTEM_ROLE = `You are an expert Physics Laboratory Assistant.`;

// JSON format requirements (shared across all sections)
export const JSON_FORMAT_INSTRUCTIONS = `
### STRICT JSON FORMAT REQUIRED
Return ONLY valid JSON matching the provided schema/example structure.
Do not include markdown formatting like \`\`\`json.
Do not include any text before or after the JSON object.
`;

// Text Content Section Instructions
export const getTextContentInstructions = (experimentCode: string): string => `
SEARCH the manual for experiment code "${experimentCode}".
Extract the following text sections VERBATIM where possible:
1. Title
2. Objectives (array)
3. Apparatus (array)
4. Theory (comprehensive text)
5. Procedure (array of steps, include references to Figures if seen in PDF)
6. Questions (if present in manual, include answers. If not, generate 2 relevant questions)
7. Discussion (Generate a generic discussion on sources of error relevant to this physics experiment)
8. Conclusion (Summarize based on objectives)
`;

// Data & Logic Section Instructions
export const getDataLogicInstructions = (experimentCode: string): string => `
SEARCH the manual for experiment code "${experimentCode}".
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
   - Text summary with {{placeholder}} for calculated results.
   
4. **Graph Config** (Optional):
   - If a graph is standard for this experiment, provide config.
`;

// Simulation Section Instructions
export const getSimulationInstructions = (experimentCode: string): string => `
Create a HTML5 Canvas Visualization for experiment "${experimentCode}".

1. **Simulation Script**:
   - **IMPORTANT**: Return this as "simulationScriptLines" (Array of Strings).
   - Each string is a line of code.
   - JS function body: (ctx, width, height, frame, params) => void.
   - Visualize the apparatus setup (e.g., pendulum, circuit, optical bench).
   - Use 'params' object for interactivity.
   - Keep it simple and visual. NO COMMENTS.
   
2. **Controls**:
   - Array of sliders to control variables (e.g., length, resistance, angle).
`;

// JSON Examples for each section
export const JSON_EXAMPLES = {
  textContent: `{
  "title": "Exp Title",
  "objectives": ["Obj 1", "Obj 2"],
  "apparatus": ["Item 1"],
  "theory": "Detailed theory text...",
  "procedure": ["Step 1", "Step 2"],
  "discussion": "Sources of error...",
  "conclusion": "Summary...",
  "questions": [{"question": "Q1?", "answer": "A1"}]
}`,

  dataLogic: `{
  "tables": [{ "title": "Table 1", "headers": ["Col 1", "Col 2"], "rows": [["1", "2"], ["3", "4"]] }],
  "calculationScriptLines": [
      "const r = tables[0].rows[0];",
      "return { res: parseFloat(r[1]) * 2 };"
  ],
  "analysisTemplate": "Result: {{res}} units",
  "graphConfig": { "tableIndex": 0, "xColumnIndex": 0, "yColumnIndex": 1, "title": "A vs B" }
}`,

  simulation: `{
  "simulationScriptLines": [
      "ctx.fillStyle='red';",
      "ctx.fillRect(10,10,50,50);"
  ],
  "controls": [{ "id": "mass", "label": "Mass", "min": 0, "max": 10, "val": 5, "unit": "kg" }]
}`
};

// Helper function to build the full prompt for a section
export const buildSectionPrompt = (
  sectionName: string,
  instructions: string,
  jsonExample: string,
  contextType: 'PDF Manual' | 'uploaded manual' = 'PDF Manual'
): string => {
  return `
${SYSTEM_ROLE}
Your task is to generate the "${sectionName}" section for the requested experiment using the attached ${contextType}.

${instructions}

${JSON_FORMAT_INSTRUCTIONS}

### JSON FORMAT EXAMPLE:
${jsonExample}
`;
};


