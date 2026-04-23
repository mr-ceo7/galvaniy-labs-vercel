// API Service — Routes all report generation through the Python backend
//
// Previously this was a facade switching between Gemini and Custom API.
// Now the backend handles provider selection, prompt templates, and rate limiting.

import { backendService } from './backendService';
import { errorService } from './errorService';
import { logService } from './logService';
import { Report } from '../types';

export const apiService = {
  /**
   * Generate a lab report via the backend API.
   * The backend handles: manual fetching, AI generation, validation, rate limiting, and storage.
   */
  generateLabReport: async (experimentCode: string): Promise<Report> => {
    logService.log(`[API Service] Generating report for: ${experimentCode}`);

    try {
      return await backendService.generateReport(experimentCode);
    } catch (error: any) {
      const wrappedError = errorService.wrapError(
        '[API Service] Backend generation',
        error,
        { experimentCode }
      );
      throw wrappedError;
    }
  },
};
