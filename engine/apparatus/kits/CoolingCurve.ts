/**
 * GalvaniyPhysics — Newton's Law of Cooling Kit (Experiment C-11)
 * UoN Manual: Investigate Newton's law of cooling — exponential temp decay.
 * Physics: dT/dt = -k(T - T_env), solution T(t) = T_env + (T0 - T_env)e^(-kt)
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Thermometer, Stopwatch } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class CoolingCurveKit extends ApparatusKit {
  readonly kitId = 'CoolingCurve';
  readonly name = "Newton's Law of Cooling";
  readonly experimentCode = 'C-11';
  readonly category = 'heat' as const;

  private initialTemp: number = 80;    // °C
  private ambientTemp: number = 25;    // °C
  private currentTemp: number = 80;
  private coolingConstant: number = 0.02; // k in s⁻¹
  private renderer: CanvasRenderer | null = null;
  private thermometer: Thermometer;
  private stopwatch: Stopwatch;
  private tempHistory: Array<{ time: number; temp: number }> = [];

  constructor() {
    super();
    this.thermometer = new Thermometer({ noise: 0.3, precision: 1 });
    this.stopwatch = new Stopwatch({ noise: 0 });
    this.addInstrument(this.thermometer);
    this.addInstrument(this.stopwatch);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.thermometer = new Thermometer({ noise: 0.3, precision: 1 });
    this.stopwatch = new Stopwatch({ noise: 0 });
    this.addInstrument(this.thermometer);
    this.addInstrument(this.stopwatch);
    this.controlValues.set('initialTemp', this.initialTemp);
    this.controlValues.set('ambientTemp', this.ambientTemp);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));

    this.world.onStep(() => {
      const dt = this.world.timeStep;
      // Newton's law: dT/dt = -k(T - T_env)
      this.currentTemp = this.ambientTemp +
        (this.currentTemp - this.ambientTemp) * Math.exp(-this.coolingConstant * dt);
      this.thermometer.setTargetTemperature(this.currentTemp);
      this.thermometer.update();
      // Record for graph
      if (Math.floor(this.world.getTime()) > (this.tempHistory.length > 0 ? this.tempHistory[this.tempHistory.length - 1].time : -1)) {
        this.tempHistory.push({ time: Math.floor(this.world.getTime()), temp: this.currentTemp });
      }
    });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'initialTemp') { this.initialTemp = val; this.currentTemp = val; this.tempHistory = []; }
    if (id === 'ambientTemp') this.ambientTemp = val;
  }

  getControls(): LabControl[] {
    return [
      { id: 'initialTemp', label: 'Initial Temperature', min: 40, max: 100, value: 80, step: 5, unit: '°C' },
      { id: 'ambientTemp', label: 'Room Temperature', min: 15, max: 35, value: 25, step: 1, unit: '°C' },
    ];
  }

  getDataTable(): DataTableConfig {
    return { id: 'cooling_data', title: 'Temperature vs Time', headers: ['t (s)', 'T (°C)', 'T-T_room (°C)', 'ln(T-T_room)'], rows: 12 };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Heat water to ~80°C.', expectedAction: 'observe' },
      { index: 1, instruction: 'Start stopwatch and record temperature every 30 seconds.', expectedAction: 'measure' },
      { index: 2, instruction: 'Continue until temperature drops to ~35°C.', expectedAction: 'measure' },
      { index: 3, instruction: 'Plot T vs t and ln(T-T_room) vs t.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    // Beaker
    const bx = 350, by = 280, bw = 120, bh = 140;
    // Water (level based on nothing boiling away)
    const waterColor = this.getTemperatureColor(this.currentTemp);
    ctx.fillStyle = waterColor;
    ctx.beginPath();
    ctx.roundRect(bx - bw/2 + 3, by - bh/2 + 20, bw - 6, bh - 23, [0, 0, 8, 8]);
    ctx.fill();

    // Steam particles if hot
    if (this.currentTemp > 60) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      const t = Date.now() / 1000;
      for (let i = 0; i < 5; i++) {
        const sx = bx - 20 + Math.sin(t * 2 + i * 1.2) * 25;
        const sy = by - bh/2 - 10 - ((t * 30 + i * 20) % 50);
        const sr = 3 + Math.sin(t + i) * 2;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Beaker outline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - bw/2, by - bh/2, bw, bh, [0, 0, 10, 10]);
    ctx.stroke();
    // Beaker rim
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - bw/2 - 5, by - bh/2); ctx.lineTo(bx + bw/2 + 5, by - bh/2); ctx.stroke();

    // Thermometer
    const tx = bx + 20, ty = by - bh/2 - 30;
    this.drawThermometer(ctx, tx, ty, this.currentTemp);

    // Real-time temperature graph
    this.drawGraph(ctx);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("NEWTON'S LAW OF COOLING", 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
    ctx.fillText(`🌡 T = ${this.currentTemp.toFixed(1)} °C`, 20, 48);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(`🏠 T_room = ${this.ambientTemp.toFixed(0)} °C`, 20, 66);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`⏱ t = ${this.world.getTime().toFixed(0)} s`, 20, 84);
  }

  private getTemperatureColor(temp: number): string {
    const t = Math.max(0, Math.min(1, (temp - 20) / 80));
    const r = Math.round(30 + t * 200);
    const g = Math.round(80 - t * 40);
    const b = Math.round(200 - t * 150);
    return `rgba(${r},${g},${b},0.7)`;
  }

  private drawThermometer(ctx: CanvasRenderingContext2D, x: number, y: number, temp: number): void {
    const h = 100, w = 12;
    const fill = Math.max(0, Math.min(1, (temp - 10) / 90));

    // Tube
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w/2, y, w, h, 5); ctx.fill(); ctx.stroke();

    // Mercury
    const mercuryH = fill * (h - 10);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.roundRect(x - w/2 + 2, y + h - mercuryH - 5, w - 4, mercuryH, 3); ctx.fill();

    // Bulb
    ctx.beginPath(); ctx.arc(x, y + h + 6, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.stroke();

    // Value
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(`${temp.toFixed(1)}°C`, x, y - 8);
  }

  private drawGraph(ctx: CanvasRenderingContext2D): void {
    if (this.tempHistory.length < 2) return;

    const gx = 500, gy = 60, gw = 250, gh = 160;

    // Background
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.stroke();

    // Title
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText('T vs t', gx + gw / 2, gy + 14);

    // Plot area
    const px = gx + 30, py = gy + 25, pw = gw - 50, ph = gh - 40;
    const maxTime = Math.max(60, this.tempHistory[this.tempHistory.length - 1].time);
    const maxTemp = this.initialTemp + 5;
    const minTemp = this.ambientTemp - 5;

    // Curve
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.tempHistory.length; i++) {
      const pt = this.tempHistory[i];
      const x = px + (pt.time / maxTime) * pw;
      const y = py + ph - ((pt.temp - minTemp) / (maxTemp - minTemp)) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Ambient line
    const ambY = py + ph - ((this.ambientTemp - minTemp) / (maxTemp - minTemp)) * ph;
    ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, ambY); ctx.lineTo(px + pw, ambY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'right';
    ctx.fillText('T_room', px + pw, ambY - 4);
  }

  measure(): DataPoint {
    const t = this.world.getTime();
    const reading = this.thermometer.read(t);
    const diff = reading.value - this.ambientTemp;
    return {
      't': Number(t.toFixed(0)),
      'T': reading.value,
      'T-T_room': Number(diff.toFixed(1)),
      'ln(T-T_room)': diff > 0 ? Number(Math.log(diff).toFixed(3)) : 0,
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    this.currentTemp = this.initialTemp;
    this.world.resetTime();
    this.tempHistory = [];

    for (let t = 0; t <= 600; t += 30) {
      this.currentTemp = this.ambientTemp + (this.initialTemp - this.ambientTemp) * Math.exp(-this.coolingConstant * t);
      this.thermometer.setTargetTemperature(this.currentTemp);
      // Simulate thermometer reaching thermal equilibrium
      for (let i = 0; i < 100; i++) this.thermometer.update();
      const reading = this.thermometer.read(t);
      const diff = reading.value - this.ambientTemp;
      data.push({
        't': t,
        'T': reading.value,
        'T-T_room': Number(diff.toFixed(1)),
        'ln(T-T_room)': diff > 0 ? Number(Math.log(diff).toFixed(3)) : 0,
      });
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('C-11', "Newton's Law of Cooling", 'heat', () => new CoolingCurveKit());
