#!/usr/bin/env node

import { buildCliOutput } from './cli.ts';

const experimentCode = process.argv[2];

if (!experimentCode) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/run-ts-entry.mjs engine/cli-entry.ts <EXPERIMENT_CODE>' }));
  process.exit(1);
}

try {
  console.log(JSON.stringify(buildCliOutput(experimentCode)));
} catch (err: any) {
  console.error(JSON.stringify({
    available: false,
    experimentCode: experimentCode.toUpperCase(),
    error: err.message || 'Unknown error during autoRun()',
  }));
  process.exit(1);
}
