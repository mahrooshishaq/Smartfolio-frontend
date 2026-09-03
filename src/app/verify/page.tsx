'use client';

/**
 * Standalone connection check.
 *
 * This is the tester link: "open this, run it once normally, then once with a
 * VPN on, and tell me what it said both times." It is also where a candidate is
 * sent when a check needs re-running outside an application.
 *
 * Public and unauthenticated on purpose - the people most useful to test with
 * are the ones who have never signed up.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Select } from '@/components/ui/Select';
import VerificationGate from '@/components/verification/VerificationGate';
import BrandMark from '@/components/BrandMark';
import type { VerificationResult } from '@/lib/verification/collector';
import { APPLY_COUNTRIES as COUNTRIES } from '@/lib/countries';



export default function VerifyPage() {
  const [country, setCountry] = useState('');
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  return (
    <main className="sf-app-bg min-h-[100svh] px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-[560px]">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="font-century text-lg font-bold text-[var(--sf-ink)]">Smartfolio-AI</span>
        </Link>

        <h1 className="text-2xl font-bold text-[var(--sf-ink)] sm:text-3xl">Connection check</h1>
        <p className="mt-2 text-sm text-[var(--sf-muted)]">
          Confirms where you are connecting from, and that your camera and microphone are real
          devices rather than software standing in for them. It takes about 20 seconds.
        </p>

        {!started && (
          <div className="sf-card mt-6 p-5">
            <label
              htmlFor="country"
              className="block text-sm font-semibold text-[var(--sf-ink-soft)]"
            >
              Which country are you in right now?
            </label>
            <p className="mt-1 text-xs text-[var(--sf-muted)]">
              Answer honestly. The check compares your answer against your connection, so a wrong
              answer here is what creates a mismatch.
            </p>
            <div className="mt-3">
              <Select
                value={country}
                onChange={setCountry}
                placeholder="Select a country"
                ariaLabel="Country you are in"
                options={COUNTRIES.map(([value, label]) => ({ value, label }))}
              />
            </div>
            <button
              type="button"
              disabled={!country}
              onClick={() => setStarted(true)}
              className="sf-primary mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="verify-begin"
            >
              Start the check
            </button>
          </div>
        )}

        {started && (
          <VerificationGate
            context="apply"
            declaredCountry={country}
            autoStart
            onComplete={setResult}
            className="mt-6"
          />
        )}

        {result && result.verdict !== 'blocked' && (
          <div className="sf-panel mt-4 p-5">
            <h2 className="text-sm font-semibold text-[var(--sf-ink)]">What happens next</h2>
            <p className="mt-1 text-sm text-[var(--sf-muted)]">
              Nothing to do. The result is recorded against your application; if anything needs a
              closer look, a person reviews it rather than an automated decision being made.
            </p>
          </div>
        )}

        <p className="mt-8 text-xs text-[var(--sf-muted)]">
          We record your IP address, approximate location, and non-identifying details about your
          browser and device. We do not read files, browsing history, or anything on your screen.
        </p>
      </div>
    </main>
  );
}
