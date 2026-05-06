import { Vector2 } from '../../core/Vector2.ts';
/**
 * GalvaniyPhysics - Speed of Sound Kit (Experiment D-15)
 * UoN Manual: Resonance tube method - determine speed of sound.
 * Physics: λ = 4(L + 0.3d) for closed tube, v = fλ
 */
import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { Ruler } from '../../measurement/Instrument.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class SpeedOfSoundKit extends ApparatusKit {
  readonly kitId = 'SpeedOfSound'; readonly name = 'Speed of Sound - Resonance Tube';
  readonly experimentCode = 'D-15'; readonly category = 'waves' as const;

  private frequency = 512; private tubeDiameter = 0.04; // m
  private waterLevel = 0.5; // m from top (adjustable)
  private airColumnLength = 0; // m
  private resonanceN = 1; // nth harmonic found
  private speed = 343; // actual speed of sound
  private ruler: Ruler;
  private animPhase = 0; private atResonance = false;

  constructor() {
    super();
    this.ruler = new Ruler({ precision: 3, noise: 0.001 });
    this.addInstrument(this.ruler);
    this.updateAirColumn();
  }

  private updateAirColumn(): void {
    this.airColumnLength = this.waterLevel;
    const endCorrection = 0.3 * this.tubeDiameter;
    const theoreticalLambda = this.speed / this.frequency;
    // Resonance when L + 0.3d = nλ/4 (n = 1, 3, 5...)
    for (let n = 1; n <= 7; n += 2) {
      const lRes = n * theoreticalLambda / 4 - endCorrection;
      if (Math.abs(this.waterLevel - lRes) < 0.008) {
        this.atResonance = true; this.resonanceN = n;
        return;
      }
    }
    this.atResonance = false;
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100; this.world.bounds = { width: canvas.width, height: canvas.height };
    this.renderer = new CanvasRenderer(canvas); this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx) => this.draw(ctx));
    this.world.onStep(() => { this.animPhase += 0.08; });
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'waterLevel') this.waterLevel = val / 100;
    if (id === 'frequency') this.frequency = val;
    this.updateAirColumn();
  }

  addApparatusComponent(id: string, position: Vector2): boolean {
    return false;
  }

  getControls(): LabControl[] {
    return [
      { id: 'waterLevel', label: 'Air Column Length', min: 5, max: 90, value: 50, step: 1, unit: 'cm' },
      { id: 'frequency', label: 'Fork Frequency', min: 256, max: 1024, value: 512, step: 256, unit: 'Hz' },
    ];
  }
  getDataTable(): DataTableConfig {
    return { id: 'sound_data', title: 'Speed of Sound Data',
      headers: ['f (Hz)', 'L₁ (cm)', 'L₂ (cm)', 'λ (m)', 'v (m/s)'], rows: 4 };
  }
  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Strike tuning fork and hold above tube.', expectedAction: 'observe' },
      { index: 1, instruction: 'Slowly lower water to find first resonance (L₁).', expectedAction: 'adjust' },
      { index: 2, instruction: 'Continue to find second resonance (L₂).', expectedAction: 'adjust' },
      { index: 3, instruction: 'λ = 2(L₂ - L₁), v = fλ.', expectedAction: 'record' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const tubeX = 400, tubeTop = 60, tubeH = 380, tubeW = 40;
    // Tube
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.strokeRect(tubeX - tubeW/2, tubeTop, tubeW, tubeH);
    // Water
    const waterTop = tubeTop + (this.waterLevel / 0.9) * tubeH;
    ctx.fillStyle = 'rgba(59,130,246,0.4)';
    ctx.fillRect(tubeX - tubeW/2 + 1, waterTop, tubeW - 2, tubeTop + tubeH - waterTop);
    // Air column
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(tubeX - tubeW/2 + 1, tubeTop + 1, tubeW - 2, waterTop - tubeTop - 1);
    // Standing wave visualization
    if (this.atResonance) {
      ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = tubeTop; y < waterTop; y += 1) {
        const t = (y - tubeTop) / (waterTop - tubeTop);
        const x = tubeX + Math.sin(t * this.resonanceN * Math.PI / 2) * (tubeW/2 - 4) * Math.sin(this.animPhase * 8);
        if (y === tubeTop) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Tuning fork
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3;
    const forkX = tubeX, forkY = tubeTop - 20;
    ctx.beginPath(); ctx.moveTo(forkX, forkY - 25); ctx.lineTo(forkX, forkY + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(forkX - 6, forkY - 25); ctx.lineTo(forkX - 6, forkY - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(forkX + 6, forkY - 25); ctx.lineTo(forkX + 6, forkY - 5); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#a855f7'; ctx.textAlign = 'center';
    ctx.fillText(`${this.frequency} Hz`, forkX, forkY - 30);
    // Length marker
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(tubeX + tubeW/2 + 15, tubeTop); ctx.lineTo(tubeX + tubeW/2 + 15, waterTop); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'left';
    ctx.fillText(`L = ${(this.waterLevel * 100).toFixed(1)} cm`, tubeX + tubeW/2 + 20, (tubeTop + waterTop) / 2);
    // Resonance indicator
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = this.atResonance ? '#22c55e' : '#64748b';
    ctx.fillText(this.atResonance ? `🔊 Resonance! (n=${this.resonanceN})` : '🔇', tubeX, tubeTop + tubeH + 30);
    // HUD
    const vCalc = this.frequency * 4 * (this.waterLevel + 0.3 * this.tubeDiameter) / this.resonanceN;
    ctx.fillStyle = 'rgba(30,41,59,0.85)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 90, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('SPEED OF SOUND', 20, 28);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#22d3ee';
    ctx.fillText(`v_calc = ${vCalc.toFixed(1)} m/s (actual: ${this.speed})`, 20, 48);
    ctx.fillStyle = '#f59e0b'; ctx.fillText(`λ = ${(this.speed / this.frequency).toFixed(3)} m`, 20, 66);
    ctx.fillStyle = '#a855f7'; ctx.fillText(`L = ${(this.waterLevel * 100).toFixed(1)} cm`, 20, 84);
  }

  measure(): DataPoint {
    const endC = 0.3 * this.tubeDiameter;
    const lambda = this.speed / this.frequency;
    const L1 = lambda / 4 - endC;
    const L2 = 3 * lambda / 4 - endC;
    const lambdaMeas = 2 * (this.addNoise(L2, 0.002) - this.addNoise(L1, 0.002));
    const vMeas = this.frequency * lambdaMeas;
    return {
      'f': this.frequency, 'L1_cm': Number((L1 * 100).toFixed(1)),
      'L2_cm': Number((L2 * 100).toFixed(1)), 'lambda': Number(lambdaMeas.toFixed(3)),
      'v': Number(vMeas.toFixed(1)),
    };
  }

  autoRun(): DataPoint[] {
    const data: DataPoint[] = [];
    const freqs = [256, 384, 512, 1024];
    for (const f of freqs) { this.frequency = f; data.push(this.measure()); }
    return data;
  }
  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}
KitRegistry.register('D-15', 'Speed of Sound', 'waves', () => new SpeedOfSoundKit());
