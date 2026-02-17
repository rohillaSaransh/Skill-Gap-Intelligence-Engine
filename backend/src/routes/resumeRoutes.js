/**
 * POST /api/resume/analyze - file or raw text -> extract -> flatten -> normalize -> matching.
 */
const multer = require('multer');
const { extractTextFromBuffer } = require('../services/resumeExtractService');
const { extractStructuredFromOpenAI } = require('../services/openaiExtractService');
const { calculateTotalYOE } = require('../services/experienceService');
const { runResumePipeline } = require('../services/resumeService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only PDF and DOCX are allowed'));
  },
});

function registerResumeRoutes(app, runMatching) {
  app.post('/api/resume/analyze', upload.single('resume'), async (req, res) => {
    let rawText = '';

    try {
      if (req.file && req.file.buffer) {
        rawText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } else if (req.body && typeof req.body.rawText === 'string') {
        rawText = req.body.rawText.trim();
      } else {
        return res.status(400).json({ error: 'Provide a resume file (PDF/DOCX) or rawText in JSON body.' });
      }

      if (!rawText || rawText.length < 50) {
        return res.status(400).json({ error: 'Extracted text too short. Upload a valid resume or paste more text.' });
      }

      const extracted = await extractStructuredFromOpenAI(rawText);
      const { totalYears, fromRoles } = calculateTotalYOE(extracted.roles);
      const totalExperience = fromRoles ? totalYears : (extracted.total_years_experience || 0);

      const { categorizedSkills, unmappedSkills } = await runResumePipeline({
        skills: extracted.skills,
        tools: extracted.tools,
        certifications: extracted.certifications,
        programming_languages: extracted.programming_languages,
        databases: extracted.databases,
        operating_systems: extracted.operating_systems,
      });

      const inferredDomain = extracted.roles && extracted.roles[0]
        ? (extracted.roles[0].title || '').trim() || 'General'
        : 'General';

      const profileSummary = {
        totalExperience,
        inferredDomain,
      };

      const matchingPayload = {
        skills: categorizedSkills.general_skills || [],
        tools: categorizedSkills.tools || [],
        certifications: categorizedSkills.certifications || [],
        databases: categorizedSkills.databases || [],
        operatingSystems: categorizedSkills.operating_systems || [],
        codingLanguages: categorizedSkills.programming_languages || [],
        yearsOfExperience: String(totalExperience),
      };

      const { qualifiedRoles, upskillRoles, allRoles } = runMatching(matchingPayload);

      res.json({
        profileSummary,
        categorizedSkills: {
          programming_languages: categorizedSkills.programming_languages || [],
          tools: categorizedSkills.tools || [],
          certifications: categorizedSkills.certifications || [],
          databases: categorizedSkills.databases || [],
          operating_systems: categorizedSkills.operating_systems || [],
          general_skills: categorizedSkills.general_skills || [],
        },
        unmappedSkills,
        qualifiedRoles,
        upskillRoles,
        allRoles: allRoles || [],
      });
    } catch (err) {
      console.error('Resume analyze error:', err.message);
      res.status(500).json({
        error: err.message || 'Resume analysis failed',
      });
    }
  });
}

module.exports = { registerResumeRoutes };
