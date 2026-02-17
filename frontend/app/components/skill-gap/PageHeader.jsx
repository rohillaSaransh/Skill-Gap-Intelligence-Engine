'use client';

import ProgressBar from './ProgressBar';

export default function PageHeader({ title, company, location, experience, matchPercentage }) {
  const pct = Math.min(100, Math.max(0, Number(matchPercentage ?? 0)));
  const barVariant = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger';

  return (
    <header className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title || 'Job Title'}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-slate-500 text-sm">
        {company && <span>{company}</span>}
        {location && <span>{location}</span>}
        {experience && <span>{experience}</span>}
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-sm font-medium text-slate-600">Overall match</span>
          <span className="text-xl font-bold text-slate-900">{pct}%</span>
        </div>
        <ProgressBar value={pct} variant={barVariant} className="h-3" />
      </div>
    </header>
  );
}
