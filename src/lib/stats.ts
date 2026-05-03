import * as jStatModule from 'jstat';
const jStat: any = (jStatModule as any).default?.jStat || (jStatModule as any).jStat || (jStatModule as any).default || jStatModule;

import { create, all } from 'mathjs';
const math = create(all);

export function getMean(data: number[]): number {
  if (!data.length) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

export function getStdDev(data: number[], isPopulation = false): number {
  if (data.length < 2) return 0;
  const mean = getMean(data);
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - (isPopulation ? 0 : 1));
  return Math.sqrt(variance);
}

export function getPercentile(data: number[], p: number): number {
  if (!data.length) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const fraction = index - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function finiteOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Lenth's Method PSE calculation
function calculateLenthPSE(effects: number[]) {
  const absEffects = effects.map(Math.abs);
  const s0 = 1.5 * jStat.median(absEffects);
  const filteredEffects = absEffects.filter(e => e < 2.5 * s0);
  if (filteredEffects.length === 0) return s0;
  const pse = 1.5 * jStat.median(filteredEffects);
  return pse;
}

// --- Process Capability Engine ---
export function analyzeCapability(params: any) {
  const { data, usl, lsl, target, isLslBoundary, isUslBoundary, subgroupType, subgroupSize, subgroupIds = [] } = params;

  const n = data.length;
  const mean = getMean(data);
  const stdevOverall = getStdDev(data, false);

  const adTestResult = calculateAndersonDarling(data);
  const isNormal = adTestResult.pValue > 0.05;

  const isStable = checkStability(data);

  let stdevWithin = stdevOverall;
  if (subgroupType === 'fixed' && subgroupSize === 1 && n > 1) {
    let mrSum = 0;
    for (let i = 1; i < n; i++) {
      mrSum += Math.abs(data[i] - data[i - 1]);
    }
    const mrBar = mrSum / (n - 1);
    stdevWithin = mrBar / 1.128;
  } else if (subgroupType === 'fixed' && subgroupSize > 1) {
    stdevWithin = calculateRBarStdDev(data, subgroupSize);
  } else if (subgroupType === 'variable' && subgroupIds.length === n) {
    stdevWithin = calculatePooledSubgroupStdDev(data, subgroupIds);
  }

  let Cp = null, Cpk = null, Pp = null, Ppk = null;
  const canUseWithinSigma = n >= 2 && stdevWithin > 0;
  const canUseOverallSigma = n >= 2 && stdevOverall > 0;

  if (isNormal) {
    if (usl !== null && lsl !== null && canUseWithinSigma) {
      Cp = (usl - lsl) / (6 * stdevWithin);
    }
    if (usl !== null && lsl !== null && canUseOverallSigma) {
      Pp = (usl - lsl) / (6 * stdevOverall);
    }
    const cpu = usl !== null && canUseWithinSigma ? (usl - mean) / (3 * stdevWithin) : Infinity;
    const cpl = lsl !== null && canUseWithinSigma ? (mean - lsl) / (3 * stdevWithin) : Infinity;
    Cpk = finiteOrNull(Math.min(cpu, cpl));

    const ppu = usl !== null && canUseOverallSigma ? (usl - mean) / (3 * stdevOverall) : Infinity;
    const ppl = lsl !== null && canUseOverallSigma ? (mean - lsl) / (3 * stdevOverall) : Infinity;
    Ppk = finiteOrNull(Math.min(ppu, ppl));
  } else {
    const p99865 = getPercentile(data, 0.99865);
    const p00135 = getPercentile(data, 0.00135);
    const p50 = getPercentile(data, 0.50);
    const spread = p99865 - p00135;
    if (usl !== null && lsl !== null && spread > 0) Pp = (usl - lsl) / spread;
    const ppu = usl !== null && p99865 !== p50 ? (usl - p50) / (p99865 - p50) : Infinity;
    const ppl = lsl !== null && p50 !== p00135 ? (p50 - lsl) / (p50 - p00135) : Infinity;
    Ppk = finiteOrNull(Math.min(ppu, ppl));
    Cp = Pp;
    Cpk = Ppk;
  }

  const observedPpmLsl = lsl !== null ? (data.filter((x: number) => x < lsl).length / n) * 1000000 : 0;
  const observedPpmUsl = usl !== null ? (data.filter((x: number) => x > usl).length / n) * 1000000 : 0;
  
  let expectedPpmLsl = 0, expectedPpmUsl = 0, overallPpmLsl = 0, overallPpmUsl = 0;

  if (isNormal && canUseWithinSigma && canUseOverallSigma) {
    if (lsl !== null && !isLslBoundary) {
      expectedPpmLsl = jStat.normal.cdf(lsl, mean, stdevWithin) * 1000000;
      overallPpmLsl = jStat.normal.cdf(lsl, mean, stdevOverall) * 1000000;
    }
    if (usl !== null && !isUslBoundary) {
      expectedPpmUsl = (1 - jStat.normal.cdf(usl, mean, stdevWithin)) * 1000000;
      overallPpmUsl = (1 - jStat.normal.cdf(usl, mean, stdevOverall)) * 1000000;
    }
  } else {
    expectedPpmLsl = observedPpmLsl;
    expectedPpmUsl = observedPpmUsl;
    overallPpmLsl = observedPpmLsl;
    overallPpmUsl = observedPpmUsl;
  }

  const expectedPpmTotal = expectedPpmLsl + expectedPpmUsl;
  const overallPpmTotal = overallPpmLsl + overallPpmUsl;

  return {
    mean, stdevOverall, stdevWithin, isNormal, normalityPValue: adTestResult.pValue,
    isStable, Cp, Cpk, Pp, Ppk,
    zBenchWithin: expectedPpmTotal > 0 && expectedPpmTotal < 1000000 ? -jStat.normal.inv(expectedPpmTotal / 1000000, 0, 1) : 6,
    zBenchOverall: overallPpmTotal > 0 && overallPpmTotal < 1000000 ? -jStat.normal.inv(overallPpmTotal / 1000000, 0, 1) : 6,
    observedPpmLsl, observedPpmUsl, observedPpmTotal: observedPpmLsl + observedPpmUsl,
    expectedPpmLsl, expectedPpmUsl, expectedPpmTotal,
    overallPpmLsl, overallPpmUsl, overallPpmTotal
  };
}

// --- Regression Engine ---

export function runMultipleRegression(yData: number[], xDataMatrix: number[][], xNames: string[], calculateVIF = true) {
  const n = yData.length;
  const k = xDataMatrix.length; 
  if (n < k + 1) return null;

  const X = [];
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (let j = 0; j < k; j++) row.push(xDataMatrix[j][i]);
    X.push(row);
  }

  const Y = yData.map(y => [y]);
  const Xt = math.transpose(X);
  const XtX = math.multiply(Xt, X);
  
  let XtX_inv;
  try {
    const inv = math.inv(XtX);
    XtX_inv = (inv as any).toArray ? (inv as any).toArray() : inv;
  } catch (e) { return null; }
  
  const XtY = math.multiply(Xt, Y);
  const betaMat = math.multiply(XtX_inv, XtY);
  const beta = (betaMat as any).toArray ? (betaMat as any).toArray() : betaMat;

  const Y_hat_mat = math.multiply(X, betaMat);
  const Y_hat = (Y_hat_mat as any).toArray ? (Y_hat_mat as any).toArray() : Y_hat_mat;
  const residuals = yData.map((y, i) => y - Y_hat[i][0]);

  // Adjusted Sum of Squares (Type III)
  const adjustedSS: { term: string, ss: number }[] = [];
  for (let i = 0; i < k; i++) {
      const subX = X.map(row => {
          const newRow = [...row];
          newRow.splice(i + 1, 1);
          return newRow;
      });
      const subXt = math.transpose(subX);
      const subXtX = math.multiply(subXt, subX);
      try {
          const subInv = math.inv(subXtX);
          const subXtY = math.multiply(subXt, Y);
          const subBeta = math.multiply(subInv, subXtY);
          const subYhat = math.multiply(subX, subBeta);
          const subYhatArr = (subYhat as any).toArray ? (subYhat as any).toArray() : subYhat;
          const subSSE = yData.reduce((acc, y, idx) => acc + Math.pow(y - subYhatArr[idx][0], 2), 0);
          const currentSSE = residuals.reduce((acc, r) => acc + Math.pow(r, 2), 0);
          adjustedSS.push({ term: xNames[i], ss: Math.max(0, subSSE - currentSSE) });
      } catch (e) { adjustedSS.push({ term: xNames[i], ss: 0 }); }
  }

  const yMean = getMean(yData);
  const sst = yData.reduce((acc, y) => acc + Math.pow(y - yMean, 2), 0);
  const sse = residuals.reduce((acc, r) => acc + Math.pow(r, 2), 0);
  
  // SSR is the variability explained by the model terms.
  // Using SST - SSE ensures R-squared matches standard OLS expectations.
  const ssr = Math.max(0, sst - sse);

  const dfTotal = n - 1;
  const dfModel = k;
  const dfError = n - k - 1;

  const msModel = ssr / dfModel;
  const msError = dfError > 0 ? sse / dfError : 0;
  let s = Math.sqrt(msError);
  
  const isSaturated = dfError <= 0;
  let effectiveDF = Math.max(1, dfError);

  if (isSaturated && k > 0) {
    const effects = [];
    for (let j = 1; j <= k; j++) effects.push(beta[j][0] * 2);
    const lenthPSE = calculateLenthPSE(effects);
    effectiveDF = Math.max(1, k / 3);
    s = (lenthPSE / 2) * Math.sqrt(n); 
  }

  const fStat = (msError === 0 || isSaturated) ? 0 : msModel / msError;
  const pValueModel = (dfError > 0 && !isSaturated && msError > 0) ? 1 - jStat.centralF.cdf(fStat, dfModel, dfError) : (isSaturated ? 1 : 0);

  const rSq = sst === 0 ? 0 : ssr / sst;
  const rSqAdj = dfError > 0 ? 1 - ((1 - rSq) * (n - 1)) / (n - k - 1) : rSq;

  const vif: number[] = [];
  for (let j = 0; j < k; j++) {
    if (calculateVIF && k > 1 && n > k + 1) {
      const y_vif = xDataMatrix[j];
      const x_vif = xDataMatrix.filter((_, idx) => idx !== j);
      const names_vif = xNames.filter((_, idx) => idx !== j);
      const subReg = runMultipleRegression(y_vif, x_vif, names_vif, false);
      vif.push(subReg ? (1 / (1 - subReg.rSq)) : 1);
    } else vif.push(1);
  }

  const coeffs = [];
  for (let j = 0; j <= k; j++) {
    const b = beta[j][0];
    const se = s * Math.sqrt(XtX_inv[j][j]); // Correct SE(beta)
    const t = (se === 0) ? 0 : b / se;
    const p = (effectiveDF > 0 || isSaturated) ? 2 * (1 - jStat.studentt.cdf(Math.abs(t), effectiveDF)) : 1;
    
    coeffs.push({
      term: j === 0 ? 'Constant' : xNames[j - 1],
      name: j === 0 ? 'Constant' : xNames[j - 1], 
      coeff: b,
      effect: j === 0 ? null : b * 2,
      se, t: (isSaturated && j === 0) ? 0 : t, p: (isSaturated && j === 0) ? 1 : p,
      vif: j === 0 ? null : vif[j - 1]
    });
  }

  const sequentialSS: { term: string, ss: number }[] = [];
  let lastSSR = 0;
  for (let i = 1; i <= k; i++) {
      const subX = X.map(row => row.slice(0, i + 1));
      const subInv = math.inv(math.multiply(math.transpose(subX), subX));
      const subBeta = math.multiply(subInv, math.multiply(math.transpose(subX), Y));
      const subYhat = math.multiply(subX, subBeta);
      const subYhatArr = (subYhat as any).toArray ? (subYhat as any).toArray() : subYhat;
      const currentSSE = yData.reduce((acc, y, idx) => acc + Math.pow(y - subYhatArr[idx][0], 2), 0);
      const currentSSR = sst - currentSSE;
      sequentialSS.push({ term: xNames[i - 1], ss: Math.max(0, currentSSR - lastSSR) });
      lastSSR = currentSSR;
  }

  const dwNum = residuals.slice(1).reduce((acc, r, i) => acc + Math.pow(r - residuals[i], 2), 0);
  const dw = sse === 0 ? 0 : dwNum / sse;

  // Normal Probability Plot Calculation
  const sortedResiduals = [...residuals].sort((a, b) => a - b);
  const probPlot = sortedResiduals.map((val, i) => {
    const pVal = (i + 1 - 0.375) / (n + 0.25);
    const theoreticalZ = jStat.normal.inv(pVal, 0, 1);
    return { observed: val, theoretical: theoreticalZ };
  });

  return {
    coeffs, rSq, rSqAdj, s, dw,
    anova: {
      model: { df: dfModel, ss: ssr, ms: msModel, f: fStat, p: pValueModel },
      error: { df: Math.max(0, dfError), ss: sse, ms: msError },
      total: { df: dfTotal, ss: sst }
    },
    sequentialSS, adjustedSS,
    probPlot,
    residuals: residuals.map((r, i) => ({ 
      order: i + 1, 
      value: r, 
      fitted: Y_hat[i][0],
      z: s === 0 ? 0 : r / s
    }))
  };
}

