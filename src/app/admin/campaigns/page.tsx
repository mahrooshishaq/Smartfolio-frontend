'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiExternalLink } from 'react-icons/fi';
import { adminApi, type Campaign } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';
import StatusBadge from '@/components/admin/StatusBadge';

const FUNNEL: Array<[string, string]> = [
  ['applied', 'Applied'],
  ['shortlisted', 'Shortlisted'],
  ['invited', 'Invited'],
  ['completed', 'Interviewed'],
  ['submitted', 'Submitted'],
];

export default function AdminCampaignsPage() {
  const { error } = useFeedback();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const load = useCallback(async () => {
    try {
      setCampaigns(await adminApi.listCampaigns());
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load campaigns.');
      setCampaigns([]);
    }
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = FUNNEL.map(([key]) =>
    (campaigns ?? []).reduce((sum, c) => sum + (c.counts?.[key as keyof typeof c.counts] ?? 0), 0),
  );

  return (
    <main className="px-5 py-7 sm:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            {campaigns === null
              ? 'Loading…'
              : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="sf-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          data-testid="new-campaign"
        >
          <FiPlus className="h-4 w-4" /> New campaign
        </Link>
      </div>

      {campaigns && campaigns.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FUNNEL.map(([key, label], i) => (
            <div key={key} className="sf-panel rounded-2xl px-4 py-3.5">
              <div className="font-century text-2xl font-bold text-[var(--sf-ink)]">{totals[i]}</div>
              <div className="mt-0.5 text-xs text-[var(--sf-muted)]">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="sf-panel overflow-hidden rounded-2xl">
        <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_110px] gap-2 px-4 pb-2.5 pt-4 text-[11.5px] font-bold uppercase tracking-wide text-[var(--sf-muted-soft)] lg:grid">
          <span>Role</span>
          <span>Status</span>
          <span>Applied</span>
          <span>Shortlisted</span>
          <span />
        </div>

        {campaigns === null && (
          <p className="px-4 py-8 text-sm text-[var(--sf-muted)]">Loading campaigns…</p>
        )}

        {campaigns?.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-[var(--sf-ink)]">No campaigns yet</p>
            <p className="mx-auto mt-1 max-w-[400px] text-sm text-[var(--sf-muted)]">
              A campaign is one role: a public apply page, the applications it collects, and the
              interviews you invite people to.
            </p>
            <Link
              href="/admin/campaigns/new"
              className="sf-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              <FiPlus className="h-4 w-4" /> Create the first one
            </Link>
          </div>
        )}

        {campaigns?.map((campaign) => (
          <div
            key={campaign.id}
            className="grid grid-cols-1 gap-2 border-t border-[#edf3ff] px-4 py-4 lg:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_110px] lg:items-center"
            data-testid="campaign-row"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/campaigns/${campaign.id}`}
                className="text-sm font-bold text-[var(--sf-ink)] hover:text-[var(--sf-primary-dark)]"
              >
                {campaign.title}
              </Link>
              <div className="mt-0.5 truncate text-xs text-[var(--sf-muted-soft)]">
                {campaign.company} · /apply/{campaign.slug}
              </div>
            </div>

            <div className="lg:contents">
              <span className="inline-block lg:block">
                <StatusBadge status={campaign.status} />
              </span>
            </div>

            <div className="text-sm text-[var(--sf-ink-soft)]">
              <span className="mr-1.5 text-xs text-[var(--sf-muted-soft)] lg:hidden">Applied</span>
              {campaign.counts?.applied ?? 0}
            </div>
            <div className="text-sm text-[var(--sf-ink-soft)]">
              <span className="mr-1.5 text-xs text-[var(--sf-muted-soft)] lg:hidden">Shortlisted</span>
              {campaign.counts?.shortlisted ?? 0}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/admin/campaigns/${campaign.id}`}
                className="text-sm font-bold text-[var(--sf-primary-dark)]"
              >
                Open
              </Link>
              {campaign.status !== 'draft' && (
                <a
                  href={`/apply/${campaign.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--sf-muted)] hover:text-[var(--sf-primary-dark)]"
                  aria-label={`View the public apply page for ${campaign.title}`}
                >
                  <FiExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[var(--sf-muted-soft)]">
        Statuses only advance. A closed campaign cannot be reopened, because that would resurrect
        interview links that have already expired.
      </p>
    </main>
  );
}
