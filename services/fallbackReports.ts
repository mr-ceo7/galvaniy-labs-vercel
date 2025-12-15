import { generateRealisticData } from './dataGenerator';

export function generateFallbackReport(experimentCode: string): string {
  // Generic Fallback when AI fails completely
  const data = generateRealisticData(experimentCode);
  
  return JSON.stringify({
    title: `Report for ${experimentCode} (Fallback)`,
    objectives: ['To conduct the experiment.', 'To analyze the obtained data.'],
    apparatus: ['Standard Laboratory Equipment'],
    theory: 'Manual generation failed. This is a placeholder report.',
    procedure: ['Set up apparatus.', 'Take readings.', 'Analyze data.'],
    tables: [
      {
        title: "Observation Table 1",
        headers: ['Variable X', 'Variable Y'],
        rows: data
      }
    ],
    graphConfig: {
      tableIndex: 0,
      xColumnIndex: 0,
      yColumnIndex: 1,
      xLabel: 'X',
      yLabel: 'Y',
      title: 'Y vs X'
    },
    questions: [],
    calculationScript: "return { slope: 1.5, note: 'Fallback calculation' };",
    analysisTemplate: "The data shows a linear trend with approximate slope {{slope}}.",
    discussion: "Automatic generation encountered an issue. Please verify the Admin Manual contains this experiment code.",
    conclusion: "Inconclusive due to missing context.",
    simulationType: 'general'
  });
}