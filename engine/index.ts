/**
 * GalvaniyPhysics — Engine Entry Point
 *
 * Public API for the Galvaniy Physics Engine.
 * Import everything from here.
 */

// Core
export { Vector2 } from './core/Vector2.ts';
export { Body } from './core/Body.ts';
export { Constraint } from './core/Constraint.ts';
export { World } from './core/World.ts';
export { integrate } from './core/Integrator.ts';

// Types
export type {
  IntegrationMethod,
  ShapeType,
  BodyConfig,
  ConstraintType,
  ConstraintConfig,
  WorldConfig,
  InstrumentType,
  InstrumentConfig,
  MeasurementReading,
  LabControl,
  DataTableConfig,
  ProcedureStep,
  LabConfig,
  KitTier,
  SessionMode,
  LabSession,
  SessionEvent,
  RendererType,
  RenderTheme,
  DrawableComponent,
} from './core/types.ts';

// Measurement
export {
  Instrument,
  Stopwatch,
  Ruler,
  Thermometer,
  Ammeter,
  Voltmeter,
  Protractor,
  PressureGauge,
} from './measurement/Instrument.ts';

// Renderer
export { CanvasRenderer, GALVANIY_THEME } from './renderer/CanvasRenderer.ts';
export { selectRenderer } from './renderer/RenderBridge.ts';

// Apparatus Kit System
export { ApparatusKit } from './apparatus/ApparatusKit.ts';
export { KitRegistry } from './apparatus/KitRegistry.ts';
export { ComposableKit } from './apparatus/ComposableKit.ts';
export { LegacySimAdapter } from './apparatus/LegacySimAdapter.ts';

// Auto mode support
export { AutoRunner } from './autorun/AutoRunner.ts';
export { ProcedureExecutor } from './autorun/ProcedureExecutor.ts';

// Built-in Kits (import triggers self-registration)
// Phase 1A — Flagship 5
import './apparatus/kits/SimplePendulum.ts';
import './apparatus/kits/OhmsLaw.ts';
import './apparatus/kits/CoolingCurve.ts';
import './apparatus/kits/BoylesLaw.ts';
import './apparatus/kits/DecayAnalogue.ts';
// Phase 1B — Full Lab Manual
import './apparatus/kits/MeasurementTechniques.ts';
import './apparatus/kits/EquilibriumOfForces.ts';
import './apparatus/kits/HookesLaw.ts';
import './apparatus/kits/Friction.ts';
import './apparatus/kits/ProjectileMotion.ts';
import './apparatus/kits/CentripetalForce.ts';
import './apparatus/kits/MomentOfInertia.ts';
import './apparatus/kits/Momentum.ts';
import './apparatus/kits/Viscosity.ts';
import './apparatus/kits/SpecificHeat.ts';
import './apparatus/kits/Sonometer.ts';
import './apparatus/kits/SpeedOfSound.ts';
import './apparatus/kits/SnellsLaw.ts';
import './apparatus/kits/FocalLength.ts';
import './apparatus/kits/WheatstoneKit.ts';
