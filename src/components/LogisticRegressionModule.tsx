import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Activity, AlertTriangle, BarChart3, ListChecks } from 'lucide-react';
import * as jStatModule from 'jstat';
import { create, all } from 'mathjs';
import ExportWrapper from './ExportWrapper';

const jStat: any = (jStatModule as any).default?.jStat || (jStatModule as any).jStat || (jStatModule as any).default || jStatModule;
const math = create(all);

type LogisticType = 'binary' | 'ordinal' | 'nominal';
type PredictorType = 'continuous' | 'categorical';

type EncodedDesign = {
  X: number[][];
  yLabels: string[];
  terms: string[];
  rows: Array<{ label: string; originalIndex: number }>;
  predictorMeta: Array<{ id: string; name: string; type: PredictorType; categories?: string[]; mean?: number }>;
};

type FitResult = {
  beta: number[];
  se: number[];
  z: number[];
  p: number[];
  ll: number;
  aic: number;
  pseudoR2: number;
  lrP: number;
  converged: boolean;
};

const sigmoid = (value: number) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));
const fmt = (value: number | null | undefined, digits = 4) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';
const fmtTick = (value: any) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  if (Math.abs(numberValue) >= 1000 || (Math.abs(numberValue) > 0 && Math.abs(numberValue) < 0.01)) return numberValue.toExponential(2);
  return Number(numberValue.toFixed(3)).toString();
};
const unique = (values: any[]) => Array.from(new Set(values.map(v => String(v)).filter(v => v.trim() !== '')));

function invert(matrix: number[][]) {
  try {
    const inv: any = math.inv(matrix);
    return inv.toArray ? inv.toArray() : inv;
  } catch {
    return null;
  }
}

function normalP(z: number) {
  return 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
}

function fitBinaryLogit(X: number[][], y: number[]): FitResult | null {
  const n = X.length;
  const k = X[0]?.length || 0;
  if (n <= k || k === 0) return null;

  let beta = Array(k).fill(0);
  let converged = false;

  for (let iter = 0; iter < 80; iter++) {
    const p = X.map(row => sigmoid(row.reduce((sum, value, i) => sum + value * beta[i], 0)));
    const gradient = Array(k).fill(0);
    const hessian = Array.from({ length: k }, () => Array(k).fill(0));

    for (let r = 0; r < n; r++) {
      const residual = y[r] - p[r];
      const weight = Math.max(p[r] * (1 - p[r]), 1e-6);
      for (let i = 0; i < k; i++) {
        gradient[i] += X[r][i] * residual;
        for (let j = 0; j < k; j++) {
          hessian[i][j] += X[r][i] * weight * X[r][j];
        }
      }
    }

    for (let i = 0; i < k; i++) hessian[i][i] += 1e-5;
    const inv = invert(hessian);
    if (!inv) return null;
    const step = inv.map((row: number[]) => row.reduce((sum, value, i) => sum + value * gradient[i], 0));
    beta = beta.map((value, i) => value + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-6) {
      converged = true;
      break;
    }
  }

  const probs = X.map(row => sigmoid(row.reduce((sum, value, i) => sum + value * beta[i], 0)));
  const ll = probs.reduce((sum, p, i) => sum + y[i] * Math.log(Math.max(p, 1e-12)) + (1 - y[i]) * Math.log(Math.max(1 - p, 1e-12)), 0);
  const eventRate = y.reduce((sum, value) => sum + value, 0) / n;
  const nullLL = y.reduce((sum, value) => sum + value * Math.log(Math.max(eventRate, 1e-12)) + (1 - value) * Math.log(Math.max(1 - eventRate, 1e-12)), 0);

  const info = Array.from({ length: k }, () => Array(k).fill(0));
  for (let r = 0; r < n; r++) {
    const weight = Math.max(probs[r] * (1 - probs[r]), 1e-6);
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) info[i][j] += X[r][i] * weight * X[r][j];
    }
  }
  for (let i = 0; i < k; i++) info[i][i] += 1e-5;
  const cov = invert(info);
  const se = cov ? cov.map((row: number[], i: number) => Math.sqrt(Math.max(row[i], 0))) : Array(k).fill(NaN);
  const z = beta.map((value, i) => value / se[i]);
  const pValues = z.map(normalP);
  const lr = 2 * (ll - nullLL);

  return {
    beta,
    se,
    z,
    p: pValues,
    ll,
    aic: 2 * k - 2 * ll,
    pseudoR2: nullLL === 0 ? 0 : 1 - ll / nullLL,
    lrP: 1 - jStat.chisquare.cdf(Math.max(lr, 0), Math.max(k - 1, 1)),
    converged
  };
}

