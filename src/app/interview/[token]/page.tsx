'use client';

/**
 * The interview invite gate.
 *
 * An invite link is a credential, so this page does three things in order and
 * refuses to skip any of them:
 *
 *   1. Validate the token publicly - so an expired link says "expired" rather
 *      than bouncing someone to a login screen for no reason.
 *   2. Require a signed-in account. The token says WHICH invitation; the login
 *      says WHO. A forwarded link must not let somebody else sit the interview.
 *   3. Run the connection check, then hand over to the existing interview.
 *
 * The interview itself is not reimplemented here. The mock-interview controller
 * is guarded end to end (generate, submit, TTS, transcription); rebuilding that
 * against a token-only scheme would double a large, sensitive surface to save
 * one login.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FiClock, FiShield, FiCalendar, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import BrandMark from '@/components/BrandMark';
import VerificationGate from '@/components/verification/VerificationGate';
import { publicFetch, getAccessToken } from '@/lib/api';
import { rememberPostAuthPath } from '@/lib/post-auth';
import { stashCampaignInterview, CAMPAIGN_PARAM } from '@/lib/campaign-interview';
import type { VerificationResult } from '@/lib/verification/collector';

type Invite = {
  candidateId: string;
  userId: string;
  status: string;
  expiresAt: string | null;
  campaign: {
    id: string;
    slug: string;
    title: string;
    company: string;
    jobDescription: string;
  };
};

type Stage = 'loading' | 'gone' | 'invalid' | 'intro' | 'checking' | 'ready';

export default function InterviewInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const signedIn = typeof window !== 'undefined' && Boolean(getAccessToken());

  const load = useCallback(async () => {
    try {
      const res = await publicFetch(`/api/campaigns/invite/${token}`);
      if (res.status === 410) {
        const body = await res.json().catch(() => null);
        setMessage(body?.message ?? 'This interview link has closed.');
        setStage('gone');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage(body?.message ?? 'This interview link is not valid.');
        setStage('invalid');
        return;
      }
      setInvite(await res.json());
      setStage('intro');
    } catch {
      setMessage('We could not reach the server. Please try again in a moment.');
      setStage('invalid');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function begin() {
    if (!signedIn) {
      // Straight back here after signing in - a candidate should never have to
      // dig the invitation out of their email a second time.
      rememberPostAuthPath(`/interview/${token}`);
      router.push('/login');
      return;
    }
    setStage('checking');
  }

  function onChecked(result: VerificationResult) {
    if (result.verdict === 'blocked') return; // the gate explains what to change
    setStage('ready');
  }

  function startInterview() {
    if (!invite) return;
    // The interview is generated from the campaign's own description, and the
    // token travels with it so the finished session can be attached to this
    // invitation.
    stashCampaignInterview({
      token,
      candidateId: invite.candidateId,
      campaignId: invite.campaign.id,
      jobDescription: invite.campaign.jobDescription,
      role: invite.campaign.title,
      company: invite.campaign.company,
    });
    router.push(`/mock-interview?${CAMPAIGN_PARAM}=1`);
  }

  return (
    <main className="sf-app-bg min-h-[100svh] px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <Link href="/" className="mb-7 inline-flex items-center gap-2.5">
          <BrandMark className="h-6 w-6" />
          <span className="font-century text-[17px] font-bold text-[var(--sf-ink)]">
            Smartfolio-AI
          </span>
        </Link>

        {stage === 'loading' && (
          <p className="py-20 text-center text-sm text-[var(--sf-muted)]">Checking your link…</p>
        )}

        {(stage === 'gone' || stage === 'invalid') && (
          <div className="sf-panel rounded-2xl p-7" data-testid="invite-closed">
            <div className="flex gap-3.5">
              <FiAlertCircle
                className={
                  'mt-0.5 h-5 w-5 shrink-0 ' +
                  (stage === 'gone' ? 'text-[var(--sf-red)]' : 'text-[var(--sf-muted)]')
                }
              />
              <div>
                <h1 className="text-[15.5px] font-bold text-[var(--sf-ink)]">
                  {stage === 'gone' ? 'This interview link has closed' : 'This link is not valid'}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--sf-muted)]">
                  {message}
                  {stage === 'gone' &&
                    ' If you were not able to take it in time, reply to the invitation email and ask them to reopen it.'}
                </p>
                <Link
                  href="/dashboard"
                  className="sf-subtle-control mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Go to my applications
                </Link>
              </div>
            </div>
          </div>
        )}

        {invite && stage !== 'gone' && stage !== 'invalid' && (
          <>
            <span className="rounded-full bg-[var(--sf-violet-soft)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--sf-violet)]">
              You have been shortlisted
            </span>

            <h1 className="mt-3.5 font-century text-[26px] font-bold leading-[1.16] text-[var(--sf-ink)] sm:text-[32px]">
              {invite.campaign.company} would like to interview you
            </h1>
            <p className="mt-2 max-w-[540px] text-[15.5px] leading-relaxed text-[var(--sf-muted)]">
              For the {invite.campaign.title} role you applied to. The interview is generated from
              that job description and takes around 25 minutes.
            </p>

            {stage === 'intro' && (
              <div className="sf-card mt-7 rounded-2xl p-6 sm:p-7" data-testid="invite-intro">
                <h2 className="mb-4.5 text-base font-bold text-[var(--sf-ink)]">What to expect</h2>

                <div className="flex flex-col gap-4">
                  <Expect icon={<FiClock />} title="Three rounds, about 25 minutes">
                    Background, technical, and one problem to work through. You can speak your
                    answers or type them.
                  </Expect>
                  <Expect icon={<FiShield />} title="A connection check first">
                    The same twenty-second check you ran when you applied. Please turn off any VPN
                    before you start.
                  </Expect>
                  <Expect icon={<FiCalendar />} title={deadlineLine(invite.expiresAt)} tone="warn">
                    Take it whenever suits you before then. Once you begin, finish in one sitting.
                  </Expect>
                </div>

                <div className="my-5 h-px bg-[#edf3ff]" />

                <button
                  type="button"
                  onClick={begin}
                  className="sf-primary w-full rounded-2xl py-3.5 text-[15px] font-bold"
                  data-testid="invite-begin"
                >
                  {signedIn ? 'Run the check and begin' : 'Sign in and begin'}
                </button>
                {!signedIn && (
                  <p className="mt-3 text-center text-[13px] text-[var(--sf-muted)]">
                    Sign in with the account you applied with. You will come straight back here.
                  </p>
                )}
              </div>
            )}

            {stage === 'checking' && (
              <div className="mt-7" data-testid="invite-checking">
                <VerificationGate context="interview" autoStart onComplete={onChecked} />
              </div>
            )}

            {stage === 'ready' && (
              <div className="sf-card mt-7 rounded-2xl p-6 sm:p-7" data-testid="invite-ready">
                <h2 className="text-base font-bold text-[var(--sf-ink)]">You are all set</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--sf-muted)]">
                  Find somewhere quiet with a working microphone. The interview begins as soon as
                  you press start, and runs in one sitting.
                </p>
                <button
                  type="button"
                  onClick={startInterview}
                  className="sf-primary mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-bold"
                  data-testid="invite-start"
                >
                  Start the interview <FiArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function deadlineLine(expiresAt: string | null): string {
  if (!expiresAt) return 'Open for the next two weeks';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Open for a limited time';
  return `Open until ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

function Expect({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'warn';
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl"
        style={
          tone === 'warn'
            ? { background: 'var(--sf-yellow-soft)', color: 'var(--sf-yellow)' }
            : { background: 'var(--sf-primary-soft)', color: 'var(--sf-primary)' }
        }
      >
        {icon}
      </span>
      <div>
        <div className="text-[14.5px] font-bold text-[var(--sf-ink)]">{title}</div>
        <div className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--sf-muted)]">{children}</div>
      </div>
    </div>
  );
}
