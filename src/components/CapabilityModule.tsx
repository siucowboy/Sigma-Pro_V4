import React, { useState, useMemo } from 'react';
import ExportWrapper from './ExportWrapper';

// NOTE: We will build these exact functions when we tackle src/lib/stats.ts
import { 
  analyzeCapability, 
  generateDynamicHistogram, 
  generateNormalCurve 
} from '../lib/stats';

type CapabilitySettings = {
  selectedDataId: string;
  usl: number | '';
  lsl: number | '';
  target: number | '';
  isLslBoundary: boolean;
  isUslBoundary: boolean;
  subgroupType: 'fixed' | 'variable';
  fixedSubgroupSize: number;
  subgroupIdColumn: string;
  analysisIntent: 'overall' | 'shortTerm' | 'both';
};

const CAPABILITY_SETTINGS_KEY = 'sigmaStats_capability_settings';
const defaultCapabilitySettings: CapabilitySettings = {
  selectedDataId: '',
  usl: '',
  lsl: '',
  target: '',
  isLslBoundary: false,
  isUslBoundary: false,
  subgroupType: 'fixed',
  fixedSubgroupSize: 1,
  subgroupIdColumn: '',
  analysisIntent: 'shortTerm'
};

function loadCapabilitySettings(): CapabilitySettings {
  if (typeof window === 'undefined') return defaultCapabilitySettings;
  try {
    const saved = window.localStorage.getItem(CAPABILITY_SETTINGS_KEY);
    return saved ? { ...defaultCapabilitySettings, ...JSON.parse(saved) } : defaultCapabilitySettings;
  } catch {
    return defaultCapabilitySettings;
  }
}

