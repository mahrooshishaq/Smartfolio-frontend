'use client';

/**
 * The two halves of Connection checks, as real routes.
 *
 * Deliberately links, not a searchParams switch. Tab state in the query string
 * has already cost this frontend once — router.replace under Suspense remounts
 * the tree and wipes component state — and a route per view is cheaper to
 * reason about, survives a refresh, and can be linked to directly, which is
 * what an operator wants when handing a case to somebody else.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<[string, string]> = [
  ['/admin/verification', 'Checks'],
  ['/admin/verification/appeals', 'Appeals'],
];

export default function VerificationTabs({ openAppeals }: { openAppeals?: number }) {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex gap-1 border-b border-[var(--sf-border)]">
      {TABS.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              'relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ' +
              (active
                ? 'border-b-2 border-[var(--sf-violet)] font-bold text-[var(--sf-ink)]'
                : 'font-semibold text-[var(--sf-muted)] hover:text-[var(--sf-ink)]')
            }
          >
            {label}
            {/* Only when there is something waiting — a permanent zero is noise. */}
            {label === 'Appeals' && !!openAppeals && (
              <span className="rounded-full bg-[var(--sf-violet)] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {openAppeals}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
