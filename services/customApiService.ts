import { storageService } from "./storageService";
import { firestoreService } from "./firestoreService";
import { validateReport } from "./reportValidator";
import { buildSectionPrompt, getTextContentInstructions, getDataLogicInstructions, getSimulationInstructions, JSON_EXAMPLES } from "./promptTemplates";

// Cache for API URL (updated from Firestore)
let cachedApiUrl: string | null = null;

// API Configuration - fetch from Firestore with localStorage cache
const getApiBaseUrl = async (): Promise<string> => {
  // Return cached value if available, but still apply the mixed-content safety check
  if (cachedApiUrl) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && cachedApiUrl.startsWith('http:')) {
      console.warn('[Custom API] Insecure HTTP API detected while on HTTPS; using Vercel proxy (relative /api path).');
      return '';
    }
    return cachedApiUrl;
  }

  try {
    // Fetch from Firestore
    const settings = await firestoreService.getSettings();
    if (settings?.customApiUrl) {
      cachedApiUrl = settings.customApiUrl;
      // Update localStorage cache
      localStorage.setItem('custom_api_base_url', settings.customApiUrl);
      return settings.customApiUrl;
    }
  } catch (error) {
    console.warn('[Custom API] Failed to fetch URL from Firestore, using localStorage:', error);
  }

  // Fallback to localStorage or env variable
  const stored = localStorage.getItem('custom_api_base_url');
  cachedApiUrl = stored || process.env.CUSTOM_API_URL || 'http://localhost:5000';

  // Safety: if frontend is served over HTTPS but the configured API is HTTP,
  // return an empty string so the frontend uses the relative `/api` path
  // (Vercel proxy) rather than attempting an insecure direct request.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && cachedApiUrl && cachedApiUrl.startsWith('http:')) {
    console.warn('[Custom API] Insecure HTTP API detected while on HTTPS; using Vercel proxy (relative /api path).');
    return '';
  }

  return cachedApiUrl;
};

// Helper to upload PDF to custom API
const uploadPDF = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context_mode', 'false'); // Keep file for session

  // Note: X-Session-ID header is optional and may cause CORS issues
  // If your API server doesn't allow custom headers, it will work without it
  // The session ID is stored locally but not sent if CORS blocks it
  const sessionId = localStorage.getItem('api_session_id') || `session_${Date.now()}`;
  localStorage.setItem('api_session_id', sessionId);

  // Don't send custom headers to avoid CORS issues
  // The API should work without X-Session-ID header (it's optional per README)
  const apiUrl = await getApiBaseUrl();
  const response = await fetch(`${apiUrl}/api/upload`, {
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
  experimentCode: string,
  sectionName: string,
  jsonExample: string,
  instructions: string
): Promise<any> => {
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  // Use shared prompt template
  const prompt = buildSectionPrompt(experimentCode, sectionName, instructions, jsonExample, 'uploaded manual');

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;

      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/generate`, {
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
  const apiUrl = await getApiBaseUrl();
  // Allow empty string base (""), which indicates use of relative `/api` path
  // (e.g., when the frontend is HTTPS but the configured API is HTTP — use Vercel proxy).
  if (apiUrl === null || apiUrl === undefined) {
    throw new Error("Custom API URL is not configured. Please set it in Admin settings.");
  }

  // 1. Get Manual from Firestore
  console.log('[Custom API] Fetching manual from Firestore...');
  const pages = await firestoreService.getManualPages();
  
  if (!pages || pages.length === 0) {
    throw new Error("No Manual Found. Please contact Admin to upload the relevant manual.");
  }

  // Combine all page text
  const manualText = pages.map(p => p.text).join('\n\n');
  
  // Create a text file blob for upload
  const textBlob = new Blob([manualText], { type: 'text/plain' });
  const textFile = new File([textBlob], 'manual.txt', { type: 'text/plain' });

  console.log(`[Custom API] Manual loaded: ${pages.length} pages`);
  console.log(`[Custom API] Uploading manual...`);

  // 2. Upload text to custom API
  const uploadedFilename = await uploadPDF(textFile);
  console.log(`[Custom API] Manual uploaded as: ${uploadedFilename}`);
  console.log(`[Custom API] Checking generation mode for ${experimentCode}...`);

  // Read generation mode from Firestore or localStorage (default: parallel)
  let parallelGeneration = true;
  try {
    const settings = await firestoreService.getSettings();
    if (typeof settings?.enableParallelGeneration !== 'undefined') {
      parallelGeneration = !!settings.enableParallelGeneration;
    } else {
      const stored = localStorage.getItem('enable_parallel_generation');
      if (stored === 'false') parallelGeneration = false;
    }
  } catch (e) {
    const stored = localStorage.getItem('enable_parallel_generation');
    if (stored === 'false') parallelGeneration = false;
  }

  console.log(`[Custom API] Starting ${parallelGeneration ? 'Parallel' : 'Queued'} Generation for ${experimentCode}...`);

  // 3. Define Tasks
  const textTaskFn = () => generateSection(
    uploadedFilename,
    experimentCode,
    "Text Content",
    JSON_EXAMPLES.textContent,
    getTextContentInstructions(experimentCode)
  );

  const dataTaskFn = () => generateSection(
    uploadedFilename,
    experimentCode,
    "Data & Logic",
    JSON_EXAMPLES.dataLogic,
    getDataLogicInstructions(experimentCode)
  );

  const simTaskFn = () => generateSection(
    uploadedFilename,
    experimentCode,
    "Simulation",
    JSON_EXAMPLES.simulation,
    getSimulationInstructions(experimentCode)
  );

  try {
    let textJson: any, dataJson: any, simJson: any;

    if (parallelGeneration) {
      const [t, d, s] = await Promise.all([textTaskFn(), dataTaskFn(), simTaskFn()]);
      textJson = t; dataJson = d; simJson = s;
    } else {
      // Queued/Sequential execution
      textJson = await textTaskFn();
      dataJson = await dataTaskFn();
      simJson = await simTaskFn();
    }

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

