// API Service Abstraction Layer
// This allows seamless switching between Gemini API and Custom API

import { generateLabReport as generateWithGemini } from './geminiService';
import { generateLabReport as generateWithCustomApi } from './customApiService';
import { errorService } from './errorService';
import { logService } from './logService';

export type ApiProvider = 'gemini' | 'custom';

const API_PROVIDER_KEY = 'galvaniy_api_provider';

export const apiService = {
  // Get current API provider
  getProvider: (): ApiProvider => {
    const stored = localStorage.getItem(API_PROVIDER_KEY);
    return (stored as ApiProvider) || 'gemini';
  },

  // Set API provider
  setProvider: (provider: ApiProvider) => {
    localStorage.setItem(API_PROVIDER_KEY, provider);
  },

  // Generate report using the selected provider
  generateLabReport: async (experimentCode: string): Promise<string> => {
    const provider = apiService.getProvider();
    
    logService.log(`[API Service] Using provider: ${provider}`);
    
    try {
      if (provider === 'custom') {
        return await generateWithCustomApi(experimentCode);
      } else {
        return await generateWithGemini(experimentCode);
      }
      
    } catch (error: any) {
      // Wrap technical errors with user-friendly messages
      const wrappedError = errorService.wrapError(
        `[API Service] ${provider} provider`,
        error,
        { provider, experimentCode }
      );
      throw wrappedError;
    }
  },

  // Check if provider is available/configured
  isProviderConfigured: (provider: ApiProvider): boolean => {
    if (provider === 'gemini') {
      return !!process.env.API_KEY;
    } else if (provider === 'custom') {
      const apiUrl = localStorage.getItem('custom_api_base_url') || process.env.CUSTOM_API_URL;
      return !!apiUrl;
    }
    return false;
  }
};

