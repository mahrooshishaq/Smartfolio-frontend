'use client';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VoiceWave from '@/components/VoiceWave';
import { useWebcam } from './useWebcam';
import { ResultsStage } from './ResultsStage';
import { InputStage } from './InputStage';
import {
  FiMic,
  FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiSend, FiArrowLeft, FiUser, FiCpu, FiZap, FiArrowRight,
  FiStar, FiTrendingUp, FiVolume2, FiSquare, FiRotateCcw,
  FiVideo, FiVideoOff, FiPhoneOff, FiMessageSquare, FiWifi, FiX
} from 'react-icons/fi';
import { useSpeech, mcqSpeechText } from './useSpeech';
import type {
  Round, LengthTier, Seniority, PublicQuestion, Evaluation, ProgressPoint, ProgressSummary,
} from './types';
import {
  ROUND_META, ROUND_ORDER, TIER_OPTIONS, SENIORITY_OPTIONS, INTERVIEWER, fmtTime,
} from './constants';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Breather between questions: long enough to reset (and for the next question's
// audio to finish synthesizing in the background), short enough to keep pace.
const REST_SECONDS = 5;

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
  const [confirmEnd, setConfirmEnd] = useState(false); // platform-styled end-interview dialog
  // Rest interstitial after EVERY submit/skip — null when not resting, else
  // seconds left. restMeta says what the card announces (what comes next and
  // whether an answer was saved); restActionRef runs when the countdown ends
  // (or is skipped) for transitions beyond "speak the current question".
  const [restCountdown, setRestCountdown] = useState<number | null>(null);
  const [restMeta, setRestMeta] = useState<{ next: 'question' | 'followup' | 'round' | 'finish'; saved: boolean }>({ next: 'question', saved: true });
  const restActionRef = useRef<(() => void) | null>(null);

  // Errors surface as a toast — auto-dismiss so they never linger over the call.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(t);
  }, [error]);

  // Neural TTS fetcher (Phase 3.4) — hits the backend /tts (Kokoro via Python),
  // returns audio or null so useSpeech falls back to browser TTS. Asks for
  // ogg/opus (~10x smaller than wav) when the browser can play it (Safari can't).
  const neuralTts = useCallback(async (text: string): Promise<Blob | null> => {
    const tok = localStorage.getItem('accessToken');
    if (!tok) return null;
    try {
      const canOgg = document.createElement('audio').canPlayType('audio/ogg; codecs=opus') !== '';
      const res = await fetch(`${API}/mock-interview/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ text, format: canOgg ? 'ogg' : 'wav' }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  }, []);

  // Whisper STT fetcher — sends the recorded answer to the backend (Groq
  // whisper-large-v3), far more accurate than browser recognition for accented
  // English. The current question rides along as a vocabulary hint. Returns
  // null on any failure so useSpeech keeps the browser transcript instead.
  const speechContextRef = useRef('');
  const transcribeAudio = useCallback(async (audio: Blob): Promise<string | null> => {
    const tok = localStorage.getItem('accessToken');
    if (!tok) return null;
    try {
      const ext = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', audio, `answer.${ext}`);
      if (speechContextRef.current) form.append('context', speechContextRef.current.slice(0, 600));
      const res = await fetch(`${API}/mock-interview/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
        body: form,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.text === 'string' ? data.text : null;
    } catch {
      return null;
    }
  }, []);

  // Speech (TTS + STT) — extracted into a hook (Phase 0.3), with neural TTS (Phase 3.4)
  const {
    isSpeaking, isListening, isTranscribing, transcript, transcriptRef, supported: sttSupported,
    speak, speakMcq, prefetchSpeech, preloadLiveCaptions, startListening,
    finalizeListening, resetTranscript,
    cancel: cancelSpeech,
  } = useSpeech(neuralTts, transcribeAudio);

  // Warm the on-device live-caption engine (if enabled) while the call
  // "connects" — the model downloads during the ceremony, not the first answer.
  // round_intro also triggers it to cover resuming a session by URL, which
  // skips the connecting stage. No-op when the feature flag is off.
  useEffect(() => {
    if (stage === 'connecting' || stage === 'round_intro') preloadLiveCaptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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

  const currentRound: Round = ROUND_ORDER[currentRoundIdx];
  const currentRoundQuestions = questions.filter((q) => q.round === currentRound);
  const activeQuestion = currentRoundQuestions[currentQuestionIdx];
  const resting = restCountdown !== null;

  // Keep the Whisper vocabulary hint pointed at whatever is being answered.
  useEffect(() => {
    speechContextRef.current = followUpQ ? followUpQ.question : (activeQuestion?.question ?? '');
  }, [followUpQ, activeQuestion]);

  // Stops the mic, waits for the accurate (Whisper) transcript, and persists it
  // as the answer to whatever is being asked — follow-up or main question.
  const stopListening = async () => {
    const finalTranscript = (await finalizeListening()).trim();
    if (!finalTranscript) return;
    if (followUpQ) {
      setFollowUpAnswers(prev => ({ ...prev, [followUpQ.parentQuestionId]: finalTranscript }));
    } else if (activeQuestion && activeQuestion.type !== 'mcq') {
      setAnswers(prev => ({ ...prev, [activeQuestion.id]: finalTranscript }));
    }
  };

  // ─── FLOW CONTROL ──────────────────────────────────────────────────

  useEffect(() => {
    // Speak when entering round or moving to next question — but not during the
    // rest interstitial; when the countdown clears, this re-fires and speaks
    // whatever is pending: the follow-up if one arrived, else the question.
    if (stage === 'round' && activeQuestion && restCountdown === null) {
      if (followUpQ) {
        speak(followUpQ.question);
      } else if (activeQuestion.type === 'mcq') {
        speakMcq(activeQuestion);
      } else {
        speak(activeQuestion.question);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentQuestionIdx, restCountdown === null]);

  // Every submit/skip flows through here so the pacing is uniform: 5 seconds
  // of rest, then whatever comes next. `action` (round change, final submit)
  // runs when the countdown ends or is skipped; without one, clearing the
  // countdown lets the speak effect narrate the pending question/follow-up.
  const beginRest = (
    next: 'question' | 'followup' | 'round' | 'finish',
    saved: boolean,
    action?: () => void,
  ) => {
    restActionRef.current = action ?? null;
    setRestMeta({ next, saved });
    setRestCountdown(REST_SECONDS);
  };

  const finishRest = () => {
    setRestCountdown(null);
    const action = restActionRef.current;
    restActionRef.current = null;
    if (action) action();
  };

  // True when the stored answer for a question is non-empty (covers spoken/
  // typed text and MCQ indices, where 0 is a valid answer).
  const isAnswered = (map: Record<number, string | number>, q?: PublicQuestion) =>
    !!q && map[q.id] !== undefined && String(map[q.id]).trim() !== '';

  // Tick the rest countdown down to zero, then finish it (running any queued
  // transition). Leaving the round stage abandons the rest AND its action.
  useEffect(() => {
    if (restCountdown === null) return;
    if (stage !== 'round') {
      setRestCountdown(null);
      restActionRef.current = null;
      return;
    }
    if (restCountdown <= 0) { finishRest(); return; }
    const t = setTimeout(() => setRestCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restCountdown, stage]);

  // Latency: while the candidate answers, warm the NEXT question's audio in the
  // background so it starts instantly (server + client cache hit) instead of
  // paying live synthesis between questions. Triggered on the falling edge of
  // isSpeaking, i.e. the moment the interviewer finishes asking.
  const prevSpeakingRef = useRef(false);
  useEffect(() => {
    const justFinishedSpeaking = prevSpeakingRef.current && !isSpeaking;
    prevSpeakingRef.current = isSpeaking;
    if (!justFinishedSpeaking || stage !== 'round') return;
    let next: PublicQuestion | undefined;
    if (currentQuestionIdx < currentRoundQuestions.length - 1) {
      next = currentRoundQuestions[currentQuestionIdx + 1];
    } else if (currentRoundIdx < ROUND_ORDER.length - 1) {
      next = questions.filter((q) => q.round === ROUND_ORDER[currentRoundIdx + 1])[0];
    }
    if (next) prefetchSpeech(next.type === 'mcq' ? mcqSpeechText(next) : next.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking, stage, currentQuestionIdx, currentRoundIdx]);

  // Also warm the round's first question during the intro screen, so even the
  // opening question of each round speaks instantly.
  useEffect(() => {
    if (stage !== 'round_intro') return;
    const first = currentRoundQuestions[0];
    if (first) prefetchSpeech(first.type === 'mcq' ? mcqSpeechText(first) : first.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentRoundIdx]);

  // ─── VIDEO-CALL CEREMONY & TIMER (Phase 3) ─────────────────────────────
  // Connecting sequence: dial → "<interviewer> joined" → into the interview.
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
  // `finalAnswers`/`finalFollowUps` carry answers captured in THIS event tick:
  // setState hasn't flushed yet when the last question submits, so reading the
  // state inside submitInterview would silently drop the final answer.
  const advanceQuestion = (
    finalAnswers: Record<number, string | number> = answers,
    finalFollowUps: Record<number, string> = followUpAnswers,
  ) => {
    if (currentQuestionIdx < currentRoundQuestions.length - 1) {
      const next = currentRoundQuestions[currentQuestionIdx + 1];
      setCurrentQuestionIdx(prev => prev + 1);
      resetTranscript();
      // Rest interstitial: give the candidate a breather while the next
      // question's audio synthesizes in the background — when the countdown
      // ends, the question shows and narrates at the same instant.
      beginRest('question', isAnswered(finalAnswers, activeQuestion));
      if (next) prefetchSpeech(next.type === 'mcq' ? mcqSpeechText(next) : next.question);
    } else {
      goToNextRound(finalAnswers, finalFollowUps);
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

  // Guards against double-advancing: Next can be pressed again while we await
  // the transcription of the recorded answer.
  const advancingRef = useRef(false);

  const handleNext = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      await handleNextInner();
    } finally {
      advancingRef.current = false;
    }
  };

  const handleNextInner = async () => {
    // Finish capturing first: stop the mic and wait for the accurate (Whisper)
    // transcript — or the browser transcript if transcription is unavailable.
    const spoken = (isListening || isTranscribing)
      ? (await finalizeListening()).trim()
      : transcriptRef.current.trim();

    // The candidate's answer is whatever they said (latest transcript) or, if
    // they used the typed fallback, whatever they typed — voice wins if both.
    const typedValue = followUpQ
      ? (followUpAnswers[followUpQ.parentQuestionId] || '')
      : (activeQuestion && typeof answers[activeQuestion.id] === 'string' ? (answers[activeQuestion.id] as string) : '');
    const currentAnswer = spoken || typedValue.trim();

    // We are currently answering a follow-up → store its answer, then advance.
    // The updated map is passed down explicitly so a follow-up answered on the
    // LAST question still reaches submitInterview (setState hasn't flushed yet).
    if (followUpQ) {
      const updatedFollowUps = currentAnswer
        ? { ...followUpAnswers, [followUpQ.parentQuestionId]: currentAnswer }
        : followUpAnswers;
      if (currentAnswer) setFollowUpAnswers(updatedFollowUps);
      setFollowUpQ(null);
      advanceQuestion(answers, updatedFollowUps);
      return;
    }

    // Save current answer (MCQ answers are stored on click) — again passing the
    // fresh map down so the final question's answer is never dropped on submit.
    const updatedAnswers =
      currentAnswer && activeQuestion && activeQuestion.type !== 'mcq'
        ? { ...answers, [activeQuestion.id]: currentAnswer }
        : answers;
    if (updatedAnswers !== answers) {
      setAnswers(updatedAnswers);
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
      const fu = await fetchFollowUp(activeQuestion.id, currentAnswer);
      setAwaitingFollowUp(false);
      if (fu) {
        setFollowUpQ({ parentQuestionId: activeQuestion.id, question: fu });
        resetTranscript();
        // Same breather as between questions — and the pause covers the
        // follow-up's TTS synthesis, so it narrates the moment it appears.
        // A follow-up only happens on a non-empty answer, so saved is true.
        beginRest('followup', true);
        prefetchSpeech(fu);
        return; // stay on this screen; the follow-up shows once the rest ends
      }
    }

    advanceQuestion(updatedAnswers);
  };

  const goToNextRound = (
    finalAnswers: Record<number, string | number> = answers,
    finalFollowUps: Record<number, string> = followUpAnswers,
  ) => {
    // Round boundaries get the same breather as every other submit/skip —
    // the queued action fires when the countdown ends (or is skipped).
    const saved = isAnswered(finalAnswers, activeQuestion);
    if (currentRoundIdx < ROUND_ORDER.length - 1) {
      beginRest('round', saved, () => {
        setCurrentRoundIdx(currentRoundIdx + 1);
        setCurrentQuestionIdx(0);
        resetTranscript();
        setError('');
        setStage('round_intro');
      });
    } else {
      beginRest('finish', saved, () => submitInterview(finalAnswers, finalFollowUps));
    }
  };

  const submitInterview = async (
    finalAnswers: Record<number, string | number> = answers,
    finalFollowUps: Record<number, string> = followUpAnswers,
  ) => {
    if (!token || !sessionId) return;
    setStage('evaluating');
    setError('');
    try {
      const payload = questions.map((q) => ({ questionId: q.id, answer: finalAnswers[q.id] ?? '' }));
      const followUpPayload = Object.entries(finalFollowUps).map(([parentQuestionId, answer]) => ({
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
      console.warn('Submit failed:', err);
      setError('We couldn’t submit your interview — please press Next or the end button to try again.');
      setStage('round');
    }
  };

  const restart = () => {
    cancelSpeech(); // stops neural audio (and any queued chunks), not just browser TTS
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
    setRestCountdown(null);
    restActionRef.current = null;
    stopCamera();
    setElapsed(0);
    setCaptionsOn(true);
    setConnectPhase('dialing');
  };


  const isLastQuestionInRound = currentQuestionIdx === currentRoundQuestions.length - 1;
  const isLastRound = currentRoundIdx === ROUND_ORDER.length - 1;

  // True once the current question has an answer on record — spoken transcript,
  // typed text, or MCQ selection.
  const hasAnswer = !!activeQuestion && (
    followUpQ
      ? !!(transcript.trim() || (followUpAnswers[followUpQ.parentQuestionId] || '').trim())
      : activeQuestion.type === 'mcq'
        ? answers[activeQuestion.id] !== undefined
        : !!(transcript.trim() || (typeof answers[activeQuestion.id] === 'string' && (answers[activeQuestion.id] as string).trim()))
  );
  // …and nobody is talking — the moment to guide the candidate to submit.
  const answerReady = hasAnswer && !isSpeaking && !isListening && !isTranscribing && !awaitingFollowUp;

  // The advance button says exactly what pressing it does with the current
  // answer state — "Submit" when an answer will be recorded, "Skip" when
  // nothing has been captured — so there's never doubt whether an answer
  // made it in.
  const advanceLabel = awaitingFollowUp ? 'Thinking…'
    : isTranscribing ? 'Processing…'
    : activeQuestion?.type === 'mcq' && !followUpQ && answers[activeQuestion.id] === undefined ? 'Select an option'
    : followUpQ ? (hasAnswer ? 'Submit answer' : 'Skip follow-up')
    : hasAnswer
      ? (isLastQuestionInRound ? (isLastRound ? 'Submit & end interview' : 'Submit & next round') : 'Submit answer')
      : (isLastQuestionInRound ? (isLastRound ? 'Skip & end interview' : 'Skip & next round') : 'Skip question');

  return (
    <div>
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

          {/* Platform toast — replaces raw banner/browser alerts; dismissible + auto-hides */}
          {error && (
            <div role="alert" className="fixed top-6 right-6 z-[60] w-[min(24rem,calc(100vw-3rem))] rounded-2xl bg-white border border-red-100 shadow-xl px-4 py-3.5 flex items-start gap-3">
              <span className="mt-0.5 w-8 h-8 grid place-items-center rounded-xl bg-red-50 text-red-500 flex-shrink-0"><FiAlertCircle size={16} /></span>
              <p className="font-raleway flex-1 text-sm text-slate-700 leading-snug">{error}</p>
              <button onClick={() => setError('')} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600 transition"><FiX size={16} /></button>
            </div>
          )}

          {/* End-interview confirm — platform-styled, replaces window.confirm */}
          {confirmEnd && (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
              <div role="dialog" aria-modal="true" aria-label="End interview" className="w-full max-w-sm rounded-3xl bg-[#0F1424] border border-white/10 p-6 shadow-2xl text-center">
                <div className="mx-auto mb-3 w-12 h-12 grid place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><FiPhoneOff size={22} /></div>
                <h4 className="font-century text-white font-bold text-lg">End the interview?</h4>
                <p className="font-raleway text-slate-400 text-sm mt-1.5">
                  You&apos;ll get your evaluation right away. Questions you haven&apos;t answered will be scored as skipped.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setConfirmEnd(false)}
                    className="font-raleway flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-slate-200 font-semibold text-sm hover:bg-white/10 transition"
                  >
                    Keep going
                  </button>
                  <button
                    onClick={async () => {
                      setConfirmEnd(false);
                      cancelSpeech();
                      // Include whatever the candidate said on the current question
                      // before ending — don't throw away an in-flight answer. Waits
                      // for the accurate transcript if one is still being produced.
                      const inFlight = (isListening || isTranscribing)
                        ? (await finalizeListening()).trim()
                        : transcriptRef.current.trim();
                      if (followUpQ && inFlight) {
                        submitInterview(answers, { ...followUpAnswers, [followUpQ.parentQuestionId]: inFlight });
                      } else {
                        submitInterview(
                          activeQuestion && activeQuestion.type !== 'mcq' && inFlight
                            ? { ...answers, [activeQuestion.id]: inFlight }
                            : answers,
                        );
                      }
                    }}
                    className="font-raleway flex-1 h-11 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition"
                  >
                    End &amp; evaluate
                  </button>
                </div>
              </div>
            </div>
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
                  {/* Interviewer tile */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="relative grid place-items-center">
                      {isSpeaking && <span className="absolute inset-0 m-auto w-28 h-28 rounded-full bg-indigo-500/25 animate-ping" />}
                      {/* overflow-hidden keeps the equalizer bars clipped inside the
                          circle — without it they spill past the tile edges */}
                      <div className="relative w-28 h-28 rounded-full overflow-hidden grid place-items-center bg-gradient-to-br from-indigo-400 via-violet-500 to-blue-500 shadow-xl">
                        {isSpeaking
                          ? <span className="scale-75 grid place-items-center"><VoiceWave isActive mode="speaking" color="bg-white" /></span>
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

                  {/* REST INTERSTITIAL — a breather between questions while the
                      next question's audio synthesizes in the background */}
                  {resting && (
                    <div className="mt-6 text-center max-w-2xl flex flex-col items-center">
                      <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 ${restMeta.saved ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>
                        {restMeta.saved ? 'Answer saved' : 'Question skipped'}
                      </span>
                      <div className="relative grid place-items-center mb-4">
                        <span className="absolute w-20 h-20 rounded-full bg-indigo-500/20 animate-ping" />
                        <div className="relative w-20 h-20 rounded-full grid place-items-center bg-white/5 border border-white/15">
                          <span className="font-century text-3xl font-black text-white tabular-nums">{restCountdown}</span>
                        </div>
                      </div>
                      <h3 className="font-century text-xl font-black text-white">
                        {restMeta.next === 'finish' ? 'That was the last question!' : 'Take a moment to rest'}
                      </h3>
                      <p className="font-raleway text-sm text-slate-400 mt-1.5">
                        {restMeta.next === 'followup' ? <>Follow-up question in {restCountdown}s — {INTERVIEWER.name} is preparing it</>
                          : restMeta.next === 'round' ? <>Round complete — next round in {restCountdown}s</>
                          : restMeta.next === 'finish' ? <>Your evaluation starts in {restCountdown}s</>
                          : <>Next question in {restCountdown}s — {INTERVIEWER.name} is preparing it</>}
                      </p>
                      <button
                        onClick={finishRest}
                        className="font-raleway mt-4 text-xs text-slate-400 hover:text-indigo-300 underline underline-offset-4"
                      >
                        I&apos;m ready — skip the wait
                      </button>
                    </div>
                  )}

                  {/* Question badge + text */}
                  {!resting && (
                  <div className="mt-6 text-center max-w-2xl">
                    <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 ${followUpQ ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-300'}`}>
                      {followUpQ ? 'Follow-up' : activeQuestion.type.replace('_', ' ')}
                    </span>
                    <h3 className="font-century text-xl md:text-2xl font-black text-white leading-relaxed">
                      {followUpQ ? followUpQ.question : activeQuestion.question}
                    </h3>
                  </div>
                  )}

                  {/* MCQ OPTIONS */}
                  {!resting && activeQuestion.type === 'mcq' && activeQuestion.options && (
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

                  {/* Candidate self-view PiP — anchored top-right beside the interviewer
                      tile row, where nothing else renders, so it never covers the
                      question text (which is centered lower and can grow long). */}
                  <div className="absolute right-4 top-2 w-32 md:w-48 aspect-[4/3] rounded-2xl overflow-hidden border border-white/15 bg-slate-900 shadow-xl">
                    {/* scale-x-[-1] mirrors the self-view like every video-call app —
                        without it your movements appear reversed and feel wrong */}
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
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
                {captionsOn && !resting && (
                  <div className="relative z-10 mx-6 mb-3 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 backdrop-blur-sm min-h-[52px] flex items-center">
                    {isSpeaking ? (
                      <p className="font-raleway text-sm text-slate-100"><span className="text-indigo-300 font-bold mr-2">{INTERVIEWER.name}:</span>{followUpQ ? followUpQ.question : activeQuestion.question}</p>
                    ) : transcript ? (
                      <p className="font-raleway text-sm text-slate-200">
                        <span className="text-emerald-300 font-bold mr-2">You:</span>{transcript}
                        {isTranscribing && <span className="text-slate-400 italic ml-2">refining…</span>}
                      </p>
                    ) : isTranscribing ? (
                      <p className="font-raleway text-sm text-slate-400 italic">Transcribing your answer…</p>
                    ) : isListening ? (
                      <p className="font-raleway text-sm text-slate-400 italic">Listening…</p>
                    ) : (
                      <p className="font-raleway text-sm text-slate-500 italic">{activeQuestion.type === 'mcq' ? 'Select an answer below.' : 'Tap the mic to answer.'}</p>
                    )}
                  </div>
                )}

                {/* TURN GUIDE — one always-visible line that says whose turn it is and what to do */}
                {!resting && (
                <div className="relative z-10 text-center px-6 pb-2">
                  <span className={`font-raleway inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3.5 py-1.5 border ${
                    awaitingFollowUp ? 'text-indigo-300 bg-indigo-500/10 border-indigo-400/30'
                    : isSpeaking ? 'text-indigo-300 bg-indigo-500/10 border-indigo-400/30'
                    : isListening ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30'
                    : isTranscribing ? 'text-indigo-300 bg-indigo-500/10 border-indigo-400/30'
                    : answerReady ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30'
                    : 'text-slate-400 bg-white/5 border-white/10'
                  }`}>
                    {awaitingFollowUp ? <>{INTERVIEWER.name} is thinking…</>
                      : isSpeaking ? <><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />{INTERVIEWER.name} is asking — listen…</>
                      : isListening ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Your turn — speak freely; press stop when you&apos;re done</>
                      : isTranscribing ? <><FiLoader size={13} className="animate-spin" />Processing your answer…</>
                      : answerReady ? <><FiCheckCircle size={13} className="text-emerald-400" />Answer captured — press &ldquo;Submit answer&rdquo; when you&apos;re happy with it</>
                      : activeQuestion.type === 'mcq' ? <>Pick an option, then press &ldquo;Submit answer&rdquo;</>
                      : <>Mic is off — tap the mic to speak, type below, or skip the question</>}
                  </span>
                </div>
                )}

                {/* CONTROL DOCK */}
                {!resting && (
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
                    disabled={awaitingFollowUp || (activeQuestion.type === 'mcq' && !followUpQ && answers[activeQuestion.id] === undefined)}
                    className={`font-raleway inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-6 h-12 rounded-2xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${answerReady ? 'ring-4 ring-emerald-400/50' : ''}`}
                  >
                    {advanceLabel}
                    {!awaitingFollowUp && (
                      isTranscribing ? <FiLoader className="animate-spin" size={16} />
                      : hasAnswer ? <FiSend size={16} />
                      : <FiArrowRight size={16} />
                    )}
                  </button>

                  {!(isLastRound && isLastQuestionInRound) && (
                    <button
                      onClick={() => setConfirmEnd(true)}
                      aria-label="End interview"
                      title="End interview"
                      className="w-12 h-12 grid place-items-center rounded-2xl bg-rose-500/90 text-white hover:bg-rose-600 transition"
                    >
                      <FiPhoneOff size={18} />
                    </button>
                  )}
                </div>
                )}

                {/* ROUND PROGRESS */}
                <div className="relative z-10 flex justify-center gap-2 pb-6">
                  {currentRoundQuestions.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentQuestionIdx ? 'w-8 bg-indigo-400' : i < currentQuestionIdx ? 'w-4 bg-emerald-400' : 'w-4 bg-white/15'}`} />
                  ))}
                </div>
              </div>

              {/* TYPED-ANSWER FALLBACK (spoken-answer questions only) — Phase 4.3 */}
              {!resting && activeQuestion.type !== 'mcq' && (
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
                        className="font-raleway w-full min-h-[90px] bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
                      />
                      <div className="flex items-center justify-between gap-3 mt-2">
                        {sttSupported ? (
                          <button onClick={() => setTyping(false)} className="text-xs text-slate-400 hover:text-indigo-300 font-raleway underline underline-offset-4">
                            Use voice instead
                          </button>
                        ) : <span />}
                        <button
                          onClick={handleNext}
                          disabled={awaitingFollowUp}
                          className="font-raleway inline-flex items-center gap-2 bg-[#4F46E5] text-white hover:bg-indigo-700 px-5 h-10 rounded-xl font-bold text-xs transition disabled:opacity-40"
                        >
                          Submit answer <FiArrowRight size={14} />
                        </button>
                      </div>
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
  );
}
