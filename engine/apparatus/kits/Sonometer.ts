import { Vector2 } from '../../core/Vector2.ts';
/**
 * GalvaniyPhysics - Resonance / Sonometer Kit (Experiment D-14)
 * UoN Manual: Verify f = (1/2L)√(T/μ) using a sonometer.
 * Physics: Standing waves on string, resonance with tuning fork.
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class SonometerKit extends ApparatusKit {
  readonly kitId = 'Sonometer'; readonly name = 'Resonance - Sonometer';
  readonly experimentCode = 'D-14'; readonly category = 'waves' as const;

  private tension = 20; // N
  private linearDensity = 0.005; // kg/m
  private resonantLength = 0; // m
  private forkFrequency = 256; // Hz
  private wireLength = 0.5; // current adjustable length
  private ruler: Ruler;
  private animPhase = 0; private atResonance = false;

  constructor() {
    super();
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.ruler);
    this.calculateResonance();
  }

  private calculateResonance(): void {
    // f = (1/2L)√(T/μ) → L = √(T/μ) / (2f)
    this.resonantLength = Math.sqrt(this.tension / this.linearDensity) / (2 * this.forkFrequency);
    this.atResonance = Math.abs(this.wireLength - this.resonantLength) < 0.005;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
    this.world.onStep(() => { this.animPhase += 0.1; });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'wireLength') this.wireLength = val / 100;
    if (id === 'tension') this.tension = val;
    if (id === 'frequency') this.forkFrequency = val;
    this.calculateResonance();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'wireLength', label: 'Wire Length', min: 10, max: 80, value: 50, step: 1, unit: 'cm' },
      { id: 'tension', label: 'Tension', min: 5, max: 50, value: 20, step: 1, unit: 'N' },
      { id: 'frequency', label: 'Fork Frequency', min: 128, max: 512, value: 256, step: 128, unit: 'Hz' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'sonometer_data', title: 'Sonometer Data',
      headers: ['f (Hz)', 'T (N)', 'L (cm)', 'L² (cm²)', 'f·L (Hz·m)'], rows: 6 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set tension and strike tuning fork of known frequency.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Slide bridge to find resonant length (max amplitude).', expectedAction: 'adjust' },
      { index: 2, instruction: 'Measure resonant length L with ruler.', expectedAction: 'measure' },
      { index: 3, instruction: 'Verify f = (1/2L)√(T/μ).', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const boxX = 100, boxY = 250, boxW = 600, boxH = 40;
    // Sonometer box
    ctx.fillStyle = '#44403c'; ctx.strokeStyle = '#78716c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 4); ctx.fill(); ctx.stroke();

    // Wire
    const wireStartX = boxX + 20, wireEndX = wireStartX + this.wireLength * 700;
    const wireY = boxY - 5;
    const amplitude = this.atResonance ? 20 : 3 + Math.abs(Math.sin(this.animPhase)) * 3;

    ctx.strokeStyle = this.atResonance ? '#22d3ee' : '#94a3b8'; ctx.lineWidth = this.atResonance ? 2 : 1;
    ctx.beginPath();
    for (let x = wireStartX; x <= wireEndX; x += 2) {
      const t = (x - wireStartX) / (wireEndX - wireStartX);
      const y = wireY - Math.sin(t * Math.PI) * amplitude * Math.sin(this.animPhase * 5);
      if (x === wireStartX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow at resonance
    if (this.atResonance) {
      ctx.strokeStyle = 'rgba(34,211,238,0.3)'; ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = wireStartX; x <= wireEndX; x += 2) {
        const t = (x - wireStartX) / (wireEndX - wireStartX);
        const y = wireY - Math.sin(t * Math.PI) * amplitude * Math.sin(this.animPhase * 5);
        if (x === wireStartX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Bridges
    ctx.fillStyle = '#94a3b8';
    for (const bx of [wireStartX, wireEndX]) {
      ctx.beginPath(); ctx.moveTo(bx, wireY); ctx.lineTo(bx - 6, boxY); ctx.lineTo(bx + 6, boxY);
      ctx.closePath(); ctx.fill();
    }

    // Length label
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(wireStartX, boxY + boxH + 15); ctx.lineTo(wireEndX, boxY + boxH + 15); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center';
    ctx.fillText(`L = ${(this.wireLength * 100).toFixed(1)} cm`, (wireStartX + wireEndX) / 2, boxY + boxH + 30);

    // Tuning fork
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3;
    const forkX = boxX - 50, forkY = wireY - 30;
    ctx.beginPath(); ctx.moveTo(forkX, forkY); ctx.lineTo(forkX, forkY + 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(forkX - 8, forkY); ctx.lineTo(forkX - 8, forkY + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(forkX + 8, forkY); ctx.lineTo(forkX + 8, forkY + 30); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#a855f7'; ctx.textAlign = 'center';
    ctx.fillText(`${this.forkFrequency} Hz`, forkX, forkY - 8);

    // Resonance indicator
    ctx.font = 'bold 16px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = this.atResonance ? '#22c55e' : '#ef4444';
    ctx.fillText(this.atResonance ? '🔊 RESONANCE!' : '🔇 Adjust length...', 400, boxY + boxH + 55);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('SONOMETER - RESONANCE', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`f = ${this.forkFrequency} Hz | T = ${this.tension} N`, 20, 48);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`L_res = ${(this.resonantLength * 100).toFixed(1)} cm`, 20, 66);
    ctx.fillStyle = '#a855f7';
    const fCalc = Math.sqrt(this.tension / this.linearDensity) / (2 * this.wireLength);
    ctx.fillText(`f_calc = ${fCalc.toFixed(1)} Hz`, 20, 84);
  }

  measure(): DataPoint {
    this.calculateResonance();
    this.ruler.setMeasuredValue(this.resonantLength * 100);
    const lr = this.ruler.read(0);
    return {
      'f': this.forkFrequency, 'T': this.tension,
      'L_cm': lr.value, 'L2': Number((lr.value ** 2).toFixed(1)),
      'fL': Number((this.forkFrequency * lr.value / 100).toFixed(2)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const tensions = [10, 15, 20, 25, 30, 40];
    for (const t of tensions) { this.tension = t; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('D-14', 'Sonometer - Resonance', 'waves', () => new SonometerKit());
