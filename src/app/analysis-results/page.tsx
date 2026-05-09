'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AnalysisResult {
  analysisId: string;
  resumeId: string;
  lensType: 'targeted' | 'general';
  overallScore: number;
  categoryScores: {
    ats_compatibility: number;
    content_quality: number;
    experience_strength: number;
    skills_alignment: number;
    achievement_impact: number;
    formatting_clarity: number;
    relevance_match?: number;
  };
  interpretationBand: string;
  confidenceLevel: string;
  remarks: {
    strengths: string[];
    weaknesses: string[];
    actionable: string[];
  };
  processingTimeMs: number;
  createdAt: string;
}

interface ResumeContent {
  resumeId: string;
  fileName: string;
  extractedText: string | null;
}

export default function AnalysisResultsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('resumeId');

  const [data, setData] = useState<AnalysisResult | null>(null);
  const [resumeContent, setResumeContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      if (!resumeId) {
        setError('Missing resumeId in URL. Please upload a resume first.');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('Session expired. Please log in again.');
          router.push('/login');
          return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch analysis + resume content in parallel
        const [analysisRes, contentRes] = await Promise.all([
          fetch(`http://localhost:3000/resume/${resumeId}/analyses`, { headers }),
          fetch(`http://localhost:3000/resume/${resumeId}/content`, { headers }),
        ]);

        const analysisResult = await analysisRes.json();
        if (!analysisRes.ok) throw new Error(analysisResult?.message || 'Failed to fetch analysis.');

        if (Array.isArray(analysisResult) && analysisResult.length > 0) {
          setData(analysisResult[0]);
        }

        if (contentRes.ok) {
          const content = await contentRes.json();
          setResumeContent(content);
        }
      } catch (err) {
        console.error('Failed to fetch analysis:', err);
        setError(err instanceof Error ? err.message : 'Unable to load analysis results.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [resumeId, router]);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-20 text-center font-bold font-raleway">{error}</div>;
  if (!data) return <div className="p-20 text-center font-bold font-raleway">Analysis not found.</div>;

  const displayScores = [
    { label: 'ATS', score: data.categoryScores.ats_compatibility },
    { label: 'Tone & Style', score: data.categoryScores.formatting_clarity },
    { label: 'Content', score: data.categoryScores.content_quality },
    { label: 'Structure', score: data.categoryScores.experience_strength },
    { label: 'Skills', score: data.categoryScores.skills_alignment },
  ];

  const allFindings: { text: string; positive: boolean }[] = [
    ...data.remarks.strengths.map(s => ({ text: s, positive: true })),
    ...data.remarks.weaknesses.map(w => ({ text: w, positive: false })),
  ];

  const totalIssues = data.remarks.weaknesses.length + data.remarks.actionable.length;

  // Parse extracted text into sections
  const resumeSections = parseResumeText(resumeContent?.extractedText || '');

  return (
    <div className="min-h-screen bg-[#EFF6F2] p-6 md:p-10 font-raleway text-slate-900">
      <button onClick={() => router.back()} className="mb-6 p-2 hover:bg-white rounded-full transition-all shadow-sm active:scale-95">
        <ArrowLeft size={20} className="text-gray-600" />
      </button>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Score Card */}
          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <div className="relative w-36 h-36 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="62" stroke="#F1F5F9" strokeWidth="12" fill="transparent" />
                <circle cx="72" cy="72" r="62"
                  stroke={data.overallScore >= 70 ? '#F472B6' : data.overallScore >= 50 ? '#FB923C' : '#EF4444'}
                  strokeWidth="12" fill="transparent"
                  strokeDasharray={390} strokeDashoffset={390 - (390 * data.overallScore) / 100}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-800">{data.overallScore}/100</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  {totalIssues} {totalIssues === 1 ? 'Issue' : 'Issues'}
                </span>
              </div>
            </div>

            <h2 className="text-center text-xl font-bold text-slate-800 mb-6">Your Resume Score</h2>

            <div className="space-y-0">
              {displayScores.map((item, i) => (
                <ScoreItem key={i} label={item.label} score={item.score} />
              ))}
            </div>
          </div>

          {/* Strengths */}
          {data.remarks.strengths.length > 0 && (
            <div className="bg-[#F0FAF6] rounded-3xl p-8 border border-[#D6EFE5]">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-[#D1F0E8] p-2 rounded-xl text-[#14B8A6]">
                  <CheckCircle2 size={22} />
                </div>
                <h3 className="font-bold text-slate-800">Strengths</h3>
              </div>
              <div className="space-y-3">
                {data.remarks.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 leading-snug">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues & Suggestions */}
          {totalIssues > 0 && (
            <div className="bg-[#FFF8F0] rounded-3xl p-8 border border-[#FFE8CC]">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-orange-100 p-2 rounded-xl text-orange-500">
                  <AlertTriangle size={22} />
                </div>
                <h3 className="font-bold text-slate-800">Issues Found ({totalIssues})</h3>
              </div>
              <div className="space-y-3">
                {data.remarks.weaknesses.map((w, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <AlertTriangle size={15} className="text-orange-400 mt-0.5 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 leading-snug">{w}</span>
                  </div>
                ))}
                {data.remarks.actionable.map((a, i) => (
                  <div key={`a-${i}`} className="flex items-start gap-3">
                    <AlertTriangle size={15} className="text-orange-400 mt-0.5 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 leading-snug">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Suggestions Card */}
          {data.remarks.actionable.length > 0 && (
            <div className="bg-white rounded-3xl p-8 shadow-lg">
              <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </span>
                What You Should Do Next
              </h3>
              <div className="space-y-3">
                {data.remarks.actionable.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 bg-blue-50/50 rounded-xl px-4 py-3">
                    <span className="text-blue-500 font-bold text-sm mt-0.5 shrink-0">{i + 1}.</span>
                    <span className="text-sm text-slate-600 leading-relaxed font-medium">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="lg:col-span-8 space-y-6">

          {/* Resume Content Card */}
          <div className="bg-white rounded-3xl p-10 shadow-2xl shadow-slate-200 border-4 border-blue-500 min-h-[600px]">
            {resumeSections.name && (
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-1">{resumeSections.name}</h1>
                {resumeSections.contact && (
                  <p className="text-sm text-slate-400 font-medium">{resumeSections.contact}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-12 gap-8">
              {/* Main content */}
              <div className="col-span-8 space-y-8">
                {resumeSections.sections.map((section, i) => (
                  <div key={i}>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-4 border-b border-slate-100 pb-2">
                      {section.title}
                    </h4>
                    <div className="space-y-2">
                      {section.lines.map((line, j) => {
                        const isBold = /^[A-Z]/.test(line) && line.length < 80;
                        return (
                          <p key={j} className={`text-xs leading-relaxed ${isBold ? 'font-bold text-slate-700' : 'text-slate-500 font-medium'}`}>
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sidebar: Skills */}
              {resumeSections.skills.length > 0 && (
                <div className="col-span-4 border-l border-slate-50 pl-6">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-4">Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeSections.skills.map((skill, i) => (
                      <span key={i} className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-center text-xs text-slate-400 font-medium pb-4">
            {data.lensType === 'targeted' ? 'Targeted Analysis (Lens A)' : 'General Analysis (Lens B)'}
            {' · '}Confidence: {data.confidenceLevel}
            {' · '}Processed in {(data.processingTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  );
}

/** Parse raw extracted text into displayable sections */
function parseResumeText(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  const name = lines[0] || '';

  // Try to find contact info (email, phone, links on early lines)
  let contact = '';
  const contactPatterns = /[@.\d]{5,}|gmail|yahoo|hotmail|linkedin|github|\+?\d[\d\s()-]{7,}/i;
  for (let i = 1; i < Math.min(5, lines.length); i++) {
    if (contactPatterns.test(lines[i])) {
      contact += (contact ? '  ·  ' : '') + lines[i].trim();
    }
  }

  // Section detection
  const sectionKeywords = ['experience', 'education', 'projects', 'certifications', 'summary', 'objective', 'about', 'work history', 'employment', 'real world projects'];
  const skillKeywords = ['skills', 'technical skills', 'core competencies', 'expertise', 'tools'];

  const sections: { title: string; lines: string[] }[] = [];
  const skills: string[] = [];
  let currentSection: { title: string; lines: string[] } | null = null;
  let inSkillsSection = false;

  const startIdx = contact ? 5 : 2;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    const lower = line.toLowerCase().replace(/[:\-–—]/g, '').trim();

    const isSkillHeader = skillKeywords.some(kw => lower === kw || lower.startsWith(kw));
    const isSectionHeader = sectionKeywords.some(kw => lower === kw || lower.startsWith(kw));

    if (isSkillHeader && line.length < 50) {
      inSkillsSection = true;
      if (currentSection) sections.push(currentSection);
      currentSection = null;
      continue;
    }

    if (isSectionHeader && line.length < 50) {
      inSkillsSection = false;
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line.replace(/[:]/g, '').trim(), lines: [] };
      continue;
    }

    if (inSkillsSection) {
      // Split comma-separated skills
      const items = line.split(/[,·•|]/).map(s => s.trim()).filter(Boolean);
      skills.push(...items);
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) sections.push(currentSection);

  return { name, contact, sections, skills };
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  const isStrong = score > 70;
  const isNeedsWork = score < 40;

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-bold text-slate-700 text-sm">{label}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
          isStrong ? 'bg-green-50 text-green-600' :
          isNeedsWork ? 'bg-red-50 text-red-500' :
          'bg-orange-50 text-orange-500'
        }`}>
          {isStrong ? 'Strong' : isNeedsWork ? 'Needs work' : 'Good Start'}
        </span>
      </div>
      <span className="font-bold text-slate-800 text-sm">{score}/100</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#EFF6F2]">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
      <p className="text-slate-500 font-medium italic animate-pulse">SmartFolio is generating your scores...</p>
    </div>
  );
}
