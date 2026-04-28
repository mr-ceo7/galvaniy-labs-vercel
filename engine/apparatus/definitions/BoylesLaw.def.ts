/**
 * Kit Definition: Boyle's Law (C-3)
 */
import type { KitDefinition } from '../../core/types.ts';

export const BoylesLawDef: KitDefinition = {
  experimentCode: 'C-12',
  experimentTitle: "Boyle's Law — Pressure-Volume Relationship",
  category: 'heat',
  difficulty: 'intermediate',
  objective: "Verify Boyle's Law by measuring the pressure of a fixed mass of gas at different volumes at constant temperature, and confirm that PV = constant.",
  theory: `Boyle's Law states that for a fixed mass of ideal gas at constant temperature, the pressure is inversely proportional to the volume:\n\n**PV = constant**   or   **P ∝ 1/V**\n\nA graph of **P vs 1/V** is a straight line through the origin. This is a special case of the ideal gas law: PV = nRT.`,
  safetyNotes: [
    'Do not exceed the maximum pressure rating of the apparatus.',
    'Handle the glass syringe carefully.',
    'Allow time for thermal equilibrium after each volume change.',
  ],
  apparatus: [
    { id: 'syringe', name: 'Gas Syringe', icon: '💉', description: 'Contains the trapped gas whose volume can be changed.', learnMore: 'The syringe must be airtight. Check for leaks by pushing the piston and releasing — it should spring back.', category: 'general' },
    { id: 'pressure_gauge', name: 'Bourdon Pressure Gauge', icon: '🔵', description: 'Measures the pressure of the trapped gas.', learnMore: 'Tap the gauge gently before reading to overcome friction. Read when the needle is steady.', precision: '±1 kPa', category: 'measurement' },
    { id: 'pump', name: 'Hand Pump / Piston', icon: '🔧', description: 'Changes the volume of the trapped gas.', learnMore: 'Push slowly — quick compression heats the gas, violating constant temperature.', category: 'general' },
    { id: 'thermometer', name: 'Thermometer', icon: '🌡', description: 'Monitors constant temperature.', learnMore: 'If temperature changes by more than 1°C, wait for it to return before recording.', precision: '±0.5 °C', category: 'measurement' },
  ],
  setupSteps: [
    { index: 0, instruction: 'Connect the gas syringe to the pressure gauge via tubing.', why: 'The system must be sealed so no gas escapes.', action: 'tap', targetComponent: 'syringe' },
    { index: 1, instruction: 'Check the system is airtight.', why: 'Leaks violate the fixed mass condition.', action: 'confirm' },
    { index: 2, instruction: 'Record initial pressure and volume readings.', why: 'You need a baseline starting point.', action: 'observe', targetComponent: 'pressure_gauge' },
  ],
  expectedRelationship: 'P ∝ 1/V (linear P vs 1/V through origin)',
  acceptedValues: {},
  assistantContext: "Key challenges: ensuring thermal equilibrium after compression, leaks, understanding hyperbola vs linear graph.",
  commonQuestions: [
    'Why wait after changing volume?',
    "What does Boyle's Law assume about temperature?",
    'Why is my PV product not constant?',
    'How do I plot P vs 1/V?',
  ],
};
