export function generateRealisticData(experimentCode: string) {
  // Since we don't have hardcoded formulas for every possible experiment in the world,
  // we return a generic linear dataset for fallback purposes.
  // The primary data generation is now handled by the AI.
  
  const data = [];
  for (let i = 1; i <= 5; i++) {
    const x = i * 2;
    const y = x * 1.5 + (Math.random() * 0.5); // Linear with slight noise
    data.push([x, parseFloat(y.toFixed(2))]);
  }
  
  return data;
}