function buildDesign(datasets: any[], responseId: string, predictorIds: string[], predictorTypes: Record<string, PredictorType>): EncodedDesign | null {
  const response = datasets.find(d => d.id === responseId);
  const predictors = predictorIds.map(id => datasets.find(d => d.id === id)).filter(Boolean);
  if (!response || predictors.length === 0) return null;

  const terms = ['Intercept'];
  const rows: Array<{ label: string; originalIndex: number }> = [];
  const predictorMeta: EncodedDesign['predictorMeta'] = [];
  const maxRows = Math.max(response.values.length, ...predictors.map(d => d.values.length));

  predictors.forEach((predictor: any) => {
    const type = predictorTypes[predictor.id] || (predictor.isNumeric ? 'continuous' : 'categorical');
    if (type === 'continuous') {
      const numeric = predictor.values.map((v: any) => Number(v)).filter(Number.isFinite);
      predictorMeta.push({ id: predictor.id, name: predictor.name, type, mean: numeric.reduce((a: number, b: number) => a + b, 0) / Math.max(numeric.length, 1) });
      terms.push(predictor.name);
    } else {
      const categories = unique(predictor.values);
      predictorMeta.push({ id: predictor.id, name: predictor.name, type, categories });
      categories.slice(1).forEach(cat => terms.push(`${predictor.name}: ${cat}`));
    }
  });

  const X: number[][] = [];
  const yLabels: string[] = [];
  for (let r = 0; r < maxRows; r++) {
    const label = String(response.values[r] ?? '').trim();
    if (!label) continue;
    const encoded = [1];
    let complete = true;

    for (const meta of predictorMeta) {
      const predictor = predictors.find((d: any) => d.id === meta.id);
      const raw = predictor?.values[r];
      if (meta.type === 'continuous') {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          complete = false;
          break;
        }
        encoded.push(value);
      } else {
        const value = String(raw ?? '').trim();
        if (!value || !meta.categories?.includes(value)) {
          complete = false;
          break;
        }
        meta.categories.slice(1).forEach(cat => encoded.push(value === cat ? 1 : 0));
      }
    }

    if (complete) {
      X.push(encoded);
      yLabels.push(label);
      rows.push({ label, originalIndex: r });
    }
  }

  return { X, yLabels, terms, rows, predictorMeta };
}

function coefficientRows(fit: FitResult, terms: string[], confidence: number) {
  const zCrit = jStat.normal.inv(1 - (1 - confidence) / 2, 0, 1);
  return terms.map((term, i) => {
    const oddsRatio = Math.exp(fit.beta[i]);
    return {
      term,
      coeff: fit.beta[i],
      se: fit.se[i],
      z: fit.z[i],
      p: fit.p[i],
      oddsRatio,
      ciLow: Math.exp(fit.beta[i] - zCrit * fit.se[i]),
      ciHigh: Math.exp(fit.beta[i] + zCrit * fit.se[i])
    };
  });
}

function predictProbability(row: number[], beta: number[]) {
  return sigmoid(row.reduce((sum, value, i) => sum + value * beta[i], 0));
}

