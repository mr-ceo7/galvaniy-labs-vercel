import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storageService";
import { validateReport } from "./reportValidator";

export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Context Search: Find pages that contain the experiment code
  const relevantPages = storageService.findRelevantPages(experimentCode);
  
  // Validation: Ensure manual exists
  if (relevantPages.length === 0) {
      throw new Error("No relevant pages found in the Manual for this code. Please contact Admin to upload the correct manual.");
  }

  // 2. Build Multimodal Request
  // We send the text content of the pages AND the images of the pages to the AI.
  // We instruct the AI to identify which page has the relevant diagram.
  const contentParts: any[] = [];
  
  let combinedTextContext = "";
  relevantPages.forEach((page) => {
      combinedTextContext += `--- PAGE ${page.id} (Index: ${page.pageNumber}) ---\n${page.text}\n\n`;
      if (page.image) {
          const base64Data = page.image.split(',')[1]; // Strip header
          contentParts.push({ text: `Image for Page ID: ${page.id}` });
          contentParts.push({
             inlineData: {
                 mimeType: "image/jpeg",
                 data: base64Data
             }
          });
      }
  });

  const systemPrompt = `
  You are an expert Physics Laboratory Assistant.
  Your task is to generate a lab report for Experiment Code: "${experimentCode}".
  
  I have provided text and images from the relevant pages of the uploaded manual.
  
  STRICT RULES:
  1. **Strict Adherence**: Extract Title, Objectives, Apparatus, Theory, and Procedure VERBATIM from the manual text provided.
  2. **Visual Awareness**: Look at the provided images. 
     - If you see a circuit diagram or apparatus setup in the images for this experiment, you MUST return the "relevantPageId" of that image in the JSON.
     - Use the visual information in the image to accurately describe the "Procedure" (e.g. "Connect as shown in the diagram...").
  3. **Realistic Data**: Generate imperfect, realistic "tableData" with experimental error.
  4. **Graphing**: Only include "graphConfig" if the manual explicitly asks for a graph.

  MANUAL TEXT CONTEXT:
  ${combinedTextContext}
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
    "calculationScript": "JavaScript function body string",
    "analysisTemplate": "Analysis text using {{placeholders}}",
    "discussion": "String",
    "conclusion": "String",
    "simulationType": "String",
    "relevantPageId": "String (The ID of the page containing the diagram, or null)"
  }
  
  Return ONLY the JSON. No Markdown.
  `;

  // Add system prompt to parts
  contentParts.push({ text: systemPrompt + schemaInstruction });

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      console.log(`[AI] Generation Attempt ${attempts} for ${experimentCode}`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: contentParts },
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

      // Post-Processing: Inject Diagram Image
      if (json.relevantPageId) {
          const pageWithDiagram = relevantPages.find(p => p.id === json.relevantPageId);
          if (pageWithDiagram && pageWithDiagram.image) {
              json.diagram = pageWithDiagram.image; // Inject the full base64 string
          }
      }

      // Validate
      const validation = validateReport(json, experimentCode);
      if (validation.valid) {
        return JSON.stringify(json);
      } else {
        contentParts.push({ text: `PREVIOUS INVALID. Fix: ${validation.errors.join(', ')}` });
      }

    } catch (error: any) {
      console.error(`[AI] Error:`, error);
      if (error.message.includes("not found")) throw error;
      if (attempts === MAX_ATTEMPTS) break;
    }
  }

  throw new Error(`Failed to generate report for ${experimentCode}.`);
};