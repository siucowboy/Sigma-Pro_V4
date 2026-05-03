import React, { useState, useMemo } from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  ReferenceLine, 
  Tooltip, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  Cell,
  Legend,
  ComposedChart
} from 'recharts';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Activity, TrendingUp, Zap } from 'lucide-react';
import * as jStatModule from 'jstat';
const jStat: any = (jStatModule as any).default?.jStat || (jStatModule as any).jStat || (jStatModule as any).default || jStatModule;

import * as Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

import { 
  run1SampleTTest, 
  run1SampleZTest,
  run1SampleWilcoxon,
  run2SampleTTest, 
  calculateAndersonDarling, 
  generateQQData, 
  run1SampleVarianceTest,
  runBartlettTest,
  runFTest, 
  runLeveneTest, 
  runMannWhitneyU, 
  runANOVA,
  runKruskalWallis,
  runWelchANOVA,
  runTukeyHSD,
  runNemenyi,
  runChiSquareGoodnessOfFit,
  runChiSquareIndependence,
  run1SampleProportion,
  run2SampleProportion,
  run1SamplePoisson,
  run2SamplePoisson,
  getConfidenceInterval, 
  getMedianConfidenceInterval,
  getVarianceConfidenceInterval,
  getMean,
  getStdDev,
  getPercentile,
  sampleData
} from '../lib/stats';

// --- Sub-components for cleaner UI ---
const formatPropValue = (val: any, decimals: number = 4) => {
  if (typeof val !== 'number' || isNaN(val)) return '--';
  if (val === 0) return (0).toFixed(decimals);
  if (Math.abs(val) < 0.001) return val.toExponential(decimals);
  return val.toFixed(decimals);
};

const DiagnosticIndicator = ({ label, passed, pValue }: { label: string, passed: boolean, pValue: number }) => (
  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700">
    <div>
      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">{label}</div>
      <div className="text-sm font-mono text-slate-300">p = {pValue.toFixed(4)}</div>
    </div>
    {passed ? (
      <div className="flex flex-col items-center text-green-400">
        <CheckCircle2 size={24} />
        <span className="text-[10px] font-bold mt-1">PASS</span>
      </div>
    ) : (
      <div className="flex flex-col items-center text-red-400">
        <XCircle size={24} />
        <span className="text-[10px] font-bold mt-1">FAIL</span>
      </div>
    )}
  </div>
);

import ExportWrapper from './ExportWrapper';