export function analyzeDOE(data: any[], responseKey: string, factors: string[], terms: string[]) {
    const y = data.map(d => Number(d[responseKey]));
    const xDataMatrix: number[][] = [];
    terms.forEach(term => {
        const column = data.map(d => {
            if (term.includes('*')) {
                return term.split('*').reduce((acc, p) => acc * (d[`${p}_coded`] ?? 1), 1);
            }
            return d[`${term}_coded`] ?? 0;
        });
        xDataMatrix.push(column);
    });
    return runMultipleRegression(y, xDataMatrix, terms);
}

export function generateFactorialDesign(factors: { name: string, low: number, high: number }[], replicates: number = 1, blocks: number = 1) {
  const k = factors.length;
  const baseRuns = Math.pow(2, k);
  let design = [];
  for (let r = 0; r < replicates; r++) {
    for (let i = 0; i < baseRuns; i++) {
        const stdOrder = r * baseRuns + i + 1;
        const run: any = { stdOrder, replicate: r + 1, block: Math.floor(i / (baseRuns / blocks)) + 1 };
        factors.forEach((f, fIdx) => {
            const coded = (Math.floor(i / Math.pow(2, fIdx)) % 2) === 0 ? -1 : 1;
            run[`${f.name}_coded`] = coded;
            run[f.name] = coded === -1 ? Number(f.low) : Number(f.high);
        });
        design.push(run);
    }
  }
  return design;
}

