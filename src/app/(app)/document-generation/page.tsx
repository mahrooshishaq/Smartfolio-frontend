'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiFile,
  FiLoader, FiArrowLeft, FiDownload, FiCopy,
  FiSend, FiMail, FiBookmark, FiCheck, FiRefreshCw,
} from 'react-icons/fi';
import jsPDF from 'jspdf';

import { apiFetch } from '@/lib/api';

type DocumentType = 'cover_letter' | 'professional_email' | 'university_statement';

const DOC_TYPES: { type: DocumentType; title: string; description: string; icon: any }[] = [
  { type: 'cover_letter', title: 'Cover Letter', description: 'Tailored cover letter for a specific job application', icon: FiFile },
  { type: 'professional_email', title: 'Professional Email', description: 'Concise email for hiring managers, networking, or follow-ups', icon: FiMail },
  { type: 'university_statement', title: 'Personal Statement', description: 'University admission essay tailored to your program', icon: FiBookmark },
];

export default function DocumentGenerationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);

  // 'select' | 'form' | 'loading' | 'result'
  const [stage, setStage] = useState<'select' | 'form' | 'loading' | 'result'>('select');
  const [docType, setDocType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) { router.push('/login'); return; }
    setToken(t);

    const docId = searchParams.get('docId');
    if (docId && t) {
      fetchDocDetail(t, docId);
    }
  }, [router, searchParams]);

  const fetchDocDetail = async (accessToken: string, docId: string) => {
    setStage('loading');
    try {
      const res = await apiFetch(`/document-generation/${docId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setTitle(data.title);
        setDocType(data.documentType);
        setStage('result');
      } else {
        setStage('select');
      }
    } catch (err) {
      setStage('select');
    }
  };

  const selectType = (t: DocumentType) => {
    setDocType(t);
    setFormData({});
    setError('');
    setStage('form');
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const generate = async () => {
    if (!token || !docType) return;
    setStage('loading');
    setError('');
    try {
      const res = await apiFetch(`/document-generation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ documentType: docType, formData }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to generate document.');
      }
      const data = await res.json();
      setContent(data.content);
      setTitle(data.title);
      setStage('result');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStage('form');
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(content, maxWidth);
    doc.text(lines, margin, margin + 10, { lineHeightFactor: 1.5 });

    const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');
    doc.save(`${safeTitle || 'document'}.pdf`);
  };

  const restart = () => {
    setStage('select');
    setDocType(null);
    setFormData({});
    setContent('');
    setTitle('');
    setError('');
  };

  // Render form fields based on document type
  const renderFormFields = () => {
    if (docType === 'cover_letter') {
      return (
        <>
          <FormField label="Company Name *" value={formData.companyName ?? ''} onChange={(v) => updateField('companyName', v)} placeholder="e.g., Acme Corp" />
          <FormField label="Position *" value={formData.position ?? ''} onChange={(v) => updateField('position', v)} placeholder="e.g., Senior Frontend Engineer" />
          <FormField label="Job Description (optional)" value={formData.jobDescription ?? ''} onChange={(v) => updateField('jobDescription', v)} placeholder="Paste the job description for a more tailored letter..." multiline rows={5} />
          <FormField label="Highlights (optional)" value={formData.highlights ?? ''} onChange={(v) => updateField('highlights', v)} placeholder="Specific accomplishments or skills you want featured..." multiline rows={3} />
        </>
      );
    }
    if (docType === 'professional_email') {
      return (
        <>
          <FormField label="Recipient *" value={formData.recipient ?? ''} onChange={(v) => updateField('recipient', v)} placeholder="e.g., Hiring Manager, Sarah Johnson" />
          <FormField label="Subject (optional)" value={formData.subject ?? ''} onChange={(v) => updateField('subject', v)} placeholder="Will be auto-generated if left blank" />
          <FormField label="Purpose *" value={formData.purpose ?? ''} onChange={(v) => updateField('purpose', v)} placeholder="What is this email about?" multiline rows={3} />
          <div className="mb-5">
            <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tone</label>
            <div className="flex gap-3">
              {['formal', 'friendly'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateField('tone', t)}
                  className={`font-raleway flex-1 px-5 py-3 rounded-xl border text-sm font-semibold capitalize transition-all ${
                    formData.tone === t
                      ? 'bg-indigo-50 border-[#4F46E5] text-[#4F46E5]'
                      : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <FormField label="Key Points (optional)" value={formData.keyPoints ?? ''} onChange={(v) => updateField('keyPoints', v)} placeholder="List main points to cover..." multiline rows={3} />
        </>
      );
    }
    if (docType === 'university_statement') {
      return (
        <>
          <FormField label="University Name *" value={formData.universityName ?? ''} onChange={(v) => updateField('universityName', v)} placeholder="e.g., MIT" />
          <FormField label="Program *" value={formData.program ?? ''} onChange={(v) => updateField('program', v)} placeholder="e.g., MS in Computer Science" />
          <FormField label="Motivation *" value={formData.motivation ?? ''} onChange={(v) => updateField('motivation', v)} placeholder="Why do you want to apply to this program?" multiline rows={4} />
          <FormField label="Achievements (optional)" value={formData.achievements ?? ''} onChange={(v) => updateField('achievements', v)} placeholder="Key academic, research, or personal achievements..." multiline rows={4} />
        </>
      );
    }
    return null;
  };

  const isFormValid = () => {
    if (!docType) return false;
    const required: Record<DocumentType, string[]> = {
      cover_letter: ['companyName', 'position'],
      professional_email: ['recipient', 'purpose'],
      university_statement: ['universityName', 'program', 'motivation'],
    };
    return required[docType].every((f) => formData[f] && formData[f].trim().length > 0);
  };

  return (
    <div>
          {/* HEADER */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Document Generation</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">
                {stage === 'select' && 'Pick a document type to start'}
                {stage === 'form' && 'Fill in the details and let AI draft it for you'}
                {stage === 'result' && 'Edit, copy, or download your document'}
              </p>
            </div>
            {stage !== 'select' && stage !== 'loading' && (
              <button onClick={restart} className="font-raleway flex items-center gap-2 text-sm text-gray-400 hover:text-slate-600 transition-colors">
                <FiArrowLeft size={16} /> Start Over
              </button>
            )}
          </div>

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm">{error}</div>
          )}

          {/* SELECT STAGE */}
          {stage === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {DOC_TYPES.map((d) => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.type}
                    onClick={() => selectType(d.type)}
                    className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-8 text-left hover:shadow-md hover:border-indigo-100 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center mb-5 group-hover:bg-[#4F46E5] group-hover:text-white transition-all">
                      <Icon size={26} />
                    </div>
                    <h3 className="font-century text-lg font-black text-slate-800 mb-2">{d.title}</h3>
                    <p className="font-raleway text-sm text-gray-500 leading-relaxed">{d.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* FORM STAGE */}
          {stage === 'form' && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-5 md:p-10 max-w-3xl mx-auto">
              <h3 className="font-century text-xl font-black text-slate-800 mb-6">
                {DOC_TYPES.find((d) => d.type === docType)?.title}
              </h3>
              {renderFormFields()}
              <div className="flex justify-end pt-2">
                <button
                  onClick={generate}
                  disabled={!isFormValid()}
                  className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSend size={16} /> Generate
                </button>
              </div>
            </div>
          )}

          {/* LOADING STAGE */}
          {stage === 'loading' && (
            <FoliLoader fullScreen={false} title="Drafting your document" moods={['typing','typing','happy']} messages={['Tailoring it to your profile…','Polishing the words…','Almost ready…']} />
          )}

          {/* RESULT STAGE */}
          {stage === 'result' && (
            <div className="space-y-5 max-w-4xl mx-auto pb-10">
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                  <h3 className="font-century text-lg font-black text-slate-800">{title}</h3>
                  <span className="font-raleway text-xs text-gray-400">{content.length} characters</span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-raleway w-full min-h-[60vh] bg-gray-50 border border-gray-100 rounded-2xl p-4 md:p-6 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-[#4F46E5] resize-y whitespace-pre-wrap"
                />
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={downloadPdf}
                  className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all"
                >
                  <FiDownload size={16} /> Download PDF
                </button>
                <button
                  onClick={copyToClipboard}
                  className="font-raleway flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 px-8 py-3 rounded-2xl font-semibold text-sm transition-all"
                >
                  {copied ? <><FiCheck size={16} /> Copied!</> : <><FiCopy size={16} /> Copy Text</>}
                </button>
                <button
                  onClick={restart}
                  className="font-raleway flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 px-8 py-3 rounded-2xl font-semibold text-sm transition-all"
                >
                  <FiRefreshCw size={16} /> Generate Another
                </button>
              </div>
            </div>
          )}
    </div>
  );
}

// ── Reusable form field ──
function FormField({
  label, value, onChange, placeholder, multiline = false, rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div className="mb-5">
      <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-raleway w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5] resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-raleway w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5]"
        />
      )}
    </div>
  );
}
