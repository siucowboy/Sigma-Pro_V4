import React, { useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ExportWrapper({ children, fileName = 'chart-export' }: { children: React.ReactNode, fileName?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (containerRef.current) {
      setCopied(false);
      try {
        // Use htmlToImage to capture precisely the content
        // We filter out the "Right-click to Copy" badge
        const blob = await htmlToImage.toBlob(containerRef.current, { 
          backgroundColor: '#0f172a',
          pixelRatio: 2,
          filter: (node) => {
            if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
              return false;
            }
            return true;
          }
        });
        
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        console.error('Copy to clipboard failed', err);
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      onContextMenuCapture={handleContextMenu} 
      className="cursor-context-menu relative group block w-full"
      title="Right-click to copy as PNG"
    >
      {children}
      
      {/* Tiny overlay hint that appears on hover - HIDDEN during export */}
      <div className="export-ignore absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] bg-slate-800/80 backdrop-blur-sm text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 transition-opacity pointer-events-none z-10">
        Right-click to Copy
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {copied && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm">
              <Check size={16} />
              Copied to Clipboard
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
