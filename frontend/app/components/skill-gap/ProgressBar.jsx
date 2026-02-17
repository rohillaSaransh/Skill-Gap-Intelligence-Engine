'use client';

export default function ProgressBar({ value = 0, variant = 'default', className = '' }) {
  const pct = Math.min(100, Math.max(0, Number(value)));
  const colorMap = {
    default: 'bg-slate-300',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };
  const fill = colorMap[variant] || colorMap.default;

  return (
    <div className={`h-2 w-full rounded-full overflow-hidden bg-slate-100 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
