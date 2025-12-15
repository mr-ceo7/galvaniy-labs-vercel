import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storageService";
import { EXPERIMENTS } from "./experimentDatabase";
import { validateReport } from "./reportValidator";
import { generateFallbackReport } from "./fallbackReports";

export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = storageService.getFullContext();
  const expDef = EXPERIMENTS[experimentCode];

  // Enhanced System Prompt with Physics Constraints
  let systemPrompt = `
  You are an expert physics lab assistant at the University of Nairobi.
  Generate a valid JSON lab report for Experiment Code: "${experimentCode}".
  
  MANUAL CONTEXT:
  ${context}
  `;

  let graphHint = "";
  if (expDef) {
    // Determine graph hint based on experiment definition to ensure Chart.js renders correctly
    if (experimentCode === 'A-2') {
       graphHint = 'Graph Config: Plot "T² (s²)" (y-axis, col index 3) vs "Length L (m)" (x-axis, col index 0).';
    } else if (experimentCode === 'C-11') {
       graphHint = 'Graph Config: Plot "ln(T-Ts)" (y-axis, col index 3) vs "Time t (min)" (x-axis, col index 0).';
    } else if (experimentCode === 'D-14') {
       graphHint = 'Graph Config: Plot "l² (m²)" (y-axis, col index 3) vs "Tension T (N)" (x-axis, col index 1).';
    } else if (experimentCode === 'B-6') {
       graphHint = 'Graph Config: Plot "Extension e (m)" (y-axis, col index 2) vs "Mass M (kg)" (x-axis, col index 0).';
    } else if (experimentCode === 'F-18') {
       graphHint = 'Graph Config: Plot "Current I (A)" (y-axis, col index 1) vs "Voltage V (V)" (x-axis, col index 0).';
    }

    systemPrompt += `
    
    CRITICAL PHYSICS CONSTRAINTS FOR ${experimentCode}:
    1. Formula: ${expDef.theory}
    2. Range: ${expDef.independentVarLabel} must be between ${expDef.validRange.min} and ${expDef.validRange.max} ${expDef.validRange.unit}.
    3. Expected Result: ${expDef.expectedResult.label} should be approx ${expDef.expectedResult.value}.
    4. Generate ${expDef.dataPoints} rows of data.
    5. Data MUST include realistic random experimental error (noise), do not make it perfectly linear.
    6. ${graphHint}
    7. SIMULATION TYPE: You MUST set the "simulationType" field to "${expDef.simulationType}". Do not use "general".
    `;
  }

  const schemaInstruction = `
  STRICT JSON SCHEMA:
  {
    "title": "String",
    "objectives": ["String"],
    "apparatus": ["String"],
    "theory": "String",
    "procedure": ["String"],
    "tableHeaders": ["Col1 (unit)", "Col2 (unit)"],
    "tableData": [[number, number]], 
    "graphConfig": { "xColumnIndex": 0, "yColumnIndex": 1, "xLabel": "Str", "yLabel": "Str", "title": "Str" }, 
    "questions": [{ "question": "Str", "answer": "Str" }],
    "calculationScript": "JavaScript function body string returning object e.g. 'const m=rows[0][0]; return {slope: m};'",
    "analysisTemplate": "Analysis text using placeholders like {{slope}}",
    "discussion": "String",
    "conclusion": "String",
    "simulationType": "String" 
  }
  
  Return ONLY the JSON. No Markdown. No \`\`\`json blocks.
  `;

  let currentPrompt = systemPrompt + schemaInstruction;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      console.log(`[AI] Generation Attempt ${attempts} for ${experimentCode}`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: currentPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      let text = response.text;
      if (!text) throw new Error("Empty response");
      
      // Robust JSON extraction
      // 1. Remove markdown code blocks
      text = text.replace(/```json/g, '').replace(/```/g, '');
      
      // 2. Find the first '{' and last '}'
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      }
      
      text = text.trim();

      // Validate
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(`[AI] JSON Parse Error on attempt ${attempts}:`, text);
        throw new Error("Invalid JSON");
      }

      // --- CRITICAL FIX: FORCE SIMULATION TYPE ---
      // The AI often hallucinates types like "SonometerExperiment" instead of "wave".
      // We strictly enforce the type defined in our database to ensure the UI renders correctly.
      if (expDef && expDef.simulationType) {
        json.simulationType = expDef.simulationType;
      }
      // -------------------------------------------

      const validation = validateReport(json, experimentCode);

      if (validation.valid && validation.warnings.length === 0) {
        return JSON.stringify(json); // Return the sanitized, corrected JSON string
      }

      // If valid structure but physics warnings, we can decide to accept or retry.
      // If critical errors, we must retry.
      if (validation.valid && attempts < MAX_ATTEMPTS) {
         // Add feedback for next loop
         console.warn("[AI] Validation Warnings:", validation.warnings);
         currentPrompt += `\n\nPREVIOUS ATTEMPT HAD ISSUES. FIX THESE:\n- ${validation.warnings.join('\n- ')}\n`;
         continue; 
      } else if (validation.valid) {
        // Accept with warnings if out of retries
        return JSON.stringify(json); 
      } else {
        // Invalid structure
        console.error("[AI] Validation Errors:", validation.errors);
        currentPrompt += `\n\nPREVIOUS ATTEMPT WAS INVALID JSON STRUCTURE:\n- ${validation.errors.join('\n- ')}\n`;
      }

    } catch (error) {
      console.error(`[AI] Attempt ${attempts} failed:`, error);
      if (attempts === MAX_ATTEMPTS) break;
    }
  }

  // Fallback Mechanism
  console.warn(`[AI] All generation attempts failed for ${experimentCode}. Using Fallback.`);
  return generateFallbackReport(experimentCode);
};