/**
 * GalvaniyPhysics - Equilibrium of Forces Kit (Experiment A-3)
 * UoN Manual: Resolve forces using a force table (Lami's theorem).
 * Physics: ΣF = 0 at equilibrium, Lami: F1/sin α1 = F2/sin α2 = F3/sin α3
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Protractor } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

interface ForceVec { magnitude: number; angle: number; color: string; }

export class EquilibriumOfForcesKit extends ApparatusKit {
  readonly kitId = 'EquilibriumOfForces';
  readonly name = 'Equilibrium of Forces - Force Table';
  readonly experimentCode = 'A-3';
  readonly category = 'mechanics' as const;

  private forces: ForceVec[] = [
    { magnitude: 1.5, angle: 0, color: '#3b82f6' },
    { magnitude: 2.0, angle: 120, color: '#22d3ee' },
    { magnitude: 0, angle: 0, color: '#a855f7' }, // equilibrant - auto-calculated
  ];
  private protractor: Protractor;


  constructor() {
    super();
    this.protractor = new Protractor({ noise: 0.5 });
    this.addInstrument(this.protractor);
    this.calculateEquilibrant();
  }

  private calculateEquilibrant(): void {
    // Sum of F1 and F2 vectors
    const f1 = this.forces[0];
    const f2 = this.forces[1];
    const fx = f1.magnitude * Math.cos(f1.angle * Math.PI / 180) +
               f2.magnitude * Math.cos(f2.angle * Math.PI / 180);
    const fy = f1.magnitude * Math.sin(f1.angle * Math.PI / 180) +
               f2.magnitude * Math.sin(f2.angle * Math.PI / 180);
    // Equilibrant is equal and opposite to resultant
    this.forces[2].magnitude = Math.sqrt(fx * fx + fy * fy);
    this.forces[2].angle = (Math.atan2(-fy, -fx) * 180 / Math.PI + 360) % 360;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('f1_mag', 1.5);
    this.controlValues.set('f1_angle', 0);
    this.controlValues.set('f2_mag', 2.0);
    this.controlValues.set('f2_angle', 120);
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'f1_mag') this.forces[0].magnitude = val;
    if (id === 'f1_angle') this.forces[0].angle = val;
    if (id === 'f2_mag') this.forces[1].magnitude = val;
    if (id === 'f2_angle') this.forces[1].angle = val;
    this.calculateEquilibrant();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'f1_mag', label: 'Force 1 (N)', min: 0.5, max: 5, value: 1.5, step: 0.1, unit: 'N' },
      { id: 'f1_angle', label: 'Angle 1 (°)', min: 0, max: 359, value: 0, step: 1, unit: '°' },
      { id: 'f2_mag', label: 'Force 2 (N)', min: 0.5, max: 5, value: 2.0, step: 0.1, unit: 'N' },
      { id: 'f2_angle', label: 'Angle 2 (°)', min: 0, max: 359, value: 120, step: 1, unit: '°' },
    ];
  }

  getDataTable(): DataTableConfig {
    return {
      id: 'forces_data', title: 'Force Equilibrium Data',
      headers: ['F1 (N)', 'θ1 (°)', 'F2 (N)', 'θ2 (°)', 'F3 (N)', 'θ3 (°)'], rows: 6,
    };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Set F1 and F2 with known masses and angles.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Find equilibrant F3 that balances the system.', expectedAction: 'observe' },
      { index: 2, instruction: 'Record all forces and angles.', expectedAction: 'record' },
      { index: 3, instruction: 'Verify Lami\'s theorem: F/sinα = constant.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const cx = 400, cy = 300, tableR = 130;

    // Force table (circle)
    ctx.fillStyle = 'rgba(30,41,59,0.6)';
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, tableR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Angle markings
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 0.5;
    for (let a = 0; a < 360; a += 10) {
      const rad = a * Math.PI / 180;
      const inner = a % 30 === 0 ? tableR - 15 : tableR - 8;
      ctx.beginPath();
      ctx.moveTo(cx + inner * Math.cos(rad), cy - inner * Math.sin(rad));
      ctx.lineTo(cx + tableR * Math.cos(rad), cy - tableR * Math.sin(rad));
      ctx.stroke();
      if (a % 30 === 0) {
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
        ctx.fillText(`${a}°`, cx + (tableR + 15) * Math.cos(rad), cy - (tableR + 15) * Math.sin(rad) + 3);
      }
    }

    // Center ring
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Force vectors
    const labels = ['F₁', 'F₂', 'F₃ (Equilibrant)'];
    for (let i = 0; i < this.forces.length; i++) {
      const f = this.forces[i];
      const rad = f.angle * Math.PI / 180;
      const len = (f.magnitude / 5) * tableR * 0.8;
      const ex = cx + len * Math.cos(rad);
      const ey = cy - len * Math.sin(rad);

      // Arrow line
      ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();

      // Arrowhead
      const arrowSize = 10;
      const aAngle = Math.atan2(cy - ey, ex - cx);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - arrowSize * Math.cos(aAngle - 0.4), ey + arrowSize * Math.sin(aAngle - 0.4));
      ctx.lineTo(ex - arrowSize * Math.cos(aAngle + 0.4), ey + arrowSize * Math.sin(aAngle + 0.4));
      ctx.closePath(); ctx.fill();

      // Label
      const lx = cx + (len + 25) * Math.cos(rad);
      const ly = cy - (len + 25) * Math.sin(rad);
      ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillStyle = f.color; ctx.textAlign = 'center';
      ctx.fillText(`${labels[i]}: ${f.magnitude.toFixed(1)}N`, lx, ly);
      ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${f.angle.toFixed(0)}°`, lx, ly + 14);
    }

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 70, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 230, 70, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('EQUILIBRIUM OF FORCES', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    const res = this.getResultant();
    ctx.fillText(`ΣF = ${res.toFixed(3)} N (should be ≈0)`, 20, 48);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`Lami verified: ${this.checkLami() ? '✅' : '❌'}`, 20, 66);
  }

  private getResultant(): number {
    let fx = 0, fy = 0;
    for (const f of this.forces) {
      fx += f.magnitude * Math.cos(f.angle * Math.PI / 180);
      fy += f.magnitude * Math.sin(f.angle * Math.PI / 180);
    }
    return Math.sqrt(fx * fx + fy * fy);
  }

  private checkLami(): boolean {
    // Lami: F1/sin(α1) = F2/sin(α2) = F3/sin(α3)
    // where α_i is the angle OPPOSITE to F_i
    const angles = this.forces.map(f => f.angle);
    const opp = [
      ((angles[1] - angles[2] + 360) % 360),
      ((angles[2] - angles[0] + 360) % 360),
      ((angles[0] - angles[1] + 360) % 360),
    ];
    const ratios = this.forces.map((f, i) =>
      f.magnitude / Math.sin(opp[i] * Math.PI / 180)
    );
    const maxDiff = Math.max(...ratios) - Math.min(...ratios);
    return maxDiff < 0.2; // within tolerance
  }

  measure(): DataPoint {
    this.calculateEquilibrant();
    return {
      'F1': this.forces[0].magnitude, 'θ1': this.forces[0].angle,
      'F2': this.forces[1].magnitude, 'θ2': this.forces[1].angle,
      'F3': Number(this.forces[2].magnitude.toFixed(2)),
      'θ3': Number(this.forces[2].angle.toFixed(1)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const configs = [
      { f1: 1.5, a1: 0, f2: 2.0, a2: 120 },
      { f1: 2.0, a1: 30, f2: 2.0, a2: 150 },
      { f1: 1.0, a1: 0, f2: 1.0, a2: 90 },
      { f1: 3.0, a1: 45, f2: 2.5, a2: 180 },
      { f1: 1.5, a1: 10, f2: 3.0, a2: 250 },
      { f1: 2.5, a1: 60, f2: 1.5, a2: 200 },
    ];
    for (const c of configs) {
      this.forces[0] = { magnitude: c.f1, angle: c.a1, color: '#3b82f6' };
      this.forces[1] = { magnitude: c.f2, angle: c.a2, color: '#22d3ee' };
      this.calculateEquilibrant();
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('A-3', 'Equilibrium of Forces', 'mechanics', () => new EquilibriumOfForcesKit());
