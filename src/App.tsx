import React, { useState, useEffect } from 'react';
import { Database, BarChart2, Activity, TrendingUp, Grid, GitCommit, Calculator, Sun, Moon, Network } from 'lucide-react';
import { get, set } from 'idb-keyval';
import DataManager from './components/DataManager';
import CapabilityModule from './components/CapabilityModule';
import PowerSampleSizeModule from './components/PowerSampleSizeModule';
import HypothesisModule from './components/HypothesisModule';
import RegressionModule from './components/RegressionModule';
import LogisticRegressionModule from './components/LogisticRegressionModule';
import DOEModule from './components/DOEModule';
import SPCModule from './components/SPCModule';

export interface Dataset {
  id: string;
  name: string;
  values: (number | string)[];
  isNumeric: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('data');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Persistence with IndexedDB (via idb-keyval)
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  // Load datasets and theme on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Load datasets
        const savedDatasets = await get<Dataset[]>('sigmaStats_datasets');
        if (savedDatasets) {
          setDatasets(savedDatasets);
        } else {
          const legacy = localStorage.getItem('sigmaStats_datasets');
          if (legacy) {
            setDatasets(JSON.parse(legacy));
          }
        }

        // Load theme preference
        const savedTheme = await get<boolean>('sigmaStats_theme_dark');
        if (savedTheme !== undefined) {
          setIsDarkMode(savedTheme);
        }
      } catch (e) {
        console.error('Failed to load initial data:', e);
      } finally {
        setIsInitialized(true);
      }
    }
    loadInitialData();
  }, []);

  // Save datasets on change (debounced)
  useEffect(() => {
    if (!isInitialized) return;
    const handler = setTimeout(async () => {
      try {
        await set('sigmaStats_datasets', datasets);
      } catch (e) {
        console.error('Failed to save datasets:', e);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [datasets, isInitialized]);

  // Save theme on change
  useEffect(() => {
    if (!isInitialized) return;
    set('sigmaStats_theme_dark', isDarkMode);
  }, [isDarkMode, isInitialized]);

  const navItems = [
    { id: 'data', label: 'Data Manager', icon: Database },
    { id: 'capability', label: 'Process Capability', icon: BarChart2 },
    { id: 'power', label: 'Power and Sample Size', icon: Calculator },
    { id: 'hypothesis', label: 'Hypothesis Tests', icon: Activity },
    { id: 'regression', label: 'Regression Analysis', icon: TrendingUp },
    { id: 'logistic', label: 'Logistic Regression', icon: Network },
    { id: 'doe', label: 'Factorial DOE', icon: Grid },
    { id: 'spc', label: 'Control Charts', icon: GitCommit },
  ];

  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'light bg-slate-50 text-slate-900'}`}>
      {/* Sidebar Navigation */}
      <div className={`w-64 flex flex-col border-r transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b flex items-center justify-between transition-colors duration-300 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <h1 className={`text-xl font-bold tracking-wider transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            SigmaStats <span className="text-sky-400">Pro</span>
          </h1>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-lg transition-all duration-300 ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-indigo-600 hover:bg-slate-200 shadow-sm'}`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-3 text-sm transition-all duration-200 ${
                  isActive 
                    ? (isDarkMode ? 'bg-slate-800 text-sky-400 border-r-2 border-sky-400' : 'bg-sky-50 text-sky-600 border-r-2 border-sky-600 font-medium') 
                    : (isDarkMode ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className={activeTab === 'data' ? 'block h-full' : 'hidden'}><DataManager datasets={datasets} setDatasets={setDatasets} /></div>
        <div className={activeTab === 'capability' ? 'block h-full' : 'hidden'}><CapabilityModule datasets={datasets} /></div>
        <div className={activeTab === 'power' ? 'block h-full' : 'hidden'}><PowerSampleSizeModule /></div>
        <div className={activeTab === 'hypothesis' ? 'block h-full' : 'hidden'}><HypothesisModule datasets={datasets} /></div>
        <div className={activeTab === 'regression' ? 'block h-full' : 'hidden'}><RegressionModule datasets={datasets} /></div>
        <div className={activeTab === 'logistic' ? 'block h-full' : 'hidden'}><LogisticRegressionModule datasets={datasets} /></div>
        <div className={activeTab === 'doe' ? 'block h-full' : 'hidden'}><DOEModule datasets={datasets} /></div>
        <div className={activeTab === 'spc' ? 'block h-full' : 'hidden'}><SPCModule datasets={datasets} /></div>
      </div>
    </div>
  );
}
