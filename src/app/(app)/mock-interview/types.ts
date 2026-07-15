// Shared types for the Mock Interview feature.
export type Round = 'hr' | 'technical' | 'problem_solving';
export type QuestionType = 'mcq' | 'short_answer' | 'scenario' | 'fill_in_the_blank' | 'behavioral';
export type LengthTier = 'quick' | 'standard' | 'full';
export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';
// How the interviewer renders on the call stage — user's choice (Phase 5.1 slot).
export type InterviewerStyle = 'orb' | 'avatar';

export interface PublicQuestion {
  id: number;
  round: Round;
  type: QuestionType;
  question: string;
  options?: string[];
}

export interface QuestionFeedback {
  questionId: number;
  verdict: 'correct' | 'partial' | 'incorrect';
  explanation: string;
  idealAnswer?: string;
}

export interface RoundScore {
  hr: number;
  technical: number;
  problem_solving: number;
}

export interface DeliveryScore {
  clarity: number;
  structure: number;
  conciseness: number;
  fillerWords: number;
  notes: string;
}

export interface Evaluation {
  overallScore: number;
  roundScores: RoundScore;
  perQuestion: QuestionFeedback[];
  strengths: string[];
  areasToImprove: string[];
  improvementTips: string[];
  summary: string;
  delivery?: DeliveryScore;
}

export interface ProgressPoint {
  sessionId: string;
  submittedAt: string;
  lengthTier: LengthTier;
  overallScore: number;
  roundScores: RoundScore;
}

export interface ProgressSummary {
  attempts: number;
  best: number | null;
  latest: number | null;
  average: number | null;
  delta: number | null;
}
