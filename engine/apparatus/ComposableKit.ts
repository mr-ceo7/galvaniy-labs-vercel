import { ApparatusKit, DataPoint } from './ApparatusKit.ts';
import { CanvasRenderer } from '../renderer/CanvasRenderer.ts';
import type { LabControl, ProcedureStep, DataTableConfig, LabConfig } from '../core/types.ts';

type KitCategory = ApparatusKit['category'];

const CATEGORY_LABELS: Record<KitCategory, string> = {
  mechanics: 'Mechanics',
  heat: 'Thermal Physics',
  optics: 'Optics',
  electricity: 'Electricity',
  waves: 'Wave Motion',
  nuclear: 'Radioactivity',
  renewable: 'Renewable Energy',
  measurement: 'Measurement',
};

export class ComposableKit extends ApparatusKit {
  readonly kitId = 'ComposableKit';
  readonly name: string;
  readonly experimentCode: string;
  readonly category: KitCategory;

  private readonly controls: LabControl[];
  private readonly procedure: ProcedureStep[];
  private readonly dataTable: DataTableConfig;
  private independentValue = 1;
  private dependentValue = 1;

  constructor(experimentCode: string, category: KitCategory, title?: string, config?: Partial<LabConfig>) {
    super();
    this.experimentCode = experimentCode;
    this.category = category;
    this.name = title || config?.experimentTitle || `${CATEGORY_LABELS[category]} Experiment`;
    this.controls = Array.isArray(config?.controls) && config.controls.length > 0
      ? config.controls
      : this.buildControls();
    this.procedure = Array.isArray(config?.procedure) && config.procedure.length > 0
      ? config.procedure
      : this.buildProcedure();
    this.dataTable = Array.isArray(config?.tables) && config.tables.length > 0
      ? config.tables[0] as DataTableConfig
      : this.buildTable();
    for (const control of this.controls) {
      this.controlValues.set(control.id, control.value);
    }
    this.independentValue = this.controlValues.get('independent') ?? this.controls[0]?.value ?? 1;
    this.dependentValue = this.controlValues.get('sensitivity') ?? this.controls[1]?.value ?? 1;
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

  protected onControlChange(controlId: string, value: number): void {
    if (controlId === 'independent') {
      this.independentValue = value;
    }
    if (controlId === 'sensitivity') {
      this.dependentValue = value;
    }
  }

  draw(ctx: CanvasRenderingContext2D, renderer: CanvasRenderer): void {
    const { width: w, height: h } = renderer.getSize();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const y = 30 + (h - 60) * (i / 8);
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(w - 24, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(this.name, 28, 34);

    ctx.fillStyle = '#22d3ee';
    const progress = Math.max(0.1, Math.min(1, this.independentValue / 10));
    ctx.fillRect(40, h - 80, (w - 80) * progress, 12);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, h - 120);

    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = 40 + (w - 80) * t;
      const amplitude = 24 + this.dependentValue * 4;
      const y = h / 2 + Math.sin((t * Math.PI * 2) + progress * 3) * amplitude;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Tier: composable fallback`, 28, h - 34);
  }

  measure(): DataPoint {
    const point = this.buildPoint(this.independentValue, this.dependentValue);
    this.recordDataPoint(point);
    return point;
  }

  autoRun(): DataPoint[] {
    this.clearData();
    const rows: DataPoint[] = [];
    for (let i = 0; i < 6; i++) {
      const x = Number((1 + i * 0.8).toFixed(2));
      const point = this.buildPoint(x, this.dependentValue);
      rows.push(point);
      this.recordDataPoint(point);
    }
    return rows;
  }

  getLabConfig(): LabConfig {
    const base = super.getLabConfig();
    return {
      ...base,
      tier: 'composable',
    };
  }

  private buildControls(): LabControl[] {
    return [
      {
        id: 'independent',
        label: this.category === 'electricity' ? 'Input' : 'Primary Variable',
        min: 1,
        max: 10,
        value: 4,
        step: 0.5,
        unit: this.category === 'electricity' ? 'V' : 'u',
      },
      {
        id: 'sensitivity',
        label: 'Sensitivity',
        min: 1,
        max: 5,
        value: 2,
        step: 0.5,
        unit: 'x',
      },
    ];
  }

  private buildProcedure(): ProcedureStep[] {
    return [
      {
        index: 0,
        instruction: 'Adjust the primary variable to the required starting value.',
        expectedAction: 'adjust',
      },
      {
        index: 1,
        instruction: 'Observe the simulated response and record a measurement.',
        expectedAction: 'measure',
      },
      {
        index: 2,
        instruction: 'Repeat for several input values to establish the trend.',
        expectedAction: 'record',
      },
    ];
  }

  private buildTable(): DataTableConfig {
    const xLabel = this.category === 'electricity' ? 'Input (V)' : 'Input';
    const yLabel = this.category === 'electricity' ? 'Output (A)' : 'Response';
    return {
      id: `${this.experimentCode.toLowerCase()}_composable`,
      title: `${CATEGORY_LABELS[this.category]} Data`,
      headers: [xLabel, yLabel],
      rows: 6,
    };
  }

  private buildPoint(input: number, sensitivity: number): DataPoint {
    const response = Number((input * (0.65 + sensitivity * 0.18) + this.addNoise(0, 0.08)).toFixed(4));
    return {
      [this.dataTable.headers[0]]: input,
      [this.dataTable.headers[1]]: response,
    };
  }
}
