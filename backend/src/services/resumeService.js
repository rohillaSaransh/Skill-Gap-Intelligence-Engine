/**
 * Resume analysis pipeline: flatten → normalize → dedupe → clean response.
 * Uses utils/normalization.js and normalizeResumeService; does not change weighted matching.
 */
const {
  flattenToStringArray,
  normalizeCertForMatching,
  dedupeStrings,
  rebalanceCategories,
} = require('../utils/normalization');
const { normalizeExtracted } = require('./normalizeResumeService');

const DEBUG = true; // set to false to disable logs

function log(phase, label, data) {
  if (!DEBUG) return;
  console.log(`[Resume pipeline] ${phase}: ${label}`, JSON.stringify(data, null, 2).slice(0, 500));
}

/**
 * Flatten all extracted array fields to string[] and normalize cert labels for matching.
 * @param {object} extracted - Raw from OpenAI (skills, tools, certifications, etc.)
 * @returns {object} Flattened arrays (lowercase trimmed strings); certs also normalized for matching
 */
function flattenExtracted(extracted) {
  const raw = {
    skills: flattenToStringArray(extracted.skills || []),
    tools: flattenToStringArray(extracted.tools || []),
    certifications: flattenToStringArray(extracted.certifications || []),
    programming_languages: flattenToStringArray(extracted.programming_languages || []),
    databases: flattenToStringArray(extracted.databases || []),
    operating_systems: flattenToStringArray(extracted.operating_systems || []),
  };
  // Normalize certification strings for matching (e.g. "INE – eJPT (Junior...)" → "ejpt")
  raw.certifications = raw.certifications.map(normalizeCertForMatching).filter(Boolean);
  raw.certifications = dedupeStrings(raw.certifications);
  return raw;
}

/**
 * Ensure no "[object Object]" or invalid values in any array.
 * @param {object} obj - categorizedSkills or unmappedSkills
 * @returns {object} Same shape, cleaned arrays
 */
function sanitizeForResponse(obj) {
  const bad = '[object object]';
  const clean = (arr) => (Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s && s.toLowerCase() !== bad) : []);
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = Array.isArray(v) ? clean(v) : v;
  }
  return out;
}

/**
 * Run the full resume normalization pipeline and return a clean response shape.
 * @param {object} extracted - Raw extraction from OpenAI (skills, tools, certifications, programming_languages, databases, operating_systems)
 * @returns {Promise<{ categorizedSkills: object, unmappedSkills: string[] }>}
 */
async function runResumePipeline(extracted) {
  // 1) Raw OpenAI response (log only; we don't mutate it)
  log('1. Raw', 'OpenAI response', {
    skills: extracted.skills,
    tools: extracted.tools,
    certifications: extracted.certifications,
    programming_languages: extracted.programming_languages,
    databases: extracted.databases,
    operating_systems: extracted.operating_systems,
  });

  // 2) Flatten all arrays to string[]; normalize cert labels
  const flattened = flattenExtracted(extracted);
  log('2. After flattening', 'flattened', flattened);

  // 2b) Re-categorize: move known OS terms (e.g. Kali Linux) from tools/skills into operating_systems
  const rebalanced = rebalanceCategories(flattened);
  log('2b. After rebalance', 'rebalanced', rebalanced);

  // 3) Category mapping + alias + SkillMaster (normalizeResumeService); dedupe inside that layer
  const { categorizedSkills, unmappedSkills } = await normalizeExtracted(rebalanced);
  log('3. After normalization', 'categorizedSkills', categorizedSkills);
  log('3. After normalization', 'unmappedSkills', unmappedSkills);

  // 4) Final sanitize so "[object Object]" never appears
  const categorized = sanitizeForResponse(categorizedSkills);
  const unmapped = Array.isArray(unmappedSkills)
    ? unmappedSkills.filter((s) => typeof s === 'string' && s && s.toLowerCase() !== '[object object]')
    : [];

  return {
    categorizedSkills: categorized,
    unmappedSkills: unmapped,
  };
}

module.exports = {
  runResumePipeline,
  flattenExtracted,
  sanitizeForResponse,
};
