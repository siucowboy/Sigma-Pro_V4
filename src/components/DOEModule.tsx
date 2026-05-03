import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ReferenceLine, ResponsiveContainer, Cell, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  Plus, Trash2, RefreshCw, Layers, Grid, BarChart2, 
  Layout, Settings2, Info, ArrowRightLeft, Percent, Eye, EyeOff
} from 'lucide-react';
import * as jStatModule from 'jstat';
const jStat: any = (jStatModule as any).default?.jStat || (jStatModule as any).jStat || (jStatModule as any).default || jStatModule;
import ExportWrapper from './ExportWrapper';
import { generateFactorialDesign, analyzeDOE, getMean, getUncodedCoefficients } from '../lib/stats';

export default function DOEModule({ datasets }: { datasets: any[] }) {
  // --- State ---
  const [factors, setFactors] = useState([
    { id: 1, name: 'A', low: -1, high: 1 },
    { id: 2, name: 'B', low: -1, high: 1 }
  ]);
  const [replicates, setReplicates] = useState(1);
  const [blocks, setBlocks] = useState(1);
  const [responseId, setResponseId] = useState('');
  const [alpha, setAlpha] = useState(0.05);
  const [isRandomOrder, setIsRandomOrder] = useState(false);
  const [displayCoded, setDisplayCoded] = useState(false);
  const [displayUnits, setDisplayUnits] = useState<'coded' | 'uncoded'>('coded');
  const [activeTab, setActiveTab] = useState<'design' | 'analysis' | 'plots' | 'residuals'>('design');
  const [visibleMainEffects, setVisibleMainEffects] = useState<string[]>([]);

  // Helper to generate all terms
  const getAllPossibleTerms = (factorNames: string[]) => {
    const all = [];
    const n = factorNames.length;
    for (let i = 1; i < (1 << n); i++) {
      const combo = [];
      for (let j = 0; j < n; j++) {
        if ((i >> j) & 1) combo.push(factorNames[j]);
      }
      if (combo.length > 0) all.push(combo.join('*'));
    }
    
    // Ordered: complexity (main effects first), then alphabetical
    return all.sort((a, b) => {
      const complexityA = a.split('*').length;
      const complexityB = b.split('*').length;
      if (complexityA !== complexityB) return complexityA - complexityB;
      return a.localeCompare(b);
    });
  };

  useEffect(() => {
    setVisibleMainEffects(factors.map(f => f.name));
  }, [factors]);

  // Model Terms State (default to all available terms)
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);

  // Sync selected terms when factors change
  const allAvailableTerms = useMemo(() => getAllPossibleTerms(factors.map(f => f.name)), [factors]);
  const selectedInteractionTerms = useMemo(
    () => selectedTerms.filter(term => term.includes('*')),
    [selectedTerms]
  );

  const getInteractionValue = (run: any, term: string) => {
    return term
      .split('*')
      .reduce((acc, factorName) => acc * Number(run[`${factorName}_coded`] ?? 1), 1);
  };

  // If selectedTerms is empty (initial state), select all. Also reset if available terms change.
  const prevSelectedTermsRef = useRef<string[]>([]);
  useEffect(() => {
    const newlyRemoved = prevSelectedTermsRef.current.filter(t => !selectedTerms.includes(t));
    if (newlyRemoved.length > 0) {
      setVisibleMainEffects(prev => prev.filter(v => !newlyRemoved.includes(v)));
    }
    
    const newlyAdded = selectedTerms.filter(t => !prevSelectedTermsRef.current.includes(t));
    if (newlyAdded.length > 0) {
      const addedMainEffects = newlyAdded.filter(t => !t.includes('*'));
      if (addedMainEffects.length > 0) {
        setVisibleMainEffects(prev => [...new Set([...prev, ...addedMainEffects])]);
      }
    }
    
    prevSelectedTermsRef.current = selectedTerms;
  }, [selectedTerms]);

  useEffect(() => {
    setSelectedTerms(allAvailableTerms);
  }, [allAvailableTerms]);
  
  const handleResetTerms = () => {
    setSelectedTerms(allAvailableTerms);
  };

  // --- Design Generation ---
  const designMatrix = useMemo(() => {
    const baseDesign = generateFactorialDesign(factors, replicates, blocks);
    if (isRandomOrder) {
      return [...baseDesign].sort(() => Math.random() - 0.5);
    }
    return baseDesign;
  }, [factors, replicates, blocks, isRandomOrder]);

  // --- Derived Data ---
  const responseDataset = datasets.find(d => d.id === responseId);
  const canAnalyze = responseDataset && responseDataset.values.length >= designMatrix.length;

  const analysisResults = useMemo(() => {
    if (!canAnalyze || !responseDataset) return null;
    
    // ALIGNMENT: Map response values to the visible table row index (Run Order)
    const dataWithResponse = designMatrix.map((run, i) => {
      const val = Number(responseDataset.values[i]);
      return {
        ...run,
        Response: isNaN(val) ? null : val
      };
    }).filter(d => d.Response !== null);

    if (dataWithResponse.length === 0) return null;

    const factorNames = factors.map(f => f.name);
    try {
      const res = analyzeDOE(dataWithResponse, 'Response', factorNames, selectedTerms);
      
      if (displayUnits === 'uncoded') {
        const uncodedCoeffs = getUncodedCoefficients(res, factors);
        return { ...res, coeffs: uncodedCoeffs };
      }
      
      return { ...res };
    } catch (e) {
      console.error("DOE Analysis Error:", e);
      return null;
    }
  }, [canAnalyze, designMatrix, responseDataset, responseDataset?.values, selectedTerms, factors, displayUnits]);

  // --- Plots Data ---
  const dataWithResponseMapped = useMemo(() => {
    if (!canAnalyze || !responseDataset) return [];
    return designMatrix.map((run, i) => ({
      ...run,
      Response: Number(responseDataset.values[i])
    })).filter(d => !isNaN(d.Response));
  }, [canAnalyze, designMatrix, responseDataset]);

  const mainEffectsData = useMemo(() => {
    if (dataWithResponseMapped.length === 0) return [];
    
    return factors.map(f => {
      const lowGroup = dataWithResponseMapped.filter(d => d[`${f.name}_coded`] === -1);
      const highGroup = dataWithResponseMapped.filter(d => d[`${f.name}_coded`] === 1);
      
      const lowMean = lowGroup.length > 0 ? getMean(lowGroup.map(d => d.Response)) : 0;
      const highMean = highGroup.length > 0 ? getMean(highGroup.map(d => d.Response)) : 0;

      return {
        factor: f.name,
        low: lowMean,
        high: highMean,
        effect: highMean - lowMean
      };
    });
  }, [dataWithResponseMapped, factors]);

  const interactionData = useMemo(() => {
    if (dataWithResponseMapped.length === 0 || factors.length < 2) return [];

    // For first pair of factors
    const f1 = factors[0].name;
    const f2 = factors[1].name;

    const lowLow = dataWithResponseMapped.filter(d => d[`${f1}_coded`] === -1 && d[`${f2}_coded`] === -1);
    const lowHigh = dataWithResponseMapped.filter(d => d[`${f1}_coded`] === 1 && d[`${f2}_coded`] === -1);
    const highLow = dataWithResponseMapped.filter(d => d[`${f1}_coded`] === -1 && d[`${f2}_coded`] === 1);
    const highHigh = dataWithResponseMapped.filter(d => d[`${f1}_coded`] === 1 && d[`${f2}_coded`] === 1);

    const pairs = [
      { f2Value: 'Low (-1)', f1Low: lowLow.length > 0 ? getMean(lowLow.map(d => d.Response)) : 0, f1High: lowHigh.length > 0 ? getMean(lowHigh.map(d => d.Response)) : 0 },
      { f2Value: 'High (+1)', f1Low: highLow.length > 0 ? getMean(highLow.map(d => d.Response)) : 0, f1High: highHigh.length > 0 ? getMean(highHigh.map(d => d.Response)) : 0 }
    ];

    return pairs.map(p => ({
        f2Value: p.f2Value,
        data: [
            { x: -1, y: p.f1Low },
            { x: 1, y: p.f1High }
        ]
    }));
  }, [dataWithResponseMapped, factors]);

  // --- Handlers ---
  const addFactor = () => {
    if (factors.length >= 7) return; 
    setFactors([...factors, { id: Date.now(), name: String.fromCharCode(65 + factors.length), low: -1, high: 1 }]);
  };

  const removeFactor = (id: number) => {
    if (factors.length <= 2) return;
    setFactors(factors.filter(f => f.id !== id));
  };

  const toggleTerm = (term: string) => {
    setSelectedTerms(prev => {
      const exists = prev.includes(term);
      if (exists) {
        // If it's a main effect being removed, also remove all terms containing it
        if (!term.includes('*')) {
          return prev.filter(t => !t.split('*').includes(term));
        }
        return prev.filter(t => t !== term);
      } else {
        return [...prev, term];
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">2^k Factorial Design</h2>
            <p className="text-xs text-slate-500">Analyze interactions and optimize process response</p>
          </div>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('design')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${activeTab === 'design' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Grid className="w-4 h-4" /> Design
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <BarChart2 className="w-4 h-4" /> Analysis
          </button>
          <button 
            onClick={() => setActiveTab('plots')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${activeTab === 'plots' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Layout className="w-4 h-4" /> Plots
          </button>
          <button 
            onClick={() => setActiveTab('residuals')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-2 ${activeTab === 'residuals' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Percent className="w-4 h-4" /> Residuals
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Configuration */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800 p-4 gap-6 flex flex-col overflow-y-auto">
          
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Plus className="w-3 h-3" /> Alpha & Units
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Alpha (α)</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                  value={alpha}
                  onChange={e => setAlpha(Number(e.target.value))}
                >
                  <option value={0.01}>0.01</option>
                  <option value={0.05}>0.05</option>
                  <option value={0.10}>0.10</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Units</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                  value={displayUnits}
                  onChange={e => setDisplayUnits(e.target.value as any)}
                >
                  <option value="coded">Coded</option>
                  <option value="uncoded">Uncoded</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> Factor Settings
            </h3>
            <div className="space-y-2">
              {factors.map((f, i) => (
                <div key={f.id} className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 group">
                   <div className="flex items-center justify-between mb-2">
                      <input 
                        className="bg-transparent text-sm font-bold w-full focus:outline-none text-indigo-300"
                        value={f.name}
                        onChange={e => {
                          const newFactors = [...factors];
                          newFactors[i].name = e.target.value.toUpperCase().slice(0, 20);
                          setFactors(newFactors);
                        }}
                      />
                      <button 
                        onClick={() => removeFactor(f.id)}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                   </div>
                   <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block">Low (-1)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-900 text-xs p-1.5 rounded border border-slate-700" 
                          value={f.low}
                          onChange={e => {
                            const newFactors = [...factors];
                            newFactors[i].low = Number(e.target.value);
                            setFactors(newFactors);
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block">High (+1)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-900 text-xs p-1.5 rounded border border-slate-700" 
                          value={f.high}
                          onChange={e => {
                            const newFactors = [...factors];
                            newFactors[i].high = Number(e.target.value);
                            setFactors(newFactors);
                          }}
                        />
                      </div>
                   </div>
                </div>
              ))}
              <button 
                onClick={addFactor}
                disabled={factors.length >= 7}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs rounded-lg border border-slate-700 border-dashed flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> Add Factor
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Replicates & Blocks
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Replicates</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                  value={replicates}
                  onChange={e => setReplicates(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Blocks</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                  value={blocks}
                  onChange={e => setBlocks(Number(e.target.value))}
                >
                  {[1, 2, 4].filter(v => Math.pow(2, factors.length) % v === 0).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-3 h-3" /> Response Data
            </h3>
            <div className="space-y-3">
              <select 
                className="w-full bg-slate-800 border border-indigo-500/50 rounded p-2 text-sm text-white"
                value={responseId}
                onChange={e => setResponseId(e.target.value)}
              >
                <option value="">Select Response (Y)...</option>
                {datasets.filter(d => d.isNumeric).map(d => {
                  const isMatch = d.values.length === designMatrix.length;
                  return (
                    <option 
                      key={d.id} 
                      value={d.id} 
                      className={isMatch ? "text-indigo-400 font-bold bg-slate-900" : "text-slate-500"}
                      style={{ color: isMatch ? '#818cf8' : '#64748b' }}
                    >
                      {isMatch ? '★ ' : ''}{d.name} ({d.values.length} rows)
                    </option>
                  );
                })}
              </select>
              <div className="bg-slate-800/50 p-2 rounded text-[10px] text-slate-400 border border-slate-700 flex items-start gap-2 italic">
                <Info className="w-3 h-3 shrink-0" />
                Response values must match the design row count ({designMatrix.length} runs).
              </div>
            </div>
          </section>

          <section>
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 Model Refinement
               </h3>
               <button 
                onClick={handleResetTerms}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
               >
                 SELECT ALL
               </button>
             </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {allAvailableTerms.map(term => (
                <label key={term} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded transition-colors cursor-pointer group">
                  <input 
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={selectedTerms.includes(term)}
                    onChange={() => toggleTerm(term)}
                  />
                  <span className="text-xs text-slate-300 group-hover:text-white">
                    {term.includes('*') ? term.split('*').join(' × ') : term}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
          
          {activeTab === 'design' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Generated Design Matrix</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">2^{factors.length} Factorial • {replicates} Reps • {designMatrix.length} Total Runs</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                        const headers = [
                            'Std Ord',
                            'Run Ord',
                            'Block',
                            ...factors.map(f => f.name),
                            ...selectedInteractionTerms,
                            'Response'
                        ];
                        const rows = designMatrix.map((run, i) => [
                            run.stdOrder,
                            i + 1,
                            run.block,
                            ...factors.map(f => displayCoded ? run[`${f.name}_coded`] : run[f.name]),
                            ...selectedInteractionTerms.map(term => getInteractionValue(run, term)),
                            responseDataset && responseDataset.values[i] !== undefined ? responseDataset.values[i] : ''
                        ]);
                        const tsv = [headers, ...rows].map(row => row.join('\t')).join('\n');
                        navigator.clipboard.writeText(tsv);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-2"
                  >
                    Copy to Excel
                  </button>
                  <button 
                    onClick={() => setIsRandomOrder(!isRandomOrder)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-colors ${isRandomOrder ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                  >
                    {isRandomOrder ? 'Random Order' : 'Standard Order'}
                  </button>
                  <button 
                     onClick={() => setDisplayCoded(!displayCoded)}
                     className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-colors ${displayCoded ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                   >
                    {displayCoded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {displayCoded ? 'Coded (-1/1)' : 'Uncoded (Actual)'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-2xl bg-slate-900/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800">
                      <th className="p-3 font-bold">Std Ord</th>
                      <th className="p-3 font-bold">Run Ord</th>
                      <th className="p-3 font-bold">Block</th>
                      {factors.map(f => (
                        <th key={f.name} className="p-3 font-bold text-indigo-400">{f.name}</th>
                      ))}
                      {selectedInteractionTerms.map(term => (
                        <th key={term} className="p-3 font-bold text-amber-400">{term}</th>
                      ))}
                      <th className="p-3 font-bold text-emerald-400">Response (Y)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designMatrix.map((run, i) => (
                      <tr key={run.stdOrder} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-xs font-mono text-slate-400">{run.stdOrder}</td>
                        <td className="p-3 text-xs font-mono text-slate-600 font-bold">{i + 1}</td>
                        <td className="p-3 text-xs font-mono text-slate-400">{run.block}</td>
                        {factors.map(f => (
                          <td key={f.name} className={`p-3 text-xs font-mono font-medium ${displayCoded ? (run[`${f.name}_coded`] === 1 ? 'text-indigo-400' : 'text-slate-500') : 'text-white'}`}>
                            {displayCoded ? run[`${f.name}_coded`] : run[f.name]}
                          </td>
                        ))}
                        {selectedInteractionTerms.map(term => (
                          <td key={term} className="p-3 text-xs font-mono text-amber-400">
                            {getInteractionValue(run, term)}
                          </td>
                        ))}
                        <td className="p-3 text-xs font-mono text-emerald-400">
                          {responseDataset && responseDataset.values[i] !== undefined 
                            ? Number(responseDataset.values[i]).toFixed(3)
                            : <span className="text-slate-700">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6">
               {(!canAnalyze || !analysisResults) ? (
                 <div className="bg-slate-900/50 border border-slate-800 rounded-2xl h-80 flex flex-col items-center justify-center p-10 text-center">
                    <div className="p-4 bg-slate-800 rounded-full mb-4">
                      <BarChart2 className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-2">Analysis Results Unavailable</h3>
                    <p className="text-slate-500 text-sm max-w-xs">{!canAnalyze ? `Select a response dataset with at least ${designMatrix.length} measurements to generate the Pareto chart and ANOVA.` : "The model could not be calculated (singular matrix or insufficient variation)."}</p>
                 </div>
               ) : (
                 <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">R-Squared</div>
                      <div className="text-2xl font-mono text-white">{(analysisResults?.rSq * 100 || 0).toFixed(2)}%</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Std Error (S)</div>
                      <div className="text-2xl font-mono text-indigo-400">{(analysisResults?.s || 0).toFixed(4)}</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Model P-Value</div>
                      <div className={`text-2xl font-mono ${analysisResults?.anova?.model?.p < alpha ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {(analysisResults?.anova?.model?.p || 0).toFixed(4)}
                      </div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Durbin-Watson</div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className={`text-2xl font-mono shrink-0 ${(() => {
                          const dw = analysisResults?.dw || 0;
                          const diff = Math.abs(dw - 2);
                          if (diff < 0.4) return 'text-emerald-400';
                          if (diff < 1.0) return 'text-amber-400';
                          return 'text-red-500';
                        })()}`}>
                          {(analysisResults?.dw || 0).toFixed(2)}
                        </div>
                        <div className="flex-1 h-3 bg-slate-800 rounded-sm relative overflow-visible border border-slate-700/50 flex">
                          <div className="w-[20%] h-full bg-red-600/80 border-r border-black/20" title="0.0 - 0.8 (Positive Correlation)"></div>
                          <div className="w-[20%] h-full bg-amber-500/80 border-r border-black/20" title="0.8 - 1.6"></div>
                          <div className="w-[20%] h-full bg-emerald-600/80 border-r border-black/20" title="1.6 - 2.4 (No Autocorrelation)"></div>
                          <div className="w-[20%] h-full bg-amber-500/80 border-r border-black/20" title="2.4 - 3.2"></div>
                          <div className="w-[20%] h-full bg-red-600/80" title="3.2 - 4.0 (Negative Correlation)"></div>
                          
                          {/* Indicator Marker */}
                          <div 
                            className="absolute top-[-4px] bottom-[-4px] w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 transition-all duration-500 rounded-full"
                            style={{ left: `${Math.min(100, Math.max(0, (analysisResults?.dw || 0) / 4 * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between w-full mt-1 px-1">
                        <span className="text-[7px] text-slate-600 font-bold">0</span>
                        <span className="text-[7px] text-slate-500 font-bold bg-slate-800 px-1 rounded">2 (IDEAL)</span>
                        <span className="text-[7px] text-slate-600 font-bold">4</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ExportWrapper fileName="doe-pareto-effects">
                      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[450px]">
                        <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Pareto Chart of Standardized Effects</h3>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart 
                            data={analysisResults?.coeffs.slice(1).map((c: any) => ({
                              ...c,
                              absT: Math.abs(c.t),
                              absEffect: Math.abs(c.effect || 0)
                            })).sort((a: any, b: any) => b.absT - a.absT) || []} 
                            layout="vertical"
                            margin={{ top: 0, right: 30, left: 40, bottom: 20 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                              <XAxis type="number" stroke="#94a3b8" fontSize={10} name="Magnitude" />
                              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                              <Tooltip 
                                cursor={{ fill: '#1e293b' }} 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                formatter={(value: any) => [Number(value).toFixed(4), 'Standardized Effect']}
                              />
                              {analysisResults?.anova?.error?.df > 0 && !isNaN(jStat.studentt.inv(1 - alpha/2, analysisResults.anova.error.df)) && (
                                <ReferenceLine 
                                  x={Math.abs(jStat.studentt.inv(1 - alpha/2, analysisResults.anova.error.df))} 
                                  stroke="#ef4444" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5" 
                                  label={{ 
                                    position: 'top', 
                                    value: `α=${alpha} (t=${Math.abs(jStat.studentt.inv(1 - alpha/2, analysisResults.anova.error.df)).toFixed(2)})`, 
                                    fill: '#ef4444', 
                                    fontSize: 10,
                                    fontWeight: 'bold'
                                  }} 
                                />
                              )}
                              <Bar dataKey="absT" name="Standardized Effect" radius={[0, 4, 4, 0]}>
                                {analysisResults?.coeffs.slice(1).map((entry: any, index: number) => {
                                  const tCrit = analysisResults?.anova?.error?.df > 0 ? Math.abs(jStat.studentt.inv(1 - alpha/2, analysisResults.anova.error.df)) : 2.0;
                                  return <Cell key={`cell-${index}`} fill={Math.abs(entry.t) > tCrit ? '#818cf8' : '#475569'} />;
                                })}
                              </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ExportWrapper>

                    <ExportWrapper fileName="doe-pareto-ss">
                      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[450px]">
                        <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center text-amber-500/80">Pareto of Adjusted Sum of Squares</h3>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart 
                            data={[
                              { term: 'Model', ss: analysisResults?.anova?.model?.ss || 0, isModel: true },
                              { term: 'Error', ss: analysisResults?.anova?.error?.ss || 0, isError: true }
                            ].sort((a, b) => b.ss - a.ss)}
                            layout="vertical"
                            margin={{ top: 0, right: 80, left: 40, bottom: 20 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                              <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                              <YAxis dataKey="term" type="category" stroke="#f8fafc" fontSize={11} width={80} fontWeight="bold" />
                              <Tooltip 
                                cursor={{ fill: '#1e293b' }} 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                formatter={(value: any) => [Number(value).toFixed(4), 'Adj SS']}
                              />
                              <Bar dataKey="ss" name="Adjusted SS" radius={[0, 4, 4, 0]}>
                                <LabelList 
                                  dataKey="ss" 
                                  position="right" 
                                  content={(props: any) => {
                                    const { x, y, width, height, value } = props;
                                    const totalSS = analysisResults?.anova?.total?.ss || 1;
                                    const pct = ((value / totalSS) * 100).toFixed(2);
                                    return (
                                      <text x={x + width + 8} y={y + height / 2 + 5} fill="#f1f5f9" fontSize={12} fontWeight="900" textAnchor="start">
                                        {pct}%
                                      </text>
                                    );
                                  }}
                                />
                                {[
                                  { term: 'Model', ss: analysisResults?.anova?.model?.ss || 0, isModel: true },
                                  { term: 'Error', ss: analysisResults?.anova?.error?.ss || 0, isError: true }
                                ].sort((a, b) => b.ss - a.ss).map((entry: any, index: number) => (
                                  <Cell key={`cell-ss-${index}`} fill={entry.isError ? '#ef4444' : '#38bdf8'} />
                                ))}
                              </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ExportWrapper>
                  </div>

                  <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                       <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         Estimated Effects and Coefficients for Response ({displayUnits} units)
                       </h4>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/30 text-slate-500 uppercase tracking-widest text-[10px]">
                        <tr>
                          <th className="p-3">Term</th>
                          <th className="p-3">Effect</th>
                          <th className="p-3">Coef</th>
                          <th className="p-3">SE Coef</th>
                          <th className="p-3">T-Value</th>
                          <th className="p-3">P-Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResults?.coeffs.map((c: any) => (
                          <tr key={c.name} className="border-b border-slate-800 hover:bg-slate-800/40">
                            <td className="p-3 font-bold text-slate-200">{c.name}</td>
                            <td className={`p-3 font-mono ${c.effect < 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                              {c.effect ? c.effect.toFixed(4) : ''}
                            </td>
                            <td className={`p-3 font-mono ${c.coeff < 0 ? 'text-amber-300' : 'text-indigo-400'}`}>
                              {c.coeff.toFixed(4)}
                            </td>
                            <td className="p-3 font-mono text-slate-500">{c.se.toFixed(4)}</td>
                            <td className="p-3 font-mono text-slate-400">{c.t.toFixed(2)}</td>
                            <td className={`p-3 font-mono ${c.p < alpha ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>{c.p.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl mt-6">
                    <div className="p-3 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                       <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         Analysis of Variance (ANOVA)
                       </h4>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/30 text-slate-500 uppercase tracking-widest text-[10px]">
                        <tr>
                          <th className="p-3">Source</th>
                          <th className="p-3 text-center">DF</th>
                          <th className="p-3 text-center">Adj SS</th>
                          <th className="p-3 text-center">Adj MS</th>
                          <th className="p-3 text-center">F-Value</th>
                          <th className="p-3 text-center">P-Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Model */}
                        <tr className="border-b border-slate-800 bg-indigo-500/5">
                           <td className="p-3 font-bold text-white">Model</td>
                           <td className="p-3 text-center text-slate-300">{analysisResults.anova.model.df}</td>
                           <td className="p-3 text-center text-cyan-400">{analysisResults.anova.model.ss.toFixed(4)}</td>
                           <td className="p-3 text-center text-indigo-400">{analysisResults.anova.model.ms.toFixed(4)}</td>
                           <td className="p-3 text-center text-slate-200">{analysisResults.anova.model.f.toFixed(2)}</td>
                           <td className={`p-3 text-center font-bold ${analysisResults.anova.model.p < alpha ? 'text-emerald-400' : 'text-slate-500'}`}>{analysisResults.anova.model.p.toFixed(4)}</td>
                        </tr>
                        {/* Term-level Adj SS */}
                        {analysisResults.adjustedSS?.map((term: any) => (
                           <tr key={`adj-${term.term}`} className="border-b border-slate-800/50 text-[10px]">
                             <td className="p-2 pl-6 text-slate-400 italic">{term.term}</td>
                             <td className="p-2 text-center text-slate-500">1</td>
                             <td className="p-2 text-center text-slate-400">{term.ss.toFixed(4)}</td>
                             <td className="p-2 text-center text-slate-400">{term.ss.toFixed(4)}</td>
                             <td className="p-2 text-center">—</td>
                             <td className="p-2 text-center">—</td>
                           </tr>
                        ))}
                        {/* Error */}
                        <tr className="border-b border-slate-800">
                           <td className="p-3 font-bold text-slate-400">Error</td>
                           <td className="p-3 text-center text-slate-300">{analysisResults.anova.error.df}</td>
                           <td className="p-3 text-center text-slate-400">{analysisResults.anova.error.ss.toFixed(4)}</td>
                           <td className="p-3 text-center text-slate-400">{analysisResults.anova.error.ms.toFixed(4)}</td>
                           <td className="p-3 text-center">—</td>
                           <td className="p-3 text-center">—</td>
                        </tr>
                        {/* Total */}
                        <tr className="font-bold bg-slate-900">
                           <td className="p-3 text-slate-300">Total</td>
                           <td className="p-3 text-center text-slate-300">{analysisResults.anova.total.df}</td>
                           <td className="p-3 text-center text-slate-300">{analysisResults.anova.total.ss.toFixed(4)}</td>
                           <td className="p-3 text-center">—</td>
                           <td className="p-3 text-center">—</td>
                           <td className="p-3 text-center">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                 </>
               )}
            </div>
          )}

          {activeTab === 'plots' && (
            <div className="space-y-6">
              <div className="flex bg-slate-900 p-3 rounded-xl border border-slate-800 gap-4 overflow-x-auto items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Show Main Effects:</span>
                {factors.map(f => (
                  <label key={f.name} className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors">
                    <input 
                      type="checkbox" 
                      className="accent-indigo-500"
                      checked={visibleMainEffects.includes(f.name)}
                      onChange={() => setVisibleMainEffects(prev => prev.includes(f.name) ? prev.filter(v => v !== f.name) : [...prev, f.name])}
                    />
                    <span className="text-xs text-slate-300 font-medium">{f.name}</span>
                  </label>
                ))}
              </div>

              {(!canAnalyze || !analysisResults) ? (
                 <div className="bg-slate-900/50 border border-slate-800 rounded-2xl h-80 flex flex-col items-center justify-center p-10 text-center">
                    <div className="p-4 bg-slate-800 rounded-full mb-4">
                      <Layout className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-2">Configure Responses to View Plots</h3>
                    <p className="text-slate-500 text-sm max-w-xs">{!canAnalyze ? "Main Effects and Interaction plots will generated automatically from the response variable." : "The model could not be calculated (singular matrix or insufficient variation)."}</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[450px]">
                      <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Main Effects Plot for Response</h3>
                      <ResponsiveContainer width="100%" height="85%">
                        <LineChart 
                          data={[{x: -1}, {x: 1}]} 
                          margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis 
                            dataKey="x"
                            type="number"
                            domain={[-1.2, 1.2]}
                            ticks={[-1, 1]}
                            tickFormatter={(v) => Number(v) === -1 ? 'Low' : 'High'}
                            stroke="#94a3b8" 
                            fontSize={10}
                          />
                          <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                          <Tooltip 
                            content={({ payload }) => {
                              if (!payload || !payload[0]) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-[10px]">
                                  <div className="font-bold text-indigo-400 mb-1">Factor {d.factor}</div>
                                  <div className="text-slate-400">Value: <span className="text-white">{d.y.toFixed(2)}</span></div>
                                </div>
                              );
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          {mainEffectsData.filter(d => visibleMainEffects.includes(d.factor)).map((d, i) => (
                             <Line 
                              key={d.factor} 
                              name={`Factor ${d.factor}`}
                              type="monotone" 
                              data={[
                                { factor: d.factor, x: -1, y: d.low },
                                { factor: d.factor, x: 1, y: d.high }
                              ]} 
                              dataKey="y"
                              stroke={['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'][i % 7]} 
                              strokeWidth={3}
                              dot={{ r: 5, strokeWidth: 2, fill: '#1e293b' }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                      <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Interaction Matrix</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                         {selectedTerms.filter(term => term.includes('*') && term.split('*').length === 2).length > 0 ? (
                           selectedTerms.filter(term => term.includes('*') && term.split('*').length === 2).map(term => {
                                const [f1Name, f2Name] = term.split('*');
                                const f1 = factors.find(f => f.name === f1Name) || { name: f1Name };
                                const f2 = factors.find(f => f.name === f2Name) || { name: f2Name };
                                
                                const lowLow = dataWithResponseMapped.filter(d => d[`${f1.name}_coded`] === -1 && d[`${f2.name}_coded`] === -1);
                                const lowHigh = dataWithResponseMapped.filter(d => d[`${f1.name}_coded`] === 1 && d[`${f2.name}_coded`] === -1);
                                const highLow = dataWithResponseMapped.filter(d => d[`${f1.name}_coded`] === -1 && d[`${f2.name}_coded`] === 1);
                                const highHigh = dataWithResponseMapped.filter(d => d[`${f1.name}_coded`] === 1 && d[`${f2.name}_coded`] === 1);

                                const iData = [
                                  { name: 'Low', f1Low: lowLow.length > 0 ? getMean(lowLow.map(d => d.Response)) : 0, f1High: lowHigh.length > 0 ? getMean(lowHigh.map(d => d.Response)) : 0 },
                                  { name: 'High', f1Low: highLow.length > 0 ? getMean(highLow.map(d => d.Response)) : 0, f1High: highHigh.length > 0 ? getMean(highHigh.map(d => d.Response)) : 0 }
                                ];

                                return (
                                  <div key={term} className="bg-slate-800/40 p-3 rounded border border-slate-700/50 shadow-inner">
                                     <div className="text-[10px] font-bold text-slate-300 mb-2 flex justify-between">
                                        <span>{term}</span>
                                        <div className="flex gap-2">
                                          <span className="flex items-center gap-1 text-[8px]"><span className="w-2 h-0.5 bg-indigo-500"></span> {f1.name} Low</span>
                                          <span className="flex items-center gap-1 text-[8px]"><span className="w-2 h-0.5 bg-amber-500 border-t border-dashed"></span> {f1.name} High</span>
                                        </div>
                                     </div>
                                     <div className="h-44">
                                       <ResponsiveContainer width="100%" height="100%">
                                         <LineChart data={iData} margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" fontSize={9} stroke="#94a3b8" label={{ value: f2.name, position: 'insideBottom', offset: -5, fontSize: 8, fill: '#64748b' }} />
                                            <YAxis fontSize={9} stroke="#94a3b8" domain={['auto', 'auto']} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px' }} />
                                            <Line name={`${f1.name} Low`} dataKey="f1Low" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                                            <Line name={`${f1.name} High`} dataKey="f1High" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
                                         </LineChart>
                                       </ResponsiveContainer>
                                     </div>
                                  </div>
                                );
                           })
                         ) : (
                           <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-600 text-xs italic p-10 bg-slate-900/50 rounded-lg">
                             <Layout className="w-5 h-5 mb-2 opacity-20" />
                             No 2-way interactions selected in Model Refinement
                           </div>
                         )}
                      </div>
                    </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'residuals' && (
            <div className="space-y-6">
               {(!canAnalyze || !analysisResults) ? (
                 <div className="bg-slate-900/50 border border-slate-800 rounded-2xl h-80 flex flex-col items-center justify-center p-10 text-center">
                    <div className="p-4 bg-slate-800 rounded-full mb-4">
                      <Percent className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-2">Residual Analysis</h3>
                    <p className="text-slate-500 text-sm max-w-xs">{!canAnalyze ? "Residual diagnostics will appear once a response variable is selected and the model is fit." : "Residual analysis is unavailable because the model could not be fit."}</p>
                 </div>
               ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Normal Probability Plot */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[350px]">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Normal Probability Plot</h3>
                    <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={analysisResults?.probPlot} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" dataKey="theoretical" stroke="#94a3b8" fontSize={10} name="Theoretical" label={{ value: 'Theoretical', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis type="number" dataKey="observed" stroke="#94a3b8" fontSize={10} name="Observed" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Line type="linear" dataKey="observed" stroke="#818cf8" strokeWidth={0} dot={{ r: 3, fill: '#818cf8' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Versus Order */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[350px]">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Residuals vs Run Order</h3>
                    <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={analysisResults?.residuals} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="order" stroke="#94a3b8" fontSize={10} label={{ value: 'Run Order', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                        <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={{ r: 4, fill: '#ec4899' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Versus Fits */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[350px]">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Residuals vs Fits</h3>
                    <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={analysisResults?.residuals} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" dataKey="fitted" stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} label={{ value: 'Fitted Value', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                        <Line type="linear" dataKey="value" stroke="#f59e0b" strokeWidth={0} dot={{ r: 3, fill: '#f59e0b' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Versus Factor Levels (Dynamic Factor-X plot) */}
                  <div className="col-span-full bg-slate-900 p-6 rounded-xl border border-slate-800 min-h-[350px]">
                    <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">Residuals vs Factors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {factors.map(f => {
                        const factorResidData = analysisResults?.residuals.map((r: any, idx: number) => ({
                           level: dataWithResponseMapped[idx][f.name],
                           value: r.value
                        }));

                        return (
                          <div key={f.name} className="h-48">
                            <div className="text-[10px] font-bold text-slate-600 mb-2 uppercase text-center">{f.name}</div>
                            <ResponsiveContainer width="100%" height="90%">
                              <LineChart data={factorResidData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="level" stroke="#475569" fontSize={8} />
                                <YAxis stroke="#475569" fontSize={8} />
                                <ReferenceLine y={0} stroke="#475569" />
                                <Line type="linear" dataKey="value" stroke="#14b8a6" strokeWidth={0} dot={{ r: 3, fill: '#14b8a6' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
