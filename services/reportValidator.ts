export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateReport(report: any, experimentCode: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Structure Validation
  if (!report.title) errors.push('Missing title');
  if (!report.objectives || !Array.isArray(report.objectives)) errors.push('Missing objectives array');
  if (!report.apparatus || !Array.isArray(report.apparatus)) errors.push('Missing apparatus array');
  if (!report.procedure || !Array.isArray(report.procedure)) errors.push('Missing procedure array');
  if (!report.tableData || !Array.isArray(report.tableData) || report.tableData.length === 0) errors.push('Missing or empty tableData');
  if (!report.simulationType) warnings.push('Missing simulationType, defaulting to generic');
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // 2. Data Consistency Check
  // Ensure all rows have same number of columns as headers
  if (report.tableHeaders && Array.isArray(report.tableHeaders)) {
      const colCount = report.tableHeaders.length;
      const mismatch = report.tableData.some((row: any[]) => row.length !== colCount);
      if (mismatch) {
          warnings.push("Table data columns do not match header count.");
      }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}