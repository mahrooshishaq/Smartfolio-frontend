/**
 * Telling the backend which step of the apply flow somebody is on.
 *
 * The apply page already knows exactly where it is. It just never said so, and
 * the cost of that silence is that a campaign can report thirty applications
 * and nothing at all about the seventy people who started one and left. Those
 * are the only people whose behaviour can still be acted on.
 *
 * Three rules hold this to being harmless:
 *
 *   1. It never throws and never rejects. Every call site is a person applying
 *      for a job, and no measurement is worth a step of their flow failing.
 *   2. It never blocks. `sendBeacon` hands the browser the payload and returns
 *      immediately, and survives the page being closed in the same moment,
 *      which is precisely when the interesting events happen.
 *   3. It carries no personal information. The id below is a random value this
 *      browser invented for itself; it is not an account, an email or an IP,
 *      and nothing joins it to one.
 */

const STORAGE_KEY = 'sf.anonymousId';

export type FunnelStep =
  | 'opened'
  | 'cv_uploaded'
  | 'details_completed'
  | 'check_started'
  | 'check_passed'
  | 'check_flagged'
  | 'check_blocked'
  | 'signup_shown'
  | 'submitted'
  | 'interview_opened'
  | 'interview_started'
  | 'interview_completed';

/**
 * A random id for this browser, made once and kept.
 *
 * Kept in localStorage rather than a cookie so it is never attached to a
 * request that did not ask for it. If storage is unavailable — private mode, a
 * browser set to block it — a fresh id is used for the visit and the person
 * simply counts once per page rather than once per journey. That is a small,
 * honest loss of accuracy, and much better than failing.
 */
function anonymousId(): string {
  const fresh = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `a${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const made = fresh();
    localStorage.setItem(STORAGE_KEY, made);
    return made;
  } catch {
    return fresh();
  }
}

/**
 * Steps already sent this page load.
 *
 * A React effect can run twice in development and a component can remount for
 * reasons that have nothing to do with the candidate. The backend counts
 * distinct people rather than rows so duplicates cannot skew a number, but
 * there is no reason to send them.
 */
const sent = new Set<string>();

/**
 * Record a step. Safe to call from anywhere, including a render effect.
 *
 * The campaign is named by slug from the apply page, which lives at
 * /apply/<slug> and has never seen an id, and by id from the interview, which
 * is handed one and has never seen the slug.
 */
export function track(
  step: FunnelStep,
  campaign: string | null | undefined,
  by: 'slug' | 'id' = 'slug',
): void {
  if (typeof window === 'undefined' || !campaign) return;

  const key = `${campaign}:${step}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const body = JSON.stringify({
      anonymousId: anonymousId(),
      ...(by === 'id' ? { campaignId: campaign } : { campaignSlug: campaign }),
      steps: [step],
    });
    const url = '/api/telemetry/events';

    // sendBeacon is the whole point: it is queued by the browser and delivered
    // even if this page is being navigated away from or closed, which is what
    // an abandonment event is by definition.
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Deliberately silent. Nothing measured here is worth a broken flow.
  }
}
