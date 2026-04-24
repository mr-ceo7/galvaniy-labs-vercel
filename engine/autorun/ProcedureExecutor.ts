import type { ProcedureStep } from '../core/types.ts';

export class ProcedureExecutor {
  private currentIndex = 0;

  constructor(private readonly steps: ProcedureStep[]) {}

  getCurrent(): ProcedureStep | null {
    return this.steps[this.currentIndex] ?? null;
  }

  next(): ProcedureStep | null {
    this.currentIndex = Math.min(this.steps.length - 1, this.currentIndex + 1);
    return this.getCurrent();
  }

  previous(): ProcedureStep | null {
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    return this.getCurrent();
  }

  reset(): void {
    this.currentIndex = 0;
  }
}
