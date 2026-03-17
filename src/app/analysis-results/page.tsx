'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AnalysisResult {
  overallScore: number;
  metrics: {
    toneAndStyle: number;
    content: number;
    structure: number;
    skills: number;
  };
  remarks: string[];
  parsedData: {
    name?: string;
    contact?: string;
    experience?: Array<{ role: string; company: string; duration: string; description: string }>;
    education?: Array<{ degree: string; school: string; year: string }>;
    skills?: string[];
    tools?: string[];
  };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
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

        const response = await fetch(`http://localhost:3001/resume/${resumeId}/analyses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.message || 'Failed to fetch analysis results.');
        }

        if (!Array.isArray(result) || result.length === 0) {
          setData(null);
          return;
        }

        // Backend returns an array, take the latest entry from the API order.
        setData(result[0]);
      } catch (error) {
        console.error("Failed to fetch analysis:", error);
        setError(error instanceof Error ? error.message : 'Unable to load analysis results.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [resumeId, router]);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-20 text-center font-bold font-raleway">{error}</div>;
  if (!data) return <div className="p-20 text-center font-bold font-raleway">Analysis not found.</div>;

  return (
    <div className="min-h-screen bg-[#FDFCFB] p-10 font-raleway text-slate-900">
      <button onClick={() => router.back()} className="mb-8 p-2 hover:bg-white rounded-full transition-all shadow-sm active:scale-95">
        <ArrowLeft size={20} className="text-gray-600" />
      </button>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-100 border border-gray-50">
            <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="#F1F5F9" strokeWidth="14" fill="transparent" />
                <circle cx="80" cy="80" r="70" stroke="#F472B6" strokeWidth="14" fill="transparent" 
                        strokeDasharray={440} strokeDashoffset={440 - (440 * data.overallScore) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-800">{data.overallScore}/100</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{data.remarks.length} issues</span>
              </div>
            </div>

            <h2 className="text-center text-2xl font-century font-bold text-slate-800 mb-8">Your Resume Score</h2>

            <div className="space-y-1">
              <ScoreItem label="Tone & Style" score={data.metrics.toneAndStyle} />
              <ScoreItem label="Content" score={data.metrics.content} />
              <ScoreItem label="Structure" score={data.metrics.structure} />
              <ScoreItem label="Skills" score={data.metrics.skills} />
            </div>
          </div>

          {/* ATS Findings Card - Styled to match screenshot */}
          <div className="bg-[#F4FDFB] rounded-[2.5rem] p-8 border border-[#E0F5F0]">
            <div className="flex items-center gap-3 mb-6">
               <div className="bg-[#D1F0E8] p-2 rounded-xl text-[#14B8A6]">
                <CheckCircle2 size={24} />
               </div>
               <h3 className="font-century font-bold text-slate-800">ATS Score - {data.overallScore}/100</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-6 leading-relaxed font-medium">
              Your resume was scanned like an employer would. Here's how it performed:
            </p>
            <div className="space-y-4">
              {data.remarks.map((remark, i) => (
                <div key={i} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 100}ms` }}>
                  <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 leading-tight">{remark}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Resume Preview Card */}
        <div className="lg:col-span-8 bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200 border-4 border-blue-500 min-h-[900px]">
          <div className="mb-10">
            <h1 className="text-3xl font-century font-bold text-slate-800 mb-2">{data.parsedData?.name || 'Candidate Name'}</h1>
            <p className="text-sm text-slate-400 font-medium">{data.parsedData?.contact || 'Contact Information'}</p>
          </div>
          
          <div className="grid grid-cols-12 gap-10">
            {/* Main Content: Experience */}
            <div className="col-span-8 space-y-10">
               <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-6">Experience</h4>
                <div className="space-y-8">
                  {data.parsedData?.experience?.map((exp, i) => (
                    <div key={i} className="flex gap-5">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-100 shrink-0">
                          {exp.company?.[0]}
                        </div>
                        <div>
                          <h5 className="font-century font-bold text-slate-800 text-base">{exp.role} — {exp.company}</h5>
                          <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wide">{exp.duration}</p>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">{exp.description}</p>
                        </div>
                    </div>
                  ))}
                </div>
               </div>
            </div>

            {/* Sidebar Content: Education & Skills */}
            <div className="col-span-4 space-y-10 border-l border-slate-50 pl-8">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-4">Education</h4>
                {data.parsedData?.education?.map((edu, i) => (
                  <div key={i} className="mb-4">
                    <p className="text-xs font-century font-bold text-slate-800">{edu.degree}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{edu.school} {edu.year}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-4">Skills</h4>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                  {data.parsedData?.skills?.map((skill, i) => (
                    <p key={i}>{skill}</p>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-4">Social</h4>
                <div className="text-[11px] font-medium text-slate-400 space-y-1">
                  <p>linkedin.com/in/user</p>
                  <p>github.com/user</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreItem({ label, score }: { label: string, score: number }) {
  const isStrong = score > 70;
  const isNeedsWork = score < 40;
  
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-bold text-slate-600 text-sm">{label}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
          isStrong ? 'bg-green-100 text-green-600' : 
          isNeedsWork ? 'bg-red-100 text-red-600' : 
          'bg-orange-100 text-orange-600'
        }`}>
          {isStrong ? 'Strong' : isNeedsWork ? 'Needs Work' : 'Good Start'}
        </span>
      </div>
      <span className="font-bold text-slate-800 text-sm">{score}/100</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFCFB]">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
      <p className="text-slate-500 font-medium italic animate-pulse">SmartFolio is generating your scores...</p>
    </div>
  );
}