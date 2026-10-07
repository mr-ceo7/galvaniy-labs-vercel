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
import { SpriteRenderer } from '../../renderer/SpriteRenderer.ts';
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

  // Sprite renderer for photorealistic apparatus
  private sprites: SpriteRenderer = new SpriteRenderer();

  // Renderer


  constructor() {
    super();
    // Initialize instruments so autoRun works without canvas
    this.stopwatch = new Stopwatch({ noise: 0.12 });
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.stopwatch);
    this.addInstrument(this.ruler);

    // Preload apparatus sprites early (while on briefing or loading screen)
    this.sprites.loadSprite({
      id: 'retort_stand', src: '/assets/lab/sprites/pendulum/retort_stand.webp',
      widthMeters: 1.8, anchor: { x: 0.5, y: 0.08 },
    });
    this.sprites.loadSprite({
      id: 'brass_bob', src: '/assets/lab/sprites/pendulum/brass_bob.webp',
      widthMeters: 0.4, anchor: { x: 0.5, y: 0.3 },
    });
    this.sprites.loadSprite({
      id: 'meter_ruler', src: '/assets/lab/sprites/pendulum/meter_ruler.webp',
      widthMeters: 0.38, anchor: { x: 0.5, y: 0.05 },
    });
    this.sprites.loadSprite({
      id: 'stopwatch', src: '/assets/lab/sprites/pendulum/stopwatch.webp',
      widthMeters: 0.55, anchor: { x: 0.5, y: 0.5 },
    });
  }

  private placedComponents = new Set<string>();
  private isBobFalling = false;
  private fallingBobPosition = new Vector2(0, 0);
  private fallingBobVelocity = new Vector2(0, 0);

  // Dragging state
  private rulerPos = new Vector2(0, 0);
  private stopwatchPos = new Vector2(0, 0);
  private draggedComponent: string | null = null;
  private dragOffset = new Vector2(0, 0);
  private cssH = 800; // Updated in setup

  setup(canvas: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    this.cssH = canvas.height / dpr;
    const isMobile = cssW < 600;
    const ppm = isMobile ? (cssW / 3.4) : (cssW / 8);

    this.world.gravity = new Vector2(0, this.g);
    this.world.pixelsPerMeter = ppm;
    this.world.bounds = { width: cssW, height: this.cssH };

    this.pivotPosition = new Vector2(cssW / ppm / 2, isMobile ? (this.cssH / ppm * 0.28) : (this.cssH / ppm * 0.18));

    this.controlValues.set('length', this.pendulumLength);
    this.controlValues.set('amplitude', this.angle * (180 / Math.PI));
    this.controlValues.set('numOscillations', this.totalOscillations);

    this.sprites.loadSprite({
      id: 'retort_stand', src: '/assets/lab/sprites/pendulum/retort_stand.webp',
      widthMeters: isMobile ? 1.8 : 2.0, anchor: { x: 0.5, y: 0.08 },
    });
    this.sprites.loadSprite({
      id: 'brass_bob', src: '/assets/lab/sprites/pendulum/brass_bob.webp',
      widthMeters: isMobile ? 0.4 : 0.5, anchor: { x: 0.5, y: 0.3 },
    });
    this.sprites.loadSprite({
      id: 'meter_ruler', src: '/assets/lab/sprites/pendulum/meter_ruler.webp',
      widthMeters: isMobile ? 0.38 : 0.45, anchor: { x: 0.5, y: 0.05 },
    });
    this.sprites.loadSprite({
      id: 'stopwatch', src: '/assets/lab/sprites/pendulum/stopwatch.webp',
      widthMeters: isMobile ? 0.55 : 0.7, anchor: { x: 0.5, y: 0.5 },
    });

    this.renderer = new CanvasRenderer(canvas, { background: 'transparent' });
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));

    this.sprites.setOnSpriteLoaded(() => {
      this.renderFrame();
    });

    this.world.onStep((w) => {
      this.updatePendulum(this.world.timeStep, w.getTime());
    });

    // Pre-place core apparatus components so the lab is immediately ready for experimentation
    this.addApparatusComponent('retort_stand', this.pivotPosition);
    this.addApparatusComponent('string', this.pivotPosition);
    this.addApparatusComponent('bob', this.getBobPosition());
    this.addApparatusComponent('meter_ruler', new Vector2(this.pivotPosition.x - (isMobile ? 0.38 : 0.45), this.pivotPosition.y));
    this.addApparatusComponent('stopwatch', new Vector2(Math.max(0.5, (cssW / ppm) - (isMobile ? 0.55 : 0.8)), Math.max(0.5, (this.cssH / ppm) * (isMobile ? 0.68 : 0.75))));
  }

  override getPlacedComponents(): string[] {
    return Array.from(this.placedComponents);
  }

  private updatePendulum(dt: number, simTime?: number): void {
    if (this.isBobFalling) {
      this.fallingBobVelocity = this.fallingBobVelocity.add(new Vector2(0, this.g * dt));
      this.fallingBobPosition = this.fallingBobPosition.add(new Vector2(0, this.fallingBobVelocity.y * dt));
      const groundY = this.world.bounds ? this.world.bounds.height / this.world.pixelsPerMeter : 10;
      if (this.fallingBobPosition.y > groundY - this.bobRadius) {
        this.fallingBobPosition = new Vector2(this.fallingBobPosition.x, groundY - this.bobRadius);
        this.fallingBobVelocity = new Vector2(this.fallingBobVelocity.x, 0);
      }
      return;
    }

    if (!this.placedComponents.has('bob') || !this.placedComponents.has('string') || !this.placedComponents.has('retort_stand')) {
      return; // Pendulum not fully assembled
    }

    // Exact equation of motion: θ'' = -(g/L)sin(θ)
    const angularAcceleration = -(this.g / this.pendulumLength) * Math.sin(this.angle);

    this.angle += this.angularVelocity * dt + 0.5 * angularAcceleration * dt * dt;
    const newAngularAcceleration = -(this.g / this.pendulumLength) * Math.sin(this.angle);
    this.angularVelocity += 0.5 * (angularAcceleration + newAngularAcceleration) * dt;

    this.angularVelocity *= 0.9999;

    const currentSign = Math.sign(this.angle);
    if (currentSign !== this.lastAngleSign && currentSign > 0) {
      this.oscillationCount++;

      if (this.isTiming && this.oscillationCount >= this.totalOscillations) {
        this.stopwatch.stop(simTime ?? this.world.getTime());
        this.isTiming = false;
      }
    }
    this.lastAngleSign = currentSign;
  }

  private getBobPosition(): Vector2 {
    if (this.isBobFalling || !this.placedComponents.has('retort_stand') || !this.placedComponents.has('string')) {
      return this.fallingBobPosition;
    }
    return new Vector2(
      this.pivotPosition.x + this.pendulumLength * Math.sin(this.angle),
      this.pivotPosition.y + this.pendulumLength * Math.cos(this.angle)
    );
  }

  startTiming(): void {
    if (!this.placedComponents.has('stopwatch')) return;
    this.oscillationCount = 0;
    this.isTiming = true;
    this.stopwatch.reset();
    this.stopwatch.start(this.world.getTime());
    this.timingStartTime = this.world.getTime();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    if (this.placedComponents.has(id)) return false;

    this.placedComponents.add(id);

    if (id === 'bob') {
      if (!this.placedComponents.has('retort_stand') || !this.placedComponents.has('string')) {
        this.isBobFalling = true;
        this.fallingBobPosition = position.clone();
        this.fallingBobVelocity = new Vector2(0, 0);
      } else {
        this.isBobFalling = false;
      }
    } else if (id === 'retort_stand' || id === 'string') {
      // If we placed the missing stand/string and the bob was already placed, attach it
      if (this.placedComponents.has('bob') && this.placedComponents.has('retort_stand') && this.placedComponents.has('string')) {
        this.isBobFalling = false;
      }
    }

    // Spawn instruments when placed
    if (id === 'meter_ruler') {
      this.rulerPos = position.clone();
      this.addInstrument(this.ruler);
    }
    if (id === 'stopwatch') {
      this.stopwatchPos = position.clone();
      this.addInstrument(this.stopwatch);
    }

    return true;
  }

  onPointerDown(x: number, y: number): void {
    const ppm = this.world.pixelsPerMeter;
    const worldX = x / ppm;
    const worldY = (this.cssH - y) / ppm;
    const clickPos = new Vector2(worldX, worldY);

    if (this.placedComponents.has('stopwatch')) {
      // Stopwatch is ~0.7m wide. Anchor is 0.5, 0.5
      if (
        clickPos.x >= this.stopwatchPos.x - 0.35 &&
        clickPos.x <= this.stopwatchPos.x + 0.35 &&
        clickPos.y >= this.stopwatchPos.y - 0.35 &&
        clickPos.y <= this.stopwatchPos.y + 0.35
      ) {
        this.draggedComponent = 'stopwatch';
        this.dragOffset = new Vector2(this.stopwatchPos.x - worldX, this.stopwatchPos.y - worldY);
        return;
      }
    }

    if (this.placedComponents.has('meter_ruler')) {
      // Ruler is 0.35 wide, 2.8 high. Anchor is 0.5, 0.0 (bottom center)
      if (
        clickPos.x >= this.rulerPos.x - 0.175 &&
        clickPos.x <= this.rulerPos.x + 0.175 &&
        clickPos.y >= this.rulerPos.y &&
        clickPos.y <= this.rulerPos.y + 2.8
      ) {
        this.draggedComponent = 'meter_ruler';
        this.dragOffset = new Vector2(this.rulerPos.x - worldX, this.rulerPos.y - worldY);
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.draggedComponent) return;

    const ppm = this.world.pixelsPerMeter;
    const worldX = x / ppm;
    const worldY = (this.cssH - y) / ppm;

    if (this.draggedComponent === 'stopwatch') {
      this.stopwatchPos = new Vector2(worldX + this.dragOffset.x, worldY + this.dragOffset.y);
    } else if (this.draggedComponent === 'meter_ruler') {
      this.rulerPos = new Vector2(worldX + this.dragOffset.x, worldY + this.dragOffset.y);
    }
  }

  onPointerUp(): void {
    this.draggedComponent = null;
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
    const pivotPx = renderer.worldToCanvas(pivot);
    const bobPx = renderer.worldToCanvas(bob);

    // Pulsing highlight intensity (0.3 → 0.8 → 0.3 over ~1.5s)
    const highlightAlpha = 0.3 + 0.5 * Math.abs(Math.sin(Date.now() / 750 * Math.PI));

    // ── Retort stand sprite (static, at pivot) ──
    if (this.placedComponents.has('retort_stand')) {
      if (this.sprites.isLoaded('retort_stand')) {
        const standPos = renderer.worldToCanvas(pivot);
        this.sprites.drawSpriteWithShadow(ctx, 'retort_stand', standPos.x, standPos.y, ppm, 0, 1, 6);
        if (this.highlightedComponents.has('retort_stand')) {
          this.drawHighlightGlow(ctx, standPos.x, standPos.y + 40, 90, 200, highlightAlpha);
        }
      } else {
        // Fallback: geometric stand
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const poleTop = renderer.worldToCanvas(new Vector2(pivot.x, pivot.y - 0.1));
        const poleBottom = renderer.worldToCanvas(new Vector2(pivot.x, pivot.y + 1.8));
        ctx.moveTo(poleTop.x, poleTop.y);
        ctx.lineTo(poleBottom.x, poleBottom.y);
        ctx.stroke();
        ctx.lineWidth = 8;
        ctx.beginPath();
        const baseLeft = renderer.worldToCanvas(new Vector2(pivot.x - 0.4, pivot.y + 1.8));
        const baseRight = renderer.worldToCanvas(new Vector2(pivot.x + 0.4, pivot.y + 1.8));
        ctx.moveTo(baseLeft.x, baseLeft.y);
        ctx.lineTo(baseRight.x, baseRight.y);
        ctx.stroke();
      }
    }

    // ── String (thin line from pivot to bob) ──
    if (this.placedComponents.has('string') && !this.isBobFalling) {
      const stringHighlighted = this.highlightedComponents.has('string');
      ctx.strokeStyle = stringHighlighted
        ? `rgba(0, 255, 255, ${highlightAlpha})`
        : 'rgba(180, 180, 180, 0.6)';
      ctx.lineWidth = stringHighlighted ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(pivotPx.x, pivotPx.y);
      ctx.lineTo(bobPx.x, bobPx.y);
      ctx.stroke();
    }

    // ── Brass bob sprite (at physics-driven position) ──
    if (this.placedComponents.has('bob')) {
      if (this.sprites.isLoaded('brass_bob')) {
        this.sprites.drawSpriteWithShadow(ctx, 'brass_bob', bobPx.x, bobPx.y, ppm, 0, 1, 5);
        if (this.highlightedComponents.has('bob')) {
          this.drawHighlightGlow(ctx, bobPx.x, bobPx.y, 30, 30, highlightAlpha);
        }
      } else {
        // Fallback: geometric bob
        const bobR = this.bobRadius * ppm;
        const bobGradient = ctx.createRadialGradient(
          bobPx.x - bobR * 0.3, bobPx.y - bobR * 0.3, bobR * 0.1,
          bobPx.x, bobPx.y, bobR
        );
        bobGradient.addColorStop(0, '#d4a853');
        bobGradient.addColorStop(1, '#b8860b');
        ctx.fillStyle = bobGradient;
        ctx.beginPath();
        ctx.arc(bobPx.x, bobPx.y, bobR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Meter ruler sprite (draggable on the bench) ──
    if (this.placedComponents.has('meter_ruler')) {
      if (this.sprites.isLoaded('meter_ruler')) {
        const rulerPx = renderer.worldToCanvas(this.rulerPos);
        this.sprites.drawSpriteWithShadow(ctx, 'meter_ruler', rulerPx.x, rulerPx.y, ppm, 0, 1, 4);
        if (this.highlightedComponents.has('meter_ruler')) {
          this.drawHighlightGlow(ctx, rulerPx.x, rulerPx.y + 70, 25, 150, highlightAlpha);
        }
      }
    }

    // ── Stopwatch sprite (draggable on the bench) ──
    if (this.placedComponents.has('stopwatch')) {
      if (this.sprites.isLoaded('stopwatch')) {
        const swPx = renderer.worldToCanvas(this.stopwatchPos);
        this.sprites.drawSpriteWithShadow(ctx, 'stopwatch', swPx.x, swPx.y, ppm, 0, 1, 5);
        if (this.highlightedComponents.has('stopwatch')) {
          this.drawHighlightGlow(ctx, swPx.x, swPx.y, 35, 35, highlightAlpha);
        }
      }
    }

    // ── Subtle physics overlays ──

    // Angle arc (subtle cyan glow, only when angle is significant)
    if (Math.abs(this.angle) > 0.02) {
      const arcRadius = 0.18 * ppm;
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      const startAngle = Math.PI / 2;
      const endAngle = Math.PI / 2 + this.angle;
      ctx.beginPath();
      ctx.arc(pivotPx.x, pivotPx.y, arcRadius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();
    }

    // Length label (small, near the string midpoint)
    const midPoint = pivot.lerp(bob, 0.5);
    const labelOffset = new Vector2(0.18, 0);
    renderer.drawText(
      `L = ${this.pendulumLength.toFixed(2)} m`,
      midPoint.add(labelOffset),
      { color: 'rgba(0, 255, 255, 0.7)', fontSize: 12, bold: true }
    );
  }

  /** Draw a pulsing cyan highlight glow around a component. */
  private drawHighlightGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, alpha: number): void {
    ctx.save();
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, 8);
    ctx.stroke();
    ctx.restore();
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
