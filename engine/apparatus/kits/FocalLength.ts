import { Vector2 } from '../../core/Vector2.ts';
/**
 * GalvaniyPhysics - Focal Length of Lenses Kit (Experiment E-17)
 * UoN Manual: Thin lens equation 1/f = 1/u + 1/v
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class FocalLengthKit extends ApparatusKit {
  readonly kitId = 'FocalLength'; readonly name = 'Focal Length of Lenses';
  readonly experimentCode = 'E-17'; readonly category = 'optics' as const;

  private focalLength = 0.15; // m (15 cm convex)
  private objectDist = 0.3; // m
  private imageDist = 0; // m
  private magnification = 0;
  private imageReal = true; private imageInverted = true;
  private ruler: Ruler;

  constructor() {
    super();
    this.ruler = new Ruler({ precision: 2, noise: 0.002 });
    this.addInstrument(this.ruler);
    this.calculateImage();
  }

  private calculateImage(): void {
    // 1/f = 1/u + 1/v → v = uf/(u-f)
    const denom = this.objectDist - this.focalLength;
    if (Math.abs(denom) < 0.001) { this.imageDist = Infinity; this.magnification = Infinity; return; }
    this.imageDist = this.objectDist * this.focalLength / denom;
    this.magnification = -this.imageDist / this.objectDist;
    this.imageReal = this.imageDist > 0;
    this.imageInverted = this.imageDist > 0;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'objectDist') this.objectDist = val / 100;
    if (id === 'focalLength') this.focalLength = val / 100;
    this.calculateImage();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'objectDist', label: 'Object Distance (u)', min: 10, max: 80, value: 30, step: 2, unit: 'cm' },
      { id: 'focalLength', label: 'Focal Length', min: 5, max: 30, value: 15, step: 1, unit: 'cm' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'lens_data', title: 'Lens Data',
      headers: ['u (cm)', 'v (cm)', '1/u', '1/v', 'f (cm)', 'm'], rows: 8 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Place object at distance u from lens.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Move screen to find sharp image. Measure v.', expectedAction: 'measure' },
      { index: 2, instruction: 'Repeat for different u values.', expectedAction: 'adjust' },
      { index: 3, instruction: 'Plot 1/v vs 1/u. Intercepts give 1/f.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const lensX = 400, axisY = 280, scale = 500;
    // Principal axis
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(50, axisY); ctx.lineTo(750, axisY); ctx.stroke();

    // Lens
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lensX, axisY - 80);
    ctx.quadraticCurveTo(lensX + 15, axisY, lensX, axisY + 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lensX, axisY - 80);
    ctx.quadraticCurveTo(lensX - 15, axisY, lensX, axisY + 80);
    ctx.stroke();

    // Focal points
    const fp = this.focalLength * scale;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(lensX - fp, axisY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lensX + fp, axisY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center';
    ctx.fillText('F', lensX - fp, axisY + 15);
    ctx.fillText('F\'', lensX + fp, axisY + 15);

    // Object (arrow)
    const objX = lensX - this.objectDist * scale;
    const objH = 50;
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(objX, axisY); ctx.lineTo(objX, axisY - objH); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(objX, axisY - objH);
    ctx.lineTo(objX - 5, axisY - objH + 10);
    ctx.lineTo(objX + 5, axisY - objH + 10);
    ctx.closePath(); ctx.fill();
    ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Object', objX, axisY + 15);

    // Image (if real and finite)
    if (isFinite(this.imageDist) && Math.abs(this.imageDist) < 1.5) {
      const imgX = lensX + this.imageDist * scale;
      const imgH = objH * Math.abs(this.magnification);
      const imgTop = this.imageInverted ? axisY + imgH : axisY - imgH;
      ctx.strokeStyle = this.imageReal ? '#3b82f6' : 'rgba(59,130,246,0.5)';
      ctx.lineWidth = 3;
      if (!this.imageReal) { ctx.setLineDash([5, 5]); }
      ctx.beginPath(); ctx.moveTo(imgX, axisY); ctx.lineTo(imgX, imgTop); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.imageReal ? '#3b82f6' : 'rgba(59,130,246,0.5)';
      const arrowDir = this.imageInverted ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(imgX, imgTop);
      ctx.lineTo(imgX - 5, imgTop - arrowDir * 10);
      ctx.lineTo(imgX + 5, imgTop - arrowDir * 10);
      ctx.closePath(); ctx.fill();
      ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#3b82f6'; ctx.textAlign = 'center';
      ctx.fillText(this.imageReal ? 'Real Image' : 'Virtual Image', imgX, axisY + 15);

      // Ray tracing (3 principal rays)
      ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      // Ray 1: parallel to axis → through F'
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath(); ctx.moveTo(objX, axisY - objH); ctx.lineTo(lensX, axisY - objH);
      ctx.lineTo(imgX, imgTop); ctx.stroke();
      // Ray 2: through center → straight
      ctx.strokeStyle = '#a855f7';
      ctx.beginPath(); ctx.moveTo(objX, axisY - objH); ctx.lineTo(imgX, imgTop); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 260, 110, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 260, 110, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('THIN LENS - FOCAL LENGTH', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
    ctx.fillText(`u = ${(this.objectDist * 100).toFixed(1)} cm`, 20, 48);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`v = ${isFinite(this.imageDist) ? (this.imageDist * 100).toFixed(1) : '∞'} cm`, 20, 66);
    ctx.fillStyle = '#f59e0b'; ctx.fillText(`f = ${(this.focalLength * 100).toFixed(1)} cm`, 20, 84);
    ctx.fillStyle = '#22d3ee';
    const fCalc = isFinite(this.imageDist) ?
      1 / (1/this.objectDist + 1/this.imageDist) * 100 : this.focalLength * 100;
    ctx.fillText(`f_calc = ${fCalc.toFixed(1)} cm | m = ${isFinite(this.magnification) ? this.magnification.toFixed(2) : '∞'}`, 20, 102);
  }

  measure(): DataPoint {
    this.calculateImage();
    const u = this.addNoise(this.objectDist * 100, 0.2);
    const v = isFinite(this.imageDist) ? this.addNoise(this.imageDist * 100, 0.2) : Infinity;
    const fCalc = isFinite(v) ? 1 / (1/(u/100) + 1/(v/100)) * 100 : this.focalLength * 100;
    return {
      'u_cm': Number(u.toFixed(1)), 'v_cm': isFinite(v) ? Number(v.toFixed(1)) : '∞',
      '1/u': Number((100/u).toFixed(3)), '1/v': isFinite(v) ? Number((100/v).toFixed(3)) : 0,
      'f_cm': Number(fCalc.toFixed(1)), 'm': Number(this.magnification.toFixed(2)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const distances = [20, 25, 30, 35, 40, 50, 60, 80];
    for (const u of distances) { this.objectDist = u / 100; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('E-17', 'Focal Length of Lenses', 'optics', () => new FocalLengthKit());
