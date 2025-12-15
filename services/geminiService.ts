import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storageService";
import { validateReport } from "./reportValidator";

// Helper to convert Blob/File to Base64 String (without data URI prefix)
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

export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Get the Full Manual from Storage
  const fullManualFile = await storageService.getFullManualBlob();
  
  if (!fullManualFile) {
      throw new Error("No Manual Found. Please contact Admin to upload the PDF manual.");
  }

  // 2. Build Multimodal Request (PDF + Prompt)
  const pdfPart = await fileToGenerativePart(fullManualFile);
  
  const systemPrompt = `
  You are an expert Physics Laboratory Assistant.
  Your task is to generate a comprehensive lab report for Experiment Code: "${experimentCode}".
  
  I have attached the FULL Laboratory Manual as a PDF. 
  SEARCH through this PDF to find the experiment labeled "${experimentCode}". It might be titled differently or located anywhere in the document. Find it.

  STRICT RULES:
  1. **Strict Adherence**: Extract Title, Objectives, Apparatus, Theory, and Procedure VERBATIM from the manual text for this specific experiment.
  2. **Visual Awareness**: Look at the diagrams in the PDF for this experiment.
     - Use the visual information to accurately describe the "Procedure".
     - Note: You cannot return the image itself, but you must describe the setup if procedure text is missing.
  
  3. **Realistic Data**: 
     - Generate "tableData" with imperfect, realistic values (include random experimental error).
     - Ensure "tableHeaders" includes units.
  
  4. **Interactive Simulation (CRITICAL)**:
     - You must generate a **Custom HTML5 Canvas Animation** for this specific experiment.
     - **controls**: Define the sliders needed.
     - **simulationScript**: Write the JavaScript function body that draws the experiment frame-by-frame on a 2D Canvas.
       - Available variables: \`ctx\` (CanvasContext), \`width\` (800), \`height\` (300), \`frame\` (int counter), \`params\` (object matching control IDs).
       - The script must clear the canvas and draw the apparatus state based on \`params\`.
  
  5. **Analysis**:
     - **graphConfig**: If the experiment involves finding a relationship, provide a graph config.
     - **calculationScript**: Provide a JavaScript function body to calculate results from 'rows' (the table data).
     - **analysisTemplate**: Provide a string that uses {{placeholders}} matching the keys returned by calculationScript.

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
    
    "controls": [
      { "id": "string", "label": "string", "min": number, "max": number, "val": number, "unit": "string" }
    ],
    "simulationScript": "String (The JS code for the canvas draw loop)",
    
    "calculationScript": "JavaScript function body string",
    "analysisTemplate": "Analysis text using {{placeholders}}",
    "discussion": "String",
    "conclusion": "String",
    "relevantPageId": "String (Leave null as we are using full PDF)"
  }
  
  Return ONLY the JSON. No Markdown.
  `;

  // Request Construction
  // Note: We use gemini-1.5-flash which supports PDF input natively via inlineData
  const parts = [
      pdfPart, 
      { text: systemPrompt }
  ];

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      console.log(`[AI] Generation Attempt ${attempts} for ${experimentCode} using Full PDF`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
        config: { responseMimeType: 'application/json' }
      });

      let text = response.text;
      if (!text) throw new Error("Empty response");
      
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid JSON from AI");
      }

      if (json.error) throw new Error(json.error);

      // Validate
      const validation = validateReport(json, experimentCode);
      if (validation.valid) {
        return JSON.stringify(json);
      } else {
        // Retry with error context
        console.warn(`Validation failed: ${validation.errors.join(', ')}`);
      }

    } catch (error: any) {
      console.error(`[AI] Error:`, error);
      if (attempts === MAX_ATTEMPTS) break;
    }
  }

  throw new Error(`Failed to generate report for ${experimentCode}. Ensure the code exists in the manual.`);
};