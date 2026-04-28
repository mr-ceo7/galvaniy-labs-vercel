/**
 * Kit Definitions Index
 * Central registry for all kit educational content.
 * Maps experiment codes to their KitDefinition.
 */
import type { KitDefinition } from '../../core/types.ts';
import { SimplePendulumDef } from './SimplePendulum.def.ts';
import { OhmsLawDef } from './OhmsLaw.def.ts';
import { CoolingCurveDef } from './CoolingCurve.def.ts';
import { BoylesLawDef } from './BoylesLaw.def.ts';
import { DecayAnalogueDef } from './DecayAnalogue.def.ts';

/** All registered kit definitions keyed by experiment code. */
const definitions = new Map<string, KitDefinition>();

function register(def: KitDefinition): void {
  definitions.set(def.experimentCode.toUpperCase(), def);
}

// Register flagship kits
register(SimplePendulumDef);
register(OhmsLawDef);
register(CoolingCurveDef);
register(BoylesLawDef);
register(DecayAnalogueDef);

/**
 * Look up a kit definition by experiment code.
 * Returns null if no definition exists (kit will still work, just no briefing).
 */
export function getKitDefinition(experimentCode: string): KitDefinition | null {
  const normalized = experimentCode.toUpperCase().replace(/\s+/g, '');
  // Try exact match first, then with dash
  return definitions.get(normalized)
    ?? definitions.get(normalized.replace(/([A-Z])(\d)/, '$1-$2'))
    ?? null;
}

/** Check if a definition exists for an experiment code. */
export function hasKitDefinition(experimentCode: string): boolean {
  return getKitDefinition(experimentCode) !== null;
}

/** List all available kit definitions. */
export function listKitDefinitions(): KitDefinition[] {
  return Array.from(definitions.values());
}

// Re-export individual definitions for direct imports
export { SimplePendulumDef, OhmsLawDef, CoolingCurveDef, BoylesLawDef, DecayAnalogueDef };
