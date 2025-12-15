import { EXPERIMENTS } from './experimentDatabase';
import { generateRealisticData } from './dataGenerator';

export function generateFallbackReport(experimentCode: string): string {
  const exp = EXPERIMENTS[experimentCode];
  
  // Generic fallback if experiment not in DB
  if (!exp) {
    return JSON.stringify({
      title: `Experiment ${experimentCode}`,
      objectives: ['To conduct the experiment.', 'To analyze the obtained data.'],
      apparatus: ['Standard Laboratory Equipment'],
      theory: 'Refer to the lab manual for detailed theory.',
      procedure: ['Set up the apparatus.', 'Record measurements.', 'Plot the graph.'],
      tableHeaders: ['Quantity X', 'Quantity Y'],
      tableData: [[1, 2], [2, 4], [3, 6], [4, 8]],
      graphConfig: {
        xColumnIndex: 0,
        yColumnIndex: 1,
        xLabel: 'X',
        yLabel: 'Y',
        title: 'Y vs X'
      },
      questions: [],
      calculationScript: "return { slope: 2, result: 'pending' };",
      analysisTemplate: "The graph shows a linear relationship with slope {{slope}}.",
      discussion: "The data follows a linear trend.",
      conclusion: "The experiment was conducted successfully.",
      simulationType: 'general'
    });
  }

  // Physics-based fallback
  const data = generateRealisticData(experimentCode);
  
  // Headers mapping
  let headers = ['Independent', 'Dependent'];
  let graphConfig = {
      xColumnIndex: 0,
      yColumnIndex: 1,
      xLabel: exp.independentVarLabel,
      yLabel: exp.dependentVarLabel,
      title: `${exp.dependentVarLabel} vs ${exp.independentVarLabel}`
  };

  if (experimentCode === 'A-2') {
    headers = ['Length L (m)', 'Time 20 osc (s)', 'Period T (s)', 'T² (s²)'];
    graphConfig = { xColumnIndex: 0, yColumnIndex: 3, xLabel: 'Length L (m)', yLabel: 'T² (s²)', title: 'T² vs L' };
  } else if (experimentCode === 'F-18') {
    headers = ['Voltage (V)', 'Current (A)'];
    graphConfig = { xColumnIndex: 0, yColumnIndex: 1, xLabel: 'Voltage (V)', yLabel: 'Current (A)', title: 'I vs V' };
  } else if (experimentCode === 'C-11') {
    headers = ['Time t (min)', 'Temp T (°C)', 'Excess (T-Ts)', 'ln(T-Ts)'];
    graphConfig = { xColumnIndex: 0, yColumnIndex: 3, xLabel: 'Time t (min)', yLabel: 'ln(T-Ts)', title: 'Cooling Curve' };
  } else if (experimentCode === 'D-14') {
    headers = ['Mass m (kg)', 'Tension T (N)', 'Length l (m)', 'l² (m²)'];
    graphConfig = { xColumnIndex: 1, yColumnIndex: 3, xLabel: 'Tension T (N)', yLabel: 'l² (m²)', title: 'l² vs T' };
  } else if (experimentCode === 'B-6') {
    headers = ['Mass M (kg)', 'Extension e (mm)', 'Extension e (m)'];
    graphConfig = { xColumnIndex: 0, yColumnIndex: 2, xLabel: 'Mass M (kg)', yLabel: 'Extension e (m)', title: 'Extension vs Load' };
  }

  return JSON.stringify({
    title: exp.name,
    objectives: exp.objectives,
    apparatus: exp.apparatus,
    theory: exp.theory,
    procedure: [
      `Set up the ${exp.apparatus[0]} and other equipment.`,
      `Vary the ${exp.independentVarLabel} within the range ${exp.validRange.min} to ${exp.validRange.max}.`,
      `Record the ${exp.dependentVarLabel}.`,
      'Repeat for at least 6 different values.',
      'Tabulate the results and plot the graph.'
    ],
    tableHeaders: headers,
    tableData: data,
    graphConfig: graphConfig,
    questions: [
      { question: `What is the physical significance of the slope?`, answer: "The slope is related to the physical constants in the formula." }
    ],
    calculationScript: exp.calculationScript,
    analysisTemplate: `From the graph, the slope is calculated to be {{slope}}. Using the formula, the result is determined to be {{${exp.expectedResult.label}}}.`,
    discussion: `The plotted points lie close to the line of best fit, confirming the theory. The calculated value is within experimental error of the expected value (${exp.expectedResult.value} ${exp.expectedResult.unit}).`,
    conclusion: `The experiment successfully determined ${exp.expectedResult.label} to be approximately equal to the theoretical value.`,
    simulationType: exp.simulationType
  });
}