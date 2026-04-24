/**
 * GalvaniyPhysics - Wheatstone Bridge Kit (Experiment F-19/20)
 * UoN Manual: Determine unknown resistance using Wheatstone bridge.
 * Physics: At balance, R1/R2 = R3/R4, or Rx = R · L2/L1 (meter bridge)
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ammeter, Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class WheatstoneKit extends ApparatusKit {
  readonly kitId = 'Wheatstone'; readonly name = 'Wheatstone Bridge';
  readonly experimentCode = 'F-19'; readonly category = 'electricity' as const;

  private Rx = 47; // unknown resistance (Ω)
  private R = 100; // known resistance (Ω)
  private L1 = 50; // cm, jockey position on meter bridge
  private galvDeflection = 0;
  private galvammeter: Ammeter; private ruler: Ruler;


  constructor() {
    super();
    this.galvammeter = new Ammeter({ noise: 0.001 });
    this.ruler = new Ruler({ precision: 1, noise: 0.5 });
    this.addInstrument(this.galvammeter); this.addInstrument(this.ruler);
    this.updateBridge();
  }

  private updateBridge(): void {
    // Meter bridge: balance when Rx/R = L1/L2 → Rx = R·L1/(100-L1)
    // Galvanometer deflection proportional to imbalance
    const L2 = 100 - this.L1;
    const ratio = this.L1 / (L2 || 1);
    const balanceRatio = this.Rx / this.R;
    this.galvDeflection = (ratio - balanceRatio) * 50; // arbitrary scale
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'jockeyPos') this.L1 = val;
    if (id === 'R') this.R = val;
    this.updateBridge();
  }

  getControls(): LabControl[] {
    return [
      { id: 'jockeyPos', label: 'Jockey Position', min: 5, max: 95, value: 50, step: 1, unit: 'cm' },
      { id: 'R', label: 'Known Resistance', min: 10, max: 500, value: 100, step: 10, unit: 'Ω' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'wheatstone_data', title: 'Wheatstone Bridge Data',
      headers: ['R (Ω)', 'L₁ (cm)', 'L₂ (cm)', 'Rx = R·L₁/L₂ (Ω)'], rows: 5 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Connect unknown Rx and known R to the bridge.', expectedAction: 'adjust' },
      { index: 1, instruction: 'Slide jockey along wire until galvanometer reads zero.', expectedAction: 'adjust' },
      { index: 2, instruction: 'Read balance length L₁. L₂ = 100 - L₁.', expectedAction: 'measure' },
      { index: 3, instruction: 'Calculate Rx = R · L₁/L₂.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const wireStartX = 100, wireEndX = 700, wireY = 350, wireLen = wireEndX - wireStartX;

    // Meter bridge wire
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(wireStartX, wireY); ctx.lineTo(wireEndX, wireY); ctx.stroke();
    // Scale markings
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
    for (let cm = 0; cm <= 100; cm += 10) {
      const x = wireStartX + (cm / 100) * wireLen;
      const h = cm % 50 === 0 ? 12 : 6;
      ctx.beginPath(); ctx.moveTo(x, wireY + 5); ctx.lineTo(x, wireY + 5 + h); ctx.stroke();
      if (cm % 20 === 0) {
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#64748b'; ctx.textAlign = 'center';
        ctx.fillText(`${cm}`, x, wireY + 25);
      }
    }

    // Resistance boxes (top)
    const midX = (wireStartX + wireEndX) / 2;
    // Rx box (left)
    ctx.fillStyle = 'rgba(239,68,68,0.2)'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(wireStartX + 50, 150, 100, 50, 8); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center';
    ctx.fillText(`Rx = ?`, wireStartX + 100, 180);
    // R box (right)
    ctx.fillStyle = 'rgba(59,130,246,0.2)'; ctx.strokeStyle = '#3b82f6';
    ctx.beginPath(); ctx.roundRect(wireEndX - 150, 150, 100, 50, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b82f6'; ctx.fillText(`R = ${this.R}Ω`, wireEndX - 100, 180);

    // Connecting wires
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
    // Left connections
    ctx.beginPath(); ctx.moveTo(wireStartX, wireY); ctx.lineTo(wireStartX, 175);
    ctx.lineTo(wireStartX + 50, 175); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wireStartX + 150, 175); ctx.lineTo(midX, 175);
    ctx.lineTo(midX, 120); ctx.stroke();
    // Right connections
    ctx.beginPath(); ctx.moveTo(wireEndX, wireY); ctx.lineTo(wireEndX, 175);
    ctx.lineTo(wireEndX - 50, 175); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wireEndX - 150, 175); ctx.lineTo(midX, 175); ctx.stroke();

    // Jockey position
    const jockeyX = wireStartX + (this.L1 / 100) * wireLen;
    ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(jockeyX, wireY - 3); ctx.lineTo(jockeyX - 4, wireY - 15);
    ctx.lineTo(jockeyX + 4, wireY - 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Jockey wire to galvanometer
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(jockeyX, wireY - 15); ctx.lineTo(midX, 120); ctx.stroke();

    // Galvanometer
    const gx = midX, gy = 90;
    ctx.fillStyle = 'rgba(30,41,59,0.9)'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx, gy, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText('G', gx, gy - 5);
    // Needle
    const needleAngle = Math.max(-1, Math.min(1, this.galvDeflection / 20));
    ctx.strokeStyle = Math.abs(needleAngle) < 0.05 ? '#22c55e' : '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 20 * Math.sin(needleAngle), gy + 20 * Math.cos(needleAngle)); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = Math.abs(needleAngle) < 0.05 ? '#22c55e' : '#e2e8f0';
    ctx.fillText(Math.abs(needleAngle) < 0.05 ? 'BALANCED ✓' : `δ = ${this.galvDeflection.toFixed(1)}`, gx, gy + 45);

    // L1, L2 labels
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'center';
    ctx.fillText(`L₁ = ${this.L1.toFixed(0)} cm`, (wireStartX + jockeyX) / 2, wireY + 40);
    ctx.fillText(`L₂ = ${(100 - this.L1).toFixed(0)} cm`, (jockeyX + wireEndX) / 2, wireY + 40);

    // HUD
    const RxCalc = this.R * this.L1 / (100 - this.L1);
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('WHEATSTONE BRIDGE', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`Rx(calc) = R·L₁/L₂ = ${RxCalc.toFixed(1)} Ω`, 20, 48);
    ctx.fillStyle = '#ef4444'; ctx.fillText(`Rx(actual) = ${this.Rx} Ω`, 20, 66);
    ctx.fillStyle = '#a855f7';
    const err = Math.abs((RxCalc - this.Rx) / this.Rx * 100);
    ctx.fillText(`Error = ${err.toFixed(1)}%`, 20, 84);
  }

  measure(): DataPoint {
    // Find balance point: Rx/R = L1/(100-L1) → L1 = 100·Rx/(Rx+R)
    const L1Balance = 100 * this.Rx / (this.Rx + this.R);
    const L1Meas = this.addNoise(L1Balance, 0.5);
    const L2 = 100 - L1Meas;
    const RxCalc = this.R * L1Meas / L2;
    return {
      'R': this.R, 'L1': Number(L1Meas.toFixed(1)),
      'L2': Number(L2.toFixed(1)), 'Rx': Number(RxCalc.toFixed(1)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const resistances = [20, 50, 100, 200, 500];
    for (const r of resistances) { this.R = r; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('F-19', 'Wheatstone Bridge', 'electricity', () => new WheatstoneKit());
