/**
 * Send resume text to OpenAI and get structured JSON.
 */
const OpenAI = require('openai');

const EXTRACT_SYSTEM = `Extract structured professional data from the resume.
Return ONLY valid JSON in this exact structure:
{
  "skills": [],
  "tools": [],
  "certifications": [],
  "programming_languages": [],
  "databases": [],
  "operating_systems": [],
  "total_years_experience": 0,
  "roles": [
    {
      "title": "",
      "company": "",
      "start_date": "",
      "end_date": "",
      "skills_used": []
    }
  ]
}
Rules:
- No explanations, no markdown, no extra text.
- Empty array if missing.
- total_years_experience must be a number.
- start_date and end_date: use YYYY-MM or YYYY format when possible.`;

/**
 * @param {string} resumeText - Raw resume text
 * @returns {Promise<object>} Parsed extraction
 */
async function extractStructuredFromOpenAI(resumeText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM },
      { role: 'user', content: resumeText.slice(0, 12000) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(content);

  // Ensure array fields are always string[] (OpenAI sometimes returns objects)
  function toStr(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'object' && !Array.isArray(v)) return (v.name || v.title || v.value || v.label || '').trim() || String(v).trim();
    return String(v).trim();
  }
  function toStringArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(toStr).filter(Boolean);
  }

  return {
    skills: toStringArray(parsed.skills),
    tools: toStringArray(parsed.tools),
    certifications: toStringArray(parsed.certifications),
    programming_languages: toStringArray(parsed.programming_languages),
    databases: toStringArray(parsed.databases),
    operating_systems: toStringArray(parsed.operating_systems),
    total_years_experience: typeof parsed.total_years_experience === 'number' ? parsed.total_years_experience : 0,
    roles: Array.isArray(parsed.roles) ? parsed.roles : [],
  };
}

module.exports = { extractStructuredFromOpenAI };
