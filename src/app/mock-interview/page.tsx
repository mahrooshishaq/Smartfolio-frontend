'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import VoiceWave from '@/components/VoiceWave';
import { useWebcam } from './useWebcam';
import { ResultsStage } from './ResultsStage';
import { InputStage } from './InputStage';
import {
  FiLogOut, FiLayout, FiFileText, FiMic, FiBookOpen, FiFile, FiBriefcase,
  FiHelpCircle, FiSettings, FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiSend, FiArrowLeft, FiUser, FiCpu, FiZap, FiArrowRight,
  FiStar, FiTrendingUp, FiVolume2, FiSquare, FiRotateCcw,
  FiVideo, FiVideoOff, FiPhoneOff, FiMessageSquare, FiWifi
} from 'react-icons/fi';
import { useSpeech } from './useSpeech';
import type {
  Round, LengthTier, Seniority, PublicQuestion, Evaluation, ProgressPoint, ProgressSummary,
} from './types';
import {
  ROUND_META, ROUND_ORDER, TIER_OPTIONS, SENIORITY_OPTIONS, INTERVIEWER, fmtTime, SidebarItem,
} from './constants';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

  // Stage: 'input' | 'loading' | 'connecting' | 'round_intro' | 'round' | 'evaluating' | 'results'
  const [stage, setStage] = useState<'input' | 'loading' | 'connecting' | 'round_intro' | 'round' | 'evaluating' | 'results'>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [lengthTier, setLengthTier] = useState<LengthTier>('standard');
  const [seniority, setSeniority] = useState<Seniority | ''>('');
  const [focusInput, setFocusInput] = useState('');
  const [useResume, setUseResume] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0); // Index within the current round's questions
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ points: ProgressPoint[]; summary: ProgressSummary } | null>(null);

  // Adaptive follow-ups (Phase 2.2)
  const [followUpQ, setFollowUpQ] = useState<{ parentQuestionId: number; question: string } | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<number, string>>({});
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);

  // Video-call experience (Phase 3)
  const { videoRef, cameraOn, cameraError, start: startCamera, stop: stopCamera, toggle: toggleCamera } = useWebcam();
  const [captionsOn, setCaptionsOn] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds since the call began
  const [connectPhase, setConnectPhase] = useState<'dialing' | 'joined'>('dialing');
  const [typing, setTyping] = useState(false); // inline typed-answer fallback (Phase 4.3)

  // Neural TTS fetcher (Phase 3.4) — hits the backend /tts (Kokoro via Python),
  // returns audio or null so useSpeech falls back to browser TTS.
  const neuralTts = useCallback(async (text: string): Promise<Blob | null> => {
    const tok = localStorage.getItem('accessToken');
    if (!tok) return null;
    try {
      const res = await fetch(`${API}/mock-interview/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  }, []);

  // Speech (TTS + STT) — extracted into a hook (Phase 0.3), with neural TTS (Phase 3.4)
  const {
    isSpeaking, isListening, transcript, transcriptRef, supported: sttSupported,
    speak, speakMcq, startListening, stopListening: stopSpeechRecognition, resetTranscript,
  } = useSpeech(neuralTts);

  // Loads the user's score trend for the progress card (Phase 4.1). Fails silently.
  const loadProgress = (tok: string) => {
    fetch(`${API}/mock-interview/progress`, { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setProgress(d); })
      .catch(() => {});
  };

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadProgress(t);

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
        if (data.lengthTier) setLengthTier(data.lengthTier);
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

  // Stops recognition and persists whatever was captured as the current answer.
  const stopListening = () => {
    stopSpeechRecognition();
    const finalTranscript = transcriptRef.current;
    if (finalTranscript.trim() && activeQuestion) {
      setAnswers(prev => ({ ...prev, [activeQuestion.id]: finalTranscript.trim() }));
    }
  };

  // ─── FLOW CONTROL ──────────────────────────────────────────────────

  useEffect(() => {
    // Speak when entering round or moving to next question
    if (stage === 'round' && activeQuestion) {
      if (activeQuestion.type === 'mcq') {
        speakMcq(activeQuestion);
      } else {
        speak(activeQuestion.question);
      }
    }
  }, [stage, currentQuestionIdx]);

  // ─── VIDEO-CALL CEREMONY & TIMER (Phase 3) ─────────────────────────────
  // Connecting sequence: dial → "Aria joined" → into the interview.
  useEffect(() => {
    if (stage !== 'connecting') return;
    setConnectPhase('dialing');
    startCamera();
    const t1 = setTimeout(() => setConnectPhase('joined'), 1800);
    const t2 = setTimeout(() => setStage('round_intro'), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Running call timer while the interview is live.
  useEffect(() => {
    const inCall = stage === 'connecting' || stage === 'round_intro' || stage === 'round';
    if (!inCall) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  // Release the camera once the call is over.
  useEffect(() => {
    if (stage === 'results' || stage === 'input') stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Reset the typed-answer fallback per question; default it ON when STT is unsupported (Phase 4.3).
  useEffect(() => {
    setTyping(!sttSupported);
  }, [currentQuestionIdx, currentRoundIdx, followUpQ, sttSupported]);

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
        body: JSON.stringify({
          jobDescription,
          lengthTier,
          useResume,
          ...(seniority ? { seniority } : {}),
          ...(focusInput.trim()
            ? { focusAreas: focusInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6) }
            : {}),
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to generate test.');
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      if (data.lengthTier) setLengthTier(data.lengthTier);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentRoundIdx(0);
      setCurrentQuestionIdx(0);
      setElapsed(0);
      setStage('connecting');
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

  // Advance to the next question (or next round / submit) — the plain forward move.
  const advanceQuestion = () => {
    if (currentQuestionIdx < currentRoundQuestions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      resetTranscript();
    } else {
      goToNextRound();
    }
  };

  // Ask the backend for an adaptive follow-up. Fails safe: any error -> null.
  const fetchFollowUp = async (questionId: number, answer: string): Promise<string | null> => {
    if (!token || !sessionId) return null;
    try {
      const res = await fetch(`${API}/mock-interview/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, questionId, answer }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.followUp || null;
    } catch {
      return null;
    }
  };

  const handleNext = async () => {
    // Capture the absolute latest transcript
    const currentAnswer = transcriptRef.current;

    // Stop listening if active
    if (isListening) {
      stopSpeechRecognition();
    }

    // We are currently answering a follow-up → store its answer, then advance.
    if (followUpQ) {
      if (currentAnswer.trim()) {
        setFollowUpAnswers(prev => ({ ...prev, [followUpQ.parentQuestionId]: currentAnswer.trim() }));
      }
      setFollowUpQ(null);
      advanceQuestion();
      return;
    }

    // Save current transcript to answers if not empty (MCQ answers are stored on click)
    if (currentAnswer.trim() && activeQuestion && activeQuestion.type !== 'mcq') {
      setAnswers(prev => ({ ...prev, [activeQuestion.id]: currentAnswer.trim() }));
    }

    // Maybe ask an adaptive follow-up on open-ended answers (standard/full only, once per question).
    const eligible =
      !!activeQuestion &&
      (activeQuestion.type === 'behavioral' || activeQuestion.type === 'scenario') &&
      lengthTier !== 'quick' &&
      currentAnswer.trim().length > 0 &&
      !(activeQuestion.id in followUpAnswers);

    if (eligible && activeQuestion) {
      setAwaitingFollowUp(true);
      const fu = await fetchFollowUp(activeQuestion.id, currentAnswer.trim());
      setAwaitingFollowUp(false);
      if (fu) {
        setFollowUpQ({ parentQuestionId: activeQuestion.id, question: fu });
        resetTranscript();
        speak(fu);
        return; // stay on this screen; the follow-up is now showing
      }
    }

    advanceQuestion();
  };

  const goToNextRound = () => {
    if (currentRoundIdx < ROUND_ORDER.length - 1) {
      setCurrentRoundIdx(currentRoundIdx + 1);
      setCurrentQuestionIdx(0);
      resetTranscript();
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
      const payload = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' }));
      const followUpPayload = Object.entries(followUpAnswers).map(([parentQuestionId, answer]) => ({
        parentQuestionId: Number(parentQuestionId),
        answer,
      }));
      const res = await fetch(`${API}/mock-interview/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          answers: payload,
          ...(followUpPayload.length ? { followUpAnswers: followUpPayload } : {}),
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit answers.');
      }
      const data = await res.json();
      setEvaluation(data.evaluation);
      setStage('results');
      if (token) loadProgress(token); // refresh the trend with this attempt
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
    setFollowUpQ(null);
    setFollowUpAnswers({});
    setAwaitingFollowUp(false);
    stopCamera();
    setElapsed(0);
    setCaptionsOn(true);
    setConnectPhase('dialing');
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
                {stage === 'connecting' && 'Connecting you to your interviewer…'}
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
            <InputStage
              jobDescription={jobDescription} setJobDescription={setJobDescription}
              lengthTier={lengthTier} setLengthTier={setLengthTier}
              seniority={seniority} setSeniority={setSeniority}
              focusInput={focusInput} setFocusInput={setFocusInput}
              useResume={useResume} setUseResume={setUseResume}
              onStart={generateTest}
              sttSupported={sttSupported}
              progress={progress}
            />
          )}

          {/* LOADING STAGE */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center justify-center py-32">
              <FiLoader className="animate-spin text-[#4F46E5] mb-4" size={40} />
              <p className="font-century text-lg font-bold text-slate-700">Preparing your interview...</p>
              <p className="font-raleway text-sm text-gray-400 mt-2">Crafting questions across 3 rounds</p>
            </div>
          )}

          {/* CONNECTING (call ceremony) */}
          {stage === 'connecting' && (
            <div className="max-w-4xl mx-auto">
              <div className="relative overflow-hidden rounded-[2rem] bg-[#0A0E1A] border border-white/5 p-14 text-center shadow-2xl">
                <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative mb-6 grid place-items-center">
                    {connectPhase === 'dialing' && <span className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-indigo-500/30 animate-ping" />}
                    <div className="relative w-24 h-24 rounded-full grid place-items-center bg-gradient-to-br from-indigo-400 via-violet-500 to-blue-500 shadow-lg">
                      <FiUser className="text-white" size={40} />
                    </div>
                  </div>
                  <p className="font-century text-2xl font-black text-white mb-2">
                    {connectPhase === 'dialing' ? `Connecting to ${INTERVIEWER.name}…` : `${INTERVIEWER.name} has joined`}
                  </p>
                  <p className="font-raleway text-sm text-slate-400">
                    {connectPhase === 'dialing' ? 'Setting up your interview room' : 'Your interview is about to begin'}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-slate-500 text-xs font-raleway">
                    <FiVideo size={14} /> {cameraOn ? 'Camera ready' : (cameraError || 'Waiting for camera…')}
                  </div>
                </div>
              </div>
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

          {/* ROUND STAGE — VIDEO CALL */}
          {stage === 'round' && activeQuestion && (
            <div className="max-w-5xl mx-auto">
              <div className="relative overflow-hidden rounded-[2rem] bg-[#0A0E1A] border border-white/5 shadow-2xl">
                {/* ambient glows */}
                <div className="pointer-events-none absolute -top-24 -left-16 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-10 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />

                {/* TOP BAR */}
                <div className="relative z-10 flex items-center gap-3 px-6 py-4 flex-wrap">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1.5 text-rose-400 text-[11px] font-bold tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> REC
                  </span>
                  <span className="text-slate-200 text-xs font-bold tabular-nums">{fmtTime(elapsed)}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-slate-300 text-[11px] font-semibold">
                    {ROUND_META[currentRound].title}
                    <span className="text-slate-500">· Q{currentQuestionIdx + 1}/{currentRoundQuestions.length}</span>
                  </span>
                  <div className="flex-1" />
                  <span className="inline-flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold"><FiWifi size={13} /> Connected</span>
                </div>

                {/* MAIN */}
                <div className="relative z-10 px-6 pb-2 min-h-[300px] flex flex-col items-center justify-center">
                  {/* Aria interviewer tile */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="relative grid place-items-center">
                      {isSpeaking && <span className="absolute inset-0 m-auto w-28 h-28 rounded-full bg-indigo-500/25 animate-ping" />}
                      <div className="relative w-28 h-28 rounded-full grid place-items-center bg-gradient-to-br from-indigo-400 via-violet-500 to-blue-500 shadow-xl">
                        {isSpeaking
                          ? <VoiceWave isActive mode="speaking" color="bg-white" />
                          : <FiUser className="text-white/90" size={44} />}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-century font-bold text-base">{INTERVIEWER.name}</p>
                      <p className="text-slate-400 text-xs font-raleway inline-flex items-center gap-2">
                        {INTERVIEWER.role}
                        {isSpeaking && <span className="text-indigo-300 font-semibold">· speaking</span>}
                        {isListening && <span className="text-emerald-300 font-semibold">· listening</span>}
                      </p>
                    </div>
                  </div>

                  {/* Question badge + text */}
                  <div className="mt-6 text-center max-w-2xl">
                    <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 ${followUpQ ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-300'}`}>
                      {followUpQ ? 'Follow-up' : activeQuestion.type.replace('_', ' ')}
                    </span>
                    <h3 className="font-century text-xl md:text-2xl font-black text-white leading-relaxed">
                      {followUpQ ? followUpQ.question : activeQuestion.question}
                    </h3>
                  </div>

                  {/* MCQ OPTIONS */}
                  {activeQuestion.type === 'mcq' && activeQuestion.options && (
                    <div className="mt-6 w-full max-w-xl grid grid-cols-1 gap-2.5">
                      {activeQuestion.options.map((opt, i) => {
                        const selected = answers[activeQuestion.id] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => setAnswers(prev => ({ ...prev, [activeQuestion.id]: i }))}
                            className={`font-raleway flex items-center gap-3 text-left px-4 py-3 rounded-2xl border transition-all ${selected ? 'border-indigo-400 bg-indigo-500/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400/50'}`}
                          >
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${selected ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-300'}`}>{String.fromCharCode(65 + i)}</span>
                            <span className="text-sm">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Candidate self-view PiP */}
                  <div className="absolute right-5 bottom-3 w-36 md:w-52 aspect-[4/3] rounded-2xl overflow-hidden border border-white/15 bg-slate-900 shadow-xl">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {!cameraOn && (
                      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-700 to-slate-900">
                        <FiVideoOff className="text-slate-400" size={22} />
                      </div>
                    )}
                    <span className="absolute left-2 bottom-1.5 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
                      {isListening ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> : <FiMic size={10} />} You
                    </span>
                  </div>
                </div>

                {/* CAPTIONS */}
                {captionsOn && (
                  <div className="relative z-10 mx-6 mb-3 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 backdrop-blur-sm min-h-[52px] flex items-center">
                    {isSpeaking ? (
                      <p className="font-raleway text-sm text-slate-100"><span className="text-indigo-300 font-bold mr-2">{INTERVIEWER.name}:</span>{followUpQ ? followUpQ.question : activeQuestion.question}</p>
                    ) : transcript ? (
                      <p className="font-raleway text-sm text-slate-200"><span className="text-emerald-300 font-bold mr-2">You:</span>{transcript}</p>
                    ) : isListening ? (
                      <p className="font-raleway text-sm text-slate-400 italic">Listening…</p>
                    ) : (
                      <p className="font-raleway text-sm text-slate-500 italic">{activeQuestion.type === 'mcq' ? 'Select an answer below.' : 'Tap the mic to answer.'}</p>
                    )}
                  </div>
                )}

                {/* CONTROL DOCK */}
                <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-6 pt-1 flex-wrap">
                  <button
                    onClick={() => (activeQuestion.type === 'mcq' ? speakMcq(activeQuestion) : (followUpQ ? speak(followUpQ.question) : speak(activeQuestion.question)))}
                    title="Replay question"
                    className="w-12 h-12 grid place-items-center rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition"
                  >
                    <FiRotateCcw size={20} />
                  </button>

                  {activeQuestion.type !== 'mcq' && (
                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={isSpeaking}
                      aria-label={isListening ? 'Stop answering' : 'Start answering'}
                      className={`w-16 h-16 grid place-items-center rounded-3xl transition shadow-lg ${isListening ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-50`}
                    >
                      {isListening ? <FiSquare size={26} /> : <FiMic size={26} />}
                    </button>
                  )}

                  <button
                    onClick={toggleCamera}
                    aria-label="Toggle camera"
                    title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                    className="w-12 h-12 grid place-items-center rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition"
                  >
                    {cameraOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                  </button>

                  <button
                    onClick={() => setCaptionsOn(v => !v)}
                    aria-label="Toggle captions"
                    aria-pressed={captionsOn}
                    title="Toggle captions"
                    className={`w-12 h-12 grid place-items-center rounded-2xl border transition ${captionsOn ? 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                  >
                    <FiMessageSquare size={20} />
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={awaitingFollowUp || (activeQuestion.type === 'mcq' && answers[activeQuestion.id] === undefined)}
                    className="font-raleway inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-6 h-12 rounded-2xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {awaitingFollowUp ? 'Thinking…' : followUpQ ? 'Continue' : isLastQuestionInRound ? (isLastRound ? 'End interview' : 'Next round') : 'Next'}
                    {!awaitingFollowUp && <FiArrowRight size={16} />}
                  </button>

                  {!(isLastRound && isLastQuestionInRound) && (
                    <button
                      onClick={() => { if (window.confirm('End the interview now and get your evaluation?')) submitInterview(); }}
                      aria-label="End interview"
                      title="End interview"
                      className="w-12 h-12 grid place-items-center rounded-2xl bg-rose-500/90 text-white hover:bg-rose-600 transition"
                    >
                      <FiPhoneOff size={18} />
                    </button>
                  )}
                </div>

                {/* ROUND PROGRESS */}
                <div className="relative z-10 flex justify-center gap-2 pb-6">
                  {currentRoundQuestions.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentQuestionIdx ? 'w-8 bg-indigo-400' : i < currentQuestionIdx ? 'w-4 bg-emerald-400' : 'w-4 bg-white/15'}`} />
                  ))}
                </div>
              </div>

              {/* TYPED-ANSWER FALLBACK (spoken-answer questions only) — Phase 4.3 */}
              {activeQuestion.type !== 'mcq' && (
                <div className="mt-4">
                  {typing ? (
                    <div className="max-w-2xl mx-auto">
                      <textarea
                        value={followUpQ
                          ? (followUpAnswers[followUpQ.parentQuestionId] || '')
                          : ((answers[activeQuestion.id] as string) || '')}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (followUpQ) setFollowUpAnswers(prev => ({ ...prev, [followUpQ.parentQuestionId]: v }));
                          else setAnswers(prev => ({ ...prev, [activeQuestion.id]: v }));
                        }}
                        placeholder="Type your answer here…"
                        className="font-raleway w-full min-h-[90px] bg-white/5 border border-white/15 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 resize-y"
                      />
                      {sttSupported && (
                        <div className="flex justify-end mt-2">
                          <button onClick={() => setTyping(false)} className="text-xs text-slate-400 hover:text-indigo-300 font-raleway underline underline-offset-4">
                            Use voice instead
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <button onClick={() => setTyping(true)} className="text-xs text-slate-400 hover:text-indigo-300 font-raleway underline underline-offset-4">
                        Prefer to type? Enter your answer instead
                      </button>
                    </div>
                  )}
                </div>
              )}
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
            <ResultsStage evaluation={evaluation} questions={questions} answers={answers} onRestart={restart} />
          )}
        </div>
      </main>
    </div>
  );
}
