// Serves the service worker from a route handler rather than /public so that the
// script bytes change on every deploy — that byte diff is the only thing that makes
// a browser notice a new version exists.
export const dynamic = 'force-dynamic';

// Evaluated once per server process, i.e. once per deploy.
const VERSION = process.env.NEXT_PUBLIC_BUILD_ID || String(Date.now());

// Paths rewritten to the backends in next.config.ts. These carry auth tokens and
// per-user data, so the service worker must never see or store them.
const BYPASS = [
  '/auth',
  '/resume',
  '/onboarding',
  '/jobs',
  '/courses',
  '/mock-interview',
  '/document-generation',
  '/scraper',
  '/applications',
  '/api',
];

const sw = /* js */ `
const VERSION = ${JSON.stringify(VERSION)};
const STATIC_CACHE = 'sf-static-' + VERSION;
const OFFLINE_URL = '/offline';
const BYPASS = ${JSON.stringify(BYPASS)};

// Prefix match on a path boundary, so /resume-editor (a page) is not mistaken for
// /resume (a backend route).
function isBypassed(pathname) {
  return BYPASS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isImmutableAsset(pathname) {
  // Content-hashed by Next, plus our own static icons.
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  // Deliberately no skipWaiting() — the new worker waits until the page tells it to
  // activate, so the user is never swapped onto a new build mid-interaction.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML is always fetched fresh; a cached shell is what strands users on an old
  // build. Offline falls back to a static page instead. Handled before the bypass
  // check because responses here are never stored, and several page routes
  // (/jobs, /courses, ...) share a prefix with a backend route.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error())
      )
    );
    return;
  }

  if (isBypassed(url.pathname)) return;

  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  // Everything else falls through to the network untouched.
});
`;

export async function GET() {
  return new Response(sw, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // Must revalidate, or browsers can serve a stale worker and updates stall.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
