/**
 * GalvaniyPhysics — Friction Kit (Experiment A-5)
 * UoN Manual: Determine coefficient of static/kinetic friction.
 * Physics: f = μN, μs (static) > μk (kinetic)
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class FrictionKit extends ApparatusKit {
  readonly kitId = 'Friction';
  readonly name = 'Coefficient of Friction';
  readonly experimentCode = 'A-5';
  readonly category = 'mechanics' as const;

  private blockMass: number = 0.2;      // kg
  private appliedForce: number = 0;     // N
  private muStatic: number = 0.4;
  private muKinetic: number = 0.3;
  private g: number = 9.81;
  private isSliding: boolean = false;
  private blockPosition: number = 0;     // m from start
  private blockVelocity: number = 0;
  private surfaceMaterial: string = 'wood';
  private ruler: Ruler;


  constructor() {
    super();
    this.ruler = new Ruler({ precision: 2, noise: 0.005 });
    this.addInstrument(this.ruler);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('appliedForce', 0);
    this.controlValues.set('blockMass', 200);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
    this.world.onStep(() => this.updatePhysics(this.world.timeStep));
  }

  private updatePhysics(dt: number): void {
    const N = this.blockMass * this.g; // normal force
    const fStatic = this.muStatic * N;
    const fKinetic = this.muKinetic * N;

    if (!this.isSliding) {
      if (this.appliedForce > fStatic) {
        this.isSliding = true;
      }
    }

    if (this.isSliding) {
      const netForce = this.appliedForce - fKinetic;
      const accel = netForce / this.blockMass;
      this.blockVelocity += accel * dt;
      if (this.blockVelocity < 0) { this.blockVelocity = 0; this.isSliding = false; }
      this.blockPosition += this.blockVelocity * dt;
      if (this.blockPosition > 4) { this.blockPosition = 0; this.blockVelocity = 0; }
    }
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'appliedForce') this.appliedForce = val;
    if (id === 'blockMass') { this.blockMass = val / 1000; this.blockPosition = 0; this.blockVelocity = 0; this.isSliding = false; }
  }

  getControls(): LabControl[] {
    return [
      { id: 'appliedForce', label: 'Applied Force', min: 0, max: 5, value: 0, step: 0.1, unit: 'N' },
      { id: 'blockMass', label: 'Block Mass', min: 100, max: 1000, value: 200, step: 50, unit: 'g' },
    ];
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'friction_data', title: 'Friction Data',
      headers: ['m (g)', 'N (N)', 'F_applied (N)', 'Sliding?', 'μ'], rows: 10,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Place block on surface. Gradually increase applied force.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Record force at which block just starts to slide (F_s).', expectedAction: 'measure' },
      { index: 2, instruction: 'Calculate μ_s = F_s / mg.', expectedAction: 'record' },
      { index: 3, instruction: 'Repeat with different masses.', expectedAction: 'adjust' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const surfaceY = 350;

    // Surface
    ctx.fillStyle = '#44403c'; ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2;
    ctx.fillRect(50, surfaceY, 700, 40);
    ctx.strokeRect(50, surfaceY, 700, 40);
    // Surface texture
    ctx.strokeStyle = 'rgba(120,113,108,0.3)'; ctx.lineWidth = 0.5;
    for (let x = 60; x < 740; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, surfaceY + 5); ctx.lineTo(x + 6, surfaceY + 35); ctx.stroke();
    }

    // Block
    const blockW = 70, blockH = 50;
    const blockX = 150 + this.blockPosition * 120;
    const blockY = surfaceY - blockH;
    ctx.fillStyle = this.isSliding ? '#ef4444' : '#3b82f6';
    ctx.strokeStyle = this.isSliding ? '#fca5a5' : '#60a5fa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(blockX, blockY, blockW, blockH, 4); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`${(this.blockMass * 1000).toFixed(0)}g`, blockX + blockW/2, blockY + blockH/2 + 4);

    // Applied force arrow
    if (this.appliedForce > 0) {
      const arrowLen = this.appliedForce * 30;
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(blockX - 5, blockY + blockH/2);
      ctx.lineTo(blockX - 5 - arrowLen, blockY + blockH/2); ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(blockX - 3, blockY + blockH/2);
      ctx.lineTo(blockX - 13, blockY + blockH/2 - 6);
      ctx.lineTo(blockX - 13, blockY + blockH/2 + 6);
      ctx.closePath(); ctx.fill();
      ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'center';
      ctx.fillText(`F = ${this.appliedForce.toFixed(1)} N`, blockX - arrowLen/2, blockY + blockH/2 - 12);
    }

    // Friction arrow (opposing)
    const N = this.blockMass * this.g;
    const fFriction = this.isSliding ? this.muKinetic * N : Math.min(this.appliedForce, this.muStatic * N);
    if (fFriction > 0.01) {
      const fLen = fFriction * 30;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(blockX + blockW + 5, blockY + blockH/2);
      ctx.lineTo(blockX + blockW + 5 + fLen, blockY + blockH/2); ctx.stroke();
      ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
      ctx.fillText(`f = ${fFriction.toFixed(2)} N`, blockX + blockW + fLen/2 + 5, blockY + blockH/2 - 10);
    }

    // Weight and normal arrows
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
    const midX = blockX + blockW/2;
    // Weight down
    ctx.beginPath(); ctx.moveTo(midX, blockY + blockH); ctx.lineTo(midX, blockY + blockH + 30); ctx.stroke();
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#f59e0b';
    ctx.fillText('W', midX + 10, blockY + blockH + 25);
    // Normal up
    ctx.strokeStyle = '#a855f7';
    ctx.beginPath(); ctx.moveTo(midX, blockY); ctx.lineTo(midX, blockY - 30); ctx.stroke();
    ctx.fillStyle = '#a855f7';
    ctx.fillText('N', midX + 10, blockY - 20);

    // Status indicator
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = this.isSliding ? '#ef4444' : '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText(this.isSliding ? '▶ SLIDING' : '■ STATIC', 400, surfaceY + 65);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 100, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 100, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('COEFFICIENT OF FRICTION', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`μ_s = ${this.muStatic.toFixed(2)} | μ_k = ${this.muKinetic.toFixed(2)}`, 20, 48);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`N = ${N.toFixed(2)} N | F_s(max) = ${(this.muStatic * N).toFixed(2)} N`, 20, 66);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`v = ${this.blockVelocity.toFixed(2)} m/s`, 20, 84);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`μ = F/N = ${this.appliedForce > 0 ? (fFriction / N).toFixed(3) : '—'}`, 20, 100);
  }

  measure(): DataPoint {
    const N = this.blockMass * this.g;
    const fFriction = this.isSliding ? this.muKinetic * N : Math.min(this.appliedForce, this.muStatic * N);
    return {
      'm_g': this.blockMass * 1000,
      'N': Number(N.toFixed(2)),
      'F_applied': this.appliedForce,
      'sliding': this.isSliding ? 'Yes' : 'No',
      'mu': Number((fFriction / N).toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const masses = [100, 200, 300, 400, 500];
    for (const m of masses) {
      this.blockMass = m / 1000;
      const N = this.blockMass * this.g;
      // Find static friction threshold with noise
      const fThreshold = this.addNoise(this.muStatic * N, 0.05);
      this.appliedForce = fThreshold;
      this.isSliding = true;
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('A-5', 'Coefficient of Friction', 'mechanics', () => new FrictionKit());
