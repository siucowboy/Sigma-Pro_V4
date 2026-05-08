import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { getVerseForCategory, VerseCategory } from '../data/verses';

type VerseCardProps = {
  category: VerseCategory;
  heading?: string;
};

export default function VerseCard({ category, heading = 'Reflection' }: VerseCardProps) {
  const verse = useMemo(() => getVerseForCategory(category), [category]);

  return (
    <aside className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 p-1.5 text-sky-400">
          <BookOpen size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {heading}
          </h3>
          <blockquote className="mt-1 text-sm leading-relaxed text-slate-200">
            "{verse.text}"
          </blockquote>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-medium text-slate-300">
              {verse.reference}, {verse.translation}
            </span>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <span className="text-slate-500" title={verse.attributionFull}>
              {verse.attributionShort}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
