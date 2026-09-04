'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { MockInterviewSkeleton } from '@/components/SkeletonScreens';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ResultsStage } from './ResultsStage';
import { InputStage } from './InputStage';
import {
  FiMic,
  FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle,
  FiRefreshCw, FiSend, FiArrowLeft, FiUser, FiCpu, FiZap, FiArrowRight,
  FiStar, FiTrendingUp, FiVolume2, FiSquare, FiRotateCcw,
  FiPhoneOff, FiMessageSquare, FiX, FiClock
} from 'react-icons/fi';
import { useSpeech, mcqSpeechText } from './useSpeech';
import { InterviewerTile } from './InterviewerTile';
import type {
  Round, LengthTier, Seniority, PublicQuestion, Evaluation, ProgressPoint, ProgressSummary,
} from './types';
import {
  ROUND_META, ROUND_ORDER, TIER_OPTIONS, SENIORITY_OPTIONS, INTERVIEWER, fmtTime,
  PER_QUESTION_SECONDS, FOLLOW_UP_SECONDS,
} from './constants';
import { useAppChrome } from '@/components/app-shell/AppShell';

import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { peekJobHandoff, clearJobHandoff, HANDOFF_PARAM, type JobHandoff } from '@/lib/job-handoff';
import {
  peekCampaignInterview,
  clearCampaignInterview,
  recordCampaignInterview,
  CAMPAIGN_PARAM,
  type CampaignInterviewHandoff,
} from '@/lib/campaign-interview';

// Breather between questions: long enough to reset (and for the next question's
// audio to finish synthesizing in the background), short enough to keep pace.
const REST_SECONDS = 5;

// Per-question timer feature flag (Phase 1.4) — on by default; set
// NEXT_PUBLIC_QUESTION_TIMER=off to disable without a code change.
const QUESTION_TIMER_ENABLED = process.env.NEXT_PUBLIC_QUESTION_TIMER !== 'off';
// Soft warning threshold — color/label change only (reduced-motion safe).
const TIMER_WARN_SECONDS = 10;
// Never hold the question reveal on audio longer than this — if synthesis is
// this slow the voice will just start late rather than stalling the interview.
const REST_HOLD_MAX_MS = 10_000;

/**
 * What an employer's interview is set to.
 *
 * The thorough tier, always. A campaign interview is an assessment several
 * people will be compared on, so it cannot be something each candidate picks
 * the length of — a five-question Quick Screen and a fifteen-question full
 * interview do not produce scores that belong in the same ranked list.
 */
const CAMPAIGN_LENGTH_TIER: LengthTier = 'full';

