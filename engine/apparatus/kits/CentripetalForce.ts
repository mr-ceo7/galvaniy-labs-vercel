/**
 * GalvaniyPhysics — Centripetal Force Kit (Experiment B-7)
 * UoN Manual: F = mv²/r = mω²r
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Stopwatch, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class CentripetalForceKit extends ApparatusKit {
  readonly kitId = 'CentripetalForce';
  readonly name = 'Centripetal Force';
  readonly experimentCode = 'B-7';
  readonly category = 'mechanics' as const;

  private mass: number = 0.1; private radius: number = 0.3; private angularSpeed: number = 6;
  private angle: number = 0; private hangingMass: number = 0.1;
  private stopwatch: Stopwatch; private ruler: Ruler;

  constructor() {
    super();
    this.stopwatch = new Stopwatch({ noise: 0.1 });
    this.ruler = new Ruler({ precision: 2, noise: 0.002 });
    this.addInstrument(this.stopwatch); this.addInstrument(this.ruler);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('radius', this.radius * 100);
    this.controlValues.set('hangingMass', this.hangingMass * 1000);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
    this.world.onStep(() => { this.angle += this.angularSpeed * this.world.timeStep; });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'radius') this.radius = val / 100;
    if (id === 'hangingMass') { this.hangingMass = val / 1000; this.updateAngularSpeed(); }
  }

  private updateAngularSpeed(): void {
    // F_c = mω²r = Mg → ω = √(Mg / mr)
    this.angularSpeed = Math.sqrt(this.hangingMass * 9.81 / (this.mass * this.radius));
  }

  getControls(): LabControl[] {
    return [
      { id: 'radius', label: 'Radius', min: 10, max: 50, value: 30, step: 2, unit: 'cm' },
      { id: 'hangingMass', label: 'Hanging Mass', min: 50, max: 500, value: 100, step: 10, unit: 'g' },
    ];
  }

  getDataTable(): DataTableConfig {
    return { id: 'centripetal_data', title: 'Centripetal Force Data',
      headers: ['r (cm)', 'M (g)', 'T (s)', 'F_c (N)', 'Mg (N)'], rows: 8 };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set radius and hanging mass.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Spin mass until indicator aligns (constant radius).', expectedAction: 'observe' },
      { index: 2, instruction: 'Time 10 revolutions. Calculate T and F_c.', expectedAction: 'measure' },
      { index: 3, instruction: 'Compare F_c = mω²r with Mg.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const cx = 400, cy = 280, displayR = this.radius * 300;

    // Orbit circle
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, displayR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

    // String from center to mass
    const mx = cx + displayR * Math.cos(this.angle);
    const my = cy + displayR * Math.sin(this.angle);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my); ctx.stroke();

    // Rotating mass
    const grad = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 12);
    grad.addColorStop(0, '#60a5fa'); grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.stroke();

    // Centripetal force arrow (toward center)
    const dirX = (cx - mx) / displayR, dirY = (cy - my) / displayR;
    const fLen = 40;
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + dirX * fLen, my + dirY * fLen); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
    ctx.fillText('F_c', mx + dirX * fLen + 15, my + dirY * fLen);

    // Center tube
    ctx.fillStyle = '#475569'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Hanging mass (below center)
    ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(cx - 15, cy + 60, 30, 25, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 60); ctx.stroke();
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`${(this.hangingMass * 1000).toFixed(0)}g`, cx, cy + 77);

    // Trail effect
    ctx.strokeStyle = 'rgba(59,130,246,0.2)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = this.angle - i * 0.15;
      const tx = cx + displayR * Math.cos(a), ty = cy + displayR * Math.sin(a);
      if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // HUD
    this.updateAngularSpeed();
    const Fc = this.mass * this.angularSpeed * this.angularSpeed * this.radius;
    const Mg = this.hangingMass * 9.81;
    const T = 2 * Math.PI / this.angularSpeed;
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 240, 100, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 240, 100, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('CENTRIPETAL FORCE', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`ω = ${this.angularSpeed.toFixed(2)} rad/s | T = ${T.toFixed(3)} s`, 20, 48);
    ctx.fillStyle = '#ef4444'; ctx.fillText(`F_c = mω²r = ${Fc.toFixed(3)} N`, 20, 66);
    ctx.fillStyle = '#f59e0b'; ctx.fillText(`Mg = ${Mg.toFixed(3)} N`, 20, 84);
    ctx.fillStyle = Math.abs(Fc - Mg) < 0.01 ? '#22c55e' : '#ef4444';
    ctx.fillText(`|F_c - Mg| = ${Math.abs(Fc - Mg).toFixed(4)} N`, 20, 102);
  }

  measure(): DataPoint {
    this.updateAngularSpeed();
    const T = 2 * Math.PI / this.angularSpeed;
    const Fc = this.mass * this.angularSpeed ** 2 * this.radius;
    return {
      'r_cm': this.radius * 100, 'M_g': this.hangingMass * 1000,
      'T': Number(this.addNoise(T, 0.02).toFixed(3)),
      'Fc': Number(Fc.toFixed(3)), 'Mg': Number((this.hangingMass * 9.81).toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const masses = [50, 100, 150, 200, 250, 300, 350, 400];
    for (const m of masses) { this.hangingMass = m / 1000; data.push(this.measure()); }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('B-7', 'Centripetal Force', 'mechanics', () => new CentripetalForceKit());
