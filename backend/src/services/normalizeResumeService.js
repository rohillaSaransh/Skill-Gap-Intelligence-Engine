/**
 * Normalize extracted skills using SkillMaster + SkillAlias (MongoDB).
 * Fallback: when DB not connected or empty, use fallbackMappings (parsed_jobs + taxonomy + known terms)
 * so items are still categorized and not reported as unmapped.
 */
const mongoose = require('mongoose');
const { loadFallbackMappings } = require('./fallbackMappings');

const CATEGORY_TO_FIELD = {
  programming_language: 'programming_languages',
  tool: 'tools',
  certification: 'certifications',
  database: 'databases',
  operating_system: 'operating_systems',
  general_skill: 'general_skills',
};

/**
 * Normalize a single value: already string (from flatten layer); lowercase, trim, resolve alias, validate against SkillMaster.
 * @param {string} value - Raw value (string; objects must be flattened by caller)
 * @param {string} category - SkillMaster category
 * @param {Map<string, string>} aliasMap - alias -> normalized_name
 * @param {Set<string>} masterNamesByCategory - set of "name" for this category
 * @returns {{ normalized: string, mapped: boolean }}
 */
function normalizeOne(value, category, aliasMap, masterNamesByCategory) {
  if (value == null) return { normalized: '', mapped: false };
  const str = typeof value === 'string' ? value : (value?.name ?? value?.title ?? value?.value ?? value?.label ?? '');
  const raw = String(str).toLowerCase().trim();
  if (!raw || raw === '[object object]') return { normalized: '', mapped: false };
  const resolved = aliasMap.get(raw) || raw;
  const mapped = masterNamesByCategory.has(resolved);
  return { normalized: resolved, mapped };
}

/**
 * Build alias map and master sets from DB, then merge fallback (parsed_jobs + taxonomy + known terms).
 * Items in either DB or fallback are considered "mapped" and won't appear in unmappedSkills.
 */
async function loadMappings() {
  const aliasMap = new Map();
  const masterByCategory = {
    programming_language: new Set(),
    tool: new Set(),
    certification: new Set(),
    database: new Set(),
    operating_system: new Set(),
    general_skill: new Set(),
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const SkillMaster = require('../models/SkillMaster');
      const SkillAlias = require('../models/SkillAlias');
      const [aliases, masters] = await Promise.all([
        SkillAlias.find().lean(),
        SkillMaster.find().lean(),
      ]);
      aliases.forEach((a) => aliasMap.set(String(a.alias).toLowerCase().trim(), String(a.normalized_name).trim()));
      masters.forEach((m) => {
        const cat = m.category;
        if (masterByCategory[cat]) masterByCategory[cat].add(String(m.name).toLowerCase().trim());
      });
    } catch (_) {
      // Collections missing or error
    }
  }

  const fallback = loadFallbackMappings();
  for (const [cat, set] of Object.entries(fallback.masterByCategory)) {
    if (masterByCategory[cat]) set.forEach((n) => masterByCategory[cat].add(n));
  }
  fallback.aliasMap.forEach((v, k) => { if (!aliasMap.has(k)) aliasMap.set(k, v); });

  return { aliasMap, masterByCategory };
}

/**
 * @param {object} extracted - From OpenAI (skills, tools, certifications, programming_languages, databases, operating_systems)
 * @returns {Promise<{ categorizedSkills: object, unmappedSkills: string[] }>}
 */
async function normalizeExtracted(extracted) {
  const { aliasMap, masterByCategory } = await loadMappings();

  const categorizedSkills = {
    programming_languages: [],
    tools: [],
    certifications: [],
    databases: [],
    operating_systems: [],
    general_skills: [],
  };
  const unmappedSkills = [];
  const seen = new Set();

  const process = (arr, category) => {
    if (!Array.isArray(arr)) return;
    const set = masterByCategory[category];
    for (const v of arr) {
      const { normalized, mapped } = normalizeOne(v, category, aliasMap, set);
      if (!normalized) continue;
      const key = `${category}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const field = CATEGORY_TO_FIELD[category];
      if (field && categorizedSkills[field]) {
        categorizedSkills[field].push(normalized);
        if (!mapped) unmappedSkills.push(normalized);
      }
    }
  };

  process(extracted.programming_languages, 'programming_language');
  process(extracted.tools, 'tool');
  process(extracted.certifications, 'certification');
  process(extracted.databases, 'database');
  process(extracted.operating_systems, 'operating_system');
  process(extracted.skills, 'general_skill');

  // Deduplicate after normalization
  for (const field of Object.keys(categorizedSkills)) {
    if (Array.isArray(categorizedSkills[field])) {
      categorizedSkills[field] = [...new Set(categorizedSkills[field])];
    }
  }
  const unmappedDeduped = [...new Set(unmappedSkills)];

  return { categorizedSkills, unmappedSkills: unmappedDeduped };
}

module.exports = { normalizeExtracted, loadMappings };
