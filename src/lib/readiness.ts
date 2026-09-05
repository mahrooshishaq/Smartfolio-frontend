/**
 * How ready a CV is for the market the person is aiming at.
 *
 * The candidate's own mirror. No employer, no decision, no gates — this exists
 * to tell somebody where to spend their next month, measured against what real
 * postings are asking for rather than what a model thinks a good CV looks like.
 */
import { apiFetch } from './api';

export interface DemandTerm {
  term: string;
  /** Share of matching postings asking for it, 0-1. */
  share: number;
  onCv: boolean;
}

export interface ReadinessReport {
  postingsAnalysed: number;
  targetRole: string;
  /**
   * 0-100 over what the market asks for most.
   *
   * Deliberately never displayed beside an application score. They answer
   * different questions, and a candidate reading "78% ready" next to "your
   * application scored 78" will assume they mean the same thing.
   */
  readiness: number;
  strengths: DemandTerm[];
  gaps: DemandTerm[];
  differentiators: DemandTerm[];
}

export async function fetchReadiness(role?: string): Promise<ReadinessReport | null> {
  const res = await apiFetch(`/api/me/readiness${role ? `?role=${encodeURIComponent(role)}` : ''}`);
  // 404 is the honest "not enough postings to say anything" answer, not an
  // error worth showing as one.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not measure your CV against the market.');
  return res.json();
}
