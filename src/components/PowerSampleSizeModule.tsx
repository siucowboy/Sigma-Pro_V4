import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Sigma, Users, Layers3, Percent, ArrowRight, TrendingUp, Hash } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as jStatModule from 'jstat';

const jStat: any = (jStatModule as any).default?.jStat || (jStatModule as any).jStat || (jStatModule as any).default || jStatModule;

type TabId = 'one-sample' | 'two-sample' | 'three-plus' | 'proportions' | 'poisson';
type Alternative = 'two-sided' | 'greater' | 'less';
type Direction = 'increase' | 'decrease';
type SolveMode = 'sample-size' | 'power' | 'effect';

type Result = {
  mode: SolveMode;
  primary: string;
  secondary: string;
  note: string;
  achievedPower: number | null;
  targetN: number | null;
  effect: number | null;
  details?: string;
};

type CurvePoint = {
  n: number;
  power: number;
};

type PowerSettings = {
  activeTab: TabId;
  alphaInput: string;
  powerInput: string;
  alternative: Alternative;
  oneDeltaInput: string;
  oneSigmaInput: string;
  oneNInput: string;
  oneNonparametric: boolean;
  twoDeltaInput: string;
  twoSigmaInput: string;
  twoControlNInput: string;
  twoNonparametric: boolean;
  groupsInput: string;
  anovaEffectInput: string;
  anovaTotalNInput: string;
  anovaNonparametric: boolean;
  propMode: 'one' | 'two';
  propDirection: Direction;
  p0Input: string;
  p1Input: string;
  p2Input: string;
  propNInput: string;
  poissonMode: 'one' | 'two';
  poissonDirection: Direction;
  poissonUnitLabel: string;
  poissonBaselineRateInput: string;
  poissonExpectedRateInput: string;
  poissonExposureInput: string;
  poissonControlRateInput: string;
  poissonTreatmentRateInput: string;
  poissonFixedControlExposureInput: string;
  poissonTreatmentExposureInput: string;
};

const POWER_SETTINGS_KEY = 'sigmaStats_power_sample_size_settings';
const defaultPowerSettings: PowerSettings = {
  activeTab: 'one-sample',
  alphaInput: '0.05',
  powerInput: '0.90',
  alternative: 'two-sided',
  oneDeltaInput: '1',
  oneSigmaInput: '2',
  oneNInput: '',
  oneNonparametric: false,
  twoDeltaInput: '1',
  twoSigmaInput: '2',
  twoControlNInput: '',
  twoNonparametric: false,
  groupsInput: '3',
  anovaEffectInput: '0.25',
  anovaTotalNInput: '',
  anovaNonparametric: false,
  propMode: 'one',
  propDirection: 'increase',
  p0Input: '0.10',
  p1Input: '0.15',
  p2Input: '0.20',
  propNInput: '',
  poissonMode: 'one',
  poissonDirection: 'increase',
  poissonUnitLabel: 'unit',
  poissonBaselineRateInput: '0.10',
  poissonExpectedRateInput: '0.15',
  poissonExposureInput: '',
  poissonControlRateInput: '0.10',
  poissonTreatmentRateInput: '0.15',
  poissonFixedControlExposureInput: '',
  poissonTreatmentExposureInput: ''
};

function loadPowerSettings(): PowerSettings {
  if (typeof window === 'undefined') return defaultPowerSettings;
  try {
    const saved = window.localStorage.getItem(POWER_SETTINGS_KEY);
    return saved ? { ...defaultPowerSettings, ...JSON.parse(saved) } : defaultPowerSettings;
  } catch {
    return defaultPowerSettings;
  }
}

const tabs: { id: TabId, label: string, icon: React.ElementType }[] = [
  { id: 'one-sample', label: 'One Sample', icon: Sigma },
  { id: 'two-sample', label: 'Two Sample', icon: Users },
  { id: 'three-plus', label: '3 or More', icon: Layers3 },
  { id: 'proportions', label: 'Proportions (1 and 2 sample)', icon: Percent },
  { id: 'poisson', label: 'Poisson Rates', icon: Hash },
];

const zForAlpha = (alpha: number, alternative: Alternative) => {
  const tailAlpha = alternative === 'two-sided' ? alpha / 2 : alpha;
  return jStat.normal.inv(1 - tailAlpha, 0, 1);
};

const zForPower = (power: number) => jStat.normal.inv(power, 0, 1);
const powerFromZ = (zEffect: number, zAlpha: number) => clamp(jStat.normal.cdf(zEffect - zAlpha, 0, 1), 0, 0.999);
const ceilFinite = (value: number) => Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
const fmt = (value: number | null, digits = 3) => value === null || !Number.isFinite(value) ? '--' : value.toFixed(digits);
const parseOptional = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const positive = (value: number | null) => value !== null && Number.isFinite(value) && value > 0;
const nonnegative = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0;
const validPower = (value: number | null) => value !== null && value > 0 && value < 1;
const validProportion = (value: number | null) => value !== null && value > 0 && value < 1;
const changeValue = (setter: (value: string) => void) => (value: string) => setter(value);
const nonparametricN = (value: number | null) => value === null ? null : Math.ceil(value * 1.15);
const nonparametricNote = ' Non-normal/nonparametric planning adjustment adds 15% and rounds up; actual needs depend greatly on actual distribution shapes and analysis needs.';

function NumberField({ label, value, setValue, step = 0.01, min = 0, placeholder }: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  step?: number;
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-100 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600"
      />
    </label>
  );
}

function TextField({ label, value, setValue, placeholder }: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-100 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600"
      />
    </label>
  );
}

function NonparametricToggle({ checked, setChecked }: { checked: boolean; setChecked: (value: boolean) => void }) {
  return (
    <label className="block rounded border border-slate-700 bg-slate-950/70 p-3 cursor-pointer">
      <span className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">Non-normal / nonparametric planning</span>
          <span className="block text-xs leading-5 text-slate-500 mt-1">
            Adds 15% to calculated sample-size recommendations and rounds up. Planning only; actual needs depend greatly on the actual distribution shape and analysis needs.
          </span>
        </span>
      </span>
    </label>
  );
}

function ResultPanel({ result }: { result: Result }) {
  const eyebrow = result.mode === 'sample-size'
    ? 'Recommended Design'
    : result.mode === 'power'
      ? 'Achieved Power'
      : 'Detectable Effect';

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500 font-black mb-3">{eyebrow}</div>
      <div className="flex items-end gap-3 mb-3">
        <div className="text-4xl font-mono font-black text-sky-400">{result.primary}</div>
        <div className="pb-1 text-sm text-slate-400">{result.secondary}</div>
      </div>
      {result.details && <div className="text-xs text-slate-300 mb-2">{result.details}</div>}
      <p className="text-xs leading-5 text-slate-500">{result.note}</p>
    </div>
  );
}