export default function CapabilityModule({ datasets }: { datasets: any[] }) {
  const savedSettings = useMemo(() => loadCapabilitySettings(), []);
  // --- State Configuration ---
  const [selectedDataId, setSelectedDataId] = useState<string>(savedSettings.selectedDataId);
  const [usl, setUsl] = useState<number | ''>(savedSettings.usl);
  const [lsl, setLsl] = useState<number | ''>(savedSettings.lsl);
  const [target, setTarget] = useState<number | ''>(savedSettings.target);
  
  // Boundary toggles
  const [isLslBoundary, setIsLslBoundary] = useState(savedSettings.isLslBoundary);
  const [isUslBoundary, setIsUslBoundary] = useState(savedSettings.isUslBoundary);

  // Subgroup configuration
  const [subgroupType, setSubgroupType] = useState<'fixed' | 'variable'>(savedSettings.subgroupType);
  const [fixedSubgroupSize, setFixedSubgroupSize] = useState<number>(savedSettings.fixedSubgroupSize);
  const [subgroupIdColumn, setSubgroupIdColumn] = useState<string>(savedSettings.subgroupIdColumn);
  const [analysisIntent, setAnalysisIntent] = useState<'overall' | 'shortTerm' | 'both'>(savedSettings.analysisIntent);

  // --- Derived Data & Calculations ---
  const activeDataset = datasets.find(d => d.id === selectedDataId);
  const rawData = useMemo(
    () => (activeDataset?.values || [])
      .map((value: any) => Number(value))
      .filter((value: number) => Number.isFinite(value)),
    [activeDataset]
  );
  const hasSpecLimit = usl !== '' || lsl !== '';

  // Default subgroup size to total on data selection
  React.useEffect(() => {
    if (rawData.length > 0) {
      setFixedSubgroupSize(current => current > 0 ? current : rawData.length);
    }
  }, [selectedDataId, rawData.length]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const settings: CapabilitySettings = {
      selectedDataId,
      usl,
      lsl,
      target,
      isLslBoundary,
      isUslBoundary,
      subgroupType,
      fixedSubgroupSize,
      subgroupIdColumn,
      analysisIntent
    };
    window.localStorage.setItem(CAPABILITY_SETTINGS_KEY, JSON.stringify(settings));
  }, [selectedDataId, usl, lsl, target, isLslBoundary, isUslBoundary, subgroupType, fixedSubgroupSize, subgroupIdColumn, analysisIntent]);

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

  const dataStats = useMemo(() => {
    if (!rawData.length) return null;
    const sorted = [...rawData].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const sampleVariance = n > 1
      ? sorted.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (n - 1)
      : 0;
    const populationVariance = sorted.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n;

    return {
      n,
      mean,
      median,
      sampleSd: Math.sqrt(sampleVariance),
      populationSd: Math.sqrt(populationVariance),
      min: sorted[0],
      max: sorted[n - 1]
    };
  }, [rawData]);

  // Generate Chart Data (Dynamic Bins + PDF Curve)
  const chartData = useMemo(() => {
    if (!results || !rawData.length) return { histogram: [], curve: [], domain: [0, 100], yMax: 10 };
    
    // Dynamic binning
    const histData = generateDynamicHistogram(rawData); 
    
    // Smooth PDF curve (only if normal)
    const curveData = results.isNormal 
      ? generateNormalCurve(results.mean, results.stdevOverall, histData)
      : [];

    const xMin = histData.length > 0 ? histData[0].min : 0;
    const xMax = histData.length > 0 ? histData[histData.length - 1].max : 0;
    const specBounds = [
      usl !== '' ? Number(usl) : null,
      lsl !== '' ? Number(lsl) : null,
      target !== '' ? Number(target) : null
    ].filter(v => v !== null) as number[];

    const finalMin = Math.min(xMin, ...specBounds);
    const finalMax = Math.max(xMax, ...specBounds);
    const padding = (finalMax - finalMin) * 0.1 || 1;
    const sharedDomain = [finalMin - padding, finalMax + padding];

    const maxCount = Math.max(0, ...histData.map(h => h.count));
    const maxCurveY = Math.max(0, ...curveData.map(c => c.y));
    const yMax = Math.max(maxCount, maxCurveY, 1) * 1.08;

    return { histogram: histData, curve: curveData, domain: sharedDomain, yMax };
  }, [results, rawData, usl, lsl, target]);

  const formatAxisValue = (val: any) => {
    if (typeof val !== 'number') return val;
    if (val === 0) return '0';
    const absVal = Math.abs(val);
    if (absVal < 0.0001 || absVal >= 10000) {
      return val.toExponential(4);
    }
    // Limit to 4 decimal places, removing unnecessary trailing zeros
    return parseFloat(val.toFixed(4)).toString();
  };

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
                <label className="block text-xs text-slate-400 mb-1">Lower Spec Limit (LSL)</label>
                <div className="flex gap-2">
                  <input type="number" value={lsl} onChange={e => setLsl(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                  <label className="flex items-center text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={isLslBoundary} onChange={e => setIsLslBoundary(e.target.checked)} className="mr-1" />
                    Boundary
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target (Optional)</label>
                <input type="number" value={target} onChange={e => setTarget(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
              </div>

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
              <div className={`p-4 rounded-lg border ${results.isNormal && results.isStable ? 'bg-slate-800 border-green-500/30' : 'bg-orange-900/20 border-orange-500/50'}`}>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <div>
                    <span className={`text-sm font-bold ${results.normalityInconclusive ? 'text-slate-400' : (results.isNormal ? 'text-green-400' : 'text-orange-400')}`}>
                      {results.normalityInconclusive 
                        ? 'Normality Inconclusive (Sample < 5)' 
                        : (results.isNormal ? 'Normal Distribution' : 'Non-Normal (ISO Percentile Method)')}
                    </span>
                    {!results.normalityInconclusive && (
                      <span className="text-xs text-slate-400 ml-2">
                        (P-Value: {typeof results.normalityPValue === 'number' ? results.normalityPValue.toFixed(3) : '--'})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={`text-sm font-bold ${results.isStable ? 'text-green-400' : 'text-orange-400'}`}>
                      {results.isStable ? 'Process Stable' : 'Process Out of Control (Check I-MR)'}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {results.isNormal
                    ? 'Capability uses the normal model; Cp/Cpk use within sigma and Pp/Ppk use overall sigma.'
                    : 'Capability uses percentile spread because the selected data are non-normal; Pp/Ppk and Cp/Cpk are percentile-based, and PPM uses observed counts.'}
                </p>
              </div>
            </ExportWrapper>
          )}

          {/* Results Grid */}
          {results && (
            <ExportWrapper fileName="capability-indices">
              {!hasSpecLimit && (
                <div className="mb-3 rounded border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
                  Enter at least one spec limit to calculate capability indices. The distribution chart can still be reviewed without specs.
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {analysisIntent !== 'overall' && (
                  <>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-auto min-h-[2.5rem] flex items-center">{results.isNormal ? 'Cp (Potential ST)' : 'Cp (Percentile ST)'}</div>
                      <div className="text-2xl sm:text-3xl font-mono text-white mt-2 truncate tabular-nums">
                        {hasSpecLimit && typeof results.Cp === 'number' ? results.Cp.toFixed(2) : 'Add spec'}
                      </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-auto min-h-[2.5rem] flex items-center">{results.isNormal ? 'Cpk (Within ST)' : 'Cpk (Percentile ST)'}</div>
                      <div className="text-2xl sm:text-3xl font-mono text-yellow-400 mt-2 truncate tabular-nums">
                        {hasSpecLimit && typeof results.Cpk === 'number' ? results.Cpk.toFixed(2) : 'Add spec'}
                      </div>
                    </div>
                  </>
                )}
                {analysisIntent !== 'shortTerm' && (
                  <>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-auto min-h-[2.5rem] flex items-center">{results.isNormal ? 'Pp (Potential LT)' : 'Pp (Percentile LT)'}</div>
                      <div className="text-2xl sm:text-3xl font-mono text-white mt-2 truncate tabular-nums">
                        {hasSpecLimit && typeof results.Pp === 'number' ? results.Pp.toFixed(2) : 'Add spec'}
                      </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-auto min-h-[2.5rem] flex items-center">{results.isNormal ? 'Ppk (Overall Actual LT)' : 'Ppk (Percentile Actual LT)'}</div>
                      <div className="text-2xl sm:text-3xl font-mono text-cyan-400 mt-2 truncate tabular-nums">
                        {hasSpecLimit && typeof results.Ppk === 'number' ? results.Ppk.toFixed(2) : 'Add spec'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ExportWrapper>
          )}

          {results && dataStats && (
            <ExportWrapper fileName="capability-data-summary">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Data Summary</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-3">
                  <StatLine
                    label={results.isNormal ? 'Mean' : 'Median'}
                    value={formatAxisValue(results.isNormal ? dataStats.mean : dataStats.median)}
                    emphasis
                  />
                  <StatLine
                    label={results.isNormal ? 'Std Dev (Within)' : 'Std Dev (Sample)'}
                    value={formatAxisValue(results.isNormal ? results.stdevWithin : dataStats.sampleSd)}
                  />
                  <StatLine
                    label={results.isNormal ? 'Std Dev (Overall)' : 'Std Dev (Population)'}
                    value={formatAxisValue(results.isNormal ? results.stdevOverall : dataStats.populationSd)}
                  />
                  <StatLine label="Min" value={formatAxisValue(dataStats.min)} />
                  <StatLine label="Max" value={formatAxisValue(dataStats.max)} />
                  <StatLine label="N" value={dataStats.n.toString()} />
                </div>
              </div>
            </ExportWrapper>
          )}

          {/* Chart Area */}
          <ExportWrapper fileName="capability-histogram">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-[400px]">
               {rawData.length > 0 ? (
                  <CapabilityDistributionChart
                    chartData={chartData}
                    showNormalCurve={Boolean(results?.isNormal)}
                    lsl={lsl}
                    usl={usl}
                    target={target}
                    formatAxisValue={formatAxisValue}
                  />
               ) : (
                 <div className="flex items-center justify-center h-full text-slate-500">Select a dataset to view distribution</div>
               )}
            </div>
          </ExportWrapper>

          {/* PPM Estimates */}
          {results && (
            <ExportWrapper fileName="capability-ppm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisIntent !== 'overall' && (
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
                {analysisIntent !== 'shortTerm' && (
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

function StatLine({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold truncate">{label}</div>
      <div className={`font-mono tabular-nums truncate ${emphasis ? 'text-lg text-white' : 'text-sm text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}

function CapabilityDistributionChart({
  chartData,
  showNormalCurve,
  lsl,
  usl,
  target,
  formatAxisValue
}: {
  chartData: any;
  showNormalCurve: boolean;
  lsl: number | '';
  usl: number | '';
  target: number | '';
  formatAxisValue: (value: any) => string;
}) {
  const width = 1000;
  const height = 360;
  const margin = { top: 18, right: 24, bottom: 34, left: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const [domainMin, domainMax] = chartData.domain as [number, number];
  const yMax = chartData.yMax || 1;
  const xSpan = domainMax - domainMin || 1;

  const xScale = (value: number) => margin.left + ((value - domainMin) / xSpan) * plotWidth;
  const yScale = (value: number) => margin.top + plotHeight - (Math.max(0, value) / yMax) * plotHeight;
  const xTicks = buildTicks(domainMin, domainMax, 5);
  const yTicks = buildTicks(0, yMax, 5);
  const curvePath = showNormalCurve && chartData.curve.length
    ? chartData.curve
        .map((point: any, index: number) => `${index === 0 ? 'M' : 'L'} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`)
        .join(' ')
    : '';
  const specLines = [
    lsl !== '' ? { x: Number(lsl), label: 'LSL', color: '#ef4444', dashed: true } : null,
    usl !== '' ? { x: Number(usl), label: 'USL', color: '#ef4444', dashed: true } : null,
    target !== '' ? { x: Number(target), label: 'Target', color: '#22c55e', dashed: false } : null
  ].filter(Boolean) as Array<{ x: number; label: string; color: string; dashed: boolean }>;

  return (
    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {yTicks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={`y-${tick}`}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#334155" strokeDasharray="3 3" />
            <text x={margin.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="12" vectorEffect="non-scaling-stroke">
              {formatAxisValue(tick)}
            </text>
          </g>
        );
      })}

      {chartData.histogram.map((bin: any, index: number) => {
        const x1 = xScale(bin.min);
        const x2 = xScale(bin.max);
        const y = yScale(bin.count);
        const barWidth = Math.max(1, x2 - x1 - 1);
        return (
          <rect
            key={`bin-${index}`}
            x={x1}
            y={y}
            width={barWidth}
            height={Math.max(0, margin.top + plotHeight - y)}
            fill="#64748b"
            fillOpacity="0.78"
            stroke="#94a3b8"
            strokeOpacity="0.45"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {curvePath && (
        <path d={curvePath} fill="none" stroke="#38bdf8" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      )}

      {specLines.map((line) => {
        const x = xScale(line.x);
        if (x < margin.left || x > width - margin.right) return null;
        return (
          <g key={line.label}>
            <line
              x1={x}
              x2={x}
              y1={margin.top}
              y2={margin.top + plotHeight}
              stroke={line.color}
              strokeWidth="2"
              strokeDasharray={line.dashed ? '5 5' : undefined}
              vectorEffect="non-scaling-stroke"
            />
            <text x={x + 5} y={margin.top + 13} fill={line.color} fontSize="12" vectorEffect="non-scaling-stroke">
              {line.label}
            </text>
          </g>
        );
      })}

      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#64748b" vectorEffect="non-scaling-stroke" />
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#64748b" vectorEffect="non-scaling-stroke" />

      {xTicks.map((tick) => {
        const x = xScale(tick);
        return (
          <text key={`x-${tick}`} x={x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="12" vectorEffect="non-scaling-stroke">
            {formatAxisValue(tick)}
          </text>
        );
      })}
    </svg>
  );
}

function buildTicks(min: number, max: number, count: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2) return [];
  const span = max - min;
  if (span === 0) return [min];
  return Array.from({ length: count }, (_, index) => min + (span * index) / (count - 1));
}
