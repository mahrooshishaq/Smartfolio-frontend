// Central authenticated API client.
//
// Why this exists: access tokens are short-lived (60 min). Before this, every
// page did its own `fetch` with a raw `localStorage` token and handled (or
// forgot to handle) 401s individually — which is why an expired session showed
// a "logged-in but all-zeros" dashboard instead of bouncing to login. This
// wrapper attaches the token, transparently refreshes it on a 401 (once, shared
// across concurrent calls), retries the original request, and only if the
// refresh itself fails does it clear the session and redirect to /login.

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
