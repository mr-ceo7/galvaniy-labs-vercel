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
  
  // Validate Multi-table structure
  if (!report.tables || !Array.isArray(report.tables) || report.tables.length === 0) {
      errors.push('Missing or empty "tables" array');
  } else {
      report.tables.forEach((table: any, index: number) => {
          if (!table.headers || !Array.isArray(table.headers)) errors.push(`Table ${index + 1} missing headers`);
          if (!table.rows || !Array.isArray(table.rows)) errors.push(`Table ${index + 1} missing rows`);
      });
  }
  
  if (!report.simulationScript) {
      warnings.push('Missing simulationScript - Canvas will be empty');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // 2. Data Consistency Check
  if (report.tables && Array.isArray(report.tables)) {
      report.tables.forEach((table: any, idx: number) => {
          if (table.headers && table.rows) {
              const colCount = table.headers.length;
              const mismatch = table.rows.some((row: any[]) => row.length !== colCount);
              if (mismatch) {
                  warnings.push(`Table ${idx + 1} (${table.title || 'Untitled'}) data columns do not match header count.`);
              }
          }
      });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}