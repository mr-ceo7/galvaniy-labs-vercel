/**
 * GalvaniyPhysics — Snell's Law Kit (Experiment E-16)
 * UoN Manual: Verify n₁sinθ₁ = n₂sinθ₂, find refractive index.
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Protractor } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class SnellsLawKit extends ApparatusKit {
  readonly kitId = 'SnellsLaw'; readonly name = "Snell's Law — Refraction";
  readonly experimentCode = 'E-16'; readonly category = 'optics' as const;

  private n1 = 1.0; private n2 = 1.5; // glass
  private incidentAngle = 30; // degrees
  private refractedAngle = 0;
  private protractor: Protractor;

  constructor() {
    super();
    this.protractor = new Protractor({ noise: 0.5, precision: 1 });
    this.addInstrument(this.protractor);
    this.calculateRefraction();
  }

  private calculateRefraction(): void {
    const sinR = (this.n1 / this.n2) * Math.sin(this.incidentAngle * Math.PI / 180);
    this.refractedAngle = sinR <= 1 ? Math.asin(sinR) * 180 / Math.PI : 90; // total internal reflection
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'incidentAngle') this.incidentAngle = val;
    if (id === 'n2') this.n2 = val;
    this.calculateRefraction();
  }

  getControls(): LabControl[] {
    return [
      { id: 'incidentAngle', label: 'Angle of Incidence', min: 0, max: 85, value: 30, step: 5, unit: '°' },
      { id: 'n2', label: 'Refractive Index (n₂)', min: 1.0, max: 2.5, value: 1.5, step: 0.1, unit: '' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'snell_data', title: "Snell's Law Data",
      headers: ['θ_i (°)', 'θ_r (°)', 'sin θ_i', 'sin θ_r', 'n = sin θ_i/sin θ_r'], rows: 8 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Place glass block on outline. Shine ray at angle θ_i.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Mark incident and refracted ray positions.', expectedAction: 'observe' },
      { index: 2, instruction: 'Measure θ_r with protractor.', expectedAction: 'measure' },
      { index: 3, instruction: 'Plot sin θ_i vs sin θ_r. Slope = n₂/n₁.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const cx = 400, cy = 280, halfW = 200;

    // Interface line
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - halfW, cy); ctx.lineTo(cx + halfW, cy); ctx.stroke();

    // Medium labels
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx - halfW, cy, halfW * 2, 200); // glass block
    ctx.fillStyle = '#94a3b8'; ctx.fillText(`Air (n = ${this.n1.toFixed(1)})`, cx, cy - 150);
    ctx.fillStyle = '#60a5fa'; ctx.fillText(`Glass (n = ${this.n2.toFixed(1)})`, cx, cy + 180);

    // Normal line (dashed)
    ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(cx, cy - 140); ctx.lineTo(cx, cy + 140); ctx.stroke();
    ctx.setLineDash([]);

    // Incident ray (from top-left to center)
    const iRad = this.incidentAngle * Math.PI / 180;
    const rayLen = 180;
    const ix = cx - rayLen * Math.sin(iRad);
    const iy = cy - rayLen * Math.cos(iRad);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(cx, cy); ctx.stroke();
    // Arrow on incident ray
    const iMidX = (ix + cx) / 2, iMidY = (iy + cy) / 2;
    ctx.fillStyle = '#ef4444';
    const iDir = Math.atan2(cy - iy, cx - ix);
    ctx.beginPath();
    ctx.moveTo(iMidX + 8 * Math.cos(iDir), iMidY + 8 * Math.sin(iDir));
    ctx.lineTo(iMidX - 5 * Math.cos(iDir - 0.5), iMidY - 5 * Math.sin(iDir - 0.5));
    ctx.lineTo(iMidX - 5 * Math.cos(iDir + 0.5), iMidY - 5 * Math.sin(iDir + 0.5));
    ctx.closePath(); ctx.fill();

    // Refracted ray (from center downward)
    const rRad = this.refractedAngle * Math.PI / 180;
    const rx = cx + rayLen * Math.sin(rRad);
    const ry = cy + rayLen * Math.cos(rRad);
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(rx, ry); ctx.stroke();

    // Reflected ray (partial)
    const reflX = cx + rayLen * 0.4 * Math.sin(iRad);
    const reflY = cy - rayLen * 0.4 * Math.cos(iRad);
    ctx.strokeStyle = 'rgba(239,68,68,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(reflX, reflY); ctx.stroke();
    ctx.setLineDash([]);

    // Angle arcs
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 40, -Math.PI/2, -Math.PI/2 + iRad); ctx.stroke();
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
    ctx.fillText(`θ_i = ${this.incidentAngle}°`, cx - 55, cy - 30);

    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(cx, cy, 40, Math.PI/2 - rRad, Math.PI/2); ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`θ_r = ${this.refractedAngle.toFixed(1)}°`, cx + 55, cy + 40);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText("SNELL'S LAW", 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
    ctx.fillText(`sin(${this.incidentAngle}°) = ${Math.sin(iRad).toFixed(4)}`, 20, 48);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`sin(${this.refractedAngle.toFixed(1)}°) = ${Math.sin(rRad).toFixed(4)}`, 20, 66);
    ctx.fillStyle = '#22d3ee';
    const nMeas = Math.sin(iRad) / Math.sin(rRad);
    ctx.fillText(`n = sin θ_i / sin θ_r = ${isFinite(nMeas) ? nMeas.toFixed(3) : '∞'}`, 20, 84);
  }

  measure(): DataPoint {
    this.calculateRefraction();
    const iRad = this.incidentAngle * Math.PI / 180;
    const rRad = this.addNoise(this.refractedAngle, 0.5) * Math.PI / 180;
    const sinI = Math.sin(iRad);
    const sinR = Math.sin(rRad);
    return {
      'theta_i': this.incidentAngle,
      'theta_r': Number(this.addNoise(this.refractedAngle, 0.5).toFixed(1)),
      'sin_i': Number(sinI.toFixed(4)), 'sin_r': Number(sinR.toFixed(4)),
      'n': Number((sinI / sinR).toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const angles = [10, 20, 30, 40, 50, 60, 70, 80];
    for (const a of angles) { this.incidentAngle = a; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('E-16', "Snell's Law", 'optics', () => new SnellsLawKit());