export function getUncodedCoefficients(codedResults: any, factors: { name: string, low: number, high: number }[]) {
  if (!codedResults) return null;
  return codedResults.coeffs.map((c: any) => {
    if (c.name === 'Constant') return { ...c };
    let divisor = c.name.split('*').reduce((acc: number, p: string) => {
      const f = factors.find(fact => fact.name === p);
      return acc * (f ? (f.high - f.low) / 2 : 1);
    }, 1);
    return { ...c, coeff: c.coeff / divisor, se: (c.se || 0) / divisor, effect: c.effect ? c.effect / divisor : null };
  });
}

export function generateDynamicHistogram(data: number[]) {
  const n = data.length;
  if (n === 0) return [];
  const numBins = Math.max(5, Math.ceil(Math.log2(n) + 1));
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (min === max) return [{ x: min, count: n, min, max }];
  const binWidth = (max - min) / numBins;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    x: min + (i + 0.5) * binWidth,
    min: min + i * binWidth,
    max: min + (i + 1) * binWidth,
    count: 0
  }));
  data.forEach(val => {
    for (let i = 0; i < numBins; i++) {
      if (val >= bins[i].min && (val < bins[i].max || (i === numBins - 1 && val <= bins[i].max))) {
        bins[i].count++;
        break;
      }
    }
  });
  return bins;
}

