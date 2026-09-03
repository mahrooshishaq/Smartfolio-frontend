/**
 * Carries a campaign interview from the invite gate to the interview itself.
 *
 * Same shape as the jobs-feed handoff next door, for the same reasons: a job
 * description routinely runs past the length a URL can safely carry, and a
 * truncated one would quietly produce a worse interview rather than an obvious
 * error. The query flag only says "there is something waiting for you", which
 * stops a stale entry leaking into a later visit the candidate began themselves.
 *
 * The extra piece here is the invite token, which is what lets the finished
 * session be attached back to the invitation it was taken for.
 */

export const CAMPAIGN_PARAM = 'campaign';

export interface CampaignInterviewHandoff {
  token: string;
  candidateId: string;
  campaignId: string;
  jobDescription: string;
  role: string;
  company: string;
}

const KEY = 'campaignInterview';

export function stashCampaignInterview(handoff: CampaignInterviewHandoff): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    /* storage-blocked: the gate falls back to the plain interview */
  }
}

/** Read without consuming — the interview page remounts under Suspense. */
export function peekCampaignInterview(): CampaignInterviewHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignInterviewHandoff;
    return parsed?.token && parsed?.jobDescription ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCampaignInterview(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Attach a finished session to the invitation.
 *
 * Best-effort on the candidate's side: their interview is already submitted and
 * scored by the time this runs, so a failure here must never look to them like
 * the interview did not count. It is logged and the operator can still see the
 * session; what is lost is the automatic link, not the work.
 */
export async function recordCampaignInterview(
  handoff: CampaignInterviewHandoff,
  interviewSessionId: string,
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<boolean> {
  try {
    const res = await fetcher(`/api/campaigns/invite/${handoff.token}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interviewSessionId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
