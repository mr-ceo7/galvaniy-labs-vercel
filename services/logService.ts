/**
 * Logging Service
 * 
 * Provides console logging that's only active in development mode.
 * All logs are suppressed in production builds.
 */

// Check if running in development mode
// Vite sets this during build
declare const __DEV__: boolean;

const isDevelopment = (): boolean => {
  // In development (npm run dev), process.env.NODE_ENV is 'development'
  // In production build, it's 'production'
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  // Fallback check
  return typeof window !== 'undefined' && (window as any).__DEV__ !== false;
};

/**
 * No-op function used in production
 */
const noOp = () => {};

/**
 * Logging service that respects development vs production environment
 */
export const logService = {
  /**
   * Log general information (only in development)
   */
  log: isDevelopment() ? console.log.bind(console) : noOp,

  /**
   * Log error messages (only in development)
   */
  error: isDevelopment() ? console.error.bind(console) : noOp,

  /**
   * Log warning messages (only in development)
   */
  warn: isDevelopment() ? console.warn.bind(console) : noOp,

  /**
   * Log debugging information (only in development)
   */
  debug: isDevelopment() ? console.debug.bind(console) : noOp,

  /**
   * Log information messages (only in development)
   */
  info: isDevelopment() ? console.info.bind(console) : noOp,

  /**
   * Check if logging is enabled
   */
  isEnabled: (): boolean => isDevelopment(),
};

// Export convenience aliases
export const log = logService.log;
export const logError = logService.error;
export const logWarn = logService.warn;
export const logDebug = logService.debug;
export const logInfo = logService.info;
