'use client';

import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * A 404 for admin URLs that is still behind the admin gate.
 *
 * The root not-found renders outside this segment, so a mistyped /admin/... URL
 * used to answer anonymously — a small leak, but it confirmed the admin area
 * exists to somebody who should have been told nothing. Being here means the
 * layout wraps it, and the layout checks the role first.
 */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-[60svh] items-center justify-center px-5">
      <div className="sf-card max-w-[420px] rounded-2xl p-7 text-center">
        <h1 className="text-lg font-bold text-[var(--sf-ink)]">No such admin page</h1>
        <p className="mt-2 text-sm text-[var(--sf-muted)]">
          That URL does not exist. It may have been renamed or removed.
        </p>
        <Link
          href="/admin/campaigns"
          className="sf-primary mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <FiArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </div>
    </main>
  );
}
