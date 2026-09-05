/**
 * Types and helpers for the admin surface.
 *
 * Everything here goes through `apiFetch`, so a stale token refreshes once and
 * a dead session lands on /login rather than rendering an empty admin screen.
 *
 * Paths are under `/api/admin/...` deliberately. The backend serves these at
 * `/admin/...`, but the FRONTEND owns `/admin/*` as page routes - proxying that
 * prefix would make some admin URLs render pages and others return JSON, with
 * no obvious reason for the difference. The existing `/api/:path*` rewrite
 * already reaches the backend, so no new rewrite is needed.
 */
import { apiFetch } from './api';

export type CampaignStatus = 'draft' | 'collecting' | 'shortlisting' | 'interviewing' | 'closed';

export type CandidateStatus =
  | 'applied'
  | 'shortlisted'
  | 'invited'
  | 'completed'
  | 'submitted'
  | 'rejected';

export interface CampaignQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

export interface Campaign {
  id: string;
  title: string;
  company: string;
  jobDescription: string;
  location: string | null;
  jobType: string | null;
  /** ISO alpha-2 countries the role can hire from. Empty/null means anywhere. */
  candidateCountries: string[] | null;
  slug: string;
  status: CampaignStatus;
  questions: CampaignQuestion[];
  shortlistTarget: number;
  applicationDeadline: string | null;
  interviewDeadline: string | null;

  /** What this role screens on. All optional; absent means "not asked". */
  mustHaveSkills: string[] | null;
  niceToHaveSkills: string[] | null;
  minYears: number | null;
  targetYears: number | null;
  seniority: 'entry' | 'mid' | 'senior' | 'lead' | null;
  minEducation: string | null;
  educationIsGate: boolean;
  requiredCertifications: string[] | null;
  requiredLanguages: string[] | null;
  requiresWorkAuthorization: boolean;
  freelancePolicy: 'full' | 'discounted' | 'permanent_only';
  experienceWeighting: 'low' | 'normal' | 'high';
  /** Whether unsuccessful candidates are told what their CV did not show. */
  rejectionFeedback: boolean;
  createdAt: string;
  /** Candidates by status. Present on the list, and on the detail for the live-edit warning. */
  counts?: Partial<Record<CandidateStatus, number>>;
  /** What the connection check did to this campaign's traffic. */
  verification?: {
    totalChecks: number;
    peopleChecked: number;
    clean: number;
    needsReview: number;
    blocked: number;
    blockedThenApplied: number;
    blockedNeverApplied: number;
  };
}

export interface Finding {
  level: 'block' | 'contradiction' | 'note';
  code: string;
  detail: string;
}

export interface CandidateCv {
  id: string;
  fileName: string;
  uploadedAt: string;
  /** False when the row outlived its file — never offer a link that 404s. */
  analyzable: boolean;
}

/** Whether the rubric is predicting anything, and whether it skews. */
export interface Calibration {
  candidates: number;
  scored: number;
  ineligible: number;
  bands: Array<{ band: string; candidates: number; shortlisted: number; interviewed: number; advanceRate: number }>;
  predictive: boolean | null;
  byExperience: GroupOutcome[];
  byEmployment: GroupOutcome[];
  needsReview: GroupOutcome[];
  note: string;
}

export interface GroupOutcome {
  group: string;
  candidates: number;
  advanced: number;
  advanceRate: number;
  impactRatio: number;
}

/** The reasons behind a score: gates, components, evidence. */
export interface CandidateFit {
  eligible: boolean;
  gateFailures: Array<{ gate: string; reason: string }>;
  score: number;
  components: Array<{
    key: string;
    label: string;
    points: number;
    outOf: number;
    detail: string;
    applicable: boolean;
  }>;
  matched: string[];
  missing: string[];
  yearsRelevant: number;
  yearsTotal: number;
  yearsByType: Record<string, number>;
  experienceUnknown: boolean;
}

