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

/**
 * How long a remembered destination stays valid.
 *
 * Long enough for a signup with an email round trip and a Google consent
 * screen; short enough that an abandoned application cannot hijack an
 * unrelated visit tomorrow. Storage is localStorage rather than
 * sessionStorage because the OAuth hop leaves the origin twice, and a
 * per-tab store does not reliably survive that.
 */
const TTL_MS = 60 * 60 * 1000;

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value, at: Date.now() }));
  } catch {
    /* private mode and storage-blocked contexts: the flow still works, it just
       lands on the default page */
  }
}

function read(key: string, consume: boolean): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: string; at?: number };
    if (!parsed?.value || !parsed.at || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    if (consume) localStorage.removeItem(key);
    return parsed.value;
  } catch {
    return null;
  }
}

/** Same-origin paths only - never send anyone to an attacker-supplied URL. */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

export function rememberPostAuthPath(path: string): void {
  if (typeof window === 'undefined' || !isSafePath(path)) return;
  write(KEY, path);
}

export function takePostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = read(KEY, true);
  return path && isSafePath(path) ? path : null;
}

export function peekPostAuthPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = read(KEY, false);
  return path && isSafePath(path) ? path : null;
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
  write(PENDING_KEY, slug);
}

export function takePendingApplication(): string | null {
  if (typeof window === 'undefined') return null;
  return read(PENDING_KEY, true);
}

/** Read without consuming — for pages that only need to know one exists. */
export function peekPendingApplication(): string | null {
  if (typeof window === 'undefined') return null;
  return read(PENDING_KEY, false);
}
