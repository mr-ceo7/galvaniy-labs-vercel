/**
 * GalvaniyPhysics — Base Instrument
 *
 * Virtual measuring instruments that read physics state and produce
 * readings with configurable noise and precision. This is the core
 * educational value — students learn about measurement uncertainty
 * from instruments that behave realistically.
 */

import type { InstrumentConfig, MeasurementReading } from '../core/types.ts';

export abstract class Instrument {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly unit: string;
  readonly precision: number;
  readonly noise: number;
  readonly systematicError: number;
  readonly range: { min: number; max: number };

  /** History of all readings taken. */
  protected readings: MeasurementReading[] = [];

  constructor(config: InstrumentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.label = config.label;
    this.unit = config.unit;
    this.precision = config.precision ?? 2;
    this.noise = config.noise ?? 0;
    this.systematicError = config.systematicError ?? 0;
    this.range = config.range ?? { min: -Infinity, max: Infinity };
  }

  /**
   * Take a reading from the instrument.
   * Subclasses implement getIdealValue() to compute the true value.
   * This method adds noise, systematic error, and rounds to precision.
   */
  read(simTime: number): MeasurementReading {
    const idealValue = this.getIdealValue();
    const appliedNoise = this.addGaussianNoise(0, this.noise);
    const rawValue = idealValue + this.systematicError + appliedNoise;

    // Clamp to instrument range
    const clampedValue = Math.max(
      this.range.min,
      Math.min(this.range.max, rawValue)
    );

    // Round to precision
    const factor = Math.pow(10, this.precision);
    const roundedValue = Math.round(clampedValue * factor) / factor;

    const reading: MeasurementReading = {
      instrumentId: this.id,
      value: roundedValue,
      unit: this.unit,
      timestamp: simTime,
      noise: appliedNoise,
    };

    this.readings.push(reading);
    return reading;
  }

  /**
   * Get the ideal (noiseless) value this instrument should read.
   * Subclasses implement this to read from the physics world.
   */
  protected abstract getIdealValue(): number;

  /** Generate Gaussian-distributed random noise using Box-Muller transform. */
  protected addGaussianNoise(mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;

    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /** Get all readings taken so far. */
  getReadings(): MeasurementReading[] {
    return [...this.readings];
  }

  /** Get the last reading. */
  getLastReading(): MeasurementReading | null {
    return this.readings.length > 0
      ? this.readings[this.readings.length - 1]
      : null;
  }

  /** Clear all readings. */
  clearReadings(): void {
    this.readings = [];
  }

  /** Get number of readings taken. */
  getReadingCount(): number {
    return this.readings.length;
  }
}

// ============================================================
// Concrete Instrument Implementations
// ============================================================

/**
 * Stopwatch — measures elapsed time between start/stop events.
 * Includes reaction-time noise to simulate human error.
 */
export class Stopwatch extends Instrument {
  private startTime: number = 0;
  private stopTime: number = 0;
  private isRunning: boolean = false;
  private currentSimTime: number = 0;

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'stopwatch',
      type: 'stopwatch',
      label: config?.label ?? 'Stopwatch',
      unit: config?.unit ?? 's',
      precision: config?.precision ?? 2,
      noise: config?.noise ?? 0.15, // ~150ms human reaction time
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: Infinity },
    });
  }

  /** Start the stopwatch at current simulation time. */
  start(simTime: number): void {
    this.startTime = simTime + this.addGaussianNoise(0, this.noise);
    this.isRunning = true;
  }

  /** Stop the stopwatch and record elapsed time. */
  stop(simTime: number): MeasurementReading {
    this.stopTime = simTime + this.addGaussianNoise(0, this.noise);
    this.isRunning = false;
    this.currentSimTime = simTime;
    return this.read(simTime);
  }

  /** Update current time (for display while running). */
  update(simTime: number): void {
    this.currentSimTime = simTime;
  }

  /** Get current elapsed time (for display, not recorded). */
  getElapsed(): number {
    if (this.isRunning) {
      return this.currentSimTime - this.startTime;
    }
    return this.stopTime - this.startTime;
  }

  protected getIdealValue(): number {
    return this.stopTime - this.startTime;
  }

  /** Reset the stopwatch. */
  reset(): void {
    this.startTime = 0;
    this.stopTime = 0;
    this.isRunning = false;
  }
}

