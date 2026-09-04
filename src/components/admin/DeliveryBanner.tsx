'use client';

/**
 * Warns when interview invitations cannot actually arrive.
 *
 * Two settings decide that and neither is visible from the screen where you
 * press Send. SMTP either works or the send throws, and the throw surfaces once,
 * in a toast. FRONTEND_URL is worse: nothing throws at all. The mail sends, the
 * link opens, and it opens on a DIFFERENT deployment of this app — where the
 * candidate's session does not exist, because sessions live in localStorage and
 * localStorage is per-origin. They are asked to log in to a site they have never
 * seen, from an email about a job they applied for.
 *
 * The mismatch is detectable right here without asking anyone: the browser knows
 * what origin this admin page is served from, and the backend reports the origin
 * it stamps into links. If those disagree, the emails are going somewhere else.
 */

import { useEffect, useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { adminApi } from '@/lib/admin';

type Diagnostics = Awaited<ReturnType<typeof adminApi.diagnostics>>;

export default function DeliveryBanner() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .diagnostics()
      .then((d) => !cancelled && setDiag(d))
      // Silent: a diagnostics failure must never be the reason an operator
      // cannot see the campaign they came here for.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!diag) return null;

  const problems: Array<{ title: string; detail: string }> = [];

  let linkOrigin: string | null = null;
  try {
    linkOrigin = new URL(diag.inviteLinkExample).origin;
  } catch {
    linkOrigin = null;
  }

  if (linkOrigin && typeof window !== 'undefined' && linkOrigin !== window.location.origin) {
    problems.push({
      title: 'Invitation emails point at a different site',
      detail:
        `Links are being sent as ${linkOrigin}, but you are working on ${window.location.origin}. ` +
        'Candidates who follow one will land where they have no session and be asked to log in again. ' +
        'Set FRONTEND_URL on the backend to this origin.',
    });
  }

  if (!diag.canDeliverInvitations) {
    problems.push({
      title: 'Email is not being delivered',
      detail:
        diag.mail.smtp === 'failed'
          ? `SMTP (${diag.mail.host ?? 'no host set'}) rejected the connection: ${diag.mail.error ?? 'no reason given'}.`
          : `The mail transport is "${diag.mail.smtp}". Invitations, OTPs and password resets will not arrive.`,
    });
  }

  if (!problems.length) return null;

  return (
    <div
      className="mb-5 rounded-2xl border border-[var(--sf-red-soft)] bg-[var(--sf-red-soft)] p-4"
      data-testid="delivery-banner"
    >
      <div className="flex gap-3">
        <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-red)]" />
        <div className="min-w-0">
          {problems.map((p) => (
            <div key={p.title} className="not-first:mt-3">
              <p className="text-sm font-bold text-[var(--sf-red)]">{p.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
                {p.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
