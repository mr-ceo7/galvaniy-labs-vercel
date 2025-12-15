import { GoogleGenAI, Type, Schema } from "@google/genai";
import { storageService } from "./storageService";
import { validateReport } from "./reportValidator";

// --- Helper: File to Base64 ---
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: "application/pdf",
        },
    };
};

// --- Helper: Robust API Call Wrapper ---
const generateSection = async (
    ai: GoogleGenAI, 
    parts: any[], 
    sectionName: string, 
    jsonExample: string,
    instructions: string,
    schema?: Schema
): Promise<any> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    const finalPrompt = `
    You are an expert Physics Laboratory Assistant.
    Your task is to generate the "${sectionName}" section for the requested experiment using the attached PDF Manual.
    
    ${instructions}

    ### STRICT JSON FORMAT REQUIRED
    Return ONLY valid JSON matching the provided schema.
    Do not include markdown formatting like \`\`\`json.
    Do not include any text before or after the JSON object.
    
    ### JSON FORMAT EXAMPLE:
    ${jsonExample}
    `;

    // Add the specific prompt to the parts for this request
    const requestParts = [...parts, { text: finalPrompt }];

    while (attempts < MAX_ATTEMPTS) {
        try {
            attempts++;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: requestParts },
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    maxOutputTokens: 8192, 
                }
            });

            let text = response.text;
            if (!text) throw new Error("Empty response from AI");
            
            // --- Enhanced Cleaning Logic ---
            // Even with responseSchema, sometimes models might wrap in markdown blocks, though rare.
            text = text.replace(/```json/g, '').replace(/```/g, '');
            
            // Find boundaries just in case
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
                text = text.substring(firstBrace, lastBrace + 1);
            }

            // Remove control characters
            text = text.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

            try {
                const json = JSON.parse(text);
                if (json.error) throw new Error(json.error);
                return json;
            } catch (parseError) {
                console.warn(`[${sectionName}] JSON Parse Error (Attempt ${attempts}):`, text.slice(0, 100) + "..." + text.slice(-100));
                if (attempts === MAX_ATTEMPTS) throw new Error(`Failed to parse ${sectionName} JSON. The AI generated invalid format.`);
            }

        } catch (error: any) {
            console.error(`[${sectionName}] Generation Failed (Attempt ${attempts}):`, error);
            if (attempts === MAX_ATTEMPTS) throw error;
        }
    }
};