function buildBaselineRow(design: EncodedDesign) {
  const row = [1];
  design.predictorMeta.forEach(meta => {
    if (meta.type === 'continuous') row.push(meta.mean || 0);
    else meta.categories?.slice(1).forEach(() => row.push(0));
  });
  return row;
}

function rowWithPredictorValue(design: EncodedDesign, predictorId: string, value: string | number) {
  const row = [1];
  design.predictorMeta.forEach(meta => {
    if (meta.type === 'continuous') row.push(meta.id === predictorId ? Number(value) : (meta.mean || 0));
    else {
      const selected = meta.id === predictorId ? String(value) : meta.categories?.[0];
      meta.categories?.slice(1).forEach(cat => row.push(selected === cat ? 1 : 0));
    }
  });
  return row;
}

function interpretOddsRatio(term: string, oddsRatio: number) {
  if (term === 'Intercept') return 'Baseline log-odds when predictors are at their reference or average values.';
  if (Math.abs(oddsRatio - 1) < 0.005) return 'Odds Ratio = 1: this predictor is not associated with a meaningful change in odds, holding other predictors constant.';
  if (oddsRatio > 1) return `Odds Ratio > 1: ${term} is associated with higher odds of the event, holding other predictors constant.`;
  return `Odds Ratio < 1: ${term} is associated with lower odds of the event, holding other predictors constant.`;
}

function buildLinearPredictor(terms: string[], beta: number[]) {
  const pieces = beta.map((coef, i) => {
    if (i === 0) return fmt(coef, 3);
    const sign = coef >= 0 ? '+' : '-';
    return `${sign} ${fmt(Math.abs(coef), 3)}(${terms[i]})`;
  });
  return pieces.join(' ');
}

function buildProbabilityEquation(terms: string[], beta: number[], label = 'event') {
  const predictor = buildLinearPredictor(terms, beta);
  return `Predicted probability of ${label} = 1 / (1 + e^-(${predictor}))`;
}

function buildOddsEquation(terms: string[], beta: number[], label = 'event') {
  const predictor = buildLinearPredictor(terms, beta);
  return `Predicted odds of ${label} = e^(${predictor})`;
}

