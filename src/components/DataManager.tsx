import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Trash2, FileSpreadsheet, Database } from 'lucide-react';
import { Dataset } from '../App';

interface Props {
  datasets: Dataset[];
  setDatasets: React.Dispatch<React.SetStateAction<Dataset[]>>;
}

export default function DataManager({ datasets, setDatasets }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse multi-column data (CSV/Excel arrays)
  const processData = useCallback((rawData: any[][]) => {
    if (!rawData || rawData.length === 0) {
      setIsProcessing(false);
      return;
    }

    const headers = rawData[0];
    const newDatasets: Dataset[] = [];

    // Faster iteration
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const colName = header ? String(header).trim() : `Column ${colIndex + 1}`;
      const values: (number | string)[] = [];
      let isNumeric = true;

      for (let i = 1; i < rawData.length; i++) {
        let val = rawData[i][colIndex];
        
        // Skip empty values efficiently
        if (val === undefined || val === null || val === '') continue;

        // Handle percentage strings
        if (typeof val === 'string' && val.trim().endsWith('%')) {
          const stripped = val.trim().replace('%', '');
          const num = Number(stripped);
          if (!isNaN(num)) {
            values.push(num / 100);
            continue;
          }
        }

        const numVal = Number(val);
        if (isNaN(numVal)) {
          isNumeric = false;
          values.push(String(val).trim());
        } else {
          values.push(numVal);
        }
      }

      if (values.length > 0) {
        // Fallback for randomUUID which might not be available in all environments
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        newDatasets.push({
          id,
          name: colName,
          values,
          isNumeric
        });
      }
    }

    // Limit to prevent crashing the UI with too many columns
    if (newDatasets.length > 500) {
      console.warn("Large dataset detected, truncating to first 500 columns for performance.");
      newDatasets.length = 500;
    }

    setDatasets(prev => [...prev, ...newDatasets]);
    setIsProcessing(false);
  }, [setDatasets]);

  // Handle File Upload (Drag/Drop or Browse)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    let file;
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files[0];
    } else {
      file = (e.target as HTMLInputElement).files?.[0];
    }
    
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        processData(data as any[][]);
      } catch (err) {
        console.error("File processing error:", err);
        setIsProcessing(false);
      }
    };
    reader.onerror = () => setIsProcessing(false);
    reader.readAsBinaryString(file);
  };

  const removeDataset = (id: string) => {
    setDatasets(prev => prev.filter(d => d.id !== id));
  };

  // --- Paste Handler ---
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData || isProcessing) return;

    setIsProcessing(true);

    // Defer processing to keep UI responsive
    setTimeout(() => {
      try {
        const lines = pasteData.trim().split(/\r?\n/);
        const rows = lines.map(line => {
          if (line.includes('\t')) return line.split('\t');
          return line.split(',');
        });

        if (rows.length > 0) {
          processData(rows as any[][]);
        } else {
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Paste processing error:", err);
        setIsProcessing(false);
      }
    }, 50);
  }, [processData, isProcessing]);

  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  const clearAll = () => {
    setDatasets([]);
    setShowConfirmPurge(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Data Manager</h2>
          <p className="text-slate-400">Import and manage variables for statistical analysis.</p>
        </div>
        {datasets.length > 0 && (
          <div className="flex items-center gap-2">
            {showConfirmPurge ? (
              <div className="flex items-center gap-2 bg-red-900/20 p-1 rounded border border-red-500/30">
                <span className="text-xs text-red-400 px-2 font-medium">Are you sure?</span>
                <button 
                  onClick={clearAll}
                  className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-500 transition"
                >
                  Yes, Purge
                </button>
                <button 
                  onClick={() => setShowConfirmPurge(false)}
                  className="px-3 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowConfirmPurge(true)}
                className="px-4 py-2 bg-red-900/30 text-red-400 border border-red-800/50 rounded hover:bg-red-900/50 transition"
              >
                Purge All Data
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Zone */}
        <div className="col-span-1 lg:col-span-2">
          <div 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all outline-none ${
              isDragging 
                ? 'border-sky-400 bg-sky-900/20' 
                : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
            }`}
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileUpload}
            onPaste={handlePaste}
          >
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4"></div>
                <h4 className="text-xl font-bold text-white mb-1">Processing Data</h4>
                <p className="text-slate-400 text-sm">Please wait while we parse your dataset...</p>
              </div>
            )}
            <UploadCloud className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-200 mb-2">Import Your Data</h3>
            <p className="text-slate-400 mb-6 text-sm">
              Drag & Drop, <span className="text-sky-400 font-medium">Paste (Ctrl+V)</span>, or browse for Excel/CSV files.
            </p>
            <label className="cursor-pointer px-6 py-3 bg-sky-600 text-white font-medium rounded hover:bg-sky-500 transition shadow-lg inline-block">
              Browse Files
              <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Inventory Side Panel */}
        <div className="col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col h-[500px]">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-sky-400" />
            Data Inventory
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {datasets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <FileSpreadsheet className="w-8 h-8 mb-2 opacity-50" />
                <p>No datasets loaded.</p>
              </div>
            ) : (
              datasets.map(dataset => (
                <div key={dataset.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                  <div className="overflow-hidden">
                    <h4 className="text-slate-200 font-medium truncate" title={dataset.name}>{dataset.name}</h4>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">n = {dataset.values.length}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${dataset.isNumeric ? 'bg-sky-900/50 text-sky-400' : 'bg-amber-900/50 text-amber-400'}`}>
                        {dataset.isNumeric ? 'Numeric' : 'Text'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeDataset(dataset.id)}
                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                    title="Remove Dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}