export function generateNormalCurve(mean: number, stdev: number, histData: any[]) {
  if (!histData.length || stdev === 0) return [];
  const minX = histData[0].min;
  const maxX = histData[histData.length - 1].max;
  const binWidth = histData[0].max - histData[0].min;
  const n = histData.reduce((sum, bin) => sum + bin.count, 0);
  const area = n * binWidth; 
  const curveData = [];
  const points = 50;
  const step = (maxX - minX) / points;
  for (let i = 0; i <= points; i++) {
    const x = minX + i * step;
    const pdf = jStat.normal.pdf(x, mean, stdev);
    curveData.push({ x, y: pdf * area });
  }
  return curveData;
}

export function sampleData<T>(data: T[], maxPoints: number = 3000): T[] {
  if (!data || data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const sampled: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(data[Math.floor(i * step)]);
  }
  return sampled;
}

export function generateQQData(data: number[]) {
  if (data.length < 2) return [];
  const sorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  const mean = getMean(data);
  const stdev = getStdDev(data);
  return sorted.map((val, i) => {
    const p = (i + 1 - 0.375) / (n + 0.25);
    const z = jStat.normal.inv(p, 0, 1);
    const expected = mean + z * stdev;
    return { x: expected, y: val };
  });
}

export function run1SampleTTest(data: number[], target: number, alternative: string = 'neq') {
  const n = data.length;
  if (n < 2) return { pValue: 1, statistic: 0, df: 0, mean: 0, sd: 0, n: 0 };
  const mean = getMean(data);
  const sd = getStdDev(data);
  const se = sd / Math.sqrt(n);
  const t = (mean - target) / se;
  const df = n - 1;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.studentt.cdf(t, df);
  else if (alternative === 'less') pValue = jStat.studentt.cdf(t, df);
  else pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return { pValue, statistic: t, df, mean, sd, n };
}

export function run1SampleZTest(data: number[], target: number, alternative: string = 'neq') {
  const n = data.length;
  if (n < 1) return { pValue: 1, statistic: 0, mean: 0, sd: 0, n: 0 };
  const mean = getMean(data);
  const sd = getStdDev(data);
  const se = sd / Math.sqrt(n);
  const z = se === 0 ? 0 : (mean - target) / se;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.normal.cdf(z, 0, 1);
  else if (alternative === 'less') pValue = jStat.normal.cdf(z, 0, 1);
  else pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  return { pValue, statistic: z, mean, sd, n };
}

export function run1SampleWilcoxon(data: number[], target: number, alternative: string = 'neq') {
  const diffs = data.map(x => x - target).filter(x => x !== 0);
  const n = diffs.length;
  if (n < 5) return { pValue: 1, statistic: 0, n, mean: getMean(data) };

  const absDiffs = diffs.map(Math.abs);
  const ranked = absDiffs.map((val, i) => ({ val, sign: Math.sign(diffs[i]) }))
    .sort((a, b) => a.val - b.val);

  let rSumPos = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && ranked[j].val === ranked[i].val) j++;
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (ranked[k].sign > 0) rSumPos += rank;
    }
    i = j;
  }

  const m = (n * (n + 1)) / 4;
  const s = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const z = (rSumPos - m) / s;

  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.normal.cdf(z, 0, 1);
  else if (alternative === 'less') pValue = jStat.normal.cdf(z, 0, 1);
  else pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

  return { pValue, statistic: rSumPos, n, mean: getMean(data) };
}

