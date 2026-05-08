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
  const [phaseColId, setPhaseColId] = useState('');
  const [responseLabel, setResponseLabel] = useState('');
  const [decimalPlaces, setDecimalPlaces] = useState(4);
  const [useScientificNotation, setUseScientificNotation] = useState(false);

  const activeDataset = datasets.find(d => d.id === selectedDataId);
  const idDataset = datasets.find(d => d.id === subgroupIdColId);
  const phaseDataset = datasets.find(d => d.id === phaseColId);
  const rawData = activeDataset?.values as number[] || [];
  const idData = idDataset?.values || [];
  const phaseData = phaseDataset?.values || [];
  const formatChartValue = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value ?? '--';
    return useScientificNotation ? numeric.toExponential(decimalPlaces) : numeric.toFixed(decimalPlaces);
  };

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

  const buildPhaseSegments = (labels: any[] | null, length: number) => {
    if (!labels || labels.length === 0) return [{ start: 0, end: length - 1, label: 'All Data' }];

    const normalized = Array.from({ length }, (_, i) => {
      const label = labels[i];
      return label === null || label === undefined || String(label).trim() === '' ? 'Unspecified' : String(label);
    });

    const segments: Array<{ start: number; end: number; label: string }> = [];
    let start = 0;
    for (let i = 1; i < length; i++) {
      if (normalized[i] !== normalized[i - 1]) {
        segments.push({ start, end: i - 1, label: normalized[i - 1] });
        start = i;
      }
    }
    segments.push({ start, end: length - 1, label: normalized[length - 1] });
    return segments;
  };

  const phaseBreaksFromPoints = (points: any[]) => {
    const breaks: Array<{ id: any; label: string }> = [];
    for (let i = 1; i < points.length; i++) {
      if (points[i].phaseKey !== points[i - 1].phaseKey) {
        breaks.push({ id: points[i].id, label: points[i].phase });
      }
    }
    return breaks;
  };

  const applyNelsonRules = (values: number[], labels: any[], center: number, upper: number, lower: number) => {
    const sigma = Math.max(Math.abs(upper - center), Math.abs(center - lower)) / 3;
    const points: any[] = [];
    const chartViolations: any[] = [];

    values.forEach((val, i) => {
      const rules: string[] = [];

      if (val > upper || val < lower) rules.push('Rule 1 (Beyond control limits)');

      if (i >= 8) {
        const window = values.slice(i - 8, i + 1);
        if (window.every(v => v > center) || window.every(v => v < center)) {
          rules.push('Rule 2 (9 points on one side)');
        }
      }

      if (i >= 5) {
        const window = values.slice(i - 5, i + 1);
        const increasing = window.every((v, idx) => idx === 0 || v > window[idx - 1]);
        const decreasing = window.every((v, idx) => idx === 0 || v < window[idx - 1]);
        if (increasing || decreasing) rules.push('Rule 3 (6 increasing or decreasing)');
      }

      if (i >= 13) {
        const window = values.slice(i - 13, i + 1);
        const alternating = window.every((v, idx) => {
          if (idx < 2) return true;
          const lastMove = Math.sign(window[idx - 1] - window[idx - 2]);
          const thisMove = Math.sign(v - window[idx - 1]);
          return lastMove !== 0 && thisMove !== 0 && thisMove === -lastMove;
        });
        if (alternating) rules.push('Rule 4 (14 alternating up and down)');
      }

      if (sigma > 0 && i >= 2) {
        const window = values.slice(i - 2, i + 1);
        const highCount = window.filter(v => v > center + 2 * sigma).length;
        const lowCount = window.filter(v => v < center - 2 * sigma).length;
        if (highCount >= 2 || lowCount >= 2) rules.push('Rule 5 (2 of 3 beyond 2 sigma)');
      }

      if (sigma > 0 && i >= 4) {
        const window = values.slice(i - 4, i + 1);
        const highCount = window.filter(v => v > center + sigma).length;
        const lowCount = window.filter(v => v < center - sigma).length;
        if (highCount >= 4 || lowCount >= 4) rules.push('Rule 6 (4 of 5 beyond 1 sigma)');
      }

      if (sigma > 0 && i >= 14) {
        const window = values.slice(i - 14, i + 1);
        if (window.every(v => Math.abs(v - center) < sigma)) {
          rules.push('Rule 7 (15 within 1 sigma)');
        }
      }

      if (sigma > 0 && i >= 7) {
        const window = values.slice(i - 7, i + 1);
        if (window.every(v => Math.abs(v - center) > sigma) && window.some(v => v > center) && window.some(v => v < center)) {
          rules.push('Rule 8 (8 outside 1 sigma)');
        }
      }

      const rule = rules.join('; ');
      const point = { id: labels[i], val, isViolation: rules.length > 0, rule };
      if (point.isViolation) chartViolations.push({ index: labels[i], rule, val });
      points.push(point);
    });

    return { points, violations: chartViolations };
  };

  const applySegmentLimits = (
    values: number[],
    labels: any[],
    phaseLabels: any[] | null,
    limitForSegment: (segmentValues: number[], segmentStart: number, segmentEnd: number) => { mean: number; ucl: number; lcl: number },
    useNelsonRules: boolean
  ) => {
    if (values.length === 0) return { points: [], violations: [], phases: [], phaseBreaks: [] };
    const segments = buildPhaseSegments(phaseLabels, values.length);
    const points: any[] = [];
    const violations: any[] = [];
    const phases: any[] = [];

    segments.forEach((segment, segmentIndex) => {
      const segmentValues = values.slice(segment.start, segment.end + 1);
      const segmentLabels = labels.slice(segment.start, segment.end + 1);
      const limits = limitForSegment(segmentValues, segment.start, segment.end);
      const checked = useNelsonRules
        ? applyNelsonRules(segmentValues, segmentLabels, limits.mean, limits.ucl, limits.lcl)
        : {
            points: segmentValues.map((val, i) => {
              const isViolation = val > limits.ucl || val < limits.lcl;
              return {
                id: segmentLabels[i],
                val,
                isViolation,
                rule: isViolation ? 'Rule 1 (Beyond control limits)' : ''
              };
            }),
            violations: segmentValues
              .map((val, i) => ({ index: segmentLabels[i], rule: 'Rule 1 (Beyond control limits)', val, isViolation: val > limits.ucl || val < limits.lcl }))
              .filter(v => v.isViolation)
          };

      checked.points.forEach((point: any) => {
        points.push({
          ...point,
          mean: limits.mean,
          ucl: limits.ucl,
          lcl: limits.lcl,
          phase: segment.label,
          phaseKey: `${segmentIndex}-${segment.label}`
        });
      });
      violations.push(...checked.violations.map((v: any) => ({ ...v, phase: segment.label })));
      phases.push({ ...segment, ...limits, phaseKey: `${segmentIndex}-${segment.label}` });
    });

    return { points, violations, phases, phaseBreaks: phaseBreaksFromPoints(points) };
  };

  // SPC calculation engine with Nelson rules for primary variable charts.
  const spcData = useMemo(() => {
    if (!rawData.length) return null;
    const phaseLabels = phaseColId ? phaseData : null;
    
    let mean = 0;
    let ucl = 0, lcl = 0;
    let points = [];
    let violations = [];
    let secondary: any = null;
    let phases: any[] = [];
    let phaseBreaks: any[] = [];

    // I-MR Logic (Rule 1, 2, 3)
    if (chartType === 'imr') {
      const primaryCheck = applySegmentLimits(
        rawData,
        rawData.map((_, i) => i + 1),
        phaseLabels,
        segmentValues => {
          const segmentMean = segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length;
          const segmentMrs = [];
          for (let i = 1; i < segmentValues.length; i++) segmentMrs.push(Math.abs(segmentValues[i] - segmentValues[i - 1]));
          const segmentMrBar = segmentMrs.length > 0 ? segmentMrs.reduce((a, b) => a + b, 0) / segmentMrs.length : 0;
          const sigma = segmentMrBar / 1.128;
          return { mean: segmentMean, ucl: segmentMean + 3 * sigma, lcl: segmentMean - 3 * sigma };
        },
        true
      );
      points = primaryCheck.points;
      violations = primaryCheck.violations;
      phases = primaryCheck.phases;
      phaseBreaks = primaryCheck.phaseBreaks;
      mean = phases[phases.length - 1]?.mean || 0;
      ucl = phases[phases.length - 1]?.ucl || 0;
      lcl = phases[phases.length - 1]?.lcl || 0;

      // MR Chart (Secondary)
      // d4 for n=2 is 3.267, d3 is 0
      const mrValues: number[] = [];
      const mrLabels: any[] = [];
      const mrPhases: any[] = [];
      for (let i = 1; i < rawData.length; i++) {
        if (!phaseLabels || String(phaseLabels[i] ?? 'Unspecified') === String(phaseLabels[i - 1] ?? 'Unspecified')) {
          mrValues.push(Math.abs(rawData[i] - rawData[i - 1]));
          mrLabels.push(i + 1);
          mrPhases.push(phaseLabels ? phaseLabels[i] : 'All Data');
        }
      }
      const mrCheck = applySegmentLimits(
        mrValues,
        mrLabels,
        phaseLabels ? mrPhases : null,
        segmentValues => {
          const segmentMrBar = segmentValues.length > 0 ? segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length : 0;
          return { mean: segmentMrBar, ucl: 3.267 * segmentMrBar, lcl: 0 };
        },
        false
      );
      secondary = {
        title: 'Moving Range (MR) Chart',
        mean: mrCheck.phases[mrCheck.phases.length - 1]?.mean || 0,
        ucl: mrCheck.phases[mrCheck.phases.length - 1]?.ucl || 0,
        lcl: 0,
        points: mrCheck.points,
        phases: mrCheck.phases,
        phaseBreaks: mrCheck.phaseBreaks
      };
    }

    // Xbar-R Logic
    if (chartType === 'xbar') {
      let subgroups: number[][] = [];
      let subgroupLabels: any[] = [];
      let subgroupPhaseLabels: any[] = [];

      if (subgroupMode === 'fixed') {
        const n = Math.max(2, Math.min(10, subgroupSize));
        if (phaseLabels) {
          const segments = buildPhaseSegments(phaseLabels, rawData.length);
          segments.forEach(segment => {
            for (let i = segment.start; i <= segment.end; i += n) {
              const group = rawData.slice(i, Math.min(i + n, segment.end + 1));
              if (group.length === n) {
                subgroups.push(group);
                subgroupLabels.push(subgroups.length);
                subgroupPhaseLabels.push(segment.label);
              }
            }
          });
        } else {
          for (let i = 0; i < rawData.length; i += n) {
            const group = rawData.slice(i, i + n);
            if (group.length === n) {
              subgroups.push(group);
              subgroupLabels.push(Math.floor(i / n) + 1);
              subgroupPhaseLabels.push('All Data');
            }
          }
        }
      } else {
        const groups: { [key: string]: { values: number[]; phase: string } } = {};
        const labels: string[] = [];
        rawData.forEach((val, i) => {
          const label = idData[i] !== undefined ? String(idData[i]) : `Group ${Math.floor(i/5)+1}`;
          if (!groups[label]) {
            groups[label] = { values: [], phase: phaseLabels ? String(phaseLabels[i] ?? 'Unspecified') : 'All Data' };
            labels.push(label);
          }
          groups[label].values.push(val);
        });
        labels.forEach(label => {
          if (groups[label].values.length >= 2 && groups[label].values.length <= 10) {
            subgroups.push(groups[label].values);
            subgroupLabels.push(label);
            subgroupPhaseLabels.push(groups[label].phase);
          }
        });
      }

      if (subgroups.length === 0) return null;

      const xbars = subgroups.map(g => g.reduce((a, b) => a + b, 0) / g.length);
      const ranges = subgroups.map(g => Math.max(...g) - Math.min(...g));
      
      const primaryCheck = applySegmentLimits(
        xbars,
        subgroupLabels,
        phaseLabels ? subgroupPhaseLabels : null,
        (segmentValues, segmentStart, segmentEnd) => {
          const segmentRanges = ranges.slice(segmentStart, segmentEnd + 1).filter(Number.isFinite);
          const xbarBar = segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length;
          const rBar = segmentRanges.length > 0 ? segmentRanges.reduce((a, b) => a + b, 0) / segmentRanges.length : 0;
          const avgN = Math.round(subgroups.reduce((a, b) => a + b.length, 0) / subgroups.length);
          const n = Math.max(2, Math.min(10, avgN));
          const constants = XBAR_CONSTANTS[n] || XBAR_CONSTANTS[5];
          return { mean: xbarBar, ucl: xbarBar + constants.a2 * rBar, lcl: xbarBar - constants.a2 * rBar };
        },
        true
      );
      points = primaryCheck.points;
      violations = primaryCheck.violations;
      phases = primaryCheck.phases;
      phaseBreaks = primaryCheck.phaseBreaks;
      mean = phases[phases.length - 1]?.mean || 0;
      ucl = phases[phases.length - 1]?.ucl || 0;
      lcl = phases[phases.length - 1]?.lcl || 0;

      // R Chart (Secondary)
      const rCheck = applySegmentLimits(
        ranges,
        subgroupLabels,
        phaseLabels ? subgroupPhaseLabels : null,
        segmentValues => {
          const rBar = segmentValues.length > 0 ? segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length : 0;
          const avgN = Math.round(subgroups.reduce((a, b) => a + b.length, 0) / subgroups.length);
          const n = Math.max(2, Math.min(10, avgN));
          const constants = XBAR_CONSTANTS[n] || XBAR_CONSTANTS[5];
          return { mean: rBar, ucl: constants.d4 * rBar, lcl: constants.d3 * rBar };
        },
        false
      );
      secondary = {
        title: 'Range (R) Chart',
        mean: rCheck.phases[rCheck.phases.length - 1]?.mean || 0,
        ucl: rCheck.phases[rCheck.phases.length - 1]?.ucl || 0,
        lcl: rCheck.phases[rCheck.phases.length - 1]?.lcl || 0,
        points: rCheck.points,
        phases: rCheck.phases,
        phaseBreaks: rCheck.phaseBreaks
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

      const attributeCheck = applySegmentLimits(
        rawData,
        rawData.map((_, i) => i + 1),
        phaseLabels,
        segmentValues => {
          const segmentMean = segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length;
          if (chartType === 'p' || chartType === 'u') {
            const sigma = Math.sqrt(Math.max(segmentMean * (1 - segmentMean), 0) / subgroupSize);
            const sigmaU = Math.sqrt(Math.max(segmentMean, 0) / subgroupSize);
            return {
              mean: segmentMean,
              ucl: chartType === 'p' ? segmentMean + 3 * sigma : segmentMean + 3 * sigmaU,
              lcl: Math.max(0, chartType === 'p' ? segmentMean - 3 * sigma : segmentMean - 3 * sigmaU)
            };
          }
          const sigmaNP = Math.sqrt(Math.max(segmentMean * (1 - (segmentMean / subgroupSize)), 0));
          const sigmaC = Math.sqrt(Math.max(segmentMean, 0));
          return {
            mean: segmentMean,
            ucl: chartType === 'np' ? segmentMean + 3 * sigmaNP : segmentMean + 3 * sigmaC,
            lcl: Math.max(0, chartType === 'np' ? segmentMean - 3 * sigmaNP : segmentMean - 3 * sigmaC)
          };
        },
        false
      );
      points = attributeCheck.points;
      violations = attributeCheck.violations;
      phases = attributeCheck.phases;
      phaseBreaks = attributeCheck.phaseBreaks;
      mean = phases[phases.length - 1]?.mean || mean;
      ucl = phases[phases.length - 1]?.ucl || ucl;
      lcl = phases[phases.length - 1]?.lcl || lcl;
    }

    return { mean, ucl, lcl, points, violations, secondary, phases, phaseBreaks };
  }, [rawData, idData, phaseData, phaseColId, chartType, subgroupMode, subgroupSize]);

  const ControlChartComponent = ({ data, title, subtitle }: { data: any, title?: string, subtitle?: string }) => {
    if (!data) return null;
    const yValues = data.points.map((point: any) => Number(point.val)).filter(Number.isFinite);
    const limitValues = data.points.flatMap((point: any) => [point.lcl, point.mean, point.ucl]).map(Number).filter(Number.isFinite);
    const yBaseMin = Math.min(...yValues, ...limitValues, data.lcl, data.mean, data.ucl);
    const yBaseMax = Math.max(...yValues, ...limitValues, data.lcl, data.mean, data.ucl);
    const yRange = yBaseMax - yBaseMin;
    const yPadding = yRange > 0 ? yRange * 0.18 : Math.max(Math.abs(yBaseMax) * 0.02, 1);
    const yDomain = [yBaseMin - yPadding, yBaseMax + yPadding];
    const hasPhaseLimits = (data.phases?.length || 0) > 1;

    return (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-[380px] flex flex-col">
        <div className="mb-2">
          {title && <h3 className="text-sm font-bold text-slate-100">{title}</h3>}
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
          {hasPhaseLimits && <p className="text-[10px] text-indigo-300">Control limits recalculated by phase.</p>}
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
                domain={yDomain} 
                tickFormatter={formatChartValue}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                formatter={(value: any, name: any) => [formatChartValue(value), name === 'val' ? 'Value' : String(name).toUpperCase()]}
                labelFormatter={(label) => {
                  const point = data.points.find((p: any) => p.id === label);
                  return point?.phase ? `Point ${label} | Phase: ${point.phase}` : `Point ${label}`;
                }}
              />
              {hasPhaseLimits ? (
                <>
                  {data.phaseBreaks?.map((phaseBreak: any, i: number) => (
                    <ReferenceLine
                      key={`${phaseBreak.id}-${i}`}
                      x={phaseBreak.id}
                      stroke="#818cf8"
                      strokeDasharray="3 3"
                      label={{ value: phaseBreak.label, fill: '#a5b4fc', fontSize: 10, position: 'top' }}
                    />
                  ))}
                  <Line type="stepAfter" dataKey="ucl" name="UCL" stroke="#ef4444" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="mean" name="CL" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="lcl" name="LCL" stroke="#ef4444" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <ReferenceLine 
                    y={data.ucl} 
                    stroke="#ef4444" 
                    strokeDasharray="5 5" 
                    label={{ 
                      position: 'right', 
                      value: `UCL: ${formatChartValue(data.ucl)}`, 
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
                      value: `CL: ${formatChartValue(data.mean)}`, 
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
                      value: `LCL: ${formatChartValue(data.lcl)}`, 
                      fill: '#ef4444', 
                      fontSize: 10, 
                      fontWeight: 'bold',
                      offset: 10
                    }} 
                  />
                </>
              )}
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

  const ChartStatusMessage = ({ data, chartName }: { data: any, chartName: string }) => {
    if (!data?.points?.length) return null;
    const chartViolations = data.points.filter((point: any) => point.isViolation);

    if (chartViolations.length === 0) {
      return (
        <div className="bg-emerald-900/20 border border-emerald-500/40 p-3 rounded-lg">
          <h3 className="text-emerald-400 font-bold text-sm mb-1">Process Stable on {chartName}</h3>
          <p className="text-xs text-slate-300">No control-limit or run-rule signals were detected on this chart.</p>
        </div>
      );
    }

    return (
      <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-lg">
        <h3 className="text-red-400 font-bold text-sm mb-2">Process Out of Control on {chartName}</h3>
        <ul className="text-xs text-slate-300 space-y-1">
          {chartViolations.slice(0, 5).map((v: any, i: number) => (
            <li key={i}>Point {v.id}: {v.rule} (Value: {formatChartValue(v.val)})</li>
          ))}
          {chartViolations.length > 5 && <li>...and {chartViolations.length - 5} more signals on this chart.</li>}
        </ul>
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

          <div className="pt-2 border-t border-slate-700">
            <label className="block text-xs text-slate-400 mb-1">Phase Column (Optional)</label>
            <select
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
              value={phaseColId}
              onChange={e => setPhaseColId(e.target.value)}
            >
              <option value="">No phases</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">When selected, limits are recalculated each time the phase value changes down the rows.</p>
          </div>

          <div className="pt-2 border-t border-slate-700 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chart Number Format</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Decimal Places</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-8 h-8 rounded bg-slate-900 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
                  onClick={() => setDecimalPlaces(prev => Math.max(0, prev - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max="8"
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white text-center"
                  value={decimalPlaces}
                  onChange={e => setDecimalPlaces(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)))}
                />
                <button
                  type="button"
                  className="w-8 h-8 rounded bg-slate-900 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
                  onClick={() => setDecimalPlaces(prev => Math.min(8, prev + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUseScientificNotation(prev => !prev)}
              className={`w-full p-2 rounded border text-xs font-bold transition-colors ${useScientificNotation ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:text-white'}`}
            >
              {useScientificNotation ? 'Scientific Notation On' : 'Scientific Notation Off'}
            </button>
            <p className="text-[10px] text-slate-500">Applies to axis labels, tooltips, and control-limit labels.</p>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Rules Checked</h3>
            {['imr', 'xbar'].includes(chartType) ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-indigo-300 uppercase mb-1">
                    {chartType === 'imr' ? 'Individuals Chart' : 'Xbar Chart'}
                  </div>
                  <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                    <li>1 point beyond a control limit</li>
                    <li>9 points in a row on the same side of center</li>
                    <li>6 points in a row increasing or decreasing</li>
                    <li>14 points alternating up and down</li>
                    <li>2 of 3 points beyond 2 sigma on the same side</li>
                    <li>4 of 5 points beyond 1 sigma on the same side</li>
                    <li>15 points in a row within 1 sigma of center</li>
                    <li>8 points in a row outside 1 sigma, both sides represented</li>
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-cyan-300 uppercase mb-1">
                    {chartType === 'imr' ? 'Moving Range Chart' : 'Range Chart'}
                  </div>
                  <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                    <li>1 point beyond a control limit</li>
                  </ul>
                </div>
              </div>
            ) : (
              <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                <li>1 point beyond a control limit</li>
              </ul>
            )}
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
                  <ChartStatusMessage
                    data={spcData}
                    chartName={
                      chartType === 'imr' ? 'Individuals Chart' :
                      chartType === 'xbar' ? 'Xbar Chart' :
                      `${chartType.toUpperCase()} Chart`
                    }
                  />
                  {spcData.secondary && (
                    <>
                      <ControlChartComponent 
                        data={spcData.secondary} 
                        title={`${spcData.secondary.title} of ${responseLabel || activeDataset?.name || 'Data'}`} 
                        subtitle={chartType === 'xbar' ? `Subgroup size = ${subgroupSize}` : undefined}
                      />
                      <ChartStatusMessage
                        data={spcData.secondary}
                        chartName={chartType === 'imr' ? 'Moving Range Chart' : 'Range Chart'}
                      />
                    </>
                  )}
                </div>
              </ExportWrapper>

              {false && (
                <ExportWrapper fileName="control-chart-violations-unused">
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
