import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storageService";

export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Get dynamic context from storage
  const context = storageService.getFullContext();

  const prompt = `
  You are an expert physics lab assistant at the University of Nairobi.
  
  Using the Manual Context provided below, generate a structured JSON lab report for Experiment Code: "${experimentCode}".
  
  Instructions:
  1. Return ONLY valid JSON. Do not wrap in markdown code blocks.
  2. **STRICTLY** follow the manual content.
  3. The JSON must follow this exact schema:
  {
    "title": "Experiment Title",
    "objectives": ["obj1", "obj2"],
    "apparatus": ["item1", "item2"],
    "theory": "Brief theory in plain text or simple markdown.",
    "procedure": ["step1", "step2"],
    "tableHeaders": ["Col 1 (units)", "Col 2 (units)"],
    "tableData": [[1.0, 2.0], [2.0, 4.0]], 
    "graphConfig": {
      "xColumnIndex": 0,
      "yColumnIndex": 1,
      "xLabel": "Label X",
      "yLabel": "Label Y",
      "title": "Graph Title"
    } OR null, 
    "questions": [
      { "question": "Question text from manual?", "answer": "Answer based on theory/results." }
    ] OR [],
    "calculationScript": "A JavaScript function body (string) that takes 'rows' (array of number arrays) as input and returns an object of calculated values. Example: 'const m = rows[0][0]; return { slope: m * 2, g: 9.8 };'",
    "analysisTemplate": "Analysis text with placeholders like {{slope}} and {{g}} which match keys from calculationScript return object.",
    "discussion": "Discussion text",
    "conclusion": "Conclusion text",
    "simulationType": "one of: 'pendulum', 'heating', 'spring', 'circuit', 'wave', 'optics', 'general'"
  }

  Specific Rules:
  - **Graphs**: If the experiment in the manual DOES NOT explicitly require plotting a graph, set "graphConfig" to null. Do not invent a graph.
  - **Questions**: If the manual lists specific questions for this experiment, include them and their correct answers in the "questions" array. If there are no specific questions, return an empty array.
  - **Data**: Generate PLAUSIBLE FAKE DATA for 'tableData' that follows physics laws.
  - **Calculations**: Ensure 'calculationScript' is valid ES6 JavaScript code that does not use external libraries.
  
  MANUAL CONTEXT:
  ${context}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from AI");
    }
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate report. Please try again.");
  }
};