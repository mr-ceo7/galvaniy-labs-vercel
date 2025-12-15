import { EXPERIMENTS, ExperimentDef } from './experimentDatabase';

export function generateRealisticData(experimentCode: string) {
  const exp = EXPERIMENTS[experimentCode];
  if (!exp) return null;

  const data = [];
  const range = exp.validRange.max - exp.validRange.min;
  const step = range / (exp.dataPoints - 1);

  for (let i = 0; i < exp.dataPoints; i++) {
    // Generate independent variable
    const independentVal = parseFloat((exp.validRange.min + (step * i)).toFixed(2));
    
    // Calculate theoretical dependent variable
    const theoreticalVal = exp.formula(independentVal);
    
    // Add realistic noise/error
    const errorFactor = 1 + ((Math.random() - 0.5) * 2 * exp.measurementError);
    const measuredVal = theoreticalVal * errorFactor;

    if (experimentCode === 'A-2') {
      const time20 = measuredVal * 20;
      const period = time20 / 20;
      const tSquared = period * period;
      data.push([
        independentVal,           
        parseFloat(time20.toFixed(2)), 
        parseFloat(period.toFixed(3)), 
        parseFloat(tSquared.toFixed(3)) 
      ]);
    } 
    else if (experimentCode === 'C-11') {
      // Newton's Cooling: Time, Temp, Excess (T-Ts), ln(Excess)
      const Ts = 25; // Surroundings
      const excess = measuredVal - Ts;
      const lnExcess = Math.log(excess > 0 ? excess : 0.1);
      
      data.push([
        independentVal, // Time
        parseFloat(measuredVal.toFixed(1)), // Temp
        parseFloat(excess.toFixed(1)), // T - Ts
        parseFloat(lnExcess.toFixed(3)) // ln(T-Ts)
      ]);
    }
    else if (experimentCode === 'D-14') {
        // Standing Waves: Mass, Tension, Length, Length^2
        const tension = independentVal * 9.81;
        const lSquared = measuredVal * measuredVal;
        data.push([
            independentVal, // Mass
            parseFloat(tension.toFixed(2)), // Tension
            parseFloat(measuredVal.toFixed(3)), // Length
            parseFloat(lSquared.toFixed(4)) // l^2
        ]);
    }
    else if (experimentCode === 'B-6') {
        // Young's Modulus: Mass, Extension
        // Usually extension is very small, measured in mm but formula returns meters
        const ext_mm = measuredVal * 1000;
        data.push([
            independentVal, // Mass kg
            parseFloat(ext_mm.toFixed(3)), // Extension mm
            parseFloat(measuredVal.toFixed(5)) // Extension m (for calcs)
        ]);
    }
    else {
      // Generic: Independent, Dependent
      data.push([
        independentVal,
        parseFloat(measuredVal.toFixed(3))
      ]);
    }
  }
  
  return data;
}