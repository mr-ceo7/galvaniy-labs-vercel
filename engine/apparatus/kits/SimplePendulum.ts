/**
 * GalvaniyPhysics - Simple Pendulum Kit (Experiment A-2)
 *
 * UoN Physics Lab Manual: "Acceleration Due to Gravity - The Simple Pendulum"
 *
 * Physics:
 *   T = 2π√(L/g) for small angles (<10°)
 *   Measure period T for different lengths L, plot T² vs L,
 *   slope = 4π²/g → determine g.
 *
 * This kit uses the custom physics engine (Verlet integration) for the pendulum
 * rather than Matter.js, since we need precise SHM behavior and the Verlet
 * integrator preserves energy perfectly for oscillatory systems.
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Stopwatch, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class SimplePendulumKit extends ApparatusKit {
  readonly kitId = 'SimplePendulum';
  readonly name = 'Simple Pendulum - Acceleration Due to Gravity';
  readonly experimentCode = 'A-2';
  readonly category = 'mechanics' as const;

  // Pendulum state (computed directly, not through rigid body system)
  private pendulumLength: number = 0.5; // meters
  private angle: number = 0.15;          // radians (~8.6°, small angle)
  private angularVelocity: number = 0;
  private pivotPosition: Vector2 = new Vector2(4, 1); // world coords (meters)
  private bobRadius: number = 0.08;      // meters
  private bobMass: number = 0.05;        // kg (50g bob)
  private g: number = 9.81;              // m/s²

  // Timing state
  private oscillationCount: number = 0;
  private lastAngleSign: number = 1;
  private totalOscillations: number = 10; // time 10 oscillations for precision
  private isTiming: boolean = false;
  private timingStartTime: number = 0;

  // Instruments
  private stopwatch: Stopwatch;
  private ruler: Ruler;

  // Renderer


  constructor() {
    super();
    // Initialize instruments so autoRun works without canvas
    this.stopwatch = new Stopwatch({ noise: 0.12 });
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.stopwatch);
    this.addInstrument(this.ruler);
  }

  setup(canvas: HTMLCanvasElement): void {
    // Configure world
    this.world.gravity = new Vector2(0, this.g);
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };

    // Initial control values
    this.controlValues.set('length', this.pendulumLength);
    this.controlValues.set('amplitude', this.angle * (180 / Math.PI));
    this.controlValues.set('numOscillations', this.totalOscillations);

    // Renderer
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));

    // Physics step callback
    this.world.onStep((w) => {
      this.updatePendulum(this.world.timeStep, w.getTime());
    });
  }

  /** Step the pendulum physics using exact SHM equation (not small-angle approx). */
  private updatePendulum(dt: number, simTime?: number): void {
    // Exact equation of motion: θ'' = -(g/L)sin(θ)
    const angularAcceleration = -(this.g / this.pendulumLength) * Math.sin(this.angle);

    // Velocity Verlet for angular motion
    this.angle += this.angularVelocity * dt + 0.5 * angularAcceleration * dt * dt;
    const newAngularAcceleration = -(this.g / this.pendulumLength) * Math.sin(this.angle);
    this.angularVelocity += 0.5 * (angularAcceleration + newAngularAcceleration) * dt;

    // Light damping (air resistance)
    this.angularVelocity *= 0.9999;

    // Count oscillations (zero-crossing detection)
    const currentSign = Math.sign(this.angle);
    if (currentSign !== this.lastAngleSign && currentSign > 0) {
      this.oscillationCount++;

      // Auto-timing: stop after target oscillations
      if (this.isTiming && this.oscillationCount >= this.totalOscillations) {
        this.stopwatch.stop(simTime ?? this.world.getTime());
        this.isTiming = false;
      }
    }
    this.lastAngleSign = currentSign;
  }

  /** Get bob position in world coordinates. */
  private getBobPosition(): Vector2 {
    return new Vector2(
      this.pivotPosition.x + this.pendulumLength * Math.sin(this.angle),
      this.pivotPosition.y + this.pendulumLength * Math.cos(this.angle)
    );
  }

  /** Start timing oscillations. */
  startTiming(): void {
    this.oscillationCount = 0;
    this.isTiming = true;
    this.stopwatch.reset();
    this.stopwatch.start(this.world.getTime());
    this.timingStartTime = this.world.getTime();
  }

  getControls(): LabControl[] {
    return [
      {
        id: 'length',
        label: 'Pendulum Length (L)',
        min: 0.2,
        max: 1.2,
        value: this.pendulumLength,
        step: 0.05,
        unit: 'm',
      },
      {
        id: 'amplitude',
        label: 'Initial Amplitude (θ)',
        min: 2,
        max: 15,
        value: this.angle * (180 / Math.PI),
        step: 1,
        unit: '°',
      },
      {
        id: 'numOscillations',
        label: 'Oscillations to Time',
        min: 5,
        max: 20,
        value: this.totalOscillations,
        step: 1,
        unit: '',
      },
    ];
  }

  protected onControlChange(controlId: string, value: number): void {
    switch (controlId) {
      case 'length':
        this.pendulumLength = value;
        this.ruler.setMeasuredValue(value);
        // Reset pendulum motion
        this.angle = (this.controlValues.get('amplitude') ?? 8) * (Math.PI / 180);
        this.angularVelocity = 0;
        break;
      case 'amplitude':
        this.angle = value * (Math.PI / 180);
        this.angularVelocity = 0;
        break;
      case 'numOscillations':
        this.totalOscillations = value;
        break;
    }
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'pendulum_data',
      title: 'Period vs Length Data',
      headers: ['L (m)', 'ΔL (m)', 't₁₀ (s)', 'T (s)', 'T² (s²)'],
      rows: 8,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      {
        index: 0,
        instruction: 'Set the pendulum length to 0.30 m using the ruler.',
        highlightComponents: ['ruler', 'length_control'],
        expectedAction: 'adjust',
      },
      {
        index: 1,
        instruction: 'Displace the bob by a small angle (<10°) and release.',
        highlightComponents: ['bob'],
        expectedAction: 'adjust',
      },
      {
        index: 2,
        instruction: 'Start the stopwatch and time 10 complete oscillations.',
        highlightComponents: ['stopwatch'],
        expectedAction: 'measure',
      },
      {
        index: 3,
        instruction: 'Record the time for 10 oscillations in the data table.',
        expectedAction: 'record',
      },
      {
        index: 4,
        instruction: 'Repeat for lengths: 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00 m.',
        expectedAction: 'adjust',
      },
      {
        index: 5,
        instruction: 'Calculate T for each length: T = t₁₀ / 10.',
        expectedAction: 'record',
      },
      {
        index: 6,
        instruction: 'Plot T² vs L. The slope = 4π²/g.',
        expectedAction: 'observe',
      },
      {
        index: 7,
        instruction: 'Determine g from the graph slope.',
        expectedAction: 'record',
      },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const ppm = this.world.pixelsPerMeter;
    const pivot = this.pivotPosition;
    const bob = this.getBobPosition();

    // --- Support stand ---
    const standTop = renderer.worldToCanvas(new Vector2(pivot.x, pivot.y - 0.15));
    const standBase = renderer.worldToCanvas(new Vector2(pivot.x, pivot.y - 0.15));

    // Vertical pole
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const poleTop = renderer.worldToCanvas(new Vector2(pivot.x, 0.2));
    const poleBottom = renderer.worldToCanvas(new Vector2(pivot.x, pivot.y));
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(poleBottom.x, poleBottom.y);
    ctx.stroke();

    // Base
    ctx.lineWidth = 8;
    ctx.beginPath();
    const baseLeft = renderer.worldToCanvas(new Vector2(pivot.x - 0.5, 0.2));
    const baseRight = renderer.worldToCanvas(new Vector2(pivot.x + 0.5, 0.2));
    ctx.moveTo(baseLeft.x, baseLeft.y);
    ctx.lineTo(baseRight.x, baseRight.y);
    ctx.stroke();

    // --- String ---
    const pivotPx = renderer.worldToCanvas(pivot);
    const bobPx = renderer.worldToCanvas(bob);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotPx.x, pivotPx.y);
    ctx.lineTo(bobPx.x, bobPx.y);
    ctx.stroke();

    // --- Pivot point ---
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(pivotPx.x, pivotPx.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // --- Bob (with glow) ---
    const bobR = this.bobRadius * ppm;

    // Glow
    const glow = ctx.createRadialGradient(bobPx.x, bobPx.y, bobR * 0.3, bobPx.x, bobPx.y, bobR * 2);
    glow.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bobPx.x, bobPx.y, bobR * 2, 0, Math.PI * 2);
    ctx.fill();

    // Bob body
    const bobGradient = ctx.createRadialGradient(
      bobPx.x - bobR * 0.3, bobPx.y - bobR * 0.3, bobR * 0.1,
      bobPx.x, bobPx.y, bobR
    );
    bobGradient.addColorStop(0, '#60a5fa');
    bobGradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = bobGradient;
    ctx.beginPath();
    ctx.arc(bobPx.x, bobPx.y, bobR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bobPx.x, bobPx.y, bobR, 0, Math.PI * 2);
    ctx.stroke();

    // --- Angle arc ---
    if (Math.abs(this.angle) > 0.01) {
      const arcRadius = 0.15 * ppm;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 1.5;
      const startAngle = Math.PI / 2; // vertical down
      const endAngle = Math.PI / 2 + this.angle;
      ctx.beginPath();
      ctx.arc(pivotPx.x, pivotPx.y, arcRadius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();
    }

    // --- Length label ---
    const midPoint = pivot.lerp(bob, 0.5);
    const labelOffset = new Vector2(0.15, 0);
    renderer.drawText(
      `L = ${this.pendulumLength.toFixed(2)} m`,
      midPoint.add(labelOffset),
      { color: '#22d3ee', fontSize: 13, bold: true }
    );

    // --- Equilibrium line (dashed) ---
    renderer.drawLine(
      pivot,
      new Vector2(pivot.x, pivot.y + this.pendulumLength + 0.1),
      { color: 'rgba(148, 163, 184, 0.3)', width: 1, dashed: true }
    );

    // --- HUD: timing info ---
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    this.roundRect(ctx, 10, 10, 220, 95, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 10, 10, 220, 95, 10);
    ctx.stroke();

    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('SIMPLE PENDULUM', 20, 30);

    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';

    const elapsed = this.stopwatch.getElapsed();
    ctx.fillText(`⏱ Time: ${Math.max(0, elapsed).toFixed(2)} s`, 20, 50);
    ctx.fillText(`🔄 Oscillations: ${this.oscillationCount} / ${this.totalOscillations}`, 20, 68);

    const theoreticalT = 2 * Math.PI * Math.sqrt(this.pendulumLength / this.g);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(`T(theory) = ${theoreticalT.toFixed(4)} s`, 20, 90);
  }

  measure(): DataPoint {
    this.ruler.setMeasuredValue(this.pendulumLength);
    const lengthReading = this.ruler.read(this.world.getTime());
    const elapsed = this.stopwatch.getElapsed();
    const period = elapsed / this.totalOscillations;

    return {
      'L': lengthReading.value,
      'ΔL': 0.001, // ruler precision
      't_n': Number(elapsed.toFixed(2)),
      'T': Number(period.toFixed(4)),
      'T²': Number((period * period).toFixed(4)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const lengths = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
    const amplitude = 8 * (Math.PI / 180); // 8 degrees

    for (const L of lengths) {
      this.pendulumLength = L;
      this.angle = amplitude;
      this.angularVelocity = 0;
      this.oscillationCount = 0;
      this.lastAngleSign = 1;

      // Track time manually for headless auto-mode
      const dt = 1 / 120; // 120 Hz physics for precision
      let simTime = 0;

      // Run stopwatch
      this.isTiming = true;
      this.stopwatch.reset();
      this.stopwatch.start(0);

      // Step until we've counted enough oscillations
      let maxSteps = 50000; // enough for longest pendulum
      while (this.isTiming && maxSteps > 0) {
        simTime += dt;
        this.updatePendulum(dt, simTime);
        maxSteps--;
      }

      // Measure
      const elapsed = this.stopwatch.getElapsed();
      const period = elapsed / this.totalOscillations;

      this.ruler.setMeasuredValue(L);
      const lengthReading = this.ruler.read(simTime);

      data.push({
        'L': lengthReading.value,
        'ΔL': 0.001,
        't_n': Number(elapsed.toFixed(2)),
        'T': Number(period.toFixed(4)),
        'T²': Number((period * period).toFixed(4)),
      });
    }

    return data;
  }

  /** Render the simulation. Call in animation loop. */
  renderFrame(): void {
    if (this.renderer) {
      this.renderer.render();
    }
  }

  /** Get the renderer for external use. */
  getRenderer(): CanvasRenderer | null {
    return this.renderer;
  }

  /** Helper for rounded rectangles. */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// Register this kit with the global registry
KitRegistry.register('A-2', 'Simple Pendulum - Acceleration Due to Gravity', 'mechanics', () => new SimplePendulumKit());
