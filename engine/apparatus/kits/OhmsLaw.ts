/**
 * GalvaniyPhysics - Ohm's Law Kit (Experiment F-18)
 * UoN Physics Lab Manual: V = IR
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ammeter, Voltmeter } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class OhmsLawKit extends ApparatusKit {
  readonly kitId = 'OhmsLaw';
  readonly name = "Ohm's Law - V-I Characteristics";
  readonly experimentCode = 'F-18';
  readonly category = 'electricity' as const;

  private resistance: number = 100;
  private voltage: number = 0;
  private current: number = 0;
  private ammeter: Ammeter;
  private voltmeter: Voltmeter;


  constructor() {
    super();
    this.ammeter = new Ammeter({ noise: 0.002 });
    this.voltmeter = new Voltmeter({ noise: 0.01 });
    this.addInstrument(this.ammeter);
    this.addInstrument(this.voltmeter);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.ammeter = new Ammeter({ noise: 0.002 });
    this.voltmeter = new Voltmeter({ noise: 0.01 });
    this.addInstrument(this.ammeter);
    this.addInstrument(this.voltmeter);
    this.controlValues.set('voltage', 0);
    this.controlValues.set('resistance', 100);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  private calculateCurrent(): void {
    this.current = this.resistance > 0 ? this.voltage / this.resistance : 0;
    this.ammeter.setCurrentValue(this.current);
    this.voltmeter.setVoltageValue(this.voltage);
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'voltage') this.voltage = val;
    if (id === 'resistance') this.resistance = val;
    this.calculateCurrent();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'voltage', label: 'Applied Voltage', min: 0, max: 10, value: 0, step: 0.5, unit: 'V' },
      { id: 'resistance', label: 'Resistance (R)', min: 10, max: 1000, value: 100, step: 10, unit: 'Ω' },
    ];
  }

  getDataTable(): DataTableConfig {
    return { id: 'ohms_data', title: "Ohm's Law Data", headers: ['V (V)', 'I (mA)', 'R (Ω)'], rows: 10 };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set voltage to 0.5V.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Read ammeter and voltmeter. Record values.', expectedAction: 'measure' },
      { index: 2, instruction: 'Increase voltage in 0.5V steps to 5V. Record at each step.', expectedAction: 'adjust' },
      { index: 3, instruction: 'Plot V vs I. Slope = R.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    this.calculateCurrent();
    const ppm = this.world.pixelsPerMeter;

    // Circuit wires
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Simple rectangular circuit
    const x1 = 150, y1 = 120, x2 = 550, y2 = 380;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y1);
    ctx.lineTo(x2, y2); ctx.lineTo(x1, y2);
    ctx.closePath();
    ctx.stroke();

    // Battery (top-left)
    const bx = x1, by = (y1 + y2) / 2 - 40;
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx, by - 12); ctx.lineTo(bx, by + 12); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 8, by - 7); ctx.lineTo(bx - 8, by + 7); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center';
    ctx.fillText('+', bx + 5, by - 18); ctx.fillText('−', bx - 8, by - 15);

    // Resistor (bottom center)
    const rx = (x1 + x2) / 2, ry = y2;
    ctx.fillStyle = '#854d0e'; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(rx - 25, ry - 8, 50, 16, 3); ctx.fill(); ctx.stroke();
    const bands = ['#ef4444', '#000', '#a16207', '#f59e0b'];
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(rx - 18 + i * 10, ry - 6, 4, 12); });
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(`${this.resistance}Ω`, rx, ry + 22);

    // Ammeter (right side)
    const ax = x2, ay = (y1 + y2) / 2;
    ctx.fillStyle = 'rgba(34,211,238,0.15)'; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ax, ay, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText('A', ax, ay + 5);

    // Voltmeter (center, parallel)
    const vx = (x1 + x2) / 2, vy = (y1 + y2) / 2;
    ctx.fillStyle = 'rgba(168,85,247,0.15)'; ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(vx, vy, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.fillStyle = '#a855f7';
    ctx.fillText('V', vx, vy + 5);
    // Voltmeter leads
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(vx - 18, vy); ctx.lineTo(x1, vy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx + 18, vy); ctx.lineTo(x2, vy); ctx.stroke();
    ctx.setLineDash([]);

    // Current flow dots
    if (this.current > 0) {
      ctx.fillStyle = '#22d3ee';
      const t = Date.now() / 1000;
      for (let i = 0; i < 8; i++) {
        const frac = ((t * this.current * 200 + i * 125) % 1000) / 1000;
        const perimeter = 2 * ((x2 - x1) + (y2 - y1));
        let dist = frac * perimeter;
        let px: number, py: number;
        if (dist < x2 - x1) { px = x1 + dist; py = y1; }
        else if (dist < (x2 - x1) + (y2 - y1)) { dist -= (x2 - x1); px = x2; py = y1 + dist; }
        else if (dist < 2 * (x2 - x1) + (y2 - y1)) { dist -= (x2 - x1) + (y2 - y1); px = x2 - dist; py = y2; }
        else { dist -= 2 * (x2 - x1) + (y2 - y1); px = x1; py = y2 - dist; }
        ctx.beginPath(); ctx.arc(px!, py!, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 220, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 220, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("OHM'S LAW", 20, 30);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`⚡ V = ${this.voltage.toFixed(1)} V`, 20, 50);
    ctx.fillText(`📊 I = ${(this.current * 1000).toFixed(1)} mA`, 20, 68);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`🔧 R = ${this.resistance.toFixed(0)} Ω`, 20, 86);
  }

  measure(): DataPoint {
    this.calculateCurrent();
    const v = this.voltmeter.read(this.world.getTime());
    const i = this.ammeter.read(this.world.getTime());
    return { 'V': v.value, 'I_mA': Number((i.value * 1000).toFixed(1)), 'R': Number((v.value / i.value).toFixed(1)) };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    for (let v = 0.5; v <= 5.0; v += 0.5) {
      this.voltage = v;
      this.calculateCurrent();
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('F-18', "Ohm's Law", 'electricity', () => new OhmsLawKit());