function PowerCurve({ title, data, targetPower, targetN }: {
  title: string;
  data: CurvePoint[];
  targetPower: number | null;
  targetN: number | null;
}) {
  return (
    <div className="lg:col-span-2 bg-slate-950 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-sky-400" />
        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="n"
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
              label={{ value: 'Sample size', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 1]}
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
              tickFormatter={value => `${Math.round(Number(value) * 100)}%`}
            />
            <Tooltip
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Power']}
              labelFormatter={value => `n = ${value}`}
              contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
            />
            {targetPower !== null && <ReferenceLine y={targetPower} stroke="#f59e0b" strokeDasharray="4 4" />}
            {targetN !== null && <ReferenceLine x={targetN} stroke="#38bdf8" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="power" stroke="#38bdf8" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function buildCurve(maxN: number, powerAtN: (n: number) => number): CurvePoint[] {
  const limit = Math.max(10, Math.min(10000, Math.ceil(maxN)));
  const step = Math.max(1, Math.ceil(limit / 40));
  const points: CurvePoint[] = [];
  for (let n = step; n <= limit; n += step) {
    const power = powerAtN(n);
    if (Number.isFinite(power)) points.push({ n, power: clamp(power, 0, 0.999) });
  }
  if (!points.some(point => point.n === limit)) {
    const power = powerAtN(limit);
    if (Number.isFinite(power)) points.push({ n: limit, power: clamp(power, 0, 0.999) });
  }
  return points;
}

function tTestPower(df: number, ncp: number, alpha: number, alternative: Alternative) {
  if (!Number.isFinite(df) || df <= 0 || !Number.isFinite(ncp)) return null;
  const absNcp = Math.abs(ncp);

  if (alternative === 'two-sided') {
    const crit = jStat.studentt.inv(1 - alpha / 2, df);
    const lower = jStat.noncentralt.cdf(-crit, df, absNcp);
    const upper = 1 - jStat.noncentralt.cdf(crit, df, absNcp);
    return clamp(lower + upper, 0, 0.999);
  }

  const crit = jStat.studentt.inv(1 - alpha, df);
  return clamp(1 - jStat.noncentralt.cdf(crit, df, absNcp), 0, 0.999);
}

function oneSampleMeanPower(n: number, alpha: number, alternative: Alternative, delta: number, sigma: number) {
  if (n < 2 || sigma <= 0) return null;
  return tTestPower(n - 1, Math.abs(delta) * Math.sqrt(n) / sigma, alpha, alternative);
}

function twoSampleMeanPower(controlN: number, treatmentN: number, alpha: number, alternative: Alternative, delta: number, sigma: number) {
  if (controlN < 2 || treatmentN < 2 || sigma <= 0) return null;
  const df = controlN + treatmentN - 2;
  const seUnits = Math.sqrt(1 / controlN + 1 / treatmentN);
  return tTestPower(df, Math.abs(delta) / (sigma * seUnits), alpha, alternative);
}

function findSmallestN(targetPower: number, powerAtN: (n: number) => number | null, minN = 2, maxN = 100000) {
  let high = minN;
  while (high <= maxN) {
    const power = powerAtN(high);
    if (power !== null && power >= targetPower) break;
    high *= 2;
  }
  if (high > maxN) return null;

  let low = minN;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const power = powerAtN(mid);
    if (power !== null && power >= targetPower) high = mid;
    else low = mid + 1;
  }
  return low;
}

function findDetectableEffect(targetPower: number, powerAtEffect: (effect: number) => number | null, maxEffect = 100000) {
  let high = 1;
  while (high <= maxEffect) {
    const power = powerAtEffect(high);
    if (power !== null && power >= targetPower) break;
    high *= 2;
  }
  if (high > maxEffect) return null;

  let low = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const power = powerAtEffect(mid);
    if (power !== null && power >= targetPower) high = mid;
    else low = mid;
  }
  return high;
}

function solveOneSample(alpha: number, alternative: Alternative, power: number | null, delta: number | null, sigma: number | null, nInput: number | null, nonparametric = false): Result {
  if (!positive(sigma)) {
    return invalidResult('Enter a positive standard deviation.');
  }

  if (power === null) {
    if (!positive(delta) || !positive(nInput)) return invalidResult('Leave Power blank, then enter sample size and difference to calculate achieved power.');
    const achievedPower = oneSampleMeanPower(Math.ceil(nInput), alpha, alternative, delta, sigma);
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      note: 'Calculated from the entered sample size, alpha, sigma, and difference using a noncentral t approximation.',
      achievedPower,
      targetN: Math.ceil(nInput),
      effect: Math.abs(delta),
    };
  }

  if (delta === null) {
    if (!validPower(power) || !positive(nInput)) return invalidResult('Leave Difference blank, then enter target power and sample size to calculate the detectable difference.');
    const n = Math.ceil(nInput);
    const detectable = findDetectableEffect(power, effect => oneSampleMeanPower(n, alpha, alternative, effect, sigma));
    return {
      mode: 'effect',
      primary: fmt(detectable, 3),
      secondary: 'difference',
      note: 'This is the minimum absolute difference detectable at the requested power and sample size.',
      achievedPower: power,
      targetN: n,
      effect: detectable,
    };
  }

  if (!validPower(power) || !positive(delta)) return invalidResult('Enter Power between 0 and 1 and a positive difference.');
  const n = findSmallestN(power, nValue => oneSampleMeanPower(nValue, alpha, alternative, delta, sigma));
  const adjustedN = nonparametric ? nonparametricN(n) : n;
  return {
    mode: 'sample-size',
    primary: adjustedN?.toString() || '--',
    secondary: 'observations',
    details: nonparametric && n ? `Base parametric estimate: ${n} observations` : undefined,
    note: `Uses a noncentral t approximation for a one-sample mean test. Treat this as planning guidance before final confirmation.${nonparametric ? nonparametricNote : ''}`,
    achievedPower: power,
    targetN: adjustedN,
    effect: Math.abs(delta),
  };
}

function solveTwoSample(alpha: number, alternative: Alternative, power: number | null, delta: number | null, sigma: number | null, controlN: number | null, nonparametric = false): Result {
  if (!positive(sigma)) return invalidResult('Enter a positive pooled standard deviation.');
  const fixedControl = positive(controlN) ? Math.ceil(controlN) : null;

  if (power === null) {
    return invalidResult('Enter target power to solve the needed treatment sample size. This mode no longer uses a treatment/control allocation ratio.');
  }

  if (delta === null) {
    return invalidResult('Enter the difference to detect. Treatment sample size is solved from the target power and optional control limit.');
  }

  if (!validPower(power) || !positive(delta)) return invalidResult('Enter Power between 0 and 1 and a positive difference.');
  const baseControl = fixedControl ?? findSmallestN(power, nValue => twoSampleMeanPower(nValue, nValue, alpha, alternative, delta, sigma));
  const baseTreatment = fixedControl
    ? findSmallestN(power, nValue => twoSampleMeanPower(fixedControl, nValue, alpha, alternative, delta, sigma))
    : baseControl;
  const control = fixedControl ? baseControl : (nonparametric ? nonparametricN(baseControl) : baseControl);
  const treatment = nonparametric ? nonparametricN(baseTreatment) : baseTreatment;
  const targetN = control && treatment ? control + treatment : null;

  return {
    mode: 'sample-size',
    primary: fixedControl ? (treatment?.toString() || '--') : (control?.toString() || '--'),
    secondary: fixedControl ? 'treatment observations' : 'per group',
    details: `Control: ${control || '--'} | Treatment: ${treatment || '--'} | Total: ${targetN || '--'}${nonparametric && baseControl && baseTreatment ? ` | Base estimate: Control ${baseControl}, Treatment ${baseTreatment}` : ''}`,
    note: fixedControl
      ? `Holds the entered control sample size fixed and solves the needed treatment sample size using an equal-variance noncentral t approximation.${nonparametric ? nonparametricNote : ''}`
      : `Solves balanced control and treatment sample sizes using an equal-variance noncentral t approximation.${nonparametric ? nonparametricNote : ''}`,
    achievedPower: power,
    targetN,
    effect: Math.abs(delta),
  };
}

