'use client';

/**
 * The candidate's own job-seeking status.
 *
 * This is the only place a suspension can be lifted, and that is deliberate: it
 * exists to ask one question — "are you still looking?" — and only the person
 * can answer it. An operator clearing it for them would be answering on their
 * behalf, which is how a no-show ends up in front of a fourth company.
 *
 * The tone matters as much as the mechanism. Being put forward three times and
 * attending nothing usually means somebody took another job and forgot to say
 * so, not that they did anything wrong — so the copy explains and asks, it does
 * not accuse.
 */

import { useCallback, useEffect, useState } from 'react';
import { FiPause, FiPlay, FiInfo } from 'react-icons/fi';
import { adminApi } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';

type Availability = Awaited<ReturnType<typeof adminApi.availability>>;

export default function AvailabilityCard({ className = '' }: { className?: string }) {
  const { success, error, confirm } = useFeedback();
  const [state, setState] = useState<Availability | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await adminApi.availability());
    } catch {
      // A dashboard widget failing to load must not take the dashboard with it.
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;

  const suspended = state.availability === 'suspended';

  async function change(to: 'looking' | 'suspended') {
    if (to === 'suspended') {
      const ok = await confirm({
        title: 'Pause being put forward?',
        message:
          'We will stop submitting you to companies until you turn this back on. Applications you have already made are unaffected.',
        confirmLabel: 'Pause',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      await adminApi.setAvailability(to);
      success(
        to === 'looking'
          ? "You're back on. We'll start putting you forward again."
          : 'Paused. Turn it back on whenever you are ready.',
      );
      await load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not update your status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`sf-panel rounded-2xl p-5 ${className}`}
      data-testid="availability-card"
      data-availability={state.availability}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--sf-ink)]">Job search status</h2>
          <p className="mt-0.5 text-sm text-[var(--sf-muted)]">
            {suspended
              ? 'Paused — we are not putting you forward to companies right now.'
              : 'Active — we can put you forward to companies.'}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize"
          style={
            suspended
              ? { background: 'var(--sf-red-soft)', color: 'var(--sf-red)' }
              : { background: 'var(--sf-green-soft)', color: 'var(--sf-green)' }
          }
        >
          {suspended ? 'Paused' : 'Looking'}
        </span>
      </div>

      {suspended && state.suspensionReason && (
        <div className="mt-4 rounded-xl bg-[var(--sf-yellow-soft)] p-4">
          <div className="flex gap-2.5">
            <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sf-yellow)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--sf-ink)]">Why this paused</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
                {state.suspensionReason}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
                Nothing has been withdrawn and nothing is held against you — we just could not tell
                whether you were still looking. If you are, say so below.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Applications" value={state.applications} />
        <Stat label="Put forward to" value={state.submittedToCompanies} suffix="companies" />
        <Stat label="Interviews attended" value={state.interviewsAttended} />
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => change(suspended ? 'looking' : 'suspended')}
        className={
          'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ' +
          (suspended ? 'sf-primary' : 'sf-subtle-control')
        }
        data-testid="availability-toggle"
      >
        {suspended ? (
          <>
            <FiPlay className="h-4 w-4" /> Yes, I am still looking
          </>
        ) : (
          <>
            <FiPause className="h-4 w-4" /> Pause being put forward
          </>
        )}
      </button>

      {!suspended && state.submittedToCompanies > 0 && state.interviewsAttended === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
          You have been put forward to {state.submittedToCompanies} of {state.suspendsAfter}{' '}
          companies without attending an interview. After {state.suspendsAfter} we will pause and
          check in, so a company is never sent someone who has stopped looking.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-[#f8fbff] px-3 py-2.5">
      <div className="font-century text-lg font-bold text-[var(--sf-ink)]">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-[var(--sf-muted)]">
        {label}
        {suffix ? ` ${suffix}` : ''}
      </div>
    </div>
  );
}
