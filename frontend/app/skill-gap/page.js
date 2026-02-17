'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '../components/skill-gap/PageHeader';
import CategorySection from '../components/skill-gap/CategorySection';
import { calculateOverallMatchPercentage } from '../components/skill-gap/gapCalculations';

const STORAGE_KEY = 'skillGapJob';
const SKILL_GAP_JOB_UPDATED_KEY = 'skillGapJobUpdated';
const ANALYZER_STATE_KEY = 'skillsAnalyzerState';

// Order matches backend. Prefer green/red/yellow; fallback to present/missing for green/red.
const CATEGORIES = [
  { key: 'skills', label: 'Skills', greenKey: 'greenSkills', redKey: 'redSkills', yellowKey: 'yellowSkills', presentKey: 'presentSkills', missingKey: 'missingSkills' },
  { key: 'certifications', label: 'Certifications', greenKey: 'greenCertifications', redKey: 'redCertifications', yellowKey: 'yellowCertifications', presentKey: 'presentCertifications', missingKey: 'missingCertifications' },
  { key: 'databases', label: 'Databases', greenKey: 'greenDatabases', redKey: 'redDatabases', yellowKey: 'yellowDatabases', presentKey: 'presentDatabases', missingKey: 'missingDatabases' },
  { key: 'operatingSystems', label: 'Operating Systems', greenKey: 'greenOperatingSystems', redKey: 'redOperatingSystems', yellowKey: 'yellowOperatingSystems', presentKey: 'presentOperatingSystems', missingKey: 'missingOperatingSystems' },
  { key: 'codingLanguages', label: 'Coding Languages', greenKey: 'greenCodingLanguages', redKey: 'redCodingLanguages', yellowKey: 'yellowCodingLanguages', presentKey: 'presentCodingLanguages', missingKey: 'missingCodingLanguages' },
  { key: 'tools', label: 'Tools', greenKey: 'greenTools', redKey: 'redTools', yellowKey: 'yellowTools', presentKey: 'presentTools', missingKey: 'missingTools' },
];

// Build category state from job; when job has no yellow, derive it from user form (you have, job doesn't require).
function buildCategoryState(job, userForm = null) {
  const state = {};
  CATEGORIES.forEach(({ key, greenKey, redKey, yellowKey, presentKey, missingKey }) => {
    const green = job[greenKey] ?? job[presentKey] ?? [];
    const red = job[redKey] ?? job[missingKey] ?? [];
    let yellow = job[yellowKey] ?? [];
    const greenArr = Array.isArray(green) ? green : [];
    const redArr = Array.isArray(red) ? red : [];
    let yellowArr = Array.isArray(yellow) ? [...yellow] : [];
    // If backend didn't send yellow (or it's empty) and we have user form, compute: user has minus green
    if (yellowArr.length === 0 && userForm && Array.isArray(userForm[key])) {
      const greenSet = new Set(greenArr.map((x) => String(x).trim().toLowerCase()));
      yellowArr = userForm[key]
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter((s) => s && !greenSet.has(s.toLowerCase()));
    }
    state[key] = {
      green: [...greenArr],
      red: [...redArr],
      yellow: yellowArr,
    };
  });
  return state;
}

// Overall match %: linear scaling — (total present / total required) * 100 across all categories.
// Every skill contributes proportionally; no dramatic first-skill jump.
function computeOverallPercentage(categoryState) {
  return calculateOverallMatchPercentage(categoryState, CATEGORIES);
}