// --- Main Generation Function ---
export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Get Manual
  const fullManualFile = await storageService.getFullManualBlob();
  if (!fullManualFile) {
      throw new Error("No Manual Found. Please contact Admin to upload the PDF manual.");
  }

  // 2. Prepare Base Context (PDF)
  // We reuse this part for all parallel calls to save bandwidth/processing on client side preparation
  const pdfPart = await fileToGenerativePart(fullManualFile);
  const commonParts = [pdfPart]; // Common context

  console.log(`[AI] Starting Parallel Generation for ${experimentCode}...`);

  // 3. Define Parallel Tasks

  // --- Task A: Text Content Schema ---
  const textSchema: Schema = {
      type: Type.OBJECT,
      properties: {
          title: { type: Type.STRING },
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          apparatus: { type: Type.ARRAY, items: { type: Type.STRING } },
          theory: { type: Type.STRING },
          procedure: { type: Type.ARRAY, items: { type: Type.STRING } },
          discussion: { type: Type.STRING },
          conclusion: { type: Type.STRING },
          questions: { 
              type: Type.ARRAY, 
              items: { 
                  type: Type.OBJECT, 
                  properties: { 
                      question: { type: Type.STRING }, 
                      answer: { type: Type.STRING } 
                  } 
              } 
          }
      },
      required: ["title", "objectives", "apparatus", "theory", "procedure", "discussion", "conclusion"]
  };
  
  const textTask = generateSection(
      ai, 
      commonParts, 
      "Text Content",
      `{
        "title": "Exp Title",
        "objectives": ["Obj 1", "Obj 2"],
        "apparatus": ["Item 1"],
        "theory": "Detailed theory text...",
        "procedure": ["Step 1", "Step 2"],
        "discussion": "Sources of error...",
        "conclusion": "Summary...",
        "questions": [{"question": "Q1?", "answer": "A1"}]
      }`,
      `
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
      `,
      textSchema
  );

  // --- Task B: Data & Logic Schema ---
  const dataSchema: Schema = {
      type: Type.OBJECT,
      properties: {
          tables: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING, nullable: true },
                      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                      rows: { 
                          type: Type.ARRAY, 
                          items: { 
                              type: Type.ARRAY, 
                              items: { type: Type.STRING } 
                          } 
                      }
                  },
                  required: ["headers", "rows"]
              }
          },
          calculationScriptLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysisTemplate: { type: Type.STRING },
          graphConfig: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                  tableIndex: { type: Type.INTEGER },
                  xColumnIndex: { type: Type.INTEGER },
                  yColumnIndex: { type: Type.INTEGER },
                  title: { type: Type.STRING }
              }
          }
      },
      required: ["tables", "calculationScriptLines", "analysisTemplate"]
  };

  const dataTask = generateSection(
      ai, 
      commonParts, 
      "Data & Logic",
      `{
        "tables": [{ "title": "Table 1", "headers": ["Col 1", "Col 2"], "rows": [["1", "2"], ["3", "4"]] }],
        "calculationScriptLines": [
            "const r = tables[0].rows[0];",
            "return { res: parseFloat(r[1]) * 2 };"
        ],
        "analysisTemplate": "Result: {{res}} units",
        "graphConfig": { "tableIndex": 0, "xColumnIndex": 0, "yColumnIndex": 1, "title": "A vs B" }
      }`,
      `
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
      `,
      dataSchema
  );

  // --- Task C: Simulation Schema ---
  const simSchema: Schema = {
      type: Type.OBJECT,
      properties: {
          simulationScriptLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          controls: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      min: { type: Type.NUMBER },
                      max: { type: Type.NUMBER },
                      val: { type: Type.NUMBER },
                      unit: { type: Type.STRING }
                  },
                  required: ["id", "label", "min", "max", "val", "unit"]
              }
          }
      },
      required: ["simulationScriptLines", "controls"]
  };

  const simTask = generateSection(
      ai, 
      commonParts, 
      "Simulation",
      `{
        "simulationScriptLines": [
            "ctx.fillStyle='red';",
            "ctx.fillRect(10,10,50,50);"
        ],
        "controls": [{ "id": "mass", "label": "Mass", "min": 0, "max": 10, "val": 5, "unit": "kg" }]
      }`,
      `
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
      `,
      simSchema
  );

  try {
      // Execute all sections in parallel
      const [textJson, dataJson, simJson] = await Promise.all([textTask, dataTask, simTask]);

      // --- Post-Processing: Convert String Arrays back to Script Strings ---
      
      // Data Logic
      if (dataJson.calculationScriptLines && Array.isArray(dataJson.calculationScriptLines)) {
          dataJson.calculationScript = dataJson.calculationScriptLines.join('\n');
          delete dataJson.calculationScriptLines;
      }

      // Simulation
      if (simJson.simulationScriptLines && Array.isArray(simJson.simulationScriptLines)) {
          simJson.simulationScript = simJson.simulationScriptLines.join('\n');
          delete simJson.simulationScriptLines;
      }

      // Merge Results
      const fullReport = {
          ...textJson,
          ...dataJson,
          ...simJson
      };

      // Final Validation
      const validation = validateReport(fullReport, experimentCode);
      if (!validation.valid) {
          console.warn("Report Validation Warnings:", validation.warnings);
          if (validation.errors.length > 0) {
               throw new Error(`Generated report invalid: ${validation.errors.join(', ')}`);
          }
      }

      return JSON.stringify(fullReport);

  } catch (error: any) {
      console.error("[AI] Report Generation Failed:", error);
      throw error; // Re-throw for UI handling
  }
};