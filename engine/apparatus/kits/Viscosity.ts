/**
 * GalvaniyPhysics — Viscosity Kit (Experiment B-10)
 * UoN Manual: Stokes' Law — determine viscosity of glycerine.
 * Physics: F_drag = 6πηrv, terminal velocity: v_t = 2r²(ρ_s - ρ_f)g / 9η
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Stopwatch, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class ViscosityKit extends ApparatusKit {
  readonly kitId = 'Viscosity'; readonly name = "Viscosity — Stokes' Law";
  readonly experimentCode = 'B-10'; readonly category = 'mechanics' as const;

  private ballRadius = 0.002; private ballDensity = 7800; // steel
  private fluidDensity = 1260; private viscosity = 1.5; // Pa·s (glycerine)
  private g = 9.81; private ballY = 0; private ballVelocity = 0;
  private terminalVelocity = 0; private tubeHeight = 0.5; // m
  private stopwatch: Stopwatch; private ruler: Ruler; private renderer: CanvasRenderer | null = null;
  private fallComplete = false; private fallTime = 0;

  constructor() {
    super();
    this.stopwatch = new Stopwatch({ noise: 0.15 });
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.stopwatch); this.addInstrument(this.ruler);
    this.calculateTerminalVelocity();
  }

  private calculateTerminalVelocity(): void {
    this.terminalVelocity = 2 * this.ballRadius ** 2 * (this.ballDensity - this.fluidDensity) * this.g / (9 * this.viscosity);
    this.fallTime = this.tubeHeight / this.terminalVelocity;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
    this.world.onStep((_, dt) => {
      if (!this.fallComplete) {
        const buoyancy = this.fluidDensity * (4/3) * Math.PI * this.ballRadius**3 * this.g;
        const weight = this.ballDensity * (4/3) * Math.PI * this.ballRadius**3 * this.g;
        const drag = 6 * Math.PI * this.viscosity * this.ballRadius * this.ballVelocity;
        const mass = this.ballDensity * (4/3) * Math.PI * this.ballRadius**3;
        const accel = (weight - buoyancy - drag) / mass;
        this.ballVelocity += accel * dt;
        this.ballY += this.ballVelocity * dt;
        if (this.ballY >= this.tubeHeight) { this.fallComplete = true; }
      }
    });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'ballRadius') { this.ballRadius = val / 1000; this.resetFall(); }
  }

  private resetFall(): void {
    this.ballY = 0; this.ballVelocity = 0; this.fallComplete = false;
    this.calculateTerminalVelocity();
  }

  getControls(): LabControl[] {
    return [{ id: 'ballRadius', label: 'Ball Radius', min: 1, max: 5, value: 2, step: 0.5, unit: 'mm' }];
  }
  getDataTable(): DataTableConfig {
    return { id: 'viscosity_data', title: 'Viscosity Data',
      headers: ['r (mm)', 'd (cm)', 't (s)', 'v_t (cm/s)', 'η (Pa·s)'], rows: 6 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Measure ball diameter with micrometer.', expectedAction: 'measure' },
      { index: 1, instruction: 'Drop ball into glycerine. Time fall between two markers.', expectedAction: 'measure' },
      { index: 2, instruction: 'Calculate v_t and η from Stokes\' law.', expectedAction: 'record' },
      { index: 3, instruction: 'Repeat with different ball sizes.', expectedAction: 'adjust' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const tubeX = 400, tubeTop = 80, tubeBot = 450, tubeW = 50;
    // Tube
    ctx.fillStyle = 'rgba(251,191,36,0.15)'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.fillRect(tubeX - tubeW/2, tubeTop, tubeW, tubeBot - tubeTop);
    ctx.strokeRect(tubeX - tubeW/2, tubeTop, tubeW, tubeBot - tubeTop);
    // Fluid label
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center';
    ctx.fillText('Glycerine', tubeX, tubeBot + 15);
    // Measurement marks
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
    const markTop = tubeTop + 50, markBot = tubeBot - 30;
    ctx.beginPath(); ctx.moveTo(tubeX - tubeW/2 - 5, markTop); ctx.lineTo(tubeX + tubeW/2 + 5, markTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tubeX - tubeW/2 - 5, markBot); ctx.lineTo(tubeX + tubeW/2 + 5, markBot); ctx.stroke();
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'left';
    ctx.fillText('A', tubeX + tubeW/2 + 8, markTop + 4);
    ctx.fillText('B', tubeX + tubeW/2 + 8, markBot + 4);
    // Ball
    const ballDispY = tubeTop + 20 + (this.ballY / this.tubeHeight) * (tubeBot - tubeTop - 40);
    const ballDispR = Math.max(4, this.ballRadius * 2000);
    const grad = ctx.createRadialGradient(tubeX - 2, ballDispY - 2, 1, tubeX, ballDispY, ballDispR);
    grad.addColorStop(0, '#94a3b8'); grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(tubeX, ballDispY, ballDispR, 0, Math.PI * 2); ctx.fill();
    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 100, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 100, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("STOKES' LAW — VISCOSITY", 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`v = ${(this.ballVelocity * 100).toFixed(2)} cm/s`, 20, 48);
    ctx.fillStyle = '#f59e0b'; ctx.fillText(`v_t = ${(this.terminalVelocity * 100).toFixed(2)} cm/s`, 20, 66);
    ctx.fillStyle = '#a855f7'; ctx.fillText(`η = ${this.viscosity.toFixed(2)} Pa·s`, 20, 84);
    ctx.fillStyle = '#e2e8f0'; ctx.fillText(`r = ${(this.ballRadius * 1000).toFixed(1)} mm`, 20, 102);
  }

  measure(): DataPoint {
    this.calculateTerminalVelocity();
    const vt = this.addNoise(this.terminalVelocity, this.terminalVelocity * 0.03);
    const d = this.addNoise(this.tubeHeight * 100, 0.1);
    const t = d / (vt * 100);
    const etaCalc = 2 * this.ballRadius ** 2 * (this.ballDensity - this.fluidDensity) * this.g / (9 * vt);
    return { 'r_mm': this.ballRadius * 1000, 'd_cm': Number(d.toFixed(1)), 't': Number(t.toFixed(2)),
      'vt_cms': Number((vt * 100).toFixed(2)), 'eta': Number(etaCalc.toFixed(2)) };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const radii = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
    for (const r of radii) { this.ballRadius = r / 1000; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('B-10', "Viscosity — Stokes' Law", 'mechanics', () => new ViscosityKit());
