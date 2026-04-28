/**
 * Kit Definition: Ohm's Law (F-1)
 * Educational content for the Ohm's Law experiment.
 */
import type { KitDefinition } from '../../core/types.ts';

export const OhmsLawDef: KitDefinition = {
  experimentCode: 'F-18',
  experimentTitle: "Ohm's Law — Voltage-Current Relationship",
  category: 'electricity',
  difficulty: 'beginner',

  objective:
    "Verify Ohm's Law by measuring the current through a resistor at different applied voltages, and determine the resistance from the V-I graph.",

  theory: `Ohm's Law states that the current (I) flowing through a conductor is directly proportional to the potential difference (V) across it, provided the temperature remains constant:

**V = IR**

where R is the resistance of the conductor in ohms (Ω).

A graph of V vs I for an ohmic conductor is a straight line through the origin with slope equal to R. For a non-ohmic component (like a filament lamp), the graph curves because resistance changes with temperature.`,

  safetyNotes: [
    'Do not exceed the rated voltage of the resistor.',
    'Switch off the circuit before making changes to connections.',
    'Do not touch bare wires when the circuit is energised.',
    'If any component becomes hot, switch off immediately.',
  ],

  apparatus: [
    {
      id: 'power_supply',
      name: 'Variable DC Power Supply',
      icon: '🔋',
      description: 'Provides adjustable voltage from 0-12V DC.',
      learnMore: 'Set the power supply to its lowest setting before switching on. Increase the voltage gradually using the dial. The digital display shows the output voltage. Always switch off before disconnecting.',
      category: 'electrical',
    },
    {
      id: 'resistor',
      name: 'Wire-wound Resistor',
      icon: '⚡',
      description: 'The component under test — a fixed resistance.',
      learnMore: 'A wire-wound resistor has a known, stable resistance value. Check the colour bands or label for the rated value. Connect it in the main circuit loop. It will warm slightly at higher currents — this is normal.',
      category: 'electrical',
    },
    {
      id: 'ammeter',
      name: 'Digital Ammeter',
      icon: '🔢',
      description: 'Measures the current flowing through the circuit.',
      learnMore: 'Connect the ammeter in SERIES with the resistor — current must flow through it. Set it to the appropriate range (usually mA or A). Read the display when the value stabilizes. Always start on the highest range to avoid damage.',
      precision: '±0.01 A',
      category: 'measurement',
    },
    {
      id: 'voltmeter',
      name: 'Digital Voltmeter',
      icon: '📊',
      description: 'Measures the voltage across the resistor.',
      learnMore: 'Connect the voltmeter in PARALLEL across the resistor — its two leads touch each side of the resistor. A voltmeter has very high internal resistance so it draws negligible current from the circuit.',
      precision: '±0.01 V',
      category: 'measurement',
    },
    {
      id: 'wires',
      name: 'Connecting Wires',
      icon: '🔌',
      description: 'Insulated wires with crocodile clips for making connections.',
      learnMore: 'Use wires with secure clips to make firm connections. Loose connections cause flickering readings. Keep wires neat and organized to avoid short circuits.',
      category: 'electrical',
    },
    {
      id: 'switch',
      name: 'SPST Switch',
      icon: '🔘',
      description: 'Single-pole single-throw switch to open/close the circuit.',
      learnMore: 'Place the switch in series in the main circuit. Open the switch (OFF) when adjusting voltage or taking a break. This prevents unnecessary heating of components.',
      category: 'electrical',
    },
  ],

  setupSteps: [
    {
      index: 0,
      instruction: 'Place the power supply, resistor, ammeter, and switch on the bench.',
      why: 'Organizing components before wiring prevents errors and short circuits.',
      action: 'confirm',
      hint: 'Confirm all components are laid out.',
    },
    {
      index: 1,
      instruction: 'Connect the power supply, switch, ammeter, and resistor in a series loop.',
      why: 'Series connection ensures the same current flows through the ammeter and resistor, giving an accurate current reading.',
      action: 'tap',
      targetComponent: 'ammeter',
      hint: 'Tap to wire the series circuit.',
    },
    {
      index: 2,
      instruction: 'Connect the voltmeter in parallel across the resistor.',
      why: 'Parallel connection measures the potential difference across the resistor without significantly altering the current through it.',
      action: 'tap',
      targetComponent: 'voltmeter',
      hint: 'Tap to connect the voltmeter across the resistor.',
    },
    {
      index: 3,
      instruction: 'Set the power supply to 0V and close the switch.',
      why: 'Starting at zero voltage and increasing gradually gives a full range of data points and protects components from sudden high voltage.',
      action: 'slide',
      targetComponent: 'power_supply',
      hint: 'Set voltage to 0V.',
    },
  ],

  expectedRelationship: 'V ∝ I (linear through origin)',
  acceptedValues: {},

  assistantContext:
    "This is a fundamental electricity experiment. Common mistakes: (1) connecting ammeter in parallel (causes short circuit), (2) connecting voltmeter in series (blocks current), (3) not waiting for readings to stabilize, (4) confusing V-I graph slope with I-V graph slope.",

  commonQuestions: [
    'Why must the ammeter be in series?',
    'Why is the voltmeter connected in parallel?',
    'What does the slope of my V-I graph represent?',
    'Why are my readings not perfectly linear?',
    "What is a non-ohmic conductor?",
  ],
};