/**
 * Ruler — measures distance/length.
 * Includes parallax error noise.
 */
export class Ruler extends Instrument {
  private measuredValue: number = 0;

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'ruler',
      type: 'ruler',
      label: config?.label ?? 'Ruler',
      unit: config?.unit ?? 'm',
      precision: config?.precision ?? 3, // mm precision
      noise: config?.noise ?? 0.001, // ±1mm parallax
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: 2 },
    });
  }

  /** Set the value to measure. */
  setMeasuredValue(value: number): void {
    this.measuredValue = value;
  }

  protected getIdealValue(): number {
    return this.measuredValue;
  }
}

/**
 * Thermometer — measures temperature.
 * Includes thermal lag (sluggish response) noise.
 */
export class Thermometer extends Instrument {
  private targetTemperature: number = 20; // °C
  private displayedTemperature: number = 20;
  private thermalLag: number = 0.95; // how quickly it responds (0=instant, 1=never)

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'thermometer',
      type: 'thermometer',
      label: config?.label ?? 'Thermometer',
      unit: config?.unit ?? '°C',
      precision: config?.precision ?? 1,
      noise: config?.noise ?? 0.5, // ±0.5°C
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: -10, max: 200 },
    });
  }

  /** Update the true temperature the thermometer is measuring. */
  setTargetTemperature(temp: number): void {
    this.targetTemperature = temp;
  }

  /** Simulate thermal lag — call each physics step. */
  update(): void {
    // Exponential approach: displayed temp moves toward target
    this.displayedTemperature =
      this.displayedTemperature * this.thermalLag +
      this.targetTemperature * (1 - this.thermalLag);
  }

  protected getIdealValue(): number {
    return this.displayedTemperature;
  }
}

/**
 * Ammeter — measures electrical current.
 */
export class Ammeter extends Instrument {
  private currentValue: number = 0;

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'ammeter',
      type: 'ammeter',
      label: config?.label ?? 'Ammeter',
      unit: config?.unit ?? 'A',
      precision: config?.precision ?? 3,
      noise: config?.noise ?? 0.005, // ±5mA
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: 10 },
    });
  }

  setCurrentValue(amps: number): void {
    this.currentValue = amps;
  }

  protected getIdealValue(): number {
    return this.currentValue;
  }
}

/**
 * Voltmeter — measures electrical voltage.
 */
export class Voltmeter extends Instrument {
  private voltageValue: number = 0;

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'voltmeter',
      type: 'voltmeter',
      label: config?.label ?? 'Voltmeter',
      unit: config?.unit ?? 'V',
      precision: config?.precision ?? 2,
      noise: config?.noise ?? 0.01, // ±10mV
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: 30 },
    });
  }

  setVoltageValue(volts: number): void {
    this.voltageValue = volts;
  }

  protected getIdealValue(): number {
    return this.voltageValue;
  }
}

/**
 * Protractor — measures angles in degrees.
 */
export class Protractor extends Instrument {
  private angleValue: number = 0;

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'protractor',
      type: 'protractor',
      label: config?.label ?? 'Protractor',
      unit: config?.unit ?? '°',
      precision: config?.precision ?? 1,
      noise: config?.noise ?? 0.5, // ±0.5°
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: 360 },
    });
  }

  setAngleValue(degrees: number): void {
    this.angleValue = degrees;
  }

  protected getIdealValue(): number {
    return this.angleValue;
  }
}

/**
 * PressureGauge — measures pressure.
 */
export class PressureGauge extends Instrument {
  private pressureValue: number = 101325; // Pa (1 atm)

  constructor(config?: Partial<InstrumentConfig>) {
    super({
      id: config?.id ?? 'pressure_gauge',
      type: 'pressure_gauge',
      label: config?.label ?? 'Pressure Gauge',
      unit: config?.unit ?? 'Pa',
      precision: config?.precision ?? 0,
      noise: config?.noise ?? 100, // ±100 Pa
      systematicError: config?.systematicError ?? 0,
      range: config?.range ?? { min: 0, max: 500000 },
    });
  }

  setPressureValue(pressure: number): void {
    this.pressureValue = pressure;
  }

  protected getIdealValue(): number {
    return this.pressureValue;
  }
}
