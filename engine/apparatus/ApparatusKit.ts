/**
 * GalvaniyPhysics — Apparatus Kit Base Class
 *
 * Every experiment kit extends this class. A kit encapsulates:
 * - How to set up the physics world (bodies, constraints)
 * - What instruments are needed
 * - How to render apparatus-specific visuals
 * - How to run the experiment automatically (auto-mode)
 * - Procedure steps for guided mode
 */

import { World } from '../core/World.ts';
import { Vector2 } from '../core/Vector2.ts';
import { CanvasRenderer } from '../renderer/CanvasRenderer.ts';
import { Instrument } from '../measurement/Instrument.ts';
import type {
  LabConfig,
  LabControl,
  ProcedureStep,
  MeasurementReading,
  DataTableConfig,
} from '../core/types.ts';

/** State snapshot for auto-mode data collection. */
export interface DataPoint {
  [key: string]: number | string;
}

export abstract class ApparatusKit {
  /** Unique kit identifier (e.g., 'SimplePendulum'). */
  abstract readonly kitId: string;

  /** Human-readable name. */
  abstract readonly name: string;

  /** Experiment code from manual (e.g., 'A-2'). */
  abstract readonly experimentCode: string;

  /** Physics domain category. */
  abstract readonly category: 'mechanics' | 'heat' | 'optics' | 'electricity' | 'waves' | 'nuclear' | 'renewable' | 'measurement';

  /** The physics world for this experiment. */
  protected world: World;

  /** Instruments attached to this kit. */
  protected instruments: Map<string, Instrument> = new Map();

  /** Collected data points. */
  protected dataPoints: DataPoint[] = [];

  /** Current control values. */
  protected controlValues: Map<string, number> = new Map();

  /** Renderer instance (created during setup by subclasses). */
  protected renderer: CanvasRenderer | null = null;

  constructor() {
    this.world = new World();
  }

  /**
   * Render the current frame to the canvas.
   * Delegates to the CanvasRenderer which calls the kit's draw()
   * via the customDraw callback set during setup().
   * Safe to call before/after simulation for static previews.
   */
  renderFrame(): void {
    if (!this.renderer) return;
    this.renderer.render();
  }

  // ==================== Abstract Methods (Kit-specific) ====================

  /** Initialize the physics world with bodies, constraints, etc. */
  abstract setup(canvas: HTMLCanvasElement): void;

  /** Get the controls (sliders, inputs) for this experiment. */
  abstract getControls(): LabControl[];

  /** Get the data table configuration. */
  abstract getDataTable(): DataTableConfig;

  /** Get procedure steps for guided mode. */
  abstract getProcedure(): ProcedureStep[];

  /** Custom rendering (apparatus-specific visuals). */
  abstract draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void;

  /** Take a measurement at the current state. Returns a data point. */
  abstract measure(): DataPoint;

  /**
   * Run the experiment in auto-mode.
   * Steps through all parameter combinations, collects data, returns complete dataset.
   */
  abstract autoRun(): DataPoint[];

  // ==================== Concrete Methods (Shared) ====================

  /** Get the physics world. */
  getWorld(): World {
    return this.world;
  }

  /** Get all instruments. */
  getInstruments(): Map<string, Instrument> {
    return this.instruments;
  }

  /** Get a specific instrument by ID. */
  getInstrument(id: string): Instrument | undefined {
    return this.instruments.get(id);
  }

  /** Register an instrument. */
  protected addInstrument(instrument: Instrument): void {
    this.instruments.set(instrument.id, instrument);
  }

  /** Update a control value (called when student moves a slider). */
  setControl(controlId: string, value: number): void {
    this.controlValues.set(controlId, value);
    this.onControlChange(controlId, value);
  }

  /** Get current value of a control. */
  getControlValue(controlId: string): number {
    return this.controlValues.get(controlId) ?? 0;
  }

  /** Called when a control value changes. Override to react to slider changes. */
  protected onControlChange(_controlId: string, _value: number): void {
    // Default: no-op. Kits override this.
  }

  /** Add a data point to the collection. */
  recordDataPoint(point: DataPoint): void {
    this.dataPoints.push(point);
  }

  /** Get all collected data points. */
  getDataPoints(): DataPoint[] {
    return [...this.dataPoints];
  }

  /** Clear collected data. */
  clearData(): void {
    this.dataPoints = [];
    for (const inst of this.instruments.values()) {
      inst.clearReadings();
    }
  }

  /** Start the simulation. */
  start(): void {
    this.world.start();
  }

  /** Pause the simulation. */
  pause(): void {
    this.world.pause();
  }

  /** Reset the experiment to initial state. */
  reset(): void {
    this.world.pause();
    this.world.clear();
    this.clearData();
  }

  /** Get the full lab config for this kit. */
  getLabConfig(): LabConfig {
    return {
      experimentCode: this.experimentCode,
      experimentTitle: this.name,
      kitId: this.kitId,
      tier: 'builtin',
      controls: this.getControls(),
      instruments: Array.from(this.instruments.values()).map((inst) => ({
        id: inst.id,
        type: inst.type as any,
        label: inst.label,
        unit: inst.unit,
        precision: inst.precision,
        noise: inst.noise,
      })),
      tables: [this.getDataTable()],
      procedure: this.getProcedure(),
    };
  }

  /** Utility: add Gaussian noise to a value. */
  protected addNoise(value: number, sigma: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return value + z * sigma;
  }

  /** Utility: delay (for auto-mode pacing). */
  protected wait(steps: number): void {
    this.world.stepBy(steps * this.world.timeStep);
  }
}