export default function LogisticRegressionModule({ datasets }: { datasets: any[] }) {
  const [modelType, setModelType] = useState<LogisticType>('binary');
  const [responseId, setResponseId] = useState('');
  const [eventLevel, setEventLevel] = useState('');
  const [referenceLevel, setReferenceLevel] = useState('');
  const [predictorIds, setPredictorIds] = useState<string[]>([]);
  const [predictorTypes, setPredictorTypes] = useState<Record<string, PredictorType>>({});
  const [confidenceInput, setConfidenceInput] = useState('0.95');
  const [alphaInput, setAlphaInput] = useState('0.05');
  const [thresholdInput, setThresholdInput] = useState('0.50');
  const [ordinalOrderText, setOrdinalOrderText] = useState('');

  const response = datasets.find(d => d.id === responseId);
  const responseLevels = useMemo(() => unique(response?.values || []), [response]);
  const confidence = Math.min(0.999, Math.max(0.5, Number(confidenceInput) || 0.95));
  const alpha = Math.min(0.999, Math.max(0.001, Number(alphaInput) || 0.05));
  const threshold = Math.min(0.99, Math.max(0.01, Number(thresholdInput) || 0.5));

  React.useEffect(() => {
    if (responseLevels.length && !eventLevel) setEventLevel(responseLevels[0]);
    if (responseLevels.length && !referenceLevel) setReferenceLevel(responseLevels[0]);
    if (responseLevels.length && !ordinalOrderText) setOrdinalOrderText(responseLevels.join(', '));
  }, [responseLevels, eventLevel, referenceLevel, ordinalOrderText]);

  const design = useMemo(() => buildDesign(datasets, responseId, predictorIds, predictorTypes), [datasets, responseId, predictorIds, predictorTypes]);

  const results = useMemo(() => {
    if (!design || !responseId || predictorIds.length === 0) return { error: 'Select a response column and at least one predictor.' };
    const levels = unique(design.yLabels);

    if (modelType === 'binary') {
      if (levels.length !== 2) return { error: 'Binary logistic regression requires exactly two response categories.' };
      if (!eventLevel) return { error: 'Select the event/success level.' };
      const y = design.yLabels.map(label => label === eventLevel ? 1 : 0);
      if (new Set(y).size < 2) return { error: 'The selected event level must have both event and non-event rows.' };
      const fit = fitBinaryLogit(design.X, y);
      if (!fit) return { error: 'The binary logistic model could not be fit. Check for sparse categories or duplicate predictors.' };
      return { type: 'binary', fit, rows: coefficientRows(fit, design.terms, confidence), y };
    }

    if (modelType === 'ordinal') {
      const order = ordinalOrderText.split(',').map(v => v.trim()).filter(Boolean);
      if (order.length < 3) return { error: 'Ordinal logistic regression requires at least three ordered response categories.' };
      if (!order.every(level => levels.includes(level))) return { error: 'Every ordered category must match a response level in the data.' };
      const fits = order.slice(0, -1).map((cut, cutIndex) => {
        const y = design.yLabels.map(label => order.indexOf(label) > cutIndex ? 1 : 0);
        const fit = fitBinaryLogit(design.X, y);
        return fit ? { cut, fit } : null;
      }).filter(Boolean) as Array<{ cut: string; fit: FitResult }>;
      if (!fits.length) return { error: 'The ordinal model could not be fit. Check category counts and predictors.' };
      const avgBeta = design.terms.map((_, i) => fits.reduce((sum, f) => sum + f.fit.beta[i], 0) / fits.length);
      const representative = fits[0].fit;
      const avgFit = { ...representative, beta: avgBeta };
      return { type: 'ordinal', fits, rows: coefficientRows(avgFit, design.terms, confidence), order };
    }

    if (levels.length < 3) return { error: 'Nominal logistic regression requires at least three unordered response categories.' };
    if (!referenceLevel) return { error: 'Select a reference outcome category.' };
    const fits = levels.filter(level => level !== referenceLevel).map(level => {
      const y = design.yLabels.map(label => label === level ? 1 : 0);
      const fit = fitBinaryLogit(design.X, y);
      return fit ? { level, fit, rows: coefficientRows(fit, design.terms, confidence) } : null;
    }).filter(Boolean) as Array<{ level: string; fit: FitResult; rows: any[] }>;
    if (!fits.length) return { error: 'The nominal model could not be fit. Check category counts and predictors.' };
    return { type: 'nominal', fits, levels };
  }, [design, responseId, predictorIds, modelType, eventLevel, referenceLevel, ordinalOrderText, confidence]);

  const firstContinuous = design?.predictorMeta.find(p => p.type === 'continuous');
  const firstCategorical = design?.predictorMeta.find(p => p.type === 'categorical');

  const probabilityCurve = useMemo(() => {
    if (!design || !firstContinuous || !results || 'error' in results) return [];
    const values = design.X.map(row => {
      const index = design.terms.indexOf(firstContinuous.name);
      return index >= 0 ? row[index] : null;
    }).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return Array.from({ length: 40 }, (_, i) => {
      const x = min + (span * i) / 39;
      const row = rowWithPredictorValue(design, firstContinuous.id, x);
      if (results.type === 'binary') return { x, [eventLevel]: predictProbability(row, results.fit.beta) };
      if (results.type === 'ordinal') {
        const cumulative = results.fits.map((fit: any) => predictProbability(row, fit.fit.beta));
        const probs: any = { x };
        const order = results.order as string[];
        order.forEach((level: string, levelIndex: number) => {
          const lower = levelIndex === 0 ? 0 : cumulative[levelIndex - 1];
          const upper = levelIndex === order.length - 1 ? 1 : cumulative[levelIndex];
          probs[level] = Math.max(0, upper - lower);
        });
        return probs;
      }
      const scores = [0, ...results.fits.map((fit: any) => row.reduce((sum, value, i) => sum + value * fit.fit.beta[i], 0))];
      const exps = scores.map(score => Math.exp(score - Math.max(...scores)));
      const total = exps.reduce((a, b) => a + b, 0);
      const point: any = { x, [referenceLevel]: exps[0] / total };
      results.fits.forEach((fit: any, i: number) => point[fit.level] = exps[i + 1] / total);
      return point;
    });
  }, [design, firstContinuous, results, eventLevel, referenceLevel]);

  const categoryChart = useMemo(() => {
    if (!design || !firstCategorical || !results || 'error' in results) return [];
    return (firstCategorical.categories || []).map(category => {
      const row = rowWithPredictorValue(design, firstCategorical.id, category);
      if (results.type === 'binary') return { category, probability: predictProbability(row, results.fit.beta) };
      return { category, probability: null };
    });
  }, [design, firstCategorical, results]);

  const predictedRows = useMemo(() => {
    if (!design || !results || 'error' in results) return [];
    return design.X.slice(0, 12).map((row, i) => {
      if (results.type === 'binary') return { row: design.rows[i].originalIndex + 1, actual: design.yLabels[i], probability: predictProbability(row, results.fit.beta) };
      return { row: design.rows[i].originalIndex + 1, actual: design.yLabels[i], probability: null };
    });
  }, [design, results]);

  const modelSummary = useMemo(() => {
    if (!design || !results || 'error' in results) return null;
    if (results.type === 'binary') {
      return {
        pseudoR2: results.fit.pseudoR2,
        equation: buildProbabilityEquation(design.terms, results.fit.beta, eventLevel),
        oddsEquation: buildOddsEquation(design.terms, results.fit.beta, eventLevel)
      };
    }

    if (results.type === 'ordinal') {
      const meanPseudoR2 = results.fits.reduce((sum: number, fit: any) => sum + fit.fit.pseudoR2, 0) / results.fits.length;
      const equations = results.fits
        .slice(0, 3)
        .map((fit: any) => buildProbabilityEquation(design.terms, fit.fit.beta, `above ${fit.cut}`));
      return {
        pseudoR2: meanPseudoR2,
        equation: equations.join(' | '),
        oddsEquation: 'Odds ratios are shown in the coefficient table for each one-unit or category change.'
      };
    }

    const meanPseudoR2 = results.fits.reduce((sum: number, fit: any) => sum + fit.fit.pseudoR2, 0) / results.fits.length;
    const equations = results.fits
      .slice(0, 3)
      .map((fit: any) => buildProbabilityEquation(design.terms, fit.fit.beta, `${fit.level} vs ${referenceLevel}`));
    return {
      pseudoR2: meanPseudoR2,
      equation: equations.join(' | '),
      oddsEquation: `Odds ratios are interpreted relative to ${referenceLevel}.`
    };
  }, [design, results, eventLevel, referenceLevel]);

  const confusion = useMemo(() => {
    if (!design || !results || 'error' in results || results.type !== 'binary') return null;
    let tp = 0, fp = 0, tn = 0, fn = 0;
    design.X.forEach((row, i) => {
      const actual = results.y[i] === 1;
      const predicted = predictProbability(row, results.fit.beta) >= threshold;
      if (actual && predicted) tp++;
      else if (!actual && predicted) fp++;
      else if (!actual && !predicted) tn++;
      else fn++;
    });
    return { tp, fp, tn, fn, accuracy: (tp + tn) / Math.max(tp + tn + fp + fn, 1) };
  }, [design, results, threshold]);

  const togglePredictor = (id: string) => {
    setPredictorIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Activity className="w-6 h-6 text-sky-400" /> Logistic Regression
        </h2>
        <p className="text-sm text-slate-500 mt-2">Use logistic regression when the response is categorical and you want to understand which factors affect the odds or probability of an outcome.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="col-span-1 space-y-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Model Setup</h3>
            <label className="block text-xs text-slate-400 mb-1">Logistic Regression Type</label>
            <select value={modelType} onChange={e => setModelType(e.target.value as LogisticType)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4">
              <option value="binary">Binary Logistic Regression</option>
              <option value="ordinal">Ordinal Logistic Regression</option>
              <option value="nominal">Nominal / Multinomial Logistic Regression</option>
            </select>

            <label className="block text-xs text-slate-400 mb-1">Response Column</label>
            <select value={responseId} onChange={e => { setResponseId(e.target.value); setEventLevel(''); setReferenceLevel(''); setOrdinalOrderText(''); }} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4">
              <option value="">Select response...</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            {modelType === 'binary' && (
              <>
                <label className="block text-xs text-slate-400 mb-1">Event / Success Level</label>
                <select value={eventLevel} onChange={e => setEventLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4">
                  {responseLevels.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </>
            )}

            {modelType === 'ordinal' && (
              <label className="block mb-4">
                <span className="block text-xs text-slate-400 mb-1">Category Order, low to high</span>
                <input value={ordinalOrderText} onChange={e => setOrdinalOrderText(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" placeholder="Low, Medium, High" />
              </label>
            )}

            {modelType === 'nominal' && (
              <>
                <label className="block text-xs text-slate-400 mb-1">Reference Outcome Category</label>
                <select value={referenceLevel} onChange={e => setReferenceLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4">
                  {responseLevels.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="block text-xs text-slate-400 mb-1">Confidence</span>
                <input type="number" min="0.5" max="0.999" step="0.01" value={confidenceInput} onChange={e => setConfidenceInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
              </label>
              <label>
                <span className="block text-xs text-slate-400 mb-1">Alpha</span>
                <input type="number" min="0.001" max="0.999" step="0.01" value={alphaInput} onChange={e => setAlphaInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
              </label>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Predictors</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {datasets.filter(d => d.id !== responseId).map(d => {
                const selected = predictorIds.includes(d.id);
                const type = predictorTypes[d.id] || (d.isNumeric ? 'continuous' : 'categorical');
                return (
                  <div key={d.id} className={`rounded border p-3 ${selected ? 'bg-sky-900/30 border-sky-500' : 'bg-slate-900 border-slate-700'}`}>
                    <button type="button" onClick={() => togglePredictor(d.id)} className="w-full text-left text-sm font-medium truncate">{d.name}</button>
                    {selected && (
                      <select value={type} onChange={e => setPredictorTypes(prev => ({ ...prev, [d.id]: e.target.value as PredictorType }))} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs">
                        <option value="continuous">Continuous</option>
                        <option value="categorical">Categorical</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-3 space-y-6">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-100">
            <div className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={16} /> Odds Ratio Warning</div>
            Logistic regression estimates odds, not direct probability differences. Odds ratios can be misread, especially when the event is common. Use the predicted probability outputs and charts to make the result easier to interpret.
          </div>

          {modelType === 'ordinal' && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-4 text-sm text-sky-100">
              Ordinal logistic regression here uses a proportional-odds planning view. That assumes the predictor effects are reasonably similar across ordered category cutpoints.
            </div>
          )}

          {modelType === 'nominal' && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-4 text-sm text-sky-100">
              Nominal odds ratios are interpreted relative to the selected reference category.
            </div>
          )}

          {'error' in results ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-slate-400">{results.error}</div>
          ) : (
            <>
              <ExportWrapper fileName="logistic-fit-statistics">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="Rows Used" value={design?.X.length.toString() || '--'} />
                  <Metric label="Log-Likelihood" value={results.type === 'binary' ? fmt(results.fit.ll, 3) : results.type === 'ordinal' ? fmt(results.fits[0].fit.ll, 3) : fmt(results.fits[0].fit.ll, 3)} />
                  <Metric label="AIC" value={results.type === 'binary' ? fmt(results.fit.aic, 2) : results.type === 'ordinal' ? fmt(results.fits.reduce((s: number, f: any) => s + f.fit.aic, 0) / results.fits.length, 2) : fmt(results.fits.reduce((s: number, f: any) => s + f.fit.aic, 0), 2)} />
                  <Metric label="Pseudo R-Sq" value={modelSummary ? `${fmt(modelSummary.pseudoR2 * 100, 1)}%` : '--'} />
                </div>
              </ExportWrapper>

              <ExportWrapper fileName="logistic-coefficients">
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700 font-bold flex items-center gap-2"><ListChecks size={18} className="text-sky-400" /> Coefficients and Odds Ratios</div>
                  {results.type === 'nominal' ? (
                    results.fits.map((fit: any) => <CoefficientTable key={fit.level} title={`${fit.level} vs ${referenceLevel}`} rows={fit.rows} alpha={alpha} />)
                  ) : (
                    <CoefficientTable rows={results.rows} alpha={alpha} />
                  )}
                </div>
              </ExportWrapper>

              {results.type === 'ordinal' && (
                <ExportWrapper fileName="ordinal-cutpoints">
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    <h3 className="font-bold mb-3">Threshold / Cutpoint Estimates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {results.fits.map((fit: any) => <Metric key={fit.cut} label={`Above ${fit.cut}`} value={fmt(fit.fit.beta[0], 4)} />)}
                    </div>
                  </div>
                </ExportWrapper>
              )}

              {confusion && (
                <ExportWrapper fileName="binary-confusion-matrix">
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h3 className="font-bold">Confusion Matrix</h3>
                      <label className="text-xs text-slate-400">Threshold <input type="number" min="0.01" max="0.99" step="0.01" value={thresholdInput} onChange={e => setThresholdInput(e.target.value)} className="ml-2 w-20 bg-slate-900 border border-slate-700 rounded p-1" /></label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Metric label="True Event" value={confusion.tp.toString()} />
                      <Metric label="False Event" value={confusion.fp.toString()} />
                      <Metric label="True Non-Event" value={confusion.tn.toString()} />
                      <Metric label="False Non-Event" value={confusion.fn.toString()} />
                      <Metric label="Accuracy" value={`${fmt(confusion.accuracy * 100, 1)}%`} />
                    </div>
                  </div>
                </ExportWrapper>
              )}

              {probabilityCurve.length > 0 && (
                <ExportWrapper fileName="logistic-probability-curve">
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-sky-400" /> Predicted Probability Curve</h3>
                    {modelSummary && (
                      <div className="mb-4 grid grid-cols-1 xl:grid-cols-4 gap-3">
                        <div className="bg-slate-900/70 border border-slate-700 rounded p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Pseudo R-Squared</div>
                          <div className="text-lg font-mono text-white">{fmt(modelSummary.pseudoR2 * 100, 1)}%</div>
                        </div>
                        <div className="xl:col-span-3 bg-slate-900/70 border border-slate-700 rounded p-3 space-y-2">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Probability Equation</div>
                            <div className="text-sm font-mono text-sky-200 leading-6 break-words">{modelSummary.equation}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Odds Form</div>
                            <div className="text-sm font-mono text-slate-300 leading-6 break-words">{modelSummary.oddsEquation}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="h-[30rem]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={probabilityCurve} margin={{ top: 10, right: 24, bottom: 28, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={fmtTick} label={{ value: firstContinuous?.name || 'Predictor', position: 'insideBottom', offset: -18, fill: '#94a3b8', fontSize: 12 }} />
                          <YAxis domain={[0, 1]} stroke="#94a3b8" tickFormatter={v => `${Math.round(Number(v) * 100)}%`} label={{ value: 'Predicted probability', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip formatter={(v: number) => `${(Number(v) * 100).toFixed(1)}%`} />
                          <Legend />
                          {Object.keys(probabilityCurve[0]).filter(k => k !== 'x').map((key, i) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={['#38bdf8', '#22c55e', '#f59e0b', '#f472b6', '#a78bfa'][i % 5]} dot={false} strokeWidth={3} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </ExportWrapper>
              )}

              {categoryChart.length > 0 && (
                <ExportWrapper fileName="logistic-category-probabilities">
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    <h3 className="font-bold mb-4">Predicted Probability by Category</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="category" stroke="#94a3b8" />
                          <YAxis domain={[0, 1]} stroke="#94a3b8" tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
                          <Tooltip formatter={(v: number) => `${(Number(v) * 100).toFixed(1)}%`} />
                          <Bar dataKey="probability" fill="#38bdf8">
                            {categoryChart.map((_, i) => <Cell key={i} fill={['#38bdf8', '#22c55e', '#f59e0b', '#f472b6'][i % 4]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </ExportWrapper>
              )}

              <ExportWrapper fileName="logistic-predicted-probabilities">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <h3 className="font-bold mb-3">Predicted Probability Table</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-slate-500 border-b border-slate-700"><tr><th className="text-left py-2">Row</th><th className="text-left py-2">Actual</th><th className="text-left py-2">Predicted Probability</th></tr></thead>
                      <tbody>
                        {predictedRows.map(row => <tr key={row.row} className="border-b border-slate-700/40"><td className="py-2">{row.row}</td><td>{row.actual}</td><td>{row.probability === null ? 'See category chart/table' : `${fmt(row.probability * 100, 1)}%`}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ExportWrapper>

              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 text-sm text-slate-300 leading-6">
                <div className="font-bold text-white mb-2">Plain-English Interpretation</div>
                Odds Ratio &gt; 1 means the predictor is associated with higher odds of the event or category. Odds Ratio &lt; 1 means lower odds. For a continuous predictor, an odds ratio of 1.25 means each one-unit increase is associated with a 25% increase in the odds, holding other predictors constant. For a categorical predictor, an odds ratio of 0.60 means that category has 40% lower odds than its reference category, holding other predictors constant.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string; key?: React.Key }) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className="text-xl font-mono text-white mt-1">{value}</div>
    </div>
  );
}

function CoefficientTable({ rows, alpha, title }: { rows: any[]; alpha: number; title?: string; key?: React.Key }) {
  return (
    <div className="overflow-x-auto">
      {title && <div className="px-4 pt-4 text-sm font-bold text-sky-300">{title}</div>}
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500 border-b border-slate-700">
          <tr>
            <th className="text-left p-3">Term</th>
            <th className="text-right p-3">Coef</th>
            <th className="text-right p-3">SE</th>
            <th className="text-right p-3">z</th>
            <th className="text-right p-3">p</th>
            <th className="text-right p-3">Odds Ratio</th>
            <th className="text-right p-3">CI</th>
            <th className="text-left p-3">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.term} className="border-b border-slate-700/40">
              <td className="p-3 font-medium">{row.term}</td>
              <td className="p-3 text-right font-mono">{fmt(row.coeff)}</td>
              <td className="p-3 text-right font-mono">{fmt(row.se)}</td>
              <td className="p-3 text-right font-mono">{fmt(row.z, 3)}</td>
              <td className={`p-3 text-right font-mono ${row.p < alpha ? 'text-emerald-400' : 'text-slate-300'}`}>{row.p < 0.001 ? '< 0.001' : fmt(row.p, 4)}</td>
              <td className="p-3 text-right font-mono">{fmt(row.oddsRatio, 3)}</td>
              <td className="p-3 text-right font-mono">{fmt(row.ciLow, 3)} to {fmt(row.ciHigh, 3)}</td>
              <td className="p-3 text-slate-400 max-w-sm">{interpretOddsRatio(row.term, row.oddsRatio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
