// This file now serves only as a type definition source.
// Hardcoded experiments have been removed to allow the app to scale with any Admin-uploaded manual (Physics, Chem, Bio, etc).

export interface ExperimentDef {
  name: string;
  theory: string;
  formula?: (val: number) => number; 
  validRange?: { min: number; max: number; unit: string; step?: number };
  independentVarLabel?: string; 
  dependentVarLabel?: string;   
  calculatedVarLabel?: string; 
  expectedResult?: { label: string; value: number; tolerance: number; unit: string };
  dataPoints?: number;
  measurementError?: number; 
  simulationType?: string;
  calculationScript?: string; 
  objectives?: string[];
  apparatus?: string[];
}

// Empty dictionary - The Source of Truth is now the Vector Context (Manual) provided by Admin.
export const EXPERIMENTS: Record<string, ExperimentDef> = {};