function solveAnova(alpha: number, alternative: Alternative, power: number | null, effect: number | null, groups: number | null, totalN: number | null, nonparametric = false): Result {
  const zAlpha = zForAlpha(alpha, alternative);
  const groupCount = Math.max(Math.round(groups || 0), 2);
  const df = groupCount - 1;

  if (power === null) {
    if (!positive(effect) || !positive(totalN)) return invalidResult('Leave Power blank, then enter total sample size and Cohen\'s f to calculate achieved power.');
    const achievedPower = powerFromZ(effect * Math.sqrt(totalN / df), zAlpha);
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      details: `About ${Math.ceil(totalN / groupCount)} observations per group`,
      note: 'Calculated from the entered total sample size, alpha, group count, and Cohen\'s f.',
      achievedPower,
      targetN: totalN,
      effect,
    };
  }

  if (effect === null) {
    if (!validPower(power) || !positive(totalN)) return invalidResult('Leave Cohen\'s f blank, then enter target power and total sample size to calculate detectable effect.');
    const detectable = (zAlpha + zForPower(power)) * Math.sqrt(df / totalN);
    return {
      mode: 'effect',
      primary: fmt(detectable, 3),
      secondary: 'Cohen\'s f',
      details: `About ${Math.ceil(totalN / groupCount)} observations per group`,
      note: 'This is the approximate minimum Cohen\'s f detectable at the requested power and total sample size.',
      achievedPower: power,
      targetN: totalN,
      effect: detectable,
    };
  }

  if (!validPower(power) || !positive(effect)) return invalidResult('Enter Power between 0 and 1 and a positive Cohen\'s f.');
  const total = ceilFinite(Math.pow(zAlpha + zForPower(power), 2) * df / Math.pow(effect, 2));
  const adjustedTotal = nonparametric ? nonparametricN(total) : total;
  const perGroup = adjustedTotal ? Math.ceil(adjustedTotal / groupCount) : null;
  return {
    mode: 'sample-size',
    primary: adjustedTotal?.toString() || '--',
    secondary: 'total observations',
    details: `About ${perGroup || '--'} observations per group${nonparametric && total ? ` | Base parametric estimate: ${total} total observations` : ''}`,
    note: `This is an ANOVA planning approximation using Cohen's f.${nonparametric ? nonparametricNote : ''}`,
    achievedPower: power,
    targetN: adjustedTotal,
    effect,
  };
}

function oneProportionPower(n: number, alpha: number, alternative: Alternative, p0: number, pAlt: number) {
  const zAlpha = zForAlpha(alpha, alternative);
  const diff = Math.abs(pAlt - p0);
  return powerFromZ(diff * Math.sqrt(n / (p0 * (1 - p0))), zAlpha);
}

function twoProportionPower(nPerGroup: number, alpha: number, alternative: Alternative, p1: number, p2: number) {
  const zAlpha = zForAlpha(alpha, alternative);
  const diff = Math.abs(p2 - p1);
  const pBar = (p1 + p2) / 2;
  const nullSe = Math.sqrt(2 * pBar * (1 - pBar));
  const altSe = Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  if (altSe <= 0) return 0;
  return clamp(jStat.normal.cdf((diff * Math.sqrt(nPerGroup) - zAlpha * nullSe) / altSe, 0, 1), 0, 0.999);
}

function solveOneProportion(alpha: number, alternative: Alternative, power: number | null, p0: number | null, pAlt: number | null, nInput: number | null, direction: Direction): Result {
  if (!validProportion(p0)) return invalidResult('Enter a null proportion between 0 and 1.');

  if (power === null) {
    if (!validProportion(pAlt) || !positive(nInput)) return invalidResult('Leave Power blank, then enter sample size and alternative proportion to calculate achieved power.');
    const achievedPower = oneProportionPower(nInput, alpha, alternative, p0, pAlt);
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      note: 'Calculated from the entered sample size, alpha, null proportion, and alternative proportion.',
      achievedPower,
      targetN: nInput,
      effect: Math.abs(pAlt - p0),
    };
  }

  if (pAlt === null) {
    if (!validPower(power) || !positive(nInput)) return invalidResult('Leave Alternative Proportion blank, then enter target power and sample size to calculate the detectable proportion.');
    const diff = (zForAlpha(alpha, alternative) + zForPower(power)) * Math.sqrt((p0 * (1 - p0)) / nInput);
    const solved = clamp(direction === 'increase' ? p0 + diff : p0 - diff, 0.001, 0.999);
    return {
      mode: 'effect',
      primary: fmt(solved, 3),
      secondary: 'alternative proportion',
      details: `Difference: ${fmt(Math.abs(solved - p0), 3)}`,
      note: 'This is the detectable alternative proportion in the selected direction.',
      achievedPower: power,
      targetN: nInput,
      effect: Math.abs(solved - p0),
    };
  }

  if (!validPower(power) || !validProportion(pAlt)) return invalidResult('Enter Power between 0 and 1 and proportions between 0 and 1.');
  const diff = Math.abs(pAlt - p0);
  const n = ceilFinite(p0 * (1 - p0) * Math.pow(zForAlpha(alpha, alternative) + zForPower(power), 2) / Math.pow(diff, 2));
  return {
    mode: 'sample-size',
    primary: n?.toString() || '--',
    secondary: 'observations',
    note: 'Uses a one-proportion normal approximation.',
    achievedPower: power,
    targetN: n,
    effect: diff,
  };
}

function solveTwoProportion(alpha: number, alternative: Alternative, power: number | null, p1: number | null, p2: number | null, nPerGroup: number | null, direction: Direction): Result {
  if (!validProportion(p1)) return invalidResult('Enter sample 1 proportion between 0 and 1.');

  if (power === null) {
    if (!validProportion(p2) || !positive(nPerGroup)) return invalidResult('Leave Power blank, then enter per-group sample size and sample 2 proportion to calculate achieved power.');
    const achievedPower = twoProportionPower(nPerGroup, alpha, alternative, p1, p2);
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      details: `Total planned observations: ${Math.ceil(nPerGroup * 2)}`,
      note: 'Calculated from the entered per-group sample size and proportions.',
      achievedPower,
      targetN: nPerGroup * 2,
      effect: Math.abs(p2 - p1),
    };
  }

  if (p2 === null) {
    if (!validPower(power) || !positive(nPerGroup)) return invalidResult('Leave Sample 2 Proportion blank, then enter target power and per-group sample size to calculate the detectable proportion.');
    const solved = solveProportionBySearch(p1, nPerGroup, power, alpha, alternative, direction);
    return {
      mode: 'effect',
      primary: solved === null ? '--' : fmt(solved, 3),
      secondary: 'sample 2 proportion',
      details: solved === null ? undefined : `Difference: ${fmt(Math.abs(solved - p1), 3)}`,
      note: solved === null
        ? 'The requested power is not reachable in the selected direction before the proportion reaches its boundary.'
        : 'This is the detectable sample 2 proportion in the selected direction.',
      achievedPower: power,
      targetN: nPerGroup * 2,
      effect: solved === null ? null : Math.abs(solved - p1),
    };
  }

  if (!validPower(power) || !validProportion(p2)) return invalidResult('Enter Power between 0 and 1 and proportions between 0 and 1.');
  const diff = Math.abs(p2 - p1);
  const pBar = (p1 + p2) / 2;
  const n = Math.pow(
    zForAlpha(alpha, alternative) * Math.sqrt(2 * pBar * (1 - pBar)) + zForPower(power) * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  ) / Math.pow(diff, 2);
  const perGroup = ceilFinite(n);
  return {
    mode: 'sample-size',
    primary: perGroup?.toString() || '--',
    secondary: 'per group',
    details: `Total planned observations: ${perGroup ? perGroup * 2 : '--'}`,
    note: 'Uses a two-proportion normal approximation.',
    achievedPower: power,
    targetN: perGroup ? perGroup * 2 : null,
    effect: diff,
  };
}

