/**
 * Where to send someone after they sign in or sign up.
 *
 * Deliberately sessionStorage, not a `?next=` query parameter:
 *
 *  - Signup here is THREE legs (signup -> OTP email -> verify), and a query
 *    parameter has to be threaded through every one of them by hand.
 *  - Google OAuth leaves the origin entirely and comes back through a callback
 *    route that builds its own URL, so a parameter does not survive it.
 *  - A parameter re-enters the `searchParams` remount trap this codebase has
 *    already been bitten by, where a router.replace wipes component state.
 *
 * sessionStorage is per-tab and survives all three legs and the OAuth round
 * trip, because it is the same tab throughout.
 */

const KEY = 'sf.postAuthNext';

/** Same-origin paths only - never send anyone to an attacker-supplied URL. */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

export function rememberPostAuthPath(path: string): void {
  if (typeof window === 'undefined' || !isSafePath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Private-mode Safari and storage-blocked contexts throw. Losing the return
    // path is a worse landing page, not a broken flow.
  }
}

export function takePostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = sessionStorage.getItem(KEY);
    if (path) sessionStorage.removeItem(KEY);
    return path && isSafePath(path) ? path : null;
  } catch {
    return null;
  }
}

export function peekPostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = sessionStorage.getItem(KEY);
    return path && isSafePath(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * The destination after a successful sign-in, given where the app would
 * otherwise have sent them.
 */
export function resolvePostAuthDestination(fallback: string): string {
  return takePostAuthPath() ?? fallback;
}

/**
 * The application someone left mid-flow when they went to sign up.
 *
 * The draft itself is identified by an httpOnly cookie, which is right for a
 * claimable id - and means the page CANNOT see it. `document.cookie` returns
 * nothing for it, so "is there a draft to claim?" has to be answered another
 * way. This marker is that way: set when we send them to sign up, read when
 * they come back.
 *
 * It is only a hint. The claim itself is authorised by the cookie and the JWT
 * on the server, so a forged marker achieves nothing beyond a 404.
 */
const PENDING_KEY = 'sf.pendingApplySlug';

export function rememberPendingApplication(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_KEY, slug);
  } catch {
    /* storage-blocked contexts: they finish by pressing submit again */
  }
}

export function takePendingApplication(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const slug = sessionStorage.getItem(PENDING_KEY);
    if (slug) sessionStorage.removeItem(PENDING_KEY);
    return slug;
  } catch {
    return null;
  }
}
