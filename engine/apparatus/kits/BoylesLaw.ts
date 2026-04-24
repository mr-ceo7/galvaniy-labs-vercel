/**
 * GalvaniyPhysics — Boyle's Law Kit (Experiment C-12)
 * UoN Manual: PV = const at constant temperature
 * Physics: P₁V₁ = P₂V₂, plot P vs 1/V → straight line
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { PressureGauge, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class BoylesLawKit extends ApparatusKit {
  readonly kitId = 'BoylesLaw';
  readonly name = "Boyle's Law — PV = const";
  readonly experimentCode = 'C-12';
  readonly category = 'heat' as const;

  private volume: number = 50;          // cm³
  private pressure: number = 101325;    // Pa (1 atm)
  private initialPV: number = 50 * 101325; // PV product
  private temperature: number = 293;    // K (20°C)
  private renderer: CanvasRenderer | null = null;
  private pressureGauge: PressureGauge;

  constructor() {
    super();
    this.pressureGauge = new PressureGauge({ noise: 200, precision: 0 });
    this.addInstrument(this.pressureGauge);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.pressureGauge = new PressureGauge({ noise: 200, precision: 0 });
    this.addInstrument(this.pressureGauge);
    this.controlValues.set('volume', this.volume);
    this.initialPV = this.volume * this.pressure;
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'volume') {
      this.volume = val;
      this.pressure = this.initialPV / this.volume;
      this.pressureGauge.setPressureValue(this.pressure);
    }
  }

  getControls(): LabControl[] {
    return [{ id: 'volume', label: 'Volume (V)', min: 15, max: 80, value: 50, step: 1, unit: 'cm³' }];
  }

  getDataTable(): DataTableConfig {
    return { id: 'boyles_data', title: "Boyle's Law Data", headers: ['V (cm³)', 'P (kPa)', '1/V (cm⁻³)', 'PV (kPa·cm³)'], rows: 10 };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Record initial volume and pressure.', expectedAction: 'measure' },
      { index: 1, instruction: 'Decrease volume by pushing piston. Record P at each V.', expectedAction: 'adjust' },
      { index: 2, instruction: 'Repeat for 8-10 different volumes.', expectedAction: 'adjust' },
      { index: 3, instruction: 'Plot P vs 1/V and verify linearity.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    // Syringe/cylinder
    const cx = 350, cy = 280, cw = 200, ch = 80;
    const pistonX = cx - cw/2 + (this.volume / 80) * cw;

    // Cylinder body
    ctx.fillStyle = 'rgba(71,85,105,0.3)';
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cx - cw/2, cy - ch/2, cw, ch, [0, 10, 10, 0]); ctx.fill(); ctx.stroke();

    // Gas (blue fill from left to piston)
    const gasWidth = pistonX - (cx - cw/2);
    const gasPressureIntensity = Math.min(1, this.pressure / 300000);
    const gasR = Math.round(59 + gasPressureIntensity * 100);
    const gasG = Math.round(130 - gasPressureIntensity * 80);
    const gasB = Math.round(246 - gasPressureIntensity * 100);
    ctx.fillStyle = `rgba(${gasR},${gasG},${gasB},0.5)`;
    ctx.beginPath(); ctx.roundRect(cx - cw/2 + 2, cy - ch/2 + 2, gasWidth - 2, ch - 4, [0, 0, 0, 0]); ctx.fill();

    // Gas particles (animated)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const t = Date.now() / 1000;
    const numParticles = Math.round(10 + (1 - this.volume / 80) * 15);
    for (let i = 0; i < numParticles; i++) {
      const px = (cx - cw/2 + 10) + Math.abs(Math.sin(t * 3 + i * 2.1)) * (gasWidth - 20);
      const py = (cy - ch/2 + 10) + Math.abs(Math.cos(t * 4 + i * 1.7)) * (ch - 20);
      const pr = 2 + Math.sin(t + i) * 0.5;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    // Piston
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.fillRect(pistonX - 5, cy - ch/2 - 2, 10, ch + 4);
    ctx.strokeRect(pistonX - 5, cy - ch/2 - 2, 10, ch + 4);

    // Piston handle
    ctx.fillStyle = '#475569';
    ctx.fillRect(pistonX + 5, cy - 5, cw - gasWidth + 20, 10);

    // Pressure gauge (circle)
    const gx = cx - cw/2 - 50, gy = cy - 30;
    ctx.fillStyle = 'rgba(30,41,59,0.9)'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx, gy, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center';
    ctx.fillText('P', gx, gy - 8);
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${(this.pressure / 1000).toFixed(1)}`, gx, gy + 6);
    ctx.fillText('kPa', gx, gy + 18);

    // Needle
    const needleAngle = -Math.PI/2 + (this.pressure / 400000) * Math.PI;
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(needleAngle) * 20, gy + Math.sin(needleAngle) * 20);
    ctx.stroke();

    // Labels
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'center';
    ctx.fillText(`V = ${this.volume.toFixed(0)} cm³`, cx, cy + ch/2 + 25);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 220, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 220, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("BOYLE'S LAW", 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`📦 V = ${this.volume.toFixed(0)} cm³`, 20, 48);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`📊 P = ${(this.pressure / 1000).toFixed(1)} kPa`, 20, 66);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`🔗 PV = ${(this.pressure * this.volume / 1000).toFixed(0)} kPa·cm³`, 20, 84);
  }

  measure(): DataPoint {
    const pReading = this.pressureGauge.read(this.world.getTime());
    const pKpa = pReading.value / 1000;
    return {
      'V': this.volume,
      'P_kPa': Number(pKpa.toFixed(1)),
      '1/V': Number((1 / this.volume).toFixed(4)),
      'PV': Number((pKpa * this.volume).toFixed(0)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const volumes = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70];
    for (const v of volumes) {
      this.volume = v;
      this.pressure = this.initialPV / v;
      this.pressureGauge.setPressureValue(this.pressure);
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('C-12', "Boyle's Law", 'heat', () => new BoylesLawKit());
