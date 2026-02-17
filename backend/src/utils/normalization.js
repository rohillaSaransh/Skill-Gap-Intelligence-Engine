/**
 * Normalization utilities for resume extraction pipeline.
 * Ensures all extracted values are flattened to strings and never "[object Object]".
 */

const BAD_STRING = '[object object]';

/**
 * Flatten a single value to a string for inclusion in arrays.
 */
function flattenToOneString(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item).trim();
  if (Array.isArray(item)) return flattenToOneString(item[0]) || '';
  if (typeof item === 'object') {
    const s = (item.name ?? item.title ?? item.value ?? item.label ?? item.code ?? item.id ?? '').trim();
    if (typeof s === 'string' && s) return s;
    return '';
  }
  const s = String(item).trim();
  return s.toLowerCase() === BAD_STRING ? '' : s;
}

/**
 * Flatten an array of mixed values into an array of lowercase trimmed strings.
 */
function flattenToStringArray(array) {
  if (!Array.isArray(array)) return [];
  const out = [];
  for (const item of array) {
    const s = flattenToOneString(item).toLowerCase().trim();
    if (!s || s === BAD_STRING) continue;
    out.push(s);
  }
  return out;
}

/**
 * Normalize a certification label for matching (resume pipeline).
 * e.g. "INE – eJPT (Junior Penetration Tester)" → "ejpt"
 */
function normalizeCertForMatching(value) {
  if (value == null || typeof value !== 'string') return '';
  let s = value.trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/\s*\([^)]*\)/g, '').trim();
  s = s.replace(/^[^–\-]+\s*[–\-]\s*/i, '').trim();
  if (!s || s === BAD_STRING) return '';
  return s;
}

/** Full certification name (lowercase) -> canonical acronym for matching */
const CERT_FULL_TO_ACRONYM = {
  'certified ethical hacker': 'ceh',
  'offensive security certified professional': 'oscp',
  'offensive security web expert': 'oswe',
  'certified information systems security professional': 'cissp',
  'certified vulnerability assessor': 'cva',
  'giac penetration tester': 'gpen',
  'giac web application penetration tester': 'gwapt',
  'certified information privacy professional': 'cipp',
  'comptia security plus': 'security+',
  'comptia security+': 'security+',
  'junior penetration tester': 'ejpt',
  'ine junior penetration tester': 'ejpt',
};

/**
 * Return a canonical short form for matching so "Certified Ethical Hacker (CEH)" and "CEH" both become "ceh".
 */
function getCanonicalCertForMatching(value) {
  if (value == null || typeof value !== 'string') return '';
  let s = value.trim().toLowerCase();
  if (!s || s === BAD_STRING) return '';
  const parenMatch = s.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const acronym = parenMatch[1].trim().toLowerCase();
    if (acronym) return acronym;
  }
  const withoutParens = s.replace(/\s*\([^)]*\)/g, '').trim();
  if (CERT_FULL_TO_ACRONYM[withoutParens]) return CERT_FULL_TO_ACRONYM[withoutParens];
  return withoutParens || s;
}

function dedupeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr)];
}

const KNOWN_OS = new Set([
  'kali', 'kali linux', 'linux', 'windows', 'ubuntu', 'macos', 'unix', 'debian', 'centos',
  'red hat', 'redhat', 'fedora', 'parrot os', 'parrot', 'freebsd', 'kali linux rolling',
]);

/**
 * Re-categorize: move known OS terms from tools/skills into operating_systems.
 */
function rebalanceCategories(flattened) {
  if (!flattened || typeof flattened !== 'object') return flattened;
  const out = {
    skills: Array.isArray(flattened.skills) ? [...flattened.skills] : [],
    tools: Array.isArray(flattened.tools) ? [...flattened.tools] : [],
    certifications: Array.isArray(flattened.certifications) ? [...flattened.certifications] : [],
    programming_languages: Array.isArray(flattened.programming_languages) ? [...flattened.programming_languages] : [],
    databases: Array.isArray(flattened.databases) ? [...flattened.databases] : [],
    operating_systems: Array.isArray(flattened.operating_systems) ? [...flattened.operating_systems] : [],
  };
  const toOs = [];
  out.tools = out.tools.filter((t) => {
    if (KNOWN_OS.has(t)) { toOs.push(t); return false; }
    return true;
  });
  out.skills = out.skills.filter((s) => {
    if (KNOWN_OS.has(s)) { toOs.push(s); return false; }
    return true;
  });
  out.operating_systems = dedupeStrings([...out.operating_systems, ...toOs]);
  return out;
}

module.exports = {
  flattenToOneString,
  flattenToStringArray,
  normalizeCertForMatching,
  getCanonicalCertForMatching,
  dedupeStrings,
  rebalanceCategories,
  BAD_STRING,
};
