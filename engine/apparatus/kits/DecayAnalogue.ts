/**
 * GalvaniyPhysics - Radioactivity Decay Analogue Kit (Experiment N-1)
 * UoN Manual: Simulate radioactive decay using cubes with one marked face.
 * Physics: N(t) = N₀ × (5/6)^n, λ = ln(6/5), t½ = ln2/λ
 */

import { ApparatusKit, DataPoint } from '../ApparatusKit.ts';
import { Vector2 } from '../../core/Vector2.ts';
import { CanvasRenderer } from '../../renderer/CanvasRenderer.ts';
import { KitRegistry } from '../KitRegistry.ts';
import type { LabControl, ProcedureStep, DataTableConfig } from '../../core/types.ts';

export class DecayAnalogueKit extends ApparatusKit {
  readonly kitId = 'DecayAnalogue';
  readonly name = 'Radioactivity Decay Analogue';
  readonly experimentCode = 'N-1';
  readonly category = 'nuclear' as const;

  private totalCubes: number = 200;
  private remainingCubes: number = 200;
  private throwNumber: number = 0;
  private decayHistory: Array<{ throw: number; remaining: number }> = [];
  private cubeStates: boolean[] = []; // true = active (unmarked face up)

  private isAnimating: boolean = false;
  private animationProgress: number = 1;
  private lastDecayed: Set<number> = new Set();