export default function SkillGapPage() {
  const router = useRouter();
  const [job, setJob] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [categoryState, setCategoryState] = useState(null);
  const [userHasModified, setUserHasModified] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const analyzerRaw = sessionStorage.getItem(ANALYZER_STATE_KEY);
      const userForm =
        analyzerRaw != null
          ? (() => {
              try {
                const s = JSON.parse(analyzerRaw);
                return {
                  skills: Array.isArray(s.skills) ? s.skills : [],
                  certifications: Array.isArray(s.certifications) ? s.certifications : [],
                  tools: Array.isArray(s.tools) ? s.tools : [],
                  databases: Array.isArray(s.databases) ? s.databases : [],
                  operatingSystems: Array.isArray(s.operatingSystems) ? s.operatingSystems : [],
                  codingLanguages: Array.isArray(s.codingLanguages) ? s.codingLanguages : [],
                };
              } catch {
                return null;
              }
            })()
          : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setJob(parsed);
        setCategoryState(buildCategoryState(parsed, userForm));
      } else {
        setJob(null);
        setCategoryState(null);
      }
    } catch {
      setJob(null);
      setCategoryState(null);
    }
  }, [mounted]);

  // Compute from current categoryState so present→missing always decreases overall %
  const backendPct = job ? (job.matchPercentage ?? job.percentage ?? 0) : 0;
  const overallPercentage =
    !categoryState || !userHasModified ? backendPct : computeOverallPercentage(categoryState);

  function handleAddToGreen(categoryKey, item) {
    setUserHasModified(true);
    setCategoryState((prev) => {
      if (!prev) return prev;
      const cat = prev[categoryKey];
      if (!cat || !cat.red.includes(item)) return prev;
      return {
        ...prev,
        [categoryKey]: {
          green: [...cat.green, item],
          red: cat.red.filter((x) => x !== item),
          yellow: [...(cat.yellow ?? [])],
        },
      };
    });
  }

  function handleMoveToRed(categoryKey, item) {
    setUserHasModified(true);
    setCategoryState((prev) => {
      if (!prev) return prev;
      const cat = prev[categoryKey];
      if (!cat || !cat.green.includes(item)) return prev;
      return {
        ...prev,
        [categoryKey]: {
          green: cat.green.filter((x) => x !== item),
          red: [...cat.red, item],
          yellow: [...(cat.yellow ?? [])],
        },
      };
    });
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-slate-600 mb-4">No job data found.</p>
        <Link
          href="/"
          className="text-slate-900 font-medium underline hover:no-underline"
        >
          ← Back to Skills Analyzer
        </Link>
      </div>
    );
  }

  const title = job.title ?? job.role ?? 'Job Title';
  const company = job.company ?? '';
  const location = job.location ?? '';
  const experience = job.experience ?? (job.requiredYearsOfExperience != null ? `${job.requiredYearsOfExperience} YOE` : '');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem('returnedFromSkillGap', '1');
                if (userHasModified && categoryState && job) {
                  const pct = computeOverallPercentage(categoryState);
                  const updatedJob = {
                    jobId: job.id ?? job.jobId,
                    id: job.id ?? job.jobId,
                    role: job.title ?? job.role ?? 'Role',
                    title: job.title ?? job.role ?? 'Role',
                    percentage: pct,
                    matchPercentage: pct,
                    requiredYearsOfExperience: job.requiredYearsOfExperience,
                    experience: job.experience ?? (job.requiredYearsOfExperience != null ? `${job.requiredYearsOfExperience} YOE` : ''),
                    presentSkills: categoryState.skills?.green ?? [],
                    missingSkills: categoryState.skills?.red ?? [],
                    greenSkills: categoryState.skills?.green ?? [],
                    redSkills: categoryState.skills?.red ?? [],
                    yellowSkills: categoryState.skills?.yellow ?? [],
                    presentCertifications: categoryState.certifications?.green ?? [],
                    missingCertifications: categoryState.certifications?.red ?? [],
                    greenCertifications: categoryState.certifications?.green ?? [],
                    redCertifications: categoryState.certifications?.red ?? [],
                    yellowCertifications: categoryState.certifications?.yellow ?? [],
                    presentTools: categoryState.tools?.green ?? [],
                    missingTools: categoryState.tools?.red ?? [],
                    greenTools: categoryState.tools?.green ?? [],
                    redTools: categoryState.tools?.red ?? [],
                    yellowTools: categoryState.tools?.yellow ?? [],
                    presentDatabases: categoryState.databases?.green ?? [],
                    missingDatabases: categoryState.databases?.red ?? [],
                    greenDatabases: categoryState.databases?.green ?? [],
                    redDatabases: categoryState.databases?.red ?? [],
                    yellowDatabases: categoryState.databases?.yellow ?? [],
                    presentOperatingSystems: categoryState.operatingSystems?.green ?? [],
                    missingOperatingSystems: categoryState.operatingSystems?.red ?? [],
                    greenOperatingSystems: categoryState.operatingSystems?.green ?? [],
                    redOperatingSystems: categoryState.operatingSystems?.red ?? [],
                    yellowOperatingSystems: categoryState.operatingSystems?.yellow ?? [],
                    presentCodingLanguages: categoryState.codingLanguages?.green ?? [],
                    missingCodingLanguages: categoryState.codingLanguages?.red ?? [],
                    greenCodingLanguages: categoryState.codingLanguages?.green ?? [],
                    redCodingLanguages: categoryState.codingLanguages?.red ?? [],
                    yellowCodingLanguages: categoryState.codingLanguages?.yellow ?? [],
                  };
                  sessionStorage.setItem(SKILL_GAP_JOB_UPDATED_KEY, JSON.stringify(updatedJob));
                }
              } catch (_) {}
              router.push('/');
            }}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Skills Analyzer
          </button>
        </div>

        <PageHeader
          title={title}
          company={company}
          location={location}
          experience={experience}
          matchPercentage={overallPercentage}
        />

        <div className="space-y-0">
          {CATEGORIES.map(({ key, label }) => (
            <CategorySection
              key={key}
              categoryKey={key}
              categoryName={label}
              greenItems={categoryState?.[key]?.green ?? []}
              redItems={categoryState?.[key]?.red ?? []}
              yellowItems={categoryState?.[key]?.yellow ?? []}
              onAddToGreen={handleAddToGreen}
              onMoveToRed={handleMoveToRed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
