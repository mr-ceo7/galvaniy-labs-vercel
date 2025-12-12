
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));


// API Endpoint
app.post('/api/generate-report', async (req, res) => {
  try {
    const { experimentCode, context } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Construct the prompt (server-side to keep logic secure if needed, though mostly for key protection here)
    // Note: In a real app, 'context' might also be retrieved server-side to avoid sending large payloads.
    // For now, adhering to existing logic where client sends context.

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
      - **Graphs**: If the experiment in the manual DOES NOT explicitly require plotting a graph, set "graphConfig" to null.
      - **Questions**: If the manual lists specific questions, include them.
      - **Data**: Generate PLAUSIBLE FAKE DATA for 'tableData'.
      - **Calculations**: Ensure 'calculationScript' is valid ES6 JavaScript.
      
      MANUAL CONTEXT:
      ${context}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    res.json({ content: text });

  } catch (error) {
    console.error('Generaton Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
