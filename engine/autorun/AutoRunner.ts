import type { ApparatusKit, DataPoint } from '../apparatus/ApparatusKit.ts';

export class AutoRunner {
  constructor(private readonly kit: ApparatusKit) {}

  run(): DataPoint[] {
    return this.kit.autoRun();
  }
}
