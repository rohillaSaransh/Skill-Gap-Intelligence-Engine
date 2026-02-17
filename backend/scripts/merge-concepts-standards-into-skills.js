/**
 * One-time script: merge securityConcepts and securityStandards into skills
 * for each job in parsed_jobs.json, then clear securityConcepts and securityStandards.
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'parsed_jobs.json');
const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

for (const job of jobs) {
  const skills = Array.isArray(job.skills) ? job.skills : [];
  const concepts = Array.isArray(job.securityConcepts) ? job.securityConcepts : [];
  const standards = Array.isArray(job.securityStandards) ? job.securityStandards : [];
  const merged = [...new Set([...skills, ...concepts, ...standards])].filter(
    (v) => v != null && String(v).trim() !== ''
  );
  job.skills = merged;
  job.securityConcepts = [];
  job.securityStandards = [];
}

fs.writeFileSync(dataPath, JSON.stringify(jobs, null, 2), 'utf8');
console.log('Merged securityConcepts and securityStandards into skills for', jobs.length, 'jobs.');
