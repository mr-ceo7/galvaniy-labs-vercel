/**
 * GalvaniyPhysics - Shared Type Definitions
 * 
 * Central type definitions for the physics engine, apparatus kits,
 * measurement system, and lab session recording.
 */

import { Vector2 } from './Vector2.ts';

// ============================================================
// Physics Engine Core Types
// ============================================================

/** Supported numerical integration methods. */
export type IntegrationMethod = 'verlet' | 'rk4';

/** Body shape types for collision/rendering. */
export type ShapeType = 'circle' | 'rect' | 'particle' | 'custom';

/** Configuration for creating a physics body. */
export interface BodyConfig {
  id?: string;
  position: Vector2;
  velocity?: Vector2;
  mass?: number;            // kg, default 1
  restitution?: number;     // bounciness 0-1, default 0.5
  friction?: number;        // static friction coefficient
  isStatic?: boolean;       // immovable body
  shape: ShapeType;
  radius?: number;          // for circle shapes
  width?: number;           // for rect shapes
  height?: number;          // for rect shapes
  angle?: number;           // rotation in radians
  angularVelocity?: number;
  damping?: number;         // linear damping 0-1
  label?: string;           // human-readable label for instruments
}

/** Constraint types. */
export type ConstraintType = 'pin' | 'distance' | 'spring' | 'slider';

/** Configuration for creating a constraint. */
export interface ConstraintConfig {
  id?: string;
  type: ConstraintType;
  bodyA: string;            // body ID
  bodyB?: string;           // body ID (or null for world anchor)
  pointA?: Vector2;         // local offset on body A
  pointB?: Vector2;         // local offset on body B (or world point if no bodyB)
  length?: number;          // rest length (distance/spring)
  stiffness?: number;       // 0-1 for spring, 1 for rigid
  damping?: number;         // spring damping
  label?: string;
}

/** World configuration. */
export interface WorldConfig {
  gravity?: Vector2;        // default (0, 9.81) m/s²
  timeStep?: number;        // fixed timestep, default 1/60
  bounds?: { width: number; height: number };
  integrator?: IntegrationMethod;
  pixelsPerMeter?: number;  // scale factor for rendering, default 100
}

// ============================================================
// Measurement System Types
// ============================================================

/** Supported instrument types. */
export type InstrumentType =
  | 'stopwatch'
  | 'ruler'
  | 'protractor'
  | 'thermometer'
  | 'ammeter'
  | 'voltmeter'
  | 'galvanometer'
  | 'oscilloscope'
  | 'pressure_gauge'
  | 'spring_balance'
  | 'vernier_caliper'
  | 'micrometer';

/** Configuration for a virtual instrument. */
export interface InstrumentConfig {
  id: string;
  type: InstrumentType;
  label: string;
  unit: string;
  precision?: number;       // decimal places
  noise?: number;           // Gaussian noise σ
  systematicError?: number; // calibration offset
  range?: { min: number; max: number };
}

/** A single measurement reading. */
export interface MeasurementReading {
  instrumentId: string;
  value: number;
  unit: string;
  timestamp: number;        // simulation time in seconds
  noise: number;            // the noise that was applied
}

// ============================================================
// Apparatus Kit Types
// ============================================================

/** Lab control (slider parameter). */
export interface LabControl {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  unit: string;
}

/** Data table configuration. */
export interface DataTableConfig {
  id: string;
  title: string;
  headers: string[];
  rows: number;             // expected number of data rows
  editableColumns?: number[];
}

/** Procedure step for guided mode. */
export interface ProcedureStep {
  index: number;
  instruction: string;
  highlightComponents?: string[];
  expectedAction?: 'adjust' | 'measure' | 'record' | 'observe';
}

/** Complete apparatus kit configuration returned by AI or built-in. */
export interface LabConfig {
  experimentCode: string;
  experimentTitle: string;
  kitId: string;            // e.g., 'SimplePendulum'
  tier: 'builtin' | 'composable' | 'legacy';

  // Physics setup
  bodies?: BodyConfig[];
  constraints?: ConstraintConfig[];
  worldConfig?: WorldConfig;

  // Interaction
  controls: LabControl[];
  instruments: InstrumentConfig[];
  tables: DataTableConfig[];

  // Guided mode
  procedure: ProcedureStep[];

  // Expected results (for auto-mode validation)
  expectedRelationship?: string;
  acceptableErrorPercent?: number;