function solveProportionBySearch(p1: number, nPerGroup: number, targetPower: number, alpha: number, alternative: Alternative, direction: Direction) {
  const lowBoundary = 0.001;
  const highBoundary = 0.999;
  let low = direction === 'increase' ? p1 : lowBoundary;
  let high = direction === 'increase' ? highBoundary : p1;
  const boundaryPower = twoProportionPower(nPerGroup, alpha, alternative, p1, direction === 'increase' ? high : low);
  if (boundaryPower < targetPower) return null;

  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    const midPower = twoProportionPower(nPerGroup, alpha, alternative, p1, mid);
    if (direction === 'increase') {
      if (midPower >= targetPower) high = mid;
      else low = mid;
    } else {
      if (midPower >= targetPower) low = mid;
      else high = mid;
    }
  }

  return direction === 'increase' ? high : low;
}

// Poisson rate planning formulas:
// These use normal approximations to Poisson rate tests. Sample size is treated as exposure units
// such as units inspected, hours observed, transactions reviewed, or months of monitoring.
function onePoissonRatePower(exposure: number, alpha: number, alternative: Alternative, baselineRate: number, expectedRate: number) {
  if (exposure <= 0 || baselineRate < 0 || expectedRate < 0 || (baselineRate === 0 && expectedRate === 0)) return null;
  const zAlpha = zForAlpha(alpha, alternative);
  const nullSe = Math.sqrt(Math.max(baselineRate, 1e-9) / exposure);
  const altSe = Math.sqrt(Math.max(expectedRate, 1e-9) / exposure);

  if (alternative === 'greater') {
    const upperCutoff = baselineRate + zAlpha * nullSe;
    return clamp(1 - jStat.normal.cdf(upperCutoff, expectedRate, altSe), 0, 0.999);
  }

  if (alternative === 'less') {
    const lowerCutoff = baselineRate - zAlpha * nullSe;
    return clamp(jStat.normal.cdf(lowerCutoff, expectedRate, altSe), 0, 0.999);
  }

  const lowerCutoff = baselineRate - zAlpha * nullSe;
  const upperCutoff = baselineRate + zAlpha * nullSe;
  return clamp(
    jStat.normal.cdf(lowerCutoff, expectedRate, altSe) + (1 - jStat.normal.cdf(upperCutoff, expectedRate, altSe)),
    0,
    0.999
  );
}

function twoPoissonRatePower(controlExposure: number, treatmentExposure: number, alpha: number, alternative: Alternative, controlRate: number, treatmentRate: number) {
  if (controlExposure <= 0 || treatmentExposure <= 0 || controlRate < 0 || treatmentRate < 0 || (controlRate === 0 && treatmentRate === 0)) return null;
  const zAlpha = zForAlpha(alpha, alternative);
  const diff = treatmentRate - controlRate;
  const nullSe = Math.sqrt(Math.max(controlRate, 1e-9) / controlExposure + Math.max(controlRate, 1e-9) / treatmentExposure);
  const altSe = Math.sqrt(Math.max(controlRate, 1e-9) / controlExposure + Math.max(treatmentRate, 1e-9) / treatmentExposure);

  if (alternative === 'greater') {
    return clamp(1 - jStat.normal.cdf(zAlpha * nullSe, diff, altSe), 0, 0.999);
  }

  if (alternative === 'less') {
    return clamp(jStat.normal.cdf(-zAlpha * nullSe, diff, altSe), 0, 0.999);
  }

  return clamp(
    jStat.normal.cdf(-zAlpha * nullSe, diff, altSe) + (1 - jStat.normal.cdf(zAlpha * nullSe, diff, altSe)),
    0,
    0.999
  );
}

function solveOnePoissonRate(alpha: number, alternative: Alternative, power: number | null, baselineRate: number | null, expectedRate: number | null, exposureInput: number | null, direction: Direction, unitLabel: string): Result {
  if (!nonnegative(baselineRate)) return invalidResult('Enter a baseline rate greater than or equal to 0.');
  if (expectedRate !== null && !nonnegative(expectedRate)) return invalidResult('Enter an expected rate greater than or equal to 0.');
  if (expectedRate !== null && baselineRate === 0 && expectedRate === 0) return invalidResult('Baseline and expected rates cannot both be 0.');
  const units = unitLabel.trim() || 'exposure unit';

  if (power === null) {
    if (!nonnegative(expectedRate) || !positive(exposureInput)) return invalidResult('Leave Power blank, then enter exposure and expected rate to calculate achieved power.');
    const exposure = Math.ceil(exposureInput);
    const achievedPower = onePoissonRatePower(exposure, alpha, alternative, baselineRate, expectedRate);
    const diff = expectedRate - baselineRate;
    const ratio = baselineRate > 0 ? expectedRate / baselineRate : null;
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      details: `Exposure: ${exposure} ${units} | Baseline: ${fmt(baselineRate)} | Expected: ${fmt(expectedRate)} | Difference: ${fmt(diff)} | Ratio: ${ratio === null ? '--' : fmt(ratio)} | Alpha: ${fmt(alpha, 3)}`,
      note: `With ${exposure} ${units}, the calculator estimates ${fmt(achievedPower, 3)} power to detect a rate change from ${fmt(baselineRate)} to ${fmt(expectedRate)}.`,
      achievedPower,
      targetN: exposure,
      effect: Math.abs(diff),
    };
  }

  if (expectedRate === null) {
    if (!validPower(power) || !positive(exposureInput)) return invalidResult('Leave Expected Rate blank, then enter target power and exposure to calculate a detectable rate.');
    const exposure = Math.ceil(exposureInput);
    const detected = solveOnePoissonRateBySearch(baselineRate, exposure, power, alpha, alternative, direction);
    const diff = detected !== null ? detected - baselineRate : null;
    const ratio = detected !== null && baselineRate > 0 ? detected / baselineRate : null;
    return {
      mode: 'effect',
      primary: fmt(detected, 3),
      secondary: `events per ${units}`,
      details: `Exposure: ${exposure} ${units} | Baseline: ${fmt(baselineRate)} | Difference: ${fmt(diff)} | Ratio: ${ratio === null ? '--' : fmt(ratio)} | Alpha: ${fmt(alpha, 3)} | Target power: ${fmt(power, 3)}`,
      note: `This is the approximate ${direction === 'increase' ? 'higher' : 'lower'} rate detectable with ${exposure} ${units}.`,
      achievedPower: power,
      targetN: exposure,
      effect: diff === null ? null : Math.abs(diff),
    };
  }

  if (!validPower(power)) return invalidResult('Enter Power between 0 and 1.');
  const exposure = findSmallestN(power, n => onePoissonRatePower(n, alpha, alternative, baselineRate, expectedRate), 1);
  const diff = expectedRate - baselineRate;
  const ratio = baselineRate > 0 ? expectedRate / baselineRate : null;
  return {
    mode: 'sample-size',
    primary: exposure?.toString() || '--',
    secondary: units,
    details: `Baseline: ${fmt(baselineRate)} | Expected: ${fmt(expectedRate)} | Difference: ${fmt(diff)} | Ratio: ${ratio === null ? '--' : fmt(ratio)} | Alpha: ${fmt(alpha, 3)} | Target power: ${fmt(power, 3)}`,
    note: `Plan for about ${exposure || '--'} ${units} to detect the expected Poisson rate change.`,
    achievedPower: power,
    targetN: exposure,
    effect: Math.abs(diff),
  };
}