export function run2SampleTTest(data1: number[], data2: number[], alternative: string = 'neq', pooled: boolean = false) {
  const n1 = data1.length, n2 = data2.length;
  if (n1 < 2 || n2 < 2) return { pValue: 1, statistic: 0, df: 0, m1: 0, m2: 0, s1: 0, s2: 0, n1: 0, n2: 0 };
  const m1 = getMean(data1), m2 = getMean(data2), s1 = getStdDev(data1), s2 = getStdDev(data2);
  let t: number, df: number;
  if (pooled) {
    const sp2 = ((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2);
    const se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    t = se === 0 ? 0 : (m1 - m2) / se;
    df = n1 + n2 - 2;
  } else {
    const se1 = s1 ** 2 / n1, se2 = s2 ** 2 / n2, seTotal = Math.sqrt(se1 + se2);
    t = seTotal === 0 ? 0 : (m1 - m2) / seTotal;
    df = (seTotal === 0) ? 1 : Math.pow(se1 + se2, 2) / (Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1));
  }
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.studentt.cdf(t, df);
  else if (alternative === 'less') pValue = jStat.studentt.cdf(t, df);
  else pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return { pValue, statistic: t, df, m1, m2, s1, s2, n1, n2 };
}

export function runANOVA(groups: number[][]) {
  const k = groups.length;
  const nTotal = groups.reduce((acc, g) => acc + g.length, 0);
  const allData = groups.flat();
  const grandMean = getMean(allData);
  let ssBetween = 0, ssWithin = 0;
  groups.forEach(g => {
    const m = getMean(g);
    ssBetween += g.length * Math.pow(m - grandMean, 2);
    g.forEach(x => { ssWithin += Math.pow(x - m, 2); });
  });
  const dfB = k - 1, dfW = nTotal - k;
  const msB = ssBetween / dfB, msW = ssWithin / dfW;
  const f = msW === 0 ? 0 : msB / msW;
  return { 
    pValue: 1 - jStat.centralF.cdf(f, dfB, dfW), 
    statistic: f, 
    dfBetween: dfB, 
    dfWithin: dfW,
    msWithin: msW,
    ssWithin: ssWithin,
    msBetween: msB,
    ssBetween: ssBetween
  };
}

export function calculateAndersonDarling(data: number[]) {
  const n = data.length;
  if (n < 7) return { pValue: 1, statistic: 0, inconclusive: true };
  const mean = getMean(data), stdev = getStdDev(data), sorted = [...data].sort((a, b) => a - b);
  if (stdev === 0) return { pValue: 1, statistic: 0, inconclusive: true };
  let S = 0;
  for (let i = 0; i < n; i++) {
    const f = Math.max(Math.min(jStat.normal.cdf(sorted[i], mean, stdev), 0.999), 0.001);
    const rf = Math.max(Math.min(jStat.normal.cdf(sorted[n - 1 - i], mean, stdev), 0.999), 0.001);
    S += ((2 * (i + 1) - 1) / n) * (Math.log(f) + Math.log(1 - rf));
  }
  const A2 = -n - S;
  const A2adj = A2 * (1 + 0.75 / n + 2.25 / Math.pow(n, 2));
  let p = 0;
  if (A2adj >= 0.6) p = Math.exp(1.2937 - 5.709 * A2adj);
  else if (A2adj >= 0.34) p = Math.exp(0.9177 - 4.279 * A2adj);
  else p = 1 - Math.exp(-13.436 + 101.14 * A2adj);
  return { statistic: A2adj, pValue: p };
}

export function run1SampleVarianceTest(data: number[], targetVar: number, alternative: string = 'neq') {
  const n = data.length;
  if (n < 2) return { pValue: 1, statistic: 0, df: n - 1, variance: 0 };
  const v = Math.pow(getStdDev(data), 2);
  const chi2 = ((n - 1) * v) / targetVar;
  const df = n - 1;
  let pValue: number;
  
  if (alternative === 'greater') {
    pValue = 1 - jStat.chisquare.cdf(chi2, df);
  } else if (alternative === 'less') {
    pValue = jStat.chisquare.cdf(chi2, df);
  } else {
    const p = jStat.chisquare.cdf(chi2, df);
    pValue = 2 * Math.min(p, 1 - p);
  }
  
  return { pValue, statistic: chi2, df, variance: v };
}

export function runBartlettTest(groups: number[][]) {
  const k = groups.length;
  const ns = groups.map(g => g.length);
  const nTotal = ns.reduce((a, b) => a + b, 0);
  const vars = groups.map(g => Math.pow(getStdDev(g), 2));
  
  const pooledVar = groups.reduce((acc, g, i) => acc + (ns[i] - 1) * vars[i], 0) / (nTotal - k);
  
  const numerator = (nTotal - k) * Math.log(pooledVar) - ns.reduce((acc, n, i) => acc + (n - 1) * Math.log(vars[i]), 0);
  const c = 1 + (1 / (3 * (k - 1))) * (ns.reduce((acc, n) => acc + (1 / (n - 1)), 0) - (1 / (nTotal - k)));
  
  const b = numerator / c;
  const pValue = 1 - jStat.chisquare.cdf(b, k - 1);
  
  return { statistic: b, pValue, df: k - 1 };
}

