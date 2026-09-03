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

type Props = {
  context: VerificationContext;
  declaredCountry?: string;
  campaignCandidateId?: string;
  /** Recorded on the check itself, so a blocked applicant is still countable. */
  campaignId?: string;
  /** Fires once the check has been submitted, whatever the verdict. */
  onComplete?: (result: VerificationResult) => void;
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
        <h3 className="text-base font-semibold text-[var(--sf-ink)]">The check could not be submitted</h3>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">{error}</p>
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
  const isBlocked = result.verdict === 'blocked';

  return (
    <div
      className={`sf-card p-5 ${className}`}
      data-testid="verification-result"
      data-verdict={result.verdict}
    >
      <div className="flex items-start gap-3">
        {isBlocked ? (
          <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-yellow)]" />
        ) : (
          <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-green)]" />
        )}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[var(--sf-ink)]">
            {isBlocked ? 'One thing to change first' : 'Connection check complete'}
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
          ) : (
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              {result.country
                ? `Connecting from ${result.country}. You are all set.`
                : 'You are all set.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Turns a finding into an instruction.
 *
 * The server's `detail` explains the finding to an operator. A candidate needs
 * to know what to DO, and being told their network "belongs to a hosting
 * provider" tells them nothing actionable.
 */
function humanise(code: string, detail: string): string {
  switch (code) {
    case 'hosting_asn':
    case 'hosting_asn_name':
    case 'known_proxy':
    case 'datacenter_range':
      return 'Please turn off your VPN or proxy and run the check again. We need to see your normal internet connection.';
    case 'tor_exit':
      return 'You appear to be connecting through Tor. Please use your normal internet connection instead.';
    case 'virtual_camera':
      return 'A virtual camera (such as OBS) is running. Please close it and run the check again.';
    case 'virtual_microphone':
      return 'A virtual audio device is active. Please close it and run the check again.';
    default:
      return detail;
  }
}
