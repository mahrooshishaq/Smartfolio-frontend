'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiFileText, FiMic,
  FiBookOpen, FiFile, FiBriefcase,
  FiArrowRight, FiUpload, FiSearch,
  FiMapPin, FiExternalLink, FiLoader,
} from 'react-icons/fi';
import ScoreRing from '@/components/ScoreRing';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// --- Sub-components ---

const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }: { title: string; value: string | number; subtitle?: string; icon: any; color: string; onClick?: () => void }) => (
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

const EmptyState = ({ icon: Icon, title, description, buttonLabel, onClick }: { icon: any; title: string; description: string; buttonLabel: string; onClick: () => void }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Icon className="text-gray-200 mb-3" size={36} />
    <p className="font-century text-sm font-bold text-slate-700 mb-1">{title}</p>
    <p className="font-raleway text-xs text-gray-400 mb-4">{description}</p>
    <button onClick={onClick} className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all">
      {buttonLabel}
    </button>
  </div>
);

const ScraperPulse = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="relative mb-4">
      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
        <FiSearch className="text-[#4F46E5]" size={20} />
      </div>
      <div className="absolute inset-0 w-12 h-12 rounded-full bg-indigo-200 animate-ping opacity-30" />
    </div>
    <p className="font-century text-sm font-bold text-slate-700 mb-1">{label}</p>
    <p className="font-raleway text-xs text-gray-400">This may take a few minutes</p>
    <div className="flex gap-1 mt-3">
      <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
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
  id: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  interpretation: { band: string };
  remarks: { strengths: string[]; weaknesses: string[]; actionable: string[] };
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

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Data state
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [resumeAnalyses, setResumeAnalyses] = useState<ResumeAnalysis[]>([]);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);

  const [scraperRunning, setScraperRunning] = useState(false);
  const [interviewSessions, setInterviewSessions] = useState<any[]>([]);
  const [documentHistory, setDocumentHistory] = useState<any[]>([]);

  const fetchData = useCallback(async (accessToken: string) => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const results = await Promise.allSettled([
      fetch(`${API}/onboarding/context`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/resume/analyses`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/jobs/me/stats`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/courses/me/stats`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/jobs/me?page=1&limit=5`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API}/courses/me?page=1&limit=5`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API}/mock-interview/sessions`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/document-generation/history`, { headers }).then(r => r.ok ? r.json() : []),
    ]);

    const getValue = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;

    const ctx = getValue(results[0]);
    const stats = getValue(results[2]);
    const cStats = getValue(results[3]);
    const jobs = getValue(results[4])?.data || [];
    const courses = getValue(results[5])?.data || [];
    const interviews = getValue(results[6]) || [];
    const docs = getValue(results[7]) || [];

    setUserContext(ctx);
    setResumeAnalyses(getValue(results[1]) || []);
    setJobStats(stats);
    setCourseStats(cStats);
    setRecentJobs(jobs);
    setRecentCourses(courses);
    setInterviewSessions(interviews);
    setDocumentHistory(docs);
    setLoading(false);

    // If onboarded but no data yet, scraper is likely still running
    const hasData = (stats?.total_jobs > 0) || (cStats?.total_courses > 0) || jobs.length > 0 || courses.length > 0;
    if (ctx?.hasCompletedOnboarding && !hasData) {
      setScraperRunning(true);
    } else {
      setScraperRunning(false);
    }

    return { hasData, onboarded: ctx?.hasCompletedOnboarding };
  }, []);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const name = localStorage.getItem('userName') || '';
    if (!accessToken) { router.push('/login'); return; }
    setToken(accessToken);
    setUserName(name);
    fetchData(accessToken);
  }, [router, fetchData]);

  // Poll every 15s while scraper is running
  useEffect(() => {
    if (!scraperRunning || !token) return;
    const interval = setInterval(async () => {
      const result = await fetchData(token);
      if (result?.hasData) {
        setScraperRunning(false);
        clearInterval(interval);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [scraperRunning, token, fetchData]);

  const latestAnalysis = resumeAnalyses.length > 0 ? resumeAnalyses[resumeAnalyses.length - 1] : null;

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
        <FiLoader className="animate-spin text-gray-300" size={32} />
      </div>
    );
  }

  return (
    <div>

          {/* Row 1: Welcome + Quick Actions */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-century text-3xl font-black text-slate-800">
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
              <div className="flex items-center gap-3">
                <button onClick={() => router.push('/upload-resume')} className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all">
                  <FiUpload size={14} /> Analyze Resume
                </button>
                <button onClick={() => router.push('/jobs')} className="font-raleway flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-200 transition-all">
                  <FiSearch size={14} /> Find Jobs
                </button>
                <button onClick={() => router.push('/courses')} className="font-raleway flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-200 transition-all">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
