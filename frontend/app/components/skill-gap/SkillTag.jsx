'use client';

export default function SkillTag({ children, variant = 'present', className = '' }) {
  const base = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium';
  const variants = {
    present: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    missing: 'bg-red-50 text-red-800 border border-red-200',
  };
  const style = variants[variant] || variants.present;
  return <span className={`${base} ${style} ${className}`}>{children}</span>;
}