export function runFTest(data1: number[], data2: number[], alternative: string = 'neq') {
  const v1 = Math.pow(getStdDev(data1), 2), v2 = Math.pow(getStdDev(data2), 2);
  const df1 = data1.length - 1, df2 = data2.length - 1;
  const f = v1 / v2;
  
  let pValue: number;
  if (alternative === 'greater') {
    pValue = 1 - jStat.centralF.cdf(f, df1, df2);
  } else if (alternative === 'less') {
    pValue = jStat.centralF.cdf(f, df1, df2);
  } else {
    const p = jStat.centralF.cdf(f, df1, df2);
    pValue = 2 * Math.min(p, 1 - p);
  }
  
  return { statistic: f, pValue: Math.min(1, pValue), df1, df2 };
}

export function runLeveneTest(groups: number[][]) {
  const groupMedians = groups.map(g => jStat.median(g));
  const absDevs = groups.map((g, i) => g.map(x => Math.abs(x - groupMedians[i])));
  return runANOVA(absDevs);
}

export function runWelchANOVA(groups: number[][]) {
  const k = groups.length, ns = groups.map(g => g.length), means = groups.map(g => jStat.mean(g)), vars = groups.map(g => jStat.variance(g, true));
  const weights = ns.map((n, i) => n / vars[i]), sumWeights = jStat.sum(weights);
  const weightedGrandMean = weights.reduce((acc, w, i) => acc + (w * means[i]), 0) / sumWeights;
  const lambdaNum = weights.reduce((acc, w, i) => acc + (Math.pow(1 - (w / sumWeights), 2) / (ns[i] - 1)), 0);
  const lambda = lambdaNum / (Math.pow(k, 2) - 1);
  const msB = weights.reduce((acc, w, i) => acc + (w * Math.pow(means[i] - weightedGrandMean, 2)), 0) / (k - 1);
  const fStat = msB / (1 + (2 * (k - 2) * lambda));
  const df1 = k - 1, df2 = (k * k - 1) / (3 * lambdaNum);
  return { statistic: fStat, pValue: 1 - jStat.centralF.cdf(fStat, df1, df2), df1, df2 };
}

export function runChiSquareIndependence(matrix: number[][]) {
  const rows = matrix.length, cols = matrix[0].length;
  const rowTotals = matrix.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = Array(cols).fill(0).map((_, j) => matrix.reduce((acc, r) => acc + r[j], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const e = (rowTotals[i] * colTotals[j]) / grandTotal;
      if (e > 0) chi2 += Math.pow(matrix[i][j] - e, 2) / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  return { statistic: chi2, pValue: 1 - jStat.chisquare.cdf(chi2, df), df };
}

export function runChiSquareGoodnessOfFit(observed: number[], expected: number[]) {
  const n = observed.length;
  let chi2 = 0;
  for (let i = 0; i < n; i++) {
    if (expected[i] > 0) chi2 += Math.pow(observed[i] - expected[i], 2) / expected[i];
  }
  return { statistic: chi2, pValue: 1 - jStat.chisquare.cdf(chi2, n - 1), df: n - 1 };
}

export function run1SampleProportion(events: number, trials: number, target: number, alternative: string = 'neq', confidence: number = 0.95) {
  const p = events / trials, se = Math.sqrt((target * (1 - target)) / trials);
  const z = se === 0 ? 0 : (p - target) / se;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.normal.cdf(z, 0, 1);
  else if (alternative === 'less') pValue = jStat.normal.cdf(z, 0, 1);
  else pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

  const zAlpha = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  const margin = zAlpha * Math.sqrt((p * (1 - p)) / trials);
  return { statistic: z, pValue, p, ci1: { nominal: p, lower: Math.max(0, p - margin), upper: Math.min(1, p + margin) } };
}

export function run2SampleProportion(e1: number, n1: number, e2: number, n2: number, alternative: string = 'neq', pooled: boolean = true, confidence: number = 0.95) {
  const p1 = e1 / n1, p2 = e2 / n2, pPool = (e1 + e2) / (n1 + n2);
  const se = pooled ? Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2)) : Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  const z = se === 0 ? 0 : (p1 - p2) / se;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.normal.cdf(z, 0, 1);
  else if (alternative === 'less') pValue = jStat.normal.cdf(z, 0, 1);
  else pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  
  const zAlpha = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  const seDiff = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  
  // Also calculate individual CIs for UI rendering
  const margin1 = zAlpha * Math.sqrt((p1 * (1 - p1)) / n1);
  const margin2 = zAlpha * Math.sqrt((p2 * (1 - p2)) / n2);

  return { 
    statistic: z, 
    pValue, 
    p1, p2, 
    diff: p1 - p2, 
    diffLower: (p1 - p2) - zAlpha * seDiff, 
    diffUpper: (p1 - p2) + zAlpha * seDiff,
    ci1: { nominal: p1, lower: Math.max(0, p1 - margin1), upper: Math.min(1, p1 + margin1) },
    ci2: { nominal: p2, lower: Math.max(0, p2 - margin2), upper: Math.min(1, p2 + margin2) },
    e1, n1, e2, n2
  };
}

