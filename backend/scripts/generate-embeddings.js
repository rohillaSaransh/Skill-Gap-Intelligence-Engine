/**
 * Generate embedding vectors for all canonical terms in skill_taxonomy.json
 * using OpenAI embeddings API. Writes backend/data/skill_embeddings.json.
 *
 * Usage: set OPENAI_API_KEY in env, then run from backend folder:
 *   node scripts/generate-embeddings.js
 */

const fs = require('fs');
const path = require('path');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;

const taxonomyPath = path.join(__dirname, '..', 'data', 'skill_taxonomy.json');
const outputPath = path.join(__dirname, '..', 'data', 'skill_embeddings.json');

function loadTaxonomy() {
  const raw = fs.readFileSync(taxonomyPath, 'utf8');
  return JSON.parse(raw);
}

function collectCanonicalKeys(taxonomy) {
  const byField = {
    skills: [],
    tools: [],
    certifications: [],
    securityConcepts: [],
    securityStandards: [],
    databases: [],
    operatingSystems: [],
    codingLanguages: [],
    degree: [],
  };
  for (const [fieldType, field] of Object.entries(taxonomy)) {
    if (!byField.hasOwnProperty(fieldType)) byField[fieldType] = [];
    if (field && typeof field === 'object') {
      for (const canonical of Object.keys(field)) {
        const term = String(canonical).trim().toLowerCase();
        if (term) byField[fieldType].push(term);
      }
    }
  }
  return byField;
}

async function fetchEmbeddings(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function main() {
  const taxonomy = loadTaxonomy();
  const byField = collectCanonicalKeys(taxonomy);

  const out = {
    skills: {},
    tools: {},
    certifications: {},
    securityConcepts: {},
    securityStandards: {},
    databases: {},
    operatingSystems: {},
    codingLanguages: {},
    degree: {},
  };

  for (const [fieldType, keys] of Object.entries(byField)) {
    if (keys.length === 0) continue;
    const unique = [...new Set(keys)];
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const vectors = await fetchEmbeddings(batch);
      for (let j = 0; j < batch.length; j++) {
        out[fieldType][batch[j]] = vectors[j];
      }
      if (unique.length > BATCH_SIZE) {
        console.log(`${fieldType}: ${Math.min(i + BATCH_SIZE, unique.length)}/${unique.length}`);
      }
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
