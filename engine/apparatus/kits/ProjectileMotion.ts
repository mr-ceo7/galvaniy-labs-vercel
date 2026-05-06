/**
 * GalvaniyPhysics - Projectile Motion Kit (Experiment B-6)
 * UoN Manual: Verify range equation R = v²sin(2θ)/g
 * Physics: x = v₀cosθ·t, y = v₀sinθ·t - ½gt²
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler, Stopwatch } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class ProjectileMotionKit extends ApparatusKit {
  readonly kitId = 'ProjectileMotion';
  readonly name = 'Projectile Motion - Range Equation';
  readonly experimentCode = 'B-6';
  readonly category = 'mechanics' as const;

  private launchSpeed: number = 5;     // m/s
  private launchAngle: number = 45;    // degrees
  private g: number = 9.81;
  private trajectory: Vector2[] = [];
  private projectilePos: Vector2 = Vector2.zero();
  private isFlying: boolean = false;
  private flightTime: number = 0;
  private range: number = 0;
  private maxHeight: number = 0;
  private ruler: Ruler;
  private stopwatch: Stopwatch;


  constructor() {
    super();
    this.ruler = new Ruler({ precision: 2, noise: 0.005 });
    this.stopwatch = new Stopwatch({ noise: 0.05 });
    this.addInstrument(this.ruler);
    this.addInstrument(this.stopwatch);
    this.calculateTrajectory();
  }

  private calculateTrajectory(): void {
    this.trajectory = [];
    const rad = this.launchAngle * Math.PI / 180;
    const vx = this.launchSpeed * Math.cos(rad);
    const vy = this.launchSpeed * Math.sin(rad);
    const tFlight = 2 * vy / this.g;
    this.range = vx * tFlight;
    this.maxHeight = vy * vy / (2 * this.g);
    const dt = tFlight / 100;
    for (let t = 0; t <= tFlight; t += dt) {
      const x = vx * t;
      const y = vy * t - 0.5 * this.g * t * t;
      this.trajectory.push(new Vector2(x, Math.max(0, y)));
    }
    this.flightTime = tFlight;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('speed', this.launchSpeed);
    this.controlValues.set('angle', this.launchAngle);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'speed') this.launchSpeed = val;
    if (id === 'angle') this.launchAngle = val;
    this.calculateTrajectory();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'speed', label: 'Launch Speed', min: 1, max: 15, value: 5, step: 0.5, unit: 'm/s' },
      { id: 'angle', label: 'Launch Angle', min: 5, max: 85, value: 45, step: 5, unit: '°' },
    ];
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'projectile_data', title: 'Projectile Motion Data',
      headers: ['θ (°)', 'v₀ (m/s)', 'R (m)', 'R_theory (m)', 'H_max (m)', 'T (s)'], rows: 8,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set launch speed to 5 m/s.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Launch at θ = 15°. Record range R.', expectedAction: 'measure' },
      { index: 2, instruction: 'Repeat for θ = 30°, 45°, 60°, 75°.', expectedAction: 'adjust' },
      { index: 3, instruction: 'Plot R vs θ. Max range at 45°.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const groundY = 420, originX = 80, scale = 50;

    // Ground
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, groundY, 800, 80);
    ctx.strokeStyle = '#2d5a2d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(800, groundY); ctx.stroke();

    // Launcher
    const rad = this.launchAngle * Math.PI / 180;
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(originX, groundY);
    ctx.lineTo(originX + 40 * Math.cos(rad), groundY - 40 * Math.sin(rad));
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.arc(originX, groundY, 8, 0, Math.PI * 2); ctx.fill();

    // Angle arc
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(originX, groundY, 25, -rad, 0); ctx.stroke();
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#a855f7'; ctx.textAlign = 'left';
    ctx.fillText(`${this.launchAngle}°`, originX + 28, groundY - 8);

    // Trajectory path
    if (this.trajectory.length > 1) {
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < this.trajectory.length; i++) {
        const px = originX + this.trajectory[i].x * scale;
        const py = groundY - this.trajectory[i].y * scale;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);

      // Max height marker
      const hx = originX + (this.range / 2) * scale;
      const hy = groundY - this.maxHeight * scale;
      ctx.strokeStyle = 'rgba(249,115,22,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, groundY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#f97316'; ctx.textAlign = 'center';
      ctx.fillText(`H = ${this.maxHeight.toFixed(2)} m`, hx, hy - 8);

      // Range marker
      const rx = originX + this.range * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.moveTo(rx, groundY - 8); ctx.lineTo(rx - 5, groundY + 2); ctx.lineTo(rx + 5, groundY + 2);
      ctx.closePath(); ctx.fill();
      ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
      ctx.fillText(`R = ${this.range.toFixed(2)} m`, rx, groundY + 18);

      // Landing dot
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.arc(rx, groundY, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Projectile at peak (decorative)
    const peakX = originX + (this.range / 2) * scale;
    const peakY = groundY - this.maxHeight * scale;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(peakX, peakY, 6, 0, Math.PI * 2); ctx.fill();

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 110, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 110, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('PROJECTILE MOTION', 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`🚀 v₀ = ${this.launchSpeed.toFixed(1)} m/s | θ = ${this.launchAngle}°`, 20, 48);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`📏 R = ${this.range.toFixed(2)} m`, 20, 66);
    ctx.fillStyle = '#f97316';
    ctx.fillText(`📐 H_max = ${this.maxHeight.toFixed(2)} m`, 20, 84);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`⏱ T = ${this.flightTime.toFixed(3)} s`, 20, 102);
    const rTheory = this.launchSpeed * this.launchSpeed * Math.sin(2 * this.launchAngle * Math.PI / 180) / this.g;
    ctx.fillStyle = '#64748b'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`R(theory) = ${rTheory.toFixed(2)} m`, 20, 116);
  }

  measure(): DataPoint {
    this.calculateTrajectory();
    this.ruler.setMeasuredValue(this.range);
    const rReading = this.ruler.read(0);
    const rTheory = this.launchSpeed ** 2 * Math.sin(2 * this.launchAngle * Math.PI / 180) / this.g;
    return {
      'θ': this.launchAngle,
      'v0': this.launchSpeed,
      'R': rReading.value,
      'R_theory': Number(rTheory.toFixed(3)),
      'H_max': Number(this.maxHeight.toFixed(3)),
      'T': Number(this.flightTime.toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const angles = [15, 30, 40, 45, 50, 60, 75, 80];
    for (const a of angles) {
      this.launchAngle = a;
      this.calculateTrajectory();
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('B-6', 'Projectile Motion', 'mechanics', () => new ProjectileMotionKit());
