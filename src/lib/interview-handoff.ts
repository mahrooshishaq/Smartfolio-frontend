/**
 * Hands a job posting from the jobs feed to the mock-interview page, so
 * "Practice this interview" lands on the interview form with the description
 * already filled in and nothing left to do but press Start.
 *
 * The payload travels in sessionStorage rather than the URL. Job descriptions
 * routinely run past the ~2,000 characters some browsers enforce on a URL, and
 * a truncated description would quietly produce a worse interview rather than
 * an obvious error. The query param is only a flag saying "there is something
 * waiting for you", which keeps a stale entry from leaking into a later visit
 * the user began themselves.
 */

const STORAGE_KEY = 'interviewPrefill';

/** Marks a mock-interview visit as carrying a handoff. */
export const PREFILL_PARAM = 'prefill';
export const PREFILL_VALUE = 'job';

export interface InterviewPrefill {
  /** Full job description — becomes the textarea contents. */
  description: string;
  /** Shown in the confirmation banner so the user can tell which job this is. */
  title: string;
  company: string;
}

/**
 * Stash a job and return the path to send the user to. Returns null when the
 * posting carries no usable description, so the caller can keep the button from
 * leading somewhere useless.
 */
export function stashInterviewPrefill(job: InterviewPrefill): string | null {
  // The interview form requires 20 characters before it will start; handing over
  // less would strand the user on a disabled button with no explanation.
  if (!job.description || job.description.trim().length < 20) return null;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  } catch {
    // Private-browsing quota errors and the like — fall back to a normal visit
    // rather than blocking navigation entirely.
    return null;
  }
  return `/mock-interview?${PREFILL_PARAM}=${PREFILL_VALUE}`;
}

/**
 * Read and consume a stashed job. Single-use on purpose: reloading the
 * interview page or coming back later should be a clean form, not a surprise
 * repeat of a job the user has moved on from.
 */
export function consumeInterviewPrefill(): InterviewPrefill | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);

    const parsed = JSON.parse(raw) as Partial<InterviewPrefill>;
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
