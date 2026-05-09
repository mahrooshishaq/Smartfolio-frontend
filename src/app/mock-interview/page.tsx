'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import {
  FiLogOut, FiLayout, FiFileText, FiMic, FiBookOpen, FiFile, FiBriefcase,
  FiHelpCircle, FiSettings, FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiSend, FiArrowLeft, FiUser, FiCpu, FiZap, FiArrowRight,
  FiStar, FiTrendingUp,
} from 'react-icons/fi';

const API = 'http://localhost:3000';

type Round = 'hr' | 'technical' | 'problem_solving';
type QuestionType = 'mcq' | 'short_answer' | 'scenario' | 'fill_in_the_blank' | 'behavioral';

interface PublicQuestion {
  id: number;
  round: Round;
  type: QuestionType;
  question: string;
  options?: string[];
}
interface QuestionFeedback { questionId: number; verdict: 'correct' | 'partial' | 'incorrect'; explanation: string; }
interface RoundScore { hr: number; technical: number; problem_solving: number; }
interface Evaluation {
  overallScore: number;
  roundScores: RoundScore;
  perQuestion: QuestionFeedback[];
  strengths: string[];
  areasToImprove: string[];
  improvementTips: string[];
  summary: string;
}

const ROUND_META: Record<Round, { title: string; subtitle: string; icon: any; color: string; bg: string }> = {
  hr: {
    title: 'HR & Behavioral',
    subtitle: 'Get to know you — your background, motivation, and work style',
    icon: FiUser,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  technical: {
    title: 'Technical',
    subtitle: 'Test your knowledge with multiple choice, fill-in-the-blank, and concept questions',
    icon: FiCpu,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  problem_solving: {
    title: 'Problem Solving',
    subtitle: 'Real-world scenarios — walk us through your approach',
    icon: FiZap,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
};

const ROUND_ORDER: Round[] = ['hr', 'technical', 'problem_solving'];

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <div onClick={onClick} className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
    <Icon size={20} /><span className="text-sm">{label}</span>
  </div>
);

export default function MockInterviewPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // 'input' | 'loading' | 'round_intro' | 'round' | 'evaluating' | 'results'
  const [stage, setStage] = useState<'input' | 'loading' | 'round_intro' | 'round' | 'evaluating' | 'results'>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  const currentRound: Round = ROUND_ORDER[currentRoundIdx];
  const currentRoundQuestions = questions.filter((q) => q.round === currentRound);

  const generateTest = async () => {
    if (!token) return;
    if (jobDescription.trim().length < 20) {
      setError('Job description must be at least 20 characters.');
      return;
    }
    setStage('loading');
    setError('');
    try {
      const res = await fetch(`${API}/mock-interview/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobDescription }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to generate test.');
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentRoundIdx(0);
      setStage('round_intro');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStage('input');
    }
  };

  const startCurrentRound = () => {
    setError('');
    setStage('round');
  };

  const goToNextRound = () => {
    // Validate current round answered
    const unanswered = currentRoundQuestions.filter((q) => answers[q.id] === undefined || answers[q.id] === '');
    if (unanswered.length > 0) {
      setError(`Please answer all questions in this round. Missing: ${unanswered.length}.`);
      return;
    }
    if (currentRoundIdx < ROUND_ORDER.length - 1) {
      setCurrentRoundIdx(currentRoundIdx + 1);
      setError('');
      setStage('round_intro');
    } else {
      submitInterview();
    }
  };

  const submitInterview = async () => {
    if (!token || !sessionId) return;
    setStage('evaluating');
    setError('');
    try {
      const payload = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] }));
      const res = await fetch(`${API}/mock-interview/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, answers: payload }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit answers.');
      }
      const data = await res.json();
      setEvaluation(data.evaluation);
      setStage('results');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStage('round');
    }
  };

  const restart = () => {
    setStage('input');
    setJobDescription('');
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setCurrentRoundIdx(0);
    setEvaluation(null);
    setError('');
  };

  const verdictStyle = (v: string) => {
    if (v === 'correct') return { icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Correct' };
    if (v === 'partial') return { icon: FiAlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Partial' };
    return { icon: FiXCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Incorrect' };
  };

  const isLastRound = currentRoundIdx === ROUND_ORDER.length - 1;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-gray-100 p-8 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-12 px-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <h1 className="font-baloo text-xl ml-2 tracking-wide text-slate-800">SmartFolio - AI</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={FiLayout} label="Dashboard" onClick={() => router.push('/dashboard')} />
          <SidebarItem icon={FiFileText} label="Resume Analysis" onClick={() => router.push('/upload-resume')} />
          <SidebarItem icon={FiMic} label="Mock Interview" active />
          <SidebarItem icon={FiBookOpen} label="Courses" onClick={() => router.push('/courses')} />
          <SidebarItem icon={FiFile} label="Document Generation" onClick={() => router.push('/document-generation')} />
          <SidebarItem icon={FiBriefcase} label="Jobs" onClick={() => router.push('/jobs')} />
        </nav>
        <div className="mt-auto pt-8 border-t border-gray-50 space-y-2">
          <p className="font-raleway text-[10px] font-bold text-gray-300 px-4 mb-4 uppercase tracking-[0.15em]">Support</p>
          <SidebarItem icon={FiHelpCircle} label="Get Started" />
          <SidebarItem icon={FiSettings} label="Settings" onClick={() => router.push('/dashboard/settings')} />
          <button onClick={handleLogout} className="w-full"><SidebarItem icon={FiLogOut} label="Logout" /></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="relative flex-1 overflow-hidden p-10">
        <AnimatedBackground />
        <div className="relative z-10 h-full overflow-y-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-century text-3xl font-black text-slate-800">Mock Interview</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">
                {stage === 'input' && 'Paste a job description to start a 3-round mock interview'}
                {stage === 'round_intro' && `Get ready for Round ${currentRoundIdx + 1} of ${ROUND_ORDER.length}`}
                {stage === 'round' && `Round ${currentRoundIdx + 1} of ${ROUND_ORDER.length} — ${ROUND_META[currentRound].title}`}
                {stage === 'results' && 'Your full interview evaluation'}
              </p>
            </div>
            {stage !== 'input' && stage !== 'loading' && stage !== 'evaluating' && (
              <button onClick={restart} className="font-raleway flex items-center gap-2 text-sm text-gray-400 hover:text-slate-600 transition-colors">
                <FiArrowLeft size={16} /> Start Over
              </button>
            )}
          </div>

          {/* PROGRESS BAR (when in interview) */}
          {(stage === 'round_intro' || stage === 'round') && (
            <div className="flex items-center gap-2 mb-8 max-w-4xl mx-auto">
              {ROUND_ORDER.map((r, idx) => {
                const meta = ROUND_META[r];
                const isActive = idx === currentRoundIdx;
                const isDone = idx < currentRoundIdx;
                return (
                  <div key={r} className="flex-1 flex items-center gap-2">
                    <div className={`flex-1 h-1.5 rounded-full transition-all ${isDone ? 'bg-emerald-400' : isActive ? meta.bg.replace('bg-', 'bg-').replace('-50', '-400') : 'bg-gray-200'}`} />
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm max-w-4xl mx-auto">{error}</div>
          )}

          {/* INPUT STAGE */}
          {stage === 'input' && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-10 max-w-3xl mx-auto">
              <label className="font-raleway block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here, including required skills, technologies, and responsibilities..."
                className="font-raleway w-full min-h-[260px] bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5] resize-y"
              />
              <div className="bg-indigo-50/50 rounded-2xl p-5 mt-5">
                <p className="font-century text-sm font-bold text-slate-700 mb-3">What to expect</p>
                <div className="space-y-2 text-xs text-slate-600 font-raleway">
                  <div className="flex items-center gap-2"><FiUser className="text-rose-500" size={14} /> Round 1 — HR & Behavioral (5 questions)</div>
                  <div className="flex items-center gap-2"><FiCpu className="text-blue-500" size={14} /> Round 2 — Technical (8 questions)</div>
                  <div className="flex items-center gap-2"><FiZap className="text-amber-500" size={14} /> Round 3 — Problem Solving (2 scenarios)</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="font-raleway text-xs text-gray-400">
                  {jobDescription.length} characters {jobDescription.length < 20 && '(min 20)'}
                </p>
                <button
                  onClick={generateTest}
                  disabled={jobDescription.trim().length < 20}
                  className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSend size={16} /> Start Interview
                </button>
              </div>
            </div>
          )}

          {/* LOADING STAGE */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center justify-center py-32">
              <FiLoader className="animate-spin text-[#4F46E5] mb-4" size={40} />
              <p className="font-century text-lg font-bold text-slate-700">Preparing your interview...</p>
              <p className="font-raleway text-sm text-gray-400 mt-2">Crafting questions across 3 rounds</p>
            </div>
          )}

          {/* ROUND INTRO STAGE */}
          {stage === 'round_intro' && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-12 text-center">
                <div className={`w-20 h-20 rounded-3xl ${ROUND_META[currentRound].bg} ${ROUND_META[currentRound].color} flex items-center justify-center mx-auto mb-6`}>
                  {(() => { const Icon = ROUND_META[currentRound].icon; return <Icon size={36} />; })()}
                </div>
                <p className="font-raleway text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
                  Round {currentRoundIdx + 1} of {ROUND_ORDER.length}
                </p>
                <h3 className="font-century text-3xl font-black text-slate-800 mb-3">{ROUND_META[currentRound].title}</h3>
                <p className="font-raleway text-sm text-gray-500 max-w-md mx-auto leading-relaxed mb-6">
                  {ROUND_META[currentRound].subtitle}
                </p>
                <p className="font-raleway text-xs text-gray-400 mb-8">
                  {currentRoundQuestions.length} {currentRoundQuestions.length === 1 ? 'question' : 'questions'}
                </p>
                <button
                  onClick={startCurrentRound}
                  className="font-raleway inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-2xl font-semibold text-sm transition-all"
                >
                  Begin Round <FiArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ROUND STAGE */}
          {stage === 'round' && (
            <div className="space-y-5 max-w-4xl mx-auto pb-10">
              {currentRoundQuestions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
                  <div className="flex items-start gap-3 mb-4">
                    <span className={`font-century text-sm font-bold ${ROUND_META[currentRound].color} ${ROUND_META[currentRound].bg} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <span className="font-raleway text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {q.type === 'mcq' ? 'Multiple Choice' :
                         q.type === 'fill_in_the_blank' ? 'Fill in the Blank' :
                         q.type === 'short_answer' ? 'Short Answer' :
                         q.type === 'behavioral' ? 'Behavioral' : 'Scenario'}
                      </span>
                      <h3 className="font-century text-base font-bold text-slate-800 mt-1 leading-relaxed">{q.question}</h3>
                    </div>
                  </div>

                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2 ml-11">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                            answers[q.id] === optIdx
                              ? 'border-[#4F46E5] bg-indigo-50 text-slate-800'
                              : 'border-gray-100 hover:border-gray-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === optIdx}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className="accent-[#4F46E5]"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'fill_in_the_blank' && (
                    <div className="ml-11" style={{ width: 'calc(100% - 2.75rem)' }}>
                      <input
                        type="text"
                        value={(answers[q.id] as string) ?? ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your answer..."
                        className="font-raleway w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                  )}

                  {(q.type === 'short_answer' || q.type === 'scenario' || q.type === 'behavioral') && (
                    <textarea
                      value={(answers[q.id] as string) ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={
                        q.type === 'scenario' ? 'Walk through your approach...' :
                        q.type === 'behavioral' ? 'Take your time — share a specific example...' :
                        'Your answer...'
                      }
                      className={`font-raleway w-full ml-11 ${q.type === 'scenario' || q.type === 'behavioral' ? 'min-h-[140px]' : 'min-h-[80px]'} bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:border-[#4F46E5] resize-y`}
                      style={{ width: 'calc(100% - 2.75rem)' }}
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-4">
                <button
                  onClick={goToNextRound}
                  className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-2xl font-semibold text-sm transition-all"
                >
                  {isLastRound ? <><FiSend size={16} /> Submit Interview</> : <>Next Round <FiArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* EVALUATING STAGE */}
          {stage === 'evaluating' && (
            <div className="flex flex-col items-center justify-center py-32">
              <FiLoader className="animate-spin text-[#4F46E5] mb-4" size={40} />
              <p className="font-century text-lg font-bold text-slate-700">Evaluating your interview...</p>
              <p className="font-raleway text-sm text-gray-400 mt-2">Reviewing all 3 rounds</p>
            </div>
          )}

          {/* RESULTS STAGE */}
          {stage === 'results' && evaluation && (
            <div className="space-y-6 max-w-4xl mx-auto pb-10">
              {/* Overall Score */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-10 text-center">
                <div className="relative inline-flex items-center justify-center mb-4">
                  <svg className="w-44 h-44 -rotate-90">
                    <circle cx="88" cy="88" r="78" stroke="#F1F5F9" strokeWidth="12" fill="none" />
                    <circle
                      cx="88" cy="88" r="78" stroke="#4F46E5" strokeWidth="12" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(evaluation.overallScore / 100) * 490} 490`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-century text-5xl font-black text-slate-800">{evaluation.overallScore}</span>
                    <span className="font-raleway text-xs text-gray-400 uppercase tracking-wider">/ 100</span>
                  </div>
                </div>
                <h3 className="font-century text-xl font-black text-slate-800 mb-2">Overall Performance</h3>
                <p className="font-raleway text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">{evaluation.summary}</p>
              </div>

              {/* Per-round scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ROUND_ORDER.map((r) => {
                  const meta = ROUND_META[r];
                  const Icon = meta.icon;
                  const score = evaluation.roundScores[r];
                  return (
                    <div key={r} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 text-center">
                      <div className={`w-12 h-12 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center mx-auto mb-3`}>
                        <Icon size={22} />
                      </div>
                      <p className="font-raleway text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{meta.title}</p>
                      <p className="font-century text-3xl font-black text-slate-800">{score}<span className="text-base text-gray-400">/100</span></p>
                    </div>
                  );
                })}
              </div>

              {/* Strengths & Areas to Improve */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
                  <div className="flex items-center gap-2 mb-4">
                    <FiStar className="text-emerald-500" size={20} />
                    <h3 className="font-century text-lg font-black text-slate-800">Strengths</h3>
                  </div>
                  <ul className="space-y-3">
                    {evaluation.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 font-raleway text-sm text-slate-600">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
                  <div className="flex items-center gap-2 mb-4">
                    <FiTrendingUp className="text-amber-500" size={20} />
                    <h3 className="font-century text-lg font-black text-slate-800">Areas to Improve</h3>
                  </div>
                  <ul className="space-y-3">
                    {evaluation.areasToImprove.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 font-raleway text-sm text-slate-600">
                        <span className="text-amber-500 mt-0.5">•</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Per-question breakdown */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
                <h3 className="font-century text-lg font-black text-slate-800 mb-5">Question Breakdown</h3>
                <div className="space-y-3">
                  {ROUND_ORDER.map((r) => {
                    const roundQs = questions.filter((q) => q.round === r);
                    const meta = ROUND_META[r];
                    return (
                      <div key={r}>
                        <p className={`font-raleway text-[10px] font-bold uppercase tracking-wider ${meta.color} mb-2 mt-3`}>
                          {meta.title}
                        </p>
                        {roundQs.map((q) => {
                          const fb = evaluation.perQuestion.find((f) => f.questionId === q.id);
                          if (!fb) return null;
                          const style = verdictStyle(fb.verdict);
                          const Icon = style.icon;
                          return (
                            <div key={q.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 mb-2">
                              <div className={`${style.bg} ${style.color} w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}>
                                <Icon size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-century text-xs font-bold text-slate-700">Q{q.id}</span>
                                  <span className={`font-raleway text-[10px] font-bold uppercase tracking-wider ${style.color}`}>{style.label}</span>
                                </div>
                                <p className="font-raleway text-xs text-gray-500 mb-1 line-clamp-2">{q.question}</p>
                                <p className="font-raleway text-sm text-slate-600">{fb.explanation}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Improvement tips */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7">
                <h3 className="font-century text-lg font-black text-slate-800 mb-5">What to Work On Next</h3>
                <div className="space-y-3">
                  {evaluation.improvementTips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-indigo-50/40 rounded-xl">
                      <span className="font-century text-sm font-bold text-[#4F46E5] flex-shrink-0">{idx + 1}.</span>
                      <p className="font-raleway text-sm text-slate-700 leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={restart}
                  className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-10 py-4 rounded-2xl font-semibold text-sm transition-all"
                >
                  <FiRefreshCw size={16} /> Try Another Interview
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
