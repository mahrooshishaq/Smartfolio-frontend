import type { IconType } from 'react-icons';
import { FiUser, FiCpu, FiZap } from 'react-icons/fi';
import type { Round, LengthTier, Seniority } from './types';

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

// The AI interviewer persona shown in the video-call UI (Phase 3.3).
export const INTERVIEWER = { name: 'Folio', role: 'AI Interviewer' };

export const fmtTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
