import React, { useMemo, useState } from 'react';
import { Calculator, Sigma, Users, Layers3, Percent, ArrowRight, TrendingUp } from 'lucide-react';
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

type TabId = 'one-sample' | 'two-sample' | 'three-plus' | 'proportions';
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

const tabs: { id: TabId, label: string, icon: React.ElementType }[] = [
  { id: 'one-sample', label: 'One Sample', icon: Sigma },
  { id: 'two-sample', label: 'Two Sample', icon: Users },
  { id: 'three-plus', label: '3 or More', icon: Layers3 },
  { id: 'proportions', label: 'Proportions (1 and 2 sample)', icon: Percent },
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
const validPower = (value: number | null) => value !== null && value > 0 && value < 1;
const validProportion = (value: number | null) => value !== null && value > 0 && value < 1;
const changeValue = (setter: (value: string) => void) => (value: string) => setter(value);

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

function twoSampleMeanPower(controlN: number, alpha: number, alternative: Alternative, delta: number, sigma: number, allocation: number) {
  const ratio = Math.max(allocation, 0.01);
  const treatmentN = Math.max(2, Math.ceil(controlN * ratio));
  if (controlN < 2 || sigma <= 0) return null;
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

function solveOneSample(alpha: number, alternative: Alternative, power: number | null, delta: number | null, sigma: number | null, nInput: number | null): Result {
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
  return {
    mode: 'sample-size',
    primary: n?.toString() || '--',
    secondary: 'observations',
    note: 'Uses a noncentral t approximation for a one-sample mean test. Treat this as planning guidance before final confirmation.',
    achievedPower: power,
    targetN: n,
    effect: Math.abs(delta),
  };
}

function solveTwoSample(alpha: number, alternative: Alternative, power: number | null, delta: number | null, sigma: number | null, allocation: number | null, controlN: number | null): Result {
  const ratio = Math.max(allocation || 1, 0.01);
  if (!positive(sigma)) return invalidResult('Enter a positive pooled standard deviation.');

  if (power === null) {
    if (!positive(delta) || !positive(controlN)) return invalidResult('Leave Power blank, then enter control sample size and difference to calculate achieved power.');
    const control = Math.ceil(controlN);
    const treatment = Math.ceil(control * ratio);
    const achievedPower = twoSampleMeanPower(control, alpha, alternative, delta, sigma, ratio);
    return {
      mode: 'power',
      primary: fmt(achievedPower, 3),
      secondary: 'power',
      details: `Control: ${control} | Treatment: ${treatment}`,
      note: 'Calculated from the entered group sizes, alpha, pooled sigma, and difference using a noncentral t approximation.',
      achievedPower,
      targetN: control + treatment,
      effect: Math.abs(delta),
    };
  }

  if (delta === null) {
    if (!validPower(power) || !positive(controlN)) return invalidResult('Leave Difference blank, then enter target power and control sample size to calculate detectable difference.');
    const control = Math.ceil(controlN);
    const treatment = Math.ceil(control * ratio);
    const detectable = findDetectableEffect(power, effect => twoSampleMeanPower(control, alpha, alternative, effect, sigma, ratio));
    return {
      mode: 'effect',
      primary: fmt(detectable, 3),
      secondary: 'difference',
      details: `Control: ${control} | Treatment: ${treatment}`,
      note: 'This is the minimum absolute difference detectable at the requested power and allocation.',
      achievedPower: power,
      targetN: control + treatment,
      effect: detectable,
    };
  }

  if (!validPower(power) || !positive(delta)) return invalidResult('Enter Power between 0 and 1 and a positive difference.');
  const control = findSmallestN(power, nValue => twoSampleMeanPower(nValue, alpha, alternative, delta, sigma, ratio));
  const treatment = control ? Math.ceil(control * ratio) : null;
  return {
    mode: 'sample-size',
    primary: control?.toString() || '--',
    secondary: ratio === 1 ? 'per group' : 'control observations',
    details: `Control: ${control || '--'} | Treatment: ${treatment || '--'} | Total: ${control && treatment ? control + treatment : '--'}`,
    note: 'Uses an equal-variance noncentral t approximation for two independent samples.',
    achievedPower: power,
    targetN: control && treatment ? control + treatment : null,
    effect: Math.abs(delta),
  };
}

function solveAnova(alpha: number, alternative: Alternative, power: number | null, effect: number | null, groups: number | null, totalN: number | null): Result {
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
  const perGroup = total ? Math.ceil(total / groupCount) : null;
  return {
    mode: 'sample-size',
    primary: total?.toString() || '--',
    secondary: 'total observations',
    details: `About ${perGroup || '--'} observations per group`,
    note: 'This is an ANOVA planning approximation using Cohen\'s f.',
    achievedPower: power,
    targetN: total,
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
  const [activeTab, setActiveTab] = useState<TabId>('one-sample');
  const [alphaInput, setAlphaInput] = useState('0.05');
  const [powerInput, setPowerInput] = useState('0.90');
  const [alternative, setAlternative] = useState<Alternative>('two-sided');

  const [oneDeltaInput, setOneDeltaInput] = useState('1');
  const [oneSigmaInput, setOneSigmaInput] = useState('2');
  const [oneNInput, setOneNInput] = useState('');

  const [twoDeltaInput, setTwoDeltaInput] = useState('1');
  const [twoSigmaInput, setTwoSigmaInput] = useState('2');
  const [allocationInput, setAllocationInput] = useState('1');
  const [twoControlNInput, setTwoControlNInput] = useState('');

  const [groupsInput, setGroupsInput] = useState('3');
  const [anovaEffectInput, setAnovaEffectInput] = useState('0.25');
  const [anovaTotalNInput, setAnovaTotalNInput] = useState('');

  const [propMode, setPropMode] = useState<'one' | 'two'>('one');
  const [propDirection, setPropDirection] = useState<Direction>('increase');
  const [p0Input, setP0Input] = useState('0.10');
  const [p1Input, setP1Input] = useState('0.15');
  const [p2Input, setP2Input] = useState('0.20');
  const [propNInput, setPropNInput] = useState('');

  const alpha = clamp(parseOptional(alphaInput) ?? 0.05, 0.0001, 0.999);
  const power = parseOptional(powerInput);
  const targetPower = validPower(power) ? power : null;

  const oneDelta = parseOptional(oneDeltaInput);
  const oneSigma = parseOptional(oneSigmaInput);
  const oneN = parseOptional(oneNInput);
  const twoDelta = parseOptional(twoDeltaInput);
  const twoSigma = parseOptional(twoSigmaInput);
  const allocation = parseOptional(allocationInput);
  const twoControlN = parseOptional(twoControlNInput);
  const groups = parseOptional(groupsInput);
  const anovaEffect = parseOptional(anovaEffectInput);
  const anovaTotalN = parseOptional(anovaTotalNInput);
  const p0 = parseOptional(p0Input);
  const p1 = parseOptional(p1Input);
  const p2 = parseOptional(p2Input);
  const propN = parseOptional(propNInput);

  const oneSample = useMemo(() => solveOneSample(alpha, alternative, power, oneDelta, oneSigma, oneN), [alpha, alternative, power, oneDelta, oneSigma, oneN]);
  const twoSample = useMemo(() => solveTwoSample(alpha, alternative, power, twoDelta, twoSigma, allocation, twoControlN), [alpha, alternative, power, twoDelta, twoSigma, allocation, twoControlN]);
  const anova = useMemo(() => solveAnova(alpha, alternative, power, anovaEffect, groups, anovaTotalN), [alpha, alternative, power, anovaEffect, groups, anovaTotalN]);
  const proportions = useMemo(() => {
    if (propMode === 'one') return solveOneProportion(alpha, alternative, power, p0, p1, propN, propDirection);
    return solveTwoProportion(alpha, alternative, power, p1, p2, propN, propDirection);
  }, [alpha, alternative, power, p0, p1, p2, propN, propMode, propDirection]);

  const oneCurve = useMemo(() => {
    const effect = oneSample.effect ?? oneDelta;
    if (!positive(effect) || !positive(oneSigma)) return [];
    return buildCurve(Math.max(oneSample.targetN || oneN || 50, 50) * 1.5, n => oneSampleMeanPower(n, alpha, alternative, effect, oneSigma) ?? 0);
  }, [oneSample.effect, oneSample.targetN, oneDelta, oneSigma, oneN, alpha, alternative]);

  const twoCurve = useMemo(() => {
    const effect = twoSample.effect ?? twoDelta;
    const ratio = Math.max(allocation || 1, 0.01);
    if (!positive(effect) || !positive(twoSigma)) return [];
    const maxControlN = Math.max(Math.ceil((twoSample.targetN || (twoControlN ? twoControlN * (1 + ratio) : 80)) / (1 + ratio)), 10);
    return buildCurve(maxControlN * 1.5, n => twoSampleMeanPower(n, alpha, alternative, effect, twoSigma, ratio) ?? 0);
  }, [twoSample.effect, twoSample.targetN, twoDelta, twoSigma, allocation, twoControlN, alpha, alternative]);

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
            Leave <span className="text-slate-300">Power</span> blank to solve achieved power. Leave the effect field blank to solve the detectable delta, Cohen's f, or proportion.
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
                <NumberField label="Treatment / Control Allocation" value={allocationInput} setValue={changeValue(setAllocationInput)} step={0.1} min={0.01} />
                <NumberField label="Control Sample Size" value={twoControlNInput} setValue={changeValue(setTwoControlNInput)} step={1} min={1} placeholder="needed when solving power or difference" />
              </div>
              <ResultPanel result={twoSample} />
              {twoCurve.length > 0 && <PowerCurve title="Power Curve by Control Sample Size" data={twoCurve} targetPower={targetPower} targetN={twoSample.targetN && allocation ? Math.ceil(twoSample.targetN / (1 + Math.max(allocation, 0.01))) : twoControlN} />}
            </div>
          )}

          {activeTab === 'three-plus' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">3 or More Groups</h3>
                <NumberField label="Number of Groups" value={groupsInput} setValue={changeValue(setGroupsInput)} step={1} min={2} />
                <NumberField label="Cohen's f Effect Size" value={anovaEffectInput} setValue={changeValue(setAnovaEffectInput)} step={0.01} min={0.01} placeholder="blank = solve effect" />
                <NumberField label="Total Sample Size" value={anovaTotalNInput} setValue={changeValue(setAnovaTotalNInput)} step={1} min={2} placeholder="needed when solving power or effect" />
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
        </div>
      </div>
    </div>
  );
}
