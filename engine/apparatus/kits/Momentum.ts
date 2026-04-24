/**
 * GalvaniyPhysics — Conservation of Momentum Kit (Experiment B-9)
 * UoN Manual: Verify m1v1 + m2v2 = m1v1' + m2v2' using air track.
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Stopwatch } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class ConservationOfMomentumKit extends ApparatusKit {
  readonly kitId = 'Momentum'; readonly name = 'Conservation of Momentum';
  readonly experimentCode = 'B-9'; readonly category = 'mechanics' as const;

  private m1 = 0.2; private m2 = 0.3; private v1 = 2.0; private v2 = 0;
  private v1f = 0; private v2f = 0; private e = 1.0; // coefficient of restitution
  private glider1X = 0; private glider2X = 0; private simTime = 0;
  private hasCollided = false; private collisionTime = 0;
  private stopwatch: Stopwatch; private renderer: CanvasRenderer | null = null;

  constructor() {
    super();
    this.stopwatch = new Stopwatch({ noise: 0.05 });
    this.addInstrument(this.stopwatch);
    this.calculateCollision();
  }

  private calculateCollision(): void {
    // 1D elastic/inelastic: v1f = (m1-e·m2)v1/(m1+m2) + (1+e)m2·v2/(m1+m2)
    this.v1f = ((this.m1 - this.e * this.m2) * this.v1 + (1 + this.e) * this.m2 * this.v2) / (this.m1 + this.m2);
    this.v2f = ((this.m2 - this.e * this.m1) * this.v2 + (1 + this.e) * this.m1 * this.v1) / (this.m1 + this.m2);
    this.hasCollided = false; this.simTime = 0;
    this.glider1X = 100; this.glider2X = 450;
    this.collisionTime = (this.glider2X - this.glider1X - 80) / (Math.abs(this.v1 - this.v2) * 100 || 1);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
    this.world.onStep(() => this.updateSim(this.world.timeStep));
  }

  private updateSim(dt: number): void {
    this.simTime += dt;
    if (!this.hasCollided) {
      this.glider1X += this.v1 * 100 * dt;
      this.glider2X += this.v2 * 100 * dt;
      if (this.glider1X + 60 >= this.glider2X) { this.hasCollided = true; }
    } else {
      this.glider1X += this.v1f * 100 * dt;
      this.glider2X += this.v2f * 100 * dt;
    }
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'm1') this.m1 = val / 1000;
    if (id === 'm2') this.m2 = val / 1000;
    if (id === 'v1') this.v1 = val;
    if (id === 'restitution') this.e = val;
    this.calculateCollision();
  }

  getControls(): LabControl[] {
    return [
      { id: 'm1', label: 'Mass 1', min: 100, max: 500, value: 200, step: 50, unit: 'g' },
      { id: 'm2', label: 'Mass 2', min: 100, max: 500, value: 300, step: 50, unit: 'g' },
      { id: 'v1', label: 'v₁ initial', min: 0.5, max: 5, value: 2.0, step: 0.5, unit: 'm/s' },
      { id: 'restitution', label: 'Elasticity (e)', min: 0, max: 1, value: 1, step: 0.1, unit: '' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'momentum_data', title: 'Momentum Conservation',
      headers: ['m₁v₁+m₂v₂ (before)', 'm₁v₁\'+m₂v₂\' (after)', 'KE_before', 'KE_after'], rows: 6 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set masses and initial velocity.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Launch glider 1. Observe collision.', expectedAction: 'observe' },
      { index: 2, instruction: 'Measure final velocities using photogates.', expectedAction: 'measure' },
      { index: 3, instruction: 'Verify p_before = p_after.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const trackY = 300;
    // Air track
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
    ctx.fillRect(30, trackY, 740, 20); ctx.strokeRect(30, trackY, 740, 20);
    // Air holes
    ctx.fillStyle = 'rgba(34,211,238,0.3)';
    for (let x = 50; x < 750; x += 20) {
      ctx.beginPath(); ctx.arc(x, trackY + 10, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Glider 1
    const g1w = 60, g1h = 30;
    ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(this.glider1X, trackY - g1h, g1w, g1h, 4); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`m₁=${(this.m1*1000).toFixed(0)}g`, this.glider1X + g1w/2, trackY - g1h/2 + 4);
    // Glider 2
    ctx.fillStyle = '#a855f7'; ctx.strokeStyle = '#c084fc';
    ctx.beginPath(); ctx.roundRect(this.glider2X, trackY - g1h, g1w, g1h, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(`m₂=${(this.m2*1000).toFixed(0)}g`, this.glider2X + g1w/2, trackY - g1h/2 + 4);
    // Velocity arrows
    if (Math.abs(this.hasCollided ? this.v1f : this.v1) > 0.01) {
      const vel = this.hasCollided ? this.v1f : this.v1;
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.glider1X + g1w/2, trackY - g1h - 10);
      ctx.lineTo(this.glider1X + g1w/2 + vel * 20, trackY - g1h - 10); ctx.stroke();
    }
    if (this.hasCollided && Math.abs(this.v2f) > 0.01) {
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.glider2X + g1w/2, trackY - g1h - 10);
      ctx.lineTo(this.glider2X + g1w/2 + this.v2f * 20, trackY - g1h - 10); ctx.stroke();
    }
    // HUD
    const pBefore = this.m1 * this.v1 + this.m2 * this.v2;
    const pAfter = this.m1 * this.v1f + this.m2 * this.v2f;
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 280, 100, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 280, 100, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('CONSERVATION OF MOMENTUM', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`p_before = ${pBefore.toFixed(3)} kg·m/s`, 20, 48);
    ctx.fillStyle = '#a855f7'; ctx.fillText(`p_after  = ${pAfter.toFixed(3)} kg·m/s`, 20, 66);
    ctx.fillStyle = Math.abs(pBefore - pAfter) < 0.001 ? '#22c55e' : '#ef4444';
    ctx.fillText(`Δp = ${Math.abs(pBefore - pAfter).toFixed(5)} (≈0 ✓)`, 20, 84);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`e = ${this.e.toFixed(1)} | ${this.e === 1 ? 'Elastic' : this.e === 0 ? 'Perfectly Inelastic' : 'Inelastic'}`, 20, 102);
  }

  measure(): DataPoint {
    this.calculateCollision();
    const pB = this.m1 * this.v1 + this.m2 * this.v2;
    const pA = this.m1 * this.v1f + this.m2 * this.v2f;
    const keB = 0.5 * this.m1 * this.v1 ** 2 + 0.5 * this.m2 * this.v2 ** 2;
    const keA = 0.5 * this.m1 * this.v1f ** 2 + 0.5 * this.m2 * this.v2f ** 2;
    return { 'p_before': Number(pB.toFixed(4)), 'p_after': Number(pA.toFixed(4)),
      'KE_before': Number(keB.toFixed(4)), 'KE_after': Number(keA.toFixed(4)) };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const configs = [
      { m1: 200, m2: 200, v1: 2, e: 1 }, { m1: 200, m2: 400, v1: 3, e: 1 },
      { m1: 300, m2: 200, v1: 2, e: 0.5 }, { m1: 200, m2: 200, v1: 2, e: 0 },
      { m1: 100, m2: 500, v1: 4, e: 1 }, { m1: 400, m2: 100, v1: 1.5, e: 0.8 },
    ];
    for (const c of configs) {
      this.m1 = c.m1/1000; this.m2 = c.m2/1000; this.v1 = c.v1; this.e = c.e;
      data.push(this.measure());
    }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('B-9', 'Conservation of Momentum', 'mechanics', () => new ConservationOfMomentumKit());
