'use client';

/**
 * The candidate-facing half of the location and presence check.
 *
 * Three outcomes, and how each is presented matters more than the detection
 * behind it:
 *
 *   clean    - say so briefly and move on. Most people land here.
 *   blocked  - something FIXABLE. Say what to change ("turn off your VPN"),
 *              and let them run it again. Never a dead end.
 *   review   - accepted and passed to a human. The candidate is not accused of
 *              anything and is not stopped; they simply continue.
 *
 * Nothing here rejects anybody. A shared computer, a mobile connection or an
 * unusual route are all normal in the markets this serves, so the copy never
 * implies wrongdoing - a false accusation costs a real candidate, and they do
 * not come back.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiShield, FiLoader, FiRefreshCw } from 'react-icons/fi';
import {
  runVerification,
  actionableFindings,
  STEP_LABELS,
  type StepKey,
  type StepState,
  type VerificationContext,
  type VerificationResult,
} from '@/lib/verification/collector';
import { APPLY_COUNTRIES } from '@/lib/countries';

type Props = {
  context: VerificationContext;
  declaredCountry?: string;
  campaignCandidateId?: string;
  /** Recorded on the check itself, so a blocked applicant is still countable. */
  campaignId?: string;
  /** Fires once the check has been submitted, whatever the verdict. */
  onComplete?: (result: VerificationResult) => void;
  /**
   * Shown as a Continue button on a `review` verdict. A review does not stop
   * anyone, but they should read what was found before moving on rather than
   * being swept past it.
   */
  onContinue?: () => void;
  /** Start as soon as the component mounts rather than on a button press. */
  autoStart?: boolean;
  className?: string;
};

type Phase = 'idle' | 'running' | 'done' | 'error';

