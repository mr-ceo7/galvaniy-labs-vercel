/**
 * GalvaniyPhysics - Specific Heat Capacity Kit (Experiment C-13)
 * UoN Manual: Method of mixtures to determine specific heat capacity.
 * Physics: m_s c_s (T_s - T_f) = m_w c_w (T_f - T_w)
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Thermometer } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class SpecificHeatKit extends ApparatusKit {
  readonly kitId = 'SpecificHeat'; readonly name = 'Specific Heat Capacity - Method of Mixtures';
  readonly experimentCode = 'C-13'; readonly category = 'heat' as const;

  private solidMass = 0.1; private solidTemp = 100; private solidC = 900; // aluminum J/(kg·K)
  private waterMass = 0.15; private waterTemp = 25; private waterC = 4186;
  private finalTemp = 0; private mixed = false;
  private thermometer: Thermometer;

  constructor() {
    super();
    this.thermometer = new Thermometer({ noise: 0.3, precision: 1 });
    this.addInstrument(this.thermometer);
    this.calculateFinalTemp();
  }

  private calculateFinalTemp(): void {
    // Heat lost by solid = heat gained by water: ms·cs·(Ts-Tf) = mw·cw·(Tf-Tw)
    this.finalTemp = (this.solidMass * this.solidC * this.solidTemp + this.waterMass * this.waterC * this.waterTemp) /
                     (this.solidMass * this.solidC + this.waterMass * this.waterC);
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'solidMass') this.solidMass = val / 1000;
    if (id === 'solidTemp') this.solidTemp = val;
    if (id === 'waterMass') this.waterMass = val / 1000;
    if (id === 'waterTemp') this.waterTemp = val;
    this.calculateFinalTemp();
  }

  getControls(): LabControl[] {
    return [
      { id: 'solidMass', label: 'Solid Mass', min: 50, max: 300, value: 100, step: 10, unit: 'g' },
      { id: 'solidTemp', label: 'Solid Temp', min: 60, max: 100, value: 100, step: 5, unit: '°C' },
      { id: 'waterMass', label: 'Water Mass', min: 100, max: 300, value: 150, step: 10, unit: 'g' },
      { id: 'waterTemp', label: 'Water Temp', min: 15, max: 30, value: 25, step: 1, unit: '°C' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'shc_data', title: 'Specific Heat Data',
      headers: ['m_s (g)', 'T_s (°C)', 'm_w (g)', 'T_w (°C)', 'T_f (°C)', 'c_s (J/kg·K)'], rows: 5 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Heat solid in boiling water. Record T_s.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Quickly transfer to calorimeter with known m_w and T_w.', expectedAction: 'observe' },
      { index: 2, instruction: 'Stir and record final equilibrium temperature T_f.', expectedAction: 'measure' },
      { index: 3, instruction: 'Calculate c_s from energy balance.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Calorimeter (insulated cup)
    const cx = 400, cy = 300, cw = 120, ch = 130;
    ctx.fillStyle = 'rgba(30,41,59,0.5)'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(cx - cw/2, cy - ch/2, cw, ch, [0, 0, 12, 12]); ctx.fill(); ctx.stroke();
    // Water
    const waterH = ch * 0.6;
    const tNorm = (this.finalTemp - 15) / 85;
    const waterR = Math.round(30 + tNorm * 200);
    const waterB = Math.round(200 - tNorm * 150);
    ctx.fillStyle = `rgba(${waterR},80,${waterB},0.6)`;
    ctx.fillRect(cx - cw/2 + 3, cy + ch/2 - waterH, cw - 6, waterH - 3);
    // Solid block in water
    ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(cx - 15, cy + 10, 30, 25, 3); ctx.fill(); ctx.stroke();
    ctx.font = '8px Inter, sans-serif'; ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center';
    ctx.fillText('Al', cx, cy + 27);
    // Thermometer
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + 30, cy - ch/2 - 30); ctx.lineTo(cx + 30, cy + 10); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cx + 30, cy + 15, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'left';
    ctx.fillText(`${this.finalTemp.toFixed(1)}°C`, cx + 42, cy - ch/2 - 20);
    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 260, 110, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 260, 110, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('SPECIFIC HEAT - METHOD OF MIXTURES', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#ef4444';
    ctx.fillText(`Solid: ${(this.solidMass*1000).toFixed(0)}g at ${this.solidTemp}°C`, 20, 48);
    ctx.fillStyle = '#3b82f6'; ctx.fillText(`Water: ${(this.waterMass*1000).toFixed(0)}g at ${this.waterTemp}°C`, 20, 66);
    ctx.fillStyle = '#22d3ee'; ctx.fillText(`T_final = ${this.finalTemp.toFixed(1)}°C`, 20, 84);
    const cMeas = this.waterMass * this.waterC * (this.finalTemp - this.waterTemp) /
                  (this.solidMass * (this.solidTemp - this.finalTemp));
    ctx.fillStyle = '#a855f7'; ctx.fillText(`c_s = ${cMeas.toFixed(0)} J/(kg·K) (actual: ${this.solidC})`, 20, 102);
  }

  measure(): DataPoint {
    this.calculateFinalTemp();
    const tf = this.addNoise(this.finalTemp, 0.3);
    const cMeas = this.waterMass * this.waterC * (tf - this.waterTemp) / (this.solidMass * (this.solidTemp - tf));
    return {
      'ms_g': this.solidMass * 1000, 'Ts': this.solidTemp,
      'mw_g': this.waterMass * 1000, 'Tw': this.waterTemp,
      'Tf': Number(tf.toFixed(1)), 'cs': Number(cMeas.toFixed(0)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const masses = [50, 100, 150, 200, 250];
    for (const m of masses) { this.solidMass = m / 1000; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('C-13', 'Specific Heat Capacity', 'heat', () => new SpecificHeatKit());
