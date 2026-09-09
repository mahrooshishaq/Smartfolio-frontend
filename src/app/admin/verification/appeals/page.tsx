'use client';

/**
 * Checks the candidate says got it wrong.
 *
 * A queue rather than a report: every row is a person who cannot apply, or
 * thinks they were wrongly flagged, and is waiting. Oldest first for that
 * reason — the one who has waited longest is the one most likely to have given
 * up already.
 *
 * Deciding an appeal never rewrites the verdict. The check saw what it saw, and
 * editing that to match a later judgement would destroy the only record of how
 * the rules actually behave — which is precisely what tells you a rule is
 * producing false positives. The rate of accepted appeals per finding is the
 * signal worth having, and it only exists if the original stands.
 */

import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiX, FiInbox } from 'react-icons/fi';
import { adminApi, type AdminAppeal } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';
import { Select } from '@/components/ui/Select';
import VerificationTabs from '@/components/admin/VerificationTabs';

/** Same codes the applicant picked from, in the words they saw. */
const REASONS: Record<string, string> = {
  not_using_vpn: 'Not using a VPN or proxy',
  employer_vpn: 'Employer requires a VPN they cannot turn off',
  travelling: 'Travelling — the country they chose is where they are',
  isp_routing: 'ISP routes through another country',
  mobile_network: 'On mobile data',
  wrong_country_detected: 'The detected country is wrong',
  other: 'Something else',
};

type Status = 'open' | 'accepted' | 'declined' | 'all';

export default function AdminAppealsPage() {
  const { error, success } = useFeedback();
  const [status, setStatus] = useState<Status>('open');
  const [appeals, setAppeals] = useState<AdminAppeal[] | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [current, open] = await Promise.all([
        adminApi.listAppeals(status),
        status === 'open' ? null : adminApi.listAppeals('open'),
      ]);
      setAppeals(current.appeals);
      setOpenCount(open ? open.count : current.count);
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load appeals.');
      setAppeals([]);
    }
  }, [status, error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(a: AdminAppeal, decision: 'accepted' | 'declined') {
    setBusy(a.id);
    try {
      await adminApi.resolveAppeal(a.id, decision, notes[a.id]?.trim() || undefined);
      success(decision === 'accepted' ? 'Marked as our mistake.' : 'Verdict stands.');
      await load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not save that decision.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="px-5 py-7 sm:px-8">
      <div className="mb-5">
        <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">Connection checks</h1>
        <p className="mt-1.5 max-w-[660px] text-sm leading-relaxed text-[var(--sf-muted)]">
          People telling us a check got it wrong. Accepting one records that we were mistaken; it
          does not rewrite what the check saw, so the pattern stays visible.
        </p>
      </div>

      <VerificationTabs openAppeals={openCount} />

      <div className="mb-4 max-w-[220px]">
        <Select
          value={status}
          onChange={(v) => setStatus(v as Status)}
          ariaLabel="Appeal status"
          className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3 py-2 text-sm"
          options={[
            { value: 'open', label: 'Waiting on us' },
            { value: 'accepted', label: 'We were wrong' },
            { value: 'declined', label: 'Verdict stood' },
            { value: 'all', label: 'All appeals' },
          ]}
        />
      </div>

      {appeals === null && <p className="text-sm text-[var(--sf-muted)]">Loading…</p>}

      {appeals?.length === 0 && (
        <div className="sf-card flex flex-col items-center rounded-2xl p-10 text-center">
          <FiInbox className="h-7 w-7 text-[var(--sf-muted-soft)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--sf-ink)]">
            {status === 'open' ? 'Nothing waiting' : 'Nothing here'}
          </p>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            {status === 'open'
              ? 'No candidate is currently disputing a check.'
              : 'No appeals with that status.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {appeals?.map((a) => (
          <div key={a.id} className="sf-card rounded-2xl p-5" data-testid="appeal-row">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--sf-ink)]">{a.name ?? 'Unknown'}</p>
                <p className="text-xs text-[var(--sf-muted)]">{a.email ?? a.userId}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    'rounded-lg px-2 py-1 text-xs font-semibold ' +
                    (a.verdict === 'blocked'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700')
                  }
                >
                  {a.verdict === 'blocked' ? 'Was blocked' : 'Was flagged'}
                </span>
                {a.appealStatus !== 'open' && (
                  <span
                    className={
                      'rounded-lg px-2 py-1 text-xs font-semibold ' +
                      (a.appealStatus === 'accepted'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600')
                    }
                  >
                    {a.appealStatus === 'accepted' ? 'We were wrong' : 'Verdict stood'}
                  </span>
                )}
              </div>
            </div>

            {/* The comparison the whole dispute is about, stated plainly. */}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-[var(--sf-bg,#fafafa)] px-3 py-2 text-[13px]">
              <span className="text-[var(--sf-muted)]">
                They said:{' '}
                <span className="font-semibold text-[var(--sf-ink)]">
                  {a.declaredCountry ?? '—'}
                </span>
              </span>
              <span className="text-[var(--sf-muted)]">
                We detected:{' '}
                <span className="font-semibold text-[var(--sf-ink)]">
                  {a.detectedCountry ?? 'could not tell'}
                </span>
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold text-[var(--sf-ink)]">
              {REASONS[a.appealReason ?? ''] ?? a.appealReason ?? 'No reason given'}
            </p>
            {a.appealNote && (
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--sf-muted)]">
                “{a.appealNote}”
              </p>
            )}

            {a.findings.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {a.findings.map((f, i) => (
                  <li
                    key={`${f.code}-${i}`}
                    title={f.detail}
                    className="rounded-lg bg-[#f5f1f7] px-2 py-1 text-xs text-[var(--sf-violet)]"
                  >
                    {f.code}
                  </li>
                ))}
              </ul>
            )}

            {a.appealStatus === 'open' ? (
              <div className="mt-4 border-t border-[var(--sf-border)] pt-3">
                <input
                  value={notes[a.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  placeholder="What did you find? (optional, kept internally)"
                  maxLength={1000}
                  className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3 py-2 text-[13px]"
                />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => void decide(a, 'accepted')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-60"
                    data-testid="appeal-accept"
                  >
                    <FiCheck className="h-4 w-4" /> We were wrong
                  </button>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => void decide(a, 'declined')}
                    className="sf-subtle-control inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-60"
                    data-testid="appeal-decline"
                  >
                    <FiX className="h-4 w-4" /> Verdict stands
                  </button>
                </div>
              </div>
            ) : (
              a.appealResolutionNote && (
                <p className="mt-3 border-t border-[var(--sf-border)] pt-3 text-[13px] text-[var(--sf-muted)]">
                  {a.appealResolutionNote}
                </p>
              )
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
