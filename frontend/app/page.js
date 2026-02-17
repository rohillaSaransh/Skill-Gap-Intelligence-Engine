'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ResumeUpload from './components/ResumeUpload';
import JobGrid from './components/JobGrid';

// All client-side calls go through the Netlify function gateway so that
// API keys and third‑party services are never exposed to the browser.
const API_BASE = '/.netlify/functions/api';

const ANALYZER_STATE_KEY = 'skillsAnalyzerState';
const SKILL_GAP_JOB_UPDATED_KEY = 'skillGapJobUpdated';

function TagField({ label, id, placeholder, inputValue, onInputChange, onAdd, onSuggestionSelect, tags, onRemove, suggestionsList = [] }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    if (!inputValue.trim()) return [];
    const lower = inputValue.toLowerCase().trim();
    // 1. Normalize (lowercase, trim) and deduplicate
    const normalized = [...new Set(suggestionsList.map((s) => String(s).toLowerCase().trim()).filter(Boolean))];
    // 2. Filter by input: item must contain the typed value (case-insensitive)
    const matches = normalized.filter((item) => item.includes(lower));
    // 3. Collapse: if a shorter "base" term exists as substring of a longer one, keep only the base term
    const collapsed = matches.filter(
      (item) => !matches.some((other) => other !== item && item.includes(other))
    );
    // 4. Limit to 8
    return collapsed.slice(0, 8);
  }, [inputValue, suggestionsList]);

  const dropdownVisible = showDropdown && inputValue.length > 0 && filtered.length > 0;

  useEffect(() => {
    if (!dropdownVisible) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownVisible]);

  useEffect(() => {
    setShowDropdown(true);
  }, [inputValue]);

  const inputStyle = {
    padding: '8px 10px',
    flex: 1,
    minWidth: 0,
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: 14,
    color: '#000',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14, color: '#000' };
  const fieldStyle = { marginBottom: 16 };
  return (
    <div style={fieldStyle} ref={containerRef}>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, position: 'relative' }}>
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={onAdd}
          style={{
            padding: '8px 14px',
            cursor: 'pointer',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Add
        </button>
        {dropdownVisible && (
          <ul
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 48,
              margin: 0,
              marginTop: 4,
              padding: 4,
              listStyle: 'none',
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxHeight: 220,
              overflowY: 'auto',
              zIndex: 10,
            }}
          >
            {filtered.map((item, i) => (
              <li key={`${item}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (onSuggestionSelect) onSuggestionSelect(item);
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#000',
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                backgroundColor: '#e5e7eb',
                borderRadius: 4,
                fontSize: 13,
                color: '#000',
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${tag}`}
                style={{
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // Tag-based array state and current input value per field
  const [skills, setSkills] = useState([]);
  const [skillsInput, setSkillsInput] = useState('');
  const [certifications, setCertifications] = useState([]);
  const [certificationsInput, setCertificationsInput] = useState('');
  const [tools, setTools] = useState([]);
  const [toolsInput, setToolsInput] = useState('');
  const [databases, setDatabases] = useState([]);
  const [databasesInput, setDatabasesInput] = useState('');
  const [operatingSystems, setOperatingSystems] = useState([]);
  const [operatingSystemsInput, setOperatingSystemsInput] = useState('');
  const [codingLanguages, setCodingLanguages] = useState([]);
  const [codingLanguagesInput, setCodingLanguagesInput] = useState('');
  // Years of experience as string: e.g. "2", "2-5", "7+"
  const [yearsOfExperienceInput, setYearsOfExperienceInput] = useState('');
  // Store the JSON response from the backend (null until we get a response)
  const [response, setResponse] = useState(null);
  // Optional: store error message if the request fails
  const [error, setError] = useState(null);
  // Top N most demanded certifications/tools across all jobs (for bar charts)
  const [topCertifications, setTopCertifications] = useState(null);
  const [topTools, setTopTools] = useState(null);
  const [showTop10Certs, setShowTop10Certs] = useState(false);
  const [showTop10Tools, setShowTop10Tools] = useState(false);
  const [qualifiedPage, setQualifiedPage] = useState(0);
  const [upskillPage, setUpskillPage] = useState(0);
  const [suggestions, setSuggestions] = useState({
    skills: [],
    tools: [],
    certifications: [],
    databases: [],
    operatingSystems: [],
    codingLanguages: [],
  });

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/skills/top-certifications?limit=10`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
        .then(setTopCertifications)
        .catch(() => setTopCertifications([])),
      fetch(`${API_BASE}/api/skills/top-tools?limit=10`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
        .then(setTopTools)
        .catch(() => setTopTools([])),
      fetch(`${API_BASE}/api/skills/suggestions`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
        .then(setSuggestions)
        .catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    if (response) {
      setQualifiedPage(0);
      setUpskillPage(0);
    }
  }, [response]);

  // When returning from skill-gap: restore form, merge job's green into form, then re-run analyze so ALL jobs get new match % and list stays descending
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mergeInto = (existing, newItems) => {
      if (!Array.isArray(newItems)) return existing;
      const lower = (arr) => arr.map((x) => String(x).toLowerCase().trim());
      const existingLower = lower(existing);
      const out = [...existing];
      newItems.forEach((item) => {
        if (item == null || item === '') return;
        const s = String(item).trim();
        if (s && !existingLower.includes(s.toLowerCase())) {
          out.push(s);
          existingLower.push(s.toLowerCase());
        }
      });
      return out;
    };

    try {
      const returnedFromSkillGap = sessionStorage.getItem('returnedFromSkillGap');
      sessionStorage.removeItem('returnedFromSkillGap');
      if (!returnedFromSkillGap) return;
      const raw = sessionStorage.getItem(ANALYZER_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      const skillsRestored = Array.isArray(state.skills) ? state.skills : [];
      const certsRestored = Array.isArray(state.certifications) ? state.certifications : [];
      const toolsRestored = Array.isArray(state.tools) ? state.tools : [];
      const dbRestored = Array.isArray(state.databases) ? state.databases : [];
      const osRestored = Array.isArray(state.operatingSystems) ? state.operatingSystems : [];
      const langRestored = Array.isArray(state.codingLanguages) ? state.codingLanguages : [];
      const yearsRestored = state.yearsOfExperienceInput != null ? String(state.yearsOfExperienceInput) : '';

      setSkills(skillsRestored);
      setCertifications(certsRestored);
      setTools(toolsRestored);
      setDatabases(dbRestored);
      setOperatingSystems(osRestored);
      setCodingLanguages(langRestored);
      setYearsOfExperienceInput(yearsRestored);

      const updatedJobRaw = sessionStorage.getItem(SKILL_GAP_JOB_UPDATED_KEY);
      sessionStorage.removeItem(SKILL_GAP_JOB_UPDATED_KEY);
      const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;

      const mergedSkills = updatedJob ? mergeInto(skillsRestored, updatedJob.presentSkills || []) : skillsRestored;
      const mergedCerts = updatedJob ? mergeInto(certsRestored, updatedJob.presentCertifications || []) : certsRestored;
      const mergedTools = updatedJob ? mergeInto(toolsRestored, updatedJob.presentTools || []) : toolsRestored;
      const mergedDb = updatedJob ? mergeInto(dbRestored, updatedJob.presentDatabases || []) : dbRestored;
      const mergedOs = updatedJob ? mergeInto(osRestored, updatedJob.presentOperatingSystems || []) : osRestored;
      const mergedLang = updatedJob ? mergeInto(langRestored, updatedJob.presentCodingLanguages || []) : langRestored;

      if (updatedJob) {
        setSkills(mergedSkills);
        setCertifications(mergedCerts);
        setTools(mergedTools);
        setDatabases(mergedDb);
        setOperatingSystems(mergedOs);
        setCodingLanguages(mergedLang);
        fetch(`${API_BASE}/api/skills/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills: mergedSkills,
            certifications: mergedCerts,
            tools: mergedTools,
            databases: mergedDb,
            operatingSystems: mergedOs,
            codingLanguages: mergedLang,
            yearsOfExperience: yearsRestored,
          }),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Request failed'))))
          .then((data) => setResponse(data))
          .catch(() => {});
        return;
      }

      const responseToSet = state.response ?? null;
      if (responseToSet != null) setResponse(responseToSet);
    } catch (_) {}
  }, []);

  const router = useRouter();
  function handleViewSkillGap(job) {
    try {
      sessionStorage.setItem('skillGapJob', JSON.stringify(job));
      sessionStorage.setItem(ANALYZER_STATE_KEY, JSON.stringify({
        skills,
        certifications,
        tools,
        databases,
        operatingSystems,
        codingLanguages,
        yearsOfExperienceInput,
        response,
      }));
      router.push('/skill-gap');
    } catch (e) {
      console.error('Failed to open skill gap:', e);
    }
  }

  function addTag(value, setArr, setInput) {
    const v = value.toLowerCase().trim();
    if (!v) return;
    setArr((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setInput('');
  }
  function removeTag(index, setArr) {
    setArr((prev) => prev.filter((_, i) => i !== index));
  }

  function handleProfileSaved(payload) {
    const cat = payload?.categorizedSkills || {};
    setSkills(cat.general_skills || []);
    setCertifications(cat.certifications || []);
    setTools(cat.tools || []);
    setDatabases(cat.databases || []);
    setOperatingSystems(cat.operating_systems || []);
    setCodingLanguages(cat.programming_languages || []);
    setYearsOfExperienceInput(String(payload?.profileSummary?.totalExperience ?? ''));
    // Do not set response here — graph and jobs only show after user clicks "Analyze Skills"
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleAnalyze();
  }

  async function handleAnalyze() {
    setError(null);
    setResponse(null);

    const hasDetails =
      skills.length > 0 ||
      tools.length > 0 ||
      certifications.length > 0 ||
      databases.length > 0 ||
      operatingSystems.length > 0 ||
      codingLanguages.length > 0 ||
      (yearsOfExperienceInput && yearsOfExperienceInput.trim() !== '');
    if (!hasDetails) {
      setError('Please enter your details');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/skills/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: [...skills],
          tools: [...tools],
          certifications: [...certifications],
          yearsOfExperience: yearsOfExperienceInput,
          databases: [...databases],
          operatingSystems: [...operatingSystems],
          codingLanguages: [...codingLanguages],
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  const inputStyle = {
    width: '100%',
    padding: 10,
    marginBottom: 0,
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: 14,
    color: '#000',
  };
  const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14, color: '#000' };
  const fieldStyle = { marginBottom: 16 };
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <h1 style={{ marginBottom: 24, fontSize: 28 }}>Skills Analyzer</h1>

          <ResumeUpload onProfileSaved={handleProfileSaved} />

          <form
            onSubmit={handleSubmit}
            style={{
              width: '100%',
              padding: 24,
              border: '1px solid #ddd',
              borderRadius: 8,
              backgroundColor: '#fafafa',
              marginBottom: 24,
            }}
          >
        <TagField
          label="Skills"
          id="skills"
          placeholder="e.g. penetration testing, web security"
          inputValue={skillsInput}
          onInputChange={setSkillsInput}
          onAdd={() => addTag(skillsInput, setSkills, setSkillsInput)}
          onSuggestionSelect={(value) => addTag(value, setSkills, setSkillsInput)}
          tags={skills}
          onRemove={(index) => removeTag(index, setSkills)}
          suggestionsList={suggestions.skills}
        />
        <TagField
          label="Certifications"
          id="certifications"
          placeholder="e.g. CEH, OSCP"
          inputValue={certificationsInput}
          onInputChange={setCertificationsInput}
          onAdd={() => addTag(certificationsInput, setCertifications, setCertificationsInput)}
          onSuggestionSelect={(value) => addTag(value, setCertifications, setCertificationsInput)}
          tags={certifications}
          onRemove={(index) => removeTag(index, setCertifications)}
          suggestionsList={suggestions.certifications}
        />
        <TagField
          label="Tools"
          id="tools"
          placeholder="e.g. Burp Suite, Nmap"
          inputValue={toolsInput}
          onInputChange={setToolsInput}
          onAdd={() => addTag(toolsInput, setTools, setToolsInput)}
          onSuggestionSelect={(value) => addTag(value, setTools, setToolsInput)}
          tags={tools}
          onRemove={(index) => removeTag(index, setTools)}
          suggestionsList={suggestions.tools}
        />
        <TagField
          label="Databases"
          id="databases"
          placeholder="e.g. MySQL, PostgreSQL"
          inputValue={databasesInput}
          onInputChange={setDatabasesInput}
          onAdd={() => addTag(databasesInput, setDatabases, setDatabasesInput)}
          onSuggestionSelect={(value) => addTag(value, setDatabases, setDatabasesInput)}
          tags={databases}
          onRemove={(index) => removeTag(index, setDatabases)}
          suggestionsList={suggestions.databases}
        />
        <TagField
          label="Operating systems"
          id="operatingSystems"
          placeholder="e.g. Linux, Windows"
          inputValue={operatingSystemsInput}
          onInputChange={setOperatingSystemsInput}
          onAdd={() => addTag(operatingSystemsInput, setOperatingSystems, setOperatingSystemsInput)}
          onSuggestionSelect={(value) => addTag(value, setOperatingSystems, setOperatingSystemsInput)}
          tags={operatingSystems}
          onRemove={(index) => removeTag(index, setOperatingSystems)}
          suggestionsList={suggestions.operatingSystems}
        />
        <TagField
          label="Coding languages"
          id="codingLanguages"
          placeholder="e.g. Python, Bash, JavaScript"
          inputValue={codingLanguagesInput}
          onInputChange={setCodingLanguagesInput}
          onAdd={() => addTag(codingLanguagesInput, setCodingLanguages, setCodingLanguagesInput)}
          onSuggestionSelect={(value) => addTag(value, setCodingLanguages, setCodingLanguagesInput)}
          tags={codingLanguages}
          onRemove={(index) => removeTag(index, setCodingLanguages)}
          suggestionsList={suggestions.codingLanguages}
        />

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="years">
            Years of experience (e.g. 2, 2-5, 7+)
          </label>
          <input
            id="years"
            type="text"
            value={yearsOfExperienceInput}
            onChange={(e) => setYearsOfExperienceInput(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 24px',
            cursor: 'pointer',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Analyze Skills
        </button>
      </form>

      {error && (
        <p style={{ color: '#dc2626', marginBottom: 24 }}>Error: {error}</p>
      )}

      {response && (topCertifications?.length > 0 || topTools?.length > 0) && (
        <section style={{ marginBottom: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {topCertifications && topCertifications.length > 0 && (
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <h2 style={{ marginBottom: 16, fontSize: 20, color: 'var(--foreground)' }}>
                Top 5 most demanded certifications
              </h2>
              <p style={{ marginBottom: 12, color: 'var(--foreground)', opacity: 0.85, fontSize: 14 }}>
                Percentage of job descriptions that list each certification.
              </p>
              <button
                type="button"
                onClick={() => setShowTop10Certs((prev) => !prev)}
                style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  backgroundColor: '#374151',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showTop10Certs ? 'Showing top 10' : 'Showing top 5'}
                <span>{showTop10Certs ? '▲' : '▼'}</span>
              </button>
              <div
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 20,
                  backgroundColor: '#fafafa',
                  maxWidth: 560,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(showTop10Certs ? topCertifications.slice(0, 10) : topCertifications.slice(0, 5)).map((item, i) => {
                    const certLabel = typeof item.certification === 'string' ? item.certification : (item.certification?.name || item.certification?.title || '—');
                    return (
                    <div key={`${certLabel}-${i}`}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          fontSize: 13,
                          color: '#000',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={certLabel}>
                          {certLabel}
                        </span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div
                        style={{
                          height: 10,
                          backgroundColor: '#e5e7eb',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentage}%`,
                            backgroundColor: '#2563eb',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            </div>
          )}
          {topTools && topTools.length > 0 && (
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <h2 style={{ marginBottom: 16, fontSize: 20, color: 'var(--foreground)' }}>
                Top 5 most demanded tools
              </h2>
              <p style={{ marginBottom: 12, color: 'var(--foreground)', opacity: 0.85, fontSize: 14 }}>
                Percentage of job descriptions that list each tool.
              </p>
              <button
                type="button"
                onClick={() => setShowTop10Tools((prev) => !prev)}
                style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  backgroundColor: '#374151',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showTop10Tools ? 'Showing top 10' : 'Showing top 5'}
                <span>{showTop10Tools ? '▲' : '▼'}</span>
              </button>
              <div
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 20,
                  backgroundColor: '#fafafa',
                  maxWidth: 560,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(showTop10Tools ? topTools.slice(0, 10) : topTools.slice(0, 5)).map((item, i) => {
                    const toolLabel = typeof item.tool === 'string' ? item.tool : (item.tool?.name || item.tool?.title || '—');
                    return (
                    <div key={`${toolLabel}-${i}`}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          fontSize: 13,
                          color: '#000',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={toolLabel}>
                          {toolLabel}
                        </span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div
                        style={{
                          height: 10,
                          backgroundColor: '#e5e7eb',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentage}%`,
                            backgroundColor: '#2563eb',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {response && (() => {
        const BATCH = 9;
        const allRoles = response.allRoles || [];
        const qualifiedList = allRoles.length > 0
          ? allRoles.filter((r) => (r.percentage ?? 0) >= 70)
          : (response.qualifiedRoles || []);
        const upskillList = allRoles.length > 0
          ? allRoles.filter((r) => (r.percentage ?? 0) < 70)
          : (response.upskillRoles || []).slice().sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
        const toJob = (r, i) => ({
          id: r.jobId ?? `job-${i}`,
          title: r.role ?? 'Role',
          company: '',
          location: '',
          experience: r.requiredYearsOfExperience ? `${r.requiredYearsOfExperience} YOE` : '',
          matchPercentage: r.percentage ?? 0,
          percentage: r.percentage ?? 0,
          requiredYearsOfExperience: r.requiredYearsOfExperience,
          presentSkills: r.presentSkills ?? [],
          missingSkills: r.missingSkills ?? [],
          presentCertifications: r.presentCertifications ?? [],
          missingCertifications: r.missingCertifications ?? [],
          presentTools: r.presentTools ?? [],
          missingTools: r.missingTools ?? [],
          presentDatabases: r.presentDatabases ?? [],
          missingDatabases: r.missingDatabases ?? [],
          presentOperatingSystems: r.presentOperatingSystems ?? [],
          missingOperatingSystems: r.missingOperatingSystems ?? [],
          presentCodingLanguages: r.presentCodingLanguages ?? [],
          missingCodingLanguages: r.missingCodingLanguages ?? [],
        });
        const qualifiedBatch = qualifiedList.slice(qualifiedPage * BATCH, (qualifiedPage + 1) * BATCH).map(toJob);
        const upskillBatch = upskillList.slice(upskillPage * BATCH, (upskillPage + 1) * BATCH).map(toJob);
        const qualifiedTotal = qualifiedList.length;
        const upskillTotal = upskillList.length;
        const qualifiedPages = Math.ceil(qualifiedTotal / BATCH) || 1;
        const upskillPages = Math.ceil(upskillTotal / BATCH) || 1;
        return (
          <>
            <section className="mt-8 mb-10">
              <h2 className="text-xl font-semibold text-white mb-4">Qualified jobs</h2>
              {qualifiedTotal > 0 ? (
                <>
                  <JobGrid jobs={qualifiedBatch} onViewSkillGap={handleViewSkillGap} />
                  {qualifiedTotal > BATCH && (
                    <div className="flex items-center gap-4 mt-4">
                      <button
                        type="button"
                        onClick={() => setQualifiedPage((p) => Math.max(0, p - 1))}
                        disabled={qualifiedPage === 0}
                        className="px-4 py-2 rounded border bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Previous
                      </button>
                      <span className="text-white text-sm">
                        Page {qualifiedPage + 1} of {qualifiedPages} ({qualifiedTotal} jobs)
                      </span>
                      <button
                        type="button"
                        onClick={() => setQualifiedPage((p) => Math.min(qualifiedPages - 1, p + 1))}
                        disabled={qualifiedPage >= qualifiedPages - 1}
                        className="px-4 py-2 rounded border bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500">No roles fully qualified yet</p>
              )}
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4">Roles need upskilling</h2>
              {upskillTotal > 0 ? (
                <>
                  <JobGrid jobs={upskillBatch} onViewSkillGap={handleViewSkillGap} />
                  {upskillTotal > BATCH && (
                    <div className="flex items-center gap-4 mt-4">
                      <button
                        type="button"
                        onClick={() => setUpskillPage((p) => Math.max(0, p - 1))}
                        disabled={upskillPage === 0}
                        className="px-4 py-2 rounded border bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Previous
                      </button>
                      <span className="text-white text-sm">
                        Page {upskillPage + 1} of {upskillPages} ({upskillTotal} jobs)
                      </span>
                      <button
                        type="button"
                        onClick={() => setUpskillPage((p) => Math.min(upskillPages - 1, p + 1))}
                        disabled={upskillPage >= upskillPages - 1}
                        className="px-4 py-2 rounded border bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500">No upskilling roles identified</p>
              )}
            </section>
          </>
        );
      })()}
        </div>
      </div>
    </div>
  );
}
