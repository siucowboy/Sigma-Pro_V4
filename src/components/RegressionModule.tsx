import React, { useState, useMemo, useEffect } from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Line, 
  ComposedChart, 
  ReferenceLine,
  Legend,
  Cell,
  Bar,
  BarChart
} from 'recharts';
import * as Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);
import ExportWrapper from './ExportWrapper';
import { runMultipleRegression, generateDynamicHistogram, sampleData } from '../lib/stats';
import { Activity, TrendingUp, Info, Layout, Box, LineChart, BarChart2 } from 'lucide-react';

export default function RegressionModule({ datasets }: { datasets: any[] }) {
  const [responseId, setResponseId] = useState('');
  const [predictorIds, setPredictorIds] = useState<string[]>([]);
  const [plotPredictors, setPlotPredictors] = useState<string[]>([]);
  const [modelType, setModelType] = useState<'linear' | 'quadratic' | 'cubic' | 'exponential'>('linear');

  // --- Calculations ---
  const results = useMemo(() => {
    if (!responseId || predictorIds.length === 0) return null;
    
    const responseDataset = datasets.find(d => d.id === responseId);
    if (!responseDataset) return null;

    const xDatasets = predictorIds.map(id => datasets.find(d => d.id === id)).filter(d => !!d);
    if (xDatasets.length === 0) return null;

    const xNames = xDatasets.map(d => d.name);
    const sourceLengths = [responseDataset.values.length, ...xDatasets.map(d => d.values.length)];
    const n = Math.max(...sourceLengths);
    const completeRows: { y: number, x: number[] }[] = [];

    for (let rowIndex = 0; rowIndex < n; rowIndex++) {
      const y = Number(responseDataset.values[rowIndex]);
      const x = xDatasets.map(d => Number(d.values[rowIndex]));
      if (Number.isFinite(y) && x.every(Number.isFinite)) {
        completeRows.push({ y, x });
      }
    }

    if (completeRows.length < xDatasets.length + 1) {
      console.warn('Not enough complete numeric rows for regression');
      return null;
    }

    const yDataRaw = completeRows.map(row => row.y);
    const xDataMatrix = xDatasets.map((_, predictorIndex) => completeRows.map(row => row.x[predictorIndex]));

    let effectiveY = [...yDataRaw];
    let effectiveXNames = [...xNames];
    let effectiveXMatrix = [...xDataMatrix];

    if (modelType === 'exponential') {
      if (yDataRaw.some(v => v <= 0)) {
          return { error: 'Exponential model requires all Y values to be positive.' };
      }
      effectiveY = yDataRaw.map(v => Math.log(v));
    } else if (modelType === 'quadratic') {
      effectiveXNames = [];
      effectiveXMatrix = [];
      xNames.forEach((name, i) => {
        effectiveXNames.push(name);
        effectiveXMatrix.push(xDataMatrix[i]);
        effectiveXNames.push(`${name}²`);
        effectiveXMatrix.push(xDataMatrix[i].map(v => v * v));
      });
    } else if (modelType === 'cubic') {
      effectiveXNames = [];
      effectiveXMatrix = [];
      xNames.forEach((name, i) => {
        effectiveXNames.push(name);
        effectiveXMatrix.push(xDataMatrix[i]);
        effectiveXNames.push(`${name}²`);
        effectiveXMatrix.push(xDataMatrix[i].map(v => v * v));
        effectiveXNames.push(`${name}³`);
        effectiveXMatrix.push(xDataMatrix[i].map(v => v * v * v));
      });
    }

    const reg = runMultipleRegression(effectiveY, effectiveXMatrix, effectiveXNames);
    if (!reg) return null;

    return { ...reg, modelType };
  }, [responseId, predictorIds, datasets, modelType]);

  const safeResults = results && !('error' in (results as any)) ? (results as any) : null;

  // Sampled Diagnostics for Huge Datasets
  const sampledProbPlot = useMemo(() => sampleData(safeResults?.probPlot || [], 1000), [safeResults?.probPlot]);
  const sampledResiduals = useMemo(() => sampleData(safeResults?.residuals || [], 1000), [safeResults?.residuals]);

  // Sync plotPredictors when predictorIds change
  useEffect(() => {
    if (predictorIds.length > 0) {
      // If we already have some in plotPredictors, keep valid ones. 
      // If none, default to the first one available.
      setPlotPredictors(prev => {
        const stillValid = prev.filter(id => predictorIds.includes(id));
        if (stillValid.length === 0) return [predictorIds[0]];
        return stillValid;
      });
    } else {
      setPlotPredictors([]);
    }
  }, [predictorIds]);

  // Derived results
  const equation = useMemo(() => {
    if (!results) return 'Select Response and Predictors to see Equation';
    if ('error' in (results as any)) return (results as any).error;

    if (modelType === 'exponential') {
      const a = Math.exp(safeResults.coeffs[0].coeff);
      let eq = `Y = ${a.toFixed(4)}`;
      for (let i = 1; i < safeResults.coeffs.length; i++) {
        const c = safeResults.coeffs[i];
        eq += ` * e^(${c.coeff.toFixed(4)} * ${c.term})`;
      }
      return eq;
    }

    const constTerm = safeResults.coeffs[0].coeff;
    let eq = `Y = ${constTerm.toFixed(4)}`;
    for (let i = 1; i < safeResults.coeffs.length; i++) {
        const c = safeResults.coeffs[i];
        eq += ` ${c.coeff >= 0 ? '+' : '-'} ${Math.abs(c.coeff).toFixed(4)}(${c.term})`;
    }
    return eq;
  }, [results, safeResults, modelType]);

  // Histogram Data
  const residualHistogram = useMemo(() => {
    if (!safeResults) return [];
    return generateDynamicHistogram(safeResults.residuals.map((r: any) => r.value));
  }, [safeResults]);

  const togglePredictor = (id: string) => {
    if (id === responseId) return;
    setPredictorIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      return [...prev, id];
    });
  };

  const togglePlotPredictor = (id: string) => {
    setPlotPredictors(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      return [...prev, id];
    });
  };

  const responseDataset = datasets.find(d => d.id === responseId);

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Regression Analysis</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Config */}
        <div className="col-span-1 space-y-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent flex items-center gap-2">
              <Activity size={16} /> Model Variables
            </h3>
            
            <label className="block text-xs text-slate-400 mb-1">Response Variable (Y)</label>
            <select 
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4 focus:ring-1 focus:ring-sky-500 outline-none" 
              value={responseId} 
              onChange={e => {
                setResponseId(e.target.value);
                setPredictorIds([]); 
              }}
            >
              <option value="">Select Response...</option>
              {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <label className="block text-xs text-slate-400 mb-1">Model Type</label>
            <select 
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4 focus:ring-1 focus:ring-sky-500 outline-none" 
              value={modelType} 
              onChange={e => setModelType(e.target.value as any)}
            >
              <option value="linear">Linear</option>
              <option value="quadratic">Quadratic</option>
              <option value="cubic">Cubic</option>
              <option value="exponential">Exponential</option>
            </select>

            <label className="block text-xs text-slate-400 mb-1">Predictor Variables (X)</label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
              {datasets.filter(d => d.id !== responseId).map(d => (
                <button 
                  type="button"
                  key={`pred-row-${d.id}`} 
                  onClick={() => togglePredictor(d.id)}
                  className={`flex items-center space-x-3 text-sm p-3 rounded border transition-all cursor-pointer w-full text-left ${predictorIds.includes(d.id) ? 'bg-sky-900/40 border-sky-500 shadow-sm' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors pointer-events-none ${predictorIds.includes(d.id) ? 'bg-sky-500 border-sky-500' : 'bg-slate-800 border-slate-600'}`}>
                    {predictorIds.includes(d.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <span className="truncate flex-1 font-medium pointer-events-none">{d.name}</span>
                  {!d.isNumeric && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1 rounded uppercase font-bold tracking-tighter pointer-events-none">Cat</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output & Diagnostics */}
        <div className="col-span-1 lg:col-span-3 space-y-6 text-slate-100">
          
          {/* Consolidated Statistics Block (Moved UP) */}
          <ExportWrapper fileName="regression-results-consolidated">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-700 bg-slate-800/50">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Layout size={20} className="text-sky-400" /> Model Statistics
                </h3>
                <div className="mt-4 bg-slate-900 p-6 rounded border border-slate-700 text-center font-mono text-lg text-sky-400 shadow-inner">
                  {results?.error ? <span className="text-red-400">{results.error}</span> : equation}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-700/50 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">R-Sq (Adj)</div>
                    <div className="text-xl font-mono text-white mt-1">{safeResults ? (safeResults.rSqAdj * 100).toFixed(2) : '--'}%</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-700/50 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">R-Sq</div>
                    <div className="text-xl font-mono text-white mt-1">{safeResults ? (safeResults.rSq * 100).toFixed(2) : '--'}%</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-700/50 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">S (Error)</div>
                    <div className="text-xl font-mono text-white mt-1">{safeResults ? safeResults.s.toFixed(4) : '--'}</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-700/50 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Model P-Val</div>
                    <div className={`text-xl font-mono mt-1 ${safeResults && safeResults.anova.model.p < 0.05 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {safeResults ? (safeResults.anova.model.p < 0.001 ? '< 0.001' : safeResults.anova.model.p.toFixed(4)) : '--'}
                    </div>
                  </div>
                </div>
              </div>

              {results && !results.error && (
                <div className="p-6 space-y-8 bg-slate-800">
                  {/* Parameter Estimates */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Parameter Estimates</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-slate-300 font-mono">
                        <thead className="bg-slate-900/50 text-slate-400">
                          <tr>
                            <th className="p-2 text-left">Term</th>
                            <th className="p-2 text-right">Coefficient</th>
                            <th className="p-2 text-right">SE Coeff</th>
                            <th className="p-2 text-right">T-Value</th>
                            <th className="p-2 text-right">P-Value</th>
                            <th className="p-2 text-right">VIF</th>
                            <th className="p-2 text-right">Tolerance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {safeResults.coeffs.map((c: any, i: number) => (
                            <tr key={`coeff-${i}`} className="hover:bg-slate-700/30">
                              <td className="p-2 font-bold text-sky-400">{c.term}</td>
                              <td className="p-2 text-right">{c.coeff.toFixed(6)}</td>
                              <td className="p-2 text-right">{c.se.toFixed(6)}</td>
                              <td className="p-2 text-right">{c.t.toFixed(2)}</td>
                              <td className={`p-2 text-right ${c.p < 0.05 ? 'text-emerald-400 font-bold' : ''}`}>
                                  {c.p < 0.001 ? '< 0.001' : c.p.toFixed(4)}
                              </td>
                              <td className="p-2 text-right">{c.vif ? c.vif.toFixed(3) : '--'}</td>
                              <td className="p-2 text-right">{c.tolerance ? c.tolerance.toFixed(3) : '--'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ANOVA */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Analysis of Variance</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-slate-300 font-mono">
                        <thead className="bg-slate-900/50 text-slate-400">
                          <tr>
                            <th className="p-2 text-left">Source</th>
                            <th className="p-2 text-right">DF</th>
                            <th className="p-2 text-right">SS</th>
                            <th className="p-2 text-right">MS</th>
                            <th className="p-2 text-right">F</th>
                            <th className="p-2 text-right">P</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          <tr className="hover:bg-slate-700/30">
                            <td className="p-2 font-bold text-sky-400">Model</td>
                            <td className="p-2 text-right">{safeResults.anova.model.df}</td>
                            <td className="p-2 text-right">{safeResults.anova.model.ss.toFixed(4)}</td>
                            <td className="p-2 text-right">{safeResults.anova.model.ms.toFixed(4)}</td>
                            <td className="p-2 text-right">{safeResults.anova.model.f.toFixed(2)}</td>
                            <td className="p-2 text-right">{safeResults.anova.model.p < 0.001 ? '< 0.001' : safeResults.anova.model.p.toFixed(4)}</td>
                          </tr>
                          <tr className="hover:bg-slate-700/30">
                            <td className="p-2 font-bold text-slate-500">Error</td>
                            <td className="p-2 text-right">{safeResults.anova.error.df}</td>
                            <td className="p-2 text-right">{safeResults.anova.error.ss.toFixed(4)}</td>
                            <td className="p-2 text-right">{safeResults.anova.error.ms.toFixed(4)}</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right"></td>
                          </tr>
                          <tr className="bg-slate-900/30">
                            <td className="p-2 font-bold">Total</td>
                            <td className="p-2 text-right">{safeResults.anova.total.df}</td>
                            <td className="p-2 text-right">{safeResults.anova.total.ss.toFixed(4)}</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Durbin Watson */}
                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded border border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded">
                                <Info size={16} className="text-amber-500" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Durbin-Watson Statistic</div>
                                <div className="text-lg font-mono text-amber-400 font-bold">{safeResults.dw.toFixed(3)}</div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-right max-w-[200px] italic">
                            A value near 2.0 indicates no autocorrelation in residuals.
                        </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ExportWrapper>

          {/* Fitted Line Plot Section */}
          {results && responseDataset && (
            <ExportWrapper fileName="fitted-line-plot">
              <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    {plotPredictors.length === 2 ? <Box size={18} className="text-pink-400" /> : <LineChart size={18} className="text-sky-400" />}
                    {plotPredictors.length === 2 
                      ? '3D Surface Projection' 
                      : plotPredictors.length === 1 
                        ? `Fitted Line Plot: ${datasets.find(d => d.id === plotPredictors[0])?.name}` 
                        : 'Visualizations (Select 1 or 2 predictors)'}
                  </h3>
                  
                  <div className="flex flex-wrap gap-2">
                    {predictorIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 bg-slate-900 rounded p-1 border border-slate-700">
                        {predictorIds.map(id => (
                          <button 
                            key={`toggle-${id}`} 
                            onClick={() => togglePlotPredictor(id)}
                            className={`px-3 py-1 rounded text-[10px] font-mono transition-all ${plotPredictors.includes(id) ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            {datasets.find(d => d.id === id)?.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[500px] relative">
                  {results && !results.error && (
                    <div className="absolute top-4 right-4 bg-slate-900/90 p-3 rounded border border-slate-700 text-[11px] font-mono z-10 shadow-xl max-w-[250px] pointer-events-none">
                      <div className="text-sky-400 font-bold mb-2 break-words border-b border-slate-700 pb-2">
                        {equation}
                      </div>
                      <div className="flex justify-between gap-4 text-slate-300">
                        {predictorIds.length >= 3 ? (
                          <>
                            <span className="text-slate-500 uppercase text-[9px] font-bold">Adj R-Sq</span>
                            <span className="text-emerald-400 font-bold">{(safeResults.rSqAdj * 100).toFixed(2)}%</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500 uppercase text-[9px] font-bold">R-Sq</span>
                            <span className="text-emerald-400 font-bold">{(safeResults.rSq * 100).toFixed(2)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {results?.error ? (
                    <div className="flex items-center justify-center h-full text-red-400 text-sm italic">
                      {results.error}
                    </div>
                  ) : plotPredictors.length > 2 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-900/20 px-8 text-center">
                      <TrendingUp size={48} className="mb-4 opacity-20" />
                      <p className="text-sm">Direct visualization is limited to 1 or 2 predictors at a time.</p>
                      <p className="text-xs text-slate-600 mt-2">Deselect some predictors below to see a {plotPredictors.length === 3 ? '3D' : '2D'} plot.</p>
                    </div>
                  ) : plotPredictors.length === 2 ? (
                    <Plot
                      data={[
                        {
                          x: datasets.find(d => d.id === plotPredictors[0])?.values.map(Number),
                          y: datasets.find(d => d.id === plotPredictors[1])?.values.map(Number),
                          z: responseDataset.values.map(Number),
                          type: 'scatter3d',
                          mode: 'markers',
                          marker: { 
                            size: 6, 
                            color: '#38bdf8', 
                            opacity: 0.9, 
                            line: { width: 1, color: '#000' } 
                          }
                        }
                      ]}
                      layout={{
                        autosize: true,
                        margin: { l: 0, r: 0, b: 0, t: 0 },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        scene: {
                          xaxis: { title: { text: datasets.find(d => d.id === plotPredictors[0])?.name || 'X1', font: { color: '#94a3b8' } }, gridcolor: '#334155', tickcolor: '#475569', color: '#94a3b8' },
                          yaxis: { title: { text: datasets.find(d => d.id === plotPredictors[1])?.name || 'X2', font: { color: '#94a3b8' } }, gridcolor: '#334155', tickcolor: '#475569', color: '#94a3b8' },
                          zaxis: { title: { text: responseDataset.name || 'Y', font: { color: '#94a3b8' } }, gridcolor: '#334155', tickcolor: '#475569', color: '#94a3b8' },
                          bgcolor: 'rgba(15, 23, 42, 0.5)'
                        }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : plotPredictors.length === 1 ? (
                    (() => {
                        const currentX = datasets.find(d => d.id === plotPredictors[0]);
                        if (!currentX || !safeResults || results.error) return null;
                        
                        // For visualization with multiple predictors, we hold other predictors at their mean.
                        // We find all terms in 'results.coeffs' that correspond to 'plotPredictors[0]' (including its powers)
                        // and all other terms.
                        
                        const coeffsMap = new Map();
                        safeResults.coeffs.forEach((c: any) => coeffsMap.set(c.term, c.coeff));

                        const xNums = currentX.values.map(Number);
                        const minX = xNums.reduce((a, b) => Math.min(a, b), xNums[0]);
                        const maxX = xNums.reduce((a, b) => Math.max(a, b), xNums[0]);

                        const range = maxX - minX;
                        const plotPoints = [];
                        const steps = 100;
                        
                        // Calculate base offset from other variables held at mean
                        let baseOffset = coeffsMap.get('Constant') || 0;
                        predictorIds.forEach(id => {
                          if (id !== currentX.id) {
                            const ds = datasets.find(d => d.id === id);
                            if (ds) {
                              const values = ds.values.map(Number);
                              const mean = values.reduce((a, b) => a + b, 0) / values.length;
                              baseOffset += (coeffsMap.get(ds.name) || 0) * mean;
                              if (modelType === 'quadratic') baseOffset += (coeffsMap.get(`${ds.name}²`) || 0) * mean * mean;
                              if (modelType === 'cubic') {
                                baseOffset += (coeffsMap.get(`${ds.name}²`) || 0) * mean * mean;
                                baseOffset += (coeffsMap.get(`${ds.name}³`) || 0) * mean * mean * mean;
                              }
                            }
                          }
                        });

                        for (let i = 0; i <= steps; i++) {
                          const x = minX + (range * i) / steps;
                          let y;
                          
                          if (modelType === 'exponential') {
                            const a = Math.exp(baseOffset);
                            const b = coeffsMap.get(currentX.name) || 0;
                            y = a * Math.exp(b * x);
                          } else {
                            y = baseOffset;
                            y += (coeffsMap.get(currentX.name) || 0) * x;
                            if (modelType === 'quadratic' || modelType === 'cubic') {
                                y += (coeffsMap.get(`${currentX.name}²`) || 0) * x * x;
                            }
                            if (modelType === 'cubic') {
                                y += (coeffsMap.get(`${currentX.name}³`) || 0) * x * x * x;
                            }
                          }
                          plotPoints.push({ xValue: x, yTrend: y });
                        }

                        return (
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart 
                                data={sampleData(currentX.values.map((v: any, i: number) => ({
                                    xValue: Number(v),
                                    yValue: Number(responseDataset.values[i])
                                })), 1000)}
                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" dataKey="xValue" name={currentX.name} stroke="#94a3b8" domain={['auto', 'auto']} />
                                <YAxis type="number" dataKey="yValue" name={responseDataset.name} stroke="#94a3b8" domain={['auto', 'auto']} />
                                <RechartsTooltip 
                                  cursor={{ strokeDasharray: '3 3' }}
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} 
                                />
                                <Scatter name="Observed Data" dataKey="yValue" fill="#38bdf8" />
                                <Line 
                                  name="Fitted Model"
                                  data={plotPoints}
                                  type="monotone" 
                                  dataKey="yTrend" 
                                  stroke="#ef4444" 
                                  dot={false} 
                                  strokeWidth={2}
                                  isAnimationActive={false}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                        );
                    })()
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-900/20">
                      <p>Select 1 or 2 predictors from the toggle buttons above to visualize fitting</p>
                    </div>
                  )}
                </div>
              </div>
            </ExportWrapper>
          )}

          {/* Residual Diagnostics */}
          {results && !results.error && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <BarChart2 size={18} className="text-slate-400" /> 4-in-1 Residual Diagnostics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto">
                
                {/* Normal Probability Plot */}
                <ExportWrapper fileName="residuals-normal-plot">
                  <div className="border border-slate-700/50 rounded-lg p-4 h-[300px] bg-slate-900/30">
                    <div className="text-[10px] text-center text-slate-500 mb-4 uppercase font-bold tracking-widest">Normal Probability Plot</div>
                    <ResponsiveContainer width="100%" height="85%">
                      <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" dataKey="theoretical" name="Theoretical Quantile" stroke="#475569" domain={['auto', 'auto']} label={{ value: 'Theoretical', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#475569' }} />
                        <YAxis type="number" dataKey="observed" name="Residual" stroke="#475569" domain={['auto', 'auto']} label={{ value: 'Residual', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#475569' }} />
                        <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px' }} />
                        <Scatter data={sampledProbPlot} name="Residuals" fill="#38bdf8" />
                        <ReferenceLine 
                          segment={[
                            { 
                              x: safeResults.probPlot.reduce((a: number, b: any) => Math.min(a, b.theoretical), (safeResults.probPlot[0] as any).theoretical), 
                              y: safeResults.probPlot.reduce((a: number, b: any) => Math.min(a, b.theoretical), (safeResults.probPlot[0] as any).theoretical) * safeResults.s 
                            },
                            { 
                              x: safeResults.probPlot.reduce((a: number, b: any) => Math.max(a, b.theoretical), (safeResults.probPlot[0] as any).theoretical), 
                              y: safeResults.probPlot.reduce((a: number, b: any) => Math.max(a, b.theoretical), (safeResults.probPlot[0] as any).theoretical) * safeResults.s 
                            }
                          ]}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </ExportWrapper>

                {/* Versus Fits */}
                <ExportWrapper fileName="residuals-vs-fits">
                  <div className="border border-slate-700/50 rounded-lg p-4 h-[300px] bg-slate-900/30">
                    <div className="text-[10px] text-center text-slate-500 mb-4 uppercase font-bold tracking-widest">Versus Fits</div>
                    <ResponsiveContainer width="100%" height="85%">
                      <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="fitted" type="number" name="Fitted Value" stroke="#475569" domain={['auto', 'auto']} label={{ value: 'Fitted Value', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#475569' }} />
                        <YAxis dataKey="value" type="number" name="Residual" stroke="#475569" domain={['auto', 'auto']} label={{ value: 'Residual', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#475569' }} />
                        <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px' }} />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                        <Scatter data={sampledResiduals} fill="#fb7185" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </ExportWrapper>
                
                {/* Histogram */}
                <ExportWrapper fileName="residuals-histogram">
                  <div className="border border-slate-700/50 rounded-lg p-4 h-[300px] bg-slate-900/30">
                    <div className="text-[10px] text-center text-slate-500 mb-4 uppercase font-bold tracking-widest">Residual Histogram</div>
                    <ResponsiveContainer width="100%" height="85%">
                      <BarChart 
                        data={residualHistogram.map(h => ({ residualValue: h.x, frequency: h.count }))} 
                        margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="residualValue" type="number" domain={['auto', 'auto']} stroke="#475569" label={{ value: 'Residual', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#475569' }} tickFormatter={(v) => v.toFixed(2)} />
                        <YAxis stroke="#475569" label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#475569' }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px' }} />
                        <Bar dataKey="frequency" fill="#fbbf24" barSize={40} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ExportWrapper>

                {/* Versus Order */}
                <ExportWrapper fileName="residuals-vs-order">
                  <div className="border border-slate-700/50 rounded-lg p-4 h-[300px] bg-slate-900/30">
                    <div className="text-[10px] text-center text-slate-500 mb-4 uppercase font-bold tracking-widest">Versus Order</div>
                    <ResponsiveContainer width="100%" height="85%">
                      <ComposedChart 
                        data={sampleData(safeResults.residuals.map((r: any) => ({ obsOrder: r.order, resid: r.value })), 1000)} 
                        margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="obsOrder" type="number" stroke="#475569" label={{ value: 'Observation Order', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#475569' }} />
                        <YAxis dataKey="resid" type="number" stroke="#475569" domain={['auto', 'auto']} label={{ value: 'Residual', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#475569' }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px' }} />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                        <Line 
                          type="monotone" 
                          dataKey="resid" 
                          stroke="#94a3b8" 
                          strokeWidth={1} 
                          dot={{ r: 4, fill: '#38bdf8', stroke: '#1e293b', strokeWidth: 1 }} 
                          isAnimationActive={false} 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </ExportWrapper>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