/** A completed interview, as a reviewer needs to read it. */
export interface CandidateInterview {
  sessionId: string;
  takenAt: string;
  lengthTier: string;
  overallScore: number | string | null;
  evaluation: { summary?: string; strengths?: string[]; improvements?: string[] } | null;
  questions: Array<{
    id: number;
    round: string;
    type: string;
    question: string;
    options: string[] | null;
    answer: string | null;
    score: number | null;
    feedback: string | null;
  }>;
  followUps: unknown[];
}

/** What this person has done on OTHER campaigns. */
export interface CandidateElsewhere {
  applications: number;
  submissions: number;
  interviews: number;
  companies: string[];
}

export interface CampaignCandidate {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  status: CandidateStatus;
  source: 'public_apply' | 'internal_match';
  matchScore: string | null;
  resumeId: string | null;
  answers: Record<string, string> | null;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  verification: { verdict: string; findings: Finding[]; createdAt: string } | null;
  availability: 'looking' | 'suspended';
  suspensionReason: string | null;
  cv: CandidateCv | null;
  /** Scored against a description the campaign has since materially changed. */
  scoreStale: boolean;
  /** Null when no gates were set or the CV could not be read. */
  eligible: boolean | null;
  /** Why the score is what it is. Null before the rubric ran. */
  fit: CandidateFit | null;
  /** True when there is an interview to read. */
  hasInterview: boolean;
  elsewhere: CandidateElsewhere;
}

export interface DeviceCluster {
  deviceSignature: string;
  accounts: number;
  sessions: number;
  names: string[];
  emails: string[];
  lastSeen: string;
}

export interface VerificationSessionRow {
  id: string;
  userId: string | null;
  context: string;
  declaredCountry: string | null;
  ip: string;
  verdict: string;
  findings: Finding[];
  deviceSignature: string | null;
  createdAt: string;
  geo: Record<string, unknown> | null;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  listCampaigns: () => json<Campaign[]>('/api/admin/campaigns'),

  getCampaign: (id: string) => json<Campaign>(`/api/admin/campaigns/${id}`),

