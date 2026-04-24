/**
 * Galvaniy Physics Engine - CLI Bridge for Backend Integration
 * 
 * Usage: node scripts/run-ts-entry.mjs engine/cli-entry.ts <experiment_code>
 * 
 * Outputs JSON to stdout with:
 *   - tables: pre-formatted data tables from autoRun()
 *   - controls: available experiment controls
 *   - procedure: step-by-step procedure
 *   - labConfig: full built-in lab config for the virtual lab UI
 *   - metadata: kit info (code, name, category, tier)
 * 
 * Called by the Python backend to inject deterministic physics data
 * into AI-generated reports, replacing hallucinated measurements.
 */

import { KitRegistry } from './apparatus/KitRegistry.ts';

// Trigger all kit self-registrations
import './index.ts';

export function buildCliOutput(experimentCode: string) {
  const kit = KitRegistry.resolve(experimentCode);

  if (!kit) {
    return {
      available: false,
      experimentCode: experimentCode.toUpperCase(),
      message: `No built-in physics kit for "${experimentCode}". Falling back to AI generation.`,
    };
  }

  // Run headless simulation
  const dataPoints = kit.autoRun();

  // Get kit metadata
  const dataTable = kit.getDataTable();
  const controls = kit.getControls();
  const procedure = kit.getProcedure();

  // Format data points into report-compatible table
  if (dataPoints.length === 0) {
    throw new Error('autoRun() returned zero data points');
  }

  const headers = Object.keys(dataPoints[0]);
  const rows = dataPoints.map(dp =>
    headers.map(h => {
      const v = dp[h];
      return typeof v === 'number' ? v.toFixed(4) : String(v);
    })
  );

  const tables = [{
    title: dataTable.title || `${kit.name} - Observation Table`,
    headers,
    rows,
  }];

  // Output deterministic physics data
  const output = {
    available: true,
    experimentCode: kit.experimentCode,
    name: kit.name,
    category: kit.category,
    tier: 'builtin',
    labConfig: kit.getLabConfig(),
    tables,
    controls: controls.map(c => ({
      id: c.id,
      label: c.label,
      min: c.min,
      max: c.max,
      val: c.value,
      unit: c.unit,
    })),
    procedure: procedure.map(s => s.instruction),
    dataPointCount: dataPoints.length,
  };

  return output;
}
