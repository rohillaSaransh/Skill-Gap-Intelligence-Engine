'use client';

import JobCard from './JobCard';

const DUMMY_JOBS = [
  {
    id: 1,
    title: 'Application Security Engineer',
    company: 'TechCorp',
    location: 'Remote',
    experience: '3–5 years',
    matchPercentage: 62,
    missingSkills: ['Kubernetes', 'Terraform', 'Cloud Security'],
    missingCertifications: ['OSCP', 'AWS Security Specialty'],
    missingTools: ['Metasploit', 'Fortify SCA', 'Snyk'],
  },
  {
    id: 2,
    title: 'Senior Penetration Tester',
    company: 'SecureNet',
    location: 'New York, NY',
    experience: '5+ years',
    matchPercentage: 78,
    missingSkills: ['Mobile pentesting'],
    missingCertifications: [],
    missingTools: ['Burp Suite Pro'],
  },
  {
    id: 3,
    title: 'Security Consultant',
    company: 'CyberShield',
    location: 'London, UK',
    experience: '2–4 years',
    matchPercentage: 45,
    missingSkills: ['OWASP', 'Threat Modeling', 'Incident Response', 'SIEM'],
    missingCertifications: ['CISSP', 'CEH'],
    missingTools: ['Nessus', 'Wireshark', 'Splunk', 'QRadar'],
  },
  {
    id: 4,
    title: 'DevSecOps Engineer',
    company: 'CloudFirst',
    location: 'Remote',
    experience: '4–6 years',
    matchPercentage: 88,
    missingSkills: [],
    missingCertifications: [],
    missingTools: [],
  },
  {
    id: 5,
    title: 'Vulnerability Analyst',
    company: 'DefenseLab',
    location: 'Washington, DC',
    experience: '1–3 years',
    matchPercentage: 55,
    missingSkills: ['Python', 'Scripting'],
    missingCertifications: ['Security+'],
    missingTools: ['Nmap', 'Nikto'],
  },
  {
    id: 6,
    title: 'Red Team Lead',
    company: 'OffensiveSec',
    location: 'Austin, TX',
    experience: '6+ years',
    matchPercentage: 72,
    missingSkills: ['C2 frameworks'],
    missingCertifications: ['OSWE'],
    missingTools: ['Cobalt Strike', 'BloodHound'],
  },
];

/**
 * @param {Array} jobs - Array of job objects
 * @param {Function} onViewSkillGap - Optional callback(job) when "View Detailed Skill Gap" is clicked
 */
export default function JobGrid({ jobs = DUMMY_JOBS, onViewSkillGap }) {
  const list = Array.isArray(jobs) && jobs.length > 0 ? jobs : DUMMY_JOBS;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((job) => (
          <JobCard key={job.id ?? job.jobId ?? job.title} job={job} onViewSkillGap={onViewSkillGap} />
        ))}
      </div>
    </div>
  );
}