export default function MockInterviewPage() {
  return (
    <Suspense fallback={<MockInterviewSkeleton />}>
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
  // Set when the user arrived from a job card — names the posting in the form so
  // they can see which job the pre-filled description belongs to.
  const [prefilledFrom, setPrefilledFrom] = useState<JobHandoff | null>(null);
  // Set when this interview was opened from a campaign invitation, so the
  // finished session can be attached back to it.
  const [campaignInterview, setCampaignInterview] = useState<CampaignInterviewHandoff | null>(null);
  // One-shot guard: the auto-start effect must never fire twice, or a candidate
  // gets two sessions and the second overwrites the first.
  const campaignAutoStarted = useRef(false);
  // Whether the finished interview was successfully attached to its invitation.
  // null while unknown; false means the answers are safely scored but the link
  // back to the campaign row did not stick, which the candidate must not be
  // asked to worry about — an operator can still find the session.
  const [campaignLinked, setCampaignLinked] = useState<boolean | null>(null);
  // Reading the handoff destroys it, and StrictMode runs effects twice in dev —
  // without this the second pass would find an empty stash and the job would
  // silently fail to load.
  const prefillConsumed = useRef(false);
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

  // Voice-call experience.
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
  const [restMeta, setRestMeta] = useState<{ next: 'start' | 'question' | 'followup' | 'round' | 'finish'; saved: boolean }>({ next: 'question', saved: true });
  const restActionRef = useRef<(() => void) | null>(null);
  // True while the rest countdown has finished but we're holding the reveal
  // until the next question's first audio chunk is ready — so the question
  // text and the voice always start together.
  const [restHolding, setRestHolding] = useState(false);
  // Per-question countdown (Phase 1.4) — seconds left in the answer window,
  // null when the timer is idle (flag off, resting, or between questions).
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);

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
      const res = await apiFetch(`/mock-interview/tts`, {
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
      const res = await apiFetch(`/mock-interview/transcribe`, {
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
    speak, speakMcq, prefetchSpeech, waitForSpeechReady, preloadLiveCaptions, startListening,
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
    apiFetch(`/mock-interview/progress`, { headers: { Authorization: `Bearer ${tok}` } })
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
      return;
    }

    // Arrived from "Practice this interview" on a job card: the posting is
    // waiting in sessionStorage. Reading it consumes it, so a later visit or a
    // reload starts from a clean form rather than silently repeating a job the
    // user has moved on from.
    // Read without consuming, and leave the URL flag alone: this component sits
    // inside a Suspense boundary, and a remount after hydration used to find an
    // empty stash and a stripped URL, silently wiping the description. The ref
    // only stops the prefill overwriting the user's own edits.
    if (searchParams.get(HANDOFF_PARAM) === 'interview' && !prefillConsumed.current) {
      const prefill = peekJobHandoff('interview');
      if (prefill) {
        prefillConsumed.current = true;
        setJobDescription(prefill.description);
        setPrefilledFrom(prefill);
      }
    }

    // A campaign invitation carries the same description, plus the token saying
    // which invitation this interview is for. Read without consuming, for the
    // same remount reason as above.
    if (searchParams.get(CAMPAIGN_PARAM) === '1' && !prefillConsumed.current) {
      const campaign = peekCampaignInterview();
      if (campaign) {
        prefillConsumed.current = true;
        setJobDescription(campaign.jobDescription);
        setCampaignInterview(campaign);
      } else {
        // The flag says "an employer's interview is waiting" but the handoff is
        // gone — a cleared session, a bookmarked URL, a different tab. Falling
        // through would drop them on the practice form with an empty box, which
        // reads as "your interview vanished". Send them where it actually lives.
        router.replace('/interviews?resume=1');
      }
    }
  }, [router, searchParams]);

  /**
   * A campaign interview starts itself.
   *
   * The invitation gate already asked "ready?" and the candidate already
   * pressed start. Landing them on the practice form — job description in a
   * text box, three interview lengths to choose from, a seniority picker —
   * asked the question twice and, worse, handed the candidate control over an
   * assessment an employer is going to read. Someone could sit a five-question
   * Quick Screen for a role that was advertised to them as a full interview.
   *
   * So the configuration is a prescription, not a choice: the thorough tier,
   * the frozen description from the invitation, and their CV. Nothing to
   * decide, nothing to get wrong, and the same interview for every candidate on
   * the campaign — which is the only way the scores mean anything next to each
   * other.
   */
  useEffect(() => {
    if (!campaignInterview || !token) return;
    if (campaignAutoStarted.current) return;
    if (stage !== 'input') return;
    campaignAutoStarted.current = true;
    void generateTest({
      jobDescription: campaignInterview.jobDescription,
      lengthTier: CAMPAIGN_LENGTH_TIER,
      useResume: true,
    });
    // generateTest is stable enough for this one-shot: the ref guarantees it
    // runs once, and re-running on every render would start the interview again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignInterview, token, stage]);

  const fetchSessionDetail = async (accessToken: string, sid: string) => {
    setStage('loading');
    try {
      const res = await apiFetch(`/mock-interview/${sid}`, {
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
    next: 'start' | 'question' | 'followup' | 'round' | 'finish',
    saved: boolean,
    action?: () => void,
  ) => {
    restActionRef.current = action ?? null;
    setRestMeta({ next, saved });
    setRestCountdown(REST_SECONDS);
  };

  const finishRest = () => {
    setRestHolding(false);
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
      setRestHolding(false);
      restActionRef.current = null;
      return;
    }
    if (restCountdown <= 0) {
      // The countdown is a blind timer, but the reveal is not: when the next
      // thing to narrate is a question/follow-up, hold here until its first
      // audio chunk is ready (capped) so text and voice start together.
      // Round/finish transitions leave this screen — nothing to gate.
      const gateText =
        restMeta.next === 'followup' && followUpQ ? followUpQ.question
        : (restMeta.next === 'question' || restMeta.next === 'start') && activeQuestion
          ? (activeQuestion.type === 'mcq' ? mcqSpeechText(activeQuestion) : activeQuestion.question)
          : '';
      if (!gateText) { finishRest(); return; }
      let cancelled = false;
      setRestHolding(true);
      Promise.race([
        waitForSpeechReady(gateText),
        new Promise((r) => setTimeout(r, REST_HOLD_MAX_MS)),
      ]).then(() => { if (!cancelled) finishRest(); });
      return () => { cancelled = true; };
    }
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

  // Full-screen call on mobile: hide the shell's top bar and tab bar while live.
  const { setImmersive } = useAppChrome();
  useEffect(() => {
    const inCall = stage === 'connecting' || stage === 'round_intro' || stage === 'round';
    setImmersive(inCall);
    return () => setImmersive(false);
  }, [stage, setImmersive]);

  // Reset the typed-answer fallback per question; default it ON when STT is unsupported (Phase 4.3).
  useEffect(() => {
    setTyping(!sttSupported);
  }, [currentQuestionIdx, currentRoundIdx, followUpQ, sttSupported]);

  /**
   * `overrides` exists for the campaign auto-start.
   *
   * A campaign interview is prescribed rather than configured, and it starts
   * itself the moment the candidate arrives. Setting the state and then calling
   * this in the same tick would read the PREVIOUS render's values — the default
   * tier and an empty description — so the prescription is passed explicitly
   * instead of being routed through state it cannot see yet.
   */
  const generateTest = async (overrides?: {
    jobDescription?: string;
    lengthTier?: LengthTier;
    useResume?: boolean;
  }) => {
    if (!token) return;
    const jd = overrides?.jobDescription ?? jobDescription;
    const tier = overrides?.lengthTier ?? lengthTier;
    const withResume = overrides?.useResume ?? useResume;
    if (jd.trim().length < 20) {
      setError('Job description must be at least 20 characters.');
      return;
    }
    // The carried job has done its work — drop it so coming back here later
    // starts clean rather than re-prefilling a finished interview.
    clearJobHandoff('interview');
    setStage('loading');
    setError('');
    try {
      const res = await apiFetch(`/mock-interview/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jobDescription: jd,
          lengthTier: tier,
          useResume: withResume,
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
      // Warm the very first question's audio NOW — the connect ceremony and
      // round intro give synthesis a long head start, so the opening question
      // speaks the moment it appears instead of paying cold-start latency.
      const firstQ = (data.questions as PublicQuestion[]).filter((q) => q.round === ROUND_ORDER[0])[0];
      if (firstQ) prefetchSpeech(firstQ.type === 'mcq' ? mcqSpeechText(firstQ) : firstQ.question);
      setStage('connecting');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStage('input');
    }
  };

  // Entering a round drops straight into the call stage behind a "starting
  // in 5…" countdown card — the same rest interstitial (and its audio gate)
  // used between questions, so the first question's TTS synthesizes during
  // the countdown and its text and voice start together.
  const startCurrentRound = () => {
    setError('');
    setCurrentQuestionIdx(0);
    setStage('round');
    beginRest('start', true);
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
      const res = await apiFetch(`/mock-interview/follow-up`, {
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
    // The candidate has moved on — cut off any narration still playing, or it
    // would keep talking over the rest screen and into the next question.
    cancelSpeech();
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

  // ─── PER-QUESTION TIMER (Phase 1.4, flag default ON) ─────────────────────
  // Arm the answer window whenever a new question or follow-up is revealed.
  // The budget comes from the question type (mirrors TIER_CONFIG on the
  // backend); follow-ups get a fixed short window.
  useEffect(() => {
    if (!QUESTION_TIMER_ENABLED || stage !== 'round' || resting || !activeQuestion) {
      setQuestionTimeLeft(null);
      return;
    }
    setQuestionTimeLeft(followUpQ ? FOLLOW_UP_SECONDS : PER_QUESTION_SECONDS[activeQuestion.type]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, resting, currentRoundIdx, currentQuestionIdx, followUpQ, activeQuestion?.id]);

  // Tick the window down — but only while it is actually the candidate's
  // turn: paused while the interviewer speaks, while a follow-up is being
  // fetched, and while an answer is transcribing. On expiry, auto-save and
  // advance via handleNext, which finalizes the mic and keeps whatever the
  // candidate said — the clock never discards an answer.
  useEffect(() => {
    if (!QUESTION_TIMER_ENABLED || stage !== 'round' || resting || questionTimeLeft === null) return;
    if (isSpeaking || isTranscribing || awaitingFollowUp) return;
    if (questionTimeLeft <= 0) {
      setQuestionTimeLeft(null);
      void handleNext();
      return;
    }
    const t = setTimeout(() => setQuestionTimeLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimeLeft, stage, resting, isSpeaking, isTranscribing, awaitingFollowUp]);

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
      const res = await apiFetch(`/mock-interview/submit`, {
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

      // Attach it to the invitation, if this interview came from one. Their
      // answers are already submitted and scored by this point, so a failure
      // here is logged rather than surfaced — it must not read to a candidate
      // as though the interview did not count.
      if (campaignInterview && sessionId) {
        const linked = await recordCampaignInterview(campaignInterview, sessionId, apiFetch);
        // Only the stashed handoff is cleared, never `campaignInterview` itself.
        // Nulling the state here wiped the employer's name off the screen at the
        // exact moment the results appeared, so the page the candidate finished
        // on called itself a Mock Interview and said nothing about the
        // application it had just been submitted to.
        clearCampaignInterview();
        setCampaignLinked(linked);
        if (!linked) {
          console.warn('Could not attach this interview to its campaign invitation.');
        }
      }
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
    setRestHolding(false);
    setQuestionTimeLeft(null);
    restActionRef.current = null;
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              {/* Calling an employer's interview a "Mock Interview" is not a
                  cosmetic slip — a candidate who believes it is practice does
                  not treat it as the thing their application rests on. */}
              {campaignInterview ? (
                <>
                  <span
                    className="font-raleway inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-600"
                    data-testid="campaign-interview-badge"
                  >
                    Employer interview
                  </span>
                  <h2 className="font-century mt-2 text-2xl font-black text-slate-800 md:text-3xl">
                    {campaignInterview.role}
                  </h2>
                  <p className="font-raleway mt-1 text-sm text-gray-400">
                    {campaignInterview.company}
                    {stage === 'round' &&
                      ` — question ${currentQuestionIdx + 1} of ${currentRoundQuestions.length}, ${ROUND_META[currentRound].title}`}
                    {stage === 'round_intro' && ` — round ${currentRoundIdx + 1} of ${ROUND_ORDER.length}`}
                    {stage === 'loading' && ' — preparing your questions…'}
                    {stage === 'results' && ' — your answers have been sent'}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Mock Interview</h2>
                  <p className="font-raleway text-sm text-gray-400 mt-1">
                    {stage === 'input' && 'Paste a job description to start a 3-round mock interview'}
                    {stage === 'connecting' && 'Connecting you to your interviewer…'}
                    {stage === 'round_intro' && `Get ready for Round ${currentRoundIdx + 1} of ${ROUND_ORDER.length}`}
                    {stage === 'round' && `Question ${currentQuestionIdx + 1} of ${currentRoundQuestions.length} — ${ROUND_META[currentRound].title}`}
                    {stage === 'results' && 'Your full interview evaluation'}
                  </p>
                </>
              )}
            </div>
            {/* No "Start Over" on an employer's interview. It is one sitting,
                which the invitation said, and a restart would either hand
                somebody a second attempt at an assessment or — worse — look
                like one and lose the answers already recorded. */}
            {!campaignInterview &&
              stage !== 'input' &&
              stage !== 'loading' &&
              stage !== 'evaluating' && (
                <button onClick={restart} className="font-raleway flex items-center gap-2 self-start py-2 text-sm text-gray-400 hover:text-slate-600 transition-colors">
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
              <div role="dialog" aria-modal="true" aria-label="End interview" className="w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl text-center">
                <div className="mx-auto mb-3 w-12 h-12 grid place-items-center rounded-2xl bg-rose-500/15 text-rose-400"><FiPhoneOff size={22} /></div>
                <h4 className="font-century text-slate-800 font-bold text-lg">End the interview?</h4>
                <p className="font-raleway text-slate-400 text-sm mt-1.5">
                  You&apos;ll get your evaluation right away. Questions you haven&apos;t answered will be scored as skipped.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setConfirmEnd(false)}
                    className="font-raleway flex-1 h-11 rounded-2xl border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
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
              onStart={() => generateTest()}
              sttSupported={sttSupported}
              progress={progress}
              prefilledFrom={prefilledFrom}
              onClearPrefill={() => { clearJobHandoff('interview'); setPrefilledFrom(null); setJobDescription(''); }}
            />
          )}

          {/* LOADING STAGE */}
          {stage === 'loading' && (
            <MockInterviewSkeleton />
          )}

          {/* CONNECTING (call ceremony) */}
          {stage === 'connecting' && (
            <div className="max-w-4xl mx-auto">
              <div className="relative overflow-hidden rounded-[2rem] border border-violet-100 bg-white/90 p-8 text-center shadow-sm md:p-14">
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative mb-6 grid place-items-center">
                    {connectPhase === 'dialing' && <span className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-blue-300/25 animate-ping" />}
                    <div className="relative w-24 h-24 rounded-full grid place-items-center sf-primary shadow-lg">
                      <FiUser className="text-white" size={40} />
                    </div>
                  </div>
                  <p className="font-century text-2xl font-black text-slate-800 mb-2">
                    {connectPhase === 'dialing' ? `Connecting to ${INTERVIEWER.name}…` : `${INTERVIEWER.name} has joined`}
                  </p>
                  <p className="font-raleway text-sm text-slate-500">
                    {connectPhase === 'dialing' ? 'Setting up your voice interview' : 'Your interview is about to begin'}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                    <FiMic size={14} /> Voice-only session
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ROUND INTRO STAGE */}
          {stage === 'round_intro' && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 md:p-12 text-center">
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
              <div className="relative overflow-hidden rounded-[2rem] border border-violet-100 bg-gradient-to-br from-white via-[#fbfaff] to-blue-50/60 shadow-sm">

                {/* TOP BAR */}
                <div className="relative z-10 flex items-center gap-3 px-6 py-4 flex-wrap">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1.5 text-rose-400 text-[11px] font-bold tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> REC
                  </span>
                  <span className="text-slate-600 text-xs font-bold tabular-nums">{fmtTime(elapsed)}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-slate-100 px-3 py-1.5 text-slate-600 text-[11px] font-semibold">
                    {ROUND_META[currentRound].title}
                    <span className="text-slate-500">· Q{currentQuestionIdx + 1}/{currentRoundQuestions.length}</span>
                  </span>
                  {QUESTION_TIMER_ENABLED && !resting && questionTimeLeft !== null && (
                    <span
                      role="timer"
                      aria-label="Time left to answer"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tabular-nums border ${
                        questionTimeLeft <= TIMER_WARN_SECONDS
                          ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                          : 'bg-white/80 border-slate-100 text-slate-600'
                      }`}
                    >
                      <FiClock size={12} /> {fmtTime(Math.max(0, questionTimeLeft))}
                      {questionTimeLeft <= TIMER_WARN_SECONDS && <span className="font-semibold">· wrap up</span>}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold"><FiVolume2 size={13} /> Voice connected</span>
                </div>

                {/* MAIN */}
                <div className="relative z-10 px-6 pb-2 min-h-[300px] flex flex-col items-center justify-center">
                  {/* Interviewer tile */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <InterviewerTile style="orb" isSpeaking={isSpeaking} />
                    <div className="text-center">
                      <p className="text-slate-800 font-century font-bold text-base">{INTERVIEWER.name}</p>
                      <p className="text-slate-500 text-xs font-raleway inline-flex items-center gap-2">
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
                      <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 ${restMeta.next === 'start' ? 'bg-blue-50 text-blue-700' : restMeta.saved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {restMeta.next === 'start' ? `Round ${currentRoundIdx + 1} · ${ROUND_META[currentRound].title}` : restMeta.saved ? 'Answer saved' : 'Question skipped'}
                      </span>
                      <div className="relative grid place-items-center mb-4">
                        <span className="absolute w-20 h-20 rounded-full bg-indigo-500/20 animate-ping" />
                        <div className="relative w-20 h-20 rounded-full grid place-items-center bg-white border border-blue-100">
                          <span className="font-century text-3xl font-black text-slate-800 tabular-nums">{restHolding ? '…' : restCountdown}</span>
                        </div>
                      </div>
                      <h3 className="font-century text-xl font-black text-slate-800">
                        {restMeta.next === 'finish' ? 'That was the last question!'
                          : restMeta.next === 'start' ? 'Starting…'
                          : 'Take a moment to rest'}
                      </h3>
                      <p className="font-raleway text-sm text-slate-400 mt-1.5">
                        {restHolding ? <>{INTERVIEWER.name} is about to speak…</>
                          : restMeta.next === 'start' ? <>First question in {restCountdown}s — {INTERVIEWER.name} is preparing it</>
                          : restMeta.next === 'followup' ? <>Follow-up question in {restCountdown}s — {INTERVIEWER.name} is preparing it</>
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
                    <span className={`inline-block font-raleway text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 ${followUpQ ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {followUpQ ? 'Follow-up' : activeQuestion.type.replace('_', ' ')}
                    </span>
                    <h3 className="font-century text-xl md:text-2xl font-black text-slate-800 leading-relaxed">
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
                            className={`font-raleway flex items-center gap-3 text-left px-4 py-3 rounded-2xl border transition-all ${selected ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'}`}
                          >
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + i)}</span>
                            <span className="text-sm">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* CAPTIONS */}
                {captionsOn && !resting && (
                  <div className="relative z-10 mx-3 md:mx-6 mb-3 rounded-2xl border border-slate-100 bg-white/86 px-4 py-3 backdrop-blur-sm min-h-[52px] flex items-center">
                    {isSpeaking ? (
                      <p className="font-raleway text-sm text-slate-700"><span className="text-blue-700 font-bold mr-2">{INTERVIEWER.name}:</span>{followUpQ ? followUpQ.question : activeQuestion.question}</p>
                    ) : transcript ? (
                      <p className="font-raleway text-sm text-slate-700">
                        <span className="text-emerald-600 font-bold mr-2">You:</span>{transcript}
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
                    : 'text-slate-500 bg-white/80 border-slate-100'
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
                    className="w-12 h-12 grid place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
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
                    onClick={() => setCaptionsOn(v => !v)}
                    aria-label="Toggle captions"
                    aria-pressed={captionsOn}
                    title="Toggle captions"
                    className={`w-12 h-12 grid place-items-center rounded-2xl border transition ${captionsOn ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    <FiMessageSquare size={20} />
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={awaitingFollowUp || (activeQuestion.type === 'mcq' && !followUpQ && answers[activeQuestion.id] === undefined)}
                    className={`font-raleway inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-6 h-12 rounded-2xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${answerReady ? 'ring-4 ring-emerald-200' : ''}`}
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
            <FoliLoader fullScreen={false} title="Evaluating your interview" moods={['typing','happy','look-l']} messages={['Reviewing all 3 rounds…','Scoring your answers…']} />
          )}

          {/* RESULTS STAGE */}
          {stage === 'results' && evaluation && (
            <>
              {/* An employer's interview does not end on a practice screen.
                  The candidate has just finished the thing their application
                  rests on and needs to know it was received, that the score
                  below is their own feedback rather than a verdict, and that
                  there is nothing further to do. */}
              {campaignInterview && (
                <div
                  className="mx-auto mb-6 max-w-4xl rounded-2xl border border-emerald-100 bg-emerald-50 p-5"
                  data-testid="campaign-complete"
                >
                  <h3 className="font-century text-lg font-black text-emerald-900">
                    Sent to {campaignInterview.company}
                  </h3>
                  <p className="font-raleway mt-1.5 text-sm leading-relaxed text-emerald-800">
                    Your interview for {campaignInterview.role} is complete and your answers are with
                    the hiring team. There is nothing else for you to do — they will be in touch
                    through the email address on your account.
                  </p>
                  <p className="font-raleway mt-2.5 text-[13px] leading-relaxed text-emerald-700">
                    The breakdown below is <strong>yours</strong>, not theirs. It is the same feedback
                    you would get from a practice run, kept so you can see how you did.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/interviews"
                      className="font-raleway rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      My interviews
                    </Link>
                    <Link
                      href="/jobs"
                      className="font-raleway rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
                    >
                      Find more roles
                    </Link>
                  </div>
                </div>
              )}
              <ResultsStage
                evaluation={evaluation}
                questions={questions}
                answers={answers}
                onRestart={restart}
                hideRestart={Boolean(campaignInterview)}
              />
            </>
          )}
    </div>
  );
}
