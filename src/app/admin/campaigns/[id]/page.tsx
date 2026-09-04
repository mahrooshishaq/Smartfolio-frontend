'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiChevronLeft, FiZap, FiSend, FiCheck, FiCopy, FiExternalLink } from 'react-icons/fi';
import { adminApi, type Campaign, type CampaignCandidate } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';
import StatusBadge from '@/components/admin/StatusBadge';

/**
 * The views an operator actually works in. Each answers one question:
 *   top      - who are the strongest CVs here?
 *   recent   - who has come in since I last looked?
 *   <status> - where is everyone in the process?
 */
const VIEWS: Array<{ id: string; label: string; status?: string; sort?: 'score' | 'recent' }> = [
  { id: 'top', label: 'Top CVs', sort: 'score' },
  { id: 'recent', label: 'Recently applied', sort: 'recent' },
  { id: 'shortlisted', label: 'Shortlisted', status: 'shortlisted', sort: 'score' },
  { id: 'invited', label: 'Invited', status: 'invited', sort: 'recent' },
  { id: 'completed', label: 'Interviewed', status: 'completed', sort: 'score' },
  { id: 'submitted', label: 'Submitted', status: 'submitted', sort: 'recent' },
];

export default function AdminCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { error, success, confirm } = useFeedback();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<CampaignCandidate[] | null>(null);
  const [view, setView] = useState('top');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([
        adminApi.getCampaign(id),
        adminApi.candidates(id, {
          status: VIEWS.find((v) => v.id === view)?.status,
          sort: VIEWS.find((v) => v.id === view)?.sort ?? 'score',
        }),
      ]);
      setCampaign(c);
      setCandidates(list.candidates);
      // Drop selections that are no longer on screen, so an action can never
      // apply to a row the operator can no longer see.
      setSelected((prev) => {
        const visible = new Set(list.candidates.map((x) => x.id));
        return new Set([...prev].filter((x) => visible.has(x)));
      });
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load this campaign.');
      setCandidates([]);
    }
  }, [id, view, error]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = campaign?.counts ?? {};
    return {
      applied: c.applied ?? 0,
      shortlisted: c.shortlisted ?? 0,
      invited: c.invited ?? 0,
      completed: c.completed ?? 0,
      submitted: c.submitted ?? 0,
      needsReview: (candidates ?? []).filter((x) => x.verification?.verdict === 'review').length,
    };
  }, [campaign, candidates]);

  const ids = () => [...selected];

  /** The full public URL, not the path — nobody can paste `/apply/x` into a DM. */
  async function copyApplyLink() {
    if (!campaign) return;
    const url = `${window.location.origin}/apply/${campaign.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). Show the URL so it can still be copied by hand rather than
      // failing with nothing to fall back on.
      error(`Copy failed — the link is ${url}`);
    }
  }

  async function act(action: 'shortlist' | 'submit' | 'reject') {
    if (!selected.size) return;
    if (action === 'reject') {
      const ok = await confirm({
        title: `Reject ${selected.size} candidate${selected.size === 1 ? '' : 's'}?`,
        message: 'The rows are kept — rejecting records the decision, it does not delete anyone.',
        confirmLabel: 'Reject',
        variant: 'danger',
      });
      if (!ok) return;
    }
    setBusy(action);
    try {
      const res = await adminApi.act(id, action, ids());
      success(`${res.updated} candidate${res.updated === 1 ? '' : 's'} → ${res.status}`);
      setSelected(new Set());
      await load();
    } catch (e) {
      error(e instanceof Error ? e.message : `Could not ${action}.`);
    } finally {
      setBusy(null);
    }
  }

  async function invite() {
    if (!selected.size) return;
    const ok = await confirm({
      title: `Send ${selected.size} interview invitation${selected.size === 1 ? '' : 's'}?`,
      message:
        'Each candidate gets a one-time link by email. The link cannot be recovered afterwards — only its hash is stored.',
      confirmLabel: 'Send invitations',
    });
    if (!ok) return;

    setBusy('invite');
    try {
      const res = await adminApi.invite(id, ids());
      if (res.failed.length) {
        error(`${res.sent} sent, ${res.failed.length} failed: ${res.failed[0].reason}`);
      } else {
        success(`${res.sent} invitation${res.sent === 1 ? '' : 's'} sent.`);
      }
      setSelected(new Set());
      await load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not send invitations.');
    } finally {
      setBusy(null);
    }
  }

  async function runMatch() {
    setBusy('match');
    try {
      const res = await adminApi.runMatch(id);
      success(`Scored ${res.scored} profiles — ${res.created} added, ${res.updated} rescored.`);
      await load();
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not run matching.');
    } finally {
      setBusy(null);
    }
  }

  async function advance(status: string) {
    // Status only ever advances — a closed campaign cannot reopen, because that
    // would resurrect invite links that have already expired. So the one that
    // takes a live campaign off the market gets a confirmation; a misclick here
    // is not recoverable.
    if (status === 'shortlisting') {
      const ok = await confirm({
        title: 'Close applications for this role?',
        message:
          'The public apply page stops accepting new applications, and this cannot be undone — campaign status only moves forward.',
        confirmLabel: 'Close applications',
        variant: 'danger',
      });
      if (!ok) return;
    }

    try {
      const updated = await adminApi.updateCampaign(id, { status });
      setCampaign(updated);
      success(`Campaign is now ${updated.status}.`);
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not change the status.');
    }
  }

  const allVisibleSelected =
    (candidates?.length ?? 0) > 0 && selected.size === (candidates?.length ?? 0);

  return (
    <main className="px-5 py-7 sm:px-8">
      <Link
        href="/admin/campaigns"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--sf-muted)] hover:text-[var(--sf-primary-dark)]"
      >
        <FiChevronLeft className="h-4 w-4" /> Campaigns
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">
            {campaign?.title ?? 'Loading…'}
          </h1>
          {campaign && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--sf-muted)]">
              <span className="font-semibold text-[var(--sf-ink-soft)]">{campaign.company}</span>
              <a
                href={`/apply/${campaign.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--sf-primary-dark)]"
              >
                /apply/{campaign.slug}
                <FiExternalLink className="h-3.5 w-3.5" />
              </a>
              {/* The apply link is the thing that gets pasted into LinkedIn, a
                  DM or an email a dozen times a day. Copying it by selecting a
                  fragment of a breadcrumb is the kind of small friction that
                  makes an internal tool annoying to use. */}
              <button
                type="button"
                onClick={copyApplyLink}
                className="sf-subtle-control inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
                data-testid="copy-apply-link"
              >
                {copied ? (
                  <>
                    <FiCheck className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <FiCopy className="h-3.5 w-3.5" /> Copy link
                  </>
                )}
              </button>
              <StatusBadge status={campaign.status} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaign?.status === 'draft' && (
            <button
              type="button"
              onClick={() => advance('collecting')}
              className="sf-primary rounded-xl px-4 py-2 text-sm font-bold"
              data-testid="open-applications"
            >
              Open for applications
            </button>
          )}
          {campaign?.status === 'collecting' && (
            <button
              type="button"
              onClick={() => advance('shortlisting')}
              className="sf-subtle-control rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Close applications
            </button>
          )}
          <Link
            href={`/admin/campaigns/${id}/edit`}
            className="sf-subtle-control rounded-xl px-4 py-2 text-sm font-semibold"
            data-testid="edit-campaign"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={runMatch}
            disabled={busy === 'match'}
            className="sf-subtle-control inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            data-testid="run-match"
          >
            <FiZap className="h-4 w-4" /> {busy === 'match' ? 'Matching…' : 'Run match'}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Applied" value={counts.applied} />
        <Stat label="Shortlisted" value={counts.shortlisted} />
        <Stat label="Invited" value={counts.invited} />
        <Stat label="Interviewed" value={counts.completed} />
        <Stat label="Need review" value={counts.needsReview} tone="var(--sf-yellow)" />
        <Stat
          label="Blocked by the check"
          value={campaign?.verification?.blocked ?? 0}
          tone={campaign?.verification?.blocked ? 'var(--sf-red)' : undefined}
        />
      </div>

      {/* What the connection check did to this campaign's traffic.
          `blockedNeverApplied` is the number that matters: those people are not
          in the candidate list at all, so without this line a check quietly
          rejecting everyone looks identical to one working perfectly. */}
      {campaign?.verification && campaign.verification.peopleChecked > 0 && (
        <div className="sf-panel mb-5 rounded-2xl p-4" data-testid="verification-funnel">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-bold text-[var(--sf-ink)]">Connection check</h2>
            <span className="text-xs text-[var(--sf-muted-soft)]">
              {campaign.verification.peopleChecked} people · {campaign.verification.totalChecks}{' '}
              checks
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Tally label="Passed" value={campaign.verification.clean} tone="var(--sf-green)" />
            <Tally
              label="Sent for review"
              value={campaign.verification.needsReview}
              tone="var(--sf-yellow)"
            />
            <Tally label="Blocked" value={campaign.verification.blocked} tone="var(--sf-red)" />
            <Tally
              label="Blocked, then fixed it and applied"
              value={campaign.verification.blockedThenApplied}
              tone="var(--sf-ink-soft)"
            />
            <Tally
              label="Blocked and never applied"
              value={campaign.verification.blockedNeverApplied}
              tone="var(--sf-red)"
            />
          </div>

          {campaign.verification.blockedNeverApplied > 0 &&
            campaign.verification.blockedThenApplied === 0 &&
            campaign.verification.blocked >= 3 && (
              <p className="mt-3 rounded-xl bg-[var(--sf-yellow-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--sf-ink-soft)]">
                Everyone blocked here left rather than fixing it, and nobody got through. That
                pattern is worth a look before assuming it is fraud — if applicants are all being
                blocked for the same reason, the check may be seeing something other than their own
                connection.
              </p>
            )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" data-testid="candidate-views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              data-testid={`view-${v.id}`}
              className={
                'rounded-xl px-3.5 py-2 text-sm transition-colors ' +
                (view === v.id
                  ? 'bg-[var(--sf-primary-soft)] font-bold text-[var(--sf-primary-dark)]'
                  : 'sf-subtle-control font-semibold')
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-[var(--sf-muted)]">
          {candidates?.length ?? 0} shown ·{' '}
          {VIEWS.find((v) => v.id === view)?.sort === 'recent' ? 'newest first' : 'best match first'}
        </span>

        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2" data-testid="bulk-actions">
            <span className="text-sm font-semibold text-[var(--sf-ink-soft)]">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={() => act('shortlist')}
              disabled={busy !== null}
              className="sf-subtle-control inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
              data-testid="action-shortlist"
            >
              <FiCheck className="h-4 w-4" /> Shortlist
            </button>
            <button
              type="button"
              onClick={invite}
              disabled={busy !== null}
              className="sf-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold disabled:opacity-50"
              data-testid="action-invite"
            >
              <FiSend className="h-4 w-4" /> {busy === 'invite' ? 'Sending…' : 'Invite'}
            </button>
            <button
              type="button"
              onClick={() => act('submit')}
              disabled={busy !== null}
              className="sf-subtle-control rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Submit to company
            </button>
            <button
              type="button"
              onClick={() => act('reject')}
              disabled={busy !== null}
              className="rounded-xl border border-[var(--sf-red-soft)] bg-[var(--sf-red-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--sf-red)] disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      <div className="sf-panel overflow-hidden rounded-2xl">
        <div className="hidden grid-cols-[40px_minmax(0,1.8fr)_72px_1.1fr_1.2fr_1.2fr_112px] gap-2 px-4 pb-2.5 pt-4 text-[11.5px] font-bold uppercase tracking-wide text-[var(--sf-muted-soft)] lg:grid">
          <span>
            <input
              type="checkbox"
              aria-label="Select every candidate shown"
              checked={allVisibleSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set((candidates ?? []).map((c) => c.id)) : new Set())
              }
              className="h-[17px] w-[17px] accent-[var(--sf-primary)]"
            />
          </span>
          <span>Candidate</span>
          <span>Match</span>
          <span>CV</span>
          <span>Elsewhere</span>
          <span>Verification</span>
          <span>Status</span>
        </div>

        {candidates === null && (
          <p className="px-4 py-8 text-sm text-[var(--sf-muted)]">Loading candidates…</p>
        )}

        {candidates?.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-[var(--sf-ink)]">Nobody here yet</p>
            <p className="mx-auto mt-1 max-w-[420px] text-sm text-[var(--sf-muted)]">
              Applications arrive through the public page. You can also rank existing users against
              the description with <strong>Run match</strong>.
            </p>
          </div>
        )}

        {candidates?.map((c) => {
          const needsReview = c.verification?.verdict === 'review';
          return (
            <div
              key={c.id}
              data-testid="candidate-row"
              className={
                'grid grid-cols-1 gap-2 border-t border-[#edf3ff] px-4 py-3.5 lg:grid-cols-[40px_minmax(0,1.8fr)_72px_1.1fr_1.2fr_1.2fr_112px] lg:items-center ' +
                (needsReview ? 'bg-[#fffdf7]' : '')
              }
            >
              <span>
                <input
                  type="checkbox"
                  aria-label={`Select ${c.name ?? c.email ?? 'candidate'}`}
                  checked={selected.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setSelected(next);
                  }}
                  className="h-[17px] w-[17px] accent-[var(--sf-primary)]"
                />
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-[var(--sf-ink)]">
                    {c.name ?? 'Unnamed'}
                  </span>
                  {c.availability === 'suspended' && (
                    <span
                      title={c.suspensionReason ?? 'Not currently accepting submissions'}
                      className="shrink-0 rounded-full bg-[var(--sf-red-soft)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--sf-red)]"
                      data-testid="candidate-suspended"
                    >
                      Suspended
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-[var(--sf-muted-soft)]">
                  {c.email} · {c.source === 'public_apply' ? 'applied' : 'matched'}
                </div>
              </div>

              <div className="text-sm font-bold text-[var(--sf-ink-soft)]">
                {c.matchScore ? Math.round(Number(c.matchScore)) : '—'}
              </div>

              <div className="min-w-0 text-sm">
                {c.cv ? (
                  c.cv.analyzable ? (
                    <a
                      href={`/api/resume/${c.cv.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-semibold text-[var(--sf-primary-dark)]"
                      data-testid="candidate-cv"
                    >
                      {c.cv.fileName}
                    </a>
                  ) : (
                    <span
                      className="text-xs text-[var(--sf-muted-soft)]"
                      title="The record survived but the file did not — nothing to open."
                    >
                      {c.cv.fileName} (unavailable)
                    </span>
                  )
                ) : (
                  <span className="text-xs text-[var(--sf-muted-soft)]">No CV</span>
                )}
              </div>

              <div className="text-sm text-[var(--sf-muted)]">
                {c.elsewhere.applications === 0 ? (
                  <span className="text-xs text-[var(--sf-muted-soft)]">First application</span>
                ) : (
                  <span
                    className="text-xs"
                    title={
                      c.elsewhere.companies.length
                        ? `Submitted to ${c.elsewhere.companies.join(', ')}`
                        : undefined
                    }
                  >
                    {c.elsewhere.applications} other
                    {c.elsewhere.submissions > 0 && (
                      <>
                        {' · '}
                        <strong
                          className={
                            c.elsewhere.submissions >= 2 && c.elsewhere.interviews === 0
                              ? 'text-[var(--sf-yellow)]'
                              : ''
                          }
                        >
                          {c.elsewhere.submissions} submitted
                        </strong>
                      </>
                    )}
                    {c.elsewhere.submissions > 0 && c.elsewhere.interviews === 0 && (
                      <span className="block text-[11px] text-[var(--sf-yellow)]">
                        no interview attended
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                {c.verification ? (
                  <>
                    <StatusBadge status={c.verification.verdict} />
                    {c.verification.findings?.length > 0 && (
                      <div className="mt-1 truncate text-[11.5px] text-[var(--sf-muted)]">
                        {c.verification.findings[0].detail}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[var(--sf-muted-soft)]">Not checked</span>
                )}
              </div>

              <div>
                <StatusBadge status={c.status} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 max-w-[640px] text-xs leading-relaxed text-[var(--sf-muted-soft)]">
        A review verdict never removes anyone from this list. It marks a candidate a person should
        look at before inviting — a shared device or a country mismatch both have ordinary
        explanations, and internet cafés and family computers are normal in these markets.
      </p>

    </main>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <strong className="font-century text-base font-bold" style={{ color: tone }}>
        {value}
      </strong>
      <span className="text-[13px] text-[var(--sf-muted)]">{label}</span>
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="sf-panel rounded-2xl px-4 py-3.5">
      <div
        className="font-century text-xl font-bold"
        style={{ color: tone ?? 'var(--sf-ink)' }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[var(--sf-muted)]">{label}</div>
    </div>
  );
}
