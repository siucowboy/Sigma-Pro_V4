import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

import ExportWrapper from './ExportWrapper';

// NOTE: We will build these exact functions when we tackle src/lib/stats.ts
import { 
  analyzeCapability, 
  generateDynamicHistogram, 
  generateNormalCurve 
} from '../lib/stats';

export default function CapabilityModule({ datasets }: { datasets: any[] }) {
  // --- State Configuration ---
  const [selectedDataId, setSelectedDataId] = useState<string>('');
  const [usl, setUsl] = useState<number | ''>('');
  const [lsl, setLsl] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  
  // Boundary toggles
  const [isLslBoundary, setIsLslBoundary] = useState(false);
  const [isUslBoundary, setIsUslBoundary] = useState(false);

  // Subgroup configuration
  const [subgroupType, setSubgroupType] = useState<'fixed' | 'variable'>('fixed');
  const [fixedSubgroupSize, setFixedSubgroupSize] = useState<number>(1);
  const [subgroupIdColumn, setSubgroupIdColumn] = useState<string>('');
  const [analysisIntent, setAnalysisIntent] = useState<'overall' | 'shortTerm' | 'both'>('shortTerm');

  // --- Derived Data & Calculations ---
  const activeDataset = datasets.find(d => d.id === selectedDataId);
  const rawData = activeDataset?.values || [];

  // Default subgroup size to total on data selection
  React.useEffect(() => {
    if (rawData.length > 0) {
      setFixedSubgroupSize(rawData.length);
      setAnalysisIntent('shortTerm');
    }
  }, [selectedDataId, rawData.length]);

  // Auto-switch to Comprehensive if rational subgroups are detected
  React.useEffect(() => {
    if (rawData.length > 0) {
      const isUsingSubgroups = 
        (subgroupType === 'fixed' && fixedSubgroupSize > 0 && fixedSubgroupSize < rawData.length) ||
        (subgroupType === 'variable' && subgroupIdColumn !== '');
      
      if (isUsingSubgroups) {
        setAnalysisIntent('both');
      }
    }
  }, [fixedSubgroupSize, subgroupType, subgroupIdColumn, rawData.length]);

  const analysisParams = {
    data: rawData,
    usl: usl !== '' ? Number(usl) : null,
    lsl: lsl !== '' ? Number(lsl) : null,
    target: target !== '' ? Number(target) : null,
    isLslBoundary,
    isUslBoundary,
    subgroupType,
    subgroupSize: fixedSubgroupSize,
    subgroupIds: subgroupType === 'variable' && subgroupIdColumn 
      ? datasets.find(d => d.id === subgroupIdColumn)?.values || [] 
      : []
  };

  // Run the math engine
  const results = useMemo(() => {
    if (!rawData.length) return null;
    return analyzeCapability(analysisParams);
  }, [rawData, usl, lsl, target, isLslBoundary, isUslBoundary, subgroupType, fixedSubgroupSize, subgroupIdColumn]);

  // Generate Chart Data (Dynamic Bins + PDF Curve)
  const chartData = useMemo(() => {
    if (!results || !rawData.length) return { histogram: [], curve: [] };
    
    // Dynamic binning (Sturges rule applied inside stats.ts)
    const histData = generateDynamicHistogram(rawData); 
    
    // Smooth PDF curve (only if normal)
    const curveData = results.isNormal 
      ? generateNormalCurve(results.mean, results.stdevOverall, histData)
      : [];

    return { histogram: histData, curve: curveData };
  }, [results, rawData]);

  // --- UI Render ---
  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Process Capability (Cp/Cpk)</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* --- LEFT SIDEBAR: CONFIGURATION --- */}
        <div className="col-span-1 space-y-6">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Data Source</h3>
            <select 
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm"
              value={selectedDataId} 
              onChange={e => setSelectedDataId(e.target.value)}
            >
              <option value="">Select Primary Dataset...</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Analysis Profile</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setAnalysisIntent('both')}
                className={`text-xs p-2 rounded text-left transition-colors ${analysisIntent === 'both' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50' : 'bg-slate-900 text-slate-400 border border-transparent'}`}
              >
                Comprehensive (Both ST & LT)
              </button>
              <button 
                onClick={() => setAnalysisIntent('overall')}
                className={`text-xs p-2 rounded text-left transition-colors ${analysisIntent === 'overall' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-slate-900 text-slate-400 border border-transparent'}`}
              >
                Overall Only (Long Term / Ppk)
              </button>
              <button 
                onClick={() => setAnalysisIntent('shortTerm')}
                className={`text-xs p-2 rounded text-left transition-colors ${analysisIntent === 'shortTerm' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-slate-900 text-slate-400 border border-transparent'}`}
              >
                Short Term Only (Cpk Focus)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              Note: Subgroups &lt; total sample indicate ST variation.
            </p>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Specifications</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Upper Spec Limit (USL)</label>
                <div className="flex gap-2">
                  <input type="number" value={usl} onChange={e => setUsl(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                  <label className="flex items-center text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={isUslBoundary} onChange={e => setIsUslBoundary(e.target.checked)} className="mr-1" />
                    Boundary
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target (Optional)</label>
                <input type="number" value={target} onChange={e => setTarget(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Lower Spec Limit (LSL)</label>
                <div className="flex gap-2">
                  <input type="number" value={lsl} onChange={e => setLsl(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                  <label className="flex items-center text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={isLslBoundary} onChange={e => setIsLslBoundary(e.target.checked)} className="mr-1" />
                    Boundary
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold mb-4 text-neon-accent">Subgroup Estimation</h3>
            <select 
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-3"
              value={subgroupType}
              onChange={e => setSubgroupType(e.target.value as 'fixed' | 'variable')}
            >
              <option value="fixed">Fixed Size / Individuals</option>
              <option value="variable">Identifier Column (Pooled SD)</option>
            </select>

            {subgroupType === 'fixed' ? (
              <div>
                <input 
                  type="number" 
                  min="1" 
                  max="25" 
                  value={fixedSubgroupSize} 
                  onChange={e => setFixedSubgroupSize(Number(e.target.value))} 
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" 
                  placeholder="Subgroup Size" 
                />
                <p className="text-xs text-slate-500 mt-2">
                  {fixedSubgroupSize === 1 
                    ? "Method: Moving Range (Individuals)" 
                    : "Method: R-Bar / d2"}
                </p>
              </div>
            ) : (
              <select value={subgroupIdColumn} onChange={e => setSubgroupIdColumn(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm">
                <option value="">Select ID Column...</option>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* --- RIGHT PANEL: OUTPUT & VISUALS --- */}
        <div className="col-span-1 lg:col-span-3 space-y-6">
          
          {/* Diagnostics Banner */}
          {results && (
            <ExportWrapper fileName="capability-diagnostics">
              <div className={`p-4 rounded-lg border flex gap-4 ${results.isNormal && results.isStable ? 'bg-slate-800 border-green-500/30' : 'bg-orange-900/20 border-orange-500/50'}`}>
                <div>
                  <span className={`text-sm font-bold ${results.isNormal ? 'text-green-400' : 'text-orange-400'}`}>
                    {results.isNormal ? '✓ Normal Distribution' : '⚠ Non-Normal (Using ISO Percentile Method)'}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">(P-Value: {typeof results.normalityPValue === 'number' ? results.normalityPValue.toFixed(3) : '--'})</span>
                </div>
                <div>
                  <span className={`text-sm font-bold ${results.isStable ? 'text-green-400' : 'text-orange-400'}`}>
                    {results.isStable ? '✓ Process Stable' : '⚠ Process Out of Control (Check I-MR)'}
                  </span>
                </div>
              </div>
            </ExportWrapper>
          )}

          {/* Results Grid */}
          {results && (
            <ExportWrapper fileName="capability-indices">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {(analysisIntent === 'both' || analysisIntent === 'shortTerm' || fixedSubgroupSize < rawData.length) && (
                  <>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Cp (Potential ST)</div>
                      <div className="text-2xl font-mono text-white mt-1">{typeof results.Cp === 'number' ? results.Cp.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Cpk (Within ST)</div>
                      <div className="text-2xl font-mono text-yellow-400 mt-1">{typeof results.Cpk === 'number' ? results.Cpk.toFixed(2) : 'N/A'}</div>
                    </div>
                  </>
                )}
                {(analysisIntent === 'both' || analysisIntent === 'overall' || fixedSubgroupSize === rawData.length) && (
                  <>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Pp (Potential LT)</div>
                      <div className="text-2xl font-mono text-white mt-1">{typeof results.Pp === 'number' ? results.Pp.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Ppk (Overall Actual LT)</div>
                      <div className="text-2xl font-mono text-cyan-400 mt-1">{typeof results.Ppk === 'number' ? results.Ppk.toFixed(2) : 'N/A'}</div>
                    </div>
                  </>
                )}
              </div>
            </ExportWrapper>
          )}

          {/* Chart Area */}
          <ExportWrapper fileName="capability-histogram">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-[400px]">
               {rawData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={chartData.histogram} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                     
                     <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <YAxis yAxisId="left" tick={{fill: '#94a3b8', fontSize: 12}} />
                     
                     <Tooltip 
                       contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                       itemStyle={{ color: '#e2e8f0' }}
                     />

                     <Bar yAxisId="left" dataKey="count" fill="#475569" barSize={40} />

                     {results?.isNormal && (
                       <Line yAxisId="left" data={chartData.curve} type="monotone" dataKey="y" stroke="#38bdf8" strokeWidth={3} dot={false} isAnimationActive={false} />
                     )}

                     {lsl !== '' && <ReferenceLine yAxisId="left" x={Number(lsl)} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'top', value: 'LSL', fill: '#ef4444', fontSize: 12 }} />}
                     {usl !== '' && <ReferenceLine yAxisId="left" x={Number(usl)} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'top', value: 'USL', fill: '#ef4444', fontSize: 12 }} />}
                     {target !== '' && <ReferenceLine yAxisId="left" x={Number(target)} stroke="#22c55e" label={{ position: 'top', value: 'Target', fill: '#22c55e', fontSize: 12 }} />}
                   </ComposedChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="flex items-center justify-center h-full text-slate-500">Select a dataset to view distribution</div>
               )}
            </div>
          </ExportWrapper>

          {/* PPM Estimates */}
          {results && (
            <ExportWrapper fileName="capability-ppm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(analysisIntent === 'both' || analysisIntent === 'shortTerm' || fixedSubgroupSize < rawData.length) && (
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-2">Within Performance (Short Term)</h4>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">PPM &lt; LSL:</span> <span className="font-mono text-white">{typeof results.expectedPpmLsl === 'number' ? results.expectedPpmLsl.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">PPM &gt; USL:</span> <span className="font-mono text-white">{typeof results.expectedPpmUsl === 'number' ? results.expectedPpmUsl.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm font-bold mt-2"><span className="text-slate-300">Total PPM:</span> <span className="font-mono text-red-400">{typeof results.expectedPpmTotal === 'number' ? results.expectedPpmTotal.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-700/50">
                        <span className="text-sky-400">Z Score (Z Bench):</span> 
                        <span className="font-mono text-sky-400">{results.zBenchWithin ? results.zBenchWithin.toFixed(2) : 'N/A'}</span>
                      </div>
                  </div>
                )}
                {(analysisIntent === 'both' || analysisIntent === 'overall' || fixedSubgroupSize === rawData.length) && (
                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-2">Overall Performance (Long Term)</h4>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">PPM &lt; LSL:</span> <span className="font-mono text-white">{typeof results.overallPpmLsl === 'number' ? results.overallPpmLsl.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">PPM &gt; USL:</span> <span className="font-mono text-white">{typeof results.overallPpmUsl === 'number' ? results.overallPpmUsl.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm font-bold mt-2"><span className="text-slate-300">Total PPM:</span> <span className="font-mono text-red-400">{typeof results.overallPpmTotal === 'number' ? results.overallPpmTotal.toFixed(0) : '--'}</span></div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-700/50">
                        <span className="text-cyan-400">Z Score (Z Bench):</span> 
                        <span className="font-mono text-cyan-400">{results.zBenchOverall ? results.zBenchOverall.toFixed(2) : 'N/A'}</span>
                      </div>
                  </div>
                )}
              </div>
            </ExportWrapper>
          )}

        </div>
      </div>
    </div>
  );
}