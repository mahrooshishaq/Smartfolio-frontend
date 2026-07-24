/**
 * Hands a job posting from the jobs feed to another tool — the mock interview,
 * or the resume analyser — so the destination opens with the description
 * already filled in and nothing left to paste.
 *
 * The payload travels in sessionStorage rather than the URL. Job descriptions
 * routinely run past the ~2,000 characters some browsers enforce on a URL, and
 * a truncated description would quietly produce a worse result rather than an
 * obvious error. The query param is only a flag saying "there is something
 * waiting for you", which keeps a stale entry from leaking into a later visit
 * the user began themselves.
 */

export type HandoffIntent = 'interview' | 'resume';

/** Marks a destination visit as carrying a handoff. */
export const HANDOFF_PARAM = 'fromJob';

export interface JobHandoff {
  /** Full job description — becomes the textarea contents. */
  description: string;
  /** Shown in the confirmation banner so the user can tell which job this is. */
  title: string;
  company: string;
}

/**
 * Each destination validates the description differently, so the button that
 * leads there has to gate on the same number — otherwise it lands the user on a
 * form that refuses to run, with no explanation of why.
 */
export const MIN_DESCRIPTION_LENGTH: Record<HandoffIntent, number> = {
  interview: 20, // mock-interview "Start Interview" enables at 20
  resume: 50,    // AnalyzeResumeDto rejects a jobDescription under 50
};

const DESTINATION: Record<HandoffIntent, string> = {
  interview: '/mock-interview',
  resume: '/upload-resume',
};

// Separate keys so a stashed interview is never consumed by the resume page.
const STORAGE_KEY: Record<HandoffIntent, string> = {
  interview: 'jobHandoff:interview',
  resume: 'jobHandoff:resume',
};

/** Is this posting substantial enough for the given destination to accept it? */
export function canHandOff(description: string | null | undefined, intent: HandoffIntent): boolean {
  return (description || '').trim().length >= MIN_DESCRIPTION_LENGTH[intent];
}

/**
 * Stash a job and return the path to send the user to. Returns null when the
 * posting is too thin for the destination, so the caller can keep the button
 * from leading somewhere useless.
 */
export function stashJobHandoff(job: JobHandoff, intent: HandoffIntent): string | null {
  if (!canHandOff(job.description, intent)) return null;

  try {
    sessionStorage.setItem(STORAGE_KEY[intent], JSON.stringify(job));
  } catch {
    // Private-browsing quota errors and the like — fall back to a normal visit
    // rather than blocking navigation entirely.
    return null;
  }
  return `${DESTINATION[intent]}?${HANDOFF_PARAM}=${intent}`;
}

/**
 * Read a stashed job WITHOUT destroying it.
 *
 * Reading used to also delete, and the destination stripped the URL flag
 * immediately afterwards. That left nothing to recover from: these pages read
 * useSearchParams inside a Suspense boundary, and any remount after hydration
 * came back to an empty stash and a clean URL, so the description the user had
 * just seen silently vanished. Keeping both the stash and the flag makes the
 * prefill idempotent — a remount simply reads it again.
 *
 * The stash is cleared explicitly instead: when the user dismisses the banner,
 * or once the work it was carrying has actually begun.
 */
export function peekJobHandoff(intent: HandoffIntent): JobHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY[intent]);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<JobHandoff>;
    if (!parsed || typeof parsed.description !== 'string') return null;

    return {
      description: parsed.description,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      company: typeof parsed.company === 'string' ? parsed.company : '',
    };
  } catch {
    return null;
  }
}

/**
 * Forget a stashed job. Call when the user dismisses it, or once the interview
 * or analysis it was carrying has started — after that point the form owns the
 * text and re-applying it on a remount would fight the user's own edits.
 */
export function clearJobHandoff(intent: HandoffIntent): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY[intent]);
  } catch {
    // Nothing to do — a stale stash is harmless next to a thrown error here.
  }
  // Drop the flag too, so a later visit to the bare path starts clean.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(HANDOFF_PARAM) === intent) {
      url.searchParams.delete(HANDOFF_PARAM);
      // history.replaceState, never router.replace: a router navigation
      // re-renders the Suspense boundary these pages sit in and remounts them.
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  } catch {
    // URL rewriting is cosmetic; never let it break the flow.
  }
}
