/**
 * Kit Definition: Radioactive Decay Analogue (N-1)
 */
import type { KitDefinition } from '../../core/types.ts';

export const DecayAnalogueDef: KitDefinition = {
  experimentCode: 'N-1',
  experimentTitle: 'Radioactive Decay Analogue — Dice Simulation',
  category: 'nuclear',
  difficulty: 'beginner',
  objective: 'Model radioactive decay using dice to understand the concept of half-life and the random nature of nuclear decay.',
  theory: `Radioactive decay is a random process where unstable nuclei transform into more stable ones. The number of undecayed nuclei N decreases exponentially:\n\n**N(t) = N₀ e^(-λt)**\n\nThe half-life (t₁/₂) is the time for half the nuclei to decay:\n\n**t₁/₂ = ln(2)/λ ≈ 0.693/λ**\n\nIn this analogue, dice represent nuclei. Rolling a specific number (e.g., a 6) represents "decaying". The probability of any one die decaying per throw is 1/6, analogous to the decay constant.`,
  safetyNotes: [
    'No significant hazards — this is a simulation using dice.',
    'Keep dice contained in the tray to avoid losing them.',
  ],
  apparatus: [
    { id: 'dice', name: 'Set of Dice (50-100)', icon: '🎲', description: 'Each die represents an unstable nucleus.', learnMore: 'Each die has a 1/6 chance of showing any face. We define one face (e.g., 6) as "decayed". After each roll, remove all dice showing that face. The remaining dice are undecayed nuclei.', category: 'material' },
    { id: 'tray', name: 'Dice Tray', icon: '📦', description: 'Contains the dice during rolling.', learnMore: 'Use a tray with raised edges so dice do not fly off the bench. Shake the tray to roll all dice simultaneously.', category: 'general' },
    { id: 'data_sheet', name: 'Data Table / Graph Paper', icon: '📋', description: 'Records the number of remaining dice after each throw.', learnMore: 'Record the throw number and the count of remaining dice. You will plot N vs throw number to see the exponential decay curve.', category: 'general' },
  ],
  setupSteps: [
    { index: 0, instruction: 'Count your initial set of dice and record the number N₀.', why: 'You need to know the starting population to calculate the fraction remaining.', action: 'confirm', targetComponent: 'dice' },
    { index: 1, instruction: 'Place all dice in the tray.', why: 'The tray keeps all dice together for a fair, simultaneous roll.', action: 'tap', targetComponent: 'tray' },
    { index: 2, instruction: 'Prepare your data table with columns: Throw #, Dice Remaining, Fraction Remaining.', why: 'Organized data collection allows you to plot the decay curve accurately.', action: 'confirm', targetComponent: 'data_sheet' },
  ],
  expectedRelationship: 'N vs throw number follows exponential decay',
  acceptedValues: { 'half_life_throws': 3.8 },
  assistantContext: 'Students often struggle with: (1) understanding why the process is random even though the overall trend is predictable, (2) calculating half-life from the graph, (3) relating the 1/6 probability to the decay constant λ.',
  commonQuestions: [
    'Why is radioactive decay random?',
    'How do I find the half-life from my graph?',
    'Why does each throw remove roughly 1/6 of the dice?',
    'How does this relate to real radioactive decay?',
  ],
};
