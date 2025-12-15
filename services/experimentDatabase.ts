export interface ExperimentDef {
  name: string;
  theory: string;
  formula: (val: number) => number; // calculates dependent var from independent var
  inverseFormula?: (val: number) => number;
  validRange: { min: number; max: number; unit: string; step?: number };
  independentVarLabel: string; // e.g., "Length (m)"
  dependentVarLabel: string;   // e.g., "Period (s)"
  calculatedVarLabel?: string; // e.g., "T² (s²)"
  expectedResult: { label: string; value: number; tolerance: number; unit: string };
  dataPoints: number;
  measurementError: number; // percentage (0.02 = 2%)
  simulationType: string;
  calculationScript: string; // The JS code string for the ReportView
  objectives: string[];
  apparatus: string[];
}

export const EXPERIMENTS: Record<string, ExperimentDef> = {
  'A-2': {
    name: 'Determination of g using Simple Pendulum',
    theory: 'The period T of a simple pendulum of length L is given by T = 2π√(L/g). By plotting T² against L, we can determine the acceleration due to gravity g from the slope.',
    formula: (L: number) => 2 * Math.PI * Math.sqrt(L / 9.81),
    validRange: { min: 0.2, max: 1.0, unit: 'meters', step: 0.1 },
    independentVarLabel: 'Length L (m)',
    dependentVarLabel: 'Time for 20 osc t (s)',
    calculatedVarLabel: 'Period T (s)',
    expectedResult: { label: 'g', value: 9.81, tolerance: 0.5, unit: 'm/s²' },
    dataPoints: 6,
    measurementError: 0.05,
    simulationType: 'pendulum',
    objectives: [
      'To determine the periodic time of a simple pendulum for various lengths.',
      'To determine the acceleration due to gravity, g.'
    ],
    apparatus: ['Retort stand', 'Pendulum bob', 'Thread', 'Meter rule', 'Stopwatch', 'Split cork'],
    calculationScript: `
      const n = rows.length;
      if (n < 2) return { g: 0 };
      const l1 = rows[0][0];
      const tsq1 = rows[0][3]; 
      const l2 = rows[n-1][0];
      const tsq2 = rows[n-1][3];
      const slope = (tsq2 - tsq1) / (l2 - l1);
      const g = (4 * Math.PI * Math.PI) / slope;
      return { slope: slope, g: g };
    `
  },
  'F-18': {
    name: "Verification of Ohm's Law",
    theory: "Ohm's law states that the current I flowing through a conductor is directly proportional to the potential difference V across it. V = IR.",
    formula: (V: number) => V / 10,
    validRange: { min: 1.0, max: 10.0, unit: 'Volts', step: 1.5 },
    independentVarLabel: 'Voltage V (V)',
    dependentVarLabel: 'Current I (A)',
    expectedResult: { label: 'R', value: 10, tolerance: 1.0, unit: 'Ω' },
    dataPoints: 6,
    measurementError: 0.02,
    simulationType: 'circuit',
    objectives: [
      'To verify the relationship between potential difference and current.',
      'To determine the resistance of a given conductor.'
    ],
    apparatus: ['Voltmeter', 'Ammeter', 'Rheostat', 'Battery', 'Resistor', 'Switch', 'Wires'],
    calculationScript: `
      const n = rows.length;
      const v1 = rows[0][0];
      const i1 = rows[0][1];
      const v2 = rows[n-1][0];
      const i2 = rows[n-1][1];
      const slope = (i2 - i1) / (v2 - v1); // I vs V slope = 1/R
      const r = 1 / slope;
      return { slope: slope, resistance: r };
    `
  },
  'B-6': {
    name: "Young's Modulus of Elasticity",
    theory: "Young's Modulus E is the ratio of stress to strain within the elastic limit. For a wire loaded with mass M, E = (MgL)/(A*e), where e is extension.",
    // Simulating extension e = (MgL)/(AE). Assume Steel: E=2e11, r=0.5mm, L=2m.
    // A = pi*(0.0005)^2 = 7.85e-7 m^2.
    // k = AE/L = (7.85e-7 * 2e11) / 2 = 78500 N/m.
    // e = Mg/k.
    formula: (M: number) => (M * 9.81) / 78500,
    validRange: { min: 0.5, max: 5.0, unit: 'kg', step: 0.5 },
    independentVarLabel: 'Mass M (kg)',
    dependentVarLabel: 'Extension e (m)',
    expectedResult: { label: 'E', value: 200, tolerance: 20, unit: 'GPa' }, // 2e11 Pa
    dataPoints: 6,
    measurementError: 0.05,
    simulationType: 'spring',
    objectives: ['To determine the Young\'s Modulus of a given wire.'],
    apparatus: ['Searle\'s apparatus', 'Micrometer screw gauge', 'Meter rule', 'Slotted masses'],
    calculationScript: `
      // Slope of Extension vs Mass (e/M) = g/k
      // k = AE/L => e/M = gL/AE => E = gL / (slope * A)
      const n = rows.length;
      const m1 = rows[0][0];
      const e1 = rows[0][1];
      const m2 = rows[n-1][0];
      const e2 = rows[n-1][1];
      const slope = (e2 - e1) / (m2 - m1); // slope of e vs M
      
      // Constants assumed for calculation if not in data
      const g = 9.81;
      const L = 2.0; 
      const r = 0.0005;
      const A = Math.PI * r * r;
      
      const E = (g * L) / (slope * A);
      const E_GPa = E / 1e9;
      
      return { slope: slope, youngs_modulus: E_GPa };
    `
  },
  'C-11': {
    name: "Newton's Law of Cooling",
    theory: "The rate of cooling of a body is proportional to the excess temperature over its surroundings. ln(θ - θs) = -kt + C.",
    // T(t) = Ts + (T0 - Ts)e^(-kt). Assume Ts=25, T0=80, k=0.05
    formula: (t: number) => 25 + (80 - 25) * Math.exp(-0.05 * t),
    validRange: { min: 0, max: 30, unit: 'min', step: 5 },
    independentVarLabel: 'Time t (min)',
    dependentVarLabel: 'Temp T (°C)',
    expectedResult: { label: 'k', value: 0.05, tolerance: 0.01, unit: 'min⁻¹' },
    dataPoints: 7,
    measurementError: 0.02,
    simulationType: 'heating',
    objectives: ['To verify Newton\'s Law of Cooling.'],
    apparatus: ['Calorimeter', 'Thermometer', 'Stopwatch', 'Water bath', 'Stirrer'],
    calculationScript: `
      // rows: [Time, Temp, ExcessTemp, ln(Excess)]
      // Slope of ln(Excess) vs Time is -k
      const n = rows.length;
      const t1 = rows[0][0];
      const ln1 = rows[0][3];
      const t2 = rows[n-1][0];
      const ln2 = rows[n-1][3];
      
      const slope = (ln2 - ln1) / (t2 - t1);
      const k = -slope;
      
      return { slope: slope, cooling_constant: k };
    `
  },
  'D-14': {
    name: "Vibration of Strings (Standing Waves)",
    theory: "For a standing wave, T = 4f²l²µ. If frequency f is constant, l² ∝ T. We plot l² vs T.",
    // l = (1/2f) * sqrt(T/mu). Assume f=50Hz, mu=0.0004 kg/m.
    // l = 0.01 * sqrt(T / 0.0004) = 0.01 * 50 * sqrt(T) = 0.5 * sqrt(T).
    // T = mg.
    formula: (m: number) => 0.5 * Math.sqrt(m * 9.81),
    validRange: { min: 0.05, max: 0.5, unit: 'kg', step: 0.05 },
    independentVarLabel: 'Mass m (kg)',
    dependentVarLabel: 'Loop Length l (m)',
    expectedResult: { label: 'µ', value: 0.0004, tolerance: 0.0001, unit: 'kg/m' },
    dataPoints: 6,
    measurementError: 0.04,
    simulationType: 'wave',
    objectives: ['To study the variation of loop length with tension.', 'To determine the mass per unit length of the string.'],
    apparatus: ['Sonometer', 'Tuning fork', 'Slotted masses', 'Meter rule', 'Balance'],
    calculationScript: `
      // rows: [Mass, Tension, Length, L_squared]
      // l = (1/2f)sqrt(T/mu) => l^2 = T / (4 f^2 mu)
      // Slope of l^2 vs T is 1/(4 f^2 mu)
      // mu = 1 / (4 f^2 slope)
      
      const n = rows.length;
      const T1 = rows[0][1];
      const Lsq1 = rows[0][3];
      const T2 = rows[n-1][1];
      const Lsq2 = rows[n-1][3];
      
      const slope = (Lsq2 - Lsq1) / (T2 - T1); // l^2 vs T
      const f = 50; // assumed
      const mu = 1 / (4 * f * f * slope);
      
      return { slope: slope, linear_density: mu };
    `
  }
};