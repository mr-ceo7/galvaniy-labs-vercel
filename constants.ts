// This string contains the core essence of the manual for the AI to reference.
// In a production app, this would be a vector database or a file upload.
export const PHYSICS_LAB_MANUAL_CONTEXT = `
UNIVERSITY OF NAIROBI PHYSICS LABORATORY MANUAL (2025 EDITION)

General Instructions:
- Determine g using simple pendulum (Exp A-2).
- Verify parallelogram/triangle of forces (Exp A-1).
- Measure Young's Modulus (Exp B-6).
- Measure Viscosity (Exp B-7).
- Measure Linear Expansion (Exp C-8).
- Specific Heat Capacity of Zinc (Exp C-9).
- Thermal Conductivity (Searle's Bar) (Exp C-10).
- Newton's Law of Cooling (Exp C-11).
- Boyle's Law (Exp C-12).
- Standing Waves (Exp D-14).
- Laws of Reflection (Exp E-15).
- Refraction & Lenses (Exp E-16).
- Refractive Index via Spectrometer (Exp E-17).
- Ohm's Law (Exp F-18).
- Thermistor characteristics (Exp F-19).
- Potentiometer (Exp F-20).
- Oscilloscope (Exp F-21).
- Radioactivity Decay Analogue (Exp N-1).
- PV Panel Characteristics (Exp S-1).
- Rated Voltage/Power of Device (Exp S-2).

Key Formulas from Manual:
1. Pendulum: T = 2π√(l/g)
2. Young's Modulus: E = (MgL)/(Ax) where x is extension.
3. Viscosity: Q = (πΔPr^4)/(8Ln)
4. Linear Expansion: ΔL = α L1 ΔT
5. Specific Heat (Mixtures): Heat Gained = Heat Lost
6. Thermal Conductivity: Q/t = KA(T1-T2)/d
7. Newton's Cooling: rate j = k * excess_temp
8. Boyle's Law: PV = k
9. Standing Waves: T = Mg, f = (n/2L)√(T/m)
10. Lenses/Mirrors: 1/f = 1/u + 1/v
11. Refractive Index (Spectrometer): n = sin((A+D)/2) / sin(A/2)
12. Ohm's Law: V = IR
13. Potentiometer: E1/E2 = L1/L2
14. Radioactivity: N = No * e^(-λt)

Report Structure Required:
1. Title
2. Objectives
3. Apparatus
4. Theory
5. Procedure
6. Results (Table with plausible FAKE data based on theory)
7. Analysis (Calculations based on the fake data)
8. Discussion
9. Conclusion
`;

export const THEMES = [
  {
    name: 'Nebula',
    primary: 'from-purple-500 to-blue-500',
    secondary: 'bg-purple-600',
    accent: 'text-blue-400',
    gradient: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
  },
  {
    name: 'Emerald',
    primary: 'from-emerald-400 to-cyan-500',
    secondary: 'bg-emerald-600',
    accent: 'text-emerald-400',
    gradient: 'bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900'
  },
  {
    name: 'Sunset',
    primary: 'from-orange-500 to-pink-500',
    secondary: 'bg-orange-600',
    accent: 'text-orange-400',
    gradient: 'bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900'
  },
  {
    name: 'Oceanic',
    primary: 'from-cyan-500 to-blue-600',
    secondary: 'bg-blue-600',
    accent: 'text-cyan-400',
    gradient: 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'
  }
];
