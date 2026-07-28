'use client';

import FoliLoader from '@/components/foli/FoliLoader';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PdfPreview from '@/components/PdfPreview';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
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

import { apiFetch } from '@/lib/api';

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
  /** Present when this analysis was scored against a pasted job description. */
  jobDescription?: string;
  jobTitle?: string;
  company?: string;
  interpretationBand: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  remarks: {
    strengths: string[];
    weaknesses: string[];
    actionable: string[];
    improvements: ResumeImprovement[];
    positiveHighlights: { text: string; reason: string }[];
  };
  requirementCoverage?: RequirementCoverage[] | null;
  processingTimeMs: number;
  createdAt: string;
}

/** One thing the target asks for, and whether the resume evidences it. */
interface RequirementCoverage {
  requirement: string;
  status: 'matched' | 'partial' | 'missing';
  evidence: string;
  note: string;
}

interface ResumeContent {
  fileName: string;
  fileType: 'pdf' | 'docx';
  extractedText: string | null;
  editedText: string | null;
}

/**
 * The structured resume — the same shape the editor works on.
 *
 * Preferred over the raw extracted text for the preview: extraction returns the
 * PDF's visual lines with hard breaks mid-sentence and every trace of headings,
 * bullets and emphasis stripped, so rendering it faithfully still reads as a
 * wall of text. This has real sections to lay out.
 */
interface StructuredResume {
  personal: { name: string; email: string; phone: string; location: string; linkedin: string; github: string; website: string };
  summary: string;
  skills: string[];
  experience: { title: string; company: string; location: string; startDate: string; endDate: string; bullets: string[] }[];
  education: { degree: string; institution: string; location: string; startDate: string; endDate: string; details: string[] }[];
  projects: { name: string; role: string; link: string; technologies: string[]; bullets: string[] }[];
  certifications: { name: string; issuer: string; date: string }[];
  languages: string[];
  sectionOrder: SectionKey[];
}

type SectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'languages';

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
  const [structured, setStructured] = useState<StructuredResume | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showReanalysisWarning, setShowReanalysisWarning] = useState(false);
  // Re-use the job description this analysis was scored against. Ticked by
  // default: someone who pasted a job description wants to keep being measured
  // against it, and only shown when there is one to keep.
  const [keepJobDescription, setKeepJobDescription] = useState(true);
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
        // /structured is the read-only variant — it returns null rather than
        // calling the LLM to build a document, so a page load never spends
        // tokens or fails because structuring went wrong.
        const [analysisRes, contentRes, fileRes, structuredRes] = await Promise.all([
          apiFetch(`/resume/${resumeId}/analyses`, { headers }),
          apiFetch(`/resume/${resumeId}/content`, { headers }),
          apiFetch(`/resume/${resumeId}/file`, { headers }),
          apiFetch(`/resume/${resumeId}/structured`, { headers }),
        ]);

        const analysisResult = await analysisRes.json();
        if (!analysisRes.ok) {
          throw new Error(analysisResult?.message || 'Failed to fetch analysis.');
        }
        if (!Array.isArray(analysisResult) || analysisResult.length === 0) {
          throw new Error('Analysis not found.');
        }
        if (!contentRes.ok) throw new Error('Resume details could not be loaded.');

        const content = (await contentRes.json()) as ResumeContent;

        // The original file is a preview convenience, not the analysis itself —
        // scoring runs on the extracted text held in the database. Uploaded
        // files sit on the container disk, which is wiped on every rebuild, so
        // this 404s routinely for older resumes. Throwing here used to destroy a
        // results page whose scores had loaded perfectly well; now the preview
        // pane degrades and the results stay.
        if (fileRes.ok) {
          const pdfBlob = await fileRes.blob();
          objectUrl = URL.createObjectURL(pdfBlob);
        }

        // Best-effort: no structured document just means the preview falls back
        // to the extracted text, which is never worth failing the page over.
        let structuredDoc: StructuredResume | null = null;
        if (structuredRes.ok) {
          try {
            structuredDoc = (await structuredRes.json())?.document ?? null;
          } catch {
            structuredDoc = null;
          }
        }

        if (!cancelled) {
          setData(analysisResult.find((item: AnalysisResult) => item.analysisId === requestedAnalysisId) || analysisResult[0]);
          setFileName(content.fileName || 'resume.pdf');
          setResumeContent(content);
          setStructured(structuredDoc);
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

  /**
   * Run a fresh analysis of the same resume.
   *
   * When this analysis was scored against a pasted job description, that
   * description is sent again by default. Re-running used to drop it and score
   * against the profile's target role instead — the same button silently
   * answered a different question, and the new result was not comparable to the
   * one it replaced. `keepJobDescription` lets the user opt out and get the
   * profile-based read deliberately.
   */
  const reanalyzeForCurrentTarget = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token || !resumeId) return;
    setReanalyzing(true);
    setShowReanalysisWarning(false);

    const reuseJd = Boolean(data?.jobDescription) && keepJobDescription;
    try {
      const response = await apiFetch(`/resume/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          ...(reuseJd && {
            jobDescription: data!.jobDescription,
            // The backend requires a title alongside a description; fall back to
            // the role this analysis was already labelled with.
            jobTitle: data!.jobTitle || data!.targetRole,
            ...(data!.company && { company: data!.company }),
          }),
        }),
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
    <div className="min-h-screen bg-[var(--sf-bg)] p-3 font-raleway text-slate-900 md:p-5 xl:p-6">
      <div className="w-full">
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

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] 2xl:gap-6">
          <aside className="order-2 grid items-start gap-5 md:grid-cols-2 xl:order-2 xl:grid-cols-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2 md:p-8 xl:col-span-3">
              <div className="grid items-center gap-8 lg:grid-cols-[240px_1fr]">
              <div><div className="relative mx-auto mb-4 flex h-36 w-36 items-center justify-center">
                <svg className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="72" cy="72" r="62" stroke="#F1F5F9" strokeWidth="12" fill="transparent" />
                  <circle cx="72" cy="72" r="62" stroke={scoreColor(data.overallScore)} strokeWidth="12" fill="transparent" strokeDasharray={390} strokeDashoffset={390 - (390 * data.overallScore) / 100} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-800">{data.overallScore}/100</span>
                  <span className="text-[10px] font-bold uppercase text-gray-500">Overall score</span>
                </div>
              </div>
              <h1 className="text-center text-xl font-bold text-slate-800">{data.interpretationBand}</h1>
              <p className="mt-2 text-center text-xs font-medium text-slate-500">{issueCount} {issueCount === 1 ? 'issue' : 'issues'} identified</p>
              </div><div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                {scoreItems.map(item => <ScoreItem key={item.label} {...item} />)}
              </div></div>
            </section>

            {/* The itemised gap. Placed above the prose cards because it is the
                first thing someone who supplied a job description wants: not a
                score, but which of its requirements they actually meet. */}
            {data.requirementCoverage && data.requirementCoverage.length > 0 && (
              <RequirementCoveragePanel
                items={data.requirementCoverage}
                targetLabel={data.targetRole}
                fromJobDescription={data.targetSource === 'job_description'}
              />
            )}

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

          <main className="order-1 space-y-4 xl:sticky xl:top-6">
            <section className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl shadow-slate-200/70 ring-1 ring-slate-200/70">
              <header className="border-b border-slate-100 p-4 md:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-red-50 p-2.5 text-red-500"><FileText size={20} /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-800">{fileName}</h2>
                    <p className="text-xs text-slate-500">Original uploaded {resumeContent?.fileType?.toUpperCase() || 'document'}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
                    <button onClick={() => setShowReanalysisWarning(true)} disabled={reanalyzing} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
                      {/* "with current profile" would be a lie once a job
                          description can be carried over — the dialog is where
                          the target is actually chosen. */}
                      <RefreshCw size={14} className={reanalyzing ? 'animate-spin' : ''} /> {reanalyzing ? 'Analyzing…' : data.jobDescription ? 'Re-analyze' : 'Re-analyze with current profile'}
                    </button>
                    <button onClick={() => router.push(`/resume-editor?resumeId=${data.resumeId}&analysisId=${data.analysisId}`)} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-slate-900">
                      <WandSparkles size={14} /> Edit with SmartFolio
                    </button>
                    {pdfUrl ? (
                      <>
                        <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-600 hover:bg-slate-200">
                          <ExternalLink size={14} /> {resumeContent?.fileType === 'docx' ? 'Original' : 'Open'}
                        </a>
                        <a href={pdfUrl} download={fileName} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-700">
                          <Download size={14} /> Download
                        </a>
                      </>
                    ) : (
                      <p className="col-span-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800">
                        Original file unavailable. Editing and re-analysis still work from saved resume content.
                      </p>
                    )}
                  </div>
              </header>
              {/* Preview, best available first: the original file, then the
                  structured document, then raw extracted text. The middle tier
                  used to be skipped, so losing the file dropped the user
                  straight to a wall of text that had every heading, bullet and
                  line break mangled by extraction — even though a clean,
                  sectioned version of the same resume was already in the
                  database. */}
              {pdfUrl && resumeContent?.fileType === 'pdf' ? (
                <PdfPreview url={pdfUrl} title={`Original resume: ${fileName}`} />
              ) : structured ? (
                <StructuredResumePreview document={structured} hasOriginal={!!pdfUrl} />
              ) : resumeContent?.extractedText ? (
                <div className="max-h-[75vh] min-h-[700px] overflow-auto bg-slate-100 p-5 md:p-10">
                  <div className="mx-auto min-h-[650px] max-w-3xl whitespace-pre-wrap rounded-sm bg-white p-8 text-sm leading-7 text-slate-700 shadow-lg md:p-14">
                    {resumeContent.editedText || resumeContent.extractedText}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[700px] items-center justify-center text-sm text-slate-500">PDF unavailable</div>
              )}
            </section>
            <p className="pb-4 text-center text-xs font-medium text-slate-500">
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
              <button onClick={() => setShowReanalysisWarning(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>
            <h2 id="reanalysis-title" className="text-xl font-black text-slate-800">Create a fresh analysis?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {data.jobDescription
                ? 'This result stays in your history, while a new score and recommendations are created.'
                : 'SmartFolio will analyze this resume again using the target role and career settings currently saved in your profile. This result stays in your history, while a new score and recommendations are created.'}
            </p>

            {/* Only asked when there is a job description to keep. Without one
                there is nothing to decide, and a question with one sensible
                answer is just friction. */}
            {data.jobDescription && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <input
                  type="checkbox"
                  checked={keepJobDescription}
                  onChange={(event) => setKeepJobDescription(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
                />
                <span className="text-xs leading-5 text-slate-700">
                  <span className="font-bold">
                    Score against {data.jobTitle || data.targetRole || 'the same job'} again
                  </span>
                  <br />
                  Keeps the job description this analysis used, so the new score is comparable.
                  Untick to score against your profile&apos;s target role instead.
                </span>
              </label>
            )}

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
          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Suggested wording</p>
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

/**
 * What the target asks for, set against what the resume actually shows.
 *
 * The scores said how well the resume matched but never what the job wanted, so
 * a middling relevance number was a verdict with no reasoning — you could not
 * see which requirements you met, which were thin, or which were simply absent.
 * Missing items lead, because those are the ones worth acting on.
 */
function RequirementCoveragePanel({
  items,
  targetLabel,
  fromJobDescription,
}: {
  items: RequirementCoverage[];
  targetLabel?: string;
  fromJobDescription: boolean;
}) {
  const order: Record<RequirementCoverage['status'], number> = { missing: 0, partial: 1, matched: 2 };
  const sorted = [...items].sort((a, b) => order[a.status] - order[b.status]);

  const counts = {
    matched: items.filter(i => i.status === 'matched').length,
    partial: items.filter(i => i.status === 'partial').length,
    missing: items.filter(i => i.status === 'missing').length,
  };

  const style = {
    matched: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'You have this' },
    partial: { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Thin' },
    missing: { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', label: 'Not shown' },
  } as const;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg md:col-span-2 xl:col-span-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <ClipboardCheck size={20} className="text-indigo-600" />
          {fromJobDescription ? 'What this job asks for' : `What a ${targetLabel || 'this role'} needs`}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{counts.matched} covered</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{counts.partial} thin</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">{counts.missing} missing</span>
        </div>
      </div>
      <p className="mb-6 text-xs text-slate-500">
        Each requirement below is taken from {fromJobDescription ? 'the job description you supplied' : 'what this role typically expects'} and checked against your CV.
        {counts.missing + counts.partial > 0
          ? ' Work top-down — the gaps are listed first, and the improvement plan below turns them into edits.'
          : ' Your CV evidences everything asked for.'}
      </p>

      <ul className="space-y-3">
        {sorted.map((item, index) => {
          const s = style[item.status];
          return (
            <li key={`${item.requirement}-${index}`} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-800">{item.requirement}</span>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${s.chip}`}>
                  {s.label}
                </span>
              </div>
              {item.evidence && (
                <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs italic leading-relaxed text-slate-500">
                  “{item.evidence}”
                </p>
              )}
              {item.note && (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The resume rendered from its structured sections rather than from extracted
 * text — real headings, spaced sections and actual bullets.
 *
 * This is a readable rendering of the same content, not a facsimile of the
 * user's original design. The banner says so, because a preview that silently
 * looked different from the file they uploaded would be worse than one that
 * explains itself.
 */
function StructuredResumePreview({
  document,
  hasOriginal,
}: {
  document: StructuredResume;
  hasOriginal: boolean;
}) {
  const { personal } = document;
  const contact = [personal.location, personal.phone, personal.email, personal.linkedin, personal.github, personal.website]
    .map(value => value?.trim())
    .filter(Boolean);

  const dates = (start: string, end: string) => [start?.trim(), end?.trim()].filter(Boolean).join(' – ');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-7 first:mt-0">
      <h3 className="border-b border-slate-200 pb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );

  const Bullets = ({ items }: { items: string[] }) => (
    <ul className="mt-2 space-y-1.5">
      {items.filter(Boolean).map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[13px] leading-6 text-slate-700">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  const Tags = ({ items }: { items: string[] }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.filter(Boolean).map((item, index) => (
        <span key={index} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{item}</span>
      ))}
    </div>
  );

  const sections: Record<SectionKey, React.ReactNode> = {
    summary: document.summary?.trim() ? (
      <Section key="summary" title="Professional summary">
        <p className="text-[13px] leading-6 text-slate-700">{document.summary}</p>
      </Section>
    ) : null,

    skills: document.skills?.length ? (
      <Section key="skills" title="Skills"><Tags items={document.skills} /></Section>
    ) : null,

    experience: document.experience?.length ? (
      <Section key="experience" title="Experience">
        <div className="space-y-5">
          {document.experience.map((role, index) => (
            <div key={index}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-bold text-slate-900">{role.title || 'Role'}</p>
                <p className="text-[11px] font-semibold text-slate-500">{dates(role.startDate, role.endDate)}</p>
              </div>
              <p className="text-[12px] text-slate-500">
                {[role.company, role.location].map(v => v?.trim()).filter(Boolean).join(' · ')}
              </p>
              {role.bullets?.length > 0 && <Bullets items={role.bullets} />}
            </div>
          ))}
        </div>
      </Section>
    ) : null,

    projects: document.projects?.length ? (
      <Section key="projects" title="Projects">
        <div className="space-y-5">
          {document.projects.map((project, index) => (
            <div key={index}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-bold text-slate-900">{project.name || 'Project'}</p>
                {project.role?.trim() && <p className="text-[11px] font-semibold text-slate-500">{project.role}</p>}
              </div>
              {project.technologies?.length > 0 && <div className="mt-1.5"><Tags items={project.technologies} /></div>}
              {project.bullets?.length > 0 && <Bullets items={project.bullets} />}
            </div>
          ))}
        </div>
      </Section>
    ) : null,

    education: document.education?.length ? (
      <Section key="education" title="Education">
        <div className="space-y-4">
          {document.education.map((entry, index) => (
            <div key={index}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-bold text-slate-900">{entry.degree || 'Qualification'}</p>
                <p className="text-[11px] font-semibold text-slate-500">{dates(entry.startDate, entry.endDate)}</p>
              </div>
              <p className="text-[12px] text-slate-500">
                {[entry.institution, entry.location].map(v => v?.trim()).filter(Boolean).join(' · ')}
              </p>
              {entry.details?.length > 0 && <Bullets items={entry.details} />}
            </div>
          ))}
        </div>
      </Section>
    ) : null,

    certifications: document.certifications?.length ? (
      <Section key="certifications" title="Certifications">
        <div className="space-y-2">
          {document.certifications.map((cert, index) => (
            <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-semibold text-slate-800">{cert.name}</p>
              <p className="text-[11px] text-slate-500">
                {[cert.issuer, cert.date].map(v => v?.trim()).filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </Section>
    ) : null,

    languages: document.languages?.length ? (
      <Section key="languages" title="Languages"><Tags items={document.languages} /></Section>
    ) : null,
  };

  // The user's own section order, so the preview matches what an export produces.
  const ordered = (document.sectionOrder?.length ? document.sectionOrder : (Object.keys(sections) as SectionKey[]))
    .map(key => sections[key])
    .filter(Boolean);

  return (
    <div className="max-h-[75vh] min-h-[700px] overflow-auto bg-slate-100 p-5 md:p-10">
      {!hasOriginal && (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-[11px] leading-5 text-amber-800">
          Showing a formatted view of your resume content. The original file isn&apos;t stored on the
          server any more, so your own layout and fonts can&apos;t be displayed.
        </div>
      )}
      <div className="mx-auto min-h-[650px] max-w-3xl rounded-sm bg-white p-8 shadow-lg md:p-14">
        <header className="border-b border-slate-200 pb-5">
          <h2 className="font-century text-2xl font-black tracking-tight text-slate-900">
            {personal.name?.trim() || 'Your name'}
          </h2>
          {contact.length > 0 && (
            <p className="mt-2 text-[11.5px] leading-5 text-slate-500">{contact.join('  ·  ')}</p>
          )}
        </header>
        {ordered}
      </div>
    </div>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className="border-b border-gray-50 py-3.5 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-sm font-bold text-slate-700">{label}</span>
          <span className={`ml-2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${scoreBadge(score)}`}>
            {score >= 70 ? 'Strong' : score < 40 ? 'Needs work' : 'Developing'}
          </span>
        </div>
        <span className="shrink-0 text-sm font-bold text-slate-800">{score}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
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
    <FoliLoader
      title="Loading your analysis"
      moods={['typing', 'happy', 'look-l']}
      messages={['Crunching the numbers…', 'Scoring your resume…', 'Almost got your results…']}
    />
  );
}
