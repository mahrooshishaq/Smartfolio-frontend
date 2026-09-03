'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi, type DeviceCluster, type VerificationSessionRow } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';
import StatusBadge from '@/components/admin/StatusBadge';

export default function AdminVerificationPage() {
  const { error } = useFeedback();
  const [clusters, setClusters] = useState<DeviceCluster[] | null>(null);
  const [sessions, setSessions] = useState<VerificationSessionRow[] | null>(null);
  const [lists, setLists] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        adminApi.clusters(),
        adminApi.verificationSessions(),
      ]);
      setClusters(c.clusters);
      setSessions(s.sessions);
      setLists(s.lists);
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load verification data.');
      setClusters([]);
      setSessions([]);
    }
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = (sessions ?? []).filter(
    (s) => s.verdict === 'review' || s.verdict === 'blocked',
  );

  return (
    <main className="px-5 py-7 sm:px-8">
      <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">Verification</h1>
      <p className="mt-1.5 max-w-[660px] text-sm leading-relaxed text-[var(--sf-muted)]">
        Everything is recorded, nothing is acted on automatically. A cluster is a lead for a person
        to look at — internet cafés, family computers and shared office machines all produce genuine
        matches.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          value={num(lists?.torListSize)}
          label="Tor exits loaded"
          hint={lists?.torLoadedAt ? ago(String(lists.torLoadedAt)) : 'not loaded'}
        />
        <Stat
          value={num(lists?.dcRangeCount)}
          label="Datacenter ranges"
          hint={lists?.dcLoadedAt ? ago(String(lists.dcLoadedAt)) : 'not loaded'}
        />
        <Stat value={sessions?.length ?? 0} label="Recent checks" hint="newest first" />
        <Stat
          value={attention.length}
          label="Waiting on a human"
          hint="never auto-rejected"
          tone="var(--sf-yellow)"
        />
      </div>

      {lists && (num(lists.torListSize) === 0 || num(lists.dcRangeCount) === 0) && (
        <div className="sf-panel mt-4 rounded-2xl border-l-4 border-l-[var(--sf-yellow)] p-4">
          <p className="text-sm font-semibold text-[var(--sf-ink)]">A threat list is empty</p>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            The rules that depend on it are skipped rather than blocking anyone — the check fails
            open on purpose. It refills on the next refresh.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section>
          <h2 className="text-base font-bold text-[var(--sf-ink)]">Shared devices</h2>
          <p className="mb-3 mt-1 text-sm text-[var(--sf-muted)]">
            One machine, more than one account. Weak signatures — phones, privacy browsers — are
            never linked and never appear here.
          </p>

          <div className="sf-panel overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-[140px_minmax(0,1fr)_70px_90px] gap-2 px-4 pb-2.5 pt-4 text-[11.5px] font-bold uppercase tracking-wide text-[var(--sf-muted-soft)] sm:grid">
              <span>Signature</span>
              <span>Accounts</span>
              <span>Checks</span>
              <span>Last seen</span>
            </div>

            {clusters === null && (
              <p className="px-4 py-8 text-sm text-[var(--sf-muted)]">Loading…</p>
            )}

            {clusters?.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--sf-ink)]">No shared devices</p>
                <p className="mx-auto mt-1 max-w-[380px] text-sm text-[var(--sf-muted)]">
                  Nothing to look at. The first cluster you did not create yourself is the signal
                  that someone thinks this is worth attacking.
                </p>
              </div>
            )}

            {clusters?.map((c) => (
              <div
                key={c.deviceSignature}
                data-testid="cluster-row"
                className="grid grid-cols-1 gap-1.5 border-t border-[#edf3ff] px-4 py-3.5 sm:grid-cols-[140px_minmax(0,1fr)_70px_90px] sm:items-center sm:gap-2"
              >
                <code className="truncate font-mono text-xs text-[var(--sf-violet)]">
                  {c.deviceSignature.slice(0, 12)}…
                </code>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--sf-ink)]">
                    {c.names.length ? c.names.join(', ') : `${c.accounts} accounts`}
                  </div>
                  <div className="truncate text-xs text-[var(--sf-muted-soft)]">
                    {c.emails.join(', ')}
                  </div>
                </div>
                <div className="text-sm text-[var(--sf-ink-soft)]">{c.sessions}</div>
                <div className="text-xs text-[var(--sf-muted)]">{ago(c.lastSeen)}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-[var(--sf-ink)]">Waiting on a human</h2>
          <p className="mb-3 mt-1 text-sm text-[var(--sf-muted)]">
            Contradictions, never rejections. Most have an ordinary explanation.
          </p>

          <div className="flex flex-col gap-2.5">
            {sessions === null && (
              <p className="px-1 py-4 text-sm text-[var(--sf-muted)]">Loading…</p>
            )}

            {sessions?.length !== undefined && attention.length === 0 && (
              <div className="sf-panel rounded-2xl px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[var(--sf-ink)]">Nothing needs a decision</p>
                <p className="mt-1 text-sm text-[var(--sf-muted)]">
                  Every recent check came back clean.
                </p>
              </div>
            )}

            {attention.map((s) => (
              <div key={s.id} className="sf-panel rounded-2xl p-4" data-testid="attention-row">
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-[var(--sf-ink)]">
                    {s.userId ? s.userId.slice(0, 8) : 'Anonymous applicant'}
                  </span>
                  <StatusBadge status={s.verdict} />
                </div>
                <p className="mb-2.5 text-xs leading-relaxed text-[var(--sf-muted)]">
                  {s.findings.find((f) => f.level !== 'note')?.detail ?? 'No blocking finding.'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.findings
                    .filter((f) => f.level !== 'note')
                    .map((f) => (
                      <span
                        key={f.code}
                        className="rounded-lg border border-[#edf3ff] bg-[#f8fbff] px-2 py-1 text-[11.5px] font-semibold text-[var(--sf-ink-soft)]"
                      >
                        {f.code}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
  hint,
  tone,
}: {
  value: number;
  label: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="sf-panel rounded-2xl px-4 py-3.5">
      <div className="font-century text-xl font-bold" style={{ color: tone ?? 'var(--sf-ink)' }}>
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs text-[var(--sf-muted)]">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--sf-muted-soft)]">{hint}</div>}
    </div>
  );
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '—';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