  // Legacy fallback (raw Canvas code - only used for tier='legacy')
  legacySimulationScript?: string;
  legacyControls?: LabControl[];
}

// ============================================================
// Kit Definition Types (Virtual Labs 2.0 — Scalable Content)
// ============================================================

/** Physics domain categories. */
export type KitCategory = 'mechanics' | 'heat' | 'optics' | 'electricity' | 'waves' | 'nuclear' | 'renewable' | 'measurement';

/** Difficulty rating for experiments. */
export type KitDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** Apparatus item category. */
export type ApparatusCategory = 'measurement' | 'support' | 'material' | 'electrical' | 'optical' | 'thermal' | 'general';

/** A single piece of lab apparatus shown in the briefing. */
export interface ApparatusItem {
  id: string;
  name: string;
  icon: string;               // Emoji fallback
  image?: string;             // Path to apparatus photo (e.g., '/assets/lab/pendulum/bob.png')
  description: string;        // Short: what it's used for
  learnMore: string;          // Detailed: how to use it
  precision?: string;         // e.g., "±0.01s"
  category: ApparatusCategory;
}

/** A setup step for guided apparatus assembly. */
export interface SetupStep {
  index: number;
  instruction: string;
  why?: string;               // "We clamp it here because..."
  action: 'tap' | 'drag' | 'slide' | 'observe' | 'confirm';
  targetComponent?: string;   // Which apparatus to interact with
  canvasState?: string;       // Description of what canvas shows after this step
  hint?: string;              // Help text if student is stuck
}

/**
 * KitDefinition — Data-driven kit content.
 * Separates educational metadata from physics simulation code.
 * Everything here is JSON-serializable — no executable code.
 */
export interface KitDefinition {
  // Identity
  experimentCode: string;
  experimentTitle: string;
  category: KitCategory;
  difficulty: KitDifficulty;

  // Hero image for the briefing header
  heroImage?: string;         // Path to hero banner (e.g., '/assets/lab/pendulum/hero.png')

  // Lab Briefing (Phase 1)
  objective: string;
  theory: string;             // Markdown-formatted theory
  safetyNotes: string[];

  // Apparatus cards (Phase 1)
  apparatus: ApparatusItem[];

  // Setup (Phase 2)
  setupSteps: SetupStep[];

  // Analysis hints (Phase 4)
  expectedRelationship: string;   // "T² ∝ L (linear)"
  acceptedValues?: Record<string, number>;  // { "g": 9.81 }

  // AI Assistant context
  assistantContext: string;       // Extra context for the AI
  commonQuestions: string[];      // Suggested questions for students
}

/** Kit resolution result. */
export type KitTier = 'builtin' | 'composable' | 'legacy';

// ============================================================
// Lab Session Types
// ============================================================

/** Execution mode for how the experiment was run. */
export type SessionMode = 'manual' | 'auto' | 'report_only';

/** A recorded lab session. */
export interface LabSession {
  id: string;
  userId: string;
  experimentCode: string;
  mode: SessionMode;
  startedAt: string;        // ISO timestamp
  completedAt?: string;
  duration?: number;         // seconds
  measurements: MeasurementReading[];
  tableData: string[][];     // filled table rows
  sessionEvents: SessionEvent[];
  labConfig: LabConfig;
}

/** Individual event in a session (for replay). */
export interface SessionEvent {
  time: number;             // simulation time
  type: 'control_change' | 'measurement' | 'record' | 'step_complete' | 'reset';
  data: Record<string, unknown>;
}

// ============================================================
// Renderer Types
// ============================================================

/** Renderer capabilities for deciding Canvas2D vs WebGL. */
export type RendererType = 'canvas2d' | 'webgl';

/** Render theme colors. */
export interface RenderTheme {
  background: string;
  bodyFill: string;
  bodyStroke: string;
  constraintColor: string;
  labelColor: string;
  gridColor: string;
  accentColor: string;
  highlightColor: string;
  instrumentPanel: string;
  fontSize: number;
  fontFamily: string;
}

/** Drawable component info passed from kit to renderer. */
export interface DrawableComponent {
  id: string;
  type: 'body' | 'constraint' | 'instrument' | 'label' | 'decoration' | 'ray' | 'field';
  position: Vector2;
  angle?: number;
  shape?: ShapeType;
  radius?: number;
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  points?: Vector2[];     // for custom shapes, ray paths, field lines
  opacity?: number;
  metadata?: Record<string, unknown>;
}
