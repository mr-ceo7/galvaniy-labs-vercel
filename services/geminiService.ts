import { storageService } from "./storageService";

export const generateLabReport = async (experimentCode: string): Promise<string> => {
  // Get dynamic context from storage
  const context = storageService.getFullContext();

  try {
    const response = await fetch('/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        experimentCode,
        context
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Network error occurred');
    }

    const data = await response.json();

    if (!data.content) {
      throw new Error("Empty response from AI Backend");
    }

    return data.content;
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate report. Please try again.";
    throw new Error(errorMessage);
  }
};