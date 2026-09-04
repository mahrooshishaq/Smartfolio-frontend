// Central authenticated API client.
//
// Why this exists: access tokens are short-lived (60 min). Before this, every
// page did its own `fetch` with a raw `localStorage` token and handled (or
// forgot to handle) 401s individually — which is why an expired session showed
// a "logged-in but all-zeros" dashboard instead of bouncing to login. This
// wrapper attaches the token, transparently refreshes it on a 401 (once, shared
// across concurrent calls), retries the original request, and only if the
// refresh itself fails does it clear the session and redirect to /login.

// Same-origin by default, and same-origin is the right answer here.
//
// Every path this client is given — /auth, /jobs, /resume, /scraper, /api/* —
// already has a rewrite in next.config.ts that proxies it to the backend, so an
// empty base means "go through the rewrite". The old default of
// 'http://localhost:3000' happened to BE the frontend's own dev port, so it
// worked locally for the wrong reason and hid what this variable really does.
//
// In production it did not work for the wrong reason, it just did the wrong
// thing: NEXT_PUBLIC_API_URL was set to the app's other deployment, so every
// authenticated call from the live domain went browser → that deployment →
// rewrite → backend. Two hops and a cross-origin round trip for a request that
// had no reason to leave the origin.
//
// Set NEXT_PUBLIC_API_URL only to call a backend that is genuinely elsewhere and
// not proxied. Pointing it at another copy of this frontend is always a mistake.
const API = process.env.NEXT_PUBLIC_API_URL || '';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
// Everything that identifies the signed-in user, cleared together on logout so
// no stale "Welcome back, <name>" can render against a dead token.
const SESSION_KEYS = [ACCESS_KEY, REFRESH_KEY, 'userName', 'userEmail'];

// Shared in-flight refresh so 8 dashboard calls hitting 401 at once trigger
// exactly one /auth/refresh, not 8.
let refreshInFlight: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

/** Wipe the session and send the user to the login screen. */
export function redirectToLogin() {
  clearSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Exchange the refresh token for a fresh access token. The backend derives the
// user id from the refresh token's `sub` claim, so we only send the token.
// Returns the new access token, or null if the session can no longer be renewed.
async function performRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.accessToken) return null;
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (data.user?.name) localStorage.setItem('userName', data.user.name);
    if (data.user?.email) localStorage.setItem('userEmail', data.user.email);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function withAuth(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Authenticated fetch against the API.
 *
 * @param path  Path relative to the API base (e.g. `/jobs/me/stats`). A full
 *              URL is also accepted.
 * @param init  Standard fetch options. The Authorization header is added here.
 *
 * On a 401 it refreshes once and retries. If the refresh fails it clears the
 * session, redirects to /login, and rejects — so callers never render a
 * ghost "authenticated" state against a dead token.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const token = getAccessToken();

  if (!token) {
    redirectToLogin();
    throw new Error('Not authenticated');
  }

  let res = await fetch(url, withAuth(init, token));

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      redirectToLogin();
      throw new Error('Session expired');
    }
    res = await fetch(url, withAuth(init, newToken));
    if (res.status === 401) {
      // Fresh token still rejected — the session is genuinely gone.
      redirectToLogin();
      throw new Error('Session expired');
    }
  }

  return res;
}

export { API };

// ─── Job apply-link resolution (JIT liveness at click time) ───────────────────

export interface JobLinkResolution {
  status: 'live' | 'dead' | 'unknown' | 'pending' | 'not_found';
  /** Where the apply link actually lands after redirects — open THIS, not the raw url. */
  finalUrl: string;
  applyUrl: string;
  reason?: string;
}

/**
 * Verify a job's apply link right before opening it. Bounded by `timeoutMs` so a
 * slow/bot-blocked board never leaves the user staring at a spinner — the caller
 * falls back to the raw apply URL on null. The backend still finishes and records
 * the verdict even if we stopped waiting, so the feed benefits either way.
 */
export async function resolveJobLink(
  jobId: string,
  timeoutMs = 4000,
): Promise<JobLinkResolution | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await apiFetch(`/scraper/jobs/${jobId}/resolve`, {
      method: 'POST',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as JobLinkResolution;
  } catch {
    return null; // timeout, network, or aborted — caller opens the raw URL
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unauthenticated fetch, for the public campaign surface.
 *
 * `apiFetch` cannot serve these pages: with no access token it clears the
 * session and redirects to /login, which would bounce a logged-out visitor away
 * from a job advert before they ever saw it. The apply page is public by
 * definition - that IS the acquisition flow - so it needs a client that treats
 * "not signed in" as the normal case.
 *
 * `credentials: 'include'` is always set because the pre-signup application
 * draft is identified by an httpOnly cookie. Without it the browser would drop
 * the cookie on every call and the draft would be unfindable on return from
 * signup.
 *
 * No token is attached, even when one exists. These endpoints are public, and a
 * signed-in visitor carrying an EXPIRED token would otherwise get a 401 on a
 * call that needs no authentication — with no refresh to recover it. Identity
 * on this surface belongs to `sessionFetch`, which the claim uses.
 */
export async function publicFetch(path: string, init?: RequestInit): Promise<Response> {
  // SAME-ORIGIN, deliberately - a relative path is left relative rather than
  // being prefixed with API like apiFetch does.
  //
  // Two things break otherwise. The draft cookie is SameSite=Lax, so it is not
  // sent on a cross-site request at all: the claim after signup would find no
  // draft and silently drop the application. And a credentialed cross-origin
  // request needs Access-Control-Allow-Credentials on the response, which is
  // absent, so the browser rejects it as "Failed to fetch".
  //
  // Neither problem exists same-origin, and these endpoints have no reason to
  // leave the origin: unlike the verification check, none of them care which
  // machine made the outbound call.
  // NO Authorization header. These endpoints are public, and attaching a token
  // can only hurt: a signed-in visitor whose access token has expired gets a 401
  // on a call that needs no authentication at all, and publicFetch — unlike
  // apiFetch — does not refresh. The symptom was an "Unauthorized" toast while
  // merely saving a draft, on a page designed for people with no account.
  //
  // The one public-surface call that DOES need identity is the claim, and it
  // uses sessionFetch below.
  return fetch(path, { ...init, headers: new Headers(init?.headers), credentials: 'include' });
}

/**
 * Same-origin, cookie-carrying, and token-refreshing.
 *
 * For the one call that needs all three: claiming a draft after signup. It has
 * to be same-origin (the draft cookie is SameSite=Lax), it has to identify the
 * new account, and it has to survive an access token that expired while the
 * candidate was reading the job description.
 */
export async function sessionFetch(path: string, init?: RequestInit): Promise<Response> {
  const call = (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(path, { ...init, headers, credentials: 'include' });
  };

  let res = await call(getAccessToken());
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await call(refreshed);
  }
  return res;
}
