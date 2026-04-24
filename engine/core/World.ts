/**
 * GalvaniyPhysics - World
 *
 * The physics world manages all bodies, constraints, and simulation stepping.
 * Provides a clean API for apparatus kits to build upon.
 */

import { Vector2 } from './Vector2.ts';
import { Body } from './Body.ts';
import { Constraint } from './Constraint.ts';
import { integrate } from './Integrator.ts';
import type {
  WorldConfig,
  BodyConfig,
  ConstraintConfig,
  IntegrationMethod,
} from './types.ts';

export class World {
  // Configuration
  gravity: Vector2;
  timeStep: number;
  pixelsPerMeter: number;
  integrator: IntegrationMethod;
  bounds: { width: number; height: number };

  // State
  private bodies: Map<string, Body> = new Map();
  private constraints: Map<string, Constraint> = new Map();
  private time: number = 0;
  private frame: number = 0;
  private running: boolean = false;

  // Callbacks
  private onStepCallbacks: Array<(world: World, dt: number) => void> = [];

  constructor(config?: WorldConfig) {
    this.gravity = config?.gravity ?? new Vector2(0, 9.81);
    this.timeStep = config?.timeStep ?? 1 / 60;
    this.pixelsPerMeter = config?.pixelsPerMeter ?? 100;
    this.integrator = config?.integrator ?? 'verlet';
    this.bounds = config?.bounds ?? { width: 800, height: 600 };
  }

  // ==================== Body Management ====================

  /** Add a body to the world. */
  addBody(config: BodyConfig): Body {
    const body = new Body(config);
    this.bodies.set(body.id, body);
    return body;
  }

  /** Remove a body by ID. */
  removeBody(id: string): void {
    this.bodies.delete(id);
  }

  /** Get a body by ID. */
  getBody(id: string): Body | undefined {
    return this.bodies.get(id);
  }

  /** Get all bodies. */
  getBodies(): Body[] {
    return Array.from(this.bodies.values());
  }

  // ==================== Constraint Management ====================

  /** Add a constraint to the world. Body references are resolved immediately. */
  addConstraint(config: ConstraintConfig): Constraint {
    const constraint = new Constraint(config);
    constraint.resolveReferences(this.bodies);
    this.constraints.set(constraint.id, constraint);
    return constraint;
  }

  /** Remove a constraint by ID. */
  removeConstraint(id: string): void {
    this.constraints.delete(id);
  }

  /** Get a constraint by ID. */
  getConstraint(id: string): Constraint | undefined {
    return this.constraints.get(id);
  }

  /** Get all constraints. */
  getConstraints(): Constraint[] {
    return Array.from(this.constraints.values());
  }

  // ==================== Simulation Stepping ====================

  /**
   * Advance the simulation by one fixed timestep.
   * Order of operations:
   *   1. Apply gravity & external forces
   *   2. Solve constraints
   *   3. Integrate positions/velocities
   *   4. Call step callbacks
   */
  step(): void {
    const dt = this.timeStep;

    // 1. Apply constraint forces (springs apply forces, rigid adjust positions)
    for (const constraint of this.constraints.values()) {
      if (constraint.type === 'spring') {
        constraint.solve(dt);
      }
    }

    // 2. Integrate all dynamic bodies
    for (const body of this.bodies.values()) {
      integrate(body, dt, this.gravity, this.integrator);
    }

    // 3. Solve position-based constraints (distance, pin) - iterative
    const constraintIterations = 4;
    for (let i = 0; i < constraintIterations; i++) {
      for (const constraint of this.constraints.values()) {
        if (constraint.type !== 'spring') {
          constraint.solve(dt);
        }
      }
    }

    // 4. Update time
    this.time += dt;
    this.frame++;

    // 5. Fire step callbacks
    for (const cb of this.onStepCallbacks) {
      cb(this, dt);
    }
  }

  /**
   * Step the simulation forward by a specified duration (multiple fixed steps).
   * Useful for auto-mode fast-forwarding.
   */
  stepBy(duration: number): void {
    const steps = Math.ceil(duration / this.timeStep);
    for (let i = 0; i < steps; i++) {
      this.step();
    }
  }

  /** Register a callback to be called after each simulation step. */
  onStep(callback: (world: World, dt: number) => void): void {
    this.onStepCallbacks.push(callback);
  }

  /** Remove a step callback. */
  removeOnStep(callback: (world: World, dt: number) => void): void {
    this.onStepCallbacks = this.onStepCallbacks.filter((cb) => cb !== callback);
  }

  // ==================== Animation Loop ====================

  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;

  /** Start the simulation loop (requestAnimationFrame). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTimestamp);
  }

  /** Pause the simulation loop. */
  pause(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Toggle start/pause. */
  toggle(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  /** Is the simulation currently running? */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Fixed-timestep game loop with accumulator.
   * Decouples physics rate from render rate for deterministic simulation.
   */
  private tick(timestamp: number): void {
    if (!this.running) return;

    const elapsed = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Cap accumulated time to prevent spiral of death
    this.accumulator += Math.min(elapsed, 0.1);

    while (this.accumulator >= this.timeStep) {
      this.step();
      this.accumulator -= this.timeStep;
    }

    this.animationFrameId = requestAnimationFrame((t) => this.tick(t));
  }

  // ==================== Queries ====================

  /** Get current simulation time in seconds. */
  getTime(): number {
    return this.time;
  }

  /** Get current frame count. */
  getFrame(): number {
    return this.frame;
  }

  /** Get interpolation alpha for smooth rendering between fixed steps. */
  getInterpolationAlpha(): number {
    return this.accumulator / this.timeStep;
  }

  /** Get total kinetic energy in the system. */
  getTotalKineticEnergy(): number {
    let total = 0;
    for (const body of this.bodies.values()) {
      total += body.getKineticEnergy();
    }
    return total;
  }

  /** Find all bodies at a world-space point (for picking/interaction). */
  queryPoint(point: Vector2): Body[] {
    const results: Body[] = [];
    for (const body of this.bodies.values()) {
      if (body.containsPoint(point)) {
        results.push(body);
      }
    }
    return results;
  }

  /** Convert world coordinates (meters) to pixel coordinates. */
  worldToPixel(worldPos: Vector2): Vector2 {
    return new Vector2(
      worldPos.x * this.pixelsPerMeter,
      worldPos.y * this.pixelsPerMeter
    );
  }

  /** Convert pixel coordinates to world coordinates (meters). */
  pixelToWorld(pixelPos: Vector2): Vector2 {
    return new Vector2(
      pixelPos.x / this.pixelsPerMeter,
      pixelPos.y / this.pixelsPerMeter
    );
  }

  // ==================== State Management ====================

  /** Reset the simulation to initial state. Removes all bodies and constraints. */
  clear(): void {
    this.pause();
    this.bodies.clear();
    this.constraints.clear();
    this.time = 0;
    this.frame = 0;
    this.accumulator = 0;
  }

  /** Reset time and body states without removing them. */
  resetTime(): void {
    this.time = 0;
    this.frame = 0;
    this.accumulator = 0;
  }
}
