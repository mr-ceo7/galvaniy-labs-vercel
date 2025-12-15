import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storageService";
import { validateReport } from "./reportValidator";

export const generateLabReport = async (experimentCode: string, imageBase64?: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = storageService.getFullContext();
  
  // Validation: Ensure manual exists
  if (!context || context.trim().length < 50) {
      throw new Error("No Lab Manual found. Please contact the Admin to upload the relevant laboratory manual references.");
  }

  // Generic System Prompt for Scalability
  let systemPrompt = `
  You are an expert laboratory assistant and strictly constrained database interface.
  Your task is to extract experiment details for the Experiment Code: "${experimentCode}" from the provided MANUAL CONTEXT and the ATTACHED IMAGE (if provided).

  MANUAL CONTEXT:
  ---------------------------------------------------
  ${context}
  ---------------------------------------------------

  DOMAIN EXPERTISE & DATA REALISM (CRITICAL):
  1. **Subject Adherence**: Use precise, accepted terminology for the specific subject (e.g., Physics, Chemistry). Obey the fundamental laws of science.
  2. **Realistic Data Simulation**:
     - **NO PERFECT DATA**: The generated "tableData" MUST NOT be perfect. You must simulate **real-world experimental error**.
     - **Noise & Scatter**: Introduce random fluctuations, reading errors, and slight systematic errors.
     - **Precision**: Use realistic significant figures.
     - **Trend**: The data should generally follow the theoretical relationship but points should scatter slightly.

  STRICT OPERATING RULES:
  1. **Search Phase**: 
     - Look for the exact experiment code "${experimentCode}" in the context.
     - IF AN IMAGE IS PROVIDED: Use the image to identify apparatus setup, circuit diagrams, or procedural steps that might be missing from the text.
     - If the experiment is NOT found in text OR image, return JSON: { "error": "Experiment '${experimentCode}' not found in the uploaded manual." }.

  2. **Extraction Phase (Verbatim)**:
     - **Title**: Use the title exactly as in the manual.
     - **Objectives**: Extract strictly from the manual.
     - **Apparatus**: List ONLY equipment mentioned in the manual text or VISIBLE in the provided image.
     - **Theory**: Extract the theory provided.
     - **Procedure**: Extract steps exactly. If the text says "connect as shown in Fig 1" and you have the image, describe the connection seen in the image.

  3. **Graphing Rule (Strict)**:
     - Default "graphConfig": null
     - Change "graphConfig" to a valid object ONLY if the manual EXPLICITLY commands to "plot", "graph", or "draw" a relationship.

  4. **Questions Rule (Strict)**:
     - Default "questions": []
     - Only extract questions listed under a "Questions" or "Discussion" section.
     - Answer ONLY the questions listed.

  5. **Data Phase**:
     - Generate "tableData" and "tableHeaders" based on the table or measurements described in the manual.
     - Ensure columns have units.

  SIMULATION CONFIGURATION:
  You must choose the best "simulationType" from the following list based on the experiment topic:
  - 'pendulum' (For pendulum/gravity experiments)
  - 'heating' (For cooling, heating, thermodynamics)
  - 'spring' (For elasticity, Hooke's law, oscillations)
  - 'circuit' (For electricity, Ohm's law, electronics)
  - 'wave' (For sound, waves, vibration, sonometer)
  - 'general' (For anything else)
  `;

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
    "graphConfig": { "xColumnIndex": 0, "yColumnIndex": 1, "xLabel": "Str", "yLabel": "Str", "title": "Str" } or null, 
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

      let contentParts: any[] = [{ text: currentPrompt }];
      
      // If image is provided, strip base64 header if present and add to parts
      if (imageBase64) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        contentParts.push({
          inlineData: {
            mimeType: "image/png", // Assuming PNG/JPEG, Gemini handles mostly standard formats
            data: base64Data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Supports multimodal
        contents: { parts: contentParts },
        config: {
          responseMimeType: 'application/json'
        }
      });

      let text = response.text;
      if (!text) throw new Error("Empty response");
      
      // Robust JSON extraction
      text = text.replace(/```json/g, '').replace(/```/g, '');
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      }
      text = text.trim();

      // Parse
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(`[AI] JSON Parse Error on attempt ${attempts}:`, text);
        throw new Error("Invalid JSON from AI");
      }

      // Check for explicit not found error from AI
      if (json.error) {
          throw new Error(json.error);
      }

      // Validate Structure
      const validation = validateReport(json, experimentCode);

      if (validation.valid) {
        return JSON.stringify(json);
      } else {
        console.error("[AI] Validation Errors:", validation.errors);
        currentPrompt += `\n\nPREVIOUS ATTEMPT WAS INVALID. Fix these errors:\n- ${validation.errors.join('\n- ')}\n`;
      }

    } catch (error: any) {
      console.error(`[AI] Attempt ${attempts} failed:`, error);
      if (error.message.includes("not found")) {
          throw error;
      }
      if (attempts === MAX_ATTEMPTS) break;
    }
  }

  throw new Error(`Failed to generate report for ${experimentCode}. Ensure the code matches the manual exactly.`);
};