/**
 * Error Translation Service
 * 
 * Translates technical errors to user-friendly messages.
 * All errors displayed to users should pass through this service.
 */

import { logService } from './logService';

interface ErrorContext {
  code?: string;
  statusCode?: number;
  originalError?: any;
}

/**
 * Translates technical errors into user-friendly messages
 * @param error - The error object or message
 * @param context - Additional context about the error
 * @returns User-friendly error message
 */
export const getUserFriendlyError = (error: any, context?: ErrorContext): string => {
  const errorMessage = error?.message || String(error) || 'An unexpected error occurred';
  const statusCode = context?.statusCode || error?.status;

  // Network/Connection Errors
  if (errorMessage.includes('Failed to fetch') || 
      errorMessage.includes('Network') || 
      errorMessage.includes('network request failed') ||
      errorMessage.includes('ERR_NETWORK')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  // Timeout Errors
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('timed out')) {
    return 'The request took too long to complete. Please try again.';
  }

  // API Key / Authentication Errors
  if (errorMessage.includes('API Key') || 
      errorMessage.includes('api key') ||
      errorMessage.includes('invalid API key') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('401') ||
      statusCode === 401) {
    return 'API authentication failed. Please contact the administrator.';
  }

  // Manual/PDF Upload Errors
  if (errorMessage.includes('No Manual Found') ||
      errorMessage.includes('No manual found') ||
      errorMessage.includes('upload the PDF')) {
    return 'Lab manual is not available. Please contact the administrator to upload the manual.';
  }

  // API Configuration Errors
  if (errorMessage.includes('Custom API URL') ||
      errorMessage.includes('not configured') ||
      errorMessage.includes('URL is not')) {
    return 'API is not properly configured. Please contact the administrator.';
  }

  // JSON/Parsing Errors
  if (errorMessage.includes('JSON') ||
      errorMessage.includes('parse') ||
      errorMessage.includes('invalid format') ||
      errorMessage.includes('invalid data structure')) {
    return 'The generated report has formatting issues. Please try again.';
  }

  // Validation Errors
  if (errorMessage.includes('invalid') ||
      errorMessage.includes('validation')) {
    return 'The generated report has validation issues. Please try again.';
  }

  // Generation Failures
  if (errorMessage.includes('Generation Failed') ||
      errorMessage.includes('generation failed') ||
      errorMessage.includes('Report Generation')) {
    return 'Report generation failed. Please try again. If the problem persists, try a different experiment code.';
  }

  // Rate Limiting / Quota Errors
  if (errorMessage.includes('quota') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      statusCode === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Server Errors (5xx)
  if (statusCode >= 500 || errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return 'The server is temporarily unavailable. Please try again later.';
  }

  // Upload Errors
  if (errorMessage.includes('Upload failed') ||
      errorMessage.includes('upload') && errorMessage.includes('error')) {
    return 'Failed to upload manual. Please try again.';
  }

  // Empty Response
  if (errorMessage.includes('Empty response')) {
    return 'Received an empty response from the server. Please try again.';
  }

  // Model/Provider specific errors
  if (errorMessage.includes('gemini') && errorMessage.toLowerCase().includes('error')) {
    return 'AI service encountered an error. Please try again.';
  }

  if (errorMessage.includes('Custom API') && errorMessage.toLowerCase().includes('error')) {
    return 'The custom API service encountered an error. Please try again.';
  }

  // File/Storage Errors
  if (errorMessage.includes('File') || errorMessage.includes('Storage')) {
    return 'Failed to save or access data. Please try again.';
  }

  // Default: Generic friendly message
  // (Don't expose technical details for unknown errors)
  return 'Something went wrong. Please try again or contact support if the problem persists.';
};

/**
 * Logs technical error details to console for debugging
 * This ensures technical errors are only logged in development mode
 */
export const logTechnicalError = (
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
): void => {
  logService.error(`[${context}] Technical Error:`, {
    message: error?.message,
    stack: error?.stack,
    details: error,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Creates a safe error wrapper that logs technical details
 * but only exposes user-friendly messages
 */
export const wrapError = (
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
): Error => {
  // Log technical details
  logTechnicalError(context, error, additionalInfo);

  // Create error with user-friendly message
  const userMessage = getUserFriendlyError(error);
  const wrappedError = new Error(userMessage);
  
  // Preserve original error for debugging in dev console
  (wrappedError as any).__original = error;
  (wrappedError as any).__context = context;
  
  return wrappedError;
};

/**
 * Validates that an error is "user-friendly"
 * (used for testing/validation purposes)
 */
export const isUserFriendly = (errorMessage: string): boolean => {
  const technicalKeywords = [
    'Error:',
    'TypeError',
    'ReferenceError',
    'JSON.parse',
    'stacktrace',
    'at Object',
    'at Array',
    'Cannot read',
    'undefined is not',
    'process.env',
    'fetch',
    'XMLHttpRequest',
    'CORS',
    'status code',
  ];

  return !technicalKeywords.some(keyword => errorMessage.includes(keyword));
};

export const errorService = {
  getUserFriendlyError,
  logTechnicalError,
  wrapError,
  isUserFriendly,
};
