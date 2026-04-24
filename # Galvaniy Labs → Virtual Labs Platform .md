# Galvaniy Labs → Virtual Labs Platform (Refined Plan)

## Decisions Locked In

| Decision | Choice |
|---|---|
| **Scope** | Option C — Phased (Enhanced simulations first → Full virtual lab) |
| **Physics Engine** | Hybrid — Custom core optimized for educational physics + Matter.js for rigid body/collision |
| **Rendering** | Hybrid — Canvas2D for simple experiments, WebGL (PixiJS) for complex ones |
| **Data Storage** | Virtual lab session data saved to Firestore alongside reports |
| **Session Replay** | Yes — students can replay their lab sessions |
| **Instructor Visibility** | Yes — admins can see who used virtual lab vs. just generated reports |
| **Old Report Flow** | Preserved — students can still generate reports without virtual lab |
| **Auto Mode** | AI can run the experiment automatically for students who want instant reports |
| **Target Devices** | Mobile-first, optimized for all devices, same high quality |
| **Branding** | App: **Galvaniy Labs** / Report splash: **Chiromo Labs** |
| **Experiment Source** | UoN Physics First Year Lab Manual (2025 Edition) — priority. Platform is **manual-agnostic** — admins can upload Year 2, 3, Chemistry, etc. |

---

## Complete Experiment Catalog (From Manual)

> [!IMPORTANT]
> The 20 experiments below are from the **First Year** manual only. The platform is designed to be **manual-agnostic** — when an admin uploads a Year 2, Year 3, or even Chemistry/Biology manual, the system handles it through a **3-tier kit resolution** system:
>
> 1. **Built-in Kit** — Pre-built, hand-tuned kits (highest quality). All 20 Year 1 experiments get these.
> 2. **Composable Kit** — AI assembles a kit from physics primitives (bodies, forces, instruments, renderers) for experiments not in the built-in registry. Still engine-powered, still physics-accurate — just dynamically composed.
> 3. **Legacy Fallback** — For experiments the engine can't model (e.g., biology wet labs), falls back to the current AI-generated Canvas simulation.
>
> This means **any manual works out of the box**, with quality improving as more built-in kits are added.

### Year 1: UoN Physics Lab Manual (2025 Edition)

The First Year manual contains **20 experiments** across **7 domains**. These all get built-in kits (Tier 1).

### A — Mechanics (4 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **A-0** | Precision Measurements | Vernier caliper, micrometer screw gauge | `PrecisionMeasurement` |
| **A-1** | Parallelogram & Triangle of Forces | Vector addition, equilibrium | `ForceTable` |
| **A-2** | Simple Pendulum (g determination) | SHM, period vs length, T²∝L | `SimplePendulum` |
| **A-3** | Principles of Equilibrium | Moments, beam balance, R₁+R₂=W₁+W₂ | `BeamBalance` |
| **A-5** | Variable Inertia Bar | Moment of inertia, T²∝I | `InertiaBar` |