function solveOnePoissonRateBySearch(baselineRate: number, exposure: number, targetPower: number, alpha: number, alternative: Alternative, direction: Direction) {
  const lowBoundary = 0;
  let low = direction === 'increase' ? baselineRate : lowBoundary;
  let high = direction === 'increase' ? Math.max(baselineRate * 2, baselineRate + 1, 1) : baselineRate;

  if (direction === 'increase') {
    while ((onePoissonRatePower(exposure, alpha, alternative, baselineRate, high) || 0) < targetPower && high < 100000) high *= 2;
    if (high >= 100000) return null;
  } else if ((onePoissonRatePower(exposure, alpha, alternative, baselineRate, lowBoundary) || 0) < targetPower) {
    return null;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const midPower = onePoissonRatePower(exposure, alpha, alternative, baselineRate, mid) || 0;
    if (direction === 'increase') {
      if (midPower >= targetPower) high = mid;
      else low = mid;
    } else {
      if (midPower >= targetPower) low = mid;
      else high = mid;
    }
  }

  return direction === 'increase' ? high : low;
}

function solveTwoPoissonRates(alpha: number, alternative: Alternative, power: number | null, controlRate: number | null, treatmentRate: number | null, fixedControlExposure: number | null, treatmentExposureInput: number | null, direction: Direction, unitLabel: string): Result {
  if (!nonnegative(controlRate)) return invalidResult('Enter a control rate greater than or equal to 0.');
  if (treatmentRate !== null && !nonnegative(treatmentRate)) return invalidResult('Enter a treatment rate greater than or equal to 0.');
  if (treatmentRate !== null && controlRate === 0 && treatmentRate === 0) return invalidResult('Control and treatment rates cannot both be 0.');
  const units = unitLabel.trim() || 'exposure unit';
  const fixedControl = positive(fixedControlExposure) ? Math.ceil(fixedControlExposure) : null;

  if (power === null) {
    if (!nonnegative(treatmentRate) || !positive(treatmentExposureInput)) return invalidResult('Leave Power blank, then enter treatment exposure and treatment rate to calculate achieved power.');
    const treatmentExposure = Math.ceil(treatmentExposureInput);
    const controlExposure = fixedControl ?? treatmentExposure;
    const achievedPower = twoPoissonRatePower(controlExposure, treatmentExposure, alpha, alternative, controlRate, treatmentRate);
    const diff = treatmentRate - controlRate;
    const ratio = controlRate > 0 ? treatmentRate / controlRate : null;
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      details: `Control exposure: ${controlExposure} | Treatment exposure: ${treatmentExposure} | Total: ${controlExposure + treatmentExposure} ${units} | Control rate: ${fmt(controlRate)} | Treatment rate: ${fmt(treatmentRate)} | Difference: ${fmt(diff)} | Rate ratio: ${ratio === null ? '--' : fmt(ratio)} | Allocation ratio: ${fmt(treatmentExposure / controlExposure)} | Alpha: ${fmt(alpha, 3)}`,
      note: `With those exposure amounts, the calculator estimates ${fmt(achievedPower, 3)} power to detect the treatment rate difference.`,
      achievedPower,
      targetN: controlExposure + treatmentExposure,
      effect: Math.abs(diff),
    };
  }

  if (treatmentRate === null) {
    if (!validPower(power) || !positive(treatmentExposureInput)) return invalidResult('Leave Treatment Rate blank, then enter target power and treatment exposure to calculate a detectable treatment rate.');
    const treatmentExposure = Math.ceil(treatmentExposureInput);
    const controlExposure = fixedControl ?? treatmentExposure;
    const detected = solveTwoPoissonRateBySearch(controlRate, controlExposure, treatmentExposure, power, alpha, alternative, direction);
    const diff = detected !== null ? detected - controlRate : null;
    const ratio = detected !== null && controlRate > 0 ? detected / controlRate : null;
    return {
      mode: 'effect',
      primary: fmt(detected, 3),
      secondary: `events per ${units}`,
      details: `Control exposure: ${controlExposure} | Treatment exposure: ${treatmentExposure} | Total: ${controlExposure + treatmentExposure} ${units} | Control rate: ${fmt(controlRate)} | Difference: ${fmt(diff)} | Rate ratio: ${ratio === null ? '--' : fmt(ratio)} | Allocation ratio: ${fmt(treatmentExposure / controlExposure)} | Alpha: ${fmt(alpha, 3)} | Target power: ${fmt(power, 3)}`,
      note: `This is the approximate ${direction === 'increase' ? 'higher' : 'lower'} treatment rate detectable with the entered exposure.`,
      achievedPower: power,
      targetN: controlExposure + treatmentExposure,
      effect: diff === null ? null : Math.abs(diff),
    };
  }

  if (!validPower(power)) return invalidResult('Enter Power between 0 and 1.');
  const controlExposure = fixedControl ?? findSmallestN(power, n => twoPoissonRatePower(n, n, alpha, alternative, controlRate, treatmentRate), 1);
  const treatmentExposure = fixedControl
    ? findSmallestN(power, n => twoPoissonRatePower(fixedControl, n, alpha, alternative, controlRate, treatmentRate), 1)
    : controlExposure;
  const total = controlExposure && treatmentExposure ? controlExposure + treatmentExposure : null;
  const diff = treatmentRate - controlRate;
  const ratio = controlRate > 0 ? treatmentRate / controlRate : null;
  return {
    mode: 'sample-size',
    primary: fixedControl ? (treatmentExposure?.toString() || '--') : (controlExposure?.toString() || '--'),
    secondary: fixedControl ? `treatment ${units}` : `${units} per group`,
    details: `Control exposure: ${controlExposure || '--'} | Treatment exposure: ${treatmentExposure || '--'} | Total: ${total || '--'} ${units} | Control rate: ${fmt(controlRate)} | Treatment rate: ${fmt(treatmentRate)} | Difference: ${fmt(diff)} | Rate ratio: ${ratio === null ? '--' : fmt(ratio)} | Allocation ratio: ${controlExposure && treatmentExposure ? fmt(treatmentExposure / controlExposure) : '--'} | Alpha: ${fmt(alpha, 3)} | Target power: ${fmt(power, 3)}`,
    note: fixedControl
      ? 'Holds the entered control exposure fixed and solves the treatment exposure needed for the target power.'
      : 'Solves balanced control and treatment exposure needed for the target power.',
    achievedPower: power,
    targetN: total,
    effect: Math.abs(diff),
  };
}

function solveTwoPoissonRateBySearch(controlRate: number, controlExposure: number, treatmentExposure: number, targetPower: number, alpha: number, alternative: Alternative, direction: Direction) {
  const lowBoundary = 0;
  let low = direction === 'increase' ? controlRate : lowBoundary;
  let high = direction === 'increase' ? Math.max(controlRate * 2, controlRate + 1, 1) : controlRate;

  if (direction === 'increase') {
    while ((twoPoissonRatePower(controlExposure, treatmentExposure, alpha, alternative, controlRate, high) || 0) < targetPower && high < 100000) high *= 2;
    if (high >= 100000) return null;
  } else if ((twoPoissonRatePower(controlExposure, treatmentExposure, alpha, alternative, controlRate, lowBoundary) || 0) < targetPower) {
    return null;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const midPower = twoPoissonRatePower(controlExposure, treatmentExposure, alpha, alternative, controlRate, mid) || 0;
    if (direction === 'increase') {
      if (midPower >= targetPower) high = mid;
      else low = mid;
    } else {
      if (midPower >= targetPower) low = mid;
      else high = mid;
    }
  }

  return direction === 'increase' ? high : low;
}

function invalidResult(note: string): Result {
  return {
    mode: 'sample-size',
    primary: '--',
    secondary: '',
    note,
    achievedPower: null,
    targetN: null,
    effect: null,
  };
}