export function run1SamplePoisson(events: number, sampleSize: number, targetRate: number, alternative: string = 'neq', confidence: number = 0.95) {
  const rate = events / sampleSize;
  const lambda = targetRate * sampleSize;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - (events === 0 ? 0 : jStat.poisson.cdf(events - 1, lambda));
  else if (alternative === 'less') pValue = jStat.poisson.cdf(events, lambda);
  else {
    const pObs = jStat.poisson.pdf(events, lambda);
    let sumP = 0;
    for (let x = 0; x <= Math.max(20, lambda * 3); x++) {
      if (jStat.poisson.pdf(x, lambda) <= pObs + 1e-7) sumP += jStat.poisson.pdf(x, lambda);
    }
    pValue = Math.min(1, sumP);
  }
  
  const zAlpha = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  const margin = zAlpha * Math.sqrt(rate / sampleSize);
  return { 
    statistic: rate, 
    pValue, 
    rate, 
    ci1: { nominal: rate, lower: Math.max(0, rate - margin), upper: rate + margin },
    events, sampleSize, targetRate
  };
}

export function run2SamplePoisson(e1: number, s1: number, e2: number, s2: number, alternative: string = 'neq', confidence: number = 0.95) {
  const r1 = e1 / s1, r2 = e2 / s2, se = Math.sqrt(r1 / s1 + r2 / s2);
  const zValue = se === 0 ? 0 : (r1 - r2) / se;
  let pValue: number;
  if (alternative === 'greater') pValue = 1 - jStat.normal.cdf(zValue, 0, 1);
  else if (alternative === 'less') pValue = jStat.normal.cdf(zValue, 0, 1);
  else pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zValue), 0, 1));

  const zAlpha = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  const seDiff = Math.sqrt(r1 / s1 + r2 / s2);
  
  // Calculate individual CIs for plotting
  const margin1 = zAlpha * Math.sqrt(r1 / s1);
  const margin2 = zAlpha * Math.sqrt(r2 / s2);

  return { 
    statistic: zValue, 
    pValue, 
    r1, r2, 
    diff: r1 - r2, 
    diffLower: (r1 - r2) - zAlpha * seDiff, 
    diffUpper: (r1 - r2) + zAlpha * seDiff,
    ci1: { nominal: r1, lower: Math.max(0, r1 - margin1), upper: r1 + margin1 },
    ci2: { nominal: r2, lower: Math.max(0, r2 - margin2), upper: r2 + margin2 },
    e1, s1, e2, s2
  };
}

export function getConfidenceInterval(data: number[], confidence = 0.95) {
  const n = data.length, mean = getMean(data), sd = getStdDev(data);
  const se = sd / Math.sqrt(n), t = jStat.studentt.inv(1 - (1 - confidence) / 2, n - 1);
  return { mean, lcl: mean - t * se, ucl: mean + t * se };
}

export function getMedianConfidenceInterval(data: number[], confidence = 0.95) {
  const sorted = [...data].sort((a,b) => a-b), n = data.length;
  const z = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  const j = Math.max(0, Math.floor(n/2 - z * Math.sqrt(n/4)));
  const k = Math.min(n-1, Math.ceil(n/2 + z * Math.sqrt(n/4)));
  return { median: jStat.median(data), lcl: sorted[j], ucl: sorted[k] };
}

export function getVarianceConfidenceInterval(data: number[], confidence = 0.95) {
  const n = data.length, v = Math.pow(getStdDev(data), 2);
  const alpha = 1 - confidence;
  const lcl = ((n - 1) * v) / jStat.chisquare.inv(1 - alpha / 2, n - 1);
  const ucl = ((n - 1) * v) / jStat.chisquare.inv(alpha / 2, n - 1);
  return { var: v, lcl, ucl, sd: Math.sqrt(v), sdLcl: Math.sqrt(lcl), sdUcl: Math.sqrt(ucl) };
}

export function runMannWhitneyU(data1: number[], data2: number[], alternative: string = 'neq') {
  const n1 = data1.length, n2 = data2.length;
  const combined = [...data1.map(v => ({ v, g: 1 })), ...data2.map(v => ({ v, g: 2 }))].sort((a, b) => a.v - b.v);
  let r1 = 0;
  combined.forEach((item, i) => { if (item.g === 1) r1 += (i + 1); });
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const mU = (n1 * n2) / 2, sU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (u1 - mU) / sU;
  let p: number;
  if (alternative === 'greater') p = 1 - jStat.normal.cdf(z, 0, 1);
  else if (alternative === 'less') p = jStat.normal.cdf(z, 0, 1);
  else p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  return { statistic: u1, pValue: p, u1, u2: n1 * n2 - u1 };
}

