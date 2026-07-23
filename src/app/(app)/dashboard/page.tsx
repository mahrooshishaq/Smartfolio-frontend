'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { useEffect, useState, useCallback, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiFileText, FiMic,
  FiBookOpen, FiFile, FiBriefcase,
  FiArrowRight, FiUpload, FiSearch,
  FiExternalLink, FiLoader,
} from 'react-icons/fi';
import ScoreRing from '@/components/ScoreRing';
import { apiFetch, getAccessToken } from '@/lib/api';

// --- Sub-components ---

type DashboardIcon = ComponentType<{ size?: number; className?: string }>;

const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }: { title: string; value: string | number; subtitle?: string; icon: DashboardIcon; color: string; onClick?: () => void }) => (
  <div onClick={onClick} className={`bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}>
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        <Icon size={18} className="text-white" />
      </div>
      <h3 className="font-raleway text-gray-400 text-[10px] font-bold uppercase tracking-widest">{title}</h3>
    </div>
    <p className="font-century text-3xl font-black text-slate-800">{value}</p>
    {subtitle && <p className="font-raleway text-xs text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

const metricTones: Record<string, string> = {
  Uploaded: 'bg-pink-50 text-pink-700 ring-pink-100',
  Reviews: 'bg-violet-50 text-violet-700 ring-violet-100',
  Latest: 'bg-sky-50 text-sky-700 ring-sky-100',
  Average: 'bg-amber-50 text-amber-700 ring-amber-100',
  Best: 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white ring-violet-200 shadow-sm shadow-violet-100',
};
const chartColors = ['#F472B6', '#A78BFA', '#60A5FA', '#FBBF24', '#34D399', '#FB7185', '#818CF8', '#2DD4BF'];
const categoryLabels: Record<string, string> = { ats_compatibility: 'ATS', content_quality: 'Content', experience_strength: 'Experience', skills_alignment: 'Skills', achievement_impact: 'Impact', formatting_clarity: 'Formatting' };

const ResumeMetric = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
  <div className={`rounded-2xl p-4 ring-1 ${metricTones[label] || (accent ? 'bg-indigo-600 text-white ring-indigo-200' : 'bg-slate-50 text-slate-800 ring-slate-100')}`}>
    <p className={`font-raleway text-[10px] font-black uppercase tracking-widest ${accent ? 'text-slate-100' : 'opacity-60'}`}>{label}</p>
    <p className="mt-1 font-century text-2xl font-black">{value}</p>
  </div>
);

const EmptyState = ({ icon: Icon, title, description, buttonLabel, onClick }: { icon: DashboardIcon; title: string; description: string; buttonLabel: string; onClick: () => void }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Icon className="text-gray-200 mb-3" size={36} />
    <p className="font-century text-sm font-bold text-slate-700 mb-1">{title}</p>
    <p className="font-raleway text-xs text-gray-400 mb-4">{description}</p>
    <button onClick={onClick} className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all">
      {buttonLabel}
    </button>
  </div>
);

// --- Interfaces ---
interface UserContext {
  userId: string;
  profileCompleteness: number;
  primaryGoals: string[];
  experienceLevel: string;
  careerStage: string;
  currentRole?: string;
  targetRole?: string;
  skills?: string[];
  hasCompletedOnboarding: boolean;
}

interface ResumeAnalysis {
  analysisId: string;
  resumeId: string;
  overallScore: number;
  targetSource: 'job_description' | 'profile_target' | 'general';
  targetRole?: string;
  fileName?: string;
  fileType?: 'pdf' | 'docx';
  createdAt: string;
  categoryScores: Record<string, number>;
  interpretation: { band: string };
  remarks: { strengths: string[]; weaknesses: string[]; actionable: string[] };
}

interface ResumeDashboardData {
  summary: {
    totalResumes: number;
    totalAnalyses: number;
    latestScore: number | null;
    averageScore: number | null;
    bestScore: number | null;
    scoreChange: number | null;
    categoryAverages: Record<string, number | null>;
  };
  resumes: {
    resumeId: string;
    fileName: string;
    fileType: 'pdf' | 'docx';
    uploadedAt: string;
    analysisCount: number;
    latestAnalysis: ResumeAnalysis | null;
  }[];
  analyses: ResumeAnalysis[];
}

interface JobStats {
  total_jobs: number;
  counts_by_type: Record<string, number>;
  counts_by_category: Record<string, number>;
  counts_by_country: Record<string, number>;
}

interface CourseStats {
  total_courses: number;
  counts_by_platform: Record<string, number>;
  counts_by_level: Record<string, number>;
  counts_by_category: Record<string, number>;
}

interface Job {
  id: string;
  title: string;
  company: string;
  company_logo: string;
  location: string;
  job_type: string;
  apply_url: string;
  source: string;
}

interface Course {
  id: string;
  title: string;
  instructor: string;
  platform: string;
  platform_logo: string;
  level: string;
  course_url: string;
}

interface InterviewSession {
  id: string;
  overallScore?: number;
  isSubmitted: boolean;
  jobDescriptionPreview?: string;
  createdAt: string;
}

interface GeneratedDocument {
  id: string;
  title: string;
  documentType: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Data state
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [resumeAnalyses, setResumeAnalyses] = useState<ResumeAnalysis[]>([]);
  const [resumeDashboard, setResumeDashboard] = useState<ResumeDashboardData | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [scraperRunning, setScraperRunning] = useState(false);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
  const [documentHistory, setDocumentHistory] = useState<GeneratedDocument[]>([]);

  const fetchData = useCallback(async () => {
    // apiFetch attaches the token, silently refreshes on a 401, and redirects
    // to /login if the session is truly gone — so a non-ok response here means
    // "no data yet", never "token expired". That's what keeps an expired
    // session from rendering as an all-zeros dashboard.
    const results = await Promise.allSettled([
      apiFetch(`/onboarding/context`).then(r => r.ok ? r.json() : null),
      apiFetch(`/resume/dashboard`).then(r => r.ok ? r.json() : null),
      apiFetch(`/jobs/me/stats`).then(r => r.ok ? r.json() : null),
      apiFetch(`/courses/me/stats`).then(r => r.ok ? r.json() : null),
      apiFetch(`/jobs/me?page=1&limit=5`).then(r => r.ok ? r.json() : { data: [] }),
      apiFetch(`/courses/me?page=1&limit=5`).then(r => r.ok ? r.json() : { data: [] }),
      apiFetch(`/mock-interview/sessions`).then(r => r.ok ? r.json() : []),
      apiFetch(`/document-generation/history`).then(r => r.ok ? r.json() : []),
    ]);

    const getValue = (r: PromiseSettledResult<unknown>): unknown => r.status === 'fulfilled' ? r.value : null;

    const ctx = getValue(results[0]) as UserContext | null;
    const stats = getValue(results[2]) as JobStats | null;
    const cStats = getValue(results[3]) as CourseStats | null;
    const jobs = (getValue(results[4]) as { data: Job[] } | null)?.data || [];
    const courses = (getValue(results[5]) as { data: Course[] } | null)?.data || [];
    const interviews = (getValue(results[6]) as InterviewSession[] | null) || [];
    const docs = (getValue(results[7]) as GeneratedDocument[] | null) || [];

    setUserContext(ctx);
    const resumeData = getValue(results[1]) as ResumeDashboardData | null;
    setResumeDashboard(resumeData);
    setResumeAnalyses(resumeData?.analyses || []);
    setJobStats(stats);
    setCourseStats(cStats);
    setInterviewSessions(interviews);
    setDocumentHistory(docs);
    setLoading(false);

    // If onboarded but no data yet, scraper is likely still running
    const hasData = ((stats?.total_jobs ?? 0) > 0) || ((cStats?.total_courses ?? 0) > 0) || jobs.length > 0 || courses.length > 0;
    if (ctx?.hasCompletedOnboarding && !hasData) {
      setScraperRunning(true);
    } else {
      setScraperRunning(false);
    }

    return { hasData, onboarded: ctx?.hasCompletedOnboarding };
  }, []);

  useEffect(() => {
    const accessToken = getAccessToken();
    const name = localStorage.getItem('userName') || '';
    if (!accessToken) { router.push('/login'); return; }
    setToken(accessToken);
    setUserName(name);
    fetchData();
  }, [router, fetchData]);

  // Poll every 15s while scraper is running
  useEffect(() => {
    if (!scraperRunning || !token) return;
    const interval = setInterval(async () => {
      const result = await fetchData();
      if (result?.hasData) {
        setScraperRunning(false);
        clearInterval(interval);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [scraperRunning, token, fetchData]);

  const latestAnalysis = resumeAnalyses.length > 0 ? resumeAnalyses[0] : null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-400';
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Full Time': 'bg-emerald-50 text-emerald-600',
      'Part Time': 'bg-blue-50 text-blue-600',
      'Remote': 'bg-purple-50 text-purple-600',
      'Hybrid': 'bg-orange-50 text-orange-600',
      'Contract': 'bg-yellow-50 text-yellow-700',
      'Internship': 'bg-pink-50 text-pink-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return (
      <div className="py-32 flex items-center justify-center">
        <FoliLoader fullScreen={false} moods={['happy','look-r','idle']} messages={['Loading your dashboard…','Pulling your progress…']} />
      </div>
    );
  }

  return (
    <div>

          {/* Row 1: Welcome + Quick Actions */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-5 md:p-8 mb-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">
                  Welcome back, {userName?.split(' ')[0] || 'there'}!
                </h2>
                {userContext?.currentRole && userContext?.targetRole ? (
                  <p className="font-raleway text-sm text-gray-400 mt-1">
                    {userContext.currentRole} <span className="text-[#4F46E5]">→</span> {userContext.targetRole}
                    {userContext.careerStage && <span className="ml-2 text-gray-300">• {userContext.careerStage.replace(/_/g, ' ')}</span>}
                  </p>
                ) : (
                  <p className="font-raleway text-sm text-gray-400 mt-1">Your AI-powered career companion</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => router.push('/upload-resume')} className="font-raleway flex flex-1 sm:flex-none items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all">
                  <FiUpload size={14} /> {resumeDashboard?.summary.totalResumes ? 'Analyze Resume' : 'Build a resume with Folio'}
                </button>
                <button onClick={() => router.push('/jobs')} className="font-raleway flex flex-1 sm:flex-none items-center justify-center gap-2 bg-white hover:bg-gray-50 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-200 transition-all">
                  <FiSearch size={14} /> Find Jobs
                </button>
                <button onClick={() => router.push('/courses')} className="font-raleway flex flex-1 sm:flex-none items-center justify-center gap-2 bg-white hover:bg-gray-50 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-200 transition-all">
                  <FiBookOpen size={14} /> Find Courses
                </button>
              </div>
            </div>

            {/* Profile Completeness */}
            {userContext && userContext.profileCompleteness < 100 && (
              <div className="mt-6 pt-5 border-t border-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-raleway text-xs font-bold text-gray-400 uppercase tracking-wider">Profile Completeness</span>
                  <span className="font-century text-sm font-bold text-[#4F46E5]">{userContext.profileCompleteness}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-[#4F46E5] transition-all duration-500" style={{ width: `${userContext.profileCompleteness}%` }} />
                </div>
              </div>
            )}

            {/* Skills */}
            {userContext?.skills && userContext.skills.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-50">
                <div className="flex flex-wrap gap-2">
                  {userContext.skills.slice(0, 8).map((skill) => (
                    <span key={skill} className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600">{skill}</span>
                  ))}
                  {userContext.skills.length > 8 && (
                    <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-gray-50 text-gray-400">+{userContext.skills.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {/* Resume Score Card */}
            <div 
              onClick={() => latestAnalysis && router.push(`/analysis-results?resumeId=${latestAnalysis.resumeId}`)}
              className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all"
            >
              <h3 className="font-raleway text-gray-400 text-[9px] font-bold mb-3 uppercase tracking-widest">Resume</h3>
              {latestAnalysis ? (
                <ScoreRing score={latestAnalysis.overallScore} size={80} strokeWidth={6} color="#F472B6" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                  <FiFileText size={24} />
                </div>
              )}
            </div>

            <StatCard
              title="Interviews"
              value={interviewSessions.length}
              subtitle={interviewSessions.length > 0 ? `${Math.round(interviewSessions.reduce((acc, s) => acc + (s.overallScore || 0), 0) / (interviewSessions.filter(s => s.isSubmitted).length || 1))}% Avg` : 'Practice now'}
              icon={FiMic}
              color="bg-rose-500"
              onClick={() => router.push('/mock-interview')}
            />

            <StatCard
              title="Documents"
              value={documentHistory.length}
              subtitle={documentHistory.length > 0 ? 'Assets ready' : 'Start creating'}
              icon={FiFile}
              color="bg-amber-500"
              onClick={() => router.push('/document-generation')}
            />

            <StatCard
              title="Jobs"
              value={jobStats?.total_jobs || 0}
              subtitle="Matched for you"
              icon={FiBriefcase}
              color="bg-emerald-500"
              onClick={() => router.push('/jobs')}
            />

            <StatCard
              title="Courses"
              value={courseStats?.total_courses || 0}
              subtitle="To level up"
              icon={FiBookOpen}
              color="bg-purple-500"
              onClick={() => router.push('/courses')}
            />
          </div>

          {/* Resume progress and history */}
          {resumeDashboard && resumeDashboard.summary.totalResumes > 0 && (
            <div className="mb-8 rounded-[2rem] border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50/50 p-5 shadow-sm md:p-6">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-century text-xl font-black text-slate-800">Resume progress</h3>
                  <p className="font-raleway text-xs text-gray-400">Every upload and review, measured against the career target used at that time.</p>
                </div>
                <button onClick={() => router.push('/upload-resume')} className="font-raleway text-xs font-bold text-[#4F46E5]">Run a new analysis →</button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <ResumeMetric label="Uploaded" value={resumeDashboard.summary.totalResumes} />
                <ResumeMetric label="Reviews" value={resumeDashboard.summary.totalAnalyses} />
                <ResumeMetric label="Latest" value={resumeDashboard.summary.latestScore == null ? '—' : `${resumeDashboard.summary.latestScore}%`} />
                <ResumeMetric label="Average" value={resumeDashboard.summary.averageScore == null ? '—' : `${resumeDashboard.summary.averageScore}%`} />
                <ResumeMetric label="Best" value={resumeDashboard.summary.bestScore == null ? '—' : `${resumeDashboard.summary.bestScore}%`} accent />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-raleway text-[10px] font-bold uppercase tracking-widest text-gray-400">Score history</h4>
                    {resumeDashboard.summary.scoreChange != null && (
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${resumeDashboard.summary.scoreChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {resumeDashboard.summary.scoreChange >= 0 ? '+' : ''}{resumeDashboard.summary.scoreChange} since previous
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-gradient-to-b from-white via-pink-50/20 to-violet-50/50 p-4">
                    <div className="flex h-24 items-end gap-2 border-b border-slate-200 px-1 pt-5">
                      {[...resumeDashboard.analyses].slice(0, 8).reverse().map((analysis, index) => (
                        <button key={analysis.analysisId} title={`${analysis.fileName || 'Resume'}: ${analysis.overallScore}%`} onClick={() => router.push(`/analysis-results?resumeId=${analysis.resumeId}&analysisId=${analysis.analysisId}`)} className="group flex h-full min-w-0 flex-1 items-end">
                          <span className="relative w-full rounded-t-xl shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:brightness-95" style={{ height: `${Math.max(8, analysis.overallScore)}%`, backgroundColor: chartColors[index % chartColors.length] }}>
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-600">{analysis.overallScore}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2 px-1">{[...resumeDashboard.analyses].slice(0, 8).reverse().map((analysis) => <span key={analysis.analysisId} className="min-w-0 flex-1 truncate text-center text-[10px] font-bold text-slate-400">{new Date(analysis.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>)}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(resumeDashboard.summary.categoryAverages).map(([key, score], index) => <div key={key} className="rounded-xl border border-white bg-white/80 p-2.5 shadow-sm"><div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold text-slate-500">{categoryLabels[key] || key}</span><span className="text-[10px] font-black" style={{ color: chartColors[index % chartColors.length] }}>{score ?? '—'}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${score || 0}%`, backgroundColor: chartColors[index % chartColors.length] }} /></div></div>)}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 font-raleway text-[10px] font-bold uppercase tracking-widest text-gray-400">Resume library</h4>
                  <div className="max-h-52 space-y-2 overflow-auto pr-1">
                    {resumeDashboard.resumes.map((resume) => (
                      <button key={resume.resumeId} onClick={() => resume.latestAnalysis ? router.push(`/analysis-results?resumeId=${resume.resumeId}`) : router.push('/upload-resume')} className="flex w-full items-center gap-3 rounded-2xl border border-violet-100 bg-white/70 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/60 hover:shadow-sm">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-500"><FiFileText size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-century text-sm font-bold text-slate-700">{resume.fileName}</p>
                          <p className="font-raleway text-[10px] text-gray-400">{new Date(resume.uploadedAt).toLocaleDateString()} · {resume.analysisCount} {resume.analysisCount === 1 ? 'review' : 'reviews'}{resume.latestAnalysis?.targetRole ? ` · ${resume.latestAnalysis.targetRole}` : ''}</p>
                        </div>
                        <span className="font-century text-sm font-black text-[#4F46E5]">{resume.latestAnalysis ? `${resume.latestAnalysis.overallScore}%` : '—'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {resumeDashboard.analyses.length > 0 && (
                <div className="mt-7 border-t border-slate-100 pt-6">
                  <h4 className="mb-4 font-raleway text-[10px] font-bold uppercase tracking-widest text-gray-400">Complete review history</h4>
                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {resumeDashboard.analyses.map((analysis) => (
                      <button key={analysis.analysisId} onClick={() => router.push(`/analysis-results?resumeId=${analysis.resumeId}&analysisId=${analysis.analysisId}`)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left transition hover:bg-indigo-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                        <span className="truncate font-century text-sm font-bold text-slate-700">{analysis.fileName || 'Resume'}</span>
                        <span className="hidden truncate font-raleway text-xs font-semibold text-slate-500 sm:block">{analysis.targetSource === 'job_description' ? `Job: ${analysis.targetRole || 'Supplied job description'}` : analysis.targetSource === 'profile_target' ? `Target: ${analysis.targetRole || 'Profile role'}` : 'General readiness'}</span>
                        <span className="hidden font-raleway text-xs text-slate-400 sm:block">{new Date(analysis.createdAt).toLocaleDateString()}</span>
                        <span className="font-century text-sm font-black text-indigo-600">{analysis.overallScore}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 3: Jobs by Type + Courses by Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Jobs by Type */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-4 uppercase tracking-widest">Jobs by Type</h3>
              {jobStats && Object.keys(jobStats.counts_by_type || {}).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(jobStats.counts_by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <span key={type} className={`font-raleway text-[11px] font-bold px-3 py-1.5 rounded-lg ${getTypeBadgeColor(type)}`}>
                      {type} <span className="opacity-60">({count})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-raleway text-xs text-gray-300">No job data yet</p>
              )}
            </div>

            {/* Courses by Level */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-4 uppercase tracking-widest">Courses by Level</h3>
              {courseStats && Object.keys(courseStats.counts_by_level || {}).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(courseStats.counts_by_level).sort((a, b) => b[1] - a[1]).map(([level, count]) => {
                    const total = courseStats.total_courses || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={level}>
                        <div className="font-raleway flex justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-500">{level}</span>
                          <span className="text-gray-400">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-purple-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-raleway text-xs text-gray-300">No course data yet</p>
              )}
            </div>
          </div>

          {/* Row 4: Recent Interviews + Recent Docs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Interviews */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-raleway text-gray-400 text-[10px] font-bold uppercase tracking-widest">Recent Interviews</h3>
                {interviewSessions.length > 0 && (
                  <button onClick={() => router.push('/mock-interview')} className="font-raleway text-[11px] font-bold text-[#4F46E5] flex items-center gap-1 hover:underline">
                    View All <FiArrowRight size={12} />
                  </button>
                )}
              </div>
              {interviewSessions.length > 0 ? (
                <div className="space-y-4">
                  {interviewSessions.slice(0, 5).map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => router.push(`/mock-interview?sessionId=${session.id}`)}
                      className="flex items-center gap-3 group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                        <FiMic size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-century text-sm font-bold text-slate-800 truncate group-hover:text-[#4F46E5] transition-colors">
                          {session.jobDescriptionPreview || 'Mock Interview Session'}
                        </p>
                        <p className="font-raleway text-[11px] text-gray-400">
                          {new Date(session.createdAt).toLocaleDateString()} • {session.isSubmitted ? 'Completed' : 'Draft'}
                        </p>
                      </div>
                      {session.overallScore && (
                        <span className={`font-raleway text-[10px] font-bold px-2 py-0.5 rounded-md ${getScoreColor(session.overallScore)} bg-opacity-10`}>
                          {session.overallScore}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FiMic}
                  title="No Interviews"
                  description="Start practicing for your dream job"
                  buttonLabel="Start Mock Interview"
                  onClick={() => router.push('/mock-interview')}
                />
              )}
            </div>

            {/* Recent Documents */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-raleway text-gray-400 text-[10px] font-bold uppercase tracking-widest">Generated Documents</h3>
                {documentHistory.length > 0 && (
                  <button onClick={() => router.push('/document-generation')} className="font-raleway text-[11px] font-bold text-[#4F46E5] flex items-center gap-1 hover:underline">
                    View All <FiArrowRight size={12} />
                  </button>
                )}
              </div>
              {documentHistory.length > 0 ? (
                <div className="space-y-4">
                  {documentHistory.slice(0, 5).map((doc) => (
                    <div 
                      key={doc.id} 
                      onClick={() => router.push(`/document-generation?docId=${doc.id}`)}
                      className="flex items-center gap-3 group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <FiFile size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-century text-sm font-bold text-slate-800 truncate group-hover:text-[#4F46E5] transition-colors">{doc.title}</p>
                        <p className="font-raleway text-[11px] text-gray-400">
                          {doc.documentType.replace(/_/g, ' ')} • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => router.push('/document-generation')} className="text-gray-300 hover:text-[#4F46E5] transition-colors">
                        <FiExternalLink size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FiFile}
                  title="No Documents"
                  description="Generate cover letters or emails"
                  buttonLabel="Generate Now"
                  onClick={() => router.push('/document-generation')}
                />
              )}
            </div>
          </div>

          {/* Row 5: Jobs by Category */}
          {jobStats && Object.keys(jobStats.counts_by_category || {}).length > 0 && (
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 mb-8">
              <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-4 uppercase tracking-widest">Jobs by Category</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(jobStats.counts_by_category).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="font-raleway text-xs font-bold text-slate-600 truncate">{cat}</span>
                    <span className="font-century text-sm font-black text-[#4F46E5] ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

    </div>
  );
}