export default function HypothesisModule({ datasets }: { datasets: any[] }) {
  const [activeTab, setActiveTab] = useState('1-sample');
  
  // 1-Sample Props
  const [s1DataId, setS1DataId] = useState('');
  const [s1Label, setS1Label] = useState('Sample 1');
  const [s1Target, setS1Target] = useState<number | ''>(0);
  const [s1Alt, setS1Alt] = useState('neq');

  // 2-Sample Props
  const [s2InputType, setS2InputType] = useState<'unstacked' | 'stacked'>('unstacked');
  const [s2Data1Id, setS2Data1Id] = useState('');
  const [s2Data2Id, setS2Data2Id] = useState('');
  const [s2Label1, setS2Label1] = useState('Sample 1');
  const [s2Label2, setS2Label2] = useState('Sample 2');
  const [s2ValueId, setS2ValueId] = useState('');
  const [s2GroupId, setS2GroupId] = useState('');
  const [s2Alt, setS2Alt] = useState('neq');

  const tabs = [
    { id: '1-sample', label: '1-Sample' },
    { id: '2-sample', label: 'Two-Sample Analysis' },
    { id: 'anova', label: '3 or more' },
    { id: 'variance', label: 'Variance Testing' },
    { id: 'chi-square', label: 'Chi-Squared' },
    { id: 'proportion', label: 'Proportions' },
    { id: 'poisson', label: 'Poisson' }
  ];

  // Chi-Square State
  const [chiType, setChiType] = useState<'gof' | 'independence'>('independence');
  const [chiLabelR, setChiLabelR] = useState('Rows');
  const [chiLabelC, setChiLabelC] = useState('Columns');
  const [chiObsText, setChiObsText] = useState('20, 30\n35, 15');
  const [chiGOFObs, setChiGOFObs] = useState('50, 45, 60');
  const [chiGOFExp, setChiGOFExp] = useState('51.6, 51.6, 51.6');
  const [chiAlt, setChiAlt] = useState('neq');

  // Proportion State
  const [propType, setPropType] = useState<'1samp' | '2samp'>('1samp');
  const [pLabel1, setPLabel1] = useState('Sample A');
  const [pLabel2, setPLabel2] = useState('Sample B');
  const [pUnits1, setPUnits1] = useState<number | ''>(100);
  const [pOpps1, setPOpps1] = useState<number | ''>(1);
  const [pEvents1, setPEvents1] = useState<number | ''>(30);
  
  const [pUnits2, setPUnits2] = useState<number | ''>(1000000);
  const [pOpps2, setPOpps2] = useState<number | ''>(1);
  const [pEvents2, setPEvents2] = useState<number | ''>(60);
  
  const [pTarget, setPTarget] = useState<number | ''>(0.35);
  const [pPooled, setPPooled] = useState(true);
  const [propAlt, setPropAlt] = useState('neq');

  // Variance State
  const [varType, setVarType] = useState<'1samp' | '2samp' | 'multi'>('2samp');
  const [varInputType, setVarInputType] = useState<'unstacked' | 'stacked'>('unstacked');
  const [varData1Id, setVarData1Id] = useState('');
  const [varData2Id, setVarData2Id] = useState('');
  const [varValueId, setVarValueId] = useState('');
  const [varGroupId, setVarGroupId] = useState('');
  const [varMultiIds, setVarMultiIds] = useState<string[]>([]);
  const [varTarget, setVarTarget] = useState<number | ''>(1);
  const [varAlt, setVarAlt] = useState('neq');

  // Poisson State
  const [poiType, setPoiType] = useState<'1samp' | '2samp'>('1samp');
  const [poiLabel1, setPoiLabel1] = useState('Sample 1');
  const [poiLabel2, setPoiLabel2] = useState('Sample 2');
  const [poiEvents1, setPoiEvents1] = useState<number | ''>(15);
  const [poiSize1, setPoiSize1] = useState<number | ''>(100);
  const [poiEvents2, setPoiEvents2] = useState<number | ''>(18);
  const [poiSize2, setPoiSize2] = useState<number | ''>(100);
  const [poiTargetRate, setPoiTargetRate] = useState<number | ''>(0.12);
  const [poiAlt, setPoiAlt] = useState('neq');

  // ANOVA State
  const [alpha, setAlpha] = useState(0.05);
  const [anovaInputType, setAnovaInputType] = useState<'stacked' | 'unstacked'>('stacked');
  const [anovaValueId, setAnovaValueId] = useState('');
  const [anovaGroupId, setAnovaGroupId] = useState('');
  const [anovaMultiIds, setAnovaMultiIds] = useState<string[]>(['', '', '']);
  const [anovaCustomLabels, setAnovaCustomLabels] = useState<string[]>(['Group 1', 'Group 2', 'Group 3']);

  const [anovaAlt, setAnovaAlt] = useState('neq');

  // --- 1-Sample Calculations ---
  const s1Results = useMemo(() => {
    if (activeTab !== '1-sample' || !s1DataId || s1Target === '') return null;
    const data = datasets.find(d => d.id === s1DataId)?.values.filter((v: any) => typeof v === 'number' && !isNaN(v)) || [];
    if (data.length < 2) return null;
    
    const norm = calculateAndersonDarling(data);
    const isNormal = norm.pValue > 0.05;
    const n = data.length;
    
    let res;
    let testUsed = '';
    
    if (!isNormal) {
      res = run1SampleWilcoxon(data, Number(s1Target), s1Alt);
      testUsed = '1-Sample Wilcoxon (Non-Normal)';
    } else if (n > 30) {
      res = run1SampleZTest(data, Number(s1Target), s1Alt);
      testUsed = '1-Sample Z-Test (Normal, N > 30)';
    } else {
      res = run1SampleTTest(data, Number(s1Target), s1Alt);
      testUsed = '1-Sample T-Test (Normal, N ≤ 30)';
    }
    
    const ci = getConfidenceInterval(data, 1 - alpha);
    return { ...res, data, ci, norm, isNormal, testUsed, label: s1Label, significant: res.pValue < alpha };
  }, [activeTab, s1DataId, s1Target, s1Alt, datasets, alpha, s1Label]);

  // --- 2-Sample Calculations & Diagnostics ---
  const s2Analysis = useMemo(() => {
    if (activeTab !== '2-sample') return null;

    let data1: number[] = [];
    let data2: number[] = [];
    let name1 = s2Label1;
    let name2 = s2Label2;

    if (s2InputType === 'unstacked') {
      const d1 = datasets.find(d => d.id === s2Data1Id);
      const d2 = datasets.find(d => d.id === s2Data2Id);
      if (!d1 || !d2) return null;
      data1 = d1.values.filter((v: any) => typeof v === 'number' && !isNaN(v));
      data2 = d2.values.filter((v: any) => typeof v === 'number' && !isNaN(v));
      // Use custom labels if provided, otherwise dataset names
      if (name1 === 'Sample 1') name1 = d1.name;
      if (name2 === 'Sample 2') name2 = d2.name;
    } else {
      const valCol = datasets.find(d => d.id === s2ValueId);
      const grpCol = datasets.find(d => d.id === s2GroupId);
      if (!valCol || !grpCol) return null;
      
      const groups = [...new Set(grpCol.values)].filter(g => g !== null && g !== undefined);
      if (groups.length < 2) return null;
      
      // Use custom labels as overrides if they aren't the defaults
      name1 = s2Label1 !== 'Sample 1' ? s2Label1 : String(groups[0]);
      name2 = s2Label2 !== 'Sample 2' ? s2Label2 : String(groups[1]);
      
      valCol.values.forEach((v: any, i: number) => {
        if (typeof v === 'number' && !isNaN(v)) {
          if (grpCol.values[i] === groups[0]) data1.push(v);
          else if (grpCol.values[i] === groups[1]) data2.push(v);
        }
      });
    }

  if (data1.length < 2 || data2.length < 3) return null;

  // 1. Normality (Anderson-Darling)
  const norm1 = calculateAndersonDarling(data1);
  const norm2 = calculateAndersonDarling(data2);
  const isNormal = norm1.pValue > alpha && norm2.pValue > alpha;

  // 2. Variance (F-Test if Normal, Levene if not)
  const varTest = isNormal ? runFTest(data1, data2) : runLeveneTest([data1, data2]);
  const equalVar = varTest.pValue > alpha;

  // 3. Select Final Test
  let testType = '';
  let results: any = null;
  let ci: any = null;

  const m1 = getMean(data1);
  const m2 = getMean(data2);
  const s1 = getStdDev(data1);
  const s2 = getStdDev(data2);

    if (!isNormal) {
      testType = 'Mann-Whitney U (Non-Parametric)';
      results = runMannWhitneyU(data1, data2, s2Alt);
      const ci1 = getMedianConfidenceInterval(data1, 1 - alpha);
      const ci2 = getMedianConfidenceInterval(data2, 1 - alpha);
      ci = { 
        data: [
          { name: name1, mean: ci1.median, lcl: ci1.lcl, ucl: ci1.ucl, range: [ci1.lcl, ci1.ucl] },
          { name: name2, mean: ci2.median, lcl: ci2.lcl, ucl: ci2.ucl, range: [ci2.lcl, ci2.ucl] }
        ],
        type: 'Medians'
      };
    } else if (equalVar) {
      testType = "Student's T-Test (Equal Variance)";
      results = run2SampleTTest(data1, data2, s2Alt, true);
      const ci1 = getConfidenceInterval(data1, 1 - alpha);
      const ci2 = getConfidenceInterval(data2, 1 - alpha);
      ci = {
        data: [
          { name: name1, mean: ci1.mean, lcl: ci1.lcl, ucl: ci1.ucl, range: [ci1.lcl, ci1.ucl] },
          { name: name2, mean: ci2.mean, lcl: ci2.lcl, ucl: ci2.ucl, range: [ci2.lcl, ci2.ucl] }
        ],
        type: 'Means'
      };
    } else {
      testType = "Welch's T-Test (Unequal Variance)";
      results = run2SampleTTest(data1, data2, s2Alt, false);
      const ci1 = getConfidenceInterval(data1, 1 - alpha);
      const ci2 = getConfidenceInterval(data2, 1 - alpha);
      ci = {
        data: [
          { name: name1, mean: ci1.mean, lcl: ci1.lcl, ucl: ci1.ucl, range: [ci1.lcl, ci1.ucl] },
          { name: name2, mean: ci2.mean, lcl: ci2.lcl, ucl: ci2.ucl, range: [ci2.lcl, ci2.ucl] }
        ],
        type: 'Means'
      };
    }

    // QQ Plot Data
    const qq1 = generateQQData(data1);
    const qq2 = generateQQData(data2);

    // SD CI Data
    const sdCi1 = getVarianceConfidenceInterval(data1, 1 - alpha);
    const sdCi2 = getVarianceConfidenceInterval(data2, 1 - alpha);
    const varCiData = [
      { name: name1, mean: sdCi1.sd, lcl: sdCi1.sdLcl, ucl: sdCi1.sdUcl, range: [sdCi1.sdLcl, sdCi1.sdUcl] },
      { name: name2, mean: sdCi2.sd, lcl: sdCi2.sdLcl, ucl: sdCi2.sdUcl, range: [sdCi2.sdLcl, sdCi2.sdUcl] }
    ];

    const significant = results.pValue < alpha;

    return {
      data1, data2, name1, name2,
      label1: s2Label1, label2: s2Label2,
      norm1, norm2, isNormal,
      varTest, equalVar, varTestType: isNormal ? 'F-Test' : "Levene's Test",
      testType, results, ci,
      stats: {
        n1: data1.length, n2: data2.length,
        m1, m2, s1, s2,
        v1: s1 * s1, v2: s2 * s2,
        med1: getPercentile([...data1].sort((a,b)=>a-b), 0.5),
        med2: getPercentile([...data2].sort((a,b)=>a-b), 0.5),
      },
      varCiData,
      qq1, qq2,
      significant
    };
  }, [activeTab, s2InputType, s2Data1Id, s2Data2Id, s2ValueId, s2GroupId, s2Alt, datasets, alpha, s2Label1, s2Label2]);

  // --- ANOVA Calculations & Diagnostics ---
  const anovaAnalysis = useMemo(() => {
    if (activeTab !== 'anova') return null;

    let groups: { name: string, data: number[] }[] = [];

    if (anovaInputType === 'stacked') {
      const valCol = datasets.find(d => d.id === anovaValueId);
      const grpCol = datasets.find(d => d.id === anovaGroupId);
      if (valCol && grpCol) {
        const uniqueGroups = [...new Set(grpCol.values)].filter(g => g !== null && g !== undefined && g !== '');
        groups = uniqueGroups.map(g => ({
          name: String(g),
          data: valCol.values
            .filter((_: any, i: number) => grpCol.values[i] === g)
            .map((v: any) => Number(v))
            .filter((v: any) => !isNaN(v))
        })).filter(g => g.data.length >= 2);
      }
    } else {
      groups = anovaMultiIds
        .map((id, idx) => {
          const ds = datasets.find(d => d.id === id);
          if (!ds) return { name: '', data: [] };
          return {
            name: anovaCustomLabels[idx] || ds.name,
            data: ds.values.map((v: any) => Number(v)).filter((v: any) => !isNaN(v))
          };
        })
        .filter(g => g.data.length >= 2);
    }

    if (groups.length < 2) return null;

    const groupDataArray = groups.map(g => g.data);
    const normalityResults = groups.map(g => ({
      name: g.name,
      ...calculateAndersonDarling(g.data)
    }));
    const isNormal = normalityResults.every(r => r.pValue > alpha);

    const varianceTest = runLeveneTest(groupDataArray);
    const equalVar = varianceTest.pValue > alpha;

    // Selection Logic:
    // 1. All Normal, Equal Variance -> One-Way ANOVA
    // 2. All Normal, Unequal Variance -> Welch's ANOVA
    // 3. Any Non-Normal -> Kruskal-Wallis
    const anovaRes = runANOVA(groupDataArray);
    const welchRes = runWelchANOVA(groupDataArray);
    const kwRes = runKruskalWallis(groupDataArray);

    let pValue = 0;
    let testUsed = "";
    let testResults: any = null;

    if (isNormal) {
      if (equalVar) {
        pValue = anovaRes.pValue;
        testUsed = 'One-Way ANOVA (Equal Variance)';
        testResults = anovaRes;
      } else {
        pValue = welchRes.pValue;
        testUsed = "Welch's ANOVA (Unequal Variance)";
        testResults = welchRes;
      }
    } else {
      pValue = kwRes.pValue;
      testUsed = 'Kruskal-Wallis (Non-Parametric)';
      testResults = kwRes;
    }

    return {
      groups,
      normalityResults,
      isNormal,
      varianceTest,
      equalVar,
      anovaRes,
      welchRes,
      kwRes,
      pValue,
      testUsed,
      testResults,
      significant: pValue < alpha,
      postHoc: (pValue < alpha) ? (
        isNormal ? 
          { type: 'Tukey', ...runTukeyHSD(groupDataArray, anovaRes.msWithin, anovaRes.dfWithin, groups.map(g => g.name)) } :
          { type: 'Nemenyi', ...runNemenyi(groupDataArray, groups.map(g => g.name)) }
      ) : null
    };
  }, [activeTab, anovaInputType, anovaValueId, anovaGroupId, anovaMultiIds, anovaAlt, alpha, datasets]);

  // --- Variance Test Logic ---
  const varianceAnalysis = useMemo(() => {
    if (activeTab !== 'variance') return null;

    let groups: { name: string, data: number[] }[] = [];

    if (varType === '1samp') {
      const ds = datasets.find(d => d.id === varData1Id);
      if (ds) {
        groups = [{
          name: ds.name,
          data: ds.values.map((v: any) => Number(v)).filter((v: any) => !isNaN(v))
        }];
      }
    } else if (varInputType === 'stacked') {
      const valCol = datasets.find(d => d.id === varValueId);
      const grpCol = datasets.find(d => d.id === varGroupId);
      if (valCol && grpCol) {
        const uniqueGroups = [...new Set(grpCol.values)].filter(g => g !== null && g !== undefined && g !== '');
        groups = uniqueGroups.map(g => ({
          name: String(g),
          data: valCol.values
            .filter((_: any, i: number) => grpCol.values[i] === g)
            .map((v: any) => Number(v))
            .filter((v: any) => !isNaN(v))
        }));
      }
    } else {
      const ids = varType === '2samp' ? [varData1Id, varData2Id] : varMultiIds;
      groups = ids.map(id => {
        const ds = datasets.find(d => d.id === id);
        if (!ds) return { name: '', data: [] };
        return {
          name: ds.name,
          data: ds.values.map((v: any) => Number(v)).filter((v: any) => !isNaN(v))
        };
      }).filter(g => g.data.length > 0);
    }

    if (groups.length === 0) return null;
    if (varType !== '1samp' && groups.length < 2) return null;

    const groupDataArray = groups.map(g => g.data);
    const normalityResults = groups.map(g => ({
      name: g.name,
      ...calculateAndersonDarling(g.data)
    }));
    const isNormal = normalityResults.every(r => r.pValue > alpha);

    let testUsed = "";
    let testResults: any = null;

    if (varType === '1samp') {
      testUsed = "1-Sample Variance Test";
      testResults = run1SampleVarianceTest(groups[0].data, Number(varTarget) || 1, varAlt);
    } else if (isNormal) {
      if (groups.length === 2) {
        testUsed = "F-Test for 2 Variances";
        testResults = runFTest(groups[0].data, groups[1].data, varAlt);
      } else {
        testUsed = "Bartlett's Test (Homogeneity of Variances)";
        testResults = runBartlettTest(groupDataArray);
      }
    } else {
      testUsed = "Levene's Test (Robust for Non-Normal)";
      testResults = runLeveneTest(groupDataArray);
    }

    const ciData = groups.map(g => {
      const ci = getVarianceConfidenceInterval(g.data, 1 - alpha);
      return {
        name: g.name,
        sd: ci.sd,
        lcl: ci.sdLcl,
        ucl: ci.sdUcl,
        range: [ci.sdLcl, ci.sdUcl]
      };
    });

    return {
      groups,
      normalityResults,
      isNormal,
      testUsed,
      testResults,
      ciData,
      pValue: testResults.pValue,
      significant: testResults.pValue < alpha
    };
  }, [activeTab, varType, varInputType, varData1Id, varData2Id, varValueId, varGroupId, varMultiIds, varTarget, varAlt, alpha, datasets]);

  // --- Chi-Squared Calculations ---
  const chiResults = useMemo(() => {
    if (activeTab !== 'chi-square') return null;
    if (chiType === 'gof') {
      const obs = chiGOFObs.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v));
      const exp = chiGOFExp.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v));
      if (obs.length < 2 || obs.length !== exp.length) return null;
      return runChiSquareGoodnessOfFit(obs, exp);
    } else {
      const matrix = chiObsText.split('\n').map(row => row.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v))).filter(r => r.length > 0);
      if (matrix.length < 2 || matrix[0].length < 2) return null;
      return runChiSquareIndependence(matrix);
    }
  }, [activeTab, chiType, chiGOFObs, chiGOFExp, chiObsText, chiAlt]);

  // --- Proportion Calculations ---
  const propResults = useMemo(() => {
    if (activeTab !== 'proportion') return null;
    const n1 = (Number(pUnits1) || 0) * (Number(pOpps1) || 0);
    const n2 = (Number(pUnits2) || 0) * (Number(pOpps2) || 0);

    if (propType === '1samp') {
      if (pEvents1 === '' || n1 <= 0 || pTarget === '') return null;
      const res = run1SampleProportion(Number(pEvents1), n1, Number(pTarget), propAlt, 1 - alpha);
      if (!res) return null;
      return { 
        ...res, 
        label1: pLabel1, 
        label2: 'Target',
        e1: Number(pEvents1),
        n1: n1,
        p1: Number(pEvents1) / n1,
        e2: Number(pTarget) * n1, // Virtual target events for comparison
        n2: n1,
        p2: Number(pTarget),
        ci2: { nominal: Number(pTarget), lower: Number(pTarget), upper: Number(pTarget) }
      };
    } else {
      if (pEvents1 === '' || n1 <= 0 || pEvents2 === '' || n2 <= 0) return null;
      return { ...run2SampleProportion(Number(pEvents1), n1, Number(pEvents2), n2, propAlt, pPooled, 1 - alpha), label1: pLabel1, label2: pLabel2 };
    }
  }, [activeTab, propType, pEvents1, pUnits1, pOpps1, pEvents2, pUnits2, pOpps2, pTarget, propAlt, pPooled, alpha, pLabel1, pLabel2]);

  // --- Poisson Calculations ---
  const poiResults = useMemo(() => {
    if (activeTab !== 'poisson') return null;
    if (poiType === '1samp') {
      if (poiEvents1 === '' || poiSize1 === '' || poiTargetRate === '') return null;
      const res = run1SamplePoisson(Number(poiEvents1), Number(poiSize1), Number(poiTargetRate), poiAlt, 1 - alpha);
      if (!res) return null;
      return { 
        ...res, 
        label1: poiLabel1, 
        label2: 'Target Rate',
        r1: Number(poiEvents1) / Number(poiSize1),
        r2: Number(poiTargetRate),
        ci2: { nominal: Number(poiTargetRate), lower: Number(poiTargetRate), upper: Number(poiTargetRate) }
      };
    } else {
      if (poiEvents1 === '' || poiSize1 === '' || poiEvents2 === '' || poiSize2 === '') return null;
      return { ...run2SamplePoisson(Number(poiEvents1), Number(poiSize1), Number(poiEvents2), Number(poiSize2), poiAlt, 1 - alpha), label1: poiLabel1, label2: poiLabel2 };
    }
  }, [activeTab, poiType, poiEvents1, poiSize1, poiEvents2, poiSize2, poiTargetRate, poiAlt, poiLabel1, poiLabel2]);

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Advanced Hypothesis Engine</h2>
          <p className="text-slate-400 text-sm">Statistical inference with automated diagnostic routing.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Config */}
        <div className="col-span-1 space-y-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-xl">
            <h3 className="font-semibold mb-4 text-sky-400 flex items-center gap-2">
              <HelpCircle size={16} /> Configuration
            </h3>
            
            {activeTab === '1-sample' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Sample Name</label>
                  <input 
                    type="text" 
                    value={s1Label} 
                    onChange={e => setS1Label(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-sky-400"
                    placeholder="Sample 1"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Variable</label>
                  <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={s1DataId} onChange={e => setS1DataId(e.target.value)}>
                    <option value="">Select Data...</option>
                    {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <label className="block text-xs uppercase text-slate-500 font-bold">Null Hypothesis (H₀: μ = X)</label>
                <input type="number" value={s1Target} onChange={e => setS1Target(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" />
                <label className="block text-xs uppercase text-slate-500 font-bold">Alternative (H₁)</label>
                <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s1Alt} onChange={e => setS1Alt(e.target.value)}>
                  <option value="neq">{s1Label} ≠ Target</option>
                  <option value="greater">{s1Label} &gt; Target</option>
                  <option value="less">{s1Label} &lt; Target</option>
                </select>
              </div>
            )}

            {activeTab === '2-sample' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Data Layout</label>
                <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setS2InputType('unstacked')}
                    className={`flex-1 py-1 text-xs rounded transition ${s2InputType === 'unstacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Unstacked
                  </button>
                  <button 
                    onClick={() => setS2InputType('stacked')}
                    className={`flex-1 py-1 text-xs rounded transition ${s2InputType === 'stacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Stacked
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Label 1</label>
                    <input 
                      type="text" 
                      value={s2Label1} 
                      onChange={e => setS2Label1(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Label 2</label>
                    <input 
                      type="text" 
                      value={s2Label2} 
                      onChange={e => setS2Label2(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                    />
                  </div>
                </div>

                {s2InputType === 'unstacked' ? (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Sample 1</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s2Data1Id} onChange={e => setS2Data1Id(e.target.value)}>
                      <option value="">Select Data...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Sample 2</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s2Data2Id} onChange={e => setS2Data2Id(e.target.value)}>
                      <option value="">Select Data...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Value Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s2ValueId} onChange={e => setS2ValueId(e.target.value)}>
                      <option value="">Select Variable...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Group Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s2GroupId} onChange={e => setS2GroupId(e.target.value)}>
                      <option value="">Select Category...</option>
                      {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </>
                )}

                <label className="block text-xs uppercase text-slate-500 font-bold">Alternative (H₁)</label>
                <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s2Alt} onChange={e => setS2Alt(e.target.value)}>
                  <option value="neq">{s2Label1} ≠ {s2Label2}</option>
                  <option value="greater">{s2Label1} &gt; {s2Label2}</option>
                  <option value="less">{s2Label1} &lt; {s2Label2}</option>
                </select>
              </div>
            )}

            {activeTab === 'anova' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Data Layout</label>
                <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setAnovaInputType('stacked')}
                    className={`flex-1 py-1 text-xs rounded transition ${anovaInputType === 'stacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Stacked
                  </button>
                  <button 
                    onClick={() => setAnovaInputType('unstacked')}
                    className={`flex-1 py-1 text-xs rounded transition ${anovaInputType === 'unstacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Multi-Column
                  </button>
                </div>

                {anovaInputType === 'stacked' ? (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Value Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={anovaValueId} onChange={e => setAnovaValueId(e.target.value)}>
                      <option value="">Select Variable...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Group Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={anovaGroupId} onChange={e => setAnovaGroupId(e.target.value)}>
                      <option value="">Select Category...</option>
                      {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs uppercase text-slate-500 font-bold">Data Columns & Labels (Min 3)</label>
                    {anovaMultiIds.map((id, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={anovaCustomLabels[idx]} 
                          onChange={e => {
                            const newLabels = [...anovaCustomLabels];
                            newLabels[idx] = e.target.value;
                            setAnovaCustomLabels(newLabels);
                          }}
                          className="w-1/3 bg-slate-900 border border-slate-600 rounded p-1 text-[10px] text-sky-400"
                          placeholder={`Group ${idx+1}`}
                        />
                        <select 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-1 text-xs text-slate-200" 
                          value={id} 
                          onChange={e => {
                            const newIds = [...anovaMultiIds];
                            newIds[idx] = e.target.value;
                            setAnovaMultiIds(newIds);
                          }}
                        >
                          <option value="">Select Dataset...</option>
                          {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setAnovaMultiIds([...anovaMultiIds, '']);
                          setAnovaCustomLabels([...anovaCustomLabels, `Group ${anovaMultiIds.length + 1}`]);
                        }}
                        className="text-[10px] text-sky-400 hover:text-sky-300 underline font-bold uppercase tracking-tighter"
                      >
                        + Add Group
                      </button>
                      {anovaMultiIds.length > 3 && (
                        <button 
                          onClick={() => {
                            setAnovaMultiIds(anovaMultiIds.slice(0, -1));
                            setAnovaCustomLabels(anovaCustomLabels.slice(0, -1));
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 underline font-bold uppercase tracking-tighter"
                        >
                          - Remove Group
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700 mt-4">
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Alternative (H₁)</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" 
                    value={anovaAlt} 
                    onChange={e => setAnovaAlt(e.target.value)}
                  >
                    <option value="neq">Difference exists (≠)</option>
                    <option value="greater">Increasing Trend (&gt;)</option>
                    <option value="less">Decreasing Trend (&lt;)</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeTab === 'variance' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Analysis Type</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setVarType('1samp')}
                    className={`py-1 text-xs rounded transition ${varType === '1samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    1-Sample
                  </button>
                  <button 
                    onClick={() => setVarType('2samp')}
                    className={`py-1 text-xs rounded transition ${varType === '2samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    2-Sample
                  </button>
                  <button 
                    onClick={() => setVarType('multi')}
                    className={`py-1 text-xs rounded transition ${varType === 'multi' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Multi-Sample
                  </button>
                </div>

                {varType !== '1samp' && (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Data Layout</label>
                    <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                      <button 
                        onClick={() => setVarInputType('stacked')}
                        className={`flex-1 py-1 text-xs rounded transition ${varInputType === 'stacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Stacked
                      </button>
                      <button 
                        onClick={() => setVarInputType('unstacked')}
                        className={`flex-1 py-1 text-xs rounded transition ${varInputType === 'unstacked' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Individual Columns
                      </button>
                    </div>
                  </>
                )}

                {varType === '1samp' ? (
                  <div className="space-y-4">
                    <label className="block text-xs uppercase text-slate-500 font-bold">Data Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={varData1Id} onChange={e => setVarData1Id(e.target.value)}>
                      <option value="">Select Data...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>

                    <label className="block text-xs uppercase text-slate-500 font-bold">Hypothesized StDev</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" 
                      value={varTarget} 
                      onChange={e => setVarTarget(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g., 1.5"
                    />
                  </div>
                ) : varInputType === 'stacked' ? (
                  <div className="space-y-4">
                    <label className="block text-xs uppercase text-slate-500 font-bold">Response Column (Values)</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={varValueId} onChange={e => setVarValueId(e.target.value)}>
                      <option value="">Select Values...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>

                    <label className="block text-xs uppercase text-slate-500 font-bold">Factor Column (Groups)</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={varGroupId} onChange={e => setVarGroupId(e.target.value)}>
                      <option value="">Select Groups...</option>
                      {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                ) : varType === '2samp' ? (
                  <div className="space-y-4">
                    <label className="block text-xs uppercase text-slate-500 font-bold">Group 1 Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={varData1Id} onChange={e => setVarData1Id(e.target.value)}>
                      <option value="">Select Dataset...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Group 2 Column</label>
                    <select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" value={varData2Id} onChange={e => setVarData2Id(e.target.value)}>
                      <option value="">Select Dataset...</option>
                      {datasets.filter(d => d.isNumeric).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs uppercase text-slate-500 font-bold">Data Columns</label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-800 rounded bg-slate-950">
                      {datasets.map(d => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-700 bg-slate-900 text-sky-500"
                            checked={varMultiIds.includes(d.id)}
                            onChange={(e) => {
                              if (e.target.checked) setVarMultiIds(prev => [...prev, d.id]);
                              else setVarMultiIds(prev => prev.filter(id => id !== d.id));
                            }}
                          />
                          <span className="truncate text-slate-300">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700 mt-4">
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Alternative (H₁)</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" 
                    value={varAlt} 
                    onChange={e => setVarAlt(e.target.value)}
                  >
                    <option value="neq">Variances are different (≠)</option>
                    <option value="greater">Group 1 &gt; Baseline/Group 2 (&gt;)</option>
                    <option value="less">Group 1 &lt; Baseline/Group 2 (&lt;)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'chi-square' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Test Type</label>
                <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setChiType('independence')}
                    className={`flex-1 py-1 text-xs rounded transition ${chiType === 'independence' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Independence
                  </button>
                  <button 
                    onClick={() => setChiType('gof')}
                    className={`flex-1 py-1 text-xs rounded transition ${chiType === 'gof' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    GOF
                  </button>
                </div>

                {chiType === 'independence' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Rows Label</label>
                      <input 
                        type="text" 
                        value={chiLabelR} 
                        onChange={e => setChiLabelR(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Cols Label</label>
                      <input 
                        type="text" 
                        value={chiLabelC} 
                        onChange={e => setChiLabelC(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                      />
                    </div>
                  </div>
                )}
                {chiType === 'independence' ? (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Observed Counts (Comma-separated matrix)</label>
                    <textarea 
                      value={chiObsText} 
                      onChange={e => setChiObsText(e.target.value)} 
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono"
                      placeholder="Row 1: 10, 20&#10;Row 2: 30, 40"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs uppercase text-slate-500 font-bold">Observed Counts</label>
                    <input type="text" value={chiGOFObs} onChange={e => setChiGOFObs(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" placeholder="e.g. 50, 40, 60" />
                    <label className="block text-xs uppercase text-slate-500 font-bold">Expected Counts</label>
                    <input type="text" value={chiGOFExp} onChange={e => setChiGOFExp(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" placeholder="e.g. 50, 50, 50" />
                  </>
                )}
                <div className="pt-2 border-t border-slate-700 mt-4">
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Alternative (H₁)</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200" 
                    value={chiAlt} 
                    onChange={e => setChiAlt(e.target.value)}
                  >
                    <option value="neq">Difference exists (≠)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'proportion' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Test Variant</label>
                <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setPropType('1samp')}
                    className={`flex-1 py-1 text-xs rounded transition font-bold ${propType === '1samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    1-Sample
                  </button>
                  <button 
                    onClick={() => setPropType('2samp')}
                    className={`flex-1 py-1 text-xs rounded transition font-bold ${propType === '2samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    2-Sample
                  </button>
                </div>

                <div className="p-3 bg-slate-800 rounded border border-slate-700 space-y-3">
                  <label className="block text-[10px] uppercase text-sky-400 font-bold mb-1 border-b border-sky-400/20 pb-1">Global Settings</label>
                  
                  {propType === '1samp' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Null Hypothesis (H₀: P = X)</label>
                      <input 
                        type="number" 
                        value={pTarget} 
                        onChange={e => setPTarget(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400 font-mono" 
                        step="0.01"
                        placeholder="0.5"
                      />
                    </div>
                  )}
                  {propType === '2samp' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Null Hypothesis (H₀: Diff)</label>
                      <input 
                        type="number" 
                        value={0} 
                        disabled 
                        className="w-full bg-green-500/20 border border-green-500/50 rounded p-1 text-xs text-green-400 font-mono" 
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Alternate Hypothesis (H₁)</label>
                    <select 
                      value={propAlt} 
                      onChange={e => setPropAlt(e.target.value)}
                      className="w-full bg-green-500/20 border border-green-500/50 rounded p-1 text-xs text-green-400 font-bold cursor-pointer"
                    >
                      {propType === '1samp' ? (
                        <>
                          <option value="neq">P1 ≠ Target</option>
                          <option value="greater">P1 {'>'} Target</option>
                          <option value="less">P1 {'<'} Target</option>
                        </>
                      ) : (
                        <>
                          <option value="neq">P1 ≠ P2</option>
                          <option value="greater">P1 {'>'} P2</option>
                          <option value="less">P1 {'<'} P2</option>
                        </>
                      )}
                    </select>
                  </div>

                  {propType === '2samp' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Use pooled est of p?</label>
                      <select 
                        value={pPooled ? 'Y' : 'N'} 
                        onChange={e => setPPooled(e.target.value === 'Y')}
                        className="w-full bg-green-500/20 border border-green-500/50 rounded p-1 text-xs text-green-400 font-bold cursor-pointer"
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Confidence</label>
                    <div className="bg-green-500/20 border border-green-500/50 rounded p-1 text-xs text-green-400 font-mono">
                      {(1 - alpha).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-slate-800 rounded border border-slate-700">
                    <label className="block text-[10px] uppercase text-sky-400 font-bold mb-2 border-b border-sky-400/20 pb-1">{pLabel1} (Sample Data)</label>
                    <div className="mb-2">
                      <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Sample Name</label>
                      <input 
                        type="text" 
                        value={pLabel1} 
                        onChange={e => setPLabel1(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Units</label>
                        <input type="number" value={pUnits1} onChange={e => setPUnits1(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Opps / Unit</label>
                        <input type="number" value={pOpps1} onChange={e => setPOpps1(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs" />
                      </div>
                    </div>
                    <div className="mt-2 text-center py-1 bg-slate-900/50 border border-slate-700 rounded mb-2">
                      <span className="text-[10px] text-slate-500 mr-2 uppercase">Total Opps (N1):</span>
                      <span className="text-xs font-mono text-cyan-400">{(Number(pUnits1) * Number(pOpps1)).toLocaleString()}</span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase">Defects (X1)</label>
                      <input type="number" value={pEvents1} onChange={e => setPEvents1(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-amber-400 font-bold" />
                    </div>
                  </div>

                  {propType === '2samp' && (
                    <div className="p-3 bg-slate-800 rounded border border-slate-700">
                      <label className="block text-[10px] uppercase text-sky-400 font-bold mb-2 border-b border-sky-400/20 pb-1">{pLabel2} (Sample Data)</label>
                      <div className="mb-2">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Sample Name</label>
                        <input 
                          type="text" 
                          value={pLabel2} 
                          onChange={e => setPLabel2(e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase">Units</label>
                          <input type="number" value={pUnits2} onChange={e => setPUnits2(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase">Opps / Unit</label>
                          <input type="number" value={pOpps2} onChange={e => setPOpps2(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs" />
                        </div>
                      </div>
                      <div className="mt-2 text-center py-1 bg-slate-900/50 border border-slate-700 rounded mb-2">
                        <span className="text-[10px] text-slate-500 mr-2 uppercase">Total Opps (N2):</span>
                        <span className="text-xs font-mono text-cyan-400">{(Number(pUnits2) * Number(pOpps2)).toLocaleString()}</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Defects (X2)</label>
                        <input type="number" value={pEvents2} onChange={e => setPEvents2(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-amber-400 font-bold" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'poisson' && (
              <div className="space-y-4">
                <label className="block text-xs uppercase text-slate-500 font-bold">Test Variant</label>
                <div className="flex bg-slate-900 p-1 rounded border border-slate-700">
                  <button 
                    onClick={() => setPoiType('1samp')}
                    className={`flex-1 py-1 text-xs rounded transition font-bold ${poiType === '1samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    1-Sample
                  </button>
                  <button 
                    onClick={() => setPoiType('2samp')}
                    className={`flex-1 py-1 text-xs rounded transition font-bold ${poiType === '2samp' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    2-Sample
                  </button>
                </div>

                <div className="p-3 bg-slate-800 rounded border border-slate-700 space-y-3">
                  <label className="block text-[10px] uppercase text-purple-400 font-bold mb-1 border-b border-purple-500/20 pb-1">Global Parameters</label>
                  <div className="grid grid-cols-2 gap-2">
                    {poiType === '1samp' && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Null Rate (λ₀)</label>
                        <input 
                          type="number" 
                          value={poiTargetRate} 
                          onChange={e => setPoiTargetRate(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-purple-400" 
                          step="0.1" 
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Alternative (H₁)</label>
                      <select 
                        className="w-full bg-purple-500/10 border border-purple-500/50 rounded p-2 text-xs text-purple-400 font-bold cursor-pointer" 
                        value={poiAlt} 
                        onChange={e => setPoiAlt(e.target.value)}
                      >
                         <option value="neq">{poiType === '1samp' ? `Rate ≠ Target` : `Rate1 ≠ Rate2`}</option>
                         <option value="greater">{poiType === '1samp' ? `Rate > Target` : `Rate1 > Rate2`}</option>
                         <option value="less">{poiType === '1samp' ? `Rate < Target` : `Rate1 < Rate2`}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-slate-800 rounded border border-slate-700">
                    <label className="block text-[10px] uppercase text-sky-400 font-bold mb-2 border-b border-sky-400/20 pb-1">{(poiResults as any)?.label1 || 'Sample A'} Inputs</label>
                    <div className="mb-2">
                      <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Sample Name</label>
                      <input type="text" value={poiLabel1} onChange={e => setPoiLabel1(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Occurrences (X1)</label>
                        <input type="number" value={poiEvents1} onChange={e => setPoiEvents1(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-amber-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Sample size (N1)</label>
                        <input type="number" value={poiSize1} onChange={e => setPoiSize1(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-sky-400" />
                      </div>
                    </div>
                  </div>

                  {poiType === '2samp' && (
                    <div className="p-3 bg-slate-800 rounded border border-slate-700">
                      <label className="block text-[10px] uppercase text-sky-400 font-bold mb-2 border-b border-sky-400/20 pb-1">{(poiResults as any)?.label2 || 'Sample B'} Inputs</label>
                      <div className="mb-2">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Sample Name</label>
                        <input type="text" value={poiLabel2} onChange={e => setPoiLabel2(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-sky-400" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase">Occurrences (X2)</label>
                          <input type="number" value={poiEvents2} onChange={e => setPoiEvents2(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-amber-400" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase">Sample size (N2)</label>
                          <input type="number" value={poiSize2} onChange={e => setPoiSize2(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-sky-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-6 mt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase text-slate-500 font-bold">Alpha (Risk)</label>
                <span className="text-xs font-mono text-sky-400 font-bold">{alpha}</span>
              </div>
              <input 
                type="range" 
                min="0.01" 
                max="0.20" 
                step="0.01" 
                value={alpha} 
                onChange={(e) => setAlpha(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                <span>0.01</span>
                <span>0.10</span>
                <span>0.20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === '1-sample' && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl space-y-8">
              <h3 className="text-xl font-bold">1-Sample Analysis{s1Results && `: ${s1Results.testUsed}`}</h3>
              {!s1Results ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic">
                  Complete settings to run analysis.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Diagnostics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ExportWrapper fileName="1sample-diagnostics">
                      <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                          <Activity size={14} className="text-emerald-400" /> Normality Check
                        </h4>
                        <DiagnosticIndicator label={s1Label} passed={s1Results.isNormal} pValue={s1Results.norm.pValue} />
                        <div className="mt-4 text-[10px] text-slate-500">
                          Routing Logic: {s1Results.testUsed} selected based on normality and sample size.
                        </div>
                      </div>
                    </ExportWrapper>
                  </div>

                  <ExportWrapper fileName="1sample-summary">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Estimate</div>
                        <div className="text-2xl font-mono text-red-500 font-bold">{s1Results.mean.toFixed(3)}</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Alternative (H₁)</div>
                        <div className="text-xs mt-2 font-bold text-sky-400">
                          {s1Alt === 'neq' ? '≠' : s1Alt === 'greater' ? '>' : '<'} Target
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">P-Value</div>
                        <div className={`text-2xl font-mono font-bold ${s1Results.significant ? 'text-red-500' : 'text-green-500'}`}>
                          {s1Results.pValue.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                          {s1Results.testUsed.includes('T-Test') ? 'T-Value' : (s1Results.testUsed.includes('Z-Test') ? 'Z-Value' : 'W-Value')}
                        </div>
                        <div className="text-2xl font-mono text-slate-200">{s1Results.statistic.toFixed(3)}</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Decision</div>
                        <div className={`text-xs mt-2 font-bold ${s1Results.significant ? 'text-red-400' : 'text-green-400'}`}>
                          {s1Results.significant ? 'REJECT NULL' : 'FAIL TO REJECT'}
                        </div>
                      </div>
                    </div>
                  </ExportWrapper>
                  
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <ExportWrapper fileName="1sample-boxplot">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700 h-full relative" onContextMenu={(e) => e.stopPropagation()}>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest pointer-events-none">Distribution Boxplot</h4>
                        <div className="h-40 overflow-hidden relative z-0">
                          <Plot
                            data={[
                              {
                                x: s1Results.data.map(v => Number(v)).filter(v => !isNaN(v)),
                                type: 'box',
                                name: s1Label,
                                marker: { color: '#38bdf8' },
                                boxpoints: 'outliers',
                                orientation: 'h'
                              }
                            ]}
                            layout={{
                              autosize: true,
                              showlegend: false,
                              margin: { l: 40, r: 20, t: 10, b: 30 },
                              paper_bgcolor: 'transparent',
                              plot_bgcolor: 'transparent',
                              font: { color: '#94a3b8' },
                              xaxis: {
                                gridcolor: '#334155',
                                zerolinecolor: '#475569',
                                tickfont: { color: '#94a3b8', size: 10 }
                              },
                              yaxis: {
                                showticklabels: false,
                                gridcolor: 'transparent'
                              }
                            }}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false, responsive: true, staticPlot: false }}
                          />
                        </div>
                      </div>
                    </ExportWrapper>

                    <ExportWrapper fileName="1sample-conclusion">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700 flex flex-col justify-center h-full">
                        <p className="text-xs text-slate-200 leading-relaxed italic border-l-4 border-sky-600 pl-4 py-2">
                          "With a P-Value of {s1Results.pValue.toFixed(4)}, we {s1Results.significant ? 'have' : 'do not have'} sufficient evidence to suggest a {s1Alt === 'neq' ? 'difference exists' : s1Alt === 'greater' ? 'greater value' : 'lesser value'} relative to {s1Target}."
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono">
                           <div className="bg-slate-800/50 p-2 rounded">N: {s1Results.n}</div>
                           <div className="bg-slate-800/50 p-2 rounded">StDev: {s1Results.sd?.toFixed(3) || '--'}</div>
                           <div className="bg-slate-800/50 p-2 rounded">Target: {s1Target}</div>
                           <div className="bg-slate-900/50 p-2 rounded">{(1 - alpha).toFixed(2)} CI: [{s1Results.ci.lcl.toFixed(2)}, {s1Results.ci.ucl.toFixed(2)}]</div>
                           <div className="bg-slate-800/50 p-2 rounded">
                             {s1Results.testUsed.includes('T-Test') ? `DF: ${s1Results.df}` : `Test: ${s1Results.testUsed.split(' ')[1]}`}
                           </div>
                        </div>
                      </div>
                    </ExportWrapper>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === '2-sample' && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl space-y-8">
              <h3 className="text-xl font-bold">2-Sample Analysis Results{s2Analysis && `: ${s2Analysis.testType}`}</h3>
              
              {!s2Analysis ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic">
                  Complete settings and click Run Analysis.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Diagnostics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ExportWrapper fileName="2sample-normality">
                      <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                          <Activity size={14} className="text-emerald-400" /> Normality Check
                        </h4>
                        <div className="space-y-2 mb-4">
                          <DiagnosticIndicator label={s2Analysis.name1} passed={s2Analysis.norm1.pValue > 0.05} pValue={s2Analysis.norm1.pValue} />
                          <DiagnosticIndicator label={s2Analysis.name2} passed={s2Analysis.norm2.pValue > 0.05} pValue={s2Analysis.norm2.pValue} />
                        </div>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                              <XAxis 
                                type="number" 
                                dataKey="x" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                              />
                              <YAxis 
                                type="number" 
                                dataKey="y" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                              />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a' }} />
                              <ReferenceLine x={0} y={0} segment={[{x: -4, y: -4}, {x: 4, y: 4}]} stroke="#475569" strokeDasharray="3 3" />
                              <Scatter name={s2Analysis.name1} data={sampleData(s2Analysis.qq1, 1000)} fill="#38bdf8" shape="circle" />
                              <Scatter name={s2Analysis.name2} data={sampleData(s2Analysis.qq2, 1000)} fill="#fbbf24" shape="square" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </ExportWrapper>

                    <ExportWrapper fileName="2sample-variance">
                      <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                          <TrendingUp size={14} className="text-amber-400" /> Variance Equality
                        </h4>
                        <div className="mb-4">
                          <DiagnosticIndicator label="Homogeneity" passed={s2Analysis.equalVar} pValue={s2Analysis.varTest.pValue} />
                        </div>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart layout="vertical" data={s2Analysis.varCiData} margin={{ top: 20, right: 30, bottom: 20, left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                              <XAxis type="number" domain={['auto', 'auto']} stroke="#94a3b8" fontSize={8} />
                              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={8} />
                              <Bar dataKey="range" fill="#38bdf8" barSize={4} fillOpacity={0.6}>
                                {s2Analysis.varCiData.map((entry: any, index: number) => (
                                  <Cell key={index} fill={index === 0 ? '#38bdf8' : '#fbbf24'} />
                                ))}
                              </Bar>
                              <Scatter dataKey="mean" fill="#fff">
                                {s2Analysis.varCiData.map((entry: any, index: number) => (
                                  <Cell key={index} fill={index === 0 ? '#38bdf8' : '#fbbf24'} stroke="#fff" strokeWidth={2} />
                                ))}
                              </Scatter>
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </ExportWrapper>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-700/50 items-start">
                      {/* Left: Stats Tables */}
                      <div className="space-y-8">
                        <ExportWrapper fileName="2sample-variances-table">
                          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                            <h4 className="text-xs font-bold text-sky-400 uppercase mb-3 flex items-center gap-2">
                              Check of Equal Variance
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-700">
                                    <th className="py-2 text-slate-500 uppercase font-bold">Sample</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">N</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">StDev</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">Variance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-slate-800/50">
                                    <td className="py-2 text-slate-300 font-medium">{s2Analysis.name1}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.n1}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.s1.toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.v1.toFixed(3)}</td>
                                  </tr>
                                  <tr className="border-b border-slate-800/50">
                                    <td className="py-2 text-slate-300 font-medium">{s2Analysis.name2}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.n2}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.s2.toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.v2.toFixed(3)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            
                            <div className="mt-4 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[10px] bg-slate-900/50 p-2 rounded">
                                  <span className="text-slate-500 uppercase font-bold">Ratio of Std Dev's</span>
                                  <span className="text-red-500 font-mono font-bold text-sm">{(s2Analysis.stats.s1 / s2Analysis.stats.s2).toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] bg-slate-900/50 p-2 rounded">
                                  <span className="text-slate-500 uppercase font-bold">Ratio of Variances</span>
                                  <span className="text-red-500 font-mono font-bold text-sm">{(s2Analysis.stats.v1 / s2Analysis.stats.v2).toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                  <span className="text-slate-500 uppercase font-bold">{s2Analysis.varTestType} P-Value</span>
                                  <span className={`font-mono font-bold text-sm ${s2Analysis.varTest.pValue < alpha ? 'text-red-500' : 'text-green-500'}`}>
                                    {s2Analysis.varTest.pValue.toFixed(3)}
                                  </span>
                              </div>
                            </div>

                            <div className="mt-4 bg-slate-900/80 p-3 rounded border border-slate-700">
                              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Recommendation</p>
                              <p className={`text-xs font-bold ${s2Analysis.equalVar ? 'text-green-400' : 'text-amber-400'}`}>
                                Recommend {s2Analysis.equalVar ? 'USING' : 'NOT USING'} Assumption of Equal Variance
                              </p>
                            </div>
                          </div>
                        </ExportWrapper>

                        <ExportWrapper fileName="2sample-test-results">
                          <div className="pt-6 border-t border-slate-700">
                            <h4 className="text-xs font-bold text-sky-400 uppercase mb-3 flex items-center gap-2">
                              {s2Analysis.testType} Results
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-700">
                                    <th className="py-2 text-slate-500 uppercase font-bold">Sample</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">N</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">Mean/Med</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">StDev</th>
                                    <th className="py-2 text-slate-300 font-mono text-center">SE Mean</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-slate-800/50">
                                    <td className="py-2 text-slate-300 font-medium">{s2Analysis.name1}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.n1}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{(s2Analysis.ci.type === 'Medians' ? s2Analysis.stats.med1 : s2Analysis.stats.m1).toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.s1.toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{(s2Analysis.stats.s1 / Math.sqrt(s2Analysis.stats.n1)).toFixed(3)}</td>
                                  </tr>
                                  <tr className="border-b border-slate-800/50">
                                    <td className="py-2 text-slate-300 font-medium">{s2Analysis.name2}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.n2}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{(s2Analysis.ci.type === 'Medians' ? s2Analysis.stats.med2 : s2Analysis.stats.m2).toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{s2Analysis.stats.s2.toFixed(3)}</td>
                                    <td className="py-2 text-center text-red-500 font-mono font-bold">{(s2Analysis.stats.s2 / Math.sqrt(s2Analysis.stats.n2)).toFixed(3)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Alternative (H₁)</p>
                                  <p className="text-xl font-mono font-bold text-sky-400">
                                    {s2Alt === 'neq' ? '≠' : s2Alt === 'greater' ? '>' : '<'}
                                  </p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Estimate for difference</p>
                                  <p className="text-xl font-mono font-bold text-red-500">
                                    {(s2Analysis.stats.m1 - s2Analysis.stats.m2).toFixed(3)}
                                  </p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-right">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">P-Value</p>
                                  <p className={`text-xl font-mono font-bold ${s2Analysis.significant ? 'text-red-500' : 'text-slate-200'}`}>
                                    {s2Analysis.results.pValue.toFixed(3)}
                                  </p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{(1 - alpha).toFixed(2)} CI for Difference</p>
                                  <p className="text-xs font-mono font-bold text-red-500">
                                    [{s2Analysis.ci.data[0].lcl.toFixed(3)} to {s2Analysis.ci.data[0].ucl.toFixed(3)}]
                                  </p>
                                  <p className="text-[8px] text-slate-600 italic leading-tight mt-1">*approx derived from individual CIs</p>
                              </div>
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-right">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{s2Analysis.ci.type === 'Medians' ? 'U-Statistic' : 'T-Value'}</p>
                                  <p className="text-sm font-mono font-bold text-slate-300">
                                    {s2Analysis.results.statistic.toFixed(3)}
                                  </p>
                              </div>
                            </div>
                          </div>
                        </ExportWrapper>
                      </div>

                      {/* Right: Main Diagnostic Plots */}
                      <div className="space-y-6">
                        <ExportWrapper fileName="2sample-ci-plot">
                          <div className="bg-slate-900 p-4 rounded border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Plot of {s2Analysis.ci.type} Confidence Intervals</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart layout="vertical" data={s2Analysis.ci.data} margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                  <XAxis type="number" domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10} />
                                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} />
                                  <Tooltip />
                                  <Bar dataKey="range" fill="#38bdf8" barSize={4} fillOpacity={0.6}>
                                    {s2Analysis.ci.data.map((entry: any, index: number) => (
                                      <Cell key={index} fill={index === 0 ? '#38bdf8' : '#fbbf24'} />
                                    ))}
                                  </Bar>
                                  <Scatter dataKey="mean" fill="#fff">
                                    {s2Analysis.ci.data.map((entry: any, index: number) => (
                                      <Cell key={index} fill={index === 0 ? '#38bdf8' : '#fbbf24'} stroke="#fff" strokeWidth={2} />
                                    ))}
                                  </Scatter>
                                </ComposedChart>
                              </ResponsiveContainer>
                              <p className="text-[8px] text-slate-500 text-center uppercase tracking-tighter mt-2">Sample</p>
                            </div>
                          </div>
                        </ExportWrapper>

                        <ExportWrapper fileName="2sample-boxplot">
                          <div className="bg-slate-900 p-4 rounded border border-slate-700 h-full relative" onContextMenu={(e) => e.stopPropagation()}>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest pointer-events-none">Distribution Boxplot</h4>
                            <div className="h-44 overflow-hidden relative z-0">
                              <Plot
                                data={[
                                  {
                                    x: s2Analysis.data1.map(v => Number(v)).filter(v => !isNaN(v)),
                                    type: 'box',
                                    name: s2Analysis.name1,
                                    marker: { color: '#38bdf8' },
                                    boxpoints: 'outliers',
                                    orientation: 'h'
                                  },
                                  {
                                    x: s2Analysis.data2.map(v => Number(v)).filter(v => !isNaN(v)),
                                    type: 'box',
                                    name: s2Analysis.name2,
                                    marker: { color: '#fbbf24' },
                                    boxpoints: 'outliers',
                                    orientation: 'h'
                                  }
                                ]}
                                layout={{
                                  autosize: true,
                                  showlegend: false,
                                  margin: { l: 80, r: 20, t: 10, b: 30 },
                                  paper_bgcolor: 'transparent',
                                  plot_bgcolor: 'transparent',
                                  font: { color: '#94a3b8' },
                                  xaxis: {
                                    gridcolor: '#334155',
                                    zerolinecolor: '#475569',
                                    tickfont: { color: '#94a3b8', size: 10 }
                                  },
                                  yaxis: {
                                    tickfont: { color: '#94a3b8', size: 10 },
                                    gridcolor: 'transparent'
                                  }
                                }}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                              />
                            </div>
                          </div>
                        </ExportWrapper>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {activeTab === 'anova' && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl space-y-8">
              <h3 className="text-xl font-bold">3 or More Groups Analysis{anovaAnalysis && `: ${anovaAnalysis.testUsed}`}</h3>
              {!anovaAnalysis ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic">
                  Select at least 2 groups with valid data to run ANOVA.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary Metric Strip */}
                  <ExportWrapper fileName="anova-summary">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Test Value</div>
                        <div className="text-2xl font-mono text-red-500 font-bold">
                          {anovaAnalysis.testResults.statistic.toFixed(3)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">P-Value</div>
                        <div className={`text-2xl font-mono font-bold ${anovaAnalysis.pValue < alpha ? 'text-red-500' : 'text-green-500'}`}>
                          {anovaAnalysis.pValue.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Test Used</div>
                        <div className="text-xs mt-2 font-bold text-slate-300">
                          {anovaAnalysis.testUsed}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Alternative (H₁)</div>
                        <div className="text-xs mt-2 font-bold text-sky-400">
                          {anovaAlt === 'neq' ? 'Diff exists (≠)' : anovaAlt === 'greater' ? 'Incr. Trend (>)' : 'Decr. Trend (<)'}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Decision</div>
                        <div className={`text-xs mt-2 font-bold ${anovaAnalysis.significant ? 'text-red-400' : 'text-green-400'}`}>
                          {anovaAnalysis.significant ? 'REJECT NULL' : 'FAIL TO REJECT'}
                        </div>
                      </div>
                    </div>
                  </ExportWrapper>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Left Diagnostic Summaries */}
                    <div className="space-y-6">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Normality & Variance Check</h4>
                        <div className="space-y-3">
                          <DiagnosticIndicator 
                            label="Normality (All Groups)" 
                            passed={anovaAnalysis.isNormal} 
                            pValue={anovaAnalysis.normalityResults.reduce((min, r) => Math.min(min, r.pValue), anovaAnalysis.normalityResults[0].pValue)} 
                          />
                          <DiagnosticIndicator 
                            label="Equal Variance (Levene)" 
                            passed={anovaAnalysis.equalVar} 
                            pValue={anovaAnalysis.varianceTest.pValue} 
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                          Routing Logic: {anovaAnalysis.testUsed} selected based on normality and variance tests.
                        </p>
                      </div>

                      <ExportWrapper fileName="anova-boxplots">
                        <div className="bg-slate-900 p-4 rounded border border-slate-700 h-full relative" onContextMenu={(e) => e.stopPropagation()}>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest text-[#94a3b8] pointer-events-none">Distribution Boxplots</h4>
                          <div className="h-60 overflow-hidden relative z-0">
                              <Plot
                                data={anovaAnalysis.groups.map((g, idx) => ({
                                  x: g.data.map(v => Number(v)).filter(v => !isNaN(v)),
                                  type: 'box' as const,
                                  name: g.name,
                                  marker: { color: ['#38bdf8', '#fbbf24', '#f87171', '#a78bfa', '#34d399'][idx % 5] },
                                  boxpoints: 'outliers' as const,
                                  orientation: 'h' as const
                                }))}
                                layout={{
                                  autosize: true,
                                  showlegend: false,
                                  margin: { l: 80, r: 20, t: 10, b: 30 },
                                  paper_bgcolor: 'transparent',
                                  plot_bgcolor: 'transparent',
                                  font: { color: '#94a3b8' },
                                  xaxis: {
                                    gridcolor: '#334155',
                                    zerolinecolor: '#475569',
                                    tickfont: { color: '#94a3b8', size: 10 }
                                  },
                                  yaxis: {
                                    tickfont: { color: '#94a3b8', size: 10 },
                                    gridcolor: 'transparent'
                                  }
                                }}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                              />
                          </div>
                        </div>
                      </ExportWrapper>
                    </div>

                    <ExportWrapper fileName="anova-table">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Group Statistics Table</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="py-2 text-slate-500 uppercase">Group</th>
                                <th className="py-2 text-center text-slate-500">N</th>
                                <th className="py-2 text-center text-slate-500">Mean</th>
                                <th className="py-2 text-center text-slate-500">Median</th>
                                <th className="py-2 text-center text-slate-500">StDev</th>
                              </tr>
                            </thead>
                            <tbody>
                              {anovaAnalysis.groups.map((g, idx) => (
                                <tr key={idx} className="border-b border-slate-800/50">
                                  <td className="py-2 text-slate-300 font-medium">{g.name}</td>
                                  <td className="py-2 text-center text-red-500 font-mono">{g.data.length}</td>
                                  <td className="py-2 text-center text-red-500 font-mono">{getMean(g.data).toFixed(2)}</td>
                                  <td className="py-2 text-center text-red-500 font-mono">{getPercentile([...g.data].sort((a,b)=>a-b), 0.5).toFixed(2)}</td>
                                  <td className="py-2 text-center text-red-500 font-mono">{getStdDev(g.data).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-8 p-4 bg-slate-950 rounded border border-slate-800">
                          <h5 className="text-[10px] font-bold text-sky-400 uppercase mb-2 italic">Conclusion</h5>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {anovaAnalysis.significant ? 
                              `We reject the null hypothesis at the ${alpha} significance level. Evidence suggests at least one group is significantly different from the others.` : 
                              `We fail to reject the null hypothesis at the ${alpha} level. There is insufficient evidence to conclude that any group differs significantly.`}
                          </p>
                        </div>

                        {anovaAnalysis.postHoc && (
                          <div className="mt-8 bg-slate-950/50 p-4 rounded border border-slate-800/50">
                            <h4 className="text-xs font-bold text-sky-500 uppercase mb-4 text-center tracking-widest">
                              Post-Hoc: {anovaAnalysis.postHoc.type}'s Comparison
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="border-b border-slate-700">
                                    <th className="py-2 text-left text-slate-500 uppercase">Comparison</th>
                                    <th className="py-2 text-center text-slate-500 uppercase">Difference</th>
                                    <th className="py-2 text-center text-slate-500 uppercase">Test Stat</th>
                                    <th className="py-2 text-center text-slate-500 uppercase">Significance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {anovaAnalysis.postHoc.comparisons.map((comp: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-800/30">
                                      <td className="py-2 text-slate-300 font-medium">{comp.groupA} <span className="text-slate-600 px-1">vs</span> {comp.groupB}</td>
                                      <td className={`py-2 text-center font-mono ${comp.isSignificant ? 'text-amber-500' : 'text-slate-500'}`}>
                                        {(comp.diff !== undefined ? comp.diff : comp.rankDiff).toFixed(3)}
                                      </td>
                                      <td className="py-2 text-center text-slate-500 font-mono">
                                        {(comp.q || comp.stat).toFixed(3)}
                                      </td>
                                      <td className="py-2 text-center">
                                        {comp.isSignificant ? (
                                          <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded text-[8px] font-bold uppercase ring-1 ring-red-400/30">Significant</span>
                                        ) : (
                                          <span className="text-slate-600">N.S.</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-4 text-[8px] text-slate-600 italic">
                               * Pairwise comparisons evaluated at {alpha} level (Critical Q: {anovaAnalysis.postHoc.qCrit.toFixed(2)})
                            </p>
                          </div>
                        )}
                      </div>
                    </ExportWrapper>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'variance' && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 shadow-2xl space-y-8 min-h-[800px]">
              <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-t-lg border-b border-slate-700 -mx-6 -mt-6 mb-6">
                <div>
                  <h3 className="text-2xl font-black italic text-sky-400 uppercase tracking-tighter">Variance Analysis Output</h3>
                  {varianceAnalysis && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Method: {varianceAnalysis.testUsed}</div>}
                </div>
                <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><Activity size={12}/> ENGINE: SIGMA-6</span>
                  <span className="flex items-center gap-1"><TrendingUp size={12}/> CONFIDENCE: {(1-alpha)*100}%</span>
                </div>
              </div>

              {!varianceAnalysis ? (
                <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic space-y-2">
                  <Activity size={48} className="text-slate-800 animate-pulse" />
                  <p>Awaiting Data Selection...</p>
                </div>
              ) : (
                <ExportWrapper fileName="variance-results">
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                         {/* Normality Summary */}
                        <div className="bg-slate-950/50 rounded p-4 border border-slate-800/50">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest flex items-center gap-2">
                            <Activity size={14} className="text-sky-500" /> Pre-Test Diagnostics
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {varianceAnalysis.normalityResults.map((norm: any, idx: number) => (
                              <DiagnosticIndicator 
                                key={idx}
                                label={`Normality: ${norm.name}`} 
                                passed={norm.pValue > alpha} 
                                pValue={norm.pValue}
                              />
                            ))}
                            <div className="p-3 bg-slate-900/50 rounded border border-slate-700 flex flex-col justify-center">
                                <span className="text-[8px] text-slate-500 uppercase font-black">Method Selection</span>
                                <span className="text-xs text-slate-200 mt-1 font-mono">{varianceAnalysis.testUsed}</span>
                            </div>
                          </div>
                        </div>

                        {/* Test Results */}
                        <div className="bg-slate-950/50 rounded p-4 border border-slate-800/50 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-2">
                              <div className={`text-[8px] font-black px-2 py-0.5 rounded shadow-sm ${varianceAnalysis.significant ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30' : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'}`}>
                                {varianceAnalysis.significant ? 'SIGNIFICANT' : 'INSIGNIFICANT'}
                              </div>
                           </div>
                           
                           <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                            < Zap size={14} className="text-amber-500" /> Statistical Indices
                          </h4>

                          <div className="grid grid-cols-3 gap-8">
                             <div className="text-center">
                                <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Test Statistic</div>
                                <div className="text-3xl font-mono text-white font-black">{formatPropValue(varianceAnalysis.testResults.statistic)}</div>
                             </div>
                             <div className="text-center border-x border-slate-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-black mb-1">P-Value</div>
                                <div className={`text-3xl font-mono font-black ${varianceAnalysis.significant ? 'text-amber-500' : 'text-slate-300'}`}>
                                  {formatPropValue(varianceAnalysis.pValue)}
                                </div>
                             </div>
                             <div className="text-center">
                                <div className="text-[10px] text-slate-500 uppercase font-black mb-1">D.F.</div>
                                <div className="text-3xl font-mono text-slate-400 font-black">
                                   {varianceAnalysis.testResults.df !== undefined ? varianceAnalysis.testResults.df : `${varianceAnalysis.testResults.df1}, ${varianceAnalysis.testResults.df2}`}
                                </div>
                             </div>
                          </div>
                        </div>

                        {/* CI Plot */}
                        <div className="bg-slate-950/50 rounded p-4 border border-slate-800/50 h-[320px]">
                           <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Confidence Intervals (StDev)</h4>
                           <ResponsiveContainer width="100%" height="85%">
                              <BarChart data={varianceAnalysis.ciData} layout="vertical">
                                 <XAxis type="number" domain={['auto', 'auto']} stroke="#475569" fontSize={10} />
                                 <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} width={80} />
                                 <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                    itemStyle={{ color: '#38bdf8' }}
                                    formatter={(v: any) => formatPropValue(v)}
                                 />
                                 {/* Horizontal line for CI */}
                                 <Bar dataKey="range" fill="#0ea5e9" barSize={4} radius={[2, 2, 2, 2]} />
                                 {/* Dot for point estimate */}
                                 <Scatter dataKey="sd" fill="#f59e0b" />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="space-y-6">
                         <div className="bg-slate-950/50 rounded border border-slate-800/50 overflow-hidden">
                            <div className="bg-slate-800/30 p-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter border-b border-slate-800/50">
                               Sample Variances & SDs
                            </div>
                            <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                               {varianceAnalysis.ciData.map((item: any, i: number) => (
                                  <div key={i} className="p-3">
                                     <div className="flex justify-between items-start mb-1">
                                        <div className="truncate w-32">
                                          <span className="text-[10px] font-bold text-sky-400">{item.name}</span>
                                          <div className="text-[8px] text-slate-600 uppercase font-black">Normality p: {formatPropValue(varianceAnalysis.normalityResults[i].pValue, 3)}</div>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-500">n={varianceAnalysis.groups[i].data.length}</span>
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="bg-slate-900/50 p-2 rounded">
                                           <div className="text-[8px] text-slate-500 uppercase font-black">Variance</div>
                                           <div className="text-xs text-white font-mono">{formatPropValue(item.sd**2)}</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded">
                                           <div className="text-[8px] text-slate-500 uppercase font-black">StDev</div>
                                           <div className="text-xs text-amber-500 font-mono">{formatPropValue(item.sd)}</div>
                                        </div>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </ExportWrapper>
              )}
            </div>
          )}

          {activeTab === 'chi-square' && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl space-y-8">
              <h3 className="text-xl font-bold">Chi-Squared Test Results</h3>
              {!chiResults ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic text-center px-8">
                  Check input data. Provide at least a 2x2 matrix for independence or 2 categories for GOF.
                </div>
              ) : (
                <div className="space-y-8">
                  <ExportWrapper fileName="chi-summary">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Chi-Square</div>
                        <div className="text-2xl font-mono text-amber-500 font-bold">{chiResults.statistic.toFixed(3)}</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Alternative (H₁)</div>
                        <div className="text-xs mt-2 font-bold text-sky-400">
                          Difference exists (≠)
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">P-Value</div>
                        <div className={`text-2xl font-mono font-bold ${chiResults.pValue < alpha ? 'text-red-500' : 'text-green-500'}`}>
                          {chiResults.pValue.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">DF</div>
                        <div className="text-2xl font-mono text-slate-200">{chiResults.df}</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Decision</div>
                        <div className={`text-xs mt-2 font-bold ${chiResults.pValue < alpha ? 'text-red-400' : 'text-green-400'}`}>
                          {chiResults.pValue < alpha ? 'REJECT NULL' : 'FAIL TO REJECT'}
                        </div>
                      </div>
                    </div>
                  </ExportWrapper>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="bg-slate-900 p-4 rounded border border-slate-700 h-[300px]">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Residual Analysis / Contributions</h4>
                      <ResponsiveContainer width="100%" height="85%">
                         <BarChart data={
                           chiType === 'gof' 
                             ? chiGOFObs.split(',').map((v, i) => ({ 
                                 name: `Cat ${i+1}`, 
                                 Value: Number(v.trim()),
                                 Expected: Number(chiGOFExp.split(',')[i]?.trim() || 0)
                               }))
                             : chiObsText.split('\n').flatMap((row, i) => row.split(',').map((v, j) => ({
                                 name: `${chiLabelR.slice(0,3)}${i+1}:${chiLabelC.slice(0,3)}${j+1}`,
                                 Value: Number(v.trim()),
                                 Expected: (chiResults as any).expected?.[i]?.[j] || 0
                               })))
                         }>
                           <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                           <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                           <YAxis stroke="#94a3b8" fontSize={10} />
                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                           <Legend verticalAlign="top" height={36}/>
                           <Bar dataKey="Value" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="Expected" fill="#64748b" radius={[4, 4, 0, 0]} />
                         </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-slate-900 p-6 rounded border border-slate-700 h-full flex flex-col justify-center">
                      <p className="text-xs text-slate-300 leading-relaxed italic border-l-4 border-amber-600 pl-4 py-2">
                        {chiType === 'independence' 
                          ? "Test evaluates whether there is a significant association between the categorical variables forming the grid."
                          : "Test evaluates if the observed frequency distribution matches the specified expected distribution."}
                      </p>
                      <div className="mt-6 p-4 bg-slate-950 rounded border border-slate-800">
                        <h5 className="text-[10px] font-bold text-sky-400 uppercase mb-2 italic">Conclusion</h5>
                        <p className="text-xs text-slate-400 leading-relaxed">
                           {chiResults.pValue < alpha 
                             ? "The evidence suggests a significant difference or association exists. The observed values significantly deviate from expectations."
                             : "There is no significant evidence to suggest the observations differ from the null model."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'proportion' && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 shadow-2xl space-y-8 min-h-[800px]">
              <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-t-lg border-b border-slate-700 -mx-6 -mt-6 mb-6">
                <h3 className="text-2xl font-black italic text-sky-400 uppercase tracking-tighter">
                  {propType === '1samp' ? '1-Sample Proportion Analysis' : '2-Sample Proportion Analysis'}
                </h3>
                <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><Activity size={12}/> ENGINE: SIGMA-6</span>
                  <span className="flex items-center gap-1"><TrendingUp size={12}/> CONFIDENCE: {(1-alpha)*100}%</span>
                </div>
              </div>

              {!propResults ? (
                <div className="h-96 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600 font-bold uppercase tracking-widest text-center px-12">
                  Awaiting Input Grid... Ensure Samples have at least 1 Unit and Opportunities.
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Visual Plot Area */}
                    <div className="bg-slate-950 p-6 rounded border border-slate-800 shadow-inner">
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest text-center">Plot of Confidence Intervals</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            layout="vertical"
                            data={
                              propType === '1samp' 
                                ? [{ name: (propResults as any).label1, range: [(propResults as any).ci1.lower, (propResults as any).ci1.upper], nominal: (propResults as any).ci1.nominal }]
                                : [
                                    { name: (propResults as any).label1, range: [(propResults as any).ci1.lower, (propResults as any).ci1.upper], nominal: (propResults as any).ci1.nominal },
                                    { name: (propResults as any).label2, range: [(propResults as any).ci2.lower, (propResults as any).ci2.upper], nominal: (propResults as any).ci2.nominal }
                                  ]
                            }
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            <CartesianGrid stroke="#1e293b" />
                            <XAxis 
                              type="number" 
                              domain={[0, 1]} 
                              stroke="#64748b" 
                              fontSize={10} 
                              tickFormatter={(v) => typeof v === 'number' ? formatPropValue(v, 3) : v}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              stroke="#64748b" 
                              fontSize={10} 
                              width={80}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                              formatter={(v: any) => Array.isArray(v) ? `${formatPropValue(v[0])} - ${formatPropValue(v[1])}` : (typeof v === 'number' ? formatPropValue(v) : v)}
                            />
                            <Bar dataKey="range" fill="#38bdf844" radius={[0, 4, 4, 0]} barSize={8} />
                            {propType === '1samp' && (
                              <ReferenceLine x={Number(pTarget)} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: `Target: ${pTarget}`, fill: '#ef4444', fontSize: 10 }} />
                            )}
                            <Scatter dataKey="nominal" fill="#38bdf8" shape="square" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center p-2 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{(propResults as any).label1} Interval</div>
                          <div className="text-xs text-sky-400 font-mono">
                            {typeof (propResults as any).ci1.lower === 'number' ? formatPropValue((propResults as any).ci1.lower) : '--'} ↔ {typeof (propResults as any).ci1.upper === 'number' ? formatPropValue((propResults as any).ci1.upper) : '--'}
                          </div>
                        </div>
                        {propType === '2samp' && (
                          <div className="text-center p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{(propResults as any).label2} Interval</div>
                            <div className="text-xs text-sky-400 font-mono">
                              {typeof (propResults as any).ci2.lower === 'number' ? formatPropValue((propResults as any).ci2.lower) : '--'} ↔ {typeof (propResults as any).ci2.upper === 'number' ? formatPropValue((propResults as any).ci2.upper) : '--'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Individual Sample Tables */}
                    <div className="space-y-6">
                      {/* {pLabel1} Result Box */}
                      <div className="bg-slate-950 p-4 rounded border-l-4 border-l-green-500 border-y border-r border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-black text-green-500 uppercase">{(propResults as any).label1} Results</span>
                          <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">N = {(propResults as any).n1.toLocaleString()}</span>
                        </div>
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-800">
                              <th className="text-left pb-2 font-normal">Metric</th>
                              <th className="text-right pb-2 font-normal">p(d)</th>
                              <th className="text-right pb-2 font-normal">ppm</th>
                              <th className="text-right pb-2 font-normal">Defects</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            <tr>
                              <td className="py-2 text-slate-400">Upper Limit</td>
                              <td className="text-right text-red-500">{typeof (propResults as any).ci1.upper === 'number' ? formatPropValue((propResults as any).ci1.upper) : '--'}</td>
                              <td className="text-right text-slate-400">{Math.round((propResults as any).ci1.upper * 1000000)}</td>
                              <td className="text-right text-red-500">{Math.round((propResults as any).ci1.upper * (propResults as any).n1)}</td>
                            </tr>
                            <tr className="bg-slate-900/50">
                              <td className="py-2 text-white font-bold tracking-wider">NOMINAL</td>
                              <td className="text-right text-white font-bold">{typeof (propResults as any).ci1.nominal === 'number' ? formatPropValue((propResults as any).ci1.nominal) : '--'}</td>
                              <td className="text-right text-white font-bold">{Math.round((propResults as any).ci1.nominal * 1000000)}</td>
                              <td className="text-right text-white font-bold">{(propResults as any).e1}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-slate-400">Lower Limit</td>
                              <td className="text-right text-green-500">{typeof (propResults as any).ci1.lower === 'number' ? formatPropValue((propResults as any).ci1.lower) : '--'}</td>
                              <td className="text-right text-slate-400">{Math.round((propResults as any).ci1.lower * 1000000)}</td>
                              <td className="text-right text-green-500">{Math.round((propResults as any).ci1.lower * (propResults as any).n1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* {pLabel2} Result Box */}
                      {propType === '2samp' && (
                        <div className="bg-slate-950 p-4 rounded border-l-4 border-l-blue-500 border-y border-r border-slate-800">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-black text-blue-500 uppercase">{(propResults as any).label2} Results</span>
                            <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">N = {(propResults as any).n2.toLocaleString()}</span>
                          </div>
                          <table className="w-full text-xs font-mono">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-800">
                                <th className="text-left pb-2 font-normal">Metric</th>
                                <th className="text-right pb-2 font-normal">p(d)</th>
                                <th className="text-right pb-2 font-normal">ppm</th>
                                <th className="text-right pb-2 font-normal">Defects</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                              <tr>
                                <td className="py-2 text-slate-400">Upper Limit</td>
                                <td className="text-right text-red-500">{typeof (propResults as any).ci2.upper === 'number' ? formatPropValue((propResults as any).ci2.upper) : '--'}</td>
                                <td className="text-right text-slate-400">{Math.round((propResults as any).ci2.upper * 1000000)}</td>
                                <td className="text-right text-red-500">{Math.round((propResults as any).ci2.upper * (propResults as any).n2)}</td>
                              </tr>
                              <tr className="bg-slate-900/50">
                                <td className="py-2 text-white font-bold tracking-wider">NOMINAL</td>
                                <td className="text-right text-white font-bold">{typeof (propResults as any).ci2.nominal === 'number' ? formatPropValue((propResults as any).ci2.nominal) : '--'}</td>
                                <td className="text-right text-white font-bold">{Math.round((propResults as any).ci2.nominal * 1000000)}</td>
                                <td className="text-right text-white font-bold">{(propResults as any).e2}</td>
                              </tr>
                              <tr>
                                <td className="py-2 text-slate-400">Lower Limit</td>
                                <td className="text-right text-green-500">{typeof (propResults as any).ci2.lower === 'number' ? formatPropValue((propResults as any).ci2.lower) : '--'}</td>
                                <td className="text-right text-slate-400">{Math.round((propResults as any).ci2.lower * 1000000)}</td>
                                <td className="text-right text-green-500">{Math.round((propResults as any).ci2.lower * (propResults as any).n2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Comparison Output */}
                  <div className="bg-slate-950 p-8 rounded border-2 border-slate-800 shadow-2xl overflow-x-auto">
                    <h4 className="text-center font-black italic text-xl text-slate-300 uppercase mb-8 tracking-[0.2em] border-b border-slate-800 pb-4">
                      {propType === '1samp' ? 'Statistical Test Summary' : 'Statistical Comparison Results'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
                      
                      <div className="space-y-4">
                        <table className="w-full text-xs font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 uppercase italic">
                              <th className="text-left py-2 text-slate-500">Sample</th>
                              <th className="text-center py-2 text-sky-400">X</th>
                              <th className="text-center py-2 text-sky-400">N</th>
                              <th className="text-right py-2 text-sky-400">P-Hat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            <tr>
                              <td className="py-3 text-slate-400">{(propResults as any).label1}</td>
                              <td className="text-center text-slate-200">{(propResults as any).e1}</td>
                              <td className="text-center text-slate-200">{(propResults as any).n1.toLocaleString()}</td>
                              <td className="text-right text-slate-200">{typeof (propResults as any).p1 === 'number' ? formatPropValue((propResults as any).p1) : '--'}</td>
                            </tr>
                            {propType === '2samp' && (
                              <tr>
                                <td className="py-3 text-slate-400">{(propResults as any).label2}</td>
                                <td className="text-center text-slate-200">{(propResults as any).e2}</td>
                                <td className="text-center text-slate-200">{(propResults as any).n2.toLocaleString()}</td>
                                <td className="text-right text-slate-200">{typeof (propResults as any).p2 === 'number' ? formatPropValue((propResults as any).p2) : '--'}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <div className="p-3 bg-slate-900 rounded border border-slate-800 text-[10px] text-center text-slate-500 italic">
                          {propType === '1samp' ? `Testing against Target Prop: ${pTarget}` : 'Difference = p(1) - p(2)'}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="group border-b border-slate-800 pb-4">
                          <label className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">
                            {propType === '1samp' ? 'Observed Rate' : 'Estimate of Difference'}
                          </label>
                          <div className="text-2xl font-mono text-cyan-400 font-black tabular-nums">
                            {propType === '1samp' 
                              ? (typeof (propResults as any).p1 === 'number' ? formatPropValue((propResults as any).p1, 6) : '--')
                              : (typeof (propResults as any).diff === 'number' ? formatPropValue((propResults as any).diff, 8) : '--')}
                          </div>
                        </div>

                        <div className="group border-b border-slate-800 pb-4">
                          <label className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">
                            {(1-alpha)*100}% Bound for {propType === '1samp' ? 'Proportion' : 'Difference'}
                          </label>
                          <div className="text-xl font-mono text-red-500 font-black tabular-nums">
                            {propType === '1samp'
                              ? `${formatPropValue((propResults as any).ci1.lower)} ↔ ${formatPropValue((propResults as any).ci1.upper)}`
                              : (typeof (propResults as any).diffLower === 'number' 
                                  ? formatPropValue((propResults as any).diffLower, 8) 
                                  : typeof (propResults as any).diffUpper === 'number' 
                                    ? formatPropValue((propResults as any).diffUpper, 8)
                                    : '--')}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-1 italic uppercase font-bold">
                            Alternative (H₁): {propAlt === 'neq' ? '≠' : propAlt === 'greater' ? '>' : '<'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                          <div className="bg-slate-900 p-4 border border-slate-800 rounded">
                            <label className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">Z-Stat</label>
                            <div className="text-2xl font-mono text-white">{(propResults as any).statistic.toFixed(2)}</div>
                          </div>
                          <div className={`p-4 border rounded ${propResults.pValue < alpha ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/10 border-green-500/50'}`}>
                            <label className="block text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">P-Value</label>
                            <div className={`text-2xl font-mono font-black ${propResults.pValue < alpha ? 'text-red-500' : 'text-green-500'}`}>
                              {propResults.pValue.toFixed(4)}
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded border border-slate-800">
                          <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Conclusion</h5>
                          <p className="text-[10px] text-slate-400 leading-relaxed italic">
                            {propResults.pValue < alpha 
                              ? `Reject H₀: There is sufficient evidence at the ${(1-alpha)*100}% confidence level to suggest a significant difference.`
                              : `Fail to reject H₀: There is not enough evidence to suggest a significant difference.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'poisson' && (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl space-y-8">
              <h3 className="text-xl font-bold">
                {poiType === '1samp' ? '1-Sample Poisson Rate Test' : '2-Sample Poisson Rate Test'}
              </h3>
              {!poiResults ? (
                <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded text-slate-500 italic">
                  Complete input fields. Size must be {'>'} 0.
                </div>
              ) : (
                <div className="space-y-8">
                   <ExportWrapper fileName="poisson-summary">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Test Statistic</div>
                        <div className="text-2xl font-mono text-purple-500 font-bold">{poiResults.statistic.toFixed(4)}</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Alternative (H₁)</div>
                        <div className="text-xs mt-2 font-bold text-sky-400">
                          {poiAlt === 'neq' ? '≠' : poiAlt === 'greater' ? '>' : '<'}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">P-Value</div>
                        <div className={`text-2xl font-mono font-bold ${poiResults.pValue < alpha ? 'text-red-500' : 'text-green-500'}`}>
                          {poiResults.pValue.toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">{poiType === '1samp' ? 'Obs. Rate' : 'Diff (R1-R2)'}</div>
                        <div className="text-2xl font-mono text-slate-200">
                           {poiType === '1samp' ? (poiResults as any).rate.toFixed(4) : ((poiResults as any).r1 - (poiResults as any).r2).toFixed(4)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Decision</div>
                        <div className={`text-xs mt-2 font-bold ${poiResults.pValue < alpha ? 'text-red-400' : 'text-green-400'}`}>
                          {poiResults.pValue < alpha ? 'REJECT NULL' : 'FAIL TO REJECT'}
                        </div>
                      </div>
                    </div>
                  </ExportWrapper>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-900 p-4 rounded border border-slate-700 h-[300px]">
                       <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center tracking-widest">Plot of Poisson Rate Intervals</h4>
                       <ResponsiveContainer width="100%" height="85%">
                         <ComposedChart
                           layout="vertical"
                           data={
                             poiType === '1samp' 
                               ? [
                                   { name: (poiResults as any).label1, range: [(poiResults as any).ci1.lower, (poiResults as any).ci1.upper], nominal: (poiResults as any).ci1.nominal }
                                 ]
                               : [
                                   { name: (poiResults as any).label1, range: [(poiResults as any).ci1.lower, (poiResults as any).ci1.upper], nominal: (poiResults as any).ci1.nominal },
                                   { name: (poiResults as any).label2, range: [(poiResults as any).ci2.lower, (poiResults as any).ci2.upper], nominal: (poiResults as any).ci2.nominal }
                                 ]
                           }
                           margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                         >
                           <CartesianGrid stroke="#1e293b" />
                           <XAxis 
                             type="number" 
                             domain={[0, 'auto']} 
                             stroke="#64748b" 
                             fontSize={10} 
                           />
                           <YAxis 
                             type="category" 
                             dataKey="name" 
                             stroke="#64748b" 
                             fontSize={10} 
                             width={80}
                           />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                             formatter={(v: any) => Array.isArray(v) ? `${v[0].toFixed(4)} - ${v[1].toFixed(4)}` : (typeof v === 'number' ? v.toFixed(4) : v)}
                           />
                           <Bar dataKey="range" fill="#a78bfa44" radius={[0, 4, 4, 0]} barSize={8} />
                           {poiType === '1samp' && (
                             <ReferenceLine x={Number(poiTargetRate)} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: `Target: ${poiTargetRate}`, fill: '#ef4444', fontSize: 10 }} />
                           )}
                           <Scatter dataKey="nominal" fill="#a78bfa" shape="square" />
                         </ComposedChart>
                       </ResponsiveContainer>
                    </div>

                    <div className="bg-slate-900 p-6 rounded border border-slate-700 flex flex-col justify-center h-full">
                      <div className="space-y-4 text-xs">
                         <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Context</p>
                            <p className="text-slate-400 leading-relaxed">
                               {poiType === '1samp' 
                                 ? `Testing if an observed ${(poiResults as any).events} occurrences over ${(poiResults as any).sampleSize} units significantly deviates from expected rate of ${(poiResults as any).targetRate}.`
                                 : `Testing difference between Rate 1 (${(poiResults as any).r1.toFixed(4)}) and Rate 2 (${(poiResults as any).r2.toFixed(4)}).`}
                            </p>
                         </div>
                         <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800">
                            <h5 className="text-[10px] font-bold text-purple-400 uppercase mb-2 italic">Statistical Note</h5>
                            <p className="text-[10px] text-slate-500">
                               {poiType === '1samp' 
                                 ? "Calculated using exact Poisson distribution probabilities."
                                 : "Calculated using Z-test approximation for Poisson rate difference."}
                            </p>
                         </div>
                      </div>
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
