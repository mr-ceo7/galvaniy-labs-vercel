/**
 * Kit Definition: Cooling Curve (C-1)
 * Educational content for the Cooling Curve experiment.
 */
import type { KitDefinition } from '../../core/types.ts';

export const CoolingCurveDef: KitDefinition = {
  experimentCode: 'C-11',
  experimentTitle: 'Cooling Curve — Newton\'s Law of Cooling',
  category: 'heat',
  difficulty: 'beginner',

  objective:
    "Investigate how the temperature of a hot body changes with time as it cools, verify Newton's Law of Cooling, and determine the cooling constant.",

  theory: `Newton's Law of Cooling states that the rate of heat loss from a body is proportional to the difference in temperature between the body and its surroundings:

**dT/dt = -k(T - T₀)**

where T is the body's temperature, T₀ is the ambient temperature, and k is the cooling constant.

The solution is an exponential decay:

**T(t) = T₀ + (Tᵢ - T₀)e^(-kt)**

A plot of ln(T - T₀) vs time gives a straight line with slope = -k.`,

  safetyNotes: [
    'Use insulated gloves or tongs when handling hot containers.',
    'Do not touch the thermometer bulb — it may be very hot.',
    'Keep the hot water container on a heat-resistant mat.',
    'Be careful with boiling or near-boiling water.',
  ],

  apparatus: [
    {
      id: 'beaker',
      name: 'Glass Beaker (250 ml)',
      icon: '🧪',
      description: 'Contains the hot water that will cool over time.',
      learnMore: 'Use a beaker with clear markings. Fill it with about 200 ml of hot water. The beaker should be placed on a heat-resistant surface. Glass beakers can crack if heated unevenly — pour hot water in gently.',
      category: 'general',
    },
    {
      id: 'thermometer',
      name: 'Digital Thermometer',
      icon: '🌡',
      description: 'Measures the water temperature as it cools.',
      learnMore: 'Immerse the thermometer probe in the centre of the water — not touching the sides or bottom of the beaker, as these may be at different temperatures. Wait for the reading to stabilize before recording. Precision: ±0.1°C.',
      precision: '±0.1 °C',
      category: 'measurement',
    },
    {
      id: 'stopwatch',
      name: 'Digital Stopwatch',
      icon: '⏱',
      description: 'Measures elapsed time at regular intervals.',
      learnMore: 'Start the stopwatch as soon as you take the first temperature reading. Record temperature every 30 seconds or every minute, depending on how fast cooling occurs. Keep a consistent interval.',
      precision: '±0.01 s',
      category: 'measurement',
    },
    {
      id: 'stirrer',
      name: 'Glass Stirring Rod',
      icon: '🥄',
      description: 'Ensures uniform temperature throughout the liquid.',
      learnMore: 'Gently stir the water before each temperature reading to ensure the thermometer measures the average temperature of the liquid, not a local hot or cold spot. Do not stir vigorously — this introduces extra cooling.',
      category: 'general',
    },
    {
      id: 'insulation',
      name: 'Lagging / Lid (optional)',
      icon: '🧤',
      description: 'Reduces heat loss from the top of the beaker.',
      learnMore: 'A cardboard lid with a hole for the thermometer reduces evaporative cooling from the surface. This makes the cooling curve more closely follow Newton\'s Law. Without it, evaporation adds a non-Newtonian component.',
      category: 'general',
    },
  ],

  setupSteps: [
    {
      index: 0,
      instruction: 'Place the beaker on a heat-resistant mat on the bench.',
      why: 'The mat protects the bench surface from heat damage and provides a stable base.',
      action: 'tap',
      targetComponent: 'beaker',
      hint: 'Tap the beaker to place it on the bench.',
    },
    {
      index: 1,
      instruction: 'Fill the beaker with approximately 200 ml of hot water (~80°C).',
      why: 'Starting at around 80°C gives a good temperature range for observing the cooling curve without the dangers of boiling water.',
      action: 'confirm',
      hint: 'Confirm the beaker is filled with hot water.',
    },
    {
      index: 2,
      instruction: 'Insert the thermometer into the centre of the water.',
      why: 'The centre of the liquid gives the most representative temperature reading, away from the cooler walls and surface.',
      action: 'tap',
      targetComponent: 'thermometer',
      hint: 'Tap to place the thermometer in the water.',
    },
    {
      index: 3,
      instruction: 'Prepare the stopwatch and data table.',
      why: 'Having everything ready before the first reading ensures you can record data at precise, regular intervals.',
      action: 'confirm',
      targetComponent: 'stopwatch',
      hint: 'Confirm everything is ready to begin recording.',
    },
  ],

  expectedRelationship: 'ln(T - T₀) vs t is linear (exponential decay)',
  acceptedValues: {},

  assistantContext:
    "Common student difficulties: (1) forgetting to stir before reading, leading to temperature gradients, (2) not recording ambient temperature T₀, (3) taking readings at irregular intervals, (4) confusion about which log to use (natural log for the decay constant).",

  commonQuestions: [
    "Why do I need to stir the water before each reading?",
    "What is Newton's Law of Cooling?",
    'Why does my graph curve instead of being a straight line?',
    'How do I find the cooling constant from my graph?',
    'Does the shape of the container affect the cooling rate?',
  ],
};