### B — Properties of Matter (2 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **B-6** | Young's Modulus of Elasticity | Stress-strain, wire extension | `YoungModulus` |
| **B-7** | Viscosity (Poiseuille's Law) | Fluid flow through capillary tube | `ViscosityApparatus` |

### C — Heat / Thermodynamics (5 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **C-8** | Linear Expansion | Thermal expansion coefficient α | `LinearExpansion` |
| **C-9** | Specific Heat Capacity (Mixtures) | Calorimetry, heat transfer | `Calorimeter` |
| **C-10** | Thermal Conductivity (Searle's Bar) | Heat conduction, K coefficient | `SearlesBar` |
| **C-11** | Newton's Law of Cooling | Exponential cooling curve | `CoolingCurve` |
| **C-12** | Boyle's Law | PV = const, gas behavior | `BoylesLaw` |

### D — Wave Motion (1 experiment)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **D-14** | Standing Waves in a Taut String | Resonant frequency, harmonics, f²∝T | `StandingWaves` |

### E — Optics (3 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **E-15** | Laws of Reflection | Plane mirror, spherical mirrors, angles | `ReflectionBench` |
| **E-16** | Laws of Refraction & Lenses | Snell's law, focal length, magnification | `RefractionBench` |
| **E-17** | Spectrometer — Refractive Index | Minimum deviation, prism | `Spectrometer` |

### F — Electricity (4 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **F-18** | Ohm's Law | V=IR, series/parallel resistors | `OhmsLaw` |
| **F-19** | The Thermistor | Resistance vs temperature, Wheatstone bridge | `ThermistorCircuit` |
| **F-20** | The Potentiometer | EMF comparison, Kelvin double bridge | `Potentiometer` |
| **F-21** | The Oscilloscope | AC voltage/frequency measurement, RCL | `OscilloscopeRCL` |

### N — Radioactivity (1 experiment)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **N-1** | Radioactivity Decay Analogue | Statistical decay, half-life, λ=ln2/t½ | `DecayAnalogue` |

### S — Renewable Energy (2 experiments)

| Code | Experiment | Key Physics | Apparatus Kit Needed |
|---|---|---|---|
| **S-1** | PV Panel Characteristics | Solar panel IV curves, series/parallel | `SolarPanel` |
| **S-2** | Rated Voltage & Power of a Device | Load matching, P=IV | `SolarPowerDevice` |

---

## Architecture: Hybrid Physics Engine

### Design Philosophy

Custom-built engine core optimized for educational physics, using battle-tested libraries only where it makes sense to avoid reinvention.

```
┌──────────────────────────────────────────────────────────────────┐
│                    GALVANIY PHYSICS ENGINE                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Custom Core (TypeScript)                   │ │
│  │                                                              │ │
│  │  World         • Fixed timestep, gravity, bounds             │ │
│  │  Integrator    • Verlet (default), RK4 (for precision)      │ │
│  │  Measurement   • Virtual instruments + realistic noise       │ │
│  │  DataRecorder  • Auto-table population, session recording    │ │
│  │  Apparatus     • Kit registry, component composition         │ │
│  │  AutoRunner    • AI-driven experiment execution              │ │
│  └───────────────────────┬──────────────────────────────────────┘ │
│                          │ delegates to                            │
│  ┌───────────────────────▼──────────────────────────────────────┐ │
│  │              Library Layer (selective use)                     │ │
│  │                                                               │ │
│  │  Matter.js    → Rigid body collisions, constraints            │ │
│  │                 (pendulum, blocks, ramps, pulleys)             │ │
│  │                                                               │ │
│  │  PixiJS       → WebGL rendering for complex experiments       │ │
│  │                 (optics ray tracing, circuit visualization)    │ │
│  │                                                               │ │
│  │  Canvas2D     → Lightweight rendering for simple experiments  │ │
│  │                 (thermometers, gauges, data overlays)          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Custom Physics Modules (NO library)              │ │
│  │                                                               │ │
│  │  ThermalSim   → Heat transfer, cooling curves, expansion     │ │
│  │  FluidSim     → Viscosity, Poiseuille flow, Boyle's law      │ │
│  │  OpticsEngine → Ray tracing, Snell's law, lens equations     │ │
│  │  CircuitSim   → Kirchhoff's laws, RC circuits, AC analysis   │ │
│  │  WaveSim      → Standing waves, harmonics, resonance         │ │
│  │  DecaySim     → Statistical decay, Monte Carlo sampling      │ │
│  │  SolarSim     → PV characteristics, IV curves                │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### What's Custom vs Library

| Module | Approach | Rationale |
|---|---|---|
| **Rigid body physics** | Matter.js | Pendulum, force table, beam balance — battle-tested collision/constraints |
| **Thermal simulations** | Custom | No physics library handles heat flow well. Simple diff equations. |
| **Optics ray tracing** | Custom | Snell's law, lens maker's equation — specialized, no good library. |
| **Circuit simulation** | Custom | Kirchhoff's laws, nodal analysis — domain-specific solver. |
| **Wave physics** | Custom | Harmonic analysis, standing wave patterns — custom visualization. |
| **Fluid dynamics** | Custom | Poiseuille's law is a simple equation, no heavy library needed. |
| **Statistical decay** | Custom | Monte Carlo with cubes — simple random sampling. |
| **2D Rendering** | Canvas2D + PixiJS | Canvas2D for simple gauges; PixiJS (WebGL) for complex optics/circuits. |
| **Measurement system** | Fully custom | This is the unique educational value — instruments, noise, precision. |
| **Data recording** | Fully custom | Session replay, auto-table fill, Firestore integration. |

---

## Auto Mode: AI-Driven Experiment Execution

When a student wants a report without doing the experiment manually, the system:

```
1. Student clicks "Generate Report" (old flow) OR "Auto-Run Experiment"
                    │
2. AI generates the Lab Config (same as manual mode)
                    │
3. AutoRunner module executes the experiment programmatically:
   • Sets each parameter combination from the procedure
   • Steps the physics engine forward (fast — 100x real-time)
   • Takes measurements at the right moments
   • Adds realistic noise to match instrument precision
   • Records each data point to the virtual table
                    │
4. Session data is marked as "auto-generated"
   (Instructors can see this in the admin panel)
                    │
5. Report is generated using the auto-collected data
   • Same high-quality AI-written analysis
   • But data comes from physics simulation, not random generation
   • Much more realistic and self-consistent than current dummy data
```

The key insight: Even in "auto mode," the data is **physics-derived**, not randomly generated. A simple pendulum will actually produce T²∝L with realistic scatter, not just plausible-looking numbers.

---

## Phase 1: Enhanced Simulations (The "B" Foundation)

### Goal
Replace AI-generated raw Canvas code with engine-powered simulations embedded in reports. This immediately improves quality while laying groundwork for full virtual lab.

### What Changes

#### New Files to Create

```
src/
├── engine/
│   ├── core/
│   │   ├── World.ts              — Physics world (timestep, gravity, bodies)
│   │   ├── Body.ts               — Rigid body base class
│   │   ├── Constraint.ts         — Pin, distance, spring constraints
│   │   ├── Integrator.ts         — Verlet + RK4 integration
│   │   ├── Vector2.ts            — 2D vector math
│   │   └── types.ts              — Shared type definitions
│   │
│   ├── simulation/
│   │   ├── ThermalSim.ts         — Heat transfer, cooling, expansion
│   │   ├── FluidSim.ts           — Viscosity, gas laws
│   │   ├── OpticsEngine.ts       — Ray tracing, refraction, lenses
│   │   ├── CircuitSim.ts         — Kirchhoff solver, RC circuits
│   │   ├── WaveSim.ts            — Standing waves, harmonics
│   │   ├── DecaySim.ts           — Statistical decay (Monte Carlo)
│   │   └── SolarSim.ts           — PV characteristics, IV curves
│   │
│   ├── measurement/
│   │   ├── Instrument.ts         — Base instrument class
│   │   ├── Stopwatch.ts          — Timer with reaction-time noise
│   │   ├── Ruler.ts              — Length measurement with parallax
│   │   ├── Protractor.ts         — Angle measurement
│   │   ├── Thermometer.ts        — Temperature with thermal lag
│   │   ├── Ammeter.ts            — Current reading
│   │   ├── Voltmeter.ts          — Voltage reading
│   │   ├── Galvanometer.ts       — Null-point detector
│   │   └── Oscilloscope.ts       — Waveform display
│   │
│   ├── apparatus/
│   │   ├── ApparatusKit.ts       — Base class for experiment kits
│   │   ├── KitRegistry.ts        — 3-tier resolution (built-in → composable → legacy)
│   │   ├── ComposableKit.ts      — AI-assembled kits from physics primitives
│   │   ├── LegacySimAdapter.ts   — Fallback wrapper for raw Canvas simulations
│   │   ├── kits/                 — Tier 1: Built-in kits (Year 1 manual)
│   │   │   ├── SimplePendulum.ts         — A-2
│   │   │   ├── ForceTable.ts             — A-1
│   │   │   ├── BeamBalance.ts            — A-3
│   │   │   ├── InertiaBar.ts             — A-5
│   │   │   ├── YoungModulus.ts           — B-6
│   │   │   ├── ViscosityApparatus.ts     — B-7
│   │   │   ├── LinearExpansion.ts        — C-8
│   │   │   ├── Calorimeter.ts            — C-9
│   │   │   ├── SearlesBar.ts             — C-10
│   │   │   ├── CoolingCurve.ts           — C-11
│   │   │   ├── BoylesLaw.ts              — C-12
│   │   │   ├── StandingWaves.ts          — D-14
│   │   │   ├── ReflectionBench.ts        — E-15
│   │   │   ├── RefractionBench.ts        — E-16
│   │   │   ├── Spectrometer.ts           — E-17
│   │   │   ├── OhmsLaw.ts               — F-18
│   │   │   ├── ThermistorCircuit.ts      — F-19
│   │   │   ├── Potentiometer.ts          — F-20
│   │   │   ├── OscilloscopeRCL.ts        — F-21
│   │   │   ├── DecayAnalogue.ts          — N-1
│   │   │   ├── SolarPanel.ts             — S-1
│   │   │   └── SolarPowerDevice.ts       — S-2
│   │   └── PrecisionMeasurement.ts       — A-0
│   │
│   ├── renderer/
│   │   ├── CanvasRenderer.ts     — Canvas2D renderer (mobile-friendly)
│   │   ├── WebGLRenderer.ts      — PixiJS renderer (complex experiments)
│   │   ├── RenderBridge.ts       — Auto-selects renderer based on device + experiment
│   │   └── themes/
│   │       └── GalvaniyTheme.ts  — Visual styling for apparatus rendering
│   │
│   ├── autorun/
│   │   ├── AutoRunner.ts         — Automated experiment execution
│   │   └── ProcedureExecutor.ts  — Step-by-step procedure following
│   │
│   └── index.ts                  — Engine entry point & public API
│
├── components/
│   ├── VirtualLab.tsx            — [Phase 2] Full interactive lab view
│   ├── SimulationPanel.tsx       — [Phase 1] Enhanced simulation in reports
│   └── InstrumentPanel.tsx       — [Phase 2] Virtual instrument controls
│
└── services/
    └── labSessionService.ts      — Session recording, Firestore sync
```

#### Modified Files

| File | Change |
|---|---|
| `services/promptTemplates.ts` | Add new `getLabConfigInstructions()` — AI outputs lab config JSON |
| `backend/app/services/prompt_templates.py` | Mirror the new lab config prompt |
| `backend/app/services/gemini_service.py` | Add `generate_lab_config()` endpoint |
| `components/ReportView.tsx` | Replace raw `eval()` simulation with engine-powered `SimulationPanel` |
| `types.ts` | Add `LabConfig`, `LabSession`, `VirtualInstrument` types |
| `backend/app/routers/reports.py` | Add lab session data to report generation |
| `backend/app/services/firestore_service.py` | Add lab session CRUD |
| `package.json` | Add `matter-js`, `pixi.js` dependencies |

---

## Phase 2: Full Virtual Lab Mode (The "A" Evolution)

### Goal
Add full interactive lab workspace where students conduct experiments before generating reports.

### New UX Flow

```
Student Dashboard
├── [Generate Report]      → Old flow (preserved)  
├── [Auto-Run Experiment]  → Engine runs experiment → generates report with sim data
└── [Virtual Lab]          → Full interactive mode
    ├── Experiment Selection
    ├── Lab Workspace
    │   ├── Apparatus Canvas (interactive)
    │   ├── Instrument Panel (stopwatch, ruler, etc.)
    │   ├── Data Table (auto-populated from measurements)
    │   ├── Procedure Guide (step-by-step sidebar)
    │   └── Real-time Graph
    ├── "Record Data Point" button
    ├── "Generate Report from Session" → uses virtual data
    └── Session History (replay past sessions)
```

---

## Implementation Phases (Timeline)

### Phase 1A: Engine Core + First 5 Kits (Week 1-2)
- [ ] Build physics engine core (World, Body, Constraint, Vector2, Integrator)
- [ ] Build measurement system (Instrument base, Stopwatch, Ruler, Thermometer)
- [ ] Build Canvas2D renderer with Galvaniy theme
- [ ] Build apparatus kit base class and registry
- [ ] Implement first 5 kits:
  1. `SimplePendulum` (A-2) — Mechanics + Matter.js demo
  2. `OhmsLaw` (F-18) — Circuit simulation demo
  3. `CoolingCurve` (C-11) — Thermal sim demo
  4. `BoylesLaw` (C-12) — Gas law sim demo
  5. `DecayAnalogue` (N-1) — Statistical sim demo

### Phase 1B: Integration + Auto Mode (Week 2-3)
- [ ] New prompt template: AI outputs lab config instead of raw code
- [ ] Backend `/api/lab-setup` endpoint
- [ ] Replace `eval()` simulation in ReportView with engine-powered SimulationPanel
- [ ] Build AutoRunner for auto-mode experiment execution
- [ ] Update report generation to use physics-derived data when available
- [ ] Fallback: graceful degradation to old simulation for unknown experiments

### Phase 1C: Remaining Kits (Week 3-4)
- [ ] Implement remaining 17 apparatus kits
- [ ] Build PixiJS renderer for optics experiments (ray tracing needs WebGL)
- [ ] Build circuit simulator for F-18, F-19, F-20, F-21
- [ ] Build wave simulator for D-14
- [ ] Performance optimization for mobile devices

### Phase 2A: Virtual Lab UI (Week 4-5)
- [ ] New `VirtualLab` component with full interactive workspace
- [ ] Instrument panel (virtual stopwatch, ruler, protractor, meters)
- [ ] Procedure guide sidebar with step highlighting
- [ ] Data collection table with auto-population
- [ ] Real-time graphing from measurements
- [ ] "Record Data Point" flow

### Phase 2B: Session System (Week 5-6)
- [ ] Lab session recording (every interaction timestamped)
- [ ] Session replay player
- [ ] Firestore session storage
- [ ] Admin panel: view student sessions, distinguish manual vs auto
- [ ] "Generate Report from Session" — uses virtual data

### Phase 2C: Polish & Expansion (Week 6+)
- [ ] Mobile touch optimization (drag-to-adjust apparatus)
- [ ] Guided mode vs free mode
- [ ] Achievement system (accuracy badges)
- [ ] ComposableKit system (Tier 2): AI assembles kits from physics primitives for unknown experiments
- [ ] LegacySimAdapter (Tier 3): wraps current raw Canvas eval as graceful fallback
- [ ] Admin kit management: view which experiments use built-in vs composable vs legacy
- [ ] Year 2/3 manual testing & built-in kit expansion
- [ ] Chemistry/Biology manual support exploration

---

## Verification Plan

### Automated Tests
- Physics engine unit tests: energy conservation, known solutions (pendulum period formula)
- Each apparatus kit: expected output within tolerance for known inputs
- AutoRunner: verify data self-consistency (T²∝L produces correct slope)
- Integration test: generate lab config → instantiate engine → run → verify

### Manual Verification
- Visual: Does each apparatus look recognizable to a UoN physics student?
- Data: Does virtual data match expected experimental relationships?
- Mobile: 60fps target on mid-range Android (Samsung A series)
- UX: Can a student complete an experiment without documentation?

### Browser Testing
- Test simulation rendering in embedded report iframe
- Test across Chrome, Firefox, Safari mobile
- Verify Canvas2D ↔ WebGL fallback works correctly
