  /**
   * Entry point for our Express backend.
   * This file starts the server and defines the API routes.
   */
  require('dotenv').config();

  // Import Express - the web framework we use to build the API
  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const fs = require('fs');

  // Create the Express app - this is our server application
  const app = express();

  // Enable CORS and handle OPTIONS preflight requests so the browser can call this API from another origin.
  app.use(cors());

  // JSON body parsing middleware: parses incoming JSON in request body into req.body
  // Must be added before routes that need to read the body (e.g. POST /api/skills/analyze)
  app.use(express.json());

  // Backend runs on 3001 so Next.js dev can use 3000 without conflict
  const PORT = process.env.PORT || 3001;

  const { connectDB } = require('./db/connection');
  connectDB().catch(() => {});

  // Load parsed jobs from data file. This is the only job dataset used for matching.
  let jobs = [];
  try {
    const jobsPath = path.join(__dirname, '..', 'data', 'parsed_jobs.json');
    jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  } catch (err) {
    console.error('Could not load parsed_jobs.json:', err.message);
  }

  // Load canonical taxonomy for normalization (canonical key -> aliases / subskills).
  let skillTaxonomy = {};
  try {
    const taxonomyPath = path.join(__dirname, '..', 'data', 'skill_taxonomy.json');
    skillTaxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
  } catch (err) {
    console.error('Could not load skill_taxonomy.json:', err.message);
  }

  // Load precomputed embeddings for canonical terms (fieldType -> { canonicalKey: vector }).
  let skillEmbeddings = {};
  try {
    const embeddingsPath = path.join(__dirname, '..', 'data', 'skill_embeddings.json');
    skillEmbeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
  } catch (err) {
    console.error('Could not load skill_embeddings.json:', err.message);
  }

  const SIMILARITY_THRESHOLD = 0.85;

  function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Normalize a single value to its canonical form using the taxonomy.
   * @param {string} fieldType - One of: skills, tools, certifications, databases, operatingSystems, codingLanguages, degree
   * @param {string} inputValue - Raw user or job value
   * @returns {string} Canonical key if match found, otherwise original normalized value (lowercase, trimmed).
   */
  function normalizeSkill(fieldType, inputValue) {
    const normalized = String(inputValue).toLowerCase().trim();
    if (!normalized) return normalized;
    const field = skillTaxonomy[fieldType];
    if (!field || typeof field !== 'object') return normalized;
    for (const [canonical, entry] of Object.entries(field)) {
      const canon = canonical.toLowerCase().trim();
      if (normalized === canon) return canon;
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      if (aliases.some((a) => String(a).toLowerCase().trim() === normalized)) return canon;
      const subskills = Array.isArray(entry.subskills) ? entry.subskills : [];
      if (subskills.some((s) => String(s).toLowerCase().trim() === normalized)) return canon;
    }
    return normalized;
  }

  // Simple alias map: user input -> canonical skill name (lowercase).
  // In a real flow, an LLM could suggest or expand aliases from natural language; this mocks that step.
  const skillAliases = {
    js: 'javascript',
    'sec testing': 'security testing',
    pentest: 'penetration testing',
  };

  /**
   * Normalize raw skill strings before analysis (mock of an AI normalization step).
   * Later, this could call an LLM to map free-text skills to a canonical list.
   * - Lowercase and trim
   * - Expand known aliases via skillAliases
   * - Remove duplicates (order not guaranteed)
   */
  function normalizeSkills(skills) {
    if (!Array.isArray(skills)) return [];

    const lowercased = skills
      .map((s) => String(s).trim().toLowerCase())
      .filter((s) => s.length > 0);

    const expanded = lowercased.map((s) => skillAliases[s] || s);

    return [...new Set(expanded)];
  }

  /**
   * Parse a yearsOfExperience value from the parsed jobs dataset into a single number.
   * Examples:
   *  - "3-5" -> 3
   *  - "5+"  -> 5
   *  - null / undefined / non-numeric -> 0
   */
  function parseYearsOfExperience(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    const match = String(value).match(/\d+/);
    if (!match) return 0;
    const n = Number(match[0]);
    return Number.isNaN(n) ? 0 : n;
  }

  // Normalize an arbitrary array of strings: lowercase, trimmed, unique.
  function normalizeArray(arr) {
    if (!Array.isArray(arr)) return [];
    const set = new Set(
      arr
        .map((s) => String(s).trim().toLowerCase())
        .filter((s) => s.length > 0)
    );
    return Array.from(set);
  }

  // Normalize array using taxonomy: each item mapped to canonical form, then deduped.
  function normalizeArrayWithTaxonomy(arr, fieldType) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(
      arr.map((s) => normalizeSkill(fieldType, String(s))).filter((s) => s.length > 0)
    )];
  }

  // Generic scoring for array-based categories (degree, tools, etc.).
  // Returns score in [0,10], plus present/missing and whether this category contributes to the total.
  // IMPORTANT: "present" is defined as everything the USER provided for this category.
  // "missing" is what the JD requires that the user does NOT have.
  function scoreCategory(jobItems, userItems) {
    const required = Array.isArray(jobItems)
      ? jobItems.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];

    const userSet = new Set(userItems);

    if (required.length === 0) {
      return {
        score: 0,
        present: userItems.slice(), // echo back user input even if JD has nothing
        missing: [],
        contributes: false,
      };
    }

    // For scoring, we care about intersection of userItems and required.
    const intersection = required.filter((item) => userSet.has(item));
    const missing = required.filter((item) => !userSet.has(item));
    const m = intersection.length;
    const n = required.length;
    const score = (m / n) * 10; // each category contributes up to 10%

    return {
      score,
      // By requirement, "present" should reflect everything the USER provided,
      // not just the overlapping subset.
      present: userItems.slice(),
      missing,
      contributes: true,
    };
  }

  /**
   * Same as scoreCategory but uses embedding cosine similarity when both job and user terms have embeddings.
   * If similarity > SIMILARITY_THRESHOLD, count as match. Otherwise fall back to exact match.
   */
  function scoreCategoryWithEmbeddings(fieldType, jobItems, userItems) {
    const required = Array.isArray(jobItems)
      ? jobItems.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];
    const userList = Array.isArray(userItems) ? userItems : [];

    if (required.length === 0) {
      return {
        score: 0,
        green: [],
        red: [],
        yellow: userList.slice(),
        contributes: false,
      };
    }

    const fieldEmbeddings = skillEmbeddings[fieldType];
    const hasEmbeddings = fieldEmbeddings && typeof fieldEmbeddings === 'object';

    const green = [];
    const red = [];

    const userSet = new Set(userList.map((u) => String(u).trim().toLowerCase()));
    for (const req of required) {
      if (userSet.has(req)) {
        green.push(req);
        continue;
      }
      if (hasEmbeddings) {
        const reqVec = fieldEmbeddings[req];
        if (reqVec && Array.isArray(reqVec)) {
          let bestSim = 0;
          for (const u of userList) {
            const uVec = fieldEmbeddings[u];
            if (uVec && Array.isArray(uVec)) {
              const sim = cosineSimilarity(reqVec, uVec);
              if (sim > bestSim) bestSim = sim;
            }
          }
          if (bestSim > SIMILARITY_THRESHOLD) {
            green.push(req);
            continue;
          }
        }
      }
      red.push(req);
    }

    const requiredSet = new Set(required.map((r) => String(r).trim().toLowerCase()));
    const yellow = userList.filter(
      (u) => !requiredSet.has(String(u).trim().toLowerCase())
    );

    const totalRequired = green.length + red.length;
    const score = totalRequired === 0 ? 10 : (green.length / totalRequired) * 10;

    return {
      score,
      green,
      red,
      yellow,
      contributes: true,
    };
  }

  // Years-of-experience scoring as a category with max 10%.
  function scoreYOE(jobYOERaw, userYears) {
    const jobYears = parseYearsOfExperience(jobYOERaw);

    // If either side has no numeric YOE, skip this category.
    if (!jobYears || !userYears) {
      return {
        score: 0,
        present: [],
        missing: [],
        contributes: false,
        jobYears,
      };
    }

    const match = userYears >= jobYears;
    const score = match ? 10 : (userYears / jobYears) * 10;

    return {
      score,
      present: match ? [String(jobYears)] : [],
      missing: match ? [] : [String(jobYears)],
      contributes: true,
      jobYears,
    };
  }

  /**
   * Run weighted matching for a user payload. Used by /api/skills/analyze and /api/resume/analyze.
   * @param {object} payload - { tools, certifications, skills, databases, operatingSystems, codingLanguages, yearsOfExperience }
   */
  function runMatching(payload) {
    const body = payload || {};
    const userTools             = normalizeArrayWithTaxonomy(body.tools, 'tools');
    const userCerts             = normalizeArrayWithTaxonomy(body.certifications, 'certifications');
    const userSkills            = normalizeArrayWithTaxonomy(body.skills, 'skills');
    const userDatabases         = normalizeArrayWithTaxonomy(body.databases, 'databases');
    const userOperatingSystems  = normalizeArrayWithTaxonomy(body.operatingSystems, 'operatingSystems');
    const userCodingLanguages   = normalizeArrayWithTaxonomy(body.codingLanguages, 'codingLanguages');
    const userYOERaw            = body.yearsOfExperience ?? '';
    const userYears             = parseYearsOfExperience(userYOERaw);
    const hasAnyInput =
      userTools.length || userCerts.length || userSkills.length ||
      userDatabases.length || userOperatingSystems.length || userCodingLanguages.length || userYears > 0;
    if (!hasAnyInput) return { qualifiedRoles: [], upskillRoles: [] };
    let jobsToScore = jobs;
    if (userYears > 0) {
      jobsToScore = jobs.filter((j) => parseYearsOfExperience(j.yearsOfExperience) <= userYears);
    }
    const analysis = jobsToScore.map((job) => {
      const jobSkillsNorm = normalizeArrayWithTaxonomy(job.skills, 'skills');
      const jobCertsNorm  = normalizeArrayWithTaxonomy(job.certifications, 'certifications');
      const jobToolsNorm  = normalizeArrayWithTaxonomy(job.tools, 'tools');
      const jobDbNorm     = normalizeArrayWithTaxonomy(job.databases, 'databases');
      const jobOsNorm     = normalizeArrayWithTaxonomy(job.operatingSystems, 'operatingSystems');
      const jobLangNorm   = normalizeArrayWithTaxonomy(job.codingLanguages, 'codingLanguages');
      const skillsScore   = scoreCategoryWithEmbeddings('skills', jobSkillsNorm, userSkills);
      const certsScore    = scoreCategoryWithEmbeddings('certifications', jobCertsNorm, userCerts);
      const toolsScore    = scoreCategoryWithEmbeddings('tools', jobToolsNorm, userTools);
      const yoeScore      = scoreYOE(job.yearsOfExperience, userYears);
      const dbScore       = scoreCategoryWithEmbeddings('databases', jobDbNorm, userDatabases);
      const osScore       = scoreCategoryWithEmbeddings('operatingSystems', jobOsNorm, userOperatingSystems);
      const langScore     = scoreCategoryWithEmbeddings('codingLanguages', jobLangNorm, userCodingLanguages);
      const weightedCategories = [
        skillsScore, certsScore, toolsScore, yoeScore, dbScore, osScore, langScore,
      ];
      let sumScore = 0, contributingCount = 0;
      for (const c of weightedCategories) {
        if (c.contributes) {
          sumScore += c.score / 10;
          contributingCount += 1;
        }
      }
      const percentage = contributingCount === 0 ? 0 : Math.round((sumScore / contributingCount) * 100);
      const status = percentage >= 70 ? 'qualified' : percentage >= 30 ? 'needs_upskilling' : 'not_ready';
      return {
        jobId: job.id,
        role: job.title,
        percentage,
        requiredYearsOfExperience: yoeScore.jobYears ?? parseYearsOfExperience(job.yearsOfExperience),
        greenSkills: skillsScore.green ?? [], redSkills: skillsScore.red ?? [], yellowSkills: skillsScore.yellow ?? [],
        greenCertifications: certsScore.green ?? [], redCertifications: certsScore.red ?? [], yellowCertifications: certsScore.yellow ?? [],
        greenTools: toolsScore.green ?? [], redTools: toolsScore.red ?? [], yellowTools: toolsScore.yellow ?? [],
        greenDatabases: dbScore.green ?? [], redDatabases: dbScore.red ?? [], yellowDatabases: dbScore.yellow ?? [],
        greenOperatingSystems: osScore.green ?? [], redOperatingSystems: osScore.red ?? [], yellowOperatingSystems: osScore.yellow ?? [],
        greenCodingLanguages: langScore.green ?? [], redCodingLanguages: langScore.red ?? [], yellowCodingLanguages: langScore.yellow ?? [],
        presentSkills: skillsScore.green ?? [], missingSkills: skillsScore.red ?? [],
        presentCertifications: certsScore.green ?? [], missingCertifications: certsScore.red ?? [],
        presentTools: toolsScore.green ?? [], missingTools: toolsScore.red ?? [],
        presentDatabases: dbScore.green ?? [], missingDatabases: dbScore.red ?? [],
        presentOperatingSystems: osScore.green ?? [], missingOperatingSystems: osScore.red ?? [],
        presentCodingLanguages: langScore.green ?? [], missingCodingLanguages: langScore.red ?? [],
        status,
      };
    });
    analysis.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    return {
      qualifiedRoles: analysis.filter((e) => e.status === 'qualified'),
      upskillRoles: analysis.filter((e) => e.status === 'needs_upskilling'),
      allRoles: analysis,
    };
  }

  // ============ ROUTES ============

  // Health check route: GET /health
  // Used to verify the server is running (e.g. by load balancers or monitoring tools)
  app.get('/health', (req, res) => {
    // Send back a JSON response with status "ok"
    res.json({ status: 'ok' });
  });

  // POST /api/skills/analyze - deterministic matching against parsed_jobs.json
  app.post('/api/skills/analyze', (req, res) => {
    const result = runMatching(req.body);
    res.json(result);
  });

  const { registerResumeRoutes } = require('./routes/resumeRoutes');
  registerResumeRoutes(app, runMatching);

  // GET /api/skills/top-certifications - top N most demanded certifications (canonical normalized, combined counts)
  app.get('/api/skills/top-certifications', (req, res) => {
    const total = jobs.length;
    if (total === 0) {
      return res.json([]);
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const certCount = {};
    for (const job of jobs) {
      const certs = job.certifications || [];
      for (const cert of certs) {
        const normalizedValue = typeof cert === 'string' ? normalizeSkill('certifications', cert) : '';
        if (!normalizedValue || normalizedValue === '[object object]') continue;
        certCount[normalizedValue] = (certCount[normalizedValue] || 0) + 1;
      }
    }
    const list = Object.entries(certCount)
      .map(([certification, count]) => ({
        certification,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, limit);
    res.json(list);
  });

  // GET /api/skills/top-tools - top N most demanded tools (canonical normalized, combined counts)
  app.get('/api/skills/top-tools', (req, res) => {
    const total = jobs.length;
    if (total === 0) {
      return res.json([]);
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const toolCount = {};
    for (const job of jobs) {
      const tools = job.tools || [];
      for (const tool of tools) {
        const normalizedValue = typeof tool === 'string' ? normalizeSkill('tools', tool) : '';
        if (!normalizedValue || normalizedValue === '[object object]') continue;
        toolCount[normalizedValue] = (toolCount[normalizedValue] || 0) + 1;
      }
    }
    const list = Object.entries(toolCount)
      .map(([tool, count]) => ({
        tool,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, limit);
    res.json(list);
  });

  // GET /api/skills/suggestions - unique values from all jobs for autocomplete (no scoring/matching change)
  function uniqueFromJobs(jobs, key) {
    const set = new Set();
    for (const job of jobs) {
      const arr = job[key];
      if (Array.isArray(arr)) for (const v of arr) if (v != null && String(v).trim()) set.add(String(v).trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }
  app.get('/api/skills/suggestions', (req, res) => {
    res.json({
      skills: uniqueFromJobs(jobs, 'skills'),
      tools: uniqueFromJobs(jobs, 'tools'),
      certifications: uniqueFromJobs(jobs, 'certifications'),
      databases: uniqueFromJobs(jobs, 'databases'),
      operatingSystems: uniqueFromJobs(jobs, 'operatingSystems'),
      codingLanguages: uniqueFromJobs(jobs, 'codingLanguages'),
      degree: uniqueFromJobs(jobs, 'degree'),
    });
  });

  // ============ START THE SERVER ============

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at', promise, 'reason:', reason);
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('Keep this terminal open. Press Ctrl+C to stop.');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  server.on('close', () => {
    console.error('Server closed unexpectedly.');
  });

  // Prevent process from exiting if something closes the server (e.g. on Windows)
  process.stdin?.resume();
