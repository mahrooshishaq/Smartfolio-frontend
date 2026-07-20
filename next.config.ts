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
  [
    "connect-src 'self'",
    process.env.NEXT_PUBLIC_API_URL,
    isDev ? 'http://localhost:3000' : null,
  ].filter(Boolean).join(' '),
  "media-src 'self' blob: data:",
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
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
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
