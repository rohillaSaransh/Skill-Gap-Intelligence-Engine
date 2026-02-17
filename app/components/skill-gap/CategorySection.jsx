'use client';

import ProgressBar from './ProgressBar';
import { calculateSkillGap } from './gapCalculations';

/**
 * Renders green (candidate has + job requires), red (job requires, candidate doesn't have),
 * yellow (candidate has, job does NOT require). Percentages use ONLY green and red.
 */
export default function CategorySection({
  categoryKey,
  categoryName,
  greenItems = [],
  redItems = [],
  yellowItems = [],
  onAddToGreen,
  onMoveToRed,
}) {
  const { matchPct, missingPct, totalRequired } = calculateSkillGap(greenItems, redItems);
  const missingVariant = missingPct < 25 ? 'success' : missingPct <= 50 ? 'warning' : 'danger';
  const missingColorClass =
    missingPct < 25 ? 'text-emerald-600' : missingPct <= 50 ? 'text-amber-600' : 'text-red-600';

  const addToGreenHint = `Click to add to required (you have it)`;
  const moveToRedHint = `Click to mark as not having this`;

  return (
    <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">{categoryName}</h2>
          <span className={`text-sm font-semibold ${missingColorClass}`}>
            Missing: {missingPct}%
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={missingPct} variant={missingVariant} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-3">
            Green — You have & job requires
          </p>
          {greenItems?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {greenItems.map((item, i) => (
                <button
                  key={`g-${i}`}
                  type="button"
                  title={moveToRedHint}
                  onClick={() => onMoveToRed?.(categoryKey, item)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer hover:bg-emerald-100 hover:border-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-1"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">None</p>
          )}
        </div>

        <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-3">
            Red — Job requires, you don&apos;t have
          </p>
          {redItems?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {redItems.map((item, i) => (
                <button
                  key={`r-${i}`}
                  type="button"
                  title={addToGreenHint}
                  onClick={() => onAddToGreen?.(categoryKey, item)}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-800 border border-red-200 cursor-pointer hover:bg-red-100 hover:border-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-emerald-600">No gap in this category</p>
          )}
        </div>

        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-3">
            Yellow — You have, job doesn&apos;t require
          </p>
          {yellowItems?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {yellowItems.map((item, i) => (
                <span
                  key={`y-${i}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">None</p>
          )}
        </div>
      </div>
    </section>
  );
}
