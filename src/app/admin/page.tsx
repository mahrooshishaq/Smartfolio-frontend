'use client';

/**
 * The admin home page.
 *
 * `/admin` had no page at all. Campaigns and Users were reachable by typing
 * their URLs, but the parent path matched no route — so Next fell through to
 * the ROOT not-found, which lives outside this segment and therefore outside
 * the admin layout. The layout is where the role gate runs, so the admin URL
 * answered "404 - Page Not Found" to anyone at all, signed in or not.
 *
 * Existing as a route is half the fix and the more important half: this renders
 * inside the admin layout, so the gate runs before any of it, and somebody who
 * is not an administrator sees the refusal rather than a page.
 *
 * What it shows is the overview neither section gives on its own — the size of
 * the user base next to what the campaigns are doing — and every number is a
 * link to the page that can explain it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiUsers, FiGrid, FiShield, FiArrowRight, FiUserCheck, FiBriefcase,
} from 'react-icons/fi';
import { adminApi, type AdminUserStats, type Campaign } from '@/lib/admin';

const FUNNEL: Array<[string, string]> = [
  ['applied', 'Applied'],
  ['shortlisted', 'Shortlisted'],
  ['invited', 'Invited'],
  ['completed', 'Interviewed'],
  ['submitted', 'Submitted'],
];

const SECTIONS = [
  { href: '/admin/campaigns', label: 'Campaigns', icon: FiGrid,
    desc: 'Create roles, review applicants and move people through the funnel.' },
  { href: '/admin/users', label: 'Users', icon: FiUsers,
    desc: 'Everyone on the platform, and whether they arrived by applying or signed up directly.' },
  { href: '/admin/verification', label: 'Verification', icon: FiShield,
    desc: 'Connection checks run against applicants.' },
];

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    // Independently: a failure on either side should not blank the other half
    // of the page, and neither is worth a toast on a landing screen.
    adminApi.userStats().then(setStats).catch(() => setStats(null));
    adminApi.listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  const live = (campaigns ?? []).filter((c) => c.status === 'collecting').length;
  const funnel = FUNNEL.map(([key]) =>
    (campaigns ?? []).reduce(
      (sum, c) => sum + (c.counts?.[key as keyof typeof c.counts] ?? 0),
      0,
    ),
  );

  const cards = [
    { label: 'Total users', value: stats?.total, hint: stats ? `${stats.verified.toLocaleString()} verified` : '',
      icon: FiUsers, href: '/admin/users' },
    { label: `Active (${stats?.activeWindowDays ?? 30}d)`, value: stats?.active,
      hint: stats ? `${stats.newThisWeek.toLocaleString()} joined this week` : '',
      icon: FiUserCheck, href: '/admin/users?activity=active' },
    { label: 'From a campaign', value: stats?.fromCampaign,
      hint: stats ? `${stats.direct.toLocaleString()} signed up directly` : '',
      icon: FiBriefcase, href: '/admin/users?source=campaign' },
    { label: 'Campaigns collecting', value: campaigns ? live : undefined,
      hint: campaigns ? `${campaigns.length} in total` : '',
      icon: FiGrid, href: '/admin/campaigns' },
  ];

  return (
    <main className="px-5 py-7 sm:px-8">
      <div className="mb-6">
        <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">
          How the platform is doing, and where to go next.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-[var(--sf-line,#eee)] bg-white p-4 transition-all hover:border-[var(--sf-violet)]"
          >
            <div className="flex items-center gap-2 text-[var(--sf-muted)]">
              <c.icon className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="mt-2 font-century text-2xl font-black text-[var(--sf-ink)]">
              {/* A dash while loading, never a zero — a zero is an answer. */}
              {c.value === undefined ? '—' : c.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-[var(--sf-muted)]">{c.hint || ' '}</p>
          </Link>
        ))}
      </div>

      {campaigns && campaigns.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[var(--sf-line,#eee)] bg-white p-5">
          <h2 className="mb-4 font-century text-base font-bold text-[var(--sf-ink)]">
            Across every campaign
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FUNNEL.map(([key, label], i) => (
              <div key={key} className="rounded-xl bg-[var(--sf-bg,#fafafa)] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--sf-muted)]">
                  {label}
                </p>
                <p className="mt-1 font-century text-xl font-black text-[var(--sf-ink)]">
                  {funnel[i].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-2xl border border-[var(--sf-line,#eee)] bg-white p-5 transition-all hover:border-[var(--sf-violet)]"
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-[var(--sf-violet)]" />
              <FiArrowRight className="h-4 w-4 text-[var(--sf-muted)] transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-3 font-century text-base font-bold text-[var(--sf-ink)]">{s.label}</p>
            <p className="mt-1 text-sm text-[var(--sf-muted)]">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