export default function PowerSampleSizeModule() {
  const savedSettings = useMemo(() => loadPowerSettings(), []);
  const [activeTab, setActiveTab] = useState<TabId>(savedSettings.activeTab);
  const [alphaInput, setAlphaInput] = useState(savedSettings.alphaInput);
  const [powerInput, setPowerInput] = useState(savedSettings.powerInput);
  const [alternative, setAlternative] = useState<Alternative>(savedSettings.alternative);

  const [oneDeltaInput, setOneDeltaInput] = useState(savedSettings.oneDeltaInput);
  const [oneSigmaInput, setOneSigmaInput] = useState(savedSettings.oneSigmaInput);
  const [oneNInput, setOneNInput] = useState(savedSettings.oneNInput);
  const [oneNonparametric, setOneNonparametric] = useState(savedSettings.oneNonparametric);

  const [twoDeltaInput, setTwoDeltaInput] = useState(savedSettings.twoDeltaInput);
  const [twoSigmaInput, setTwoSigmaInput] = useState(savedSettings.twoSigmaInput);
  const [twoControlNInput, setTwoControlNInput] = useState(savedSettings.twoControlNInput);
  const [twoNonparametric, setTwoNonparametric] = useState(savedSettings.twoNonparametric);

  const [groupsInput, setGroupsInput] = useState(savedSettings.groupsInput);
  const [anovaEffectInput, setAnovaEffectInput] = useState(savedSettings.anovaEffectInput);
  const [anovaTotalNInput, setAnovaTotalNInput] = useState(savedSettings.anovaTotalNInput);
  const [anovaNonparametric, setAnovaNonparametric] = useState(savedSettings.anovaNonparametric);

  const [propMode, setPropMode] = useState<'one' | 'two'>(savedSettings.propMode);
  const [propDirection, setPropDirection] = useState<Direction>(savedSettings.propDirection);
  const [p0Input, setP0Input] = useState(savedSettings.p0Input);
  const [p1Input, setP1Input] = useState(savedSettings.p1Input);
  const [p2Input, setP2Input] = useState(savedSettings.p2Input);
  const [propNInput, setPropNInput] = useState(savedSettings.propNInput);
  const [poissonMode, setPoissonMode] = useState<'one' | 'two'>(savedSettings.poissonMode);
  const [poissonDirection, setPoissonDirection] = useState<Direction>(savedSettings.poissonDirection);
  const [poissonUnitLabel, setPoissonUnitLabel] = useState(savedSettings.poissonUnitLabel);
  const [poissonBaselineRateInput, setPoissonBaselineRateInput] = useState(savedSettings.poissonBaselineRateInput);
  const [poissonExpectedRateInput, setPoissonExpectedRateInput] = useState(savedSettings.poissonExpectedRateInput);
  const [poissonExposureInput, setPoissonExposureInput] = useState(savedSettings.poissonExposureInput);
  const [poissonControlRateInput, setPoissonControlRateInput] = useState(savedSettings.poissonControlRateInput);
  const [poissonTreatmentRateInput, setPoissonTreatmentRateInput] = useState(savedSettings.poissonTreatmentRateInput);
  const [poissonFixedControlExposureInput, setPoissonFixedControlExposureInput] = useState(savedSettings.poissonFixedControlExposureInput);
  const [poissonTreatmentExposureInput, setPoissonTreatmentExposureInput] = useState(savedSettings.poissonTreatmentExposureInput);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const settings: PowerSettings = {
      activeTab,
      alphaInput,
      powerInput,
      alternative,
      oneDeltaInput,
      oneSigmaInput,
      oneNInput,
      oneNonparametric,
      twoDeltaInput,
      twoSigmaInput,
      twoControlNInput,
      twoNonparametric,
      groupsInput,
      anovaEffectInput,
      anovaTotalNInput,
      anovaNonparametric,
      propMode,
      propDirection,
      p0Input,
      p1Input,
      p2Input,
      propNInput,
      poissonMode,
      poissonDirection,
      poissonUnitLabel,
      poissonBaselineRateInput,
      poissonExpectedRateInput,
      poissonExposureInput,
      poissonControlRateInput,
      poissonTreatmentRateInput,
      poissonFixedControlExposureInput,
      poissonTreatmentExposureInput
    };
    window.localStorage.setItem(POWER_SETTINGS_KEY, JSON.stringify(settings));
  }, [
    activeTab,
    alphaInput,
    powerInput,
    alternative,
    oneDeltaInput,
    oneSigmaInput,
    oneNInput,
    oneNonparametric,
    twoDeltaInput,
    twoSigmaInput,
    twoControlNInput,
    twoNonparametric,
    groupsInput,
    anovaEffectInput,
    anovaTotalNInput,
    anovaNonparametric,
    propMode,
    propDirection,
    p0Input,
    p1Input,
    p2Input,
    propNInput,
    poissonMode,
    poissonDirection,
    poissonUnitLabel,
    poissonBaselineRateInput,
    poissonExpectedRateInput,
    poissonExposureInput,
    poissonControlRateInput,
    poissonTreatmentRateInput,
    poissonFixedControlExposureInput,
    poissonTreatmentExposureInput
  ]);

  const alpha = clamp(parseOptional(alphaInput) ?? 0.05, 0.0001, 0.999);
  const power = parseOptional(powerInput);
  const targetPower = validPower(power) ? power : null;

  const oneDelta = parseOptional(oneDeltaInput);
  const oneSigma = parseOptional(oneSigmaInput);
  const oneN = parseOptional(oneNInput);
  const twoDelta = parseOptional(twoDeltaInput);
  const twoSigma = parseOptional(twoSigmaInput);
  const twoControlN = parseOptional(twoControlNInput);
  const groups = parseOptional(groupsInput);
  const anovaEffect = parseOptional(anovaEffectInput);
  const anovaTotalN = parseOptional(anovaTotalNInput);
  const p0 = parseOptional(p0Input);
  const p1 = parseOptional(p1Input);
  const p2 = parseOptional(p2Input);
  const propN = parseOptional(propNInput);
  const poissonBaselineRate = parseOptional(poissonBaselineRateInput);
  const poissonExpectedRate = parseOptional(poissonExpectedRateInput);
  const poissonExposure = parseOptional(poissonExposureInput);
  const poissonControlRate = parseOptional(poissonControlRateInput);
  const poissonTreatmentRate = parseOptional(poissonTreatmentRateInput);
  const poissonFixedControlExposure = parseOptional(poissonFixedControlExposureInput);
  const poissonTreatmentExposure = parseOptional(poissonTreatmentExposureInput);

  const oneSample = useMemo(() => solveOneSample(alpha, alternative, power, oneDelta, oneSigma, oneN, oneNonparametric), [alpha, alternative, power, oneDelta, oneSigma, oneN, oneNonparametric]);
  const twoSample = useMemo(() => solveTwoSample(alpha, alternative, power, twoDelta, twoSigma, twoControlN, twoNonparametric), [alpha, alternative, power, twoDelta, twoSigma, twoControlN, twoNonparametric]);
  const anova = useMemo(() => solveAnova(alpha, alternative, power, anovaEffect, groups, anovaTotalN, anovaNonparametric), [alpha, alternative, power, anovaEffect, groups, anovaTotalN, anovaNonparametric]);
  const proportions = useMemo(() => {
    if (propMode === 'one') return solveOneProportion(alpha, alternative, power, p0, p1, propN, propDirection);
    return solveTwoProportion(alpha, alternative, power, p1, p2, propN, propDirection);
  }, [alpha, alternative, power, p0, p1, p2, propN, propMode, propDirection]);
  const poisson = useMemo(() => {
    if (poissonMode === 'one') {
      return solveOnePoissonRate(alpha, alternative, power, poissonBaselineRate, poissonExpectedRate, poissonExposure, poissonDirection, poissonUnitLabel);
    }
    return solveTwoPoissonRates(alpha, alternative, power, poissonControlRate, poissonTreatmentRate, poissonFixedControlExposure, poissonTreatmentExposure, poissonDirection, poissonUnitLabel);
  }, [alpha, alternative, power, poissonMode, poissonBaselineRate, poissonExpectedRate, poissonExposure, poissonControlRate, poissonTreatmentRate, poissonFixedControlExposure, poissonTreatmentExposure, poissonDirection, poissonUnitLabel]);

  const oneCurve = useMemo(() => {
    const effect = oneSample.effect ?? oneDelta;
    if (!positive(effect) || !positive(oneSigma)) return [];
    return buildCurve(Math.max(oneSample.targetN || oneN || 50, 50) * 1.5, n => oneSampleMeanPower(n, alpha, alternative, effect, oneSigma) ?? 0);
  }, [oneSample.effect, oneSample.targetN, oneDelta, oneSigma, oneN, alpha, alternative]);

  const twoCurve = useMemo(() => {
    const effect = twoSample.effect ?? twoDelta;
    if (!positive(effect) || !positive(twoSigma)) return [];
    if (positive(twoControlN)) {
      const control = Math.ceil(twoControlN);
      const maxTreatmentN = Math.max((twoSample.targetN ? twoSample.targetN - control : 80), 10);
      return buildCurve(maxTreatmentN * 1.5, n => twoSampleMeanPower(control, n, alpha, alternative, effect, twoSigma) ?? 0);
    }

    const maxPerGroup = Math.max(Math.ceil((twoSample.targetN || 80) / 2), 10);
    return buildCurve(maxPerGroup * 1.5, n => twoSampleMeanPower(n, n, alpha, alternative, effect, twoSigma) ?? 0);
  }, [twoSample.effect, twoSample.targetN, twoDelta, twoSigma, twoControlN, alpha, alternative]);

  const anovaCurve = useMemo(() => {
    const effect = anova.effect ?? anovaEffect;
    const groupCount = Math.max(Math.round(groups || 3), 2);
    const df = groupCount - 1;
    if (!positive(effect)) return [];
    return buildCurve(Math.max(anova.targetN || anovaTotalN || 60, 20) * 1.5, n => powerFromZ(effect * Math.sqrt(n / df), zForAlpha(alpha, alternative)));
  }, [anova.effect, anova.targetN, anovaEffect, anovaTotalN, groups, alpha, alternative]);

  const propCurve = useMemo(() => {
    if (propMode === 'one') {
      const effect = proportions.effect ?? (validProportion(p0) && validProportion(p1) ? Math.abs(p1 - p0) : null);
      if (!validProportion(p0) || !positive(effect)) return [];
      const pAlt = clamp(propDirection === 'increase' ? p0 + effect : p0 - effect, 0.001, 0.999);
      return buildCurve(Math.max(proportions.targetN || propN || 100, 30) * 1.5, n => oneProportionPower(n, alpha, alternative, p0, pAlt));
    }

    const effect = proportions.effect ?? (validProportion(p1) && validProportion(p2) ? Math.abs(p2 - p1) : null);
    if (!validProportion(p1) || !positive(effect)) return [];
    const pAlt = clamp(propDirection === 'increase' ? p1 + effect : p1 - effect, 0.001, 0.999);
    const maxPerGroup = Math.max(Math.ceil((proportions.targetN || (propN ? propN * 2 : 120)) / 2), 20);
    return buildCurve(maxPerGroup * 1.5, n => twoProportionPower(n, alpha, alternative, p1, pAlt));
  }, [propMode, proportions.effect, proportions.targetN, p0, p1, p2, propN, propDirection, alpha, alternative]);

  const poissonCurve = useMemo(() => {
    if (poissonMode === 'one') {
      if (!nonnegative(poissonBaselineRate) || !nonnegative(poissonExpectedRate) || (poissonBaselineRate === 0 && poissonExpectedRate === 0)) return [];
      return buildCurve(Math.max(poisson.targetN || poissonExposure || 100, 30) * 1.5, n => onePoissonRatePower(n, alpha, alternative, poissonBaselineRate, poissonExpectedRate) ?? 0);
    }

    if (!nonnegative(poissonControlRate) || !nonnegative(poissonTreatmentRate) || (poissonControlRate === 0 && poissonTreatmentRate === 0)) return [];
    if (positive(poissonFixedControlExposure)) {
      const controlExposure = Math.ceil(poissonFixedControlExposure);
      const maxTreatmentExposure = Math.max((poisson.targetN ? poisson.targetN - controlExposure : poissonTreatmentExposure || 100), 30);
      return buildCurve(maxTreatmentExposure * 1.5, n => twoPoissonRatePower(controlExposure, n, alpha, alternative, poissonControlRate, poissonTreatmentRate) ?? 0);
    }

    const maxPerGroup = Math.max(Math.ceil((poisson.targetN || (poissonTreatmentExposure ? poissonTreatmentExposure * 2 : 120)) / 2), 30);
    return buildCurve(maxPerGroup * 1.5, n => twoPoissonRatePower(n, n, alpha, alternative, poissonControlRate, poissonTreatmentRate) ?? 0);
  }, [poissonMode, poisson.effect, poisson.targetN, poissonBaselineRate, poissonExpectedRate, poissonExposure, poissonControlRate, poissonTreatmentRate, poissonFixedControlExposure, poissonTreatmentExposure, alpha, alternative]);

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Calculator className="w-6 h-6 text-sky-400" />
              Power and Sample Size
            </h2>
            <p className="text-sm text-slate-500 mt-2">Plan sample size, achieved power, or detectable effect size from whichever field is left blank.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded px-3 py-2">
            <span>Alpha {fmt(alpha, 2)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>Power {powerInput.trim() === '' ? 'solving' : fmt(targetPower, 2)}</span>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-800">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-sky-400 text-sky-400 bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        <div className="xl:col-span-1 bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Global Settings</h3>
          <NumberField label="Alpha" value={alphaInput} setValue={changeValue(setAlphaInput)} step={0.01} min={0.001} />
          <NumberField label="Target Power" value={powerInput} setValue={changeValue(setPowerInput)} step={0.01} min={0.01} placeholder="blank = solve power" />
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Alternative</span>
            <select
              value={alternative}
              onChange={e => setAlternative(e.target.value as Alternative)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-100 outline-none focus:border-sky-400"
            >
              <option value="two-sided">Two-sided</option>
              <option value="greater">Greater than</option>
              <option value="less">Less than</option>
            </select>
          </label>
          <div className="border-t border-slate-700 pt-4 text-xs leading-5 text-slate-500">
            Leave <span className="text-slate-300">Power</span> blank to solve achieved power. Leave the effect field blank to solve the detectable delta, Cohen's f, proportion, or rate.
          </div>
        </div>

        <div className="xl:col-span-3 bg-slate-800 border border-slate-700 rounded-lg p-6">
          {activeTab === 'one-sample' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">One Sample Mean</h3>
                <NumberField label="Difference to Detect" value={oneDeltaInput} setValue={changeValue(setOneDeltaInput)} step={0.1} min={0.001} placeholder="blank = solve difference" />
                <NumberField label="Estimated Standard Deviation" value={oneSigmaInput} setValue={changeValue(setOneSigmaInput)} step={0.1} min={0.001} />
                <NumberField label="Sample Size" value={oneNInput} setValue={changeValue(setOneNInput)} step={1} min={1} placeholder="needed when solving power or difference" />
                <NonparametricToggle checked={oneNonparametric} setChecked={setOneNonparametric} />
              </div>
              <ResultPanel result={oneSample} />
              {oneCurve.length > 0 && <PowerCurve title="Power Curve" data={oneCurve} targetPower={targetPower} targetN={oneSample.targetN} />}
            </div>
          )}

          {activeTab === 'two-sample' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Two Sample Means</h3>
                <NumberField label="Difference to Detect" value={twoDeltaInput} setValue={changeValue(setTwoDeltaInput)} step={0.1} min={0.001} placeholder="blank = solve difference" />
                <NumberField label="Estimated Pooled Standard Deviation" value={twoSigmaInput} setValue={changeValue(setTwoSigmaInput)} step={0.1} min={0.001} />
                <NumberField label="Control Sample Size (if limited)" value={twoControlNInput} setValue={changeValue(setTwoControlNInput)} step={1} min={1} placeholder="blank = balanced groups" />
                <NonparametricToggle checked={twoNonparametric} setChecked={setTwoNonparametric} />
              </div>
              <ResultPanel result={twoSample} />
              {twoCurve.length > 0 && <PowerCurve title={twoControlN ? 'Power Curve by Treatment Sample Size' : 'Power Curve by Sample Size Per Group'} data={twoCurve} targetPower={targetPower} targetN={twoControlN && twoSample.targetN ? twoSample.targetN - Math.ceil(twoControlN) : twoSample.targetN ? Math.ceil(twoSample.targetN / 2) : null} />}
            </div>
          )}

          {activeTab === 'three-plus' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">3 or More Groups</h3>
                <NumberField label="Number of Groups" value={groupsInput} setValue={changeValue(setGroupsInput)} step={1} min={2} />
                <NumberField label="Cohen's f Effect Size" value={anovaEffectInput} setValue={changeValue(setAnovaEffectInput)} step={0.01} min={0.01} placeholder="blank = solve effect" />
                <NumberField label="Total Sample Size" value={anovaTotalNInput} setValue={changeValue(setAnovaTotalNInput)} step={1} min={2} placeholder="needed when solving power or effect" />
                <NonparametricToggle checked={anovaNonparametric} setChecked={setAnovaNonparametric} />
              </div>
              <ResultPanel result={anova} />
              {anovaCurve.length > 0 && <PowerCurve title="Power Curve by Total Sample Size" data={anovaCurve} targetPower={targetPower} targetN={anova.targetN} />}
            </div>
          )}

          {activeTab === 'proportions' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Proportions</h3>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 border border-slate-700 rounded p-1">
                  <button onClick={() => setPropMode('one')} className={`py-2 text-sm rounded ${propMode === 'one' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>1 Sample</button>
                  <button onClick={() => setPropMode('two')} className={`py-2 text-sm rounded ${propMode === 'two' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>2 Sample</button>
                </div>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Blank Proportion Direction</span>
                  <select
                    value={propDirection}
                    onChange={e => setPropDirection(e.target.value as Direction)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </label>
                {propMode === 'one' ? (
                  <>
                    <NumberField label="Null Proportion" value={p0Input} setValue={changeValue(setP0Input)} step={0.01} min={0.001} />
                    <NumberField label="Alternative Proportion" value={p1Input} setValue={changeValue(setP1Input)} step={0.01} min={0.001} placeholder="blank = solve proportion" />
                    <NumberField label="Sample Size" value={propNInput} setValue={changeValue(setPropNInput)} step={1} min={1} placeholder="needed when solving power or proportion" />
                  </>
                ) : (
                  <>
                    <NumberField label="Sample 1 Proportion" value={p1Input} setValue={changeValue(setP1Input)} step={0.01} min={0.001} />
                    <NumberField label="Sample 2 Proportion" value={p2Input} setValue={changeValue(setP2Input)} step={0.01} min={0.001} placeholder="blank = solve proportion" />
                    <NumberField label="Sample Size Per Group" value={propNInput} setValue={changeValue(setPropNInput)} step={1} min={1} placeholder="needed when solving power or proportion" />
                  </>
                )}
              </div>
              <ResultPanel result={proportions} />
              {propCurve.length > 0 && <PowerCurve title={propMode === 'one' ? 'Power Curve' : 'Power Curve by Sample Size Per Group'} data={propCurve} targetPower={targetPower} targetN={propMode === 'one' ? proportions.targetN : proportions.targetN ? proportions.targetN / 2 : propN} />}
            </div>
          )}

          {activeTab === 'poisson' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Poisson Rates</h3>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 border border-slate-700 rounded p-1">
                  <button onClick={() => setPoissonMode('one')} className={`py-2 text-sm rounded ${poissonMode === 'one' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>1 Sample</button>
                  <button onClick={() => setPoissonMode('two')} className={`py-2 text-sm rounded ${poissonMode === 'two' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>2 Sample</button>
                </div>
                <div className="rounded border border-slate-700 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">
                  Use Poisson rate tools when counting events over area, time, opportunity, or exposure, such as defects per unit, errors per invoice, calls per hour, or incidents per month.
                  Use Proportion tools when each item is pass/fail, defective/not defective, yes/no, or success/failure.
                </div>
                <TextField label="Exposure Unit Label" value={poissonUnitLabel} setValue={setPoissonUnitLabel} placeholder="unit, hour, transaction, month" />
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Blank Rate Direction</span>
                  <select
                    value={poissonDirection}
                    onChange={e => setPoissonDirection(e.target.value as Direction)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </label>
                {poissonMode === 'one' ? (
                  <>
                    <NumberField label="Baseline / Hypothesized Rate" value={poissonBaselineRateInput} setValue={changeValue(setPoissonBaselineRateInput)} step={0.01} min={0} />
                    <NumberField label="Alternative / Expected Rate" value={poissonExpectedRateInput} setValue={changeValue(setPoissonExpectedRateInput)} step={0.01} min={0} placeholder="blank = solve rate" />
                    <NumberField label="Sample Size / Exposure Units" value={poissonExposureInput} setValue={changeValue(setPoissonExposureInput)} step={1} min={1} placeholder="needed when solving power or rate" />
                  </>
                ) : (
                  <>
                    <NumberField label="Control / Baseline Rate" value={poissonControlRateInput} setValue={changeValue(setPoissonControlRateInput)} step={0.01} min={0} />
                    <NumberField label="Treatment / Comparison Rate" value={poissonTreatmentRateInput} setValue={changeValue(setPoissonTreatmentRateInput)} step={0.01} min={0} placeholder="blank = solve rate" />
                    <NumberField label="Control Exposure (if limited)" value={poissonFixedControlExposureInput} setValue={changeValue(setPoissonFixedControlExposureInput)} step={1} min={1} placeholder="blank = balanced groups" />
                    <NumberField label="Treatment Exposure / Sample Size" value={poissonTreatmentExposureInput} setValue={changeValue(setPoissonTreatmentExposureInput)} step={1} min={1} placeholder="needed when solving power or rate" />
                  </>
                )}
              </div>
              <ResultPanel result={poisson} />
              {poissonCurve.length > 0 && (
                <PowerCurve
                  title={poissonMode === 'one'
                    ? 'Power Curve by Exposure'
                    : poissonFixedControlExposure ? 'Power Curve by Treatment Exposure' : 'Power Curve by Exposure Per Group'}
                  data={poissonCurve}
                  targetPower={targetPower}
                  targetN={poissonMode === 'one'
                    ? poisson.targetN
                    : poissonFixedControlExposure && poisson.targetN ? poisson.targetN - Math.ceil(Number(poissonFixedControlExposure)) : poisson.targetN ? Math.ceil(poisson.targetN / 2) : null}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
