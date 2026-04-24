import { ApparatusKit, DataPoint } from './ApparatusKit.ts';
import { CanvasRenderer } from '../renderer/CanvasRenderer.ts';
import type { LabControl, ProcedureStep, DataTableConfig, LabConfig } from '../core/types.ts';

type KitCategory = ApparatusKit['category'];

export class LegacySimAdapter extends ApparatusKit {
  readonly kitId = 'LegacySimAdapter';
  readonly name: string;
  readonly experimentCode: string;
  readonly category: KitCategory;

  private readonly controls: LabControl[];
  private readonly procedure: ProcedureStep[];
  private readonly dataTable: DataTableConfig;

  constructor(experimentCode: string, title?: string, category: KitCategory = 'measurement', config?: Partial<LabConfig>) {
    super();
    this.experimentCode = experimentCode;
    this.category = category;
    this.name = title || config?.experimentTitle || `Legacy Lab ${experimentCode}`;
    this.controls = Array.isArray(config?.controls) && config.controls.length > 0
      ? config.controls
      : [
          { id: 'speed', label: 'Simulation Speed', min: 0.5, max: 4, value: 1, step: 0.5, unit: 'x' },
          { id: 'intensity', label: 'Response Level', min: 1, max: 10, value: 5, step: 1, unit: 'u' },
        ];
    this.procedure = Array.isArray(config?.procedure) && config.procedure.length > 0
      ? config.procedure
      : [
          { index: 0, instruction: 'Set the virtual controls to match the experiment.', expectedAction: 'adjust' },
          { index: 1, instruction: 'Observe the preview and capture representative values.', expectedAction: 'observe' },
          { index: 2, instruction: 'Record the values in the report or data table.', expectedAction: 'record' },
        ];
    this.dataTable = Array.isArray(config?.tables) && config.tables.length > 0
      ? config.tables[0] as DataTableConfig
      : {
          id: `${experimentCode.toLowerCase()}_legacy`,
          title: 'Legacy Fallback Data',
          headers: ['Trial', 'Value'],
          rows: 5,
        };

    for (const control of this.controls) {
      this.controlValues.set(control.id, control.value);
    }
  }

  setup(canvas: HTMLCanvasElement): void {
    this.world.bounds = { width: canvas.width, height: canvas.height };
    this.world.pixelsPerMeter = 100;
    this.renderer = new CanvasRenderer(canvas);
    this.renderer.setWorld(this.world);
    this.renderer.setCustomDraw((ctx, renderer) => this.draw(ctx, renderer));
  }

  getControls(): LabControl[] {
    return this.controls;
  }

  getDataTable(): DataTableConfig {
    return this.dataTable;
  }

  getProcedure(): ProcedureStep[] {
    return this.procedure;
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const { width: w, height: h } = renderer.getSize();
    const intensity = this.getControlValue('intensity') || 5;
    const speed = this.getControlValue('speed') || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = 40 + intensity * 4;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + this.world.getTime() * speed;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * (radius + 26), cy + Math.sin(angle) * (radius + 26));
    }
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(this.name, 24, 34);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '12px sans-serif';
    ctx.fillText('Tier: legacy fallback', 24, h - 28);
  }

  measure(): DataPoint {
    const point = {
      Trial: this.getDataPoints().length + 1,
      Value: Number(((this.getControlValue('intensity') || 5) * 0.82 + this.addNoise(0, 0.12)).toFixed(4)),
    };
    this.recordDataPoint(point);
    return point;
  }

  autoRun(): DataPoint[] {
    this.clearData();
    const rows: DataPoint[] = [];
    for (let i = 1; i <= 5; i++) {
      const point = {
        Trial: i,
        Value: Number((i * 0.95 + this.addNoise(0, 0.1)).toFixed(4)),
      };
      rows.push(point);
      this.recordDataPoint(point);
    }
    return rows;
  }

  getLabConfig(): LabConfig {
    const base = super.getLabConfig();
    return {
      ...base,
      tier: 'legacy',
      legacySimulationScript: '',
    };
  }
}
