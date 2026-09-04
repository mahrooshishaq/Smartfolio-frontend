'use client';

/**
 * The interviews a candidate has been invited to.
 *
 * This page exists because of a gap that had no UI at all. An invite token is
 * hashed the moment it is issued, so the emailed link is the only copy that will
 * ever exist — and if that email was deleted, filtered, or sent to an address
 * somebody no longer reads, the interview was unreachable. The reminder could
 * not help either: it cannot resend a link it does not hold, so it pointed at
 * the dashboard, which showed practice sessions and never mentioned the
 * invitation.
 *
 * Opening one mints a fresh link against the signed-in account. That is not a
 * hole in the hashing: what hashing defends against is a stolen database handing
 * out working interviews, and proving who you are first defeats nothing.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiSend, FiClock, FiCheckCircle, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { invitationsApi, daysLeft, type Invitation } from '@/lib/invitations';
import { useFeedback } from '@/components/ui/feedback';

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The urgency line. Deliberately concrete — "3 days left" beats a raw date. */
function Deadline({ invitation }: { invitation: Invitation }) {
  if (invitation.state === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sf-green)]">
        <FiCheckCircle className="h-3.5 w-3.5" />
        Completed {formatDate(invitation.completedAt)}
      </span>
    );
  }
  if (invitation.state === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sf-muted)]">
        <FiAlertCircle className="h-3.5 w-3.5" />
        Closed {formatDate(invitation.expiresAt)}
      </span>
    );
  }
  const days = daysLeft(invitation.expiresAt);
  const urgent = days !== null && days <= 3;
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 text-[13px] font-semibold ' +
        (urgent ? 'text-[var(--sf-red)]' : 'text-[var(--sf-ink-soft)]')
      }
    >
      <FiClock className="h-3.5 w-3.5" />
      {days === null
        ? `Open until ${formatDate(invitation.expiresAt)}`
        : days === 1
          ? 'Closes tomorrow'
          : `${days} days left`}
    </span>
  );
}

function InterviewsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sent here by the interview page when the handoff was gone — a cleared
  // session, a bookmarked URL, a second tab. Saying so beats a list that
  // silently appeared for no reason the candidate can see.
  const resumed = searchParams.get('resume') === '1';
  const { error } = useFeedback();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvitations(await invitationsApi.list());
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load your interviews.');
      setInvitations([]);
    }
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(invitation: Invitation) {
    setOpening(invitation.candidateId);
    try {
      const { path } = await invitationsApi.open(invitation.candidateId);
      router.push(path);
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not open this interview.');
      // The reason is usually a state change — expired, or already taken — so
      // reload rather than leaving a stale row that will fail the same way.
      void load();
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className="px-5 py-7 sm:px-8" data-testid="interviews-page">
      <h1 className="text-2xl font-bold text-[var(--sf-ink)]">My interviews</h1>

      {resumed && (
        <div
          className="mt-4 max-w-[620px] rounded-2xl border border-[var(--sf-yellow-soft)] bg-[var(--sf-yellow-soft)] p-4"
          data-testid="resume-notice"
        >
          <p className="text-sm font-semibold text-[var(--sf-ink)]">
            That interview link had already been used to open a session
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
            Nothing is lost. Start it again below. You are signed in, so we know it is you.
          </p>
        </div>
      )}
      <p className="mt-2 max-w-[620px] text-sm text-[var(--sf-muted)]">
        Interviews you have been invited to. You can start one from here even if you no longer have
        the invitation email. You are signed in, which is all we need to know it is you.
      </p>

      {invitations === null && (
        <p className="mt-6 text-sm text-[var(--sf-muted)]">Loading…</p>
      )}

      {invitations?.length === 0 && (
        <div className="sf-card mt-6 max-w-[620px] p-6" data-testid="interviews-empty">
          <FiSend className="h-5 w-5 text-[var(--sf-muted)]" />
          <h2 className="mt-3 text-base font-bold text-[var(--sf-ink)]">No invitations yet</h2>
          <p className="mt-1.5 text-sm text-[var(--sf-muted)]">
            When a recruiter invites you to interview for a role you applied to, it appears here and
            you get an email. Nothing to do until then.
          </p>
        </div>
      )}

      {invitations && invitations.length > 0 && (
        <ul className="mt-6 max-w-[760px] space-y-3" data-testid="interviews-list">
          {invitations.map((invitation) => (
            <li
              key={invitation.candidateId}
              className="sf-card p-5"
              data-testid="invitation-row"
              data-state={invitation.state}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[var(--sf-ink)]">{invitation.role}</h2>
                  <p className="mt-0.5 text-sm text-[var(--sf-muted)]">{invitation.company}</p>
                  <div className="mt-2.5">
                    <Deadline invitation={invitation} />
                  </div>
                </div>

                {invitation.state === 'open' && (
                  <button
                    type="button"
                    onClick={() => open(invitation)}
                    disabled={opening !== null}
                    className="sf-primary inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                    data-testid="open-invitation"
                  >
                    {opening === invitation.candidateId ? 'Opening…' : 'Start interview'}
                    <FiArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {invitation.state === 'expired' && (
                <p className="mt-3 border-t border-[var(--sf-line)] pt-3 text-[13px] text-[var(--sf-muted)]">
                  This interview closed before it was taken. If you still want to be considered,
                  reply to the invitation email and ask the recruiter to reopen it. The deadline is
                  theirs to set, not ours.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * useSearchParams opts the whole route into client-side rendering unless it
 * sits behind a Suspense boundary, which would cost this page its static shell.
 */
export default function InterviewsPage() {
  return (
    <Suspense fallback={<main className="px-5 py-7 sm:px-8"><p className="text-sm text-[var(--sf-muted)]">Loading…</p></main>}>
      <InterviewsInner />
    </Suspense>
  );
}
