'use client';

/**
 * Who is on the platform, and where they came from.
 *
 * The question this page exists to answer is not "list the users" but "is this
 * growing, and is anybody still here" — so the counts sit above the table and
 * each one is a filter. Clicking "From a campaign" asks the table the question
 * the number just raised, which is the only reason to show a number you cannot
 * interrogate.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FiSearch, FiUsers, FiUserCheck, FiUserX, FiBriefcase,
  FiChevronLeft, FiChevronRight, FiX, FiAlertCircle,
} from 'react-icons/fi';
import {
  adminApi,
  type AdminUser,
  type AdminUserFilters,
  type AdminUserPage,
  type AdminUserStats,
} from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';
import { Select } from '@/components/ui/Select';

const TRIGGER =
  'text-sm bg-white border border-[var(--sf-line,#eee)] rounded-xl px-3 py-2 text-[var(--sf-ink)] w-full';

/** A date, or an honest admission that we do not have one. */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * "3 days ago" reads faster than a date when the question is recency, which is
 * the only question anyone asks of lastActiveAt.
 */
function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function AdminUsersPage() {
  const { error } = useFeedback();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AdminUserFilters>({
    page: 1, limit: 25, sort: 'newest', activity: 'all',
    source: 'all', verified: 'all', availability: 'all', role: 'all',
  });

  const set = (patch: Partial<AdminUserFilters>) =>
    // Any change to the question resets to page 1: staying on page 7 of a
    // filter that now has two pages shows an empty table and looks broken.
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.listUsers({ ...filters, search: search.trim() || undefined }));
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [filters, search, error]);

  useEffect(() => {
    adminApi.userStats().then(setStats).catch(() => setStats(null));
  }, []);

  // Debounced so typing a name is one request at the end, not one per letter.
  useEffect(() => {
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const cards: Array<{ label: string; value: number; hint: string; icon: typeof FiUsers; onClick: () => void }> =
    stats
      ? [
          { label: 'Total users', value: stats.total, hint: `${stats.verified} verified`, icon: FiUsers,
            onClick: () => set({ activity: 'all', source: 'all' }) },
          { label: `Active (${stats.activeWindowDays}d)`, value: stats.active, hint: `${stats.newThisWeek} joined this week`, icon: FiUserCheck,
            onClick: () => set({ activity: 'active' }) },
          { label: 'Gone quiet', value: stats.inactive + stats.never, hint: `${stats.never} never active`, icon: FiUserX,
            onClick: () => set({ activity: 'inactive' }) },
          { label: 'From a campaign', value: stats.fromCampaign, hint: `${stats.direct} signed up directly`, icon: FiBriefcase,
            onClick: () => set({ source: 'campaign' }) },
        ]
      : [];

  return (
    <main className="px-5 py-7 sm:px-8">
      <div className="mb-6">
        <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">
          {stats ? `${stats.total.toLocaleString()} accounts.` : 'Loading…'}
        </p>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              className="rounded-2xl border border-[var(--sf-line,#eee)] bg-white p-4 text-left transition-all hover:border-[var(--sf-violet)]"
            >
              <div className="flex items-center gap-2 text-[var(--sf-muted)]">
                <c.icon className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{c.label}</span>
              </div>
              <p className="mt-2 font-century text-2xl font-black text-[var(--sf-ink)]">
                {c.value.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-[var(--sf-muted)]">{c.hint}</p>
            </button>
          ))}
        </div>
      )}

      {/*
        Signup dates only exist from the day the column was added. Saying so is
        the difference between a chart that is missing history and a chart that
        is quietly wrong, and only one of those can be trusted.
      */}
      {stats && stats.undated > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {stats.undated.toLocaleString()} account{stats.undated === 1 ? '' : 's'} have no signup
            date — they were created before it was recorded, and sort last under
            &ldquo;newest&rdquo;. Running <code className="font-mono text-xs">npm run backfill:signup-dates</code>{' '}
            recovers a date for most of them.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-[var(--sf-line,#eee)] bg-white p-4">
        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sf-muted)]" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-[var(--sf-line,#eee)] bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Select
            value={filters.sort ?? 'newest'} onChange={(v) => set({ sort: v as AdminUserFilters['sort'] })}
            ariaLabel="Sort" className={TRIGGER}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'active', label: 'Recently active' },
              { value: 'inactive', label: 'Least recently active' },
              { value: 'name', label: 'Name (A–Z)' },
            ]}
          />
          <Select
            value={filters.activity ?? 'all'} onChange={(v) => set({ activity: v as AdminUserFilters['activity'] })}
            ariaLabel="Activity" className={TRIGGER}
            options={[
              { value: 'all', label: 'Any activity' },
              { value: 'active', label: `Active (${stats?.activeWindowDays ?? 30}d)` },
              { value: 'inactive', label: 'Gone quiet' },
              { value: 'never', label: 'Never active' },
            ]}
          />
          <Select
            value={filters.source ?? 'all'} onChange={(v) => set({ source: v as AdminUserFilters['source'] })}
            ariaLabel="Source" className={TRIGGER}
            options={[
              { value: 'all', label: 'Any source' },
              { value: 'campaign', label: 'Applied to a job' },
              { value: 'direct', label: 'Signed up directly' },
            ]}
          />
          <Select
            value={filters.verified ?? 'all'} onChange={(v) => set({ verified: v as AdminUserFilters['verified'] })}
            ariaLabel="Verified" className={TRIGGER}
            options={[
              { value: 'all', label: 'Any status' },
              { value: 'yes', label: 'Verified' },
              { value: 'no', label: 'Unverified' },
            ]}
          />
          <Select
            value={filters.availability ?? 'all'} onChange={(v) => set({ availability: v as AdminUserFilters['availability'] })}
            ariaLabel="Availability" className={TRIGGER}
            options={[
              { value: 'all', label: 'Any availability' },
              { value: 'looking', label: 'Looking' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--sf-line,#eee)] bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[var(--sf-line,#eee)] text-left text-xs uppercase tracking-wider text-[var(--sf-muted)]">
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3 font-bold">Last active</th>
              <th className="px-4 py-3 font-bold">Came from</th>
              <th className="px-4 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--sf-muted)]">Loading…</td></tr>
            )}
            {!loading && data?.users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--sf-muted)]">
                No users match those filters.
              </td></tr>
            )}
            {!loading && data?.users.map((u: AdminUser) => (
              <tr key={u.id} className="border-b border-[var(--sf-line,#f5f5f5)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-[var(--sf-ink)]">{u.name}</p>
                  <p className="text-xs text-[var(--sf-muted)]">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-[var(--sf-muted)]">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={u.lastActiveAt ? 'text-[var(--sf-ink)]' : 'text-[var(--sf-muted)]'}>
                    {fmtAgo(u.lastActiveAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.source === 'campaign' ? (
                    <>
                      <span className="rounded-lg bg-[#f5f1f7] px-2 py-1 text-xs font-semibold text-[var(--sf-violet)]">
                        Applied to a job
                      </span>
                      {u.sourceCampaignTitle && (
                        <p className="mt-1 text-xs text-[var(--sf-muted)]">{u.sourceCampaignTitle}</p>
                      )}
                    </>
                  ) : (
                    <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      Direct signup
                    </span>
                  )}
                  <p className="mt-1 text-xs text-[var(--sf-muted)]">via {u.signedUpWith}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'admin' && (
                      <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Admin</span>
                    )}
                    {!u.isVerified && (
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Unverified</span>
                    )}
                    {u.availability === 'suspended' && (
                      <span
                        title={u.suspensionReason ?? undefined}
                        className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                      >
                        Suspended
                      </span>
                    )}
                    {u.isVerified && u.availability === 'looking' && u.role !== 'admin' && (
                      <span className="text-xs text-[var(--sf-muted)]">Looking</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--sf-muted)]">
            Page {data.page} of {data.totalPages} · {data.total.toLocaleString()} users
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => set({ page: Math.max(1, (filters.page ?? 1) - 1) })}
              disabled={data.page <= 1}
              className="rounded-xl border border-[var(--sf-line,#eee)] p-2 disabled:opacity-40"
              aria-label="Previous page"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => set({ page: Math.min(data.totalPages, (filters.page ?? 1) + 1) })}
              disabled={data.page >= data.totalPages}
              className="rounded-xl border border-[var(--sf-line,#eee)] p-2 disabled:opacity-40"
              aria-label="Next page"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
