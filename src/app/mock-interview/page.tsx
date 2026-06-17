'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import VoiceWave from '@/components/VoiceWave';
import {
  FiLogOut, FiLayout, FiFileText, FiMic, FiBookOpen, FiFile, FiBriefcase,
  FiHelpCircle, FiSettings, FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiSend, FiArrowLeft, FiUser, FiCpu, FiZap, FiArrowRight,
  FiStar, FiTrendingUp, FiVolume2, FiSquare, FiRotateCcw
} from 'react-icons/fi';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><FiLoader className="animate-spin text-gray-300" size={32} /></div>}>
      <MockInterviewContent />
    </Suspense>
  );
}

function MockInterviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);

  // Stage: 'input' | 'loading' | 'round_intro' | 'round' | 'evaluating' | 'results'
  const [stage, setStage] = useState<'input' | 'loading' | 'round_intro' | 'round' | 'evaluating' | 'results'>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0); // Index within the current round's questions
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');

  // Audio States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) { router.push('/login'); return; }
    setToken(t);

    // Initialize STT
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const current = finalTranscript || interimTranscript;
        setTranscript(current);
        transcriptRef.current = current;
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
    }

    // Check for sessionId in URL
    const sid = searchParams.get('sessionId');
    if (sid && t) {
      fetchSessionDetail(t, sid);
    }
  }, [router, searchParams]);

  const fetchSessionDetail = async (accessToken: string, sid: string) => {
    setStage('loading');
    try {
      const res = await fetch(`${API}/mock-interview/${sid}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.id);
        setQuestions(data.questions);
        const ansObj: Record<number, string | number> = {};
        data.answers.forEach((a: any) => { ansObj[a.questionId] = a.answer; });
        setAnswers(ansObj);
        if (data.evaluation) {
          setEvaluation(data.evaluation);
          setStage('results');
        } else {
          setStage('round_intro');
        }
      } else {
        setStage('input');
      }
    } catch (err) {
      setStage('input');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  const currentRound: Round = ROUND_ORDER[currentRoundIdx];
  const currentRoundQuestions = questions.filter((q) => q.round === currentRound);
  const activeQuestion = currentRoundQuestions[currentQuestionIdx];

  // ─── SPEECH UTILS ───────────────────────────────────────────────────

  const getBestVoice = () => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural sounding voices
    const preferred = [
      'Google US English',
      'Microsoft Aria Online',
      'Microsoft Jenny Online',
      'English (United States)',
      'en-US'
    ];
    
    for (const name of preferred) {
      const v = voices.find(v => v.name.includes(name));
      if (v) return v;
    }
    return voices.find(v => v.lang.startsWith('en')) || voices[0];
  };

  const cleanTextForSpeech = (text: string) => {
    return text
      .replace(/_+/g, ' ') // Replace underscores with space
      .replace(/[:;]/g, '.') // Replace colons/semicolons with dots for better pausing
      .replace(/[()]/g, ',') // Replace parens with commas
      .replace(/[*#]/g, '') // Remove markdown-style symbols
      .trim();
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const cleanedText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Automatically start listening after question is asked
      startListening();
    };
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript('');
    transcriptRef.current = '';
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Recognition already started');
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);

    // Save current transcript as answer if it exists
    const finalTranscript = transcriptRef.current;
    if (finalTranscript.trim() && activeQuestion) {
      setAnswers(prev => ({ ...prev, [activeQuestion.id]: finalTranscript.trim() }));
    }
  };

  // ─── FLOW CONTROL ──────────────────────────────────────────────────

  useEffect(() => {
    // Speak when entering round or moving to next question
    if (stage === 'round' && activeQuestion) {
      speak(activeQuestion.question);
    }
  }, [stage, currentQuestionIdx]);

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
      setCurrentQuestionIdx(0);
      setStage('round_intro');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStage('input');
    }
  };

  const startCurrentRound = () => {
    setError('');
    setCurrentQuestionIdx(0);
    setStage('round');
  };

  const handleNext = () => {
    // Capture the absolute latest transcript
    const currentAnswer = transcriptRef.current;

    // Stop listening if active
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    // Save current transcript to answers if not empty
    if (currentAnswer.trim() && activeQuestion) {
      setAnswers(prev => ({ ...prev, [activeQuestion.id]: currentAnswer.trim() }));
    }

    // Check if we have more questions in this round
    if (currentQuestionIdx < currentRoundQuestions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setTranscript('');
      transcriptRef.current = '';
    } else {
      // End of round
      goToNextRound();
    }
  };

  const goToNextRound = () => {
    if (currentRoundIdx < ROUND_ORDER.length - 1) {
      setCurrentRoundIdx(currentRoundIdx + 1);
      setCurrentQuestionIdx(0);
      setTranscript('');
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
      const payload = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] || '' }));
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
    window.speechSynthesis.cancel();
    setStage('input');
    setJobDescription('');
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setCurrentRoundIdx(0);
    setCurrentQuestionIdx(0);
    setEvaluation(null);
    setError('');
  };

  const verdictStyle = (v: string) => {
    if (v === 'correct') return { icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Correct' };
    if (v === 'partial') return { icon: FiAlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Partial' };
    return { icon: FiXCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Incorrect' };
  };

  const isLastQuestionInRound = currentQuestionIdx === currentRoundQuestions.length - 1;
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
                {stage === 'round' && `Question ${currentQuestionIdx + 1} of ${currentRoundQuestions.length} — ${ROUND_META[currentRound].title}`}
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
                    <div className={`flex-1 h-1.5 rounded-full transition-all ${isDone ? 'bg-emerald-400' : isActive ? 'bg-indigo-400' : 'bg-gray-200'}`} />
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
                <p className="font-century text-sm font-bold text-slate-700 mb-3">Professional Interview Simulation</p>
                <div className="space-y-2 text-xs text-slate-600 font-raleway">
                  <div className="flex items-center gap-2"><FiVolume2 className="text-rose-500" size={14} /> Natural voice-guided questions</div>
                  <div className="flex items-center gap-2"><FiMic className="text-blue-500" size={14} /> Voice-to-text response capture</div>
                  <div className="flex items-center gap-2"><FiZap className="text-amber-500" size={14} /> Comprehensive 3-round performance analysis</div>
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

          {/* ROUND STAGE (Sequential Audio Focus) */}
          {stage === 'round' && activeQuestion && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-10 text-center relative overflow-hidden">
                {/* Background pulse when listening */}
                {isListening && <div className="absolute inset-0 bg-indigo-50/30 animate-pulse pointer-events-none" />}

                <div className="relative z-10">
                  <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-6 ${ROUND_META[currentRound].bg} ${ROUND_META[currentRound].color}`}>
                    {activeQuestion.type.replace('_', ' ')}
                  </span>
                  
                  <h3 className="font-century text-2xl font-black text-slate-800 mb-8 leading-relaxed max-w-2xl mx-auto">
                    {activeQuestion.question}
                  </h3>

                  {/* VOICE VISUALIZER */}
                  <div className="mb-10">
                    <VoiceWave 
                      isActive={isSpeaking || isListening} 
                      mode={isSpeaking ? 'speaking' : 'listening'}
                      color={isSpeaking ? 'bg-rose-400' : 'bg-indigo-500'}
                    />
                  </div>

                  {/* TRANSCRIPT AREA */}
                  <div className="min-h-[120px] bg-gray-50 rounded-2xl p-6 mb-8 border border-dashed border-gray-200 flex flex-col items-center justify-center">
                    {isSpeaking && (
                      <p className="font-raleway text-sm text-rose-500 font-semibold animate-pulse">AI is speaking...</p>
                    )}
                    {!isSpeaking && !isListening && !transcript && (
                      <p className="font-raleway text-sm text-gray-400 italic">Microphone is off. Click the button below to start.</p>
                    )}
                    {isListening && !transcript && (
                      <p className="font-raleway text-sm text-indigo-500 font-semibold animate-pulse">Listening to you...</p>
                    )}
                    {transcript && (
                      <p className="font-raleway text-sm text-slate-600 leading-relaxed italic">"{transcript}"</p>
                    )}
                  </div>

                  {/* CONTROLS */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => speak(activeQuestion.question)}
                      className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                      title="Replay Question"
                    >
                      <FiRotateCcw size={20} />
                    </button>

                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={isSpeaking}
                      className={`w-20 h-20 flex items-center justify-center rounded-3xl transition-all shadow-lg ${
                        isListening 
                          ? 'bg-rose-500 text-white hover:bg-rose-600 scale-110' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      } disabled:opacity-50`}
                    >
                      {isListening ? <FiSquare size={32} /> : <FiMic size={32} />}
                    </button>

                    <button
                      onClick={handleNext}
                      className="font-raleway flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-semibold text-sm transition-all"
                    >
                      {isLastQuestionInRound ? (isLastRound ? 'Finish Interview' : 'Next Round') : 'Next Question'}
                      <FiArrowRight size={18} />
                    </button>
                  </div>

                  {/* MANUAL TEXT OVERRIDE (For accessibility) */}
                  <div className="mt-12 pt-8 border-t border-gray-50">
                    <button 
                      onClick={() => {
                        const val = prompt('Type your answer if voice recognition is not working:', answers[activeQuestion.id] as string || '');
                        if (val !== null) setAnswers(prev => ({ ...prev, [activeQuestion.id]: val }));
                      }}
                      className="text-xs text-gray-400 hover:text-indigo-500 font-raleway transition-colors underline underline-offset-4"
                    >
                      Problem with voice? Type your answer instead
                    </button>
                  </div>
                </div>
              </div>

              {/* ROUND PROGRESS */}
              <div className="flex justify-center mt-8 gap-2">
                {currentRoundQuestions.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentQuestionIdx ? 'w-8 bg-indigo-500' : 
                      i < currentQuestionIdx ? 'w-4 bg-emerald-400' : 'w-4 bg-gray-200'
                    }`} 
                  />
                ))}
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
                                <p className="font-raleway text-sm text-slate-600 font-semibold mb-1">Your Answer: <span className="italic font-normal">"{answers[q.id] || 'No answer'}"</span></p>
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
