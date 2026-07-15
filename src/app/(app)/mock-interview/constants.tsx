import type { IconType } from 'react-icons';
import { FiUser, FiCpu, FiZap } from 'react-icons/fi';
import type { Round, LengthTier, Seniority, QuestionType, InterviewerStyle } from './types';

export const ROUND_META: Record<Round, { title: string; subtitle: string; icon: IconType; color: string; bg: string }> = {
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

export const ROUND_ORDER: Round[] = ['hr', 'technical', 'problem_solving'];

export const TIER_OPTIONS: { id: LengthTier; label: string; time: string; count: string; desc: string }[] = [
  { id: 'quick', label: 'Quick Screen', time: '~5 min', count: '5 questions', desc: 'A fast warm-up before a real call' },
  { id: 'standard', label: 'Standard', time: '~10 min', count: '10 questions', desc: 'A balanced interview across all rounds' },
  { id: 'full', label: 'Full Interview', time: '~15 min', count: '15 questions', desc: 'A thorough, realistic end-to-end interview' },
];

export const SENIORITY_OPTIONS: { id: Seniority; label: string }[] = [
  { id: 'junior', label: 'Junior' },
  { id: 'mid', label: 'Mid' },
  { id: 'senior', label: 'Senior' },
  { id: 'lead', label: 'Lead' },
];

// Per-question answer windows (Phase 1.4) — mirrors PER_QUESTION_SECONDS in
// Smartfolio-backend/src/modules/mock-interview/mock-interview.config.ts.
// The countdown only runs while it's the candidate's turn to answer.
export const PER_QUESTION_SECONDS: Record<QuestionType, number> = {
  mcq: 30,
  fill_in_the_blank: 40,
  short_answer: 60,
  behavioral: 90,
  scenario: 120,
};
// Follow-ups are short probes — a fixed window regardless of parent type.
export const FOLLOW_UP_SECONDS = 60;

// The AI interviewer persona shown in the video-call UI (Phase 3.3).
export const INTERVIEWER = { name: 'Folio', role: 'AI Interviewer' };

// The two interviewer looks the user can pick on the input screen (5.1 slot).
export const INTERVIEWER_STYLE_OPTIONS: { id: InterviewerStyle; label: string; desc: string }[] = [
  { id: 'avatar', label: 'Video avatar', desc: 'Face-to-face — Folio appears on camera and speaks to you' },
  { id: 'orb', label: 'Voice orb', desc: 'Minimal — a calm voice-reactive tile, no face' },
];

export const fmtTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