  createCampaign: (body: Record<string, unknown>) =>
    json<Campaign>('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  updateCampaign: (id: string, body: Record<string, unknown>) =>
    json<Campaign>(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  candidates: (id: string, options: { status?: string; sort?: 'score' | 'recent' } = {}) => {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.sort) params.set('sort', options.sort);
    const query = params.toString();
    return json<{ count: number; candidates: CampaignCandidate[] }>(
      `/api/admin/campaigns/${id}/candidates${query ? `?${query}` : ''}`,
    );
  },

  runMatch: (id: string) =>
    json<{ scored: number; created: number; updated: number }>(
      `/api/admin/campaigns/${id}/match`,
      { method: 'POST' },
    ),

  act: (id: string, action: 'shortlist' | 'submit' | 'reject', candidateIds: string[]) =>
    json<{ updated: number; status: string }>(`/api/admin/campaigns/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateIds }),
    }),

  invite: (id: string, candidateIds: string[]) =>
    json<{ invited: number; sent: number; failed: Array<{ candidateId: string; reason: string }> }>(
      `/api/admin/campaigns/${id}/invite`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds }),
      },
    ),

  availability: () =>
    json<{
      availability: 'looking' | 'suspended';
      availabilityUpdatedAt: string | null;
      suspensionReason: string | null;
      applications: number;
      submittedToCompanies: number;
      interviewsAttended: number;
      suspendsAfter: number;
    }>('/api/me/availability'),

  setAvailability: (availability: 'looking' | 'suspended') =>
    json<{ availability: string }>('/api/me/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability }),
    }),

  duplicateCampaign: (id: string) =>
    json<Campaign>(`/api/admin/campaigns/${id}/duplicate`, { method: 'POST' }),

  /**
   * Open a candidate's CV.
   *
   * Fetched rather than linked. /resume/:id/file is owner-only and needs a
   * bearer token, which a plain anchor cannot send — the link in this list
   * answered 401 and then, with a token, would have 404'd anyway. This route is
   * authorised by campaign membership instead, and the bytes are turned into a
   * blob URL so the browser opens them in a tab.
   */
  openCandidateCv: async (campaignId: string, candidateId: string) => {
    const res = await apiFetch(
      `/api/admin/campaigns/${campaignId}/candidates/${candidateId}/cv`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || 'Could not open this CV.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Revoked on a delay: revoking immediately races the new tab's own load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /** The interview a candidate sat: questions, their answers, and the scoring. */
  candidateInterview: (campaignId: string, candidateId: string) =>
    json<CandidateInterview>(
      `/api/admin/campaigns/${campaignId}/candidates/${candidateId}/interview`,
    ),

  /** Rescore the people already on this campaign — see rescore() on the service. */
  rescore: (id: string) =>
    json<{ total: number; rescored: number; skipped: number }>(
      `/api/admin/campaigns/${id}/rescore`,
      { method: 'POST' },
    ),

  /** Who is still waiting to hear about this campaign. */
  feedbackStatus: (id: string) =>
    json<{ enabled: boolean; told: number; waiting: number; sendsOnClose: boolean }>(
      `/api/admin/campaigns/${id}/feedback`,
    ),

  /** Does the score predict who gets picked, and does it skew anyone. */
  calibration: (id: string) =>
    json<Calibration>(`/api/admin/campaigns/${id}/calibration`),

  /** Where emailed links point, and whether mail can be delivered at all. */
  diagnostics: () =>
    json<{
      inviteLinkExample: string;
      frontendUrl: string;
      mail: { smtp: string; host: string | null; error: string | null };
      canDeliverInvitations: boolean;
    }>('/api/admin/campaigns/diagnostics'),

  clusters: () =>
    json<{ count: number; clusters: DeviceCluster[] }>('/api/admin/verification/clusters'),

  verificationSessions: (verdict?: string) =>
    json<{ count: number; sessions: VerificationSessionRow[]; lists: Record<string, unknown> }>(
      `/api/admin/verification/sessions${verdict ? `?verdict=${verdict}` : ''}`,
    ),
};

/** Colour tokens per status, so a badge means the same thing on every screen. */
export const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#f8fbff', fg: 'var(--sf-muted)' },
  collecting: { bg: 'var(--sf-green-soft)', fg: 'var(--sf-green)' },
  shortlisting: { bg: 'var(--sf-yellow-soft)', fg: 'var(--sf-yellow)' },
  interviewing: { bg: 'var(--sf-violet-soft)', fg: 'var(--sf-violet)' },
  closed: { bg: '#f8fbff', fg: 'var(--sf-muted)' },

  applied: { bg: '#f8fbff', fg: 'var(--sf-muted)' },
  shortlisted: { bg: 'var(--sf-yellow-soft)', fg: 'var(--sf-yellow)' },
  invited: { bg: 'var(--sf-violet-soft)', fg: 'var(--sf-violet)' },
  completed: { bg: 'var(--sf-primary-soft)', fg: 'var(--sf-primary-dark)' },
  submitted: { bg: 'var(--sf-green-soft)', fg: 'var(--sf-green)' },
  rejected: { bg: 'var(--sf-red-soft)', fg: 'var(--sf-red)' },

  looking: { bg: 'var(--sf-green-soft)', fg: 'var(--sf-green)' },
  suspended: { bg: 'var(--sf-red-soft)', fg: 'var(--sf-red)' },

  clean: { bg: 'var(--sf-green-soft)', fg: 'var(--sf-green)' },
  review: { bg: 'var(--sf-yellow-soft)', fg: 'var(--sf-yellow)' },
  blocked: { bg: 'var(--sf-red-soft)', fg: 'var(--sf-red)' },
};