export function runKruskalWallis(groups: number[][]) {
  const combined = groups.flatMap((g, i) => g.map(v => ({ v, i }))).sort((a, b) => a.v - b.v);
  const n = combined.length;
  const rankSums = groups.map((_, i) => combined.reduce((acc, x, idx) => acc + (x.i === i ? idx + 1 : 0), 0));
  const h = (12 / (n * (n + 1))) * rankSums.reduce((acc, rs, i) => acc + (rs ** 2 / groups[i].length), 0) - 3 * (n + 1);
  return { statistic: h, pValue: 1 - jStat.chisquare.cdf(h, groups.length - 1), df: groups.length - 1 };
}

export function runTukeyHSD(groups: number[][], msW: number, dfW: number, groupLabels: string[]) {
  const k = groups.length;
  const comparisons = [];
  
  // Approximate Q critical values for alpha=0.05
  // k: 2, 3, 4, 5, 6, 7, 8, 9, 10
  const qTable: { [key: number]: number } = {
    2: 2.77, 3: 3.31, 4: 3.63, 5: 3.86, 
    6: 4.03, 7: 4.17, 8: 4.29, 9: 4.39, 10: 4.47
  };
  
  const qCrit = qTable[k] || 4.5;
  
  const means = groups.map(g => getMean(g));
  const ns = groups.map(g => g.length);

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = Math.abs(means[i] - means[j]);
      const se = Math.sqrt((msW / 2) * (1 / ns[i] + 1 / ns[j]));
      const q = diff / se;
      const isSignificant = q > qCrit;
      
      comparisons.push({
        groupA: groupLabels[i],
        groupB: groupLabels[j],
        diff: means[i] - means[j],
        q,
        isSignificant
      });
    }
  }
  return { comparisons, qCrit };
}

export function runNemenyi(groups: number[][], groupLabels: string[]) {
  const k = groups.length;
  const combined = groups.flatMap((g, i) => g.map(v => ({ v, i }))).sort((a, b) => a.v - b.v);
  const n = combined.length;
  
  // Assign ranks with ties handled
  const ranks = combined.map((x, idx) => {
    let sumRanks = idx + 1;
    let count = 1;
    let next = idx + 1;
    while (next < n && combined[next].v === combined[idx].v) {
      sumRanks += next + 1;
      count++;
      next++;
    }
    const avgRank = sumRanks / count;
    return { ...x, rank: avgRank };
  });

  const groupRankMeans = groups.map((_, i) => {
    const groupRanks = ranks.filter(r => r.i === i).map(r => r.rank);
    return getMean(groupRanks);
  });
  const ns = groups.map(g => g.length);

  // Approximate Q/sqrt(2) critical values for Nemenyi at alpha=0.05
  // k: 2, 3, 4, 5, 6, 7, 8, 9, 10
  const qTable: { [key: number]: number } = {
    2: 2.77, 3: 3.31, 4: 3.63, 5: 3.86, 
    6: 4.03, 7: 4.17, 8: 4.29, 9: 4.39, 10: 4.47
  };
  const qCrit = qTable[k] || 4.5;
  const cdFactor = qCrit / Math.sqrt(2);

  const comparisons = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = Math.abs(groupRankMeans[i] - groupRankMeans[j]);
      const se = Math.sqrt((n * (n + 1) / 12) * (1 / ns[i] + 1 / ns[j]));
      const stat = diff / se;
      const isSignificant = stat > cdFactor;

      comparisons.push({
        groupA: groupLabels[i],
        groupB: groupLabels[j],
        rankDiff: groupRankMeans[i] - groupRankMeans[j],
        stat,
        isSignificant
      });
    }
  }

  return { comparisons, qCrit };
}

function checkStability(data: number[]): boolean {
  const n = data.length;
  if (n < 2) return true;
  const mean = getMean(data);
  let mrSum = 0;
  for (let i = 1; i < n; i++) mrSum += Math.abs(data[i] - data[i - 1]);
  const limit = 3 * ((mrSum / (n - 1)) / 1.128);
  return !data.some(val => Math.abs(val - mean) > limit);
}

function calculateRBarStdDev(data: number[], subgroupSize: number): number {
  const d2_table: { [key: number]: number } = { 2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326 };
  const d2 = d2_table[subgroupSize] || 2.5;
  let rSum = 0, count = 0;
  for (let i = 0; i < data.length; i += subgroupSize) {
    const g = data.slice(i, i + subgroupSize);
    if (g.length === subgroupSize) {
      rSum += (Math.max(...g) - Math.min(...g));
      count++;
    }
  }
  return count === 0 ? getStdDev(data) : (rSum / count) / d2;
}

function calculatePooledSubgroupStdDev(data: number[], subgroupIds: any[]): number {
  const groups = new Map<string, number[]>();
  data.forEach((value, index) => {
    const id = subgroupIds[index];
    if (id === undefined || id === null || id === '') return;
    const key = String(id);
    const group = groups.get(key) || [];
    group.push(value);
    groups.set(key, group);
  });

  let ssWithin = 0;
  let dfWithin = 0;
  groups.forEach(group => {
    if (group.length < 2) return;
    const mean = getMean(group);
    ssWithin += group.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
    dfWithin += group.length - 1;
  });

  return dfWithin > 0 ? Math.sqrt(ssWithin / dfWithin) : getStdDev(data);
}
