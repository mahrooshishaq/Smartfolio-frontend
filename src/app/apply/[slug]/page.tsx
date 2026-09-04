'use client';

/**
 * The public apply page.
 *
 * The most important page in this flow: it is where campaign traffic lands, and
 * it does the acquisition work for the whole product. Four things it gets right
 * on purpose:
 *
 *  1. The CV uploads the MOMENT it is chosen, not at submit. A File object
 *     cannot survive the signup redirect - it does not serialise - and
 *     base64-into-storage is fragile and size-capped. Uploading early also means
 *     the CV is already parsed by the time they finish signing up.
 *  2. Answers autosave as they type, onto the same draft.
 *  3. The account is created LAST. Everything is saved before anyone is asked
 *     to register, so signing up is claiming work already done rather than a
 *     toll gate in front of it.
 *  4. The confirmation screen is not a receipt. It is where an applicant
 *     becomes a user.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FiUploadCloud, FiCheck, FiFileText, FiArrowRight, FiShield, FiChevronLeft,
} from 'react-icons/fi';
import BrandMark from '@/components/BrandMark';
import AppShell from '@/components/app-shell/AppShell';
import { Select } from '@/components/ui/Select';
import { useFeedback } from '@/components/ui/feedback';
import VerificationGate from '@/components/verification/VerificationGate';
import { publicFetch, sessionFetch, getAccessToken, clearSession } from '@/lib/api';
import {
  rememberPostAuthPath,
  rememberPendingApplication,
  takePendingApplication,
} from '@/lib/post-auth';
import type { VerificationResult } from '@/lib/verification/collector';
import { APPLY_COUNTRIES } from '@/lib/countries';

type Question = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
};

type PublicCampaign = {
  id: string;
  slug: string;
  title: string;
  company: string;
  jobDescription: string;
  location: string | null;
  jobType: string | null;
  questions: Question[];
  applicationDeadline: string | null;
  acceptingApplications: boolean;
  closedReason: string | null;
};

type Stage = 'form' | 'checking' | 'account' | 'submitting' | 'done';

/** undefined = still checking, null = signed out, object = a verified session. */
type Session = { name: string; email: string } | null | undefined;

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { error, success } = useFeedback();

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');

  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [country, setCountry] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [result, setResult] = useState<{
    candidateId: string;
    resumeId: string | null;
    matchScore: string | null;
    alreadyApplied: boolean;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Who is actually signed in — verified, not guessed.
   *
   * The presence of a token in localStorage is not a session: an expired one is
   * still a string. Trusting it made this page skip the account step for
   * someone whose session was dead, while the header simultaneously offered
   * them "Sign in". Both were guessing, and they guessed differently.
   *
   * `undefined` means "not established yet", so nothing renders a wrong answer
   * while the check is in flight.
   */
  const [session, setSession] = useState<Session>(undefined);
  const signedIn = Boolean(session);

  /* --------------------------------------------------------------- load -- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await publicFetch(`/api/campaigns/public/${slug}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || 'This role could not be found.');
        }
        const data = (await res.json()) as PublicCampaign;
        if (!cancelled) setCampaign(data);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load this role.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        if (!cancelled) setSession(null);
        return;
      }
      try {
        // sessionFetch refreshes once on a 401, so a merely-expired access
        // token still resolves to a real session rather than a false negative.
        const res = await sessionFetch('/api/auth/me');
        if (!res.ok) throw new Error('no session');
        const me = await res.json();
        if (!cancelled) setSession({ name: me.name, email: me.email });
      } catch {
        // Genuinely gone. Clear it rather than leaving a dead token to mislead
        // the next page as well.
        if (!cancelled) {
          clearSession();
          setSession(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------------- draft -- */

  const saveDraft = useCallback(
    async (body: FormData | Record<string, unknown>) => {
      const init: RequestInit = { method: 'POST' };
      if (body instanceof FormData) {
        init.body = body;
      } else {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body);
      }
      const res = await publicFetch(`/api/campaigns/public/${slug}/draft`, init);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || 'Could not save your application.');
      }
      return res.json();
    },
    [slug],
  );

  async function onFileChosen(chosen: File | undefined) {
    if (!chosen) return;
    if (chosen.size > 5 * 1024 * 1024) {
      error('That file is over 5 MB. Please upload a smaller PDF or DOCX.');
      return;
    }
    if (!/\.(pdf|docx)$/i.test(chosen.name)) {
      error('Please upload a PDF or DOCX file.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', chosen);
      if (country) form.append('declaredCountry', country);
      await saveDraft(form);
      setFile({ name: chosen.name, size: chosen.size });
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not upload your CV.');
    } finally {
      setUploading(false);
    }
  }

  /** Debounced so typing an answer is not one request per keystroke. */
  function onAnswer(id: string, value: string) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraft({ answers: next, declaredCountry: country || undefined }).catch(() => {
        // Autosave failing silently is correct here: the submit re-sends
        // everything, so a dropped keystroke save costs nothing and a toast on
        // every flaky request would be noise while they are typing.
      });
    }, 900);
  }

  function missingRequired(): string | null {
    if (!file) return 'Please attach your CV.';
    if (!country) return 'Please tell us which country you are in.';
    for (const q of campaign?.questions ?? []) {
      if (q.required && !answers[q.id]?.trim()) return `Please answer: ${q.label}`;
    }
    return null;
  }

  async function continueToCheck() {
    const missing = missingRequired();
    if (missing) return error(missing);
    try {
      await saveDraft({ answers, declaredCountry: country });
      setStage('checking');
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not save your application.');
    }
  }

  async function onVerified(outcome: VerificationResult) {
    setVerification(outcome);
    try {
      await saveDraft({ verificationSessionId: outcome.id, declaredCountry: country });
    } catch {
      // The check is already stored server-side; linking it to the draft is a
      // convenience, and losing that link must not block an application.
    }
    // `blocked` stops here and the gate explains how to fix it. `review` also
    // stops here — not to refuse anyone, but because being advanced past a
    // finding they never saw is how a candidate later discovers they were
    // "flagged" and was never told. The gate shows a Continue button.
    if (outcome.verdict !== 'clean') return;
    setStage(signedIn ? 'submitting' : 'account');
  }

  /* -------------------------------------------------------------- claim -- */

  const claim = useCallback(async () => {
    try {
      // publicFetch, not apiFetch: this call needs the draft COOKIE, and
      // apiFetch sends everything to NEXT_PUBLIC_API_URL — a different origin,
      // where a SameSite=Lax cookie is never sent and a credentialed request
      // is rejected outright. publicFetch stays same-origin and still attaches
      // the access token, which is all the authentication this needs.
      //
      // This is the last step of the whole flow: getting it wrong loses the
      // application after the candidate has done every bit of the work.
      const res = await sessionFetch(`/api/campaigns/public/${slug}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Could not submit your application.');
      }
      const data = await res.json();
      setResult(data);
      setStage('done');
      if (!data.alreadyApplied) success('Your application is in.');
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not submit your application.');
      setStage('form');
    }
  }, [slug, error, success]);

  useEffect(() => {
    if (stage === 'submitting') void claim();
  }, [stage, claim]);

  /**
   * Returning from signup, signed in, having left an application behind.
   *
   * The draft is identified by an httpOnly cookie, which the page cannot read -
   * that is the point of httpOnly. So the marker set on the way out is what
   * tells us to finish the job rather than making them find their place again.
   */
  useEffect(() => {
    if (!campaign || stage !== 'form' || !signedIn) return;
    if (takePendingApplication() !== slug) return;
    setStage('submitting');
  }, [campaign, stage, signedIn, slug]);

  function goToAuth(path: '/signup' | '/login') {
    rememberPostAuthPath(`/apply/${slug}`);
    rememberPendingApplication(slug);
    router.push(path);
  }

  /* ------------------------------------------------------------- render -- */

  if (loadError) {
    return (
      <Shell session={session}>
        <div className="sf-card mx-auto max-w-[520px] rounded-2xl p-8 text-center">
          <h1 className="text-lg font-bold text-[var(--sf-ink)]">This role is not available</h1>
          <p className="mt-2 text-sm text-[var(--sf-muted)]">{loadError}</p>
          <Link
            href="/"
            className="sf-subtle-control mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <FiChevronLeft className="h-4 w-4" /> Go to Smartfolio
          </Link>
        </div>
      </Shell>
    );
  }

  if (!campaign) {
    return (
      <Shell session={session}>
        <p className="py-20 text-center text-sm text-[var(--sf-muted)]">Loading this role…</p>
      </Shell>
    );
  }

  if (stage === 'done' && result) {
    // Inside the app shell, not the public one. By this point they have an
    // account and an application on it — leaving them on a bare page with a
    // logo and no navigation is a dead end at exactly the moment they are most
    // likely to look around. The sidebar is the difference between "thanks,
    // goodbye" and "here is the rest of it".
    return (
      <AppShell>
        <Confirmation campaign={campaign} result={result} verification={verification} />
      </AppShell>
    );
  }

  return (
    <Shell session={session}>
      {/* hero */}
      <div className="mb-7">
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--sf-violet-soft)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--sf-violet)]">
            Verified hiring
          </span>
          {campaign.acceptingApplications ? (
            <span className="rounded-full bg-[var(--sf-green-soft)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--sf-green)]">
              Accepting applications
            </span>
          ) : (
            <span className="rounded-full bg-[#f8fbff] px-2.5 py-1 text-[11.5px] font-bold text-[var(--sf-muted)]">
              Closed
            </span>
          )}
        </div>

        <h1 className="font-century text-[32px] font-bold leading-[1.12] tracking-tight text-[var(--sf-ink)] sm:text-[42px]">
          {campaign.title}
        </h1>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-[var(--sf-ink-soft)]">
          <span className="font-semibold">{campaign.company}</span>
          {campaign.location && <Dot />}
          {campaign.location && <span>{campaign.location}</span>}
          {campaign.jobType && <Dot />}
          {campaign.jobType && <span>{campaign.jobType}</span>}
        </div>

        {campaign.applicationDeadline && campaign.acceptingApplications && (
          <p className="mt-3 text-[15px] text-[var(--sf-muted)]">
            Applications close{' '}
            {new Date(campaign.applicationDeadline).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
            })}
            .
          </p>
        )}
      </div>

      {!campaign.acceptingApplications ? (
        <div className="sf-card rounded-2xl p-7">
          <h2 className="text-base font-bold text-[var(--sf-ink)]">
            {campaign.closedReason ?? 'This role is not accepting applications.'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--sf-muted)]">
            You can still read the description below. Smartfolio finds roles like this one from your
            CV — create an account and we will look for you.
          </p>
          <Link
            href="/signup"
            className="sf-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            Find roles like this <FiArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-7">
            <JobDescription text={campaign.jobDescription} />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_428px]">
          {/* JD — second on mobile, because the form is the point */}
          <div className="order-2 lg:order-1">
            <div className="sf-card rounded-2xl p-6 sm:p-8">
              <h2 className="mb-3.5 text-[17px] font-bold text-[var(--sf-ink)]">About the role</h2>
              <JobDescription text={campaign.jobDescription} />
            </div>
          </div>

          {/* the application */}
          <div className="order-1 lg:order-2">
            {stage === 'form' && (
              <div className="sf-panel rounded-2xl p-6" data-testid="apply-form">
                <h2 className="text-[18px] font-bold text-[var(--sf-ink)]">Apply</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--sf-muted)]">
                  Takes about three minutes. You can create your account at the end — nothing you
                  enter here is lost.
                </p>

                <div className="mt-5">
                  <FieldLabel>Your CV</FieldLabel>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    data-testid="cv-input"
                    onChange={(e) => onFileChosen(e.target.files?.[0])}
                  />

                  {file ? (
                    <div
                      className="flex items-center gap-3 rounded-2xl border border-[var(--sf-green-soft)] bg-[var(--sf-green-soft)] px-4 py-3.5"
                      data-testid="cv-attached"
                    >
                      <FiCheck className="h-5 w-5 shrink-0 text-[var(--sf-green)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--sf-ink)]">
                          {file.name}
                        </div>
                        <div className="text-xs text-[var(--sf-muted)]">
                          Uploaded · {(file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="shrink-0 text-xs font-bold text-[var(--sf-primary-dark)]"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading}
                      className="w-full rounded-2xl border-[1.5px] border-dashed border-[var(--sf-primary-ring)] bg-[#f8fbff] px-5 py-6 text-center transition-colors hover:border-[var(--sf-primary)] disabled:opacity-60"
                      data-testid="cv-dropzone"
                    >
                      <FiUploadCloud className="mx-auto mb-2.5 h-6 w-6 text-[var(--sf-primary)]" />
                      <span className="block text-sm font-semibold text-[var(--sf-ink)]">
                        {uploading ? 'Uploading…' : 'Choose your CV'}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-[var(--sf-muted)]">
                        PDF or DOCX, up to 5 MB
                      </span>
                    </button>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
                    Uploads as soon as you choose it, so it survives signing up.
                  </p>
                </div>

                <div className="mt-5">
                  <FieldLabel>Which country are you in?</FieldLabel>
                  <Select
                    value={country}
                    onChange={(value) => {
                      setCountry(value);
                      void saveDraft({ declaredCountry: value, answers }).catch(() => {});
                    }}
                    options={APPLY_COUNTRIES.map(([value, label]) => ({ value, label }))}
                    placeholder="Select a country"
                    ariaLabel="Country you are in"
                    className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-ink)]"
                  />
                </div>

                {campaign.questions.map((q) => (
                  <div className="mt-5" key={q.id}>
                    <FieldLabel>
                      {q.label}
                      {!q.required && (
                        <span className="ml-1.5 font-normal text-[var(--sf-muted-soft)]">
                          (optional)
                        </span>
                      )}
                    </FieldLabel>

                    {q.type === 'textarea' && (
                      <textarea
                        rows={4}
                        value={answers[q.id] ?? ''}
                        onChange={(e) => onAnswer(q.id, e.target.value)}
                        placeholder="A few sentences is plenty."
                        className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--sf-ink)] outline-none focus:border-[var(--sf-primary)]"
                        data-question={q.id}
                      />
                    )}
                    {q.type === 'text' && (
                      <input
                        value={answers[q.id] ?? ''}
                        onChange={(e) => onAnswer(q.id, e.target.value)}
                        className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-ink)] outline-none focus:border-[var(--sf-primary)]"
                        data-question={q.id}
                      />
                    )}
                    {q.type === 'select' && (
                      <Select
                        value={answers[q.id] ?? ''}
                        onChange={(value) => onAnswer(q.id, value)}
                        options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
                        placeholder="Select"
                        ariaLabel={q.label}
                        className="w-full rounded-xl border border-[var(--sf-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-ink)]"
                      />
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={continueToCheck}
                  className="sf-primary mt-6 w-full rounded-2xl py-3.5 text-[15px] font-bold"
                  data-testid="apply-continue"
                >
                  Continue
                </button>

                <div className="mt-4 flex items-start gap-2.5">
                  <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sf-muted-soft)]" />
                  <p className="text-xs leading-relaxed text-[var(--sf-muted-soft)]">
                    A short connection check runs next. It confirms where you are applying from — it
                    does not read your files, your screen, or your browsing.
                  </p>
                </div>
              </div>
            )}

            {stage === 'checking' && (
              <div data-testid="apply-checking">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--sf-muted-soft)]">
                  Step 2 of 3
                </p>
                <VerificationGate
                  context="apply"
                  declaredCountry={country}
                  campaignId={campaign.id}
                  autoStart
                  onComplete={onVerified}
                  onContinue={() => setStage(signedIn ? 'submitting' : 'account')}
                />
                <p className="mt-3 text-xs text-[var(--sf-muted-soft)]">
                  Your CV and answers are already saved.
                </p>
              </div>
            )}

            {stage === 'account' && (
              <div className="sf-panel rounded-2xl p-6" data-testid="apply-account">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--sf-muted-soft)]">
                  Step 3 of 3
                </p>
                <h2 className="text-[18px] font-bold text-[var(--sf-ink)]">
                  Last thing — who is this from?
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--sf-muted)]">
                  Your application is already saved. An account is what lets you track it, and gives
                  you the rest of Smartfolio while you wait.
                </p>

                <div className="mt-4 flex flex-col gap-2.5 rounded-2xl bg-[#f8fbff] p-4">
                  <Saved label="CV uploaded" detail={file?.name} />
                  {campaign.questions.length > 0 && (
                    <Saved
                      label={`${campaign.questions.length} question${campaign.questions.length === 1 ? '' : 's'} answered`}
                    />
                  )}
                  <Saved
                    label={
                      verification?.verdict === 'review'
                        ? 'Connection check complete — one detail flagged'
                        : 'Connection check passed'
                    }
                    tone={verification?.verdict === 'review' ? 'warn' : undefined}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => goToAuth('/signup')}
                  className="sf-primary mt-5 w-full rounded-2xl py-3.5 text-[15px] font-bold"
                  data-testid="apply-create-account"
                >
                  Create an account and submit
                </button>
                <button
                  type="button"
                  onClick={() => goToAuth('/login')}
                  className="sf-subtle-control mt-2.5 w-full rounded-2xl py-3 text-sm font-semibold"
                  data-testid="apply-sign-in"
                >
                  I already have an account
                </button>
                <p className="mt-3 text-center text-xs text-[var(--sf-muted-soft)]">
                  You will come straight back here.
                </p>
              </div>
            )}

            {stage === 'submitting' && (
              <div className="sf-panel rounded-2xl p-8 text-center" data-testid="apply-submitting">
                <p className="text-sm font-semibold text-[var(--sf-ink)]">Submitting your application…</p>
                <p className="mt-1.5 text-sm text-[var(--sf-muted)]">
                  Attaching your CV and answers.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------- pieces -- */

function Shell({ children, session }: { children: React.ReactNode; session?: Session }) {
  return (
    <main className="sf-app-bg min-h-[100svh] pb-16">
      <div className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="font-century text-[19px] font-bold text-[var(--sf-ink)]">
            Smartfolio-AI
          </span>
        </Link>
        {session ? (
          <span className="text-[13.5px] text-[var(--sf-muted)]">
            Applying as{' '}
            <strong className="font-semibold text-[var(--sf-ink-soft)]">{session.name}</strong>
          </span>
        ) : session === null ? (
          <Link
            href="/login"
            className="sf-subtle-control rounded-xl px-4 py-2 text-[13.5px] font-semibold"
          >
            Sign in
          </Link>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-[1180px] px-5 pt-6 sm:px-10">{children}</div>
    </main>
  );
}

const Dot = () => (
  <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--sf-muted-soft)]" />
);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[13px] font-bold text-[var(--sf-ink-soft)]">{children}</span>
  );
}

function Saved({
  label,
  detail,
  tone,
}: {
  label: string;
  detail?: string;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-center gap-2.5">
      <FiCheck
        className={
          'h-4 w-4 shrink-0 ' +
          (tone === 'warn' ? 'text-[var(--sf-yellow)]' : 'text-[var(--sf-green)]')
        }
      />
      <span className="flex-1 text-sm text-[var(--sf-ink-soft)]">{label}</span>
      {detail && <span className="truncate text-xs text-[var(--sf-muted-soft)]">{detail}</span>}
    </div>
  );
}

/** Plain text, rendered with its paragraphs intact rather than as one block. */
function JobDescription({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((paragraph, i) => (
          <p key={i} className="whitespace-pre-line text-[15px] leading-[1.68] text-[var(--sf-ink-soft)]">
            {paragraph.trim()}
          </p>
        ))}
    </div>
  );
}

/**
 * The confirmation screen.
 *
 * Deliberately not a receipt. An applicant who reads "thanks, we'll be in
 * touch" closes the tab and never comes back; this screen is the one chance to
 * turn them into a user, so it leads with what their CV scored and what else it
 * fits.
 */
function Confirmation({
  campaign,
  result,
  verification,
}: {
  campaign: PublicCampaign;
  result: { matchScore: string | null; resumeId: string | null; alreadyApplied: boolean };
  verification: VerificationResult | null;
}) {
  const score = result.matchScore ? Math.round(Number(result.matchScore)) : null;

  return (
    <div className="px-1 py-2">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-2.5 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sf-green-soft)]">
            <FiCheck className="h-3.5 w-3.5 text-[var(--sf-green)]" />
          </span>
          <span className="text-sm font-bold text-[var(--sf-green)]" data-testid="apply-confirmed">
            {result.alreadyApplied
              ? `You have already applied to ${campaign.company}`
              : `Application sent to ${campaign.company}`}
          </span>
        </div>

        <h1 className="font-century text-[28px] font-bold tracking-tight text-[var(--sf-ink)] sm:text-[34px]">
          While you wait —
        </h1>
        <p className="mt-2 max-w-[560px] text-[15.5px] leading-relaxed text-[var(--sf-muted)]">
          We read your CV as part of the application. Here is how it scored against this role, and
          what else it is a good fit for.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="sf-card rounded-2xl p-6 text-center">
            <ScoreRing value={score} />
            <div className="mt-3 text-[14.5px] font-bold text-[var(--sf-ink)]">Match score</div>
            <div className="mt-1 text-[13px] leading-relaxed text-[var(--sf-muted)]">
              Your profile against this role&rsquo;s description
            </div>
          </div>

          <div className="sf-panel rounded-2xl p-6">
            <h2 className="text-base font-bold text-[var(--sf-ink)]">What happens next</h2>
            <ol className="mt-3.5 space-y-3.5">
              <Step n={1} title="A person reads your application">
                {campaign.company} reviews the shortlist themselves. Nothing here rejects anyone
                automatically.
              </Step>
              <Step n={2} title="If you are shortlisted, you get an interview link">
                It is generated from this exact job description, and you take it whenever suits you.
              </Step>
              <Step n={3} title="You hear back either way">
                By email, to the address you just signed up with.
              </Step>
            </ol>

            {verification?.verdict === 'review' && (
              <p className="mt-4 rounded-xl bg-[var(--sf-yellow-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--sf-yellow)]">
                One detail of your connection did not line up with the country you gave. A person
                will look at it — it does not stop your application.
              </p>
            )}
          </div>
        </div>

        <div className="sf-card mt-6 flex flex-col items-start gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-[var(--sf-ink)]">
              Practise this exact interview
            </h2>
            <p className="mt-1.5 max-w-[470px] text-[14.5px] leading-relaxed text-[var(--sf-muted)]">
              If {campaign.company} shortlist you, the interview is generated from this job
              description. You can run it now, as many times as you like, and see how you score.
            </p>
            <Link
              href={`/mock-interview?jd=${encodeURIComponent(campaign.slug)}`}
              className="sf-primary mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-bold"
              data-testid="practice-interview"
            >
              Start a practice interview <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/jobs" className="sf-panel rounded-2xl p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2.5">
              <FiFileText className="h-4 w-4 text-[var(--sf-primary)]" />
              <span className="text-[15px] font-bold text-[var(--sf-ink)]">
                Roles that fit your CV
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--sf-muted)]">
              We are searching now, using the CV you just sent. Your feed fills within a few minutes.
            </p>
          </Link>

          <Link
            href="/dashboard"
            className="sf-panel rounded-2xl p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <FiCheck className="h-4 w-4 text-[var(--sf-primary)]" />
              <span className="text-[15px] font-bold text-[var(--sf-ink)]">Your CV report</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--sf-muted)]">
              Where your CV is strong, where it loses points, and what to change first.
            </p>
          </Link>
        </div>

        <p className="mt-8 text-[13.5px] text-[var(--sf-muted)]">
          {campaign.company} will email you either way. Nothing else is needed from you today.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sf-primary-soft)] text-xs font-bold text-[var(--sf-primary-dark)]">
        {n}
      </span>
      <div>
        <div className="text-[14.5px] font-bold text-[var(--sf-ink)]">{title}</div>
        <div className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--sf-muted)]">{children}</div>
      </div>
    </li>
  );
}

function ScoreRing({ value }: { value: number | null }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const circumference = 2 * Math.PI * 55;
  return (
    <svg viewBox="0 0 132 132" className="mx-auto block h-[132px] w-[132px]" role="img"
         aria-label={value === null ? 'Score not available yet' : `Match score ${pct} out of 100`}>
      <circle cx="66" cy="66" r="55" fill="none" stroke="var(--sf-primary-soft)" strokeWidth="13" />
      <circle
        cx="66" cy="66" r="55" fill="none" stroke="var(--sf-primary)" strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="62" textAnchor="middle" className="font-century"
            fontSize="34" fontWeight="700" fill="var(--sf-ink)">
        {value === null ? '—' : pct}
      </text>
      <text x="66" y="82" textAnchor="middle" fontSize="12" fill="var(--sf-muted)">
        out of 100
      </text>
    </svg>
  );
}
