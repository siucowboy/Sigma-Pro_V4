import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Scatter } from 'recharts';

import ExportWrapper from './ExportWrapper';
import { sampleData } from '../lib/stats';

export default function SPCModule({ datasets }: { datasets: any[] }) {
  const [chartCategory, setChartCategory] = useState<'variable' | 'attribute'>('variable');
  const [chartType, setChartType] = useState('imr');
  const [selectedDataId, setSelectedDataId] = useState('');
  const [subgroupMode, setSubgroupMode] = useState<'fixed' | 'id'>('fixed');
  const [subgroupSize, setSubgroupSize] = useState(5);
  const [subgroupIdColId, setSubgroupIdColId] = useState('');
  const [responseLabel, setResponseLabel] = useState('');

  const activeDataset = datasets.find(d => d.id === selectedDataId);
  const idDataset = datasets.find(d => d.id === subgroupIdColId);
  const rawData = activeDataset?.values as number[] || [];
  const idData = idDataset?.values || [];

  // Control Chart Constants (for Xbar-R)
  const XBAR_CONSTANTS: { [key: number]: { a2: number, d3: number, d4: number } } = {
    2: { a2: 1.880, d3: 0, d4: 3.267 },
    3: { a2: 1.023, d3: 0, d4: 2.574 },
    4: { a2: 0.729, d3: 0, d4: 2.282 },
    5: { a2: 0.577, d3: 0, d4: 2.114 },
    6: { a2: 0.483, d3: 0, d4: 2.004 },
    7: { a2: 0.419, d3: 0.076, d4: 1.924 },
    8: { a2: 0.373, d3: 0.136, d4: 1.864 },
    9: { a2: 0.337, d3: 0.184, d4: 1.816 },
    10: { a2: 0.308, d3: 0.223, d4: 1.777 }
  };

  // Simplified math engine for SPC calculation & Nelson Rules
  const spcData = useMemo(() => {
    if (!rawData.length) return null;
    
    let mean = 0;
    let ucl = 0, lcl = 0;
    let points = [];
    let violations = [];
    let secondary: any = null;

    // I-MR Logic (Rule 1, 2, 3)
    if (chartType === 'imr') {
      mean = rawData.reduce((a, b) => a + b, 0) / rawData.length;
      let mrs = [];
      for (let i = 1; i < rawData.length; i++) {
        mrs.push(Math.abs(rawData[i] - rawData[i - 1]));
      }
      const mrBar = mrs.length > 0 ? mrs.reduce((a, b) => a + b, 0) / mrs.length : 0;
      const sigma = mrBar / 1.128;
      ucl = mean + 3 * sigma;
      lcl = mean - 3 * sigma;

      let consecutiveAbove = 0, consecutiveBelow = 0;
      let consecutiveUp = 0, consecutiveDown = 0;

      points = rawData.map((val, i) => {
        let isViolation = false;
        let rule = '';

        if (val > ucl || val < lcl) { isViolation = true; rule = 'Rule 1 (Outlier)'; }
        if (val > mean) { consecutiveAbove++; consecutiveBelow = 0; }
        else if (val < mean) { consecutiveBelow++; consecutiveAbove = 0; }
        if (consecutiveAbove >= 9 || consecutiveBelow >= 9) { isViolation = true; rule = 'Rule 2 (Shift)'; }
        if (i > 0) {
          if (val > rawData[i-1]) { consecutiveUp++; consecutiveDown = 0; }
          else if (val < rawData[i-1]) { consecutiveDown++; consecutiveUp = 0; }
          if (consecutiveUp >= 6 || consecutiveDown >= 6) { isViolation = true; rule = 'Rule 3 (Trend)'; }
        }
        if (isViolation) violations.push({ index: i + 1, rule, val });
        return { id: i + 1, val, isViolation, rule };
      });

      // MR Chart (Secondary)
      // d4 for n=2 is 3.267, d3 is 0
      const mrUcl = 3.267 * mrBar;
      const mrLcl = 0;
      secondary = {
        title: 'Moving Range (MR) Chart',
        mean: mrBar,
        ucl: mrUcl,
        lcl: mrLcl,
        points: mrs.map((val, i) => ({
          id: i + 2,
          val,
          isViolation: val > mrUcl || val < mrLcl,
          rule: val > mrUcl || val < mrLcl ? 'Rule 1 (Outlier)' : ''
        }))
      };
    }

    // Xbar-R Logic
    if (chartType === 'xbar') {
      let subgroups: number[][] = [];
      let subgroupLabels: any[] = [];

      if (subgroupMode === 'fixed') {
        const n = Math.max(2, Math.min(10, subgroupSize));
        for (let i = 0; i < rawData.length; i += n) {
          const group = rawData.slice(i, i + n);
          if (group.length === n) {
            subgroups.push(group);
            subgroupLabels.push(Math.floor(i / n) + 1);
          }
        }
      } else {
        const groups: { [key: string]: number[] } = {};
        const labels: string[] = [];
        rawData.forEach((val, i) => {
          const label = idData[i] !== undefined ? String(idData[i]) : `Group ${Math.floor(i/5)+1}`;
          if (!groups[label]) {
            groups[label] = [];
            labels.push(label);
          }
          groups[label].push(val);
        });
        labels.forEach(label => {
          if (groups[label].length >= 2 && groups[label].length <= 10) {
            subgroups.push(groups[label]);
            subgroupLabels.push(label);
          }
        });
      }

      if (subgroups.length === 0) return null;

      const xbars = subgroups.map(g => g.reduce((a, b) => a + b, 0) / g.length);
      const ranges = subgroups.map(g => Math.max(...g) - Math.min(...g));
      
      const xbarBar = xbars.reduce((a, b) => a + b, 0) / xbars.length;
      const rBar = ranges.reduce((a, b) => a + b, 0) / ranges.length;
      
      const avgN = Math.round(subgroups.reduce((a, b) => a + b.length, 0) / subgroups.length);
      const n = Math.max(2, Math.min(10, avgN));
      const constants = XBAR_CONSTANTS[n] || XBAR_CONSTANTS[5];

      mean = xbarBar;
      ucl = mean + constants.a2 * rBar;
      lcl = mean - constants.a2 * rBar;

      let consecutiveAbove = 0, consecutiveBelow = 0;
      let consecutiveUp = 0, consecutiveDown = 0;

      points = xbars.map((val, i) => {
        let isViolation = false;
        let rule = '';
        
        if (val > ucl || val < lcl) { isViolation = true; rule = 'Rule 1 (Outlier)'; }
        
        if (val > mean) { consecutiveAbove++; consecutiveBelow = 0; }
        else if (val < mean) { consecutiveBelow++; consecutiveAbove = 0; }
        if (consecutiveAbove >= 9 || consecutiveBelow >= 9) { 
          isViolation = true; 
          rule = 'Rule 2 (Shift)'; 
        }

        if (i > 0) {
          if (val > xbars[i-1]) { consecutiveUp++; consecutiveDown = 0; }
          else if (val < xbars[i-1]) { consecutiveDown++; consecutiveUp = 0; }
          if (consecutiveUp >= 6 || consecutiveDown >= 6) { 
            isViolation = true; 
            rule = 'Rule 3 (Trend)'; 
          }
        }

        if (isViolation) violations.push({ index: subgroupLabels[i], rule, val });
        return { id: subgroupLabels[i], val, isViolation, rule };
      });

      // R Chart (Secondary)
      const rUcl = constants.d4 * rBar;
      const rLcl = constants.d3 * rBar;
      secondary = {
        title: 'Range (R) Chart',
        mean: rBar,
        ucl: rUcl,
        lcl: rLcl,
        points: ranges.map((val, i) => ({
          id: subgroupLabels[i],
          val,
          isViolation: val > rUcl || val < rLcl,
          rule: val > rUcl || val < rLcl ? 'Rule 1 (Outlier)' : ''
        }))
      };
    }

    // Attribute Charts (P, NP, C, U)
    if (['p', 'np', 'c', 'u'].includes(chartType)) {
      if (chartType === 'p' || chartType === 'u') {
        mean = rawData.reduce((a, b) => a + b, 0) / rawData.length;
        const sigma = Math.sqrt((mean * (1 - mean)) / subgroupSize); // Simplified for P
        const sigmaU = Math.sqrt(mean / subgroupSize); // Simplified for U
        
        ucl = chartType === 'p' ? mean + 3 * sigma : mean + 3 * sigmaU;
        lcl = Math.max(0, chartType === 'p' ? mean - 3 * sigma : mean - 3 * sigmaU);
      } else {
        mean = rawData.reduce((a, b) => a + b, 0) / rawData.length;
        const sigmaNP = Math.sqrt(mean * (1 - (mean / subgroupSize))); // Simplified for NP
        const sigmaC = Math.sqrt(mean); // Simplified for C
        
        ucl = chartType === 'np' ? mean + 3 * sigmaNP : mean + 3 * sigmaC;
        lcl = Math.max(0, chartType === 'np' ? mean - 3 * sigmaNP : mean - 3 * sigmaC);
      }

      points = rawData.map((val, i) => {
        let isViolation = false;
        let rule = '';
        if (val > ucl || val < lcl) { isViolation = true; rule = 'Rule 1 (Outlier)'; }
        if (isViolation) violations.push({ index: i + 1, rule, val });
        return { id: i + 1, val, isViolation, rule };
      });
    }

    return { mean, ucl, lcl, points, violations, secondary };
  }, [rawData, idData, chartType, subgroupMode, subgroupSize]);

  const ControlChartComponent = ({ data, title, subtitle }: { data: any, title?: string, subtitle?: string }) => {
    if (!data) return null;
    return (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-[380px] flex flex-col">
        <div className="mb-2">
          {title && <h3 className="text-sm font-bold text-slate-100">{title}</h3>}
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={sampleData(data.points, 2000)} 
              margin={{ top: 20, right: 100, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="id" stroke="#94a3b8" />
              <YAxis 
                stroke="#94a3b8" 
                domain={[
                  (dataMin: number) => Math.min(dataMin, data.lcl) * 0.95,
                  (dataMax: number) => Math.max(dataMax, data.ucl) * 1.05
                ]} 
                tickFormatter={(val) => typeof val === 'number' ? val.toFixed(4) : val}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                formatter={(value: any) => [typeof value === 'number' ? value.toFixed(4) : value, 'Value']}
              />
              <ReferenceLine 
                y={data.ucl} 
                stroke="#ef4444" 
                strokeDasharray="5 5" 
                label={{ 
                  position: 'right', 
                  value: `UCL: ${typeof data.ucl === 'number' ? data.ucl.toFixed(4) : '--'}`, 
                  fill: '#ef4444', 
                  fontSize: 10, 
                  fontWeight: 'bold',
                  offset: 10
                }} 
              />
              <ReferenceLine 
                y={data.mean} 
                stroke="#22c55e" 
                strokeWidth={2}
                label={{ 
                  position: 'right', 
                  value: `CL: ${typeof data.mean === 'number' ? data.mean.toFixed(4) : '--'}`, 
                  fill: '#22c55e', 
                  fontSize: 10, 
                  fontWeight: 'bold',
                  offset: 10
                }} 
              />
              <ReferenceLine 
                y={data.lcl} 
                stroke="#ef4444" 
                strokeDasharray="5 5" 
                label={{ 
                  position: 'right', 
                  value: `LCL: ${typeof data.lcl === 'number' ? data.lcl.toFixed(4) : '--'}`, 
                  fill: '#ef4444', 
                  fontSize: 10, 
                  fontWeight: 'bold',
                  offset: 10
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="val" 
                stroke="#38bdf8" 
                strokeWidth={2} 
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return payload.isViolation ? <circle cx={cx} cy={cy} r={5} fill="#ef4444" /> : <circle cx={cx} cy={cy} r={3} fill="#38bdf8" />;
                }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Control Charts (SPC)</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data Source</label>
            <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={selectedDataId} onChange={e => setSelectedDataId(e.target.value)}>
              <option value="">Select Data...</option>
              {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Chart Category</label>
            <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={chartCategory} onChange={e => { setChartCategory(e.target.value as any); setChartType(e.target.value === 'variable' ? 'imr' : 'p'); }}>
              <option value="variable">Variable (Continuous)</option>
              <option value="attribute">Attribute (Discrete/Defects)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Chart Type</label>
            <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={chartType} onChange={e => setChartType(e.target.value)}>
              {chartCategory === 'variable' ? (
                <>
                  <option value="imr">I-MR (Individuals)</option>
                  <option value="xbar">Xbar-R (Subgroups)</option>
                </>
              ) : (
                <>
                  <option value="p">P Chart (Proportion Defective)</option>
                  <option value="np">NP Chart (Count Defective)</option>
                  <option value="c">C Chart (Defects per Unit)</option>
                  <option value="u">U Chart (Defects per Variable Unit)</option>
                </>
              )}
            </select>
          </div>

          {['xbar', 'p', 'np', 'u'].includes(chartType) && (
            <>
              {chartType === 'xbar' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subgroup Mode</label>
                  <div className="flex bg-slate-900 rounded border border-slate-600 overflow-hidden">
                    <button 
                      className={`flex-1 p-2 text-[10px] font-bold uppercase ${subgroupMode === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      onClick={() => setSubgroupMode('fixed')}
                    >
                      Fixed Size
                    </button>
                    <button 
                      className={`flex-1 p-2 text-[10px] font-bold uppercase ${subgroupMode === 'id' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      onClick={() => setSubgroupMode('id')}
                    >
                      By ID Col
                    </button>
                  </div>
                </div>
              )}

              {(subgroupMode === 'fixed' || chartType !== 'xbar') ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {['p', 'np', 'u'].includes(chartType) ? 'Sample Size (n)' : 'Subgroup Size'}
                  </label>
                  <input 
                    type="number" 
                    min="1" max="1000"
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" 
                    value={subgroupSize} 
                    onChange={e => setSubgroupSize(parseInt(e.target.value) || 1)} 
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {chartType === 'xbar' ? 'Recommended: 2-10' : 'Total items per subgroup'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subgroup ID Column</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white" 
                    value={subgroupIdColId} 
                    onChange={e => setSubgroupIdColId(e.target.value)}
                  >
                    <option value="">Select ID Column...</option>
                    {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="pt-2 border-t border-slate-700">
            <label className="block text-xs text-slate-400 mb-1">Response Variable Name (Optional)</label>
            <input 
              type="text" 
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white italic" 
              placeholder={activeDataset?.name || "Column name..."}
              value={responseLabel}
              onChange={e => setResponseLabel(e.target.value)}
            />
            <p className="text-[10px] text-slate-500 mt-1">Defaults to column name if empty</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {spcData ? (
            <>
              <ExportWrapper fileName={`control-chart-${chartType}`}>
                <div className="space-y-4">
                  <ControlChartComponent 
                    data={spcData} 
                    title={
                      chartType === 'imr' ? `Individuals (I) Chart of ${responseLabel || activeDataset?.name || 'Data'}` : 
                      chartType === 'xbar' ? `Xbar Chart of ${responseLabel || activeDataset?.name || 'Data'}` : 
                      `${chartType.toUpperCase()} Chart of ${responseLabel || activeDataset?.name || 'Data'}`
                    } 
                    subtitle={['xbar', 'p', 'np', 'u'].includes(chartType) ? `Subgroup size = ${subgroupSize}` : undefined}
                  />
                  {spcData.secondary && (
                    <ControlChartComponent 
                      data={spcData.secondary} 
                      title={`${spcData.secondary.title} of ${responseLabel || activeDataset?.name || 'Data'}`} 
                      subtitle={chartType === 'xbar' ? `Subgroup size = ${subgroupSize}` : undefined}
                    />
                  )}
                </div>
              </ExportWrapper>

              {spcData.violations.length > 0 && (
                <ExportWrapper fileName="control-chart-violations">
                  <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-lg">
                    <h3 className="text-red-400 font-bold mb-2">⚠ Process Out of Control</h3>
                    <ul className="text-sm text-slate-300 space-y-1">
                      {spcData.violations.slice(0, 5).map((v: any, i: number) => (
                        <li key={i}>Point {v.index}: {v.rule} (Value: {typeof v.val === 'number' ? v.val.toFixed(4) : v.val})</li>
                      ))}
                      {spcData.violations.length > 5 && <li>...and {spcData.violations.length - 5} more violations.</li>}
                    </ul>
                  </div>
                </ExportWrapper>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Select a numeric dataset to generate a control chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}