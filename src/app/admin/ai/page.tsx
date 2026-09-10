'use client';

/**
 * What the AI budget looks like right now.
 *
 * The Hugging Face settings page shows which secrets EXIST. It cannot show
 * whether the running process read them, and the keys are read in sequence —
 * GROQ_API_KEY, then _2, then _3 — stopping at the first gap. A GROQ_API_KEY_3
 * added without a _2 beside it is silently ignored, with no error anywhere. That
 * is a misconfiguration nobody notices until the day the capacity is needed and
 * is not there.
 *
 * So the number that matters on this page is "3 keys in rotation". Everything
 * else is detail.
 */

import { useCallback, useEffect, useState } from 'react';
import { FiCpu, FiRefreshCw, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { adminApi, type AiKeyReport } from '@/lib/admin';
import { useFeedback } from '@/components/ui/feedback';

export default function AdminAiPage() {
  const { error } = useFeedback();
  const [report, setReport] = useState<AiKeyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (announce = false) => {
      setLoading(true);
      try {
        setReport(await adminApi.aiKeys());
      } catch (e) {
        error(e instanceof Error ? e.message : 'Could not read the AI key status.');
      } finally {
        setLoading(false);
        if (announce) {
          /* nothing to announce on success — the numbers speak for themselves */
        }
      }
    },
    [error],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const spent = report ? report.available === 0 && report.configured > 0 : false;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-century text-2xl font-bold text-[var(--sf-ink)]">AI keys</h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] leading-relaxed text-[var(--sf-muted)]">
            Requests go to whichever key has the most budget left, so the three are spent evenly
            rather than one at a time. Usage is what Groq itself reported on the last request each
            key served.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--sf-line)] bg-white px-3.5 py-2 text-[13px] font-bold text-[var(--sf-ink-soft)] disabled:opacity-60"
          data-testid="ai-refresh"
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {report && (
        <>
          {/* The one number worth checking after adding a secret. */}
          <section
            className={`mt-6 rounded-2xl border p-5 ${
              spent
                ? 'border-[var(--sf-red)] bg-[var(--sf-red-soft)]'
                : 'border-[var(--sf-line)] bg-white'
            }`}
            data-testid="ai-summary"
          >
            <div className="flex items-center gap-3">
              {spent ? (
                <FiAlertTriangle className="h-6 w-6 shrink-0 text-[var(--sf-red)]" />
              ) : (
                <FiCpu className="h-6 w-6 shrink-0 text-[var(--sf-primary)]" />
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[var(--sf-ink)]">
                  {report.configured === 0
                    ? 'No key configured'
                    : `${report.configured} key${report.configured === 1 ? '' : 's'} in rotation`}
                  {report.configured > 0 && (
                    <span className="font-semibold text-[var(--sf-muted)]">
                      {' '}· {report.available} with budget left
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--sf-muted)]">
                  {report.configured === 0
                    ? 'AI features are reporting a technical difficulty to users.'
                    : spent
                      ? 'Every key is spent. Users are seeing a temporary-difficulty message rather than an error.'
                      : 'Keys are read as GROQ_API_KEY, then _2, _3, stopping at the first gap — so a missing number hides the ones after it.'}
                </p>
              </div>
            </div>
          </section>

          <ul className="mt-4 space-y-3" data-testid="ai-keys">
            {report.keys.map((key) => {
              const pct = key.usedPercent;
              const tone =
                pct === null
                  ? 'var(--sf-muted-soft)'
                  : pct >= 95
                    ? 'var(--sf-red)'
                    : pct >= 80
                      ? 'var(--sf-yellow)'
                      : 'var(--sf-green)';
              return (
                <li
                  key={key.name}
                  className="rounded-2xl border border-[var(--sf-line)] bg-white p-4 sm:p-5"
                  data-testid="ai-key-row"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[13.5px] font-bold text-[var(--sf-ink)]">
                      {key.name}
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: tone }}>
                      {pct === null ? 'not used yet' : `${pct}% used`}
                      {!key.available && ' · spent'}
                    </span>
                  </div>

                  {/* A bar rather than only a number: three of these side by side
                      show at a glance whether the load is actually spreading. */}
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--sf-line)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct ?? 0}%`, background: tone }}
                    />
                  </div>

                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--sf-muted)]">
                    {key.remainingRequests !== null && key.limitRequests !== null ? (
                      <>
                        {key.remainingRequests.toLocaleString()} of{' '}
                        {key.limitRequests.toLocaleString()} requests left
                        {key.resetsAt && (
                          <> · resets {new Date(key.resetsAt).toLocaleString()}</>
                        )}
                      </>
                    ) : (
                      /* Unmeasured, not full. A quiet key legitimately has no
                         reading yet, and calling that 0% used would be a lie in
                         the reassuring direction. */
                      <>Nothing measured yet — this key has not served a request.</>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>

          <section className="mt-5 rounded-2xl border border-[var(--sf-line)] bg-[var(--sf-surface,white)] p-5">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="h-4 w-4 shrink-0 text-[var(--sf-green)]" />
              <h2 className="text-[14px] font-bold text-[var(--sf-ink)]">When you get emailed</h2>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {report.alertsAt.map((step) => (
                <span
                  key={step}
                  className="rounded-lg bg-[var(--sf-line)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--sf-ink-soft)]"
                >
                  {step}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--sf-muted)]">
              Each step emails every admin once per key per day, and once more if every key is
              spent. Short per-minute limits never email anybody — they recover in a minute, and
              alerting on them would make the alert worthless.
            </p>
          </section>
        </>
      )}

      {loading && !report && (
        <p className="mt-8 text-[13.5px] text-[var(--sf-muted)]">Reading the key status…</p>
      )}
    </div>
  );
}
