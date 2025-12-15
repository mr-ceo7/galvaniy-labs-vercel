import { EXPERIMENTS } from './experimentDatabase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateReport(report: any, experimentCode: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const exp = EXPERIMENTS[experimentCode];

  // 1. Structure Validation
  if (!report.title) errors.push('Missing title');
  if (!report.objectives || !Array.isArray(report.objectives)) errors.push('Missing objectives array');
  if (!report.tableData || !Array.isArray(report.tableData) || report.tableData.length === 0) errors.push('Missing or empty tableData');
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // 2. Physics Validation (if experiment is known)
  if (exp && report.tableData.length > 0) {
    // Check range of first column (Independent Var)
    const firstVal = report.tableData[0][0];
    const lastVal = report.tableData[report.tableData.length - 1][0];
    
    // Allow some flexibility in AI generation, but prevent wildly wrong units (e.g. cm vs m)
    if (firstVal < exp.validRange.min * 0.1 || lastVal > exp.validRange.max * 10) {
      warnings.push(`Data range seems incorrect for ${exp.validRange.unit}. Expected ${exp.validRange.min}-${exp.validRange.max}.`);
    }

    // Check Calculation Consistency
    if (experimentCode === 'A-2') {
      // Check if g is reasonable from data
      // Approximate slope from first and last point
      try {
        const row1 = report.tableData[0];
        const rowN = report.tableData[report.tableData.length-1];
        
        // Assuming format [L, t, T, T^2] or [L, T, T^2]
        // Usually L is col 0, T^2 is last col or col 3
        const L1 = row1[0];
        const Tsq1 = row1[row1.length-1];
        const L2 = rowN[0];
        const Tsq2 = rowN[rowN.length-1];
        
        if (L2 !== L1) {
            const slope = (Tsq2 - Tsq1) / (L2 - L1);
            const calcG = (4 * Math.PI * Math.PI) / slope;
            
            if (Math.abs(calcG - 9.81) > 2.0) {
               warnings.push(`Calculated g (${calcG.toFixed(2)}) from data deviates significantly from 9.81.`);
            }
        }
      } catch (e) {
        warnings.push("Could not verify calculation consistency.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}