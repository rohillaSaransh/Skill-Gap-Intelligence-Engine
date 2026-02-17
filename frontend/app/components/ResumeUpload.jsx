'use client';

import { useState, useCallback, useRef } from 'react';
import API_BASE from '@/lib/api';

export default function ResumeUpload({ onProfileSaved }) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.docx')) {
      setError('Only PDF and DOCX are allowed.');
      return;
    }
    submitFile(file);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target?.files?.[0];
    setSelectedFile(file || null);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExtractClick = () => {
    if (selectedFile) {
      submitFile(selectedFile);
      return;
    }
    submitPaste();
  };

  async function submitFile(file) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch(`${API_BASE}/api/resume/analyze`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
      const toStr = (v) => (v != null && typeof v === 'string' ? v : (v?.name ?? v?.title ?? '') || '');
      const toStrArr = (arr) => (Array.isArray(arr) ? arr.map(toStr).filter(Boolean) : []);
      const categorized = {
        programming_languages: toStrArr(data.categorizedSkills?.programming_languages),
        tools: toStrArr(data.categorizedSkills?.tools),
        certifications: toStrArr(data.categorizedSkills?.certifications),
        databases: toStrArr(data.categorizedSkills?.databases),
        operating_systems: toStrArr(data.categorizedSkills?.operating_systems),
        general_skills: toStrArr(data.categorizedSkills?.general_skills),
      };
      onProfileSaved?.({
        profileSummary: data.profileSummary,
        categorizedSkills: categorized,
        unmappedSkills: data.unmappedSkills || [],
        qualifiedRoles: data.qualifiedRoles || [],
        upskillRoles: data.upskillRoles || [],
      });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function submitPaste() {
    const text = pasteText.trim();
    if (text.length < 50) {
      setError('Paste at least 50 characters of resume text.');
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
      const toStr = (v) => (v != null && typeof v === 'string' ? v : (v?.name ?? v?.title ?? '') || '');
      const toStrArr = (arr) => (Array.isArray(arr) ? arr.map(toStr).filter(Boolean) : []);
      const categorized = {
        programming_languages: toStrArr(data.categorizedSkills?.programming_languages),
        tools: toStrArr(data.categorizedSkills?.tools),
        certifications: toStrArr(data.categorizedSkills?.certifications),
        databases: toStrArr(data.categorizedSkills?.databases),
        operating_systems: toStrArr(data.categorizedSkills?.operating_systems),
        general_skills: toStrArr(data.categorizedSkills?.general_skills),
      };
      onProfileSaved?.({
        profileSummary: data.profileSummary,
        categorizedSkills: categorized,
        unmappedSkills: data.unmappedSkills || [],
        qualifiedRoles: data.qualifiedRoles || [],
        upskillRoles: data.upskillRoles || [],
      });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginBottom: 32, padding: 24, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
      <h2 style={{ marginBottom: 16, fontSize: 22, color: '#0f172a' }}>Resume Upload &amp; Extract</h2>

      {/* Upload / Paste */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 8,
          padding: 24,
          textAlign: 'center',
          marginBottom: 16,
          background: dragOver ? '#eff6ff' : '#fff',
        }}
      >
        <p style={{ marginBottom: 12, color: '#475569' }}>Drag and drop PDF or DOCX here, or</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          disabled={!!selectedFile}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            marginBottom: 12,
            padding: '10px 20px',
            background: selectedFile ? '#e2e8f0' : '#f1f5f9',
            color: selectedFile ? '#94a3b8' : '#475569',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            cursor: selectedFile ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          Choose file
        </button>
        {selectedFile && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12, padding: '8px 12px', background: '#e0f2fe', borderRadius: 6, border: '1px solid #bae6fd' }}>
            <span style={{ fontSize: 13, color: '#0c4a6e', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedFile.name}>{selectedFile.name}</span>
            <button
              type="button"
              onClick={handleRemoveFile}
              aria-label="Remove file"
              style={{ padding: '2px 6px', border: 'none', background: '#0ea5e9', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
        <p style={{ marginBottom: 8, color: '#475569' }}>Or paste resume text below (min 50 characters)</p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste resume text here..."
          rows={4}
          style={{ width: '100%', maxWidth: 560, padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleExtractClick}
            disabled={loading || (!selectedFile && !pasteText.trim())}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14 }}
          >
            {loading ? 'Extracting…' : 'Extract & Analyze'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: 8, color: '#64748b' }}>Processing resume…</p>
        </div>
      )}

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}

      {result && !loading && (
        <p style={{ color: '#059669', fontSize: 14, marginTop: 8 }}>
          Profile extracted. The form below has been filled with your skills—edit if needed. Qualified and upskilling roles are shown below.
          {result.unmappedSkills?.length > 0 && (
            <span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 13 }}>
              Unmapped terms: {result.unmappedSkills.join(', ')}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
