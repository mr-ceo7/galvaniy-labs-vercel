/**
 * GalvaniyPhysics - Measurement Techniques Kit (Experiment A-1)
 * UoN Manual: Use of vernier caliper and micrometer screw gauge.
 * Physics: Least count, zero error, systematic/random errors.
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class MeasurementTechniquesKit extends ApparatusKit {
  readonly kitId = 'MeasurementTechniques';
  readonly name = 'Measurement Techniques - Vernier & Micrometer';
  readonly experimentCode = 'A-1';
  readonly category = 'measurement' as const;

  // Objects to measure (cylinders, spheres, wires)
  private objectType: 'cylinder' | 'sphere' | 'wire' = 'cylinder';
  private trueDiameter: number = 25.4;  // mm
  private trueLength: number = 50.0;    // mm
  private trueWireDia: number = 0.52;   // mm

  // Instruments
  private vernier: Ruler;
  private micrometer: Ruler;


  // Vernier state
  private vernierReading: number = 0;
  private micrometerReading: number = 0;
  private vernierZeroError: number = 0.02; // mm

  constructor() {
    super();
    this.vernier = new Ruler({
      id: 'vernier', label: 'Vernier Caliper', unit: 'mm',
      precision: 2, noise: 0.02, // ±0.02mm (least count)
    });
    this.micrometer = new Ruler({
      id: 'micrometer', label: 'Micrometer Screw Gauge', unit: 'mm',
      precision: 3, noise: 0.005, // ±0.005mm
      systematicError: 0.01, // small zero error
    });
    this.addInstrument(this.vernier);
    this.addInstrument(this.micrometer);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('objectType', 0);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'objectType') {
      this.objectType = (['cylinder', 'sphere', 'wire'] as const)[Math.floor(val)];
    }
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'objectType', label: 'Object', min: 0, max: 2, value: 0, step: 1, unit: '' },
    ];
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'measurement_data', title: 'Measurement Data',
      headers: ['Trial', 'Vernier (mm)', 'Micrometer (mm)', 'Mean (mm)'], rows: 5,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Check zero error of vernier caliper and micrometer.', expectedAction: 'observe' },
      { index: 1, instruction: 'Measure diameter of cylinder using vernier caliper. Take 5 readings.', expectedAction: 'measure' },
      { index: 2, instruction: 'Measure same diameter using micrometer. Take 5 readings.', expectedAction: 'measure' },
      { index: 3, instruction: 'Calculate mean, standard deviation, and percentage error.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    // Object being measured
    const cx = 400, cy = 280;
    if (this.objectType === 'cylinder') {
      this.drawCylinder(ctx, cx, cy);
    } else if (this.objectType === 'sphere') {
      this.drawSphere(ctx, cx, cy);
    } else {
      this.drawWire(ctx, cx, cy);
    }

    // Vernier caliper visualization
    this.drawVernier(ctx, 100, 120);

    // Micrometer visualization
    this.drawMicrometer(ctx, 500, 120);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 240, 80, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 240, 80, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('MEASUREMENT TECHNIQUES', 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`📏 Object: ${this.objectType}`, 20, 48);
    ctx.fillText(`🔍 Vernier LC: 0.02 mm | Micrometer LC: 0.01 mm`, 20, 68);
  }

  private drawCylinder(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const w = 80, h = 40;
    ctx.fillStyle = '#64748b'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - h/2, w/2, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - w/2, y - h/2, w, h);
    ctx.strokeRect(x - w/2, y - h/2, w, h);
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.ellipse(x, y + h/2, w/2, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(`d = ${this.trueDiameter.toFixed(1)} mm`, x, y + h/2 + 25);
  }

  private drawSphere(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const r = 30;
    const grad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.1, x, y, r);
    grad.addColorStop(0, '#94a3b8'); grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(`d = ${this.trueDiameter.toFixed(1)} mm`, x, y + r + 18);
  }

  private drawWire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 100, y); ctx.lineTo(x + 100, y); ctx.stroke();
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(`d = ${this.trueWireDia.toFixed(2)} mm`, x, y + 18);
  }

  private drawVernier(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = 'rgba(59,130,246,0.2)'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, 180, 50, 5); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#3b82f6'; ctx.textAlign = 'center';
    ctx.fillText('VERNIER CALIPER', x + 90, y + 15);
    ctx.font = '16px monospace'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`${this.vernierReading.toFixed(2)} mm`, x + 90, y + 38);
  }

  private drawMicrometer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = 'rgba(168,85,247,0.2)'; ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, 180, 50, 5); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = '#a855f7'; ctx.textAlign = 'center';
    ctx.fillText('MICROMETER', x + 90, y + 15);
    ctx.font = '16px monospace'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`${this.micrometerReading.toFixed(3)} mm`, x + 90, y + 38);
  }

  measure(): DataPoint {
    const trueVal = this.objectType === 'wire' ? this.trueWireDia : this.trueDiameter;
    this.vernier.setMeasuredValue(trueVal);
    this.micrometer.setMeasuredValue(trueVal);
    const vr = this.vernier.read(0);
    const mr = this.micrometer.read(0);
    this.vernierReading = vr.value;
    this.micrometerReading = mr.value;
    return {
      'vernier_mm': vr.value,
      'micrometer_mm': mr.value,
      'mean_mm': Number(((vr.value + mr.value) / 2).toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    for (let i = 0; i < 5; i++) {
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('A-1', 'Measurement Techniques', 'measurement', () => new MeasurementTechniquesKit());
