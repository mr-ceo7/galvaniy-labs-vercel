# Error Handling Implementation Guide

## Overview
This document describes the user-friendly error handling system implemented across the Galvaniy-Labs application. The goal is to ensure users only see helpful, actionable error messages while developers retain full technical details in console logs.

## Architecture

### Error Service (`services/errorService.ts`)
The central error translation service that maps technical errors to user-friendly messages.

**Key Functions:**

1. **`getUserFriendlyError(error, context?)`**
   - Translates technical errors into user-friendly messages
   - Handles common error patterns:
     - Network/Connection errors → "Network connection failed. Please check your internet connection and try again."
     - API Key errors → "API authentication failed. Please contact the administrator."
     - Manual/PDF missing → "Lab manual is not available. Please contact the administrator."
     - JSON/Parsing errors → "The generated report has formatting issues. Please try again."
     - Rate limiting → "Too many requests. Please wait a moment and try again."
     - Server errors (5xx) → "The server is temporarily unavailable. Please try again later."

2. **`logTechnicalError(context, error, additionalInfo?)`**
   - Logs full technical details to console for debugging
   - Includes stack traces, error details, and metadata
   - Only visible to developers (console access)

3. **`wrapError(context, error, additionalInfo?)`**
   - Creates error wrapper with user-friendly message
   - Preserves original error for dev console inspection
   - Sets `__original` and `__context` properties on error object

4. **`isUserFriendly(errorMessage)`**
   - Validates that an error message doesn't contain technical keywords
   - Used for testing/validation purposes

## Implementation Pattern

### 1. In Service Files (API, Generation, etc.)

```typescript
import { errorService } from './errorService';

// Example: geminiService.ts
export const generateLabReport = async (experimentCode: string): Promise<string> => {
  if (!process.env.API_KEY) {
    const error = new Error("API Key is missing. Please contact Admin to check API configuration.");
    throw errorService.wrapError('Gemini: API Key', error);
  }

  try {
    // ... generation logic ...
    const pages = await firestoreService.getManualPages();
  } catch (error) {
    throw errorService.wrapError('Gemini: Firestore Fetch', error);
  }

  try {
    // ... final generation ...
  } catch (error: any) {
    if (!error.__context) {
      throw errorService.wrapError('Gemini: Report Generation', error, { experimentCode });
    }
    throw error; // Already wrapped
  }
};
```

### 2. In UI Components (React)

```typescript
// Example: Generator.tsx
const handleGenerate = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  try {
    const content = await apiService.generateLabReport(trimmedCode);
    // ... success handling ...
  } catch (err: any) {
    // err.message is already user-friendly thanks to error service
    setError(err.message || 'Generation failed.');
  } finally {
    setLoading(false);
  }
};
```

## Error Flow

1. **Technical error occurs** in service layer (API call, validation, etc.)
2. **Error is caught** and passed to `errorService.wrapError()`
3. **Technical details logged** to console via `logTechnicalError()`
4. **User-friendly message created** using `getUserFriendlyError()`
5. **Wrapped error thrown** with safe message in `.message` property
6. **UI component catches** error and displays `err.message` to user
7. **User sees helpful message**, developers see full details in console

## Error Message Categories

### Network/Connection
- "Network connection failed. Please check your internet connection and try again."

### Authentication/API
- "API authentication failed. Please contact the administrator."

### Configuration
- "API is not properly configured. Please contact the administrator."

### Data/Manual
- "Lab manual is not available. Please contact the administrator to upload the manual."
- "Failed to upload manual. Please try again."

### Generation/Processing
- "Report generation failed. Please try again. If the problem persists, try a different experiment code."
- "The generated report has formatting issues. Please try again."
- "The generated report has validation issues. Please try again."

### System
- "The server is temporarily unavailable. Please try again later."
- "Too many requests. Please wait a moment and try again."
- "Something went wrong. Please try again or contact support if the problem persists."

## Service-by-Service Implementation

### `services/apiService.ts`
- Wraps provider errors with context
- Re-throws with user-friendly message

### `services/geminiService.ts`
- API Key validation with friendly message
- Firestore fetch errors wrapped
- Report generation errors wrapped
- Validation failures with friendly message

### `services/customApiService.ts`
- API URL configuration errors wrapped
- Manual fetch errors wrapped
- Upload/request errors wrapped
- Report generation errors wrapped

### `services/firestoreService.ts`
- Settings update errors wrapped
- Graceful fallback for settings retrieval (returns defaults instead of throwing)

### `services/storageService.ts`
- Storage quota errors with friendly message
- LocalStorage read errors handled gracefully

### `services/authService.ts`
- Already has `getErrorMessage()` for Firebase error codes
- Maps auth errors to user-friendly messages

## Testing Error Scenarios

To verify the error handling:

1. **Network Error**: Disable internet and try to generate a report
   - Expected: "Network connection failed..."

2. **API Key Missing**: Remove API key from environment
   - Expected: "API authentication failed..."

3. **No Manual**: Delete manual from Firestore
   - Expected: "Lab manual is not available..."

4. **JSON Parsing**: Ensure JSON validation is triggered
   - Expected: "The generated report has formatting issues..."

5. **Invalid Code**: Enter non-existent experiment code
   - Expected: Appropriate report generation error

## Development Console

All technical errors are logged to browser console with context:
- Error message and stack trace
- Additional metadata (context, experimentCode, etc.)
- Timestamp for debugging

Access via: Browser DevTools → Console (F12 or Ctrl+Shift+I)

## Best Practices

1. **Always wrap external API errors** using `errorService.wrapError()`
2. **Use descriptive context strings** for debugging: `'Service: Operation'`
3. **Include relevant metadata** in additional info for debugging
4. **Check if error already wrapped** using `error.__context` to avoid double wrapping
5. **Test error scenarios** during development to ensure friendly messages
6. **Never expose error details** in UI text beyond `err.message`
7. **Log technical details** to console for developer inspection

## Future Enhancements

1. Error tracking service integration (Sentry, LogRocket, etc.)
2. User-facing error codes for support reference
3. Retry logic with exponential backoff
4. Error analytics for monitoring system health
5. Localization of error messages for international users
