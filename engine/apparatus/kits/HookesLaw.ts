/**
 * GalvaniyPhysics — Hooke's Law Kit (Experiment A-4)
 * UoN Manual: F = kx, determine spring constant.
 * Physics: Plot F vs x, slope = k (spring constant).
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class HookesLawKit extends ApparatusKit {
  readonly kitId = 'HookesLaw';
  readonly name = "Hooke's Law — Spring Constant";
  readonly experimentCode = 'A-4';
  readonly category = 'mechanics' as const;

  private springConstant: number = 25; // N/m
  private naturalLength: number = 0.15; // m
  private appliedMass: number = 0.05;   // kg
  private g: number = 9.81;
  private extension: number = 0;
  private springOscillating: boolean = false;
  private oscPhase: number = 0;
  private ruler: Ruler;


  constructor() {
    super();
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.ruler);
    this.updateExtension();
  }

  private updateExtension(): void {
    // F = kx → x = mg/k
    const force = this.appliedMass * this.g;
    this.extension = force / this.springConstant;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('mass', this.appliedMass * 1000);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'mass') {
      this.appliedMass = val / 1000; // g to kg
      this.updateExtension();
      this.springOscillating = true;
      this.oscPhase = 0;
    }
  }

  getControls(): LabControl[] {
    return [
      { id: 'mass', label: 'Hanging Mass', min: 0, max: 500, value: 50, step: 10, unit: 'g' },
    ];
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'hookes_data', title: "Hooke's Law Data",
      headers: ['m (g)', 'F = mg (N)', 'x (mm)', 'k = F/x (N/m)'], rows: 10,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Record natural length of spring (no load).', expectedAction: 'measure' },
      { index: 1, instruction: 'Add 50g mass. Measure extension x.', expectedAction: 'measure' },
      { index: 2, instruction: 'Increase mass in 50g steps up to 500g.', expectedAction: 'adjust' },
      { index: 3, instruction: 'Plot F vs x. Slope = spring constant k.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const anchorX = 400, anchorY = 60;
    const oscOffset = this.springOscillating ?
      Math.sin(this.oscPhase) * 0.02 * Math.exp(-this.oscPhase * 0.3) : 0;
    if (this.springOscillating) {
      this.oscPhase += 0.15;
      if (this.oscPhase > 20) this.springOscillating = false;
    }
    const totalLength = this.naturalLength + this.extension + oscOffset;
    const endY = anchorY + totalLength * 400; // scale for display

    // Support
    ctx.fillStyle = '#475569';
    ctx.fillRect(anchorX - 50, anchorY - 10, 100, 12);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.strokeRect(anchorX - 50, anchorY - 10, 100, 12);

    // Spring coils
    const coils = 12;
    const springStartY = anchorY + 2;
    const springEndY = endY - 20;
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(anchorX, springStartY);
    for (let i = 0; i < coils * 2; i++) {
      const t = (i + 1) / (coils * 2);
      const y = springStartY + (springEndY - springStartY) * t;
      const xOff = (i % 2 === 0 ? 15 : -15);
      ctx.lineTo(anchorX + xOff, y);
    }
    ctx.lineTo(anchorX, springEndY);
    ctx.stroke();

    // Mass block
    const massW = 50, massH = 30;
    const massCenterY = endY;
    const massIntensity = Math.min(1, this.appliedMass / 0.5);
    const r = Math.round(59 + massIntensity * 180);
    const g = Math.round(130 - massIntensity * 80);
    const b = Math.round(246 - massIntensity * 200);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(anchorX - massW/2, massCenterY - massH/2, massW, massH, 5);
    ctx.fill(); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`${(this.appliedMass * 1000).toFixed(0)}g`, anchorX, massCenterY + 4);

    // Extension measurement arrows
    if (this.extension > 0.001) {
      const natEndY = anchorY + this.naturalLength * 400;
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(anchorX + 50, natEndY); ctx.lineTo(anchorX + 80, natEndY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(anchorX + 50, massCenterY); ctx.lineTo(anchorX + 80, massCenterY); ctx.stroke();
      ctx.setLineDash([]);

      // Extension label with arrows
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(anchorX + 65, natEndY + 5); ctx.lineTo(anchorX + 65, massCenterY - 5); ctx.stroke();
      ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'left';
      ctx.fillText(`x = ${(this.extension * 1000).toFixed(1)} mm`, anchorX + 75, (natEndY + massCenterY) / 2 + 4);
    }

    // Ruler markings on the left
    ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 0.5;
    for (let mm = 0; mm < 400; mm += 20) {
      const y = anchorY + mm;
      const len = mm % 100 === 0 ? 20 : mm % 50 === 0 ? 12 : 6;
      ctx.beginPath(); ctx.moveTo(anchorX - 80, y); ctx.lineTo(anchorX - 80 + len, y); ctx.stroke();
      if (mm % 100 === 0) {
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#64748b'; ctx.textAlign = 'right';
        ctx.fillText(`${mm}`, anchorX - 85, y + 3);
      }
    }

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 100, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 100, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("HOOKE'S LAW", 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    const force = this.appliedMass * this.g;
    ctx.fillText(`⚖ F = ${force.toFixed(2)} N`, 20, 48);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`📏 x = ${(this.extension * 1000).toFixed(1)} mm`, 20, 66);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`🔧 k = ${this.springConstant.toFixed(1)} N/m`, 20, 84);
    ctx.fillStyle = '#64748b'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`k(measured) = ${this.extension > 0 ? (force / this.extension).toFixed(1) : '—'} N/m`, 20, 100);
  }

  measure(): DataPoint {
    this.updateExtension();
    this.ruler.setMeasuredValue(this.extension * 1000);
    const xReading = this.ruler.read(0);
    const force = this.appliedMass * this.g;
    const kMeasured = xReading.value > 0 ? (force / (xReading.value / 1000)) : 0;
    return {
      'm_g': this.appliedMass * 1000,
      'F_N': Number(force.toFixed(3)),
      'x_mm': xReading.value,
      'k_Nm': Number(kMeasured.toFixed(1)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    for (let m = 50; m <= 500; m += 50) {
      this.appliedMass = m / 1000;
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('A-4', "Hooke's Law", 'mechanics', () => new HookesLawKit());
