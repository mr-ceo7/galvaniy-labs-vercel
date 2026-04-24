/**
 * GalvaniyPhysics — Kit Registry (3-Tier Resolution)
 *
 * Maps experiment codes to the best available apparatus kit:
 *   Tier 1: Built-in kit (hand-tuned, highest quality)
 *   Tier 2: Composable kit (AI-assembled from primitives) [Phase 2C]
 *   Tier 3: Legacy fallback (raw Canvas eval) [Phase 2C]
 */

import { ApparatusKit } from './ApparatusKit.ts';
import { ComposableKit } from './ComposableKit.ts';
import { LegacySimAdapter } from './LegacySimAdapter.ts';
import type { KitTier, LabConfig } from '../core/types.ts';

/** Registration entry for a kit. */
interface KitRegistration {
  kitId: string;
  experimentCode: string;
  experimentTitle: string;
  category: string;
  tier: KitTier;
  factory: () => ApparatusKit;
}

class KitRegistryImpl {
  private registrations: Map<string, KitRegistration> = new Map();

  private normalizeCode(experimentCode: string): string {
    return experimentCode.toUpperCase().replace(/\s+/g, '');
  }

  private normalizeDashedCode(experimentCode: string): string {
    return this.normalizeCode(experimentCode).replace(/([A-Z])(\d)/, '$1-$2');
  }

  private inferCategory(experimentCode: string): ApparatusKit['category'] | null {
    const normalized = this.normalizeDashedCode(experimentCode);
    const prefix = normalized.split('-')[0];

    switch (prefix) {
      case 'A':
        return 'mechanics';
      case 'B':
        return 'measurement';
      case 'C':
        return 'heat';
      case 'D':
        return 'waves';
      case 'E':
        return 'optics';
      case 'F':
        return 'electricity';
      case 'N':
        return 'nuclear';
      case 'S':
        return 'renewable';
      default:
        return null;
    }
  }

  /**
   * Register a built-in apparatus kit.
   * Called by each kit file on import.
   */
  register(
    experimentCode: string,
    experimentTitle: string,
    category: string,
    factory: () => ApparatusKit
  ): void {
    const kit = factory();
    this.registrations.set(experimentCode.toUpperCase(), {
      kitId: kit.kitId,
      experimentCode,
      experimentTitle,
      category,
      tier: 'builtin',
      factory,
    });
  }

  /**
   * Resolve an experiment code to the best available kit.
   * 
   * Resolution order:
   *   1. Exact match in built-in registry
   *   2. Fuzzy match (e.g., "A2" matches "A-2")
   *   3. Composable kit (TODO: Phase 2C)
   *   4. Legacy fallback (TODO: Phase 2C)
   *   5. null (no kit available)
   */
  resolve(experimentCode: string): ApparatusKit | null {
    const normalized = this.normalizeCode(experimentCode);

    // Tier 1: Exact match
    const exactMatch = this.registrations.get(normalized);
    if (exactMatch) {
      return exactMatch.factory();
    }

    // Tier 1: Fuzzy match (handle "A2" vs "A-2", "C11" vs "C-11")
    const withDash = this.normalizeDashedCode(experimentCode);
    const fuzzyMatch = this.registrations.get(withDash);
    if (fuzzyMatch) {
      return fuzzyMatch.factory();
    }

    // Tier 2: Composable kit (Phase 2C — not yet implemented)
    // TODO: AI assembles kit from physics primitives

    // Tier 3: Legacy fallback (Phase 2C — not yet implemented)
    // TODO: Wrap existing eval-based simulation

    return null;
  }

  /** Resolve built-in first, then degrade to composable or legacy fallback. */
  resolveBestAvailable(experimentCode: string): ApparatusKit | null {
    const builtin = this.resolve(experimentCode);
    if (builtin) {
      return builtin;
    }

    const normalized = this.normalizeDashedCode(experimentCode);
    if (!normalized) {
      return null;
    }

    const category = this.inferCategory(normalized);
    if (category) {
      return new ComposableKit(normalized, category, `Composable ${normalized} Experiment`);
    }

    return new LegacySimAdapter(normalized, `Legacy ${normalized} Experiment`);
  }

  /** Build a kit instance from a normalized LabConfig payload. */
  fromLabConfig(labConfig: Partial<LabConfig> & { category?: string }): ApparatusKit | null {
    const experimentCode = labConfig.experimentCode || '';
    if (!experimentCode) {
      return null;
    }

    if (labConfig.tier === 'builtin') {
      return this.resolve(experimentCode);
    }

    const normalized = this.normalizeDashedCode(experimentCode);
    const category = (labConfig.category as ApparatusKit['category']) || this.inferCategory(normalized) || 'measurement';
    if (labConfig.tier === 'legacy') {
      return new LegacySimAdapter(normalized, labConfig.experimentTitle, category, labConfig);
    }

    return new ComposableKit(normalized, category, labConfig.experimentTitle, labConfig);
  }

  /** Get the best available tier for an experiment code. */
  getBestTier(experimentCode: string): KitTier | null {
    const builtinTier = this.getTier(experimentCode);
    if (builtinTier) {
      return builtinTier;
    }

    const normalized = this.normalizeDashedCode(experimentCode);
    if (!normalized) {
      return null;
    }

    return this.inferCategory(normalized) ? 'composable' : 'legacy';
  }

  /** Get the tier for an experiment code without instantiating the kit. */
  getTier(experimentCode: string): KitTier | null {
    const normalized = this.normalizeCode(experimentCode);
    const withDash = this.normalizeDashedCode(experimentCode);

    if (this.registrations.has(normalized) || this.registrations.has(withDash)) {
      return 'builtin';
    }

    // Future: check composable/legacy tiers
    return null;
  }

  /** List all registered kits. */
  listKits(): KitRegistration[] {
    return Array.from(this.registrations.values());
  }

  /** List kits by category. */
  listByCategory(category: string): KitRegistration[] {
    return this.listKits().filter(
      (k) => k.category.toLowerCase() === category.toLowerCase()
    );
  }

  /** Check if an experiment code has a built-in kit. */
  hasBuiltinKit(experimentCode: string): boolean {
    return this.getTier(experimentCode) === 'builtin';
  }

  /** Get the total number of registered kits. */
  getKitCount(): number {
    return this.registrations.size;
  }
}

/** Singleton kit registry. */
export const KitRegistry = new KitRegistryImpl();
