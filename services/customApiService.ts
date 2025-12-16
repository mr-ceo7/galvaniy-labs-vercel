import { storageService } from "./storageService";
import { validateReport } from "./reportValidator";
import { buildSectionPrompt, getTextContentInstructions, getDataLogicInstructions, getSimulationInstructions, JSON_EXAMPLES } from "./promptTemplates";

// API Configuration
const getApiBaseUrl = (): string => {
  const stored = localStorage.getItem('custom_api_base_url');
  return stored || process.env.CUSTOM_API_URL || 'http://localhost:5000';
};

// Helper to upload PDF to custom API
const uploadPDF = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context_mode', 'true'); // Keep file for session

  // Note: X-Session-ID header is optional and may cause CORS issues
  // If your API server doesn't allow custom headers, it will work without it
  // The session ID is stored locally but not sent if CORS blocks it
  const sessionId = localStorage.getItem('api_session_id') || `session_${Date.now()}`;
  localStorage.setItem('api_session_id', sessionId);

  // Don't send custom headers to avoid CORS issues
  // The API should work without X-Session-ID header (it's optional per README)
  const response = await fetch(`${getApiBaseUrl()}/api/upload`, {
    method: 'POST',
    // Omit custom headers to avoid CORS preflight issues
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  const result = await response.json();
  // Use extracted text file if available, otherwise use the original filename
  return result.extracted_txt || result.filename;
};

// Helper to generate section using custom API
const generateSection = async (
  uploadedFilename: string,
  sectionName: string,
  jsonExample: string,
  instructions: string
): Promise<any> => {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  // Use shared prompt template
  const prompt = buildSectionPrompt(sectionName, instructions, jsonExample, 'uploaded manual');

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      
      const response = await fetch(`${getApiBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          files: [uploadedFilename],
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${error}`);
      }

      const result = await response.json();
      let text = result.response || result;

      if (typeof text !== 'string') {
        text = JSON.stringify(text);
      }

      if (!text) throw new Error("Empty response from API");

      // Clean JSON response
      text = text.replace(/```json/g, '').replace(/```/g, '');
      
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
        if (attempts === MAX_ATTEMPTS) {
          throw new Error(`Failed to parse ${sectionName} JSON. The API generated invalid format.`);
        }
      }

    } catch (error: any) {
      console.error(`[${sectionName}] Generation Failed (Attempt ${attempts}):`, error);
      if (attempts === MAX_ATTEMPTS) throw error;
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
};

// Main generation function for custom API
export const generateLabReport = async (experimentCode: string): Promise<string> => {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    throw new Error("Custom API URL is not configured. Please set it in Admin settings.");
  }

  // 1. Get Manual
  const fullManualFile = await storageService.getFullManualBlob();
  if (!fullManualFile) {
    throw new Error("No Manual Found. Please contact Admin to upload the PDF manual.");
  }

  console.log(`[Custom API] Uploading manual...`);
  
  // 2. Upload PDF to custom API
  const uploadedFilename = await uploadPDF(fullManualFile);
  console.log(`[Custom API] Manual uploaded as: ${uploadedFilename}`);

  console.log(`[Custom API] Starting Parallel Generation for ${experimentCode}...`);

  // 3. Define Parallel Tasks (same structure as Gemini service)

  // --- Task A: Text Content ---
  const textTask = generateSection(
    uploadedFilename,
    "Text Content",
    JSON_EXAMPLES.textContent,
    getTextContentInstructions(experimentCode)
  );

  // --- Task B: Data & Logic ---
  const dataTask = generateSection(
    uploadedFilename,
    "Data & Logic",
    JSON_EXAMPLES.dataLogic,
    getDataLogicInstructions(experimentCode)
  );

  // --- Task C: Simulation ---
  const simTask = generateSection(
    uploadedFilename,
    "Simulation",
    JSON_EXAMPLES.simulation,
    getSimulationInstructions(experimentCode)
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
    console.error("[Custom API] Report Generation Failed:", error);
    throw error;
  }
};

