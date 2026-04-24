/**
 * GalvaniyPhysics — Kit Registry (3-Tier Resolution)
 *
 * Maps experiment codes to the best available apparatus kit:
 *   Tier 1: Built-in kit (hand-tuned, highest quality)
 *   Tier 2: Composable kit (AI-assembled from primitives) [Phase 2C]
 *   Tier 3: Legacy fallback (raw Canvas eval) [Phase 2C]
 */

import { ApparatusKit } from './ApparatusKit.ts';
import type { KitTier } from '../core/types.ts';

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
    const normalized = experimentCode.toUpperCase().replace(/\s+/g, '');

    // Tier 1: Exact match
    const exactMatch = this.registrations.get(normalized);
    if (exactMatch) {
      return exactMatch.factory();
    }

    // Tier 1: Fuzzy match (handle "A2" vs "A-2", "C11" vs "C-11")
    const withDash = normalized.replace(/([A-Z])(\d)/, '$1-$2');
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

  /** Get the tier for an experiment code without instantiating the kit. */
  getTier(experimentCode: string): KitTier | null {
    const normalized = experimentCode.toUpperCase().replace(/\s+/g, '');
    const withDash = normalized.replace(/([A-Z])(\d)/, '$1-$2');

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