  setup(canvas: HTMLCanvasElement): void {
    this.world.pixelsPerMeter = 100;
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.controlValues.set('totalCubes', this.totalCubes);
    this.resetCubes();
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, r) => this.draw(ctx, r));
  }

  private resetCubes(): void {
    this.cubeStates = new Array(this.totalCubes).fill(true);
    this.remainingCubes = this.totalCubes;
    this.throwNumber = 0;
    this.decayHistory = [{ throw: 0, remaining: this.totalCubes }];
    this.lastDecayed = new Set();
  }

  /** Perform one throw - each active cube has 1/6 chance of decaying. */
  performThrow(): void {
    this.lastDecayed = new Set();
    for (let i = 0; i < this.cubeStates.length; i++) {
      if (this.cubeStates[i] && Math.random() < 1/6) {
        this.cubeStates[i] = false;
        this.lastDecayed.add(i);
      }
    }
    this.remainingCubes = this.cubeStates.filter(Boolean).length;
    this.throwNumber++;
    this.decayHistory.push({ throw: this.throwNumber, remaining: this.remainingCubes });
    this.isAnimating = true;
    this.animationProgress = 0;
  }

  protected onControlChange(id: string, val: number): void {
    if (id === 'totalCubes') { this.totalCubes = val; this.resetCubes(); }
  }

  getControls(): LabControl[] {
    return [{ id: 'totalCubes', label: 'Number of Cubes', min: 50, max: 500, value: 200, step: 10, unit: '' }];
  }

  getDataTable(): DataTableConfig {
    return { id: 'decay_data', title: 'Decay Data', headers: ['Throw #', 'N remaining', 'N decayed', 'N/N₀'], rows: 15 };
  }

  getProcedure(): ProcedureStep[] {
    return [
      { index: 0, instruction: 'Start with 200 cubes. One face is marked.', expectedAction: 'observe' },
      { index: 1, instruction: 'Throw all cubes. Remove those with marked face up (1/6 chance).', expectedAction: 'measure' },
      { index: 2, instruction: 'Count and record remaining cubes.', expectedAction: 'record' },
      { index: 3, instruction: 'Repeat until fewer than 10 cubes remain.', expectedAction: 'measure' },
      { index: 4, instruction: 'Plot N vs throw number. Fit exponential.', expectedAction: 'observe' },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    // Animate
    if (this.isAnimating && this.animationProgress < 1) {
      this.animationProgress = Math.min(1, this.animationProgress + 0.05);
      if (this.animationProgress >= 1) this.isAnimating = false;
    }

    // Draw cubes grid
    const startX = 60, startY = 100;
    const cubeSize = 18, gap = 3;
    const cols = 20;

    for (let i = 0; i < this.cubeStates.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cubeSize + gap);
      const y = startY + row * (cubeSize + gap);

      if (this.cubeStates[i]) {
        // Active cube
        ctx.fillStyle = '#3b82f6';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x, y, cubeSize, cubeSize, 2); ctx.fill(); ctx.stroke();
      } else if (this.lastDecayed.has(i) && this.animationProgress < 1) {
        // Just decayed - fade out animation
        const alpha = 1 - this.animationProgress;
        ctx.fillStyle = `rgba(239,68,68,${alpha})`;
        ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.8})`;
        ctx.lineWidth = 1;
        const scale = 1 + this.animationProgress * 0.3;
        const offset = (cubeSize * (scale - 1)) / 2;
        ctx.beginPath();
        ctx.roundRect(x - offset, y - offset, cubeSize * scale, cubeSize * scale, 2);
        ctx.fill(); ctx.stroke();
      } else {
        // Already decayed - ghost
        ctx.fillStyle = 'rgba(71,85,105,0.15)';
        ctx.beginPath(); ctx.roundRect(x, y, cubeSize, cubeSize, 2); ctx.fill();
      }
    }

    // Decay graph
    this.drawDecayGraph(ctx);

    // HUD
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 80, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 250, 80, 10); ctx.stroke();
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('RADIOACTIVE DECAY ANALOGUE', 20, 28);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#3b82f6';
    ctx.fillText(`☢ Remaining: ${this.remainingCubes} / ${this.totalCubes}`, 20, 48);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`🎲 Throw #${this.throwNumber} | Decayed: ${this.lastDecayed.size}`, 20, 66);
    const halfLife = Math.log(2) / Math.log(6/5);
    ctx.fillStyle = '#64748b'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`t½(theory) = ${halfLife.toFixed(1)} throws`, 20, 82);
  }

  private drawDecayGraph(ctx: CanvasRenderingContext2D): void {
    if (this.decayHistory.length < 2) return;

    const gx = 500, gy = 100, gw = 260, gh = 180;

    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.stroke();
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText('N vs Throw Number', gx + gw / 2, gy + 14);

    const px = gx + 30, py = gy + 25, pw = gw - 50, ph = gh - 40;
    const maxThrow = Math.max(10, this.decayHistory[this.decayHistory.length - 1].throw);

    // Theoretical curve
    ctx.strokeStyle = 'rgba(168,85,247,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let n = 0; n <= maxThrow; n++) {
      const theorN = this.totalCubes * Math.pow(5/6, n);
      const x = px + (n / maxThrow) * pw;
      const y = py + ph - (theorN / this.totalCubes) * ph;
      if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    // Data points
    ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.decayHistory.length; i++) {
      const pt = this.decayHistory[i];
      const x = px + (pt.throw / maxThrow) * pw;
      const y = py + ph - (pt.remaining / this.totalCubes) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const pt of this.decayHistory) {
      const x = px + (pt.throw / maxThrow) * pw;
      const y = py + ph - (pt.remaining / this.totalCubes) * ph;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Legend
    ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#3b82f6'; ctx.fillText('● Data', gx + gw - 90, gy + gh - 10);
    ctx.fillStyle = '#a855f7'; ctx.fillText('--- Theory', gx + gw - 90, gy + gh - 22);
  }

  measure(): DataPoint {
    return {
      'throw': this.throwNumber,
      'N': this.remainingCubes,
      'N_decayed': this.lastDecayed.size,
      'N/N0': Number((this.remainingCubes / this.totalCubes).toFixed(3)),
    };
  }

  autoRun(): DataPoint[] {
    this.resetCubes();
    const data: DataPoint[] = [this.measure()];
    while (this.remainingCubes > 5 && this.throwNumber < 30) {
      this.performThrow();
      data.push(this.measure());
    }
    return data;
  }

  renderFrame(): void { this.renderer?.render(); }
  getRenderer(): CanvasRenderer | null { return this.renderer; }
}

KitRegistry.register('N-1', 'Radioactivity Decay Analogue', 'nuclear', () => new DecayAnalogueKit());
