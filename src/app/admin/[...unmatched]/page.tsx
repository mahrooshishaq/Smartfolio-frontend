import { notFound } from 'next/navigation';

/**
 * Catch every unmatched /admin/... path INTO this segment.
 *
 * Without it, a URL like /admin/typo matches no route at all and Next falls
 * through to the ROOT not-found — which renders outside the admin layout, and
 * the layout is where the role gate lives. The result was a bare "404 - Page
 * Not Found" served to anyone, signed in or not. Small, but it confirmed the
 * admin area exists to somebody who should have been told nothing.
 *
 * Matching here and calling notFound() hands the render to
 * app/admin/not-found.tsx, which sits inside the layout and therefore behind
 * the gate. Next prefers a concrete segment over a catch-all, so /admin/users
 * and the rest are unaffected.
 */
export default function AdminUnmatched() {
  notFound();
}
