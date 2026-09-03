'use client';

/**
 * Admin shell and role gate.
 *
 * The redirect here is CONVENIENCE, not security: it stops a candidate who
 * guesses the URL from staring at a broken page. Every admin endpoint is
 * independently guarded by RolesGuard on the server, which reads the role from
 * the database on each request - so a user who edits localStorage, or keeps a
 * token issued before being demoted, gets a 403 from the API and an empty
 * screen here, never data.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiGrid, FiShield, FiArrowLeft } from 'react-icons/fi';
import { apiFetch } from '@/lib/api';
import BrandMark from '@/components/BrandMark';

type Me = { id: string; name: string; email: string; role: string };

const NAV = [
  { href: '/admin/campaigns', label: 'Campaigns', icon: FiGrid },
  { href: '/admin/verification', label: 'Verification', icon: FiShield },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) throw new Error('not authenticated');
        const user = (await res.json()) as Me;
        if (cancelled) return;
        setMe(user);
        setState(user.role === 'admin' ? 'allowed' : 'denied');
      } catch {
        // apiFetch already redirects to /login when the session is truly gone;
        // this covers the case where it resolved but the user is not an admin.
        if (!cancelled) setState('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <main className="sf-app-bg flex min-h-[100svh] items-center justify-center">
        <p className="text-sm text-[var(--sf-muted)]">Checking your access…</p>
      </main>
    );
  }

  if (state === 'denied') {
    return (
      <main className="sf-app-bg flex min-h-[100svh] items-center justify-center px-5">
        <div className="sf-card max-w-[420px] rounded-2xl p-7 text-center">
          <h1 className="text-lg font-bold text-[var(--sf-ink)]">This area is for administrators</h1>
          <p className="mt-2 text-sm text-[var(--sf-muted)]">
            Your account does not have access. If that is wrong, ask an administrator to grant it.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="sf-primary mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <FiArrowLeft className="h-4 w-4" /> Back to my dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-[100svh] bg-[var(--sf-bg)]">
      <aside className="hidden w-[232px] shrink-0 border-r border-[var(--sf-border)] bg-white p-4 lg:block">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
          <BrandMark className="h-6 w-6" />
          <span className="font-century text-[15px] font-bold text-[var(--sf-ink)]">Smartfolio</span>
          <span className="rounded-md bg-[var(--sf-violet-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--sf-violet)]">
            Admin
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ' +
                  (active
                    ? 'bg-[var(--sf-primary-soft)] font-bold text-[var(--sf-primary-dark)]'
                    : 'font-semibold text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)]')
                }
              >
                <Icon className="h-[17px] w-[17px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="my-5 h-px bg-[#edf3ff]" />
        <p className="px-3 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
          Signed in as
          <br />
          <span className="font-semibold text-[var(--sf-ink-soft)]">{me?.email}</span>
        </p>
      </aside>

      {/* Mobile: the sidebar collapses to a row of tabs rather than disappearing. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-[var(--sf-border)] bg-white px-4 py-3 lg:hidden">
          <BrandMark className="h-5 w-5" />
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                'rounded-lg px-3 py-1.5 text-sm ' +
                (pathname.startsWith(href)
                  ? 'bg-[var(--sf-primary-soft)] font-bold text-[var(--sf-primary-dark)]'
                  : 'font-semibold text-[var(--sf-muted)]')
              }
            >
              {label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
