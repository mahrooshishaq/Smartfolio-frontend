'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PdfPreview from '@/components/PdfPreview';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  WandSparkles,
  RefreshCw,
  X,
  Info,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AnalysisResult {
  analysisId: string;
  resumeId: string;
  lensType: 'targeted' | 'general';
  targetSource: 'job_description' | 'profile_target' | 'general';
  targetRole?: string;
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
  confidenceLevel: 'High' | 'Medium' | 'Low';
  remarks: {
    strengths: string[];
    weaknesses: string[];
    actionable: string[];
    improvements: ResumeImprovement[];
    positiveHighlights: { text: string; reason: string }[];
  };
  processingTimeMs: number;
  createdAt: string;
}

interface ResumeContent {
  fileName: string;
  fileType: 'pdf' | 'docx';
  extractedText: string | null;
  editedText: string | null;
}

interface ResumeImprovement {
  category: string;
  severity: 'critical' | 'important' | 'polish';
  title: string;
  currentText: string;
  suggestedText: string;
  explanation: string;
  impact: string;
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
  const requestedAnalysisId = searchParams.get('analysisId');
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState('resume.pdf');
  const [resumeContent, setResumeContent] = useState<ResumeContent | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showReanalysisWarning, setShowReanalysisWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const fetchResults = async () => {
      if (!resumeId) {
        setError('Missing resume ID. Please upload a resume first.');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Session expired. Please log in again.');
        setLoading(false);
        router.push('/login');
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [analysisRes, contentRes, fileRes] = await Promise.all([
          fetch(`${API}/resume/${resumeId}/analyses`, { headers }),
          fetch(`${API}/resume/${resumeId}/content`, { headers }),
          fetch(`${API}/resume/${resumeId}/file`, { headers }),
        ]);

        const analysisResult = await analysisRes.json();
        if (!analysisRes.ok) {
          throw new Error(analysisResult?.message || 'Failed to fetch analysis.');
        }
        if (!Array.isArray(analysisResult) || analysisResult.length === 0) {
          throw new Error('Analysis not found.');
        }
        if (!contentRes.ok) throw new Error('Resume details could not be loaded.');
        if (!fileRes.ok) throw new Error('The original resume PDF could not be loaded.');

        const content = (await contentRes.json()) as ResumeContent;
        const pdfBlob = await fileRes.blob();
        objectUrl = URL.createObjectURL(pdfBlob);

        if (!cancelled) {
          setData(analysisResult.find((item: AnalysisResult) => item.analysisId === requestedAnalysisId) || analysisResult[0]);
          setFileName(content.fileName || 'resume.pdf');
          setResumeContent(content);
          setPdfUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load analysis results.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestedAnalysisId, resumeId, router]);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#EFF6F2] flex flex-col items-center justify-center p-6 font-raleway">
        <AlertTriangle className="text-orange-500 mb-4" size={36} />
        <p className="font-bold text-slate-800 text-center">{error || 'Analysis not found.'}</p>
        <button onClick={() => router.push('/upload-resume')} className="mt-5 rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white">
          Analyze another resume
        </button>
      </div>
    );
  }

  const scoreItems = [
    { label: 'ATS Compatibility', score: data.categoryScores.ats_compatibility },
    ...(data.lensType === 'targeted' && data.categoryScores.relevance_match != null
      ? [{ label: 'Job Relevance', score: data.categoryScores.relevance_match }]
      : []),
    { label: 'Content Quality', score: data.categoryScores.content_quality },
    { label: 'Experience Strength', score: data.categoryScores.experience_strength },
    { label: 'Skills Alignment', score: data.categoryScores.skills_alignment },
    { label: 'Achievement Impact', score: data.categoryScores.achievement_impact },
    { label: 'Formatting Clarity', score: data.categoryScores.formatting_clarity },
  ];
  const issueCount = data.remarks.weaknesses.length;

  const reanalyzeForCurrentTarget = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token || !resumeId) return;
    setReanalyzing(true);
    setShowReanalysisWarning(false);
    try {
      const response = await fetch(`${API}/resume/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.message || 'Re-analysis failed.');
      }
      const newAnalysis = await response.json();
      window.location.assign(`/analysis-results?resumeId=${resumeId}&analysisId=${newAnalysis.analysisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed.');
      setReanalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFF6F2] p-4 md:p-10 font-raleway text-slate-900">
      <div className="max-w-[1500px] mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button onClick={() => router.back()} className="rounded-full bg-white p-2.5 shadow-sm transition hover:shadow-md" aria-label="Go back">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            <Sparkles size={14} className="text-indigo-500" />
            {data.targetSource === 'job_description'
              ? `Evaluated for: ${data.targetRole || 'supplied job description'}`
              : data.targetSource === 'profile_target'
                ? `Career goal: ${data.targetRole || 'profile target'}`
                : 'General resume evaluation'}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <aside className="order-2 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2 md:p-8 xl:col-span-3">
              <div className="grid items-center gap-8 lg:grid-cols-[240px_1fr]">
              <div><div className="relative mx-auto mb-4 flex h-36 w-36 items-center justify-center">
                <svg className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="72" cy="72" r="62" stroke="#F1F5F9" strokeWidth="12" fill="transparent" />
                  <circle cx="72" cy="72" r="62" stroke={scoreColor(data.overallScore)} strokeWidth="12" fill="transparent" strokeDasharray={390} strokeDashoffset={390 - (390 * data.overallScore) / 100} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-800">{data.overallScore}/100</span>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Overall score</span>
                </div>
              </div>
              <h1 className="text-center text-xl font-bold text-slate-800">{data.interpretationBand}</h1>
              <p className="mt-2 text-center text-xs font-medium text-slate-400">{issueCount} {issueCount === 1 ? 'issue' : 'issues'} identified</p>
              </div><div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                {scoreItems.map(item => <ScoreItem key={item.label} {...item} />)}
              </div></div>
            </section>

            {data.remarks.strengths.length > 0 && (
              <FeedbackCard title="Strengths" tone="green" icon={<CheckCircle2 size={21} />} items={data.remarks.strengths} />
            )}
            {data.remarks.weaknesses.length > 0 && (
              <FeedbackCard title={`Issues found (${issueCount})`} tone="orange" icon={<AlertTriangle size={21} />} items={data.remarks.weaknesses} />
            )}
            {data.remarks.actionable.length > 0 && (
              <FeedbackCard title="What you should do next" tone="blue" icon={<Sparkles size={21} />} items={data.remarks.actionable} numbered />
            )}
            {data.remarks.improvements?.length > 0 && (
              <section className="rounded-3xl border border-indigo-100 bg-white p-7 shadow-lg md:col-span-2 xl:col-span-3">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800"><WandSparkles size={20} className="text-indigo-600" /> Improvement plan</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{data.remarks.improvements.length} recommendations</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.remarks.improvements.map((improvement, index) => (
                    <ImprovementCard key={`${improvement.title}-${index}`} improvement={improvement} />
                  ))}
                </div>
              </section>
            )}
          </aside>

          <main className="order-1 space-y-4">
            <section className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl shadow-slate-200/70 ring-1 ring-slate-200/70">
              <header className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-red-50 p-2.5 text-red-500"><FileText size={20} /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-800">{fileName}</h2>
                    <p className="text-xs text-slate-400">Original uploaded {resumeContent?.fileType?.toUpperCase() || 'document'}</p>
                  </div>
                </div>
                {pdfUrl && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowReanalysisWarning(true)} disabled={reanalyzing} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
                      <RefreshCw size={14} className={reanalyzing ? 'animate-spin' : ''} /> {reanalyzing ? 'Analyzing…' : 'Re-analyze with current profile'}
                    </button>
                    <button onClick={() => router.push(`/resume-editor?resumeId=${data.resumeId}&analysisId=${data.analysisId}`)} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900">
                      <WandSparkles size={14} /> Edit with SmartFolio
                    </button>
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">
                      <ExternalLink size={14} /> {resumeContent?.fileType === 'docx' ? 'Original' : 'Open'}
                    </a>
                    <a href={pdfUrl} download={fileName} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                      <Download size={14} /> Download
                    </a>
                  </div>
                )}
              </header>
              {pdfUrl && resumeContent?.fileType === 'pdf' ? (
                <PdfPreview url={pdfUrl} title={`Original resume: ${fileName}`} />
              ) : resumeContent?.extractedText ? (
                <div className="max-h-[75vh] min-h-[700px] overflow-auto bg-slate-100 p-5 md:p-10">
                  <div className="mx-auto min-h-[650px] max-w-3xl whitespace-pre-wrap rounded-sm bg-white p-8 text-sm leading-7 text-slate-700 shadow-lg md:p-14">
                    {resumeContent.editedText || resumeContent.extractedText}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[700px] items-center justify-center text-sm text-slate-400">PDF unavailable</div>
              )}
            </section>
            <p className="pb-4 text-center text-xs font-medium text-slate-400">
              Confidence: {data.confidenceLevel} · Processed in {(data.processingTimeMs / 1000).toFixed(1)}s
            </p>
          </main>
        </div>
      </div>
      {showReanalysisWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reanalysis-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Info size={21} /></div>
              <button onClick={() => setShowReanalysisWarning(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>
            <h2 id="reanalysis-title" className="text-xl font-black text-slate-800">Create a fresh analysis?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">SmartFolio will analyze this resume again using the target role and career settings currently saved in your profile. This result stays in your history, while a new score and recommendations are created.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setShowReanalysisWarning(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Keep this result</button>
              <button onClick={reanalyzeForCurrentTarget} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"><RefreshCw size={14} /> Create new analysis</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImprovementCard({ improvement }: { improvement: ResumeImprovement }) {
  const tone = {
    critical: 'border-l-red-400 text-red-600',
    important: 'border-l-amber-400 text-amber-700',
    polish: 'border-l-sky-400 text-sky-700',
  }[improvement.severity];
  return (
    <article className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${tone}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest">{improvement.category} · {improvement.severity}</span>
          <h3 className="mt-1 text-base font-bold text-slate-800">{improvement.title}</h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{improvement.explanation}</p>
      {improvement.impact && <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500"><span className="font-black">Why it matters:</span> {improvement.impact}</p>}
      {improvement.suggestedText && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Suggested wording</p>
          <p className="text-sm font-semibold leading-relaxed text-slate-700">{improvement.suggestedText}</p>
        </div>
      )}
    </article>
  );
}

function FeedbackCard({ title, tone, icon, items, numbered = false }: { title: string; tone: 'green' | 'orange' | 'blue'; icon: React.ReactNode; items: string[]; numbered?: boolean }) {
  const styles = {
    green: 'bg-white border-slate-200 text-emerald-600',
    orange: 'bg-white border-slate-200 text-amber-600',
    blue: 'bg-white border-slate-200 text-sky-600',
  }[tone];
  return (
    <section className={`h-full rounded-3xl border p-6 shadow-sm ${styles}`}>
      <h2 className="mb-5 flex items-center gap-3 text-base font-bold text-slate-800"><span className="shrink-0">{icon}</span>{title}</h2>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-slate-600">
            <span className="mt-0.5 shrink-0 font-black text-current">{numbered ? `${index + 1}.` : '•'}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-50 py-3.5 last:border-0">
      <div className="min-w-0">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className={`ml-2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${scoreBadge(score)}`}>
          {score >= 70 ? 'Strong' : score < 40 ? 'Needs work' : 'Developing'}
        </span>
      </div>
      <span className="shrink-0 text-sm font-bold text-slate-800">{score}/100</span>
    </div>
  );
}

function scoreColor(score: number) {
  return score >= 70 ? '#14B8A6' : score >= 50 ? '#FB923C' : '#EF4444';
}

function scoreBadge(score: number) {
  if (score >= 70) return 'bg-green-50 text-green-600';
  if (score < 40) return 'bg-red-50 text-red-500';
  return 'bg-orange-50 text-orange-500';
}

function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#EFF6F2] font-raleway">
      <Loader2 className="mb-4 animate-spin text-indigo-500" size={40} />
      <p className="font-medium text-slate-500">Loading your resume analysis…</p>
    </div>
  );
}
