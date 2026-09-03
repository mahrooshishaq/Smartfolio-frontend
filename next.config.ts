import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy.
 *
 * Access tokens live in localStorage, so any script that runs on this origin
 * can read them. This policy can't stop that, but it does stop the exfiltration
 * half: injected code cannot load from, or beacon out to, an origin not listed
 * here.
 *
 * script-src keeps 'unsafe-inline' because the App Router emits inline
 * hydration scripts; removing it needs a nonce-emitting middleware. Worth doing
 * later — it is what would make this policy actually XSS-resistant rather than
 * just exfiltration-resistant.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // In production the browser talks to the API same-origin, proxied by the
  // rewrites below, so 'self' is what actually matters. NEXT_PUBLIC_API_URL is
  // appended only when set (it is inlined at build time) to cover setups that
  // call the backend directly; an unset var must not inject a bogus localhost
  // entry into the production policy.
  // `blob:` is required for the resume preview: the PDF arrives as an
  // authenticated fetch, becomes a blob URL, and PDF.js then fetches that URL
  // back. Without it the preview failed with "Refused to connect" even though
  // the bytes were already in the page — a blob URL carries no network reach, so
  // allowing it grants nothing beyond reading what this origin already holds.
  // The verification latency probes hit AWS regional endpoints DIRECTLY from
  // the browser, and read the public IP from ipify. Proxying either through the
  // backend would measure the server's distance from those regions, not the
  // candidate's — which is the whole signal. ipify is listed for both its v4
  // and v6 hostnames because the check compares the two.
  [
    "connect-src 'self' blob:",
    'https://*.amazonaws.com',
    'https://api.ipify.org',
    'https://api64.ipify.org',
    process.env.NEXT_PUBLIC_API_URL,
    // The verification check posts straight to the backend, bypassing the
    // rewrites on purpose, so the backend observes the candidate's address
    // rather than this deployment's. Without it in connect-src the browser
    // blocks that one request and the check cannot submit at all.
    process.env.NEXT_PUBLIC_VERIFICATION_API_URL,
    isDev ? 'http://localhost:3000' : null,
  ].filter(Boolean).join(' '),
  "media-src 'self' blob: data:",
  // The same preview falls back to framing the blob when PDF.js can't render it.
  // frame-src was never set, so it inherited default-src 'self' and blocked the
  // fallback too — leaving "This content is blocked" with no way forward.
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera=(self) is required by the verification check, which reads camera
  // *device names* to spot virtual cameras (OBS, ManyCam). camera=() blocks
  // getUserMedia outright, and enumerateDevices then returns empty labels —
  // the check silently sees no devices rather than failing loudly.
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=(self)' },
];

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      { source: '/auth/:path*', destination: `${backendUrl}/auth/:path*` },
      { source: '/resume/:path*', destination: `${backendUrl}/resume/:path*` },
      { source: '/onboarding/:path*', destination: `${backendUrl}/onboarding/:path*` },
      { source: '/jobs/:path*', destination: `${backendUrl}/jobs/:path*` },
      { source: '/courses/:path*', destination: `${backendUrl}/courses/:path*` },
      { source: '/mock-interview/:path*', destination: `${backendUrl}/mock-interview/:path*` },
      { source: '/document-generation/:path*', destination: `${backendUrl}/document-generation/:path*` },
      { source: '/scraper/:path*', destination: `${backendUrl}/scraper/:path*` },
      { source: '/applications', destination: `${backendUrl}/applications` },
      { source: '/applications/:path*', destination: `${backendUrl}/applications/:path*` },
      { source: '/api/:path*', destination: `${backendUrl}/:path*` },
    ];
  },
};

export default nextConfig;
