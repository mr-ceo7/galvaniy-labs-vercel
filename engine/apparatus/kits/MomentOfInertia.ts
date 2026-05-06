import { Vector2 } from '../../core/Vector2.ts';
/**
 * GalvaniyPhysics - Moment of Inertia Kit (Experiment B-8)
 * UoN Manual: Determine moment of inertia of a flywheel.
 * Physics: Iα = τ - friction, energy: ½Iω² = mgh - friction losses
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Stopwatch, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class MomentOfInertiaKit extends ApparatusKit {
  readonly kitId = 'MomentOfInertia'; readonly name = 'Moment of Inertia - Flywheel';
  readonly experimentCode = 'B-8'; readonly category = 'mechanics' as const;
  private hangingMass = 0.2; private fallHeight = 1.0; private axleRadius = 0.02;
  private I = 0.05; private frictionTorque = 0.01; private numWindings = 5;
  private stopwatch: Stopwatch; private ruler: Ruler;
  private wheelAngle = 0;

  constructor() {
    super();
    this.stopwatch = new Stopwatch({ noise: 0.1 });
    this.ruler = new Ruler({ precision: 2, noise: 0.005 });
    this.addInstrument(this.stopwatch); this.addInstrument(this.ruler);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
    this.world.onStep(() => { this.wheelAngle += 2 * this.world.timeStep; });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'hangingMass') this.hangingMass = val / 1000;
    if (id === 'fallHeight') this.fallHeight = val / 100;
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'hangingMass', label: 'Hanging Mass', min: 50, max: 500, value: 200, step: 50, unit: 'g' },
      { id: 'fallHeight', label: 'Fall Height', min: 50, max: 200, value: 100, step: 10, unit: 'cm' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'moi_data', title: 'Moment of Inertia Data',
      headers: ['m (g)', 'h (cm)', 't (s)', 'n₁', 'n₂', 'I (kg·m²)'], rows: 6 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Wind string n₁ turns around axle.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Release mass, time fall through height h.', expectedAction: 'measure' },
      { index: 2, instruction: 'Count revolutions n₂ after string detaches.', expectedAction: 'measure' },
      { index: 3, instruction: 'Calculate I from energy equation.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const cx = 400, cy = 200, wheelR = 80;
    // Flywheel
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, wheelR, 0, Math.PI * 2); ctx.stroke();
    // Spokes
    for (let i = 0; i < 6; i++) {
      const a = this.wheelAngle + i * Math.PI / 3;
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + wheelR * 0.9 * Math.cos(a), cy + wheelR * 0.9 * Math.sin(a)); ctx.stroke();
    }
    // Axle
    ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    // Marker dot
    const mx = cx + wheelR * 0.7 * Math.cos(this.wheelAngle);
    const my = cy + wheelR * 0.7 * Math.sin(this.wheelAngle);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    // String and mass
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 8, cy + 150); ctx.stroke();
    ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.roundRect(cx - 7, cy + 150, 30, 25, 4); ctx.fill();
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`${(this.hangingMass * 1000).toFixed(0)}g`, cx + 8, cy + 167);
    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 230, 80, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 80, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('MOMENT OF INERTIA - FLYWHEEL', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`I = ${this.I.toFixed(4)} kg·m²`, 20, 48);
    ctx.fillStyle = '#f59e0b'; ctx.fillText(`m = ${(this.hangingMass*1000).toFixed(0)} g | h = ${(this.fallHeight*100).toFixed(0)} cm`, 20, 66);
  }

  measure(): DataPoint {
    // Energy method: mgh = ½Iω² + ½mv² + n₂·f where f = friction/rev
    const v = Math.sqrt(2 * this.fallHeight * 9.81 * (1 - this.frictionTorque / (this.hangingMass * 9.81 * this.axleRadius)));
    const omega = v / this.axleRadius;
    const n2 = Math.round(this.addNoise(omega / (2 * Math.PI) * 3, 1));
    const t = this.addNoise(2 * this.fallHeight / v, 0.1);
    return {
      'm_g': this.hangingMass * 1000, 'h_cm': this.fallHeight * 100,
      't': Number(t.toFixed(2)), 'n1': this.numWindings, 'n2': Math.max(1, n2),
      'I': Number(this.I.toFixed(4)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const masses = [100, 150, 200, 250, 300, 350];
    for (const m of masses) { this.hangingMass = m / 1000; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('B-8', 'Moment of Inertia', 'mechanics', () => new MomentOfInertiaKit());
