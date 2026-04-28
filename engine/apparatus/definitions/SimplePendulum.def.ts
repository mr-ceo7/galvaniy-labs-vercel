/**
 * Kit Definition: Simple Pendulum (A-2)
 * Educational content for the Simple Pendulum experiment.
 */
import type { KitDefinition } from '../../core/types.ts';

export const SimplePendulumDef: KitDefinition = {
  experimentCode: 'A-2',
  experimentTitle: 'Simple Pendulum — Acceleration Due to Gravity',
  category: 'mechanics',
  difficulty: 'beginner',
  heroImage: '/assets/lab/pendulum/hero.png',

  objective:
    'Determine the acceleration due to gravity (g) by measuring the period of oscillation of a simple pendulum at different lengths and plotting T² vs L.',

  theory: `A simple pendulum consists of a small dense bob suspended by a light inextensible string from a rigid support. For small angular displacements (θ < 10°), the motion is simple harmonic with period:

**T = 2π√(L/g)**

where L is the length from the pivot to the centre of the bob and g is the acceleration due to gravity.

Squaring both sides: **T² = (4π²/g) × L**

A graph of T² vs L is a straight line through the origin with slope **m = 4π²/g**, from which:

**g = 4π²/m**`,

  safetyNotes: [
    'Ensure the retort stand is firmly clamped to the bench.',
    'Keep the amplitude small (< 10°) to satisfy the simple harmonic approximation.',
    'Avoid swinging the bob near other apparatus or people.',
  ],

  apparatus: [
    {
      id: 'retort_stand',
      name: 'Retort Stand & Clamp',
      icon: '🔩',
      image: '/assets/lab/pendulum/retort_stand.png',
      description: 'Provides a rigid pivot point for the pendulum string.',
      learnMore: 'Secure the base of the retort stand to the bench with a G-clamp. Attach the boss head and clamp at the top. The string hangs from the clamp jaws — make sure it can swing freely without friction.',
      category: 'support',
    },
    {
      id: 'meter_ruler',
      name: 'Meter Ruler',
      icon: '📏',
      image: '/assets/lab/pendulum/meter_ruler.png',
      description: 'Measures the pendulum length from pivot to bob centre.',
      learnMore: 'Place the ruler vertically beside the string. Measure from the bottom of the clamp jaw (pivot) to the centre of the bob. Avoid parallax by keeping your eye level with the measurement mark. Precision: ±1 mm.',
      precision: '±1 mm',
      category: 'measurement',
    },
    {
      id: 'stopwatch',
      name: 'Digital Stopwatch',
      icon: '⏱',
      image: '/assets/lab/pendulum/stopwatch.png',
      description: 'Times multiple oscillations for period calculation.',
      learnMore: 'Time 10 complete oscillations to reduce percentage error in the timing. Start the stopwatch as the bob passes through the equilibrium position (lowest point) and count "zero" at that moment. Stop after 10 full swings back to the same point.',
      precision: '±0.01 s',
      category: 'measurement',
    },
    {
      id: 'bob',
      name: 'Brass Bob (50g)',
      icon: '🔴',
      image: '/assets/lab/pendulum/brass_bob.png',
      description: 'A small, dense spherical mass that acts as the pendulum bob.',
      learnMore: 'Use a small, heavy bob to minimize air resistance effects. The bob should be spherical so that the "length" is unambiguous — it is measured to the centre of the sphere. Tie the string securely through the hole at the top.',
      category: 'material',
    },
    {
      id: 'string',
      name: 'Inextensible String (1.2 m)',
      icon: '🧵',
      image: '/assets/lab/pendulum/string.png',
      description: 'A light, non-stretching string connecting the pivot to the bob.',
      learnMore: 'Use thin, strong thread (e.g. nylon fishing line) that does not stretch under the weight of the bob. The string should be as light as possible so its mass is negligible compared to the bob.',
      category: 'material',
    },
  ],

  setupSteps: [
    {
      index: 0,
      instruction: 'Secure the retort stand to the edge of the bench.',
      why: 'A stable base prevents the pivot from wobbling, which would introduce errors in the period measurement.',
      action: 'tap',
      targetComponent: 'retort_stand',
      hint: 'Tap the retort stand to place it on the bench.',
    },
    {
      index: 1,
      instruction: 'Attach the boss head and clamp to the top of the stand.',
      why: 'The clamp provides a friction-free pivot point. Mounting it high gives room for long pendulum lengths.',
      action: 'tap',
      targetComponent: 'retort_stand',
      hint: 'Tap the top of the stand to attach the clamp.',
    },
    {
      index: 2,
      instruction: 'Thread the string through the clamp and tie the bob to the other end.',
      why: 'The string must be firmly attached at both ends so it does not slip during oscillation.',
      action: 'tap',
      targetComponent: 'bob',
      hint: 'Tap the bob to attach the string.',
    },
    {
      index: 3,
      instruction: 'Set the initial pendulum length to 0.30 m using the ruler.',
      why: 'We start with a short length and increase systematically. 0.30 m gives a measurable but fast period.',
      action: 'slide',
      targetComponent: 'meter_ruler',
      hint: 'Adjust the length slider to 0.30 m.',
    },
    {
      index: 4,
      instruction: 'Place the stopwatch on the bench, ready to time.',
      why: 'Having the stopwatch ready before displacing the bob ensures you can start timing immediately.',
      action: 'confirm',
      targetComponent: 'stopwatch',
      hint: 'Confirm the stopwatch is ready.',
    },
  ],

  expectedRelationship: 'T² ∝ L (linear through origin)',
  acceptedValues: { g: 9.81 },

  assistantContext:
    'This is a classic introductory mechanics experiment. Students often struggle with: (1) keeping the amplitude small enough for SHM, (2) counting oscillations correctly (starting from zero), (3) measuring L to the centre of the bob not the top, and (4) understanding why we time 10 oscillations instead of 1.',

  commonQuestions: [
    'Why do we time 10 oscillations instead of just 1?',
    'What happens if the angle is too large?',
    'How do I measure the length correctly?',
    'Why does my value of g differ from 9.81?',
    'What is the source of error in this experiment?',
  ],
};
