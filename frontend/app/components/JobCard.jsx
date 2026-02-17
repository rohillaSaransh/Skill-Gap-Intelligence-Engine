'use client';

const MAX_SKILLS = 3;
const MAX_CERTS = 2;
const MAX_TOOLS = 3;

function PillList({ items, max, moreLabel, className }) {
  if (!items || items.length === 0) return null;
  const show = items.slice(0, max);
  const rest = items.length - max;
  return (
    <div className="flex flex-wrap gap-1.5">
      {show.map((item, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
        >
          {item}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-100">
          +{rest} more
        </span>
      )}
    </div>
  );
}

export default function JobCard({ job, onViewSkillGap }) {
  if (!job) return null;

  function handleViewSkillGap() {
    if (typeof onViewSkillGap === 'function') {
      onViewSkillGap(job);
    }
  }

  const {
    title,
    company,
    location,
    experience,
    matchPercentage = 0,
    missingSkills = [],
    missingCertifications = [],
    missingTools = [],
  } = job;

  const badgeColor =
    matchPercentage >= 75
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200'
      : matchPercentage >= 50
        ? 'bg-amber-500/15 text-amber-700 border-amber-200'
        : 'bg-red-500/15 text-red-700 border-red-200';

  return (
    <article className="relative rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900 truncate">{title}</h3>
            {company && <p className="text-sm text-slate-500 mt-0.5">{company}</p>}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
              {location && <span>{location}</span>}
              {experience && <span>{experience}</span>}
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold border ${badgeColor}`}
          >
            {matchPercentage}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              matchPercentage >= 75
                ? 'bg-emerald-500'
                : matchPercentage >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, matchPercentage)}%` }}
          />
        </div>
      </div>

      {/* Missing requirements */}
      <div className="px-5 pb-4 flex-1 flex flex-col gap-3">
        {/* Missing Skills */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Missing skills
          </p>
          {missingSkills && missingSkills.length > 0 ? (
            <PillList
              items={missingSkills}
              max={MAX_SKILLS}
              moreLabel="+X more"
              className="text-red-700 bg-red-50 border border-red-100"
            />
          ) : (
            <p className="text-xs text-slate-400">None</p>
          )}
        </div>

        {/* Missing Certifications */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Missing certifications
          </p>
          {missingCertifications && missingCertifications.length > 0 ? (
            <PillList
              items={missingCertifications}
              max={MAX_CERTS}
              className="text-amber-800 bg-amber-50 border border-amber-100"
            />
          ) : (
            <p className="text-xs text-emerald-600 font-medium">No certification gap</p>
          )}
        </div>

        {/* Missing Tools */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Missing tools
          </p>
          {missingTools && missingTools.length > 0 ? (
            <PillList
              items={missingTools}
              max={MAX_TOOLS}
              moreLabel="+X more"
              className="text-red-700 bg-red-50 border border-red-100"
            />
          ) : (
            <p className="text-xs text-slate-400">None</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-0">
        <button
          type="button"
          onClick={handleViewSkillGap}
          className="w-full py-3 px-4 rounded-xl font-medium text-sm text-slate-700 bg-slate-50 border border-slate-200 shadow-sm hover:bg-slate-100 hover:shadow transition-all duration-150"
        >
          View Detailed Skill Gap →
        </button>
      </div>
    </article>
  );
}
