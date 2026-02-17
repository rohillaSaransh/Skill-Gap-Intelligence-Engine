/**
 * Fallback category mappings from parsed_jobs + skill_taxonomy.
 * Used when MongoDB SkillMaster is empty or disconnected so resume items
 * still count as "mapped" and don't appear in unmappedSkills.
 */
const path = require('path');
const fs = require('fs');

const CATEGORY_TO_JOB_KEY = {
  programming_language: 'codingLanguages',
  tool: 'tools',
  certification: 'certifications',
  database: 'databases',
  operating_system: 'operatingSystems',
  general_skill: 'skills',
};

const TAXONOMY_TO_CATEGORY = {
  skills: 'general_skill',
  tools: 'tool',
  certifications: 'certification',
  databases: 'database',
  operatingSystems: 'operating_system',
  codingLanguages: 'programming_language',
};

// Extra known terms and aliases when not present in parsed_jobs (lowercase)
const EXTRA_KNOWN = {
  tool: ['snyk', 'metasploit', 'msfconsole', 'burp suite', 'nmap', 'nessus', 'sqlmap', 'zap', 'owasp zap', 'fortify', 'checkmarx', 'nikto', 'wireshark', 'bloodhound'],
  certification: ['ejpt', 'ceh', 'oscp', 'oswe', 'gpen', 'gwapt', 'cissp', 'security+', 'comptia security+', 'gcias', 'gcih', 'gpen', 'casp+', 'cysa+'],
  general_skill: ['vulnerability assessment', 'penetration testing', 'static application security testing', 'dynamic application security testing', 'sast', 'dast', 'ethical hacking', 'web application security', 'api security', 'network security', 'security testing'],
  operating_system: ['kali', 'kali linux', 'linux', 'windows', 'ubuntu', 'macos', 'unix', 'debian', 'centos', 'red hat', 'fedora', 'parrot os', 'parrot'],
};
const ALIASES_TO_CANONICAL = [
  ['msfconsole', 'metasploit'],
  ['fortify webinspect', 'fortify'],
  ['fortify static code analyzer', 'fortify'],
  ['owasp zap', 'zap'],
  ['burp suite pro', 'burp suite'],
  ['sast', 'static application security testing'],
  ['dast', 'dynamic application security testing'],
];

let cached = null;

function toKey(str) {
  return str == null ? '' : String(str).toLowerCase().trim();
}

/**
 * Build master sets and alias map from parsed_jobs.json and skill_taxonomy.json.
 * @returns {{ masterByCategory: Record<string, Set<string>>, aliasMap: Map<string, string> }}
 */
function loadFallbackMappings() {
  if (cached) return cached;

  const masterByCategory = {
    programming_language: new Set(),
    tool: new Set(),
    certification: new Set(),
    database: new Set(),
    operating_system: new Set(),
    general_skill: new Set(),
  };
  const aliasMap = new Map();

  const dataDir = path.join(__dirname, '..', '..', 'data');

  // 1) From parsed_jobs: unique values per job key, normalized to lowercase
  try {
    const jobsPath = path.join(dataDir, 'parsed_jobs.json');
    const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    if (Array.isArray(jobs)) {
      for (const job of jobs) {
        for (const [category, jobKey] of Object.entries(CATEGORY_TO_JOB_KEY)) {
          const arr = job[jobKey];
          if (!Array.isArray(arr)) continue;
          const set = masterByCategory[category];
          if (!set) continue;
          for (const v of arr) {
            const k = toKey(v);
            if (k) set.add(k);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fallback mappings: could not load parsed_jobs.json', err.message);
  }

  // 2) From skill_taxonomy: canonicals, aliases, subskills per field; alias -> canonical
  try {
    const taxonomyPath = path.join(dataDir, 'skill_taxonomy.json');
    const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
    if (taxonomy && typeof taxonomy === 'object') {
      for (const [fieldType, field] of Object.entries(taxonomy)) {
        const category = TAXONOMY_TO_CATEGORY[fieldType];
        if (!category || !field || typeof field !== 'object') continue;
        const set = masterByCategory[category];
        if (!set) continue;
        for (const [canonical, entry] of Object.entries(field)) {
          const canon = toKey(canonical);
          if (canon) set.add(canon);
          const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
          for (const a of aliases) {
            const ak = toKey(a);
            if (ak) {
              set.add(ak);
              aliasMap.set(ak, canon);
            }
          }
          const subskills = Array.isArray(entry?.subskills) ? entry.subskills : [];
          for (const s of subskills) {
            const sk = toKey(s);
            if (sk) {
              set.add(sk);
              aliasMap.set(sk, canon);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fallback mappings: could not load skill_taxonomy.json', err.message);
  }

  // 3) Extra known terms (so snyk, msfconsole, etc. are mapped even if missing from jobs)
  for (const [category, list] of Object.entries(EXTRA_KNOWN)) {
    const set = masterByCategory[category];
    if (set && Array.isArray(list)) for (const term of list) {
      const k = toKey(term);
      if (k) set.add(k);
    }
  }
  for (const [alias, canonical] of ALIASES_TO_CANONICAL) {
    const ak = toKey(alias);
    const ck = toKey(canonical);
    if (ak && ck) aliasMap.set(ak, ck);
  }

  cached = { masterByCategory, aliasMap };
  return cached;
}

module.exports = { loadFallbackMappings, CATEGORY_TO_JOB_KEY, TAXONOMY_TO_CATEGORY };