export default function VerificationGate({
  context,
  declaredCountry,
  campaignCandidateId,
  campaignId,
  onComplete,
  onContinue,
  autoStart = false,
  className = '',
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    env: 'pending', device: 'pending', devices: 'pending',
    ip: 'pending', latency: 'pending', submit: 'pending',
  });
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setPhase('running');
    setError(null);
    setSteps({
      env: 'pending', device: 'pending', devices: 'pending',
      ip: 'pending', latency: 'pending', submit: 'pending',
    });

    try {
      const outcome = await runVerification({
        context,
        declaredCountry,
        campaignCandidateId,
        campaignId,
        onStep: ({ key, state }) => setSteps((s) => ({ ...s, [key]: state })),
      });
      setResult(outcome);
      setPhase('done');
      onComplete?.(outcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, [context, declaredCountry, campaignCandidateId, campaignId, onComplete]);

  useEffect(() => {
    // The ref guard matters under React 18 StrictMode, which mounts twice in
    // development - without it the check would run (and store) twice per visit.
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, start]);

  if (phase === 'idle') {
    return (
      <div className={`sf-card p-5 ${className}`} data-testid="verification-idle">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--sf-ink)]">Quick connection check</h3>
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              Takes about 20 seconds. It confirms where you are connecting from and that your
              camera and microphone are real devices.
            </p>
            <button
              type="button"
              onClick={start}
              className="sf-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
              data-testid="verification-start"
            >
              Run the check
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className={`sf-card p-5 ${className}`} data-testid="verification-running">
        <div className="flex items-center gap-2">
          <FiLoader className="h-4 w-4 animate-spin text-[var(--sf-primary)]" />
          <h3 className="text-base font-semibold text-[var(--sf-ink)]">Checking your connection</h3>
        </div>
        <ul className="mt-4 space-y-2">
          {STEP_LABELS.map(([key, label]) => (
            <li key={key} className="flex items-center gap-2.5 text-sm" data-step={key} data-state={steps[key]}>
              <span
                aria-hidden
                className={
                  'h-2 w-2 shrink-0 rounded-full ' +
                  (steps[key] === 'done'
                    ? 'bg-[var(--sf-green)]'
                    : steps[key] === 'run'
                      ? 'animate-pulse bg-[var(--sf-primary)]'
                      : steps[key] === 'fail'
                        ? 'bg-[var(--sf-yellow)]'
                        : 'bg-[var(--sf-primary-ring)]')
                }
              />
              <span
                className={
                  steps[key] === 'pending' ? 'text-[var(--sf-muted-soft)]' : 'text-[var(--sf-ink-soft)]'
                }
              >
                {label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--sf-muted)]">
          A step that cannot finish is skipped rather than failing the check.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={`sf-card p-5 ${className}`} data-testid="verification-error">
        <h3 className="text-base font-semibold text-[var(--sf-ink)]">
          We could not finish the check
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--sf-muted)]">{error}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
          This is a problem at our end or with the connection between us — not with your
          application. Nothing you have entered has been lost.
        </p>
        <button
          type="button"
          onClick={start}
          className="sf-subtle-control mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <FiRefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const blocks = result.findings.filter((f) => f.level === 'block');
  const contradictions = result.findings.filter((f) => f.level === 'contradiction');
  const isBlocked = result.verdict === 'blocked';
  const needsReview = result.verdict === 'review';

  return (
    <div
      className={`sf-card p-5 ${className}`}
      data-testid="verification-result"
      data-verdict={result.verdict}
    >
      <div className="flex items-start gap-3">
        {isBlocked || needsReview ? (
          <FiAlertTriangle
            className={
              'mt-0.5 h-5 w-5 shrink-0 ' +
              (isBlocked ? 'text-[var(--sf-yellow)]' : 'text-[var(--sf-muted)]')
            }
          />
        ) : (
          <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-green)]" />
        )}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[var(--sf-ink)]">
            {isBlocked
              ? 'One thing to change first'
              : needsReview
                ? 'Check complete — one thing to flag'
                : 'Connection check complete'}
          </h3>

          {isBlocked ? (
            <>
              <p className="mt-1 text-sm text-[var(--sf-muted)]">
                We could not confirm where you are connecting from. This is fixable - adjust the
                below and run the check again.
              </p>
              <ul className="mt-3 space-y-2">
                {blocks.map((f) => (
                  <li
                    key={f.code}
                    className="sf-accent-yellow rounded-xl px-3 py-2 text-sm"
                    data-finding={f.code}
                  >
                    {humanise(f.code, f.detail)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={start}
                className="sf-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                data-testid="verification-retry"
              >
                <FiRefreshCw className="h-4 w-4" /> Check again
              </button>
            </>
          ) : needsReview ? (
            <>
              {/* A review is NOT a rejection and must not read like one. The
                  candidate continues either way — but they are told what we
                  saw, because finding out later that something was "flagged"
                  and never explained is worse than being told now. */}
              <p className="mt-1 text-sm leading-relaxed text-[var(--sf-muted)]">
                Your application continues as normal. One detail did not line up, so a person will
                take a look — nothing is decided automatically.
              </p>
              <ul className="mt-3 space-y-2">
                {contradictions.map((f) => (
                  <li
                    key={f.code}
                    className="rounded-xl bg-[var(--sf-yellow-soft)] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--sf-ink-soft)]"
                    data-finding={f.code}
                  >
                    {humanise(f.code, f.detail)}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-[var(--sf-muted-soft)]">
                If that looks wrong — you are not on a VPN and the country is right — you can run
                the check again and it will use whatever it sees this time.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {onContinue && (
                  <button
                    type="button"
                    onClick={onContinue}
                    className="sf-primary rounded-xl px-4 py-2 text-sm font-bold"
                    data-testid="verification-continue"
                  >
                    Continue anyway
                  </button>
                )}
                <button
                  type="button"
                  onClick={start}
                  className="sf-subtle-control inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  data-testid="verification-recheck"
                >
                  <FiRefreshCw className="h-4 w-4" /> Run it again
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              {result.country
                ? `Connecting from ${countryName(result.country)}. You are all set.`
                : 'You are all set.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Turns a finding into something a candidate can act on.
 *
 * The server's `detail` is written for an operator: it names ASNs, regions and
 * round-trip times. A candidate needs to know what to DO, and being told their
 * network "belongs to a hosting provider" tells them nothing. Where the
 * specifics matter — which country we saw — they are pulled out of the detail
 * rather than dropped, because "we think you are somewhere else" without saying
 * where is worse than saying nothing.
 */
function humanise(code: string, detail: string): string {
  switch (code) {
    /* ---- blocks: fixable, and the candidate is the one who fixes them ---- */
    case 'hosting_asn':
    case 'hosting_asn_name':
    case 'datacenter_range':
      return 'Your connection looks like a VPN, proxy or company network rather than an ordinary home or mobile one. Please turn off any VPN and run the check again.';
    case 'known_proxy':
      // Never phrased as "turn off your VPN". This flag comes from a public
      // database that mislabels whole consumer ISPs — telling someone on an
      // ordinary home connection to switch off something they are not using
      // makes the product look broken and them feel accused.
      return 'A public database lists your network as a proxy or VPN. That sometimes happens to ordinary home connections, so it is not held against you on its own — if you are on a VPN, turning it off and rechecking will clear it.';
    case 'tor_exit':
      return 'You appear to be connecting through Tor. Please use your normal internet connection instead.';
    case 'virtual_camera':
      return 'A virtual camera (OBS, ManyCam or similar) is running. Please close it and run the check again.';
    case 'virtual_microphone':
      return 'A virtual audio device is active. Please close it and run the check again.';

    /* ---- contradictions: explained, never accusations ---- */
    case 'declared_vs_ip': {
      const seen = countriesIn(detail);
      return seen
        ? `You told us you are in ${seen.declared}, but your connection looks like it is in ${seen.actual}. If you are travelling, or using a VPN or company network, that is usually why.`
        : 'The country you gave does not match where your connection appears to be.';
    }
    case 'latency_excludes_declared':
      return 'The speed of your connection to different parts of the world does not line up with the country you gave. A VPN is the most common reason.';
    case 'ipv4_vs_ipv6':
      return 'Your device has two internet connections and they appear to be in different countries. This often happens with a VPN, or with some mobile networks.';
    case 'automation':
      return 'Your browser reports that it is being controlled automatically. If you are using an automation tool or an unusual browser extension, please turn it off.';

    default:
      return detail;
  }
}

/**
 * The two country codes out of a declared_vs_ip detail.
 *
 * Read from the message rather than added as separate fields: the server owns
 * the wording, and duplicating the values into the payload would give two
 * places for them to disagree.
 */
function countriesIn(detail: string): { declared: string; actual: string } | null {
  const match = detail.match(/Declared ([A-Z]{2}), connection resolves to ([A-Z]{2})/);
  return match ? { declared: countryName(match[1]), actual: countryName(match[2]) } : null;
}

function countryName(code: string): string {
  const named = APPLY_COUNTRIES.find(([value]) => value === code);
  return named ? named[1] : code;
}
