// API Service Abstraction Layer
// This allows seamless switching between Gemini API and Custom API

import { generateLabReport as generateWithGemini } from './geminiService';
import { generateLabReport as generateWithCustomApi } from './customApiService';

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
    
    console.log(`[API Service] Using provider: ${provider}`);
    
    try {
      if (provider === 'custom') {
        return await generateWithCustomApi(experimentCode);
      } else {
        return await generateWithGemini(experimentCode);
      }
    } catch (error: any) {
      // If one provider fails, log but don't auto-switch (let user decide)
      console.error(`[API Service] ${provider} provider failed:`, error);
      throw error;
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

