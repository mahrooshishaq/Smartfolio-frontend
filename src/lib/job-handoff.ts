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
 * Read and consume a stashed job. Single-use on purpose: reloading the
 * destination or coming back later should be a clean form, not a surprise
 * repeat of a job the user has moved on from.
 */
export function consumeJobHandoff(intent: HandoffIntent): JobHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY[intent]);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY[intent]);

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
 * Strip the handoff flag from the URL after consuming it.
 *
 * Deliberately history.replaceState and not router.replace: destinations read
 * useSearchParams inside a Suspense boundary, so a router navigation re-renders
 * that boundary and remounts the page — throwing away the state the handoff
 * just set.
 */
export function clearHandoffParam(pathname: string): void {
  window.history.replaceState(null, '', pathname);
}
