/**
 * Seed SkillMaster and SkillAlias from existing skill_taxonomy.json.
 * Run with: MONGODB_URI=mongodb://... node scripts/seed-skill-master.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const taxonomyPath = path.join(__dirname, '..', 'data', 'skill_taxonomy.json');

const categoryMap = {
  skills: 'general_skill',
  tools: 'tool',
  certifications: 'certification',
  databases: 'database',
  operatingSystems: 'operating_system',
  codingLanguages: 'programming_language',
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const SkillMaster = require('../src/models/SkillMaster');
  const SkillAlias = require('../src/models/SkillAlias');

  const raw = fs.readFileSync(taxonomyPath, 'utf8');
  const taxonomy = JSON.parse(raw);

  for (const [field, entries] of Object.entries(taxonomy)) {
    const category = categoryMap[field];
    if (!category || !entries || typeof entries !== 'object') continue;
    for (const [canonical, entry] of Object.entries(entries)) {
      const name = String(canonical).trim().toLowerCase();
      if (!name) continue;
      await SkillMaster.findOneAndUpdate(
        { name, category },
        { name, category },
        { upsert: true }
      );
      const aliases = [...(entry.aliases || []), ...(entry.subskills || [])];
      for (const a of aliases) {
        const alias = String(a).trim().toLowerCase();
        if (!alias || alias === name) continue;
        await SkillAlias.findOneAndUpdate(
          { alias },
          { alias, normalized_name: name },
          { upsert: true }
        );
      }
    }
  }

  console.log('Seed done